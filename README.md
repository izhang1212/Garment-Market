# fashion-market (trading engine)

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

Item: Nike Dunk Low Panda

Fair value: 245.97
Volatility: 4.21

DATA DRIVEN EV MODEL
Bid: 236.65 | Ask: 249.30
Total EV: 2.53

AVELLANEDA–STOIKOV
Bid: 244.53 | Ask: 246.70
Total EV: 1.64

## Project Structure:

app/
├── db/ # database setup
├── models/ # ORM models (Item, Transaction, Listing)
├── data/ # seed data
├── engine/ # quote optimization (find_best_quote)
├── strategies/
│ ├── ev_model/ # data-driven EV-based model
│ └── avellaneda_stoikov/ # theoretical model

## Next Steps

- Calibrate Avellaneda–Stoikov parameters (risk aversion, liquidity)
- Incorporate real marketplace data from resale websites

# References:

- [Avellaneda-Stoikov](https://people.orie.cornell.edu/sfs33/LimitOrderBook.pdf)