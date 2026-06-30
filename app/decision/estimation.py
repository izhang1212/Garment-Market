"""
Layer 1 — Estimation

Kalman filter (constant-velocity model) over the transaction history.

State vector: x = [price_level, velocity]
  price_level : best current estimate of true market price
  velocity    : trend in $/day (negative = falling, positive = rising)

Why Kalman over weighted mean + linear regression?
  - A single pass produces both FV and trend simultaneously, with each
    updating the other. The weighted mean treats every transaction as an
    independent snapshot; Kalman treats them as a sequence where each
    observation refines a running estimate.
  - Irregular time gaps are handled natively via the state transition matrix.
    The model predicts where the price *should* be at each observation time,
    then corrects based on the actual transaction.
  - Observation noise is explicit: a single outlier sale shifts the estimate
    less than it would shift a simple average.

Outputs:
  fair_value  : Kalman-filtered price level — used as FV in decision signals
  velocity    : filtered trend in $/day — replaces the linear-regression slope
"""
import numpy as np


_ACCEL_FRAC = 0.008   # process noise: how fast the trend can change (~0.8% of price/day²)
_OBS_FRAC   = 0.025   # observation noise: expected transaction-level spread (~2.5% of price)


def kalman_estimate(transactions) -> dict:
    if len(transactions) < 2:
        p = transactions[0].price if transactions else 0.0
        return {"fair_value": round(p, 4), "velocity": 0.0}

    sorted_txns = sorted(transactions, key=lambda t: t.transacted_at)
    prices = np.array([t.price for t in sorted_txns], dtype=float)
    t0     = sorted_txns[0].transacted_at
    times  = np.array([
        (t.transacted_at - t0).total_seconds() / 86400.0
        for t in sorted_txns
    ], dtype=float)

    p0          = prices[0]
    sigma_accel = _ACCEL_FRAC * p0   # $/day² noise
    sigma_obs   = _OBS_FRAC   * p0   # $/transaction noise

    # Initial state: start at first price, zero velocity
    x = np.array([p0, 0.0])
    P = np.array([
        [sigma_obs**2,          0.0],
        [0.0,          (0.002 * p0)**2],
    ])

    H = np.array([[1.0, 0.0]])          # observe price level only
    R = np.array([[sigma_obs**2]])

    for i in range(1, len(prices)):
        dt = max(times[i] - times[i - 1], 1e-3)

        # State transition: level += velocity * dt; velocity unchanged
        F = np.array([[1.0, dt], [0.0, 1.0]])

        # Process noise for constant-velocity model (Wiener process on acceleration)
        Q = sigma_accel**2 * np.array([
            [dt**3 / 3, dt**2 / 2],
            [dt**2 / 2, dt       ],
        ])

        # ── Predict ───────────────────────────────────────────────────────────
        x_pred = F @ x
        P_pred = F @ P @ F.T + Q

        # ── Update ────────────────────────────────────────────────────────────
        S     = H @ P_pred @ H.T + R                    # innovation covariance (scalar)
        K     = (P_pred @ H.T) @ np.linalg.inv(S)       # Kalman gain (2×1)
        innov = prices[i] - (H @ x_pred)[0]             # prediction error

        x = x_pred + K.flatten() * innov
        P = (np.eye(2) - K @ H) @ P_pred

    return {
        "fair_value": round(float(x[0]), 4),
        "velocity":   round(float(x[1]), 4),   # $/day — negative means falling
    }
