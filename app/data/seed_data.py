from datetime import datetime, timedelta

from app.db.session import SessionLocal
from app.models import Item, Transaction, Listing


def seed_database() -> None:
    db = SessionLocal()

    try:
        existing_item = db.query(Item).filter_by(sku="DD1391-100").first()
        if existing_item is not None:
            print("Seed data already exists.")
            return

        item = Item(
            sku="DD1391-100",
            name="Nike Dunk Low Panda",
            brand="Nike",
            category="Sneakers",
            size="10"
        )
        db.add(item)
        db.flush()  # gives item.id before commit

        now = datetime.now()

        transactions = [
            Transaction(
                item_id=item.id,
                price=238.0,
                quantity=1,
                source="stockx",
                transacted_at=now - timedelta(days=14)
            ),
            Transaction(
                item_id=item.id,
                price=242.0,
                quantity=1,
                source="goat",
                transacted_at=now - timedelta(days=10)
            ),
            Transaction(
                item_id=item.id,
                price=247.0,
                quantity=1,
                source="ebay",
                transacted_at=now - timedelta(days=7)
            ),
            Transaction(
                item_id=item.id,
                price=244.0,
                quantity=1,
                source="stockx",
                transacted_at=now - timedelta(days=5)
            ),
            Transaction(
                item_id=item.id,
                price=251.0,
                quantity=1,
                source="goat",
                transacted_at=now - timedelta(days=2)
            ),
        ]

        listings = [
            Listing(
                item_id=item.id,
                ask_price=259.0,
                source="stockx",
                collected_at=now
            ),
            Listing(
                item_id=item.id,
                ask_price=262.0,
                source="goat",
                collected_at=now
            ),
            Listing(
                item_id=item.id,
                ask_price=257.0,
                source="ebay",
                collected_at=now
            ),
        ]

        db.add_all(transactions)
        db.add_all(listings)
        db.commit()

        print("Seed data inserted successfully.")

    finally:
        db.close()