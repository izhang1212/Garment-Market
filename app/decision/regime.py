"""
Layer 3 — Regime detection

Ornstein-Uhlenbeck half-life from an AR(1) fit to the price series.

The OU process: dX = θ(μ − X)dt + σ dW

In discrete form: X_t = a + b·X_{t-1} + ε
  b ≈ e^(−θ·dt)  →  θ = −ln(b)/dt  →  half-life = ln(2)/θ

What the AR(1) coefficient tells us:
  b ≈ 1  : prices follow a random walk / trend — no mean reversion
  b < 1  : prices mean-revert; smaller b = faster reversion
  b < 0  : prices oscillate (unrealistic for resale; treated as trending)

Why this matters for the decision:
  Mean-reverting regime (short half-life)
    → A cheap or expensive price is likely to correct
    → Z-score is the primary decision signal
    → Post a bid when cheap; avoid posting when expensive

  Trending regime (long half-life or no reversion detected)
    → Price has directional momentum; mean reversion is too slow to rely on
    → Kalman velocity is the primary decision signal
    → Avoid buying into a falling trend; avoid selling into a rising one

Regimes:
  mean_reverting  : half-life ≤ 14 days  (reverts within two weeks)
  slow_reverting  : 14 < half-life ≤ 45  (reverts within six weeks)
  trending        : half-life > 45 or b ≥ 1 (too slow / no reversion)
  unknown         : fewer than 5 transactions (insufficient data)
"""
import numpy as np


def ou_half_life(transactions) -> dict:
    if len(transactions) < 5:
        return {"half_life_days": None, "regime": "unknown", "ar1_coef": None}

    sorted_txns = sorted(transactions, key=lambda t: t.transacted_at)
    prices = np.array([t.price for t in sorted_txns], dtype=float)

    # AR(1) OLS: p_t = a + b * p_{t-1}
    y  = prices[1:]
    x  = prices[:-1]
    b  = float(np.cov(x, y)[0, 1] / np.var(x))

    # Average calendar time between transactions (in days)
    times    = np.array([
        (t.transacted_at - sorted_txns[0].transacted_at).total_seconds() / 86400.0
        for t in sorted_txns
    ])
    dt_mean  = float(np.mean(np.diff(times))) if len(times) > 1 else 1.0

    ar1 = round(b, 4)

    if b <= 0 or b >= 1.0:
        # b ≥ 1: unit root or explosive — price is trending
        # b ≤ 0: sign oscillation — not physically meaningful for resale
        return {"half_life_days": None, "regime": "trending", "ar1_coef": ar1}

    half_life = float(-np.log(2) * dt_mean / np.log(b))

    if half_life <= 14:
        regime = "mean_reverting"
    elif half_life <= 45:
        regime = "slow_reverting"
    else:
        regime = "trending"

    return {
        "half_life_days": round(half_life, 1),
        "regime":         regime,
        "ar1_coef":       ar1,
    }
