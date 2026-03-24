from math import log

# Avellaneda-Stoikov reservation price:
    # r = fv - inv * risk aversion * vol^2 * time horizen
def compute_as_reservation_price(
    fair_value: float,
    inventory: int,
    volatility: float,
    risk_aversion: float,
    time_horizon: float
) -> float:
    
    return fair_value - (inventory * risk_aversion * (volatility **2) * time_horizon)

def compute_as_optimal_spread(
    volatility: float,
    risk_aversion: float,
    liquidity: float,
    time_horizon: float,
    min_spread: float = 0.0
) -> float:
    
    if risk_aversion <= 0:
        raise ValueError("Risk Aversion must be positive")
    
    if liquidity <= 0:
        raise ValueError("Liquidity must be positive")
    
    spread = (
        risk_aversion * (volatility ** 2) * time_horizon +
        (2.0 / risk_aversion) * log(1.0 + risk_aversion / liquidity)
    )

    return max(spread, min_spread)

# returns: res_price, spread, bid, ask
def compute_as_quotes(
    fair_value: float,
    inventory: int,
    volatility: float,
    risk_aversion: float,
    liquidity: float,
    time_horizon: float,
    min_spread: float = 0.0
) -> tuple[float, float, float, float]:
    
    res_price = compute_as_reservation_price(
        fair_value=fair_value,
        inventory=inventory,
        volatility=volatility,
        risk_aversion=risk_aversion,
        time_horizon=time_horizon
    )

    spread = compute_as_optimal_spread(
        volatility=volatility,
        risk_aversion=risk_aversion,
        liquidity=liquidity,
        time_horizon=time_horizon,
        min_spread=min_spread
    )

    bid = res_price - (spread / 2.0)
    ask = res_price + (spread / 2.0)

    return res_price, spread, bid, ask
