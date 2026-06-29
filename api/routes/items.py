import random
import time
from datetime import datetime, timedelta
from math import log
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
from app.decision import trading_decision
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


def _run_models(transactions):
    fv = compute_fair_value(transactions)
    vol = compute_volatility(transactions)
    liquidity = compute_as_liquidity(transactions)

    ev_quote, ev_candidates = find_best_quote(
        fair_value=fv,
        volatility=vol,
        inventory=0,
        spread_multipliers=[0.5, 1.0, 1.5, 2.0, 2.5, 3.0],
    )
    as_quote, _ = find_best_as_quote(
        fair_value=fv,
        volatility=vol,
        inventory=0,
        risk_aversion_values=[0.001, 0.005, 0.01, 0.02, 0.05],
        liquidity_values=[liquidity],
        time_horizon_values=[0.5, 1.0, 2.0],
        min_spread=0.0,
    )
    # Pick model with higher total EV; use it to drive the decision
    if ev_quote["total_ev"] >= as_quote["total_ev"]:
        winner_quote, winner_name = ev_quote, "ev_model"
    else:
        winner_quote, winner_name = as_quote, "avellaneda_stoikov"

    decision = trading_decision(
        fair_value=fv, volatility=vol, inventory=0,
        quote_result=winner_quote,
        min_fill_prob=0.05,   # realistic threshold for resale market
    )

    now = datetime.utcnow()
    oldest = min(t.transacted_at for t in transactions)
    t_window_days = max((now - oldest).total_seconds() / 86400.0, 1.0)
    n_trades = len(transactions)

    gamma = as_quote["risk_aversion"]
    T = as_quote["time_horizon"]
    kappa = as_quote["liquidity"]
    risk_term = gamma * (vol ** 2) * T
    liq_term = (2.0 / gamma) * log(1.0 + gamma / kappa)

    return {
        "fair_value": round(fv, 2),
        "ev_model": _round_floats({
            **ev_quote,
            "fair_value": fv,
            "volatility": vol,
            "candidates": [_round_floats(c) for c in ev_candidates],
        }),
        "as_model": _round_floats({
            **as_quote,
            "fair_value": fv,
            "volatility": vol,
            "liquidity_rate": liquidity,
            "n_trades": n_trades,
            "t_window_days": round(t_window_days, 1),
            "risk_term": risk_term,
            "liq_term": liq_term,
        }),
        "decision": {
            **decision,
            "recommended_bid": round(decision["recommended_bid"], 2),
            "recommended_ask": round(decision["recommended_ask"], 2),
            "metrics": _round_floats(decision["metrics"]),
            "source_model": winner_name,
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
def get_item_detail(sku: str, request: Request):
    if not settings.kicks_db_api_key:
        raise HTTPException(status_code=503, detail="KicksDB API key not configured")

    # Per-IP rate limit first, then global budget check
    _detail_limiter.check(client_ip(request))
    _detail_global.check("global")

    # Serve from cache if fresh (avoids burning 2 KicksDB calls per repeat visit)
    cached = _detail_cache_get(sku)
    if cached is not None:
        return cached

    from app.data.kicks_db import KicksDBClient
    from app.data.kicks_db import stockx as sx_pipe
    from app.data.kicks_db import goat as goat_pipe
    from app.data.kicks_db.normalizer import (
        stockx_sales_to_transactions,
        goat_sales_to_transactions,
    )

    client = KicksDBClient(settings.kicks_db_api_key)
    transactions = []
    item_meta = None

    sx_product = sx_pipe.search_product(client, sku)
    if sx_product is not None:
        pid = str(sx_product.get("id", sx_product.get("slug", "")))
        sales = sx_pipe.fetch_sales(client, pid, 50)
        if sales:
            transactions.extend(stockx_sales_to_transactions(sales, 0))
        if item_meta is None:
            item_meta = {
                "sku": sx_product.get("sku", sku),
                "name": sx_product.get("title") or sx_product.get("name", sku),
                "brand": sx_product.get("brand", ""),
                "category": sx_product.get("product_type") or sx_product.get("category", ""),
                "image_url": sx_product.get("image"),
            }

    goat_product = goat_pipe.search_product(client, sku)
    if goat_product is not None:
        pid = str(goat_product.get("id", ""))
        sales = goat_pipe.fetch_sales(client, pid, 50)
        if sales:
            transactions.extend(goat_sales_to_transactions(sales, 0))
        if item_meta is None:
            item_meta = {
                "sku": goat_product.get("sku", sku),
                "name": goat_product.get("name") or goat_product.get("title", sku),
                "brand": goat_product.get("brand_name", ""),
                "category": goat_product.get("product_type", ""),
                "image_url": (
                    goat_product.get("main_picture_url")
                    or goat_product.get("image")
                    or goat_product.get("cover_picture")
                ),
            }

    if len(transactions) < MIN_TRANSACTIONS:
        raise HTTPException(
            status_code=422,
            detail=f"Insufficient data: {len(transactions)} transactions found, need {MIN_TRANSACTIONS}",
        )

    transactions.sort(key=lambda t: t.transacted_at)
    models = _run_models(transactions)

    result = {
        "item": item_meta,
        "transactions": [
            {"price": t.price, "transacted_at": t.transacted_at.isoformat(), "source": t.source}
            for t in transactions
        ],
        **models,
    }
    _detail_cache_set(sku, result)
    return result
