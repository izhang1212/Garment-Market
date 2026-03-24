
def compute_bid_expected_value(
    bid: float,
    fair_value: float,
    fill_probability: float
) -> float:
    return (fair_value - bid) * fill_probability

def compute_ask_expected_value(
    ask: float,
    fair_value: float,
    fill_probability: float
) -> float:
    return (ask - fair_value) * fill_probability