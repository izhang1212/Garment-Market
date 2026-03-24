from datetime import datetime
from math import sqrt
from app.models.transaction import Transaction
from fair_value import age_in_days, recency_weight

# computes the volatility (i.e. how much transaction fluctuates) around the FV
    # Also uses recency weighting, so recent price instabilty matters more than old
    # if volatiltiy is high, we are less confident / more uncertain
def compute_volatility(
    transactions: list[Transaction],
    now: datetime | None = None,
    decay_lambda: float = 0.1
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

        squared_diff = (t.price - mean_price) **2
        weighted_sq_diff_sum += weight * squared_diff

    varience = weighted_sq_diff_sum / total_weight
    return sqrt(varience)