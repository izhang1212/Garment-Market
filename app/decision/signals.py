"""
Layer 2 — Signal generation

Z-score: where does the most recent transaction sit relative to the
Kalman-estimated fair value, measured in units of recency-weighted volatility?

  expensive  z > +1.5σ  : market is elevated vs its own history → bad entry for a bid
  cheap      z < −1.5σ  : market is depressed vs its own history → bad exit for an ask
  neutral    otherwise

Why use Kalman FV here instead of the weighted mean?
  The weighted mean is pulled toward older, higher (or lower) prices.
  Kalman FV reflects the most recent filtered level, so the z-score measures
  deviation from *where the price is now*, not where it was on average.

Why use recency-weighted volatility as the denominator (not Kalman innovation std)?
  Kalman innovations measure prediction error per step, which conflates
  observation noise with genuine price moves. The recency-weighted std
  is a stable, well-calibrated measure of actual price dispersion — more
  appropriate as the unit for "how extreme is this price."

Momentum is NOT computed here. It comes directly from Kalman velocity
(estimation layer), avoiding a redundant linear regression.
"""


def compute_z_score(transactions, kalman_fv: float, volatility: float) -> dict:
    if not transactions or volatility <= 0:
        return {"value": 0.0, "label": "neutral", "latest_price": round(kalman_fv, 2)}

    latest = max(transactions, key=lambda t: t.transacted_at)
    z      = (latest.price - kalman_fv) / volatility

    if z > 1.5:
        label = "expensive"
    elif z < -1.5:
        label = "cheap"
    else:
        label = "neutral"

    return {
        "value":        round(z, 3),
        "label":        label,
        "latest_price": round(latest.price, 2),
    }
