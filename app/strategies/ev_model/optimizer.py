from math import sqrt

from .spread import compute_base_spread
from .inventory import compute_reservation_price, compute_quotes
from .fill_probability import compute_fill_probability
from .expected_value import compute_bid_expected_value, compute_ask_expected_value

_PHI = (sqrt(5) - 1) / 2  # golden ratio ≈ 0.618


def evaluate_quote_candidate(
    fair_value: float,
    volatility: float,
    inventory: int,
    spread_multiplier: float,
    min_spread: float = 2.0,
    inventory_penalty: float = 1.5,
    aggressiveness: float = 1.0,
) -> dict:
    spread = compute_base_spread(
        volatility=volatility,
        spread_multiplier=spread_multiplier,
        min_spread=min_spread,
    )
    reservation_price = compute_reservation_price(
        fair_value=fair_value,
        inventory=inventory,
        inventory_penalty=inventory_penalty,
    )
    bid, ask = compute_quotes(reservation_price, spread)

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
    bid_ev = compute_bid_expected_value(bid=bid, fair_value=fair_value, fill_probability=bid_fill_prob)
    ask_ev = compute_ask_expected_value(ask=ask, fair_value=fair_value, fill_probability=ask_fill_prob)

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
        "total_ev": bid_ev + ask_ev,
    }


def _golden_section_max(f, a: float, b: float, tol: float = 1e-7) -> float:
    """Find the maximizer of a unimodal f on [a, b] via golden-section search."""
    c = b - _PHI * (b - a)
    d = a + _PHI * (b - a)
    while abs(b - a) > tol:
        if f(c) < f(d):
            a = c
        else:
            b = d
        c = b - _PHI * (b - a)
        d = a + _PHI * (b - a)
    return (a + b) / 2


def find_best_quote(
    fair_value: float,
    volatility: float,
    inventory: int,
    spread_multipliers: list[float] | None = None,  # ignored — kept for API compatibility
    min_spread: float = 2.0,
    inventory_penalty: float = 1.5,
    aggressiveness: float = 1.0,
    m_lo: float = 0.1,
    m_hi: float = 6.0,
    showcase_delta: float = 0.25,
    n_showcase: int = 5,
) -> tuple[dict, list[dict]]:
    """Find the EV-optimal spread multiplier via golden-section search.

    Returns (best_quote, showcase_candidates).  showcase_candidates are
    n_showcase evenly-spaced points centred on the optimum so the sweep
    table in the UI can illustrate how EV changes around the peak.
    """
    # Ensure bid = FV - m*σ/2 stays above $1. With inventory skew the
    # reservation price may already be below FV, so use that as the floor.
    reservation_price = fair_value - inventory_penalty * inventory
    if volatility > 0:
        m_hi_bid_floor = (reservation_price - 1.0) * 2.0 / volatility
        m_hi = min(m_hi, max(m_lo, m_hi_bid_floor))

    def _ev(m: float) -> float:
        return evaluate_quote_candidate(
            fair_value=fair_value,
            volatility=volatility,
            inventory=inventory,
            spread_multiplier=m,
            min_spread=min_spread,
            inventory_penalty=inventory_penalty,
            aggressiveness=aggressiveness,
        )["total_ev"]

    m_star = _golden_section_max(_ev, m_lo, m_hi)

    best = evaluate_quote_candidate(
        fair_value=fair_value,
        volatility=volatility,
        inventory=inventory,
        spread_multiplier=m_star,
        min_spread=min_spread,
        inventory_penalty=inventory_penalty,
        aggressiveness=aggressiveness,
    )

    # Build showcase candidates: n_showcase points centred on m_star.
    # The middle slot is replaced with the exact m_star so the table
    # highlight (which matches on spread_multiplier) always finds a winner.
    half = n_showcase // 2
    mults = [
        max(m_lo, min(m_hi, m_star + (k - half) * showcase_delta))
        for k in range(n_showcase)
    ]
    mults[half] = m_star  # exact value for the winning row

    candidates = [
        evaluate_quote_candidate(
            fair_value=fair_value,
            volatility=volatility,
            inventory=inventory,
            spread_multiplier=m,
            min_spread=min_spread,
            inventory_penalty=inventory_penalty,
            aggressiveness=aggressiveness,
        )
        for m in mults
    ]

    return best, candidates
