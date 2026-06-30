import time
from threading import Lock

from fastapi import APIRouter, Query, Request

from app.config import settings
from api.middleware.rate_limit import RateLimiter, client_ip

router = APIRouter()

PAGE_SIZE = 10
CACHE_TTL = 120  # seconds — repeat searches within 2 min are instant

# 20 searches/min per IP — cache makes most repeat queries free
_search_limiter = RateLimiter(calls=20, period=60)

_cache: dict[str, tuple[float, dict]] = {}
_cache_lock = Lock()


def _cache_get(key: str) -> dict | None:
    with _cache_lock:
        entry = _cache.get(key)
        if entry:
            if time.time() - entry[0] < CACHE_TTL:
                return entry[1]
            del _cache[key]
    return None


def _cache_set(key: str, data: dict) -> None:
    with _cache_lock:
        _cache[key] = (time.time(), data)


def _clean(s) -> str:
    return (s or "").strip()


def _local_search(
    q_norm: str,
    page: int,
    size: str = "all",
    category: str = "",
    brand: str = "",
    price_min: float = 0.0,
    price_max: float = 0.0,
) -> dict:
    """Search local DB. Only returns items that have transaction data."""
    from sqlalchemy import func, or_
    from app.db.session import SessionLocal
    from app.schemas import Item, Transaction

    db = SessionLocal()
    try:
        like = f"%{q_norm}%"
        query = (
            db.query(Item, func.count(Transaction.id).label("tx_count"))
            .join(Transaction, Transaction.item_id == Item.id)
            .filter(or_(
                Item.name.ilike(like),
                Item.sku.ilike(like),
                Item.brand.ilike(like),
                Item.category.ilike(like),
            ))
        )
        if size != "all":
            query = query.filter(Item.size.ilike(size))
        if category:
            cats = [c.strip() for c in category.split(",") if c.strip()]
            if cats:
                query = query.filter(or_(*[Item.category.ilike(f"%{c}%") for c in cats]))
        if brand:
            brnds = [b.strip() for b in brand.split(",") if b.strip()]
            if brnds:
                query = query.filter(or_(*[Item.brand.ilike(f"%{b}%") for b in brnds]))

        # Price filter: use most recent transaction price per item.
        # We filter after aggregation since SQLite doesn't support FILTER.
        rows = (
            query
            .group_by(Item.id)
            .order_by(func.count(Transaction.id).desc())
            .all()
        )

        results = []
        for item, _ in rows:
            if not item.name or not item.sku:
                continue
            if price_min > 0 or price_max > 0:
                latest = (
                    db.query(Transaction.price)
                    .filter(Transaction.item_id == item.id)
                    .order_by(Transaction.transacted_at.desc())
                    .first()
                )
                price = latest[0] if latest else None
                if price is None:
                    continue
                if price_min > 0 and price < price_min:
                    continue
                if price_max > 0 and price > price_max:
                    continue
            results.append({
                "sku": item.sku, "name": item.name,
                "brand": item.brand, "category": item.category,
                "size": item.size,
                "image_url": item.image_url,
            })

        page_results = results[(page - 1) * PAGE_SIZE : page * PAGE_SIZE]
        return {"results": page_results, "has_more": len(results) > page * PAGE_SIZE}
    finally:
        db.close()


@router.get("/search")
def search_items(
    request: Request,
    q: str = Query(..., min_length=1),
    page: int = Query(1, ge=1),
    size: str = Query("all"),
    category: str = Query(""),
    brand: str = Query(""),
    price_min: float = Query(0.0, ge=0),
    price_max: float = Query(0.0, ge=0),
):
    _search_limiter.check(client_ip(request))
    q_norm = q.strip().lower()
    size_norm = size.strip().lower()
    category_norm = category.strip().lower()
    brand_norm = brand.strip().lower()

    # ── No API key: search local DB only ─────────────────────────────────────
    if not settings.kicks_db_api_key:
        return _local_search(q_norm, page, size_norm, category_norm, brand_norm, price_min, price_max)

    # ── API key present: live KicksDB search ─────────────────────────────────
    cache_key = f"{q_norm}:{page}:{size_norm}:{category_norm}:{brand_norm}:{price_min}:{price_max}"
    cached = _cache_get(cache_key)
    if cached is not None:
        return cached

    from app.data.kicks_db import KicksDBClient

    # Fetch 2× PAGE_SIZE so we have a larger pool to rank by popularity.
    # KicksDB caps results at 20 per page regardless of per_page value.
    FETCH_SIZE = PAGE_SIZE * 2

    client = KicksDBClient(settings.kicks_db_api_key)
    try:
        data = client.get(
            "/stockx/products",
            params={"query": q_norm, "page": page, "per_page": FETCH_SIZE},
        )
    except Exception:
        # KicksDB unavailable — fall back to local DB so search still works
        return _local_search(q_norm, page, size_norm, category_norm, brand_norm, price_min, price_max)

    products = data.get("data", data) if isinstance(data, dict) else data
    if not isinstance(products, list):
        products = []

    # Apply category and brand filters on the fetched results.
    # Size filtering on live results isn't possible without variant lookups
    # (variants aren't returned by the search endpoint) — size filter applies
    # at the item-detail level when fetching transaction history.
    if category_norm:
        cats = [c.strip() for c in category_norm.split(",") if c.strip()]
        if cats:
            products = [
                p for p in products
                if any(c in (_clean(p.get("product_type") or p.get("category", ""))).lower() for c in cats)
            ]
    if brand_norm:
        brnds = [b.strip() for b in brand_norm.split(",") if b.strip()]
        if brnds:
            products = [
                p for p in products
                if any(b in _clean(p.get("brand", "")).lower() for b in brnds)
            ]
    if price_min > 0 or price_max > 0:
        def _in_range(p):
            avg = p.get("avg_price") or p.get("min_price") or 0
            if not avg:
                return True  # no price info — don't exclude
            if price_min > 0 and avg < price_min:
                return False
            if price_max > 0 and avg > price_max:
                return False
            return True
        products = [p for p in products if _in_range(p)]

    # Sort the remaining pool by weekly_orders descending.
    products.sort(key=lambda p: p.get("weekly_orders") or 0, reverse=True)

    results = []
    for p in products[:PAGE_SIZE]:
        # Supreme and many streetwear brands have sku="" on StockX.
        # Fall back to slug, which is always unique and searchable.
        sku  = _clean(p.get("sku")) or _clean(p.get("slug"))
        name = _clean(p.get("title") or p.get("name"))
        if not sku or not name:
            continue
        results.append({
            "sku":       sku,
            "name":      name,
            "brand":     _clean(p.get("brand")),
            "category":  _clean(p.get("product_type") or p.get("category")),
            "image_url": p.get("image"),
        })

    # has_more: KicksDB returned a full FETCH_SIZE page, so there's likely a next page
    response = {"results": results, "has_more": len(products) >= FETCH_SIZE}
    _cache_set(cache_key, response)
    return response
