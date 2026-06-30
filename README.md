# Garment Market — quantitative market-making engine

## Overview

**Description:** A quantitative market-making engine for fashion resale (StockX, GOAT, eBay) that evaluates optimal bid and ask quotes for an item using its historical transaction data.

**Inspiration:** Fashion resale markets operate structurally like financial exchanges: buyers post bids, sellers post asks, and transactions occur when both sides agree on a price, driven by supply, demand, hype, and scarcity. This project treats every item (sneakers, streetwear, accessories, luxury goods) as a tradeable asset, and its transaction history as the equivalent of a stock's price history.

**Goal:** To simulate how a market maker determines optimal buy/sell prices under uncertainty by estimating fair value and risk from historical sales, then generating quotes that maximise expected profit while accounting for fill probability and inventory exposure.

---

## Shared Inputs

Both models consume the same recency-weighted estimates derived from an item's transaction history. Each sale is assigned an exponential decay weight so that recent trades exert more influence than older ones.

**Recency weight**
```
wᵢ = e^(−λ · tᵢ)     λ = 0.08 day⁻¹, tᵢ = age of sale i in days
```

**Fair value (μ)** — adaptive, chosen per query:
- **Kalman level** (preferred) — a constant-velocity Kalman filter run over the full transaction history, used whenever at least 5 trades fall in the trailing 90-day window. A single state-space pass estimates price level and trend jointly, correcting for observation noise rather than just averaging.
- **Recency-weighted mean** (fallback) — used when recent data is too sparse to trust a velocity estimate:
```
μ = (Σ wᵢ · xᵢ) / Σ wᵢ     xᵢ = sale price of transaction i
```

**Volatility (σ)** — recency-weighted standard deviation
```
σ = √( (Σ wᵢ · (xᵢ − μ)²) / Σ wᵢ )
```

**Liquidity (κ)** — Poisson arrival rate of orders, estimated from transaction frequency
```
κ = N_trades / T_window     (trades per day)
```

**Inventory (q)** — net number of units currently held (positive = long, negative = short)

**Time horizon (T)** — the forward window over which the model plans, in days

---

## Model 1 — Expected Value Model (simulate)

The EV model sweeps a continuous range of spread multipliers and picks the quote that maximises total expected profit. It does not assume a particular market structure — it simulates outcomes directly.

**Aggressiveness** is calibrated from liquidity: `a = max(1.0, √κ)`. Liquid items (high κ) get tighter spreads; illiquid items floor at a = 1.

**Fill probability** — the likelihood a counterparty transacts at a given quote:
```
P(fill | quote) = e^(−a · |quote − μ| / σ)
```

**Expected value per side:**
```
EV_bid = P(fill | bid) × (μ − bid)
EV_ask = P(fill | ask) × (ask − μ)
Total EV = EV_bid + EV_ask
```

**Optimal spread multiplier** — found via golden-section search over m ∈ [0.1, 6.0]:
```
m* = argmax { m · σ · e^(−a · m / 2) }
```

Quotes are placed symmetrically around the reservation price:
```
bid = r − m*σ/2,   ask = r + m*σ/2
```

---

## Model 2 — Avellaneda–Stoikov (derive)

The A-S model derives optimal quotes analytically from a stochastic control framework. It solves the Hamilton–Jacobi–Bellman equation for a market maker with inventory risk, yielding closed-form expressions for the reservation price and optimal spread.

**Reservation price** — fair value adjusted for inventory risk:
```
r = μ − q · γ · σ² · T
```
A long inventory (q > 0) lowers the reservation price, making the ask more aggressive and the bid more conservative.

**Optimal spread:**
```
δ* = γσ²T + (2/γ) · ln(1 + γ/κ)
```
The first term penalises volatility and risk aversion; the second widens the spread under thin liquidity (low κ). The spread narrows automatically as liquidity improves.

**Implicit fill probability:**
```
P(fill | side) = e^(−κ · δ / 2)
```

Parameters γ (risk aversion) and T (time horizon) are swept over a grid; the combination producing the highest total EV is selected.

---

## Decision Engine

Both spread models run on every query; the one with the higher total EV is selected as the winning quote. That quote then passes through a five-layer pipeline that decides whether — and on which side — to actually post it:

1. **Estimation** — the Kalman filter (see Shared Inputs) producing fair value and velocity (trend in $/day).
2. **Signals** — a z-score measuring how far the latest sale sits from fair value, in units of recency-weighted volatility (`expensive` above +1.5σ, `cheap` below −1.5σ).
3. **Regime** — an Ornstein-Uhlenbeck half-life fit (AR(1) on the price series) classifies the item as mean-reverting, slow-reverting, or trending, which decides whether the z-score or the Kalman velocity gates the decision.
4. **Sizing** — a half-Kelly fraction per side, adapted for limit orders with an explicit opportunity-cost term for quotes that don't fill.
5. **Decision** — each side (bid/ask) must clear two gates: a minimum Kelly fraction, and the regime-selected primary signal (z-score in mean-reverting regimes, velocity in trending ones). Bid and ask are evaluated independently, yielding one of `quote_both_sides`, `buy_only`, `sell_only`, or `hold`.

The final output is a bid price, ask price, and an action verdict, with the full reasoning chain (Kalman, z-score, regime, per-side gates) preserved for the frontend to display.

---

## Model Comparison

Both models produce a bid and ask, but they answer fundamentally different questions and carry different assumptions about how markets work.

**How each model arrives at a quote:**

The EV model is purely numerical. It sweeps a range of spread multipliers and picks the one that maximises expected profit on each trade in isolation. The fill probability is a calibrated exponential — it decays with distance from fair value at a rate set by the aggressiveness parameter. 

The A-S model is analytical. It derives the optimal quote by solving the Hamilton–Jacobi–Bellman equation for a market maker managing a book over a finite horizon T. The fill probability emerges from the Poisson order-arrival assumption — it is not a free parameter. The reservation price shifts with inventory position, and the spread widens automatically as liquidity thins or volatility rises. The quote is not the best trade today; it is the best policy over the planning window.

| | EV Model | Avellaneda–Stoikov |
|---|---|---|
| Approach | Simulation (numerical sweep) | Derivation (closed-form HJB) |
| Fill probability | Calibrated curve `e^(−a·δ/σ)` | Implied by Poisson arrivals `e^(−κ·δ/2)` |
| Inventory response | Explicit — `α·q` penalty, decoupled from spread | Explicit — `q·γ·σ²·T` penalty, coupled with spread |
| Key parameters | Aggressiveness `a` (derived from κ) | Risk aversion `γ`, time horizon `T` |
| Optimal spread | `m* = 2/a`, P(fill) = 37% at optimum | Closed-form `δ* = γσ²T + (2/γ)·ln(1 + γ/κ)` |

**Real-world use case — EV model:**
- Best when inventory isn't a primary concern and you want direct, tunable control over quote aggressiveness.
  - Aggressiveness `a` trades off fill rate vs. margin without changing model structure.
- Most reliable in sparse/irregular markets (vintage, low-volume sizes) since it makes no Poisson-arrival or GBM-style assumptions.
- Easier to debug — spread → fill probability → EV is traceable at every step.

**Real-world use case — Avellaneda–Stoikov:**
- Best when holding a position changes your risk exposure and quotes should respond jointly to volatility, inventory, and liquidity.
  - A long position pushes the reservation price down — more aggressive ask, more conservative bid — mirroring how institutional market makers manage directional exposure.
- Most relevant once you've already bought an item and need the optimal ask given that existing inventory.
- More interpretable spread — the risk term and liquidity term are separable, so you can attribute a wide quote to either factor.

**Differences — strengths & weaknesses:**
- **No inventory (q = 0):** the models converge — A-S's reservation price collapses to r = μ, and its (γ, T) grid search lands close to what EV's continuous golden-section search finds independently.
- **With inventory (q ≠ 0):** EV's total EV typically runs 2–3x A-S's.
  - A-S's risk aversion γ does double duty — it sets both spread width (`γσ²T`) and inventory skew (`qγσ²T`) at once, so widening the spread necessarily worsens the skew and vice versa. The grid search must compromise on both with one coupled parameter.
  - EV has no such coupling: its inventory penalty (`α` = 1% of FV/unit) is independent of spread width, and since bid/ask are optimized separately, it re-optimizes each side after the reservation price shifts — recovering EV on whichever side has more room.
  - A-S still skews correctly for inventory; it just pays for that awareness with a more constrained spread.
- **Sparse/irregular markets:** EV tends to be more reliable — A-S's Poisson-arrival and GBM-like assumptions are more clearly violated in thin markets (e.g. Nike Air Mag, vintage pieces).
- **Liquid markets, no inventory:** the two models are functionally interchangeable; either is a reasonable default.

---

## Market Data — KicksDB API

Real-world transaction data is sourced from [KicksDB](https://kicks.dev), a Standard API that wraps StockX and GOAT. All API calls are made server-side; the key never reaches the client.

**Endpoints used:**

| Endpoint | Purpose |
|---|---|
| `GET /stockx/products?query=` | Product search by name or SKU |
| `GET /stockx/products/{id}?display[variants]=true` | Product detail with per-size variants |
| `GET /stockx/products/{id}/sales` | Paginated sale history |
| `GET /goat/products?query=` | GOAT product search |
| `GET /goat/products/{id}/sales` | GOAT sale history |

Sales from both platforms are merged, deduplicated by date proximity, and normalised into a unified transaction schema before being passed to the models. An IQR outlier filter removes anomalous prices before estimation.

Search results are ranked by `weekly_orders` (trades in the past 7 days) so that the most actively traded items surface first for broad category queries.

---

## References

- Avellaneda & Stoikov (2008) — [High-frequency trading in a limit order book](https://people.orie.cornell.edu/sfs33/LimitOrderBook.pdf)
- KicksDB API — [kicks.dev](https://kicks.dev)

---

[garment-market website](https://garment-market.com)
