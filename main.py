from app.db.base import Base
from app.db.session import engine, SessionLocal
from app.models import Item, Transaction, Listing
from app.data.seed_data import seed_database
from app.quant import (
    compute_fair_value,
    compute_volatility,
    compute_base_spread,
    compute_reservation_price,
    compute_quotes,
)


def main() -> None:
    Base.metadata.create_all(bind=engine)
    seed_database()

    db = SessionLocal()

    try:
        item = db.query(Item).filter_by(sku="DD1391-100").first()

        if item is None:
            print("No item found.")
            return

        fair_value = compute_fair_value(item.transactions)
        volatility = compute_volatility(item.transactions)

        spread = compute_base_spread(volatility, spread_multiplier=2.0, min_spread=2.0)

        inventory = 2
        reservation_price = compute_reservation_price(
            fair_value,
            inventory,
            inventory_penalty=1.5
        )

        bid, ask = compute_quotes(reservation_price, spread)

        print(f"Item: {item.name}")
        print(f"Fair value: {fair_value:.2f}")
        print(f"Volatility: {volatility:.2f}")
        print(f"Base spread: {spread:.2f}")
        print(f"Inventory: {inventory}")
        print(f"Reservation price: {reservation_price:.2f}")
        print(f"Bid: {bid:.2f}")
        print(f"Ask: {ask:.2f}")

    finally:
        db.close()


if __name__ == "__main__":
    main()