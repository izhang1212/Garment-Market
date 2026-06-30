from math import exp


def compute_fill_probability(
    quote_price: float,
    fair_value: float,
    volatility: float,
    aggressiveness: float = 1.0,
) -> float:
    if volatility <= 0:
        return 1.0 if quote_price == fair_value else 0.0

    distance = abs(quote_price - fair_value)
    return exp(-aggressiveness * distance / volatility)
