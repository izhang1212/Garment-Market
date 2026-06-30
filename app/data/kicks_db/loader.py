"""Orchestrates per-item data loading from KicksDB.

For each Item in the database:
  1. Search StockX by SKU (validated against item name; fallback to name search),
     fetch variant for the item's size, pull up to STOCKX_LIMIT recent sales,
     extract current ask prices.
  2. Do the same for GOAT.
  3. Replace all existing transactions and listings for the item with the
     freshly fetched real data.

If neither market returns a validated match, the item is left untouched (its
existing transactions, if any, remain in the database).
"""

from datetime import datetime

from sqlalchemy.orm import Session

from app.schemas.item import Item
from app.schemas.listing import Listing
from app.schemas.transaction import Transaction

from .client import KicksDBClient
from . import stockx as sx_pipeline
from . import goat as goat_pipeline
from .match import validated_search, best_image, is_placeholder
from .normalizer import (
    goat_sales_to_transactions,
    listing_records_to_listings,
    stockx_sales_to_transactions,
)

STOCKX_LIMIT = 50
GOAT_LIMIT = 50


def load_item(db: Session, item: Item, client: KicksDBClient) -> bool:
    """Fetch real market data for one item and persist to DB.

    Returns True if at least one market yielded transaction data.
    Does NOT commit — callers are responsible for committing the session.
    """
    now = datetime.utcnow()
    new_transactions: list[Transaction] = []
    new_listings: list[Listing] = []

    sx_image: str | None = None
    goat_image: str | None = None

    # ── StockX ──────────────────────────────────────────────────────────────
    sx_product = validated_search(
        lambda q: sx_pipeline.search_product(client, q),
        item.sku,
        item.name,
    )

    if sx_product is not None:
        product_id = str(sx_product.get("id", sx_product.get("slug", "")))
        full_product = sx_pipeline.get_product_with_variants(client, product_id) or sx_product
        variant_id = sx_pipeline.find_variant_id(full_product, item.size)

        sales = sx_pipeline.fetch_sales(client, product_id, STOCKX_LIMIT, variant_id)
        if sales:
            new_transactions += stockx_sales_to_transactions(sales, item.id)

        listing_records = sx_pipeline.extract_listings(full_product)
        if listing_records:
            new_listings += listing_records_to_listings(listing_records, item.id, "stockx", now)

        sx_image = sx_product.get("image") or sx_product.get("thumbnail") or sx_product.get("imageUrl")

    # ── GOAT ────────────────────────────────────────────────────────────────
    goat_product = validated_search(
        lambda q: goat_pipeline.search_product(client, q),
        item.sku,
        item.name,
    )

    if goat_product is not None:
        product_id = str(goat_product.get("id", ""))

        sales = goat_pipeline.fetch_sales(client, product_id, GOAT_LIMIT, item.size)
        if sales:
            new_transactions += goat_sales_to_transactions(sales, item.id)

        full_goat = goat_pipeline.get_product(client, product_id) or goat_product
        listing_records = goat_pipeline.extract_listings(full_goat, item.size)
        if listing_records:
            new_listings += listing_records_to_listings(listing_records, item.id, "goat", now)

        # GOAT's image is in 'image_url', not 'main_picture_url'
        goat_image = (
            goat_product.get("image_url")
            or goat_product.get("main_picture_url")
            or goat_product.get("image")
        )

    # ── Image: prefer StockX if real, fall through to GOAT ─────────────────
    resolved_image = best_image(sx_image, goat_image)
    if resolved_image and (not item.image_url or is_placeholder(item.image_url)):
        item.image_url = resolved_image

    # ── Persist ─────────────────────────────────────────────────────────────
    if not new_transactions:
        return False

    db.query(Transaction).filter(Transaction.item_id == item.id).delete()
    db.query(Listing).filter(Listing.item_id == item.id).delete()

    db.add_all(new_transactions)
    db.add_all(new_listings)
    db.flush()
    return True


def load_all_items(client: KicksDBClient) -> None:
    """Load real KicksDB data for every Item in the database."""
    from app.db.session import SessionLocal

    db = SessionLocal()
    try:
        items = db.query(Item).all()
        found = 0
        for item in items:
            print(f"  Loading '{item.name}' ({item.sku}, size {item.size})...")
            populated = load_item(db, item, client)
            if populated:
                found += 1
                print(f"    ✓ data loaded")
            else:
                print(f"    – not found on KicksDB, keeping existing data")
        db.commit()
        print(f"\nKicksDB: loaded real data for {found}/{len(items)} items.")
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()
