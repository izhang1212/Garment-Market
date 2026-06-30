"""
Layer 4 — Position sizing

Kelly criterion adapted for limit-order market-making.

Standard Kelly for a binary bet:
  Win  (prob p): gain = b  (fractional profit per unit deployed)
  Lose (prob q): lose = 1  (full unit)
  f*   = (p·b − q) / b

The problem with pure Kelly for limit orders: if the quote doesn't fill,
you don't actually lose the stake — you just don't profit. A pure "no loss"
model produces f* → ∞ (always bet everything), which is not useful.

Adaptation — explicit opportunity cost:
  Win  (prob p): gain = edge / quote_price per unit deployed
  Lose (prob q): lose = C (opportunity cost fraction) per unit deployed

C = 0.02 represents the estimated cost of having capital tied up in a posted
quote that doesn't fill within the observation window (~2% of the quote price).
This is a realistic proxy for: slippage risk on cancellation, capital lock-up
cost, and operational overhead of a live quote.

f*  = (p·b − q·C) / b           [full Kelly]
f   = 0.5 · f*                   [half-Kelly: ~75% of growth, ~50% of drawdown]

f > 0  → worth quoting at this size
f ≤ 0  → expected cost exceeds expected gain even under Kelly → don't quote

This replaces the binary EV > 0 AND fill_prob > threshold check with a
continuous score that reflects both the quality of the edge and the
uncertainty of execution.
"""

_HALF_KELLY       = 0.5
_OPPORTUNITY_COST = 0.02   # fraction of quote price lost if order doesn't fill
_MAX_FRACTION     = 1.0


def kelly_fraction(fill_prob: float, edge: float, quote_price: float) -> float:
    """
    Half-Kelly position fraction for a single side.

    fill_prob   : P(fill) from the winning model
    edge        : expected profit if fills  (FV − bid  for bids;  ask − FV  for asks)
    quote_price : the posted price  (bid or ask)
    """
    if fill_prob <= 0 or edge <= 0 or quote_price <= 0:
        return 0.0

    b = edge / quote_price           # fractional gain per unit if fills
    q = 1.0 - fill_prob
    C = _OPPORTUNITY_COST

    f_full = (fill_prob * b - q * C) / b

    if f_full <= 0:
        return 0.0

    return round(min(_HALF_KELLY * f_full, _MAX_FRACTION), 4)


def compute_sizing(
    fair_value:    float,
    bid:           float,
    ask:           float,
    bid_fill_prob: float,
    ask_fill_prob: float,
) -> dict:
    bid_edge    = fair_value - bid
    ask_edge    = ask - fair_value
    bid_kelly   = kelly_fraction(bid_fill_prob, bid_edge, bid)
    ask_kelly   = kelly_fraction(ask_fill_prob, ask_edge, ask)

    return {
        "bid_fraction": bid_kelly,
        "ask_fraction": ask_kelly,
    }
