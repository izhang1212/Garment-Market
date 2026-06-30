from datetime import datetime
from math import exp
from app.schemas.transaction import Transaction


def age_in_days(transacted_at: datetime, now: datetime) -> float:
    t = now - transacted_at
    return t.total_seconds() / 86400.0


def recency_weight(age_days: float, decay_lambda: float) -> float:
    return exp(-decay_lambda * age_days)


def compute_fair_value(
    transactions: list[Transaction],
    now: datetime | None = None,
    decay_lambda: float = 0.1,
) -> float:
    if not transactions:
        raise ValueError("Cannot compute FV with no transactions")

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
        raise ValueError("Total weight is 0, could not compute FV")

    return weighted_sum / total_weight
