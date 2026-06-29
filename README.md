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

**Fair value (μ)** — recency-weighted mean sale price
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

Both models run on every query. The engine picks the model with the higher total EV as the primary recommendation. A quote is considered actionable if:
- Fill probability ≥ 5%
- Expected value > 0

The final output is a bid price, ask price, and a verdict (buy, sell, both, or hold) with justification drawn from whichever model was selected.

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
| Inventory response | None (quotes symmetric around FV) | Explicit — reservation price skews with q |
| Key parameters | Aggressiveness `a` (derived from κ) | Risk aversion `γ`, time horizon `T` |
| Optimal spread | `m* = 2/a`, P(fill) = 37% at optimum | Closed-form `δ* = γσ²T + (2/γ)·ln(1 + γ/κ)` |

**Practical use-case differences:**

The EV model behaves like a per-trade profit optimiser. It answers: *at what price is it worth posting a quote right now?* It is best used when inventory is not a concern and you want direct control over how aggressive the quotes are. Aggressiveness can be tuned tighter (narrow spread, higher fill rate) or wider (lower fill rate, more margin per fill) without changing the model structure.

The A-S model behaves like an inventory manager. It is better suited when holding a position changes your risk exposure — a long position pushes the reservation price down, making the ask more aggressive and the bid more conservative to encourage offloading. This is how institutional market makers operate: they skew quotes to manage directional exposure over time, not just to maximise per-trade EV. In the fashion resale context, this matters most when you have already bought an item and want the optimal ask given that existing inventory.

In practice, for items with thin liquidity or held inventory, A-S tends to produce tighter, more risk-adjusted quotes. For liquid items with no inventory exposure, the two models converge.

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
