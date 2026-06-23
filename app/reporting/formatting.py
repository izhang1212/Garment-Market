# Formatting functions for printing the report to the console
def print_report(
    item,
    fair_value: float,
    volatility: float,
    inventory: int,
    model_name: str,
    quote_result: dict,
    decision: dict,
) -> None:
    
    print("=" * 60)
    print("Trading Decision")
    print("=" * 60)

    # Item Info
   
    print(f"Item: {item.name}")
    print(f"SKU: {item.sku}")
    print(f"Model used: {model_name}")
    print()

   # Market Metrics
    print("MARKET METRICS")
    print("-" * 60)
    print(f"Fair value: {fair_value:.2f}")
    print(f"Volatility: {volatility:.2f}")
    print(f"Inventory: {inventory}")
    print()

    # Model Output
    print("MODEL OUTPUT")
    print("-" * 60)

    # A–S specific fields (only print if present)
    if "risk_aversion" in quote_result:
        print(f"Risk aversion: {quote_result['risk_aversion']:.4f}")
    if "liquidity" in quote_result:
        print(f"Liquidity: {quote_result['liquidity']:.4f}")
    if "time_horizon" in quote_result:
        print(f"Time horizon: {quote_result['time_horizon']:.4f}")

    # EV-specific field
    if "spread_multiplier" in quote_result:
        print(f"Spread multiplier: {quote_result['spread_multiplier']:.2f}")

    print(f"Reservation price: {quote_result['reservation_price']:.2f}")
    print(f"Spread: {quote_result['spread']:.2f}")
    print(f"Bid: {quote_result['bid']:.2f}")
    print(f"Ask: {quote_result['ask']:.2f}")
    print(f"Bid fill probability: {quote_result['bid_fill_probability']:.4f}")
    print(f"Ask fill probability: {quote_result['ask_fill_probability']:.4f}")
    print(f"Bid EV: {quote_result['bid_ev']:.4f}")
    print(f"Ask EV: {quote_result['ask_ev']:.4f}")
    print(f"Total EV: {quote_result['total_ev']:.4f}")
    print()

    # Decision made:
    print("FINAL RECOMMENDATION")
    print("-" * 60)
    print(f"Action: {decision['action']}")
    print(f"Recommended bid: {decision['recommended_bid']:.2f}")
    print(f"Recommended ask: {decision['recommended_ask']:.2f}")
    print()

    # Justification
    print("JUSTIFICATION")
    print("-" * 60)
    for line in decision["justification"]:
        print(f"- {line}")

    print("=" * 60)
