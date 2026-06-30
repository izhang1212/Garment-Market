"""
Layer 5 — Decision Engine

Combines the four upstream layers into a final recommendation.

Pipeline:
  estimation  → Kalman velocity (FV selection handled upstream)
  signals     → Z-score  (deviation of latest price from adaptive FV)
  regime      → OU half-life  (how quickly prices mean-revert)
  sizing      → Kelly fraction  (position size per side)

Decision logic — each side evaluated independently:

  Gate 1 — Kelly
    Is the expected edge large enough relative to the opportunity cost of
    posting a quote that might not fill?  Kelly fraction > MIN_KELLY_FRACTION.
    If not → don't quote regardless of signals.

  Gate 2 — Regime-selected primary signal
    The OU regime determines which signal to trust as the hard gate.

    mean_reverting / slow_reverting  (half-life ≤ 45 days)
      Z-score is primary:
        Bid blocked  if z_label == "expensive"  (buying at a cyclical high)
        Ask blocked  if z_label == "cheap"      (selling at a cyclical low)

    trending / unknown  (no reliable mean reversion detected)
      Kalman velocity is primary:
        Bid blocked  if velocity < −VELOCITY_THRESHOLD  (price falling)
        Ask blocked  if velocity > +VELOCITY_THRESHOLD  (price rising)

  Both gates must pass for a side to be actionable.
  The bid and ask are evaluated completely independently.
"""

_MIN_KELLY          = 0.01    # minimum Kelly fraction to consider a quote worthwhile
_VELOCITY_THRESHOLD = 0.5     # %/day — above this magnitude, velocity is directionally significant


def trading_decision(
    fair_value:   float,     # recency-weighted FV (used for spread models; kept in metrics)
    volatility:   float,     # recency-weighted vol (used for spread models; kept in metrics)
    inventory:    int,
    quote_result: dict,      # output of the winning spread model
    kalman:       dict,      # Layer 1 — {fair_value, velocity}
    z_score:      dict,      # Layer 2 — {value, label, latest_price}
    regime:       dict,      # Layer 3 — {half_life_days, regime, ar1_coef}
    sizing:       dict,      # Layer 4 — {bid_fraction, ask_fraction}
) -> dict:

    bid      = quote_result["bid"]
    ask      = quote_result["ask"]
    bid_fill = quote_result["bid_fill_probability"]
    ask_fill = quote_result["ask_fill_probability"]
    bid_ev   = quote_result["bid_ev"]
    ask_ev   = quote_result["ask_ev"]
    total_ev = quote_result["total_ev"]

    velocity     = kalman["velocity"]                             # $/day
    velocity_pct = velocity / max(fair_value, 1.0) * 100        # %/day

    z_val    = z_score["value"]
    z_label  = z_score["label"]
    latest   = z_score["latest_price"]

    regime_label = regime["regime"]
    half_life    = regime["half_life_days"]
    ar1          = regime["ar1_coef"]

    bid_fraction = sizing["bid_fraction"]
    ask_fraction = sizing["ask_fraction"]

    # ── Gate 1: Kelly ─────────────────────────────────────────────────────────
    bid_kelly_ok = bid_fraction > _MIN_KELLY
    ask_kelly_ok = ask_fraction > _MIN_KELLY

    # ── Gate 2: Regime-selected primary signal ────────────────────────────────
    mean_reverting = regime_label in ("mean_reverting", "slow_reverting")

    if mean_reverting:
        # Z-score gate: block bids at expensive prices, block asks at cheap prices
        bid_primary_ok     = z_label != "expensive"
        ask_primary_ok     = z_label != "cheap"
        primary_signal     = "z_score"
        bid_primary_reason = f"{z_label} ({z_val:+.2f}σ)"
        ask_primary_reason = f"{z_label} ({z_val:+.2f}σ)"
    else:
        # Velocity gate: block bids in falling markets, block asks in rising markets
        bid_primary_ok     = velocity_pct >= -_VELOCITY_THRESHOLD
        ask_primary_ok     = velocity_pct <= +_VELOCITY_THRESHOLD
        primary_signal     = "velocity"
        bid_primary_reason = f"{velocity_pct:+.2f}%/day"
        ask_primary_reason = f"{velocity_pct:+.2f}%/day"

    # ── Final gates ───────────────────────────────────────────────────────────
    bid_actionable = bid_kelly_ok and bid_primary_ok
    ask_actionable = ask_kelly_ok and ask_primary_ok

    if bid_actionable and ask_actionable:
        action = "quote_both_sides"
    elif bid_actionable:
        action = "buy_only"
    elif ask_actionable:
        action = "sell_only"
    else:
        action = "hold"

    return {
        "recommended_bid": bid,
        "recommended_ask": ask,
        "action":          action,

        # ── Structured signal output ──────────────────────────────────────────
        # Each layer's output is preserved so the frontend can display the full
        # reasoning chain without recomputing anything.
        "signals": {
            "kalman": {
                "velocity":            round(velocity, 4),
                "velocity_pct_per_day": round(velocity_pct, 4),
            },
            "z_score": {
                "value":        z_val,
                "label":        z_label,
                "latest_price": latest,
            },
            "regime": {
                "label":          regime_label,
                "half_life_days": half_life,
                "ar1_coef":       ar1,
                "primary_signal": primary_signal,
            },
        },

        # ── Per-side gate results ─────────────────────────────────────────────
        "bid_gate": {
            "kelly_fraction":  bid_fraction,
            "kelly_passes":    bid_kelly_ok,
            "primary_signal":  primary_signal,
            "primary_passes":  bid_primary_ok,
            "primary_reason":  bid_primary_reason,
            "actionable":      bid_actionable,
        },
        "ask_gate": {
            "kelly_fraction":  ask_fraction,
            "kelly_passes":    ask_kelly_ok,
            "primary_signal":  primary_signal,
            "primary_passes":  ask_primary_ok,
            "primary_reason":  ask_primary_reason,
            "actionable":      ask_actionable,
        },

        "metrics": {
            "fair_value":           fair_value,
            "volatility":           volatility,
            "inventory":            inventory,
            "reservation_price":    quote_result["reservation_price"],
            "spread":               quote_result["spread"],
            "bid_fill_probability": bid_fill,
            "ask_fill_probability": ask_fill,
            "bid_ev":               bid_ev,
            "ask_ev":               ask_ev,
            "total_ev":             total_ev,
        },
    }
