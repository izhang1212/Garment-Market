from datetime import datetime
from typing import Any


def parse_float(value: Any) -> float:
    # if the value is an int or float
    if isinstance(value, (int, float)):
        return float(value)
    # if the instance is a string
    if isinstance(value, str):
        # remove any extra symbols or spaces
        cleaned = value.replace("$","").replace(",","").strip()
        return float(cleaned)
    
    raise ValueError(f"Could not parse float from value: {value}")

def parse_datetime(value: Any) -> datetime:
    if isinstance(value, datetime):
        return value
    
    if isinstance(value, str):
        return datetime.fromisoformat(value)
    
    raise ValueError(f"Could not parse datetime from value: {value}")

def normalize_transaction(raw: dict[str, Any]) -> dict[str, Any]:
    price = raw.get("price", raw.get("sale_price"))
    source = raw.get("source", raw.get("marketplace"))
    transacted_at = raw.get("transacted_at", raw.get("sold_at"))
    quantity = raw.get("quantity", 1)

    if price is None or source is None or transacted_at is None:
        raise ValueError("Missing required transaction fields.")

    return {
        "price": parse_float(price),
        "quantity": int(quantity),
        "source": str(source).lower().strip(),
        "transacted_at": parse_datetime(transacted_at),
    }


def normalize_listing(raw: dict[str, Any]) -> dict[str, Any]:
    ask_price = raw.get("ask_price", raw.get("price"))
    source = raw.get("source", raw.get("marketplace"))
    collected_at = raw.get("collected_at", raw.get("timestamp"))

    if ask_price is None or source is None or collected_at is None:
        raise ValueError("Missing required listing fields.")

    return {
        "ask_price": parse_float(ask_price),
        "source": str(source).lower().strip(),
        "collected_at": parse_datetime(collected_at),
    }