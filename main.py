from app.db.base import Base
from app.db.session import engine, SessionLocal
from app.models import Item
from app.data.seed_data import seed_database
from app.quant import (
    compute_fair_value,
    compute_volatility,
    compute_fill_probability,
    compute_bid_expected_value,
    compute_ask_expected_value,
    compute_as_quotes,
)
from app.engine.quote_engine import find_best_quote


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

        inventory = 2

        # Part 9 heuristic optimizer
        best_quote, all_candidates = find_best_quote(
            fair_value=fair_value,
            volatility=volatility,
            inventory=inventory,
            spread_multipliers=[1.0, 1.5, 2.0, 2.5, 3.0],
            min_spread=2.0,
            inventory_penalty=1.5,
            aggressiveness=1.0,
        )

        # Part 10 A-S model
        risk_aversion = 0.01
        liquidity = 1.0
        time_horizon = 1.0

        as_reservation_price, as_spread, as_bid, as_ask = compute_as_quotes(
            fair_value=fair_value,
            inventory=inventory,
            volatility=volatility,
            risk_aversion=risk_aversion,
            liquidity=liquidity,
            time_horizon=time_horizon,
            min_spread=2.0,
        )

        as_bid_fill = compute_fill_probability(
            quote_price=as_bid,
            fair_value=fair_value,
            volatility=volatility,
            aggressiveness=1.0,
        )

        as_ask_fill = compute_fill_probability(
            quote_price=as_ask,
            fair_value=fair_value,
            volatility=volatility,
            aggressiveness=1.0,
        )

        as_bid_ev = compute_bid_expected_value(
            bid=as_bid,
            fair_value=fair_value,
            fill_probability=as_bid_fill,
        )

        as_ask_ev = compute_ask_expected_value(
            ask=as_ask,
            fair_value=fair_value,
            fill_probability=as_ask_fill,
        )

        as_total_ev = as_bid_ev + as_ask_ev

        print("=" * 60)
        print("PART 10: HEURISTIC VS AVELLANEDA-STOIKOV")
        print("=" * 60)
        print(f"Item: {item.name}")
        print(f"SKU: {item.sku}")
        print(f"Fair value: {fair_value:.2f}")
        print(f"Volatility: {volatility:.2f}")
        print(f"Inventory: {inventory}")
        print()

        print("HEURISTIC BEST QUOTE")
        print("-" * 60)
        print(f"Spread multiplier: {best_quote['spread_multiplier']:.2f}")
        print(f"Spread: {best_quote['spread']:.2f}")
        print(f"Reservation price: {best_quote['reservation_price']:.2f}")
        print(f"Bid: {best_quote['bid']:.2f}")
        print(f"Ask: {best_quote['ask']:.2f}")
        print(f"Bid fill probability: {best_quote['bid_fill_probability']:.4f}")
        print(f"Ask fill probability: {best_quote['ask_fill_probability']:.4f}")
        print(f"Bid EV: {best_quote['bid_ev']:.4f}")
        print(f"Ask EV: {best_quote['ask_ev']:.4f}")
        print(f"Total EV: {best_quote['total_ev']:.4f}")
        print()

        print("AVELLANEDA-STOIKOV QUOTE")
        print("-" * 60)
        print(f"Risk aversion: {risk_aversion:.4f}")
        print(f"Liquidity: {liquidity:.4f}")
        print(f"Time horizon: {time_horizon:.4f}")
        print(f"Reservation price: {as_reservation_price:.2f}")
        print(f"Spread: {as_spread:.2f}")
        print(f"Bid: {as_bid:.2f}")
        print(f"Ask: {as_ask:.2f}")
        print(f"Bid fill probability: {as_bid_fill:.4f}")
        print(f"Ask fill probability: {as_ask_fill:.4f}")
        print(f"Bid EV: {as_bid_ev:.4f}")
        print(f"Ask EV: {as_ask_ev:.4f}")
        print(f"Total EV: {as_total_ev:.4f}")

    finally:
        db.close()


if __name__ == "__main__":
    main()