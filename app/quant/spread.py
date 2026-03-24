

# compute a volatility based spread
    #prevents spread from becoming unrealistically tiny with min_spread
def compute_base_spread(
    volatility: float,
    spread_multiplier: float = 2.0,
    min_spread: float = 2.0
) -> float:
    if volatility < 0:
        raise ValueError("Volatility cannot be negative")
    
    spread = spread_multiplier * volatility
    return max(min_spread, spread)