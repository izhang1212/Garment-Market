from .avellaneda_stoikov import compute_as_quotes
from ..shared.fill_probability import compute_fill_probability
from ..shared.expected_value import (
    compute_bid_expected_value,
    compute_ask_expected_value,
)

def evaluate_as_candidate(
    fair_value: float,
    volatility: float,
    inventory: int,
    risk_aversion: int,
    liquidity: float,
    time_horizon: float,
    aggressiveness: float = 1.0,
    min_spread: float = 0.0,
) -> dict:
    
    res_price, spread, bid, ask = compute_as_quotes(
        fair_value=fair_value,
        inventory=inventory,
        volatility=volatility,
        risk_aversion=risk_aversion,
        liquidity=liquidity,
        time_horizon=time_horizon,
        min_spread=min_spread
    )
    bid_fill_prob = compute_fill_probability(
        quote_price=bid,
        fair_value=fair_value,
        volatility=volatility,
        aggressiveness=aggressiveness,
    )

    ask_fill_prob = compute_fill_probability(
        quote_price=ask,
        fair_value=fair_value,
        volatility=volatility,
        aggressiveness=aggressiveness,
    )

    bid_ev = compute_bid_expected_value(
        bid=bid,
        fair_value=fair_value,
        fill_probability=bid_fill_prob,
    )

    ask_ev = compute_ask_expected_value(
        ask=ask,
        fair_value=fair_value,
        fill_probability=ask_fill_prob,
    )

    total_ev = bid_ev + ask_ev

    return {
        "risk_aversion": risk_aversion,
        "liquidity": liquidity,
        "time_horizon": time_horizon,
        "reservation_price": res_price,
        "spread": spread,
        "bid": bid,
        "ask": ask,
        "bid_fill_probability": bid_fill_prob,
        "ask_fill_probability": ask_fill_prob,
        "bid_ev": bid_ev,
        "ask_ev": ask_ev,
        "total_ev": total_ev,
    }


def find_best_as_quote(
    fair_value: float,
    volatility: float,
    inventory: int,
    risk_aversion_values: list[float],
    liquidity_values: list[float],
    time_horizon_values: list[float],
    aggressiveness: float = 1.0,
    min_spread: float = 0.0,
) -> tuple[dict, list[dict]]:

    candidates = []

    for risk_aversion in risk_aversion_values:
        for liquidity in liquidity_values:
            for time_horizon in time_horizon_values:
                candidate = evaluate_as_candidate(
                    fair_value=fair_value,
                    volatility=volatility,
                    inventory=inventory,
                    risk_aversion=risk_aversion,
                    liquidity=liquidity,
                    time_horizon=time_horizon,
                    aggressiveness=aggressiveness,
                    min_spread=min_spread,
                )
                candidates.append(candidate)

    best_candidate = max(candidates, key=lambda candidate: candidate["total_ev"])
    return best_candidate, candidates

