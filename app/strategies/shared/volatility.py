from datetime import datetime
from math import sqrt
from app.schemas.transaction import Transaction
from .fair_value import age_in_days, recency_weight


def compute_volatility(
    transactions: list[Transaction],
    now: datetime | None = None,
    decay_lambda: float = 0.1,
) -> float:
    if not transactions:
        raise ValueError("Cannot compute volatility without transactions")

    if now is None:
        now = datetime.now()

    weighted_sum = 0.0
    total_weight = 0.0

    for t in transactions:
        age_days = age_in_days(t.transacted_at, now)
        weight = recency_weight(age_days, decay_lambda)
        weighted_sum += weight * t.price
        total_weight += weight

    if total_weight == 0:
        raise ValueError("Total weight is 0, could not compute volatility")

    mean_price = weighted_sum / total_weight
    weighted_sq_diff_sum = 0.0

    for t in transactions:
        age_days = age_in_days(t.transacted_at, now)
        weight = recency_weight(age_days, decay_lambda)
        weighted_sq_diff_sum += weight * (t.price - mean_price) ** 2

    return sqrt(weighted_sq_diff_sum / total_weight)
