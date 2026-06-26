"""GOAT pipeline via KicksDB Standard API.

Endpoints used:
  GET /v3/goat/products?query={sku_or_name}   — product search
  GET /v3/goat/products/{id}                  — product + variants (ask prices per size)
  GET /v3/goat/products/{id}/sales?page={n}&per_page=20  — sale history

GOAT sale record fields (from KicksDB docs):
  product_id, type, size_us, currency, amount, location, purchased_at
  type: PURCHASE_TYPE_SALE | PURCHASE_TYPE_OFFER_CLOSED
"""

from .client import KicksDBClient

_PER_PAGE = 20


def search_product(client: KicksDBClient, query: str) -> dict | None:
    """Return the best-matching GOAT product for a SKU or name query, or None."""
    try:
        data = client.get("/goat/products", params={"query": query})
    except Exception as exc:
        print(f"    [GOAT] search failed for '{query}': {exc}")
        return None

    products = data.get("data", data) if isinstance(data, dict) else data
    if not products:
        return None

    for product in products:
        if product.get("sku", "").upper() == query.upper():
            return product
    return products[0]


_GOAT_BUY_NOW = "PURCHASE_TYPE_SALE"


def fetch_sales(
    client: KicksDBClient,
    product_id: str | int,
    limit: int,
    size_us: str | None = None,
    max_pages: int = 10,
) -> list[dict]:
    """Paginate GOAT sales until `limit` buy-now records for the target size
    are collected, or until the source is exhausted (max_pages cap).

    Unlike StockX, both filters (size and buy-now type) are per-record and
    known immediately, so we can count clean records mid-loop and stop as
    soon as we have enough. No minimum is enforced — if the item is illiquid
    we use whatever the API has, and the model's spread widens naturally.
    """
    results: list[dict] = []
    page = 1
    size_norm = size_us.strip() if size_us else None

    while len(results) < limit and page <= max_pages:
        params: dict = {"page": page, "per_page": _PER_PAGE}

        try:
            data = client.get(f"/goat/products/{product_id}/sales", params=params)
        except Exception as exc:
            print(f"    [GOAT] sales fetch failed (page {page}): {exc}")
            break

        raw_page = data.get("data", data) if isinstance(data, dict) else data
        if not raw_page:
            break

        for record in raw_page:
            if record.get("type") != _GOAT_BUY_NOW:
                continue
            if size_norm and str(record.get("size_us", "")).strip() != size_norm:
                continue
            results.append(record)

        if len(raw_page) < _PER_PAGE:
            break  # last page
        page += 1

    return results


def get_product(client: KicksDBClient, product_id: str | int) -> dict | None:
    """Fetch a full GOAT product including its variants array."""
    try:
        data = client.get(f"/goat/products/{product_id}")
    except Exception as exc:
        print(f"    [GOAT] product fetch failed for id={product_id}: {exc}")
        return None
    return data.get("data", data) if isinstance(data, dict) else data


def extract_listings(product: dict, size_us: str | None = None) -> list[dict]:
    """Pull per-size ask prices from the product's variants array."""
    listings = []
    for variant in (product.get("variants") or []):
        size = str(variant.get("size_us") or variant.get("size") or "").strip()
        if size_us and size != size_us.strip():
            continue
        ask = (
            variant.get("lowest_price")
            or variant.get("lowestPrice")
            or variant.get("lowest_asking_price")
        )
        if ask is None:
            continue
        listings.append({"size": size, "ask_price": float(ask)})
    return listings
