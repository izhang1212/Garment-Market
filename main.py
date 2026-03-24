from app.db.base import Base
from app.db.session import engine, SessionLocal
from app.data.seed_data import seed_database
from app.models.item import Item

from app.strategies import (
    compute_fair_value,
    compute_volatility,
    find_best_as_quote,
)
from app.decision import trading_decision
from app.reporting import print_report

def main() -> None:
    Base.metadata.create_all(bind=engine)
    seed_database()
    db = SessionLocal()

    try:
        item = db.query(Item).filter(Item.sku == "DD1391-100").first()

        if item is None:
            print("Item not found.")
            return

        fair_value = compute_fair_value(item.transactions)
        volatility = compute_volatility(item.transactions)
        inventory = 2

        quote_result, _ = find_best_as_quote(
            fair_value=fair_value,
            volatility=volatility,
            inventory=inventory,
            risk_aversion_values=[0.001, 0.005, 0.01, 0.02, 0.05],
            liquidity_values=[0.25, 0.5, 1.0, 2.0, 4.0],
            time_horizon_values=[0.5, 1.0, 2.0],
            aggressiveness=1.0,
            min_spread=0.0,
        )

        decision = trading_decision(
            fair_value=fair_value,
            volatility=volatility,
            inventory=inventory,
            quote_result=quote_result,
        )

        print_report(
            item=item,
            fair_value=fair_value,
            volatility=volatility,
            inventory=inventory,
            model_name="Avellaneda-Stoikov",
            quote_result=quote_result,
            decision=decision,
        )

    finally:
        db.close()


if __name__ == "__main__":
    main()