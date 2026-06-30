from datetime import datetime
from app.schemas.transaction import Transaction

# Estimate Poisson arrival rate κ (trades per day) from transaction history.
    # κ = number of transactions / observation window in days
    # This is the MLE estimator for a Poisson process rate parameter.
def compute_as_liquidity(
    transactions: list[Transaction],
    now: datetime | None = None
) -> float:
    if not transactions:
        raise ValueError("Cannot compute liquidity without transactions")

    if now is None:
        now = datetime.now()

    oldest = min(t.transacted_at for t in transactions)
    window_days = (now - oldest).total_seconds() / 86400.0

    if window_days <= 0:
        raise ValueError("Observation window is zero — all transactions have the same timestamp")

    return len(transactions) / window_days
