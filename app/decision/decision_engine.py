# Create trading decision (bid/ask/hold) based on strategy output
    # Provide justification for decision as well
def trading_decision(
    fair_value: float,
    volatility: float,
    inventory: int,
    quote_result: dict,
    min_fill_prob: float = 0.85
) -> dict:
    
    bid = quote_result["bid"]
    ask = quote_result["ask"]
    res_price = quote_result["reservation_price"]
    spread = quote_result["spread"]

    bid_fill_prob = quote_result["bid_fill_probability"]
    ask_fill_prob = quote_result["ask_fill_probability"]

    bid_ev = quote_result["bid_ev"]
    ask_ev = quote_result["ask_ev"]
    total_ev = quote_result["total_ev"]

    bid_actionable = bid_ev > 0 and bid_fill_prob >= min_fill_prob
    ask_actionable = ask_ev > 0 and ask_fill_prob >= min_fill_prob

    if bid_actionable and ask_actionable and total_ev > 0:
        action = "quote_both_sides"

    elif bid_actionable and not ask_actionable:
        action = "buy_only"

    elif ask_actionable and not bid_actionable:
        action = "sell_only"

    else:
        action = "hold"

    justification = []

    justification.append(
        f"Estimated fair value is {fair_value:.2f} and volatility is {volatility:.2f}."
    )
    justification.append(
        f"The model produced a reservation price of {res_price:.2f} with a spread of {spread:.2f}."
    )
    justification.append(
        f"Recommended bid is {bid:.2f} and recommended ask is {ask:.2f}."
    )

    if inventory > 0:
        justification.append(
            "Inventory is positive, so the strategy should be somewhat cautious about accumulating even more units."
        )
    elif inventory < 0:
        justification.append(
            "Inventory is negative, so the strategy should be somewhat cautious about selling even more units."
        )
    else:
        justification.append(
            "Inventory is balanced, so the strategy can evaluate both sides more neutrally."
        )

    justification.append(
        f"Bid EV is {bid_ev:.4f} with fill probability {bid_fill_prob:.4f}."
    )
    justification.append(
        f"Ask EV is {ask_ev:.4f} with fill probability {ask_fill_prob:.4f}."
    )
    justification.append(
        f"Total expected value across both sides is {total_ev:.4f}."
    )

    if action == "quote_both_sides":
        justification.append(
            "Both sides are actionable because both bid and ask have positive expected value and acceptable fill probability."
        )
    elif action == "buy_only":
        justification.append(
            "Only the bid side is actionable because buying is favorable while the ask side is not attractive enough."
        )
    elif action == "sell_only":
        justification.append(
            "Only the ask side is actionable because selling is favorable while the bid side is not attractive enough."
        )
    else:
        justification.append(
            "Neither side is attractive enough after accounting for expected value and fill probability, so the best action is to hold."
        )

    return {
        "recommended_bid": bid,
        "recommended_ask": ask,
        "action": action,
        "justification": justification,
        "metrics": {
            "fair_value": fair_value,
            "volatility": volatility,
            "inventory": inventory,
            "reservation_price": res_price,
            "spread": spread,
            "bid_fill_probability": bid_fill_prob,
            "ask_fill_probability": ask_fill_prob,
            "bid_ev": bid_ev,
            "ask_ev": ask_ev,
            "total_ev": total_ev
        },
    }