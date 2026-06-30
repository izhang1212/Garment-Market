from math import sqrt

from ..shared.fill_probability import compute_fill_probability
from .ev_model import compute_reservation_price
from ..shared.expected_value import compute_bid_expected_value, compute_ask_expected_value

_PHI = (sqrt(5) - 1) / 2  # golden ratio ≈ 0.618


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


def _eval_bid(m: float, r: float, fv: float, vol: float, agg: float, min_half: float):
    half = max(min_half, m * vol / 2.0)
    bid = max(1.0, r - half)
    p = compute_fill_probability(bid, fv, vol, agg)
    ev = compute_bid_expected_value(bid, fv, p)
    return bid, p, ev


def _eval_ask(m: float, r: float, fv: float, vol: float, agg: float):
    half = m * vol / 2.0
    ask = r + half
    p = compute_fill_probability(ask, fv, vol, agg)
    ev = compute_ask_expected_value(ask, fv, p)
    return ask, p, ev


def find_best_quote(
    fair_value: float,
    volatility: float,
    inventory: int,
    spread_multipliers=None,   # unused — kept for API compatibility
    min_spread: float = 2.0,
    inventory_penalty: float = 1.5,
    aggressiveness: float = 1.0,
    m_lo: float = 0.1,
    m_hi: float = 6.0,
    showcase_delta: float = 0.25,
    n_showcase: int = 5,
) -> tuple[dict, dict]:
    """Independently optimise the bid and ask spread multipliers.

    Bid and ask EV decompose cleanly (no shared variables), so the
    joint maximum equals the product of two 1-D maxima.  Golden-section
    search finds each optimum exactly.

    Returns (best_quote, candidates) where candidates = {"bid": [...], "ask": [...]}.
    Each bid candidate sweeps m_bid while keeping ask fixed at its optimum;
    each ask candidate does the reverse.  The middle row (index n_showcase//2)
    in each list is always the optimum for that side.
    """
    r = compute_reservation_price(fair_value, inventory, inventory_penalty)
    min_half = min_spread / 2.0

    # Clamp m_hi for the bid side so bid never drops below $1.
    if volatility > 0:
        m_hi_bid = min(m_hi, max(m_lo, (r - 1.0) * 2.0 / volatility))
    else:
        m_hi_bid = m_hi

    # ── Independent optimisation ──────────────────────────────────────────────
    m_bid_star = _golden_section_max(
        lambda m: _eval_bid(m, r, fair_value, volatility, aggressiveness, min_half)[2],
        m_lo, m_hi_bid,
    )
    m_ask_star = _golden_section_max(
        lambda m: _eval_ask(m, r, fair_value, volatility, aggressiveness)[2],
        m_lo, m_hi,
    )

    best_bid, best_bid_p, best_bid_ev = _eval_bid(m_bid_star, r, fair_value, volatility, aggressiveness, min_half)
    best_ask, best_ask_p, best_ask_ev = _eval_ask(m_ask_star, r, fair_value, volatility, aggressiveness)
    best_total_ev = best_bid_ev + best_ask_ev

    # ── Showcase candidates ───────────────────────────────────────────────────
    half = n_showcase // 2

    bid_mults = [max(m_lo, min(m_hi_bid, m_bid_star + (k - half) * showcase_delta)) for k in range(n_showcase)]
    bid_mults[half] = m_bid_star

    ask_mults = [max(m_lo, min(m_hi, m_ask_star + (k - half) * showcase_delta)) for k in range(n_showcase)]
    ask_mults[half] = m_ask_star

    bid_candidates = []
    for m in bid_mults:
        bid, p, ev = _eval_bid(m, r, fair_value, volatility, aggressiveness, min_half)
        bid_candidates.append({
            "multiplier":  m,
            "bid":         bid,
            "fill_prob":   p,
            "ev_bid":      ev,
            "total_ev":    ev + best_ask_ev,   # vary bid, ask fixed at optimum
        })

    ask_candidates = []
    for m in ask_mults:
        ask, p, ev = _eval_ask(m, r, fair_value, volatility, aggressiveness)
        ask_candidates.append({
            "multiplier":  m,
            "ask":         ask,
            "fill_prob":   p,
            "ev_ask":      ev,
            "total_ev":    best_bid_ev + ev,   # vary ask, bid fixed at optimum
        })

    best_quote = {
        "bid":                  best_bid,
        "ask":                  best_ask,
        "bid_multiplier":       m_bid_star,
        "ask_multiplier":       m_ask_star,
        "spread_multiplier":    (m_bid_star + m_ask_star) / 2.0,  # compat field
        "spread":               best_ask - best_bid,
        "reservation_price":    r,
        "bid_fill_probability": best_bid_p,
        "ask_fill_probability": best_ask_p,
        "bid_ev":               best_bid_ev,
        "ask_ev":               best_ask_ev,
        "total_ev":             best_total_ev,
    }

    return best_quote, {"bid": bid_candidates, "ask": ask_candidates}
