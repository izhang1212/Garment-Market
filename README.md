# fashion-market

"Fashion Market" is a system that tells you where to buy and sell an item by combining market data, uncertainty, risk, and inventory into one optimal pricing decision.

# Model:
Raw Market Data
        ↓
Normalized Data (parser)
        ↓
Belief about value (fair value + uncertainty)
        ↓
Quote decision (bid/ask)
        ↓
Adjust for inventory + risk
        ↓
Evaluate EV + probability
        ↓
Final recommendation

# References:

- [Avellaneda-Stoikov](https://people.orie.cornell.edu/sfs33/LimitOrderBook.pdf)