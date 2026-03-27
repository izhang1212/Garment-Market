# Garment-Market (trading engine)

# Overview

**Description:** This is a quantitative market-making engine for fashion resale (e.g. StockX, GOAT, ebay) that evaluates optimal bid/ask quotes using historical transaction data.

**Method:** The system estimates fair value and uncertainty, generates quotes using two different strategies, and evaluates them using execution probability and expected value.

**GOAL**: To simulate how a market maker determines optimal buy/sell prices under uncertainty.

# Two Stratagies Implemented:

### 1. Data-Driven EV Model (`app/strategies/ev_model/`)
- Recency-weighted fair value
- Recency-weighted volatility
- Volatility-based spread
- Inventory-adjusted reservation price
- Fill probability model
- Expected value optimization across candidate quotes

### 2. Avellaneda–Stoikov Model (`app/strategies/avellaneda_stoikov/`)
- Theoretical reservation price
- Optimal spread derived from risk aversion, volatility, and liquidity
- Closed-form quote generation

## Example Output:
```
Item: Adidas Yeezy Boost 350 V2 Onyx
SKU: HP6928
Model used: Avellaneda-Stoikov

MARKET METRICS
Fair value: 256.62
Volatility: 22.27
Inventory: 2

MODEL OUTPUT
Risk aversion: 0.0010
Liquidity: 0.2500
Time horizon: 2.0000
Reservation price: 254.64
Spread: 8.98
Bid: 250.15
Ask: 259.12
Bid fill probability: 0.7478
Ask fill probability: 0.8936
Bid EV: 4.8392
Ask EV: 2.2381
Total EV: 7.0773

FINAL RECOMMENDATION
Action: sell_only
Recommended bid: 250.15
Recommended ask: 259.12

JUSTIFICATION
- Estimated fair value is 256.62 and volatility is 22.27.
- The model produced a reservation price of 254.64 with a spread of 8.98.
- Recommended bid is 250.15 and recommended ask is 259.12.
- Inventory is positive, so the strategy should be somewhat cautious about accumulating even more units.
- Bid EV is 4.8392 with fill probability 0.7478.
- Ask EV is 2.2381 with fill probability 0.8936.
- Total expected value across both sides is 7.0773.
- Only the ask side is actionable because selling is favorable while the bid side is not attractive enough.
```

## Project Structure:
```
app/
├── db/ # database setup
├── models/ # ORM models (Item, Transaction, Listing)
├── data/ # seed data
├── engine/ # quote optimization (find_best_quote)
├── strategies/
│ ├── ev_model/ # data-driven EV-based model
│ └── avellaneda_stoikov/ # theoretical model
```
## Next Steps

- Calibrate Avellaneda–Stoikov parameters (risk aversion, liquidity)
- Incorporate real marketplace data from resale websites

# References:

- [Avellaneda-Stoikov](https://people.orie.cornell.edu/sfs33/LimitOrderBook.pdf)
