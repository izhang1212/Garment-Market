from app.strategies import (
    compute_base_spread,
    compute_reservation_price,
    compute_quotes,
    compute_fill_probability,
    compute_bid_expected_value,
    compute_ask_expected_value,
)

# evaluate one quote candidate for a given spread multiplier
def evaluate_quote_candidate(
    fair_value: float,
    volatility: float,
    inventory: int,
    spread_multiplier: float,
    min_spread: float = 2.0,
    inventory_penalty: float = 1.5,
    aggressiveness: float = 1.0
) -> dict:
    
    spread = compute_base_spread(
        volatility=volatility,
        spread_multiplier=spread_multiplier,
        min_spread=min_spread
    )

    reservation_price = compute_reservation_price(
        fair_value=fair_value,
        inventory=inventory,
        inventory_penalty=inventory_penalty
    )

    bid,ask = compute_quotes(reservation_price, spread)

    bid_fill_prob = compute_fill_probability(
        quote_price=bid,
        fair_value=fair_value,
        volatility=volatility,
        aggressiveness=aggressiveness
    )

    ask_fill_prob = compute_fill_probability(
        quote_price=ask,
        fair_value=fair_value,
        volatility=volatility,
        aggressiveness=aggressiveness
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
        "spread_multiplier": spread_multiplier,
        "spread": spread,
        "reservation_price": reservation_price,
        "bid": bid,
        "ask": ask,
        "bid_fill_probability": bid_fill_prob,
        "ask_fill_probability": ask_fill_prob,
        "bid_ev": bid_ev,
        "ask_ev": ask_ev,
        "total_ev": total_ev
    }


# Evaluate multiple quote candidates and return:
    # the best candidate
    # the full list of evaluated candidates
def find_best_quote(
    fair_value: float,
    volatility: float,
    inventory: int,
    spread_multipliers: list[float],
    min_spread: float = 2.0,
    inventory_penalty: float = 1.5,
    aggressiveness: float = 1.0,
) -> tuple[dict, list[dict]]:
    
    candidates = []

    for multiplier in spread_multipliers:
        candidate = evaluate_quote_candidate(
            fair_value=fair_value,
            volatility=volatility,
            inventory=inventory,
            spread_multiplier=multiplier,
            min_spread=min_spread,
            inventory_penalty=inventory_penalty,
            aggressiveness=aggressiveness,
        )
        candidates.append(candidate)

    best_candidate = max(candidates, key=lambda candidate: candidate["total_ev"])
    return best_candidate, candidates