def compute_reservation_price(
    fair_value: float,
    inventory: int,
    inventory_penalty: float = 1.5,
) -> float:
    return fair_value - (inventory_penalty * inventory)
