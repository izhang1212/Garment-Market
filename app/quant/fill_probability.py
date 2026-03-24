from math import exp

#Estimate fill probability using normalized distance from fair value.
    # Larger volatility means the market can tolerate wider quotes, so
    # the same raw distance should hurt fill probability less.
    #P(fill) = exp(-aggressiveness * |quote - fair_value| / volatility)

# given the bid/ask I chose, how likely is each one to actaully get executed?
def compute_fill_probability(
    quote_price: float,
    fair_value: float,
    volatility: float,
    agressiveness: float = 1.0
) -> float:
    
    if volatility <= 0:
        if quote_price == fair_value:
            return 1.0
        return 0.0
    
    distance = abs(quote_price - fair_value)
    return exp(-agressiveness * distance / volatility)