"""KicksDB pipeline test — prints last 8 transactions per market per item.

Shows raw sales from the API and the count kept after IQR + GOAT type filtering.

Usage:
    python api_test.py
"""

import os
from dotenv import load_dotenv
from app.data.kicks_db.client import KicksDBClient
from app.data.kicks_db import stockx as sx
from app.data.kicks_db import goat as goat_pipe

load_dotenv()

API_KEY = os.getenv("KICKS_DB_API_KEY", "")
if not API_KEY:
    raise SystemExit("Set KICKS_DB_API_KEY in your .env before running this test.")

LIMIT = 8

TEST_ITEMS = [
    {"sku": "DD1391-100", "name": "Nike Dunk Low Panda",                "size": "10"},
    {"sku": "DZ5485-612", "name": "Air Jordan 1 Retro High OG Chicago", "size": "10"},
    {"sku": "BB550WT1",   "name": "New Balance 550 White Green",         "size": "10"},
    {"sku": "B75806",     "name": "Adidas Samba OG White Black",         "size": "9.5"},
    {"sku": "HP6928",     "name": "Adidas Yeezy Boost 350 V2 Onyx",     "size": "10"},
]


def section(title: str) -> None:
    print(f"\n{'=' * 62}")
    print(f"  {title}")
    print('=' * 62)


def print_sales(label: str, records: list[dict], amount_key: str, ts_key: str,
                raw_count: int, filtered_count: int) -> None:
    print(f"\n  [{label}]  raw={raw_count}  after_filter={filtered_count}")
    if not records:
        print("    (none after filtering)")
        return
    print(f"    {'Date':<22}  {'Price':>8}")
    print(f"    {'-'*22}  {'-'*8}")
    for r in records:
        ts  = str(r.get(ts_key, ""))[:19]
        amt = r.get(amount_key, "?")
        print(f"    {ts:<22}  ${amt:>7}")


def main() -> None:
    client = KicksDBClient(API_KEY)

    for item_def in TEST_ITEMS:
        sku  = item_def["sku"]
        name = item_def["name"]
        size = item_def["size"]

        section(f"{name}  |  {sku}  |  size {size}")

        # ── StockX ──────────────────────────────────────────────────────────
        sx_product = sx.search_product(client, sku) or sx.search_product(client, name)
        if sx_product is None:
            print("\n  [StockX]  not found")
        else:
            pid        = str(sx_product.get("id") or sx_product.get("slug", ""))
            full       = sx.get_product_with_variants(client, pid) or sx_product
            variant_id = sx.find_variant_id(full, size)
            raw        = sx.fetch_sales(client, pid, LIMIT, variant_id)
            print_sales("StockX", raw, "amount", "created_at",
                        raw_count=len(raw), filtered_count=len(raw))

        # ── GOAT ────────────────────────────────────────────────────────────
        goat_product = goat_pipe.search_product(client, sku) or goat_pipe.search_product(client, name)
        if goat_product is None:
            print("\n  [GOAT]  not found")
        else:
            gid      = str(goat_product.get("id", ""))
            raw      = goat_pipe.fetch_sales(client, gid, LIMIT, size)
            filtered = _iqr_filter(raw, "amount")
            print_sales("GOAT", filtered, "amount", "purchased_at",
                        raw_count=len(raw), filtered_count=len(filtered))

    print("\n\nDone.")


if __name__ == "__main__":
    main()
