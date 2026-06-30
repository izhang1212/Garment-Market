import random
import time
from datetime import datetime, timedelta
from math import log, sqrt
from threading import Lock

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from sqlalchemy import func
from sqlalchemy.orm import Session, joinedload

from app.db.session import SessionLocal
from app.schemas import Item, Transaction
from app.strategies import (
    compute_fair_value,
    compute_volatility,
    find_best_quote,
    find_best_as_quote,
    compute_as_liquidity,
)
from app.decision import (
    trading_decision,
    kalman_estimate,
    compute_z_score,
    ou_half_life,
    compute_sizing,
)
from app.data.kicks_db.match import validated_search, best_image
from app.config import settings
from api.middleware.rate_limit import RateLimiter, client_ip

router = APIRouter()

# ── Rate limiters ─────────────────────────────────────────────────────────────
# /items/{sku}/detail makes 2 KicksDB calls — keep this tight
_detail_limiter = RateLimiter(calls=8, period=60)      # 8 per IP per minute
_detail_global  = RateLimiter(calls=200, period=3600)  # 200 total per hour (key="global")

# Cheap DB-only endpoints
_db_limiter = RateLimiter(calls=60, period=60)         # 60 per IP per minute

# ── SKU response cache (10 min TTL) ──────────────────────────────────────────
# Prevents the same shoe from burning 2 KicksDB calls per visitor.
_detail_cache: dict[str, tuple[float, dict]] = {}
_detail_cache_lock = Lock()
DETAIL_CACHE_TTL = 600  # 10 minutes


def _detail_cache_get(sku: str) -> dict | None:
    with _detail_cache_lock:
        entry = _detail_cache.get(sku)
        if entry and time.time() - entry[0] < DETAIL_CACHE_TTL:
            return entry[1]
        if entry:
            del _detail_cache[sku]
    return None


def _detail_cache_set(sku: str, data: dict) -> None:
    with _detail_cache_lock:
        _detail_cache[sku] = (time.time(), data)

MIN_TRANSACTIONS = 1


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def _round_floats(d: dict) -> dict:
    return {k: (round(v, 4) if isinstance(v, float) else v) for k, v in d.items()}


_RECENT_DAYS     = 90   # window for counting "meaningful" recent transactions
_KALMAN_MIN      = 5    # min recent transactions to trust Kalman level as FV


def _run_models(transactions, inventory: int = 0):
    # ── Layer 1: Kalman filter — run first so we can use its level for FV if
    #    there is enough recent data, and its velocity for the decision gate.
    kalman = kalman_estimate(transactions)

    # ── Adaptive FV selection ─────────────────────────────────────────────────
    # Count transactions in the last 90 days.  ≥5 → Kalman level is a reliable
    # current-price estimate and replaces the recency-weighted mean.  <5 → the
    # velocity estimate is too noisy to trust; fall back to recency-weighted FV
    # computed over the full history.
    cutoff   = datetime.utcnow() - timedelta(days=_RECENT_DAYS)
    n_recent = sum(1 for t in transactions if t.transacted_at >= cutoff)
    fv = kalman["fair_value"] if n_recent >= _KALMAN_MIN else compute_fair_value(transactions)

    vol       = compute_volatility(transactions)
    liquidity = compute_as_liquidity(transactions)

    aggressiveness = max(1.0, sqrt(max(liquidity, 0.0)))

    # EV inventory penalty: 1% of fair value per unit held.
    # Scales naturally with item price — a $200 sneaker costs $2/unit to hold,
    # a $600 item costs $6/unit.  Kept independent of A-S so the two models
    # represent genuinely different approaches to inventory risk.
    EV_ALPHA = 0.01
    ev_penalty = EV_ALPHA * fv

    ev_quote, ev_candidates = find_best_quote(
        fair_value=fv, volatility=vol, inventory=inventory,
        aggressiveness=aggressiveness,
        inventory_penalty=ev_penalty,
    )

    as_quote, _ = find_best_as_quote(
        fair_value=fv, volatility=vol, inventory=inventory,
        risk_aversion_values=[0.001, 0.005, 0.01, 0.02, 0.05],
        liquidity_values=[liquidity],
        time_horizon_values=[0.5, 1.0, 2.0],
        aggressiveness=aggressiveness,
        min_spread=0.0,
    )

    if ev_quote["total_ev"] >= as_quote["total_ev"]:
        winner_quote, winner_name = ev_quote, "ev_model"
    else:
        winner_quote, winner_name = as_quote, "avellaneda_stoikov"

    # ── Decision pipeline ─────────────────────────────────────────────────────
    # Layer 2: Z-score of latest price vs adaptive FV (in units of weighted vol)
    z_score = compute_z_score(transactions, fv, vol)

    # Layer 3: OU half-life → regime (arbitrates Z-score vs velocity gate)
    regime  = ou_half_life(transactions)

    # Layer 4: Kelly fraction per side
    sizing  = compute_sizing(
        fair_value    = fv,
        bid           = winner_quote["bid"],
        ask           = winner_quote["ask"],
        bid_fill_prob = winner_quote["bid_fill_probability"],
        ask_fill_prob = winner_quote["ask_fill_probability"],
    )

    # Layer 5: Final decision
    decision = trading_decision(
        fair_value=fv, volatility=vol, inventory=inventory,
        quote_result=winner_quote,
        kalman=kalman, z_score=z_score, regime=regime, sizing=sizing,
    )

    # ── A-S display metadata ──────────────────────────────────────────────────
    now           = datetime.utcnow()
    oldest        = min(t.transacted_at for t in transactions)
    t_window_days = max((now - oldest).total_seconds() / 86400.0, 1.0)
    n_trades      = len(transactions)
    gamma         = as_quote["risk_aversion"]
    T             = as_quote["time_horizon"]
    kappa         = as_quote["liquidity"]
    risk_term     = gamma * (vol ** 2) * T
    liq_term      = (2.0 / gamma) * log(1.0 + gamma / kappa)

    return {
        "fair_value": round(fv, 2),
        "ev_model": _round_floats({
            **ev_quote,
            "fair_value":        fv,
            "volatility":        vol,
            "aggressiveness":    aggressiveness,
            "inventory_alpha":   EV_ALPHA,
            "inventory_penalty": ev_penalty,
            "bid_candidates":    [_round_floats(c) for c in ev_candidates["bid"]],
            "ask_candidates":    [_round_floats(c) for c in ev_candidates["ask"]],
        }),
        "as_model": _round_floats({
            **as_quote,
            "fair_value":    fv,
            "volatility":    vol,
            "liquidity_rate": liquidity,
            "n_trades":      n_trades,
            "t_window_days": round(t_window_days, 1),
            "risk_term":     risk_term,
            "liq_term":      liq_term,
        }),
        "decision": {
            **decision,
            "recommended_bid": round(decision["recommended_bid"], 2),
            "recommended_ask": round(decision["recommended_ask"], 2),
            "metrics":         _round_floats(decision["metrics"]),
            "source_model":    winner_name,
        },
    }


@router.get("/stats")
def get_stats(request: Request, db: Session = Depends(get_db)):
    _db_limiter.check(client_ip(request))
    item_count = db.query(func.count(Item.id)).scalar() or 0
    tx_count = db.query(func.count(Transaction.id)).scalar() or 0
    total_volume = db.query(func.sum(Transaction.price)).scalar() or 0.0

    since_24h = datetime.utcnow() - timedelta(hours=24)
    volume_24h = db.query(func.sum(Transaction.price)).filter(
        Transaction.transacted_at >= since_24h
    ).scalar() or 0.0
    tx_24h = db.query(func.count(Transaction.id)).filter(
        Transaction.transacted_at >= since_24h
    ).scalar() or 0

    return {
        "item_count": int(item_count),
        "transaction_count": int(tx_count),
        "total_volume": round(float(total_volume), 2),
        "volume_24h": round(float(volume_24h), 2),
        "transactions_24h": int(tx_24h),
    }


@router.get("/items/popular")
def get_popular_item(request: Request, db: Session = Depends(get_db)):
    _db_limiter.check(client_ip(request))
    eligible_ids = (
        db.query(Item.id)
        .join(Item.transactions)
        .group_by(Item.id)
        .having(func.count() >= MIN_TRANSACTIONS)
        .all()
    )
    if not eligible_ids:
        raise HTTPException(status_code=404, detail="No items with sufficient transaction data")

    chosen_id = random.choice([r[0] for r in eligible_ids])

    item = (
        db.query(Item)
        .options(joinedload(Item.transactions))
        .filter(Item.id == chosen_id)
        .one()
    )
    txns = sorted(item.transactions, key=lambda t: t.transacted_at)
    models = _run_models(item.transactions)

    return {
        "item": {
            "id": item.id,
            "sku": item.sku,
            "name": item.name,
            "brand": item.brand,
            "category": item.category,
            "size": item.size,
            "image_url": item.image_url,
        },
        "transactions": [
            {"price": t.price, "transacted_at": t.transacted_at.isoformat(), "source": t.source}
            for t in txns
        ],
        **models,
    }


@router.get("/items/trending")
def get_trending(request: Request, limit: int = Query(6, le=20), db: Session = Depends(get_db)):
    _db_limiter.check(client_ip(request))
    eligible = (
        db.query(Item.id, func.count(Transaction.id).label("tx_count"))
        .join(Transaction)
        .group_by(Item.id)
        .order_by(func.count(Transaction.id).desc())
        .limit(limit)
        .all()
    )
    if not eligible:
        return []

    item_ids = [row[0] for row in eligible]
    id_to_count = {row[0]: row[1] for row in eligible}

    items = (
        db.query(Item)
        .options(joinedload(Item.transactions))
        .filter(Item.id.in_(item_ids))
        .all()
    )

    results = []
    for item in items:
        sorted_txns = sorted(item.transactions, key=lambda t: t.transacted_at)
        if not sorted_txns:
            continue
        first_price = sorted_txns[0].price
        last_price = sorted_txns[-1].price
        delta_pct = round(((last_price - first_price) / first_price * 100), 1) if first_price else 0.0
        results.append({
            "sku": item.sku,
            "name": item.name,
            "brand": item.brand,
            "image_url": item.image_url,
            "tx_count": id_to_count[item.id],
            "last_price": round(last_price, 2),
            "delta_pct": delta_pct,
        })

    results.sort(key=lambda x: x["tx_count"], reverse=True)
    return results


@router.get("/items/recent-feed")
def get_recent_feed(request: Request, limit: int = Query(12, le=30), db: Session = Depends(get_db)):
    _db_limiter.check(client_ip(request))
    rows = (
        db.query(Transaction, Item.sku, Item.name)
        .join(Item, Transaction.item_id == Item.id)
        .order_by(Transaction.transacted_at.desc())
        .limit(limit)
        .all()
    )
    return [
        {
            "sku": sku,
            "name": name,
            "source": tx.source,
            "price": round(tx.price, 2),
            "transacted_at": tx.transacted_at.isoformat(),
        }
        for tx, sku, name in rows
    ]


@router.get("/items/{sku:path}/detail")
def get_item_detail(
    sku: str,
    request: Request,
    size: str = Query("all"),
    inventory: int = Query(0),
):
    # Per-IP and global rate limit
    _detail_limiter.check(client_ip(request))
    _detail_global.check("global")

    # Serve from cache if fresh (cache key includes size + inventory)
    size_norm = size.strip().lower()
    cache_key = f"{sku}:{size_norm}:{inventory}"
    cached = _detail_cache_get(cache_key)
    if cached is not None:
        return cached

    transactions = []
    item_meta = None

    # ── Look up local item first — provides expected name for KicksDB validation
    # and acts as the guaranteed fallback for metadata and transactions.
    local_db = SessionLocal()
    try:
        # When a specific size is requested, prefer the matching local item so
        # the fallback path doesn't use a different size's transaction history.
        local_item = None
        if size_norm != "all":
            local_item = (
                local_db.query(Item)
                .options(joinedload(Item.transactions))
                .filter(Item.sku == sku, Item.size.ilike(size_norm))
                .first()
            )
        if local_item is None:
            local_item = (
                local_db.query(Item)
                .options(joinedload(Item.transactions))
                .filter(Item.sku == sku)
                .first()
            )
    finally:
        local_db.close()

    expected_name = local_item.name if local_item else None

    # ── Try KicksDB for live transaction data ─────────────────────────────
    # Results are validated against expected_name so a fuzzy-matched wrong
    # product never pollutes the transaction history or metadata.
    if settings.kicks_db_api_key:
        from app.data.kicks_db import KicksDBClient
        from app.data.kicks_db import stockx as sx_pipe
        from app.data.kicks_db import goat as goat_pipe
        from app.data.kicks_db.normalizer import (
            stockx_sales_to_transactions,
            goat_sales_to_transactions,
        )

        client = KicksDBClient(settings.kicks_db_api_key)
        sx_image: str | None = None
        goat_image: str | None = None

        # StockX search — two cases:
        #
        # A) Item IS in the local DB (expected_name set): use validated_search
        #    so a fuzzy-matched wrong product can't pollute our data.
        #
        # B) Item is NOT in the local DB (expected_name is None): the SKU we
        #    received came from StockX's own search results, so a direct lookup
        #    by that SKU is reliable. Skip Jaccard validation here — it would
        #    always fail because numeric SKU tokens share nothing with product
        #    name tokens (e.g. "1904762" vs "stussy"). Extract the product name
        #    from the result so GOAT validation can still run normally.
        if expected_name is not None:
            sx_product = validated_search(
                lambda q: sx_pipe.search_product(client, q),
                sku,
                expected_name,
            )
        else:
            sx_product = sx_pipe.search_product(client, sku)
            if sx_product is not None:
                expected_name = sx_product.get("title") or sx_product.get("name")

        if sx_product is not None:
            pid = str(sx_product.get("id", sx_product.get("slug", "")))
            # Size filtering: fetch the variant for the requested size, then
            # pass its id to fetch_sales so only that size's records come back.
            sx_variant_id: str | None = None
            if size_norm != "all":
                full_product = sx_pipe.get_product_with_variants(client, pid)
                if full_product is not None:
                    sx_variant_id = sx_pipe.find_variant_id(full_product, size)
            sales = sx_pipe.fetch_sales(client, pid, 50, variant_id=sx_variant_id)
            if sales:
                transactions.extend(stockx_sales_to_transactions(sales, 0))
            if item_meta is None:
                item_meta = {
                    "sku":      sx_product.get("sku") or sku,
                    "name":     sx_product.get("title") or sx_product.get("name") or expected_name or sku,
                    "brand":    sx_product.get("brand", ""),
                    "category": sx_product.get("product_type") or sx_product.get("category", ""),
                    "image_url": None,   # filled below after image resolution
                }
            sx_image = sx_product.get("image") or sx_product.get("thumbnail") or sx_product.get("imageUrl")

        # GOAT — validated search using the name established above
        # (either from local DB or from the StockX result in case B)
        goat_product = validated_search(
            lambda q: goat_pipe.search_product(client, q),
            sku,
            expected_name or sku,
        )
        if goat_product is not None:
            pid = str(goat_product.get("id", ""))
            goat_size = size if size_norm != "all" else None
            sales = goat_pipe.fetch_sales(client, pid, 50, size_us=goat_size)
            if sales:
                transactions.extend(goat_sales_to_transactions(sales, 0))
            if item_meta is None:
                item_meta = {
                    "sku":      goat_product.get("sku") or sku,
                    "name":     goat_product.get("name") or goat_product.get("title") or expected_name or sku,
                    "brand":    goat_product.get("brand_name", ""),
                    "category": goat_product.get("product_type", ""),
                    "image_url": None,
                }
            # GOAT's image lives in 'image_url', not 'main_picture_url'
            goat_image = (
                goat_product.get("image_url")
                or goat_product.get("main_picture_url")
                or goat_product.get("image")
            )

        # Resolve image: prefer StockX if real, fall through to GOAT
        if item_meta is not None:
            item_meta["image_url"] = best_image(sx_image, goat_image)

    # ── Fall back to local DB if KicksDB returned no valid transactions ────
    # Covers: no API key, item not on StockX/GOAT, or validation rejected
    # every search result (wrong product returned for our internal SKU).
    if len(transactions) < MIN_TRANSACTIONS:
        if local_item and len(local_item.transactions) >= MIN_TRANSACTIONS:
            transactions = local_item.transactions
            if item_meta is None:
                item_meta = {
                    "sku":       local_item.sku,
                    "name":      local_item.name,
                    "brand":     local_item.brand,
                    "category":  local_item.category,
                    "image_url": local_item.image_url,
                }
        else:
            raise HTTPException(
                status_code=422,
                detail="Insufficient market data — this item has too few recent sales to generate a reliable quote.",
            )

    transactions.sort(key=lambda t: t.transacted_at)
    models = _run_models(transactions, inventory=inventory)

    result = {
        "item": item_meta,
        "transactions": [
            {"price": t.price, "transacted_at": t.transacted_at.isoformat(), "source": t.source}
            for t in transactions
        ],
        **models,
    }
    _detail_cache_set(cache_key, result)
    return result
