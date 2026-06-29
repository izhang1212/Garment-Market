
# adjust fair value based on inventory
    # positive invenotry lowers the reservation price
    # negative inventory raises the reservation pricec
def compute_reservation_price(
    fair_value: float,
    inventory: int,
    inventory_penalty: float = 1.5
) -> float:
    return fair_value - (inventory_penalty * inventory)

# compute bid and ask from reservatoin price and spread
def compute_quotes(
    reservation_price: float,
    spread: float
) -> tuple[float, float]:
    
    if spread < 0:
        raise ValueError("Spread cannot be negative")

    half_spread = spread / 2.0
    bid = max(1.0, reservation_price - half_spread)
    ask = reservation_price + half_spread

    return bid, ask