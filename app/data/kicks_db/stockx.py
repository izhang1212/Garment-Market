"""StockX pipeline via KicksDB Standard API.

Endpoints used:
  GET /v3/stockx/products?query={sku_or_name}          — product search
  GET /v3/stockx/products/{id}?display[variants]=true  — product + variants (ask prices per size)
  GET /v3/stockx/products/{id}/sales?variant_id={id}&page={n}&per_page=20  — sale history
"""

from .client import KicksDBClient

_PER_PAGE = 20


def search_product(client: KicksDBClient, query: str) -> dict | None:
    """Return the best-matching StockX product for a SKU or name query, or None."""
    try:
        data = client.get("/stockx/products", params={"query": query})
    except Exception as exc:
        print(f"    [StockX] search failed for '{query}': {exc}")
        return None

    products = data.get("data", data) if isinstance(data, dict) else data
    if not products:
        return None

    # Prefer exact SKU match; otherwise take the first (most relevant) result.
    for product in products:
        if product.get("sku", "").upper() == query.upper():
            return product
    return products[0]


def get_product_with_variants(client: KicksDBClient, product_id: str) -> dict | None:
    """Fetch a single StockX product including its per-size variant data."""
    try:
        data = client.get(
            f"/stockx/products/{product_id}",
            params={"display[variants]": "true"},
        )
    except Exception as exc:
        print(f"    [StockX] variant fetch failed for id={product_id}: {exc}")
        return None

    return data.get("data", data) if isinstance(data, dict) else data


def find_variant_id(product: dict, size: str) -> str | None:
    """Return the variant id matching the given US size string, or None."""
    variants = product.get("variants", [])
    size_norm = size.strip().lower()
    for variant in variants:
        for field in ("size", "us_size", "display_size", "sizeUS"):
            val = str(variant.get(field, "")).strip().lower()
            if val == size_norm:
                return str(variant["id"])
    return None


def fetch_sales(
    client: KicksDBClient,
    product_id: str,
    limit: int,
    variant_id: str | None = None,
    max_pages: int = 10,
) -> list[dict]:
    """Fetch up to `limit` raw sale records for a StockX product.

    Variant_id filters by size server-side, so raw records are already
    size-specific. The IQR outlier filter runs later in the normalizer
    and needs the full batch to compute quartiles, so we can't apply it
    here mid-loop. We fetch up to max_pages pages and return all raw
    records; the normalizer trims to the cleanest `limit` values.
    """
    results: list[dict] = []
    page = 1

    while page <= max_pages:
        params: dict = {"page": page, "per_page": _PER_PAGE}
        if variant_id:
            params["variant_id"] = variant_id

        try:
            data = client.get(f"/stockx/products/{product_id}/sales", params=params)
        except Exception as exc:
            print(f"    [StockX] sales fetch failed (page {page}): {exc}")
            break

        records = data.get("data", data) if isinstance(data, dict) else data
        if not records:
            break

        results.extend(records)

        if len(records) < _PER_PAGE:
            break  # reached the last page
        if len(results) >= limit:
            break  # have enough raw records for a stable IQR computation
        page += 1

    return results


def extract_listings(product: dict) -> list[dict]:
    """Pull per-size ask prices from a product with variants already fetched."""
    listings = []
    for variant in product.get("variants", []):
        ask = variant.get("lowest_ask") or variant.get("lowestAsk")
        if ask is None:
            continue
        size = (
            variant.get("size")
            or variant.get("us_size")
            or variant.get("display_size")
            or variant.get("sizeUS")
        )
        listings.append({"size": size, "ask_price": float(ask)})
    return listings
