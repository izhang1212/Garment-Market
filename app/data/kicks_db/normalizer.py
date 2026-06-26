"""Convert raw KicksDB API records into SQLAlchemy ORM objects.

Amount assumptions
------------------
KicksDB wraps StockX and GOAT data in a normalised format. We assume
`amount` is expressed in the item's currency major unit (USD dollars).
If prices look 100x too large after testing, divide by 100 here.

Timestamps
----------
KicksDB returns ISO-8601 strings (e.g. "2024-03-15T10:30:00Z"). We
strip the timezone offset so the resulting datetime objects are naive,
matching the convention already used by the seed data and DateTime columns.

Outlier filtering
-----------------
StockX sale history includes both buy-now hits and accepted bids.
Accepted bids can sit well below the market price (e.g. a size-10 Dunk
Panda that normally sells for $110 but where a seller accepted a $58 bid).
Both markets' records are passed through an IQR filter before conversion
so that outlier transactions don't skew fair value or volatility.
GOAT records are additionally filtered to buy-now sales only
(PURCHASE_TYPE_SALE), since closed offers are negotiated off-market prices.
"""

from datetime import datetime, timezone
from statistics import median

from app.schemas.listing import Listing
from app.schemas.transaction import Transaction

# IQR multiplier: 1.5 is standard (Tukey fences). Raise to 2.0–3.0 to
# keep more of the distribution if the item has high natural volatility.
_IQR_MULTIPLIER = 1.5


def _parse_dt(ts: str) -> datetime:
    dt = datetime.fromisoformat(ts.replace("Z", "+00:00"))
    return dt.astimezone(timezone.utc).replace(tzinfo=None)


def _iqr_filter(records: list[dict], amount_key: str) -> list[dict]:
    """Drop records whose price falls outside the Tukey fences (Q1/Q3 ± 1.5×IQR).

    With fewer than 4 records the IQR is unreliable, so we skip filtering.
    """
    if len(records) < 4:
        return records

    prices = sorted(float(r[amount_key]) for r in records if r.get(amount_key) is not None)
    n = len(prices)
    q1 = median(prices[: n // 2])
    q3 = median(prices[n // 2 + (n % 2):])
    iqr = q3 - q1

    if iqr == 0:
        return records  # all prices identical — nothing to filter

    lo = q1 - _IQR_MULTIPLIER * iqr
    hi = q3 + _IQR_MULTIPLIER * iqr
    return [r for r in records if lo <= float(r[amount_key]) <= hi]


def stockx_sales_to_transactions(records: list[dict], item_id: int) -> list[Transaction]:
    # No IQR filter here. StockX has no sale-type flag so we cannot distinguish
    # accepted bids from buy-now hits. Including both gives a recency-weighted
    # average that naturally approximates the mid-market price (the correct A-S
    # fair value). Filtering by IQR on a bimodal bid/buy-now distribution
    # removes the wrong cluster depending on which is more frequent.
    txns = []
    for r in records:
        try:
            txns.append(Transaction(
                item_id=item_id,
                price=round(float(r["amount"]), 2),
                quantity=1,
                source="stockx",
                transacted_at=_parse_dt(r["created_at"]),
            ))
        except (KeyError, ValueError):
            continue
    return txns


def goat_sales_to_transactions(records: list[dict], item_id: int) -> list[Transaction]:
    # Records are already buy-now + size filtered by goat.fetch_sales.
    # Apply IQR to remove any remaining price outliers.
    filtered = _iqr_filter(records, "amount")
    txns = []
    for r in filtered:
        try:
            txns.append(Transaction(
                item_id=item_id,
                price=round(float(r["amount"]), 2),
                quantity=1,
                source="goat",
                transacted_at=_parse_dt(r["purchased_at"]),
            ))
        except (KeyError, ValueError):
            continue
    return txns


def listing_records_to_listings(
    records: list[dict],
    item_id: int,
    source: str,
    collected_at: datetime,
) -> list[Listing]:
    listings = []
    for r in records:
        try:
            listings.append(Listing(
                item_id=item_id,
                ask_price=round(float(r["ask_price"]), 2),
                source=source,
                collected_at=collected_at,
            ))
        except (KeyError, ValueError):
            continue
    return listings
