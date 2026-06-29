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


def _local_search(q_norm: str, page: int) -> dict:
    """Search local DB. Only returns items that have transaction data."""
    from sqlalchemy import func, or_
    from app.db.session import SessionLocal
    from app.schemas import Item, Transaction

    db = SessionLocal()
    try:
        like = f"%{q_norm}%"
        rows = (
            db.query(Item, func.count(Transaction.id).label("tx_count"))
            .join(Transaction, Transaction.item_id == Item.id)
            .filter(or_(
                Item.name.ilike(like),
                Item.sku.ilike(like),
                Item.brand.ilike(like),
                Item.category.ilike(like),
            ))
            .group_by(Item.id)
            .order_by(func.count(Transaction.id).desc())
            .offset((page - 1) * PAGE_SIZE)
            .limit(PAGE_SIZE + 1)
            .all()
        )
        results = [
            {"sku": item.sku, "name": item.name, "brand": item.brand,
             "category": item.category, "image_url": item.image_url}
            for item, _ in rows[:PAGE_SIZE]
            if item.name and item.sku
        ]
        return {"results": results, "has_more": len(rows) > PAGE_SIZE}
    finally:
        db.close()


@router.get("/search")
def search_items(request: Request, q: str = Query(..., min_length=1), page: int = Query(1, ge=1)):
    _search_limiter.check(client_ip(request))
    q_norm = q.strip().lower()

    # ── No API key: search local DB only ─────────────────────────────────────
    if not settings.kicks_db_api_key:
        return _local_search(q_norm, page)

    # ── API key present: live KicksDB search ─────────────────────────────────
    cache_key = f"{q_norm}:{page}"
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
        return _local_search(q_norm, page)

    products = data.get("data", data) if isinstance(data, dict) else data
    if not isinstance(products, list):
        products = []

    # Sort the full pool by weekly_orders descending so the most-traded items
    # surface first. Items with no weekly_orders field fall to the bottom.
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
