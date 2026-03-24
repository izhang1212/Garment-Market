from app.db.base import Base
from app.db.session import engine, SessionLocal
from app.models import Item
from app.data.seed_data import seed_database
from app.quant import compute_fair_value, compute_volatility
from app.engine.quote_engine import find_best_quote


def main() -> None:
    # Create DB tables
    Base.metadata.create_all(bind=engine)

    # Seed sample data if it is not already there
    seed_database()

    db = SessionLocal()

    try:
        item = db.query(Item).filter_by(sku="DD1391-100").first()

        if item is None:
            print("No item found.")
            return

        fair_value = compute_fair_value(item.transactions)
        volatility = compute_volatility(item.transactions)

        inventory = 2
        spread_multipliers = [1.0, 1.5, 2.0, 2.5, 3.0]

        best_quote, all_candidates = find_best_quote(
            fair_value=fair_value,
            volatility=volatility,
            inventory=inventory,
            spread_multipliers=spread_multipliers,
            min_spread=2.0,
            inventory_penalty=1.5,
            aggressiveness=1.0,
        )

        print("=" * 60)
        print("MARKET MAKER TEST RUN")
        print("=" * 60)
        print(f"Item: {item.name}")
        print(f"SKU: {item.sku}")
        print(f"Transactions used: {len(item.transactions)}")
        print(f"Listings observed: {len(item.listings)}")
        print(f"Fair value: {fair_value:.2f}")
        print(f"Volatility: {volatility:.2f}")
        print(f"Inventory: {inventory}")
        print()

        print("CANDIDATE QUOTES")
        print("-" * 60)
        for candidate in all_candidates:
            print(
                f"mult={candidate['spread_multiplier']:.1f} | "
                f"spread={candidate['spread']:.2f} | "
                f"bid={candidate['bid']:.2f} | "
                f"ask={candidate['ask']:.2f} | "
                f"bid_fill={candidate['bid_fill_probability']:.4f} | "
                f"ask_fill={candidate['ask_fill_probability']:.4f} | "
                f"bid_ev={candidate['bid_ev']:.4f} | "
                f"ask_ev={candidate['ask_ev']:.4f} | "
                f"total_ev={candidate['total_ev']:.4f}"
            )

        print()
        print("BEST QUOTE")
        print("-" * 60)
        print(f"Spread multiplier: {best_quote['spread_multiplier']:.1f}")
        print(f"Spread: {best_quote['spread']:.2f}")
        print(f"Reservation price: {best_quote['reservation_price']:.2f}")
        print(f"Bid: {best_quote['bid']:.2f}")
        print(f"Ask: {best_quote['ask']:.2f}")
        print(f"Bid fill probability: {best_quote['bid_fill_probability']:.4f}")
        print(f"Ask fill probability: {best_quote['ask_fill_probability']:.4f}")
        print(f"Bid EV: {best_quote['bid_ev']:.4f}")
        print(f"Ask EV: {best_quote['ask_ev']:.4f}")
        print(f"Total EV: {best_quote['total_ev']:.4f}")

    finally:
        db.close()


if __name__ == "__main__":
    main()