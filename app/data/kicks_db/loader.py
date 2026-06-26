"""Orchestrates per-item data loading from KicksDB.

For each Item in the database:
  1. Search StockX by SKU (fallback to name), fetch variant for the item's size,
     pull up to STOCKX_LIMIT recent sales, extract current ask prices.
  2. Do the same for GOAT.
  3. Replace all existing transactions and listings for the item with the
     freshly fetched real data.

If neither market returns any sales, the item is left untouched (its
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

    # ── StockX ──────────────────────────────────────────────────────────────
    sx_product = sx_pipeline.search_product(client, item.sku)
    if sx_product is None and item.sku != item.name:
        sx_product = sx_pipeline.search_product(client, item.name)

    if sx_product is not None:
        product_id = str(sx_product.get("id", sx_product.get("slug", "")))
        # Re-fetch with variants so we can resolve the size-specific variant_id
        # and extract current ask prices.
        full_product = sx_pipeline.get_product_with_variants(client, product_id) or sx_product
        variant_id = sx_pipeline.find_variant_id(full_product, item.size)

        sales = sx_pipeline.fetch_sales(client, product_id, STOCKX_LIMIT, variant_id)
        if sales:
            new_transactions += stockx_sales_to_transactions(sales, item.id)

        listing_records = sx_pipeline.extract_listings(full_product)
        if listing_records:
            new_listings += listing_records_to_listings(listing_records, item.id, "stockx", now)

    # ── GOAT ────────────────────────────────────────────────────────────────
    goat_product = goat_pipeline.search_product(client, item.sku)
    if goat_product is None and item.sku != item.name:
        goat_product = goat_pipeline.search_product(client, item.name)

    if goat_product is not None:
        product_id = str(goat_product.get("id", ""))

        sales = goat_pipeline.fetch_sales(client, product_id, GOAT_LIMIT, item.size)
        if sales:
            new_transactions += goat_sales_to_transactions(sales, item.id)

        # Search results don't include variants; fetch the full product for listings.
        full_goat = goat_pipeline.get_product(client, product_id) or goat_product
        listing_records = goat_pipeline.extract_listings(full_goat, item.size)
        if listing_records:
            new_listings += listing_records_to_listings(listing_records, item.id, "goat", now)

    # ── Persist ─────────────────────────────────────────────────────────────
    if not new_transactions:
        return False

    # Clear all existing data for this item so we never mix fake seed data
    # with real API data.
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
