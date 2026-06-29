"""
25 items across 5 categories with 15-35 transactions each (600+ total)
and 3 current listings per item. Designed to showcase different market conditions:
  - Stable / low-volatility (Nike AF1, Stüssy 8-Ball, Carhartt Watch Hat)
  - Trending up / hype (AJ1 Chicago, Chrome Hearts, Travis Scott AJ1)
  - Trending down / saturated (NB 550, Essentials Hoodie, Balenciaga Triple S)
  - High volatility (SB Dunk Ishod, Supreme x TNF Nuptse)
  - Illiquid / sparse (Nike Air Mag, Polo Bear 1992)
  - Ultra-premium (Rolex Submariner)
  - Low-price edge case (Carhartt Watch Hat ~$32)
"""

from datetime import datetime, timedelta

from app.db.session import SessionLocal
from app.schemas import Item, Transaction, Listing

_SOURCES = ["stockx", "goat", "ebay"]


def _txns(item_id: int, prices: list[float], start_offset_days: int,
           interval_hours: int, now: datetime) -> list[Transaction]:
    """Build Transaction objects from a price series."""
    out: list[Transaction] = []
    for i, price in enumerate(prices):
        out.append(Transaction(
            item_id=item_id,
            price=round(price, 2),
            quantity=1,
            source=_SOURCES[i % 3],
            transacted_at=now - timedelta(days=start_offset_days) + timedelta(hours=i * interval_hours),
        ))
    return out


def _listings(item_id: int, asks: list[float], now: datetime) -> list[Listing]:
    """Build 3 Listing objects (one per source) from ask prices."""
    return [
        Listing(item_id=item_id, ask_price=round(asks[i], 2),
                source=_SOURCES[i], collected_at=now)
        for i in range(3)
    ]

def seed_items_only() -> None:
    """Create Item records without transactions or listings.

    Used when the KicksDB pipeline will supply real transaction data.
    No-op if items already exist.
    """
    db = SessionLocal()
    try:
        if db.query(Item).filter_by(sku="DD1391-100").first() is not None:
            return
        for entry in _build_catalog():
            db.add(Item(
                sku=entry["sku"],
                name=entry["name"],
                brand=entry["brand"],
                category=entry["category"],
                size=entry["size"],
            ))
        db.commit()
        print("Item catalog seeded.")
    finally:
        db.close()


def seed_database() -> None:
    db = SessionLocal()
    try:
        existing_item = db.query(Item).filter_by(sku="DD1391-100").first()
        if existing_item is not None:
            print("Seed data already exists.")
            return

        now = datetime.now()
        catalog = _build_catalog()

        for entry in catalog:
            item = Item(
                sku=entry["sku"],
                name=entry["name"],
                brand=entry["brand"],
                category=entry["category"],
                size=entry["size"],
            )
            db.add(item)
            db.flush()

            transactions = _txns(
                item_id=item.id,
                prices=entry["prices"],
                start_offset_days=entry["history_days"],
                interval_hours=entry["interval_hours"],
                now=now,
            )
            listings = _listings(item_id=item.id, asks=entry["asks"], now=now)

            db.add_all(transactions)
            db.add_all(listings)

        db.commit()
        print("Seed data inserted successfully.")
    finally:
        db.close()


def seed_missing_transactions() -> None:
    """Backfill seed transactions for any items that have 0 transactions.

    Safe to call on every startup: no-op if all items already have data.
    This repairs the state caused by seed_items_only() running before
    seed_database(), leaving items without transaction history.
    """
    from sqlalchemy import func
    db = SessionLocal()
    try:
        catalog = _build_catalog()
        catalog_map = {entry["sku"]: entry for entry in catalog}

        items_no_tx = (
            db.query(Item)
            .outerjoin(Transaction, Transaction.item_id == Item.id)
            .group_by(Item.id)
            .having(func.count(Transaction.id) == 0)
            .all()
        )

        if not items_no_tx:
            return

        now = datetime.now()
        repaired = 0
        for item in items_no_tx:
            entry = catalog_map.get(item.sku)
            if entry and entry.get("prices"):
                txns = _txns(item.id, entry["prices"],
                             entry["history_days"], entry["interval_hours"], now)
                db.add_all(txns)
                repaired += 1

        if repaired:
            db.commit()
            print(f"Backfilled seed transactions for {repaired} items.")
    finally:
        db.close()


# CATALOG

def _build_catalog() -> list[dict]:
    return [
        
        # 1 — Stable / slight decline  (mass-produced GR, narrow spread)
        {
            "sku": "DD1391-100",
            "name": "Nike Dunk Low Panda",
            "brand": "Nike",
            "category": "Sneakers",
            "size": "10",
            "history_days": 30,
            "interval_hours": 16,
            "prices": [
                138, 135, 137, 132, 130, 128, 131, 129, 126, 125,
                127, 124, 122, 120, 123, 119, 121, 118, 117, 120,
                116, 118, 115, 114, 116, 113, 112, 115, 111, 113,
            ],
            "asks": [116, 119, 114],
        },

        # 2 — Trending UP  (hype release, scarcity premium building)
        {
            "sku": "DZ5485-612",
            "name": "Air Jordan 1 Retro High OG Chicago",
            "brand": "Nike",
            "category": "Sneakers",
            "size": "10",
            "history_days": 35,
            "interval_hours": 14,
            "prices": [
                320, 325, 330, 328, 340, 345, 350, 355, 360, 358,
                365, 370, 375, 380, 378, 385, 390, 395, 400, 398,
                405, 410, 415, 412, 420, 425, 430, 428, 435, 440,
                445, 442, 450, 455, 460,
            ],
            "asks": [468, 472, 465],
        },

        # 3 — Declining  (hype fading, restocks killing premium)
        {
            "sku": "BB550WT1",
            "name": "New Balance 550 White Green",
            "brand": "New Balance",
            "category": "Sneakers",
            "size": "10",
            "history_days": 40,
            "interval_hours": 20,
            "prices": [
                175, 172, 168, 170, 165, 160, 162, 158, 155, 152,
                150, 148, 145, 147, 142, 140, 138, 135, 137, 132,
                130, 128, 125, 127, 122, 120, 118, 115, 117, 114,
            ],
            "asks": [118, 121, 116],
        },

        # 4 — Ultra-stable  (huge supply, barely above retail)
        {
            "sku": "CW2288-111",
            "name": "Nike Air Force 1 Low White",
            "brand": "Nike",
            "category": "Sneakers",
            "size": "10.5",
            "history_days": 25,
            "interval_hours": 12,
            "prices": [
                118, 117, 119, 116, 118, 117, 115, 118, 116, 117,
                119, 116, 115, 118, 117, 116, 119, 118, 117, 116,
                115, 118, 117, 116, 119, 118, 116, 117, 115, 118,
            ],
            "asks": [120, 122, 119],
        },

        # 5 — Moderate uptrend  (cultural moment)
        {
            "sku": "B75806",
            "name": "Adidas Samba OG White Black",
            "brand": "Adidas",
            "category": "Sneakers",
            "size": "9.5",
            "history_days": 38,
            "interval_hours": 22,
            "prices": [
                140, 142, 145, 143, 148, 150, 147, 152, 155, 153,
                158, 160, 157, 162, 165, 163, 168, 170, 167, 172,
                175, 173, 178, 180, 177,
            ],
            "asks": [183, 186, 181],
        },

        # 6 — High volatility  (collector-driven, erratic)
        {
            "sku": "BQ6817-010",
            "name": "Nike SB Dunk Low Ishod Wair",
            "brand": "Nike",
            "category": "Sneakers",
            "size": "10",
            "history_days": 35,
            "interval_hours": 18,
            "prices": [
                185, 195, 178, 210, 190, 225, 200, 180, 215, 195,
                230, 185, 220, 205, 175, 240, 195, 210, 188, 235,
                200, 178, 225, 215, 190, 245, 205, 185, 230, 210,
            ],
            "asks": [235, 242, 228],
        },

        # 7 — Archive runner revival, moderate uptrend
        {
            "sku": "1201A019-108",
            "name": "ASICS Gel-Kayano 14 Silver White",
            "brand": "ASICS",
            "category": "Sneakers",
            "size": "10",
            "history_days": 32,
            "interval_hours": 24,
            "prices": [
                185, 188, 192, 190, 195, 198, 200, 203, 205, 202,
                208, 210, 215, 212, 218, 220, 225, 222, 228, 230,
            ],
            "asks": [235, 238, 232],
        },

        # 8 — Legendary collab, consistently high, slow appreciation
        {
            "sku": "CD4487-100",
            "name": "Travis Scott x Air Jordan 1 High Mocha",
            "brand": "Nike",
            "category": "Sneakers",
            "size": "10",
            "history_days": 35,
            "interval_hours": 18,
            "prices": [
                1450, 1460, 1475, 1465, 1480, 1490, 1485, 1500, 1510, 1505,
                1520, 1530, 1525, 1540, 1550, 1545, 1560, 1570, 1565, 1580,
                1590, 1585, 1600, 1610, 1605, 1620, 1630, 1625, 1640, 1650,
            ],
            "asks": [1665, 1675, 1658],
        },

        # 9 — Post-Virgil premium, gradually declining
        {
            "sku": "AA3830-002",
            "name": "Off-White x Nike Air Presto Black",
            "brand": "Nike",
            "category": "Sneakers",
            "size": "11",
            "history_days": 38,
            "interval_hours": 22,
            "prices": [
                1200, 1190, 1195, 1180, 1170, 1175, 1160, 1150, 1155, 1140,
                1130, 1135, 1120, 1110, 1115, 1100, 1090, 1095, 1080, 1070,
                1075, 1060, 1050, 1055, 1040,
            ],
            "asks": [1055, 1062, 1048],
        },

        # 10 — Classic hype piece, high premium, steady uptrend
        {
            "sku": "SUP-BOGO-BLK-FW24",
            "name": "Supreme Box Logo Hoodie Black FW24",
            "brand": "Supreme",
            "category": "Streetwear",
            "size": "L",
            "history_days": 40,
            "interval_hours": 20,
            "prices": [
                520, 530, 525, 540, 535, 550, 545, 555, 548, 560,
                555, 570, 565, 575, 568, 580, 575, 590, 585, 595,
                588, 600, 595, 605, 598, 610, 605, 615, 608, 620,
            ],
            "asks": [628, 635, 625],
        },

        # 11 — Stable low-premium iconic basic
        {
            "sku": "STU-8BALL-BLK",
            "name": "Stüssy 8-Ball Pigment Dyed Tee Black",
            "brand": "Stüssy",
            "category": "Streetwear",
            "size": "M",
            "history_days": 40,
            "interval_hours": 30,
            "prices": [
                62, 60, 64, 61, 63, 60, 65, 62, 61, 64,
                60, 63, 62, 65, 61, 64, 63, 60, 62, 65,
            ],
            "asks": [67, 69, 66],
        },

        # 12 — Declining, too many drops, losing exclusivity
        {
            "sku": "FOG-ESS-HOD-OAT",
            "name": "Fear of God Essentials Hoodie Dark Oatmeal",
            "brand": "Fear of God",
            "category": "Streetwear",
            "size": "L",
            "history_days": 36,
            "interval_hours": 18,
            "prices": [
                145, 140, 142, 138, 135, 137, 132, 130, 128, 132,
                125, 122, 120, 124, 118, 115, 117, 112, 110, 108,
                112, 105, 103, 107, 100, 98, 102, 96, 95, 98,
            ],
            "asks": [102, 105, 99],
        },

        # 13 — Stable with occasional spikes (drop day surges)
        {
            "sku": "PAL-TRIFERG-WHT",
            "name": "Palace Tri-Ferg Tee White",
            "brand": "Palace",
            "category": "Streetwear",
            "size": "M",
            "history_days": 38,
            "interval_hours": 28,
            "prices": [
                72, 70, 75, 71, 73, 88, 74, 72, 70, 85,
                73, 71, 74, 72, 90, 73, 70, 72, 74, 71,
            ],
            "asks": [76, 79, 74],
        },

        # 14 — Moderate uptrend, growing brand cachet
        {
            "sku": "KITH-WIII-NOC",
            "name": "Kith Williams III Hoodie Nocturnal",
            "brand": "Kith",
            "category": "Streetwear",
            "size": "L",
            "history_days": 38,
            "interval_hours": 22,
            "prices": [
                210, 215, 218, 220, 225, 228, 230, 235, 232, 238,
                240, 245, 248, 250, 252, 255, 258, 260, 262, 265,
                268, 270, 272, 275, 278,
            ],
            "asks": [284, 288, 280],
        },

        # 15 — Extremely stable luxury, tight spread, slow appreciation
        {
            "sku": "LV-KEEP45-MONO",
            "name": "Louis Vuitton Keepall Bandoulière 45 Monogram",
            "brand": "Louis Vuitton",
            "category": "Luxury",
            "size": "OS",
            "history_days": 60,
            "interval_hours": 48,
            "prices": [
                1750, 1755, 1760, 1758, 1765, 1770, 1768, 1775, 1780, 1778,
                1785, 1790, 1788, 1795, 1800, 1798, 1805, 1810, 1808, 1815,
            ],
            "asks": [1825, 1832, 1820],
        },

        # 16 — Declining luxury, fashion cycle moving away
        {
            "sku": "GG-MARM-SM-BLK",
            "name": "Gucci GG Marmont Small Shoulder Bag Black",
            "brand": "Gucci",
            "category": "Luxury",
            "size": "OS",
            "history_days": 60,
            "interval_hours": 48,
            "prices": [
                2100, 2080, 2090, 2060, 2040, 2050, 2020, 2000, 2010, 1980,
                1960, 1970, 1940, 1920, 1935, 1900, 1885, 1900, 1870, 1860,
            ],
            "asks": [1880, 1895, 1875],
        },

        # 17 — Ultra-premium, strong uptrend, very low volatility
        {
            "sku": "ROLEX-SUB-126610LN",
            "name": "Rolex Submariner Date 41mm Black Dial",
            "brand": "Rolex",
            "category": "Luxury",
            "size": "41mm",
            "history_days": 90,
            "interval_hours": 72,
            "prices": [
                14500, 14550, 14600, 14580, 14650, 14700, 14680, 14750,
                14800, 14780, 14850, 14900, 14880, 14950, 15000, 14980,
                15050, 15100, 15080, 15150,
            ],
            "asks": [15200, 15250, 15180],
        },

        # 18 — Steep decline, trend moved on
        {
            "sku": "BAL-TRIPS-WHT",
            "name": "Balenciaga Triple S White",
            "brand": "Balenciaga",
            "category": "Luxury",
            "size": "42",
            "history_days": 32,
            "interval_hours": 16,
            "prices": [
                880, 860, 870, 840, 820, 835, 800, 785, 800, 770,
                755, 765, 740, 725, 740, 710, 700, 715, 690, 680,
                695, 670, 660, 675, 650, 640, 655, 630, 625, 640,
            ],
            "asks": [650, 660, 645],
        },

        # 19 — Strong uptrend, cult following, limited production
        {
            "sku": "CH-CROSS-925",
            "name": "Chrome Hearts .925 Silver Cross Pendant",
            "brand": "Chrome Hearts",
            "category": "Accessories",
            "size": "OS",
            "history_days": 48,
            "interval_hours": 28,
            "prices": [
                800, 815, 825, 840, 835, 855, 870, 865, 885, 900,
                895, 915, 930, 925, 945, 960, 955, 975, 990, 985,
                1005, 1020, 1015, 1035, 1050,
            ],
            "asks": [1068, 1075, 1060],
        },

        # 20 — High volatility, seasonal + collab hype
        {
            "sku": "SUP-TNF-NUP-YEL",
            "name": "Supreme x The North Face Nuptse Jacket Yellow",
            "brand": "Supreme",
            "category": "Accessories",
            "size": "L",
            "history_days": 42,
            "interval_hours": 24,
            "prices": [
                650, 700, 625, 720, 680, 750, 640, 710, 770, 660,
                730, 800, 690, 760, 680, 820, 710, 750, 670, 790,
                850, 720, 780, 860, 740,
            ],
            "asks": [795, 820, 780],
        },

        # 21 — Very low price, minimal spread opportunity
        {
            "sku": "CARH-WATCH-BLK",
            "name": "Carhartt WIP Acrylic Watch Hat Black",
            "brand": "Carhartt WIP",
            "category": "Accessories",
            "size": "OS",
            "history_days": 48,
            "interval_hours": 36,
            "prices": [
                32, 30, 33, 31, 30, 34, 32, 31, 30, 33,
                31, 32, 30, 34, 31, 33, 30, 32, 31, 34,
            ],
            "asks": [35, 37, 34],
        },

        # 22 — Moderate appreciation, collab collector piece
        {
            "sku": "BAPE-GSHOCK-6900",
            "name": "Casio G-Shock DW-6900 x A Bathing Ape",
            "brand": "BAPE",
            "category": "Accessories",
            "size": "OS",
            "history_days": 42,
            "interval_hours": 30,
            "prices": [
                280, 285, 290, 288, 295, 300, 298, 305, 310, 308,
                315, 320, 318, 325, 330, 328, 335, 340, 338, 345,
            ],
            "asks": [352, 358, 348],
        },

        # 23 — Ultra-premium grail, sparse transactions, wild swings
        {
            "sku": "NIKE-AIRMAG-2016",
            "name": "Nike Air Mag Back to the Future (2016)",
            "brand": "Nike",
            "category": "Vintage",
            "size": "10",
            "history_days": 120,
            "interval_hours": 168,
            "prices": [
                28000, 30000, 27500, 32000, 29000, 35000, 31000, 28500,
                33000, 30500, 36000, 32500, 29500, 34000, 31500,
            ],
            "asks": [35000, 37000, 34000],
        },

        # 24 — Illiquid vintage, very sparse, slow appreciation
        {
            "sku": "POLO-BEAR-92",
            "name": "Vintage Polo Ralph Lauren Bear Sweater 1992",
            "brand": "Ralph Lauren",
            "category": "Vintage",
            "size": "L",
            "history_days": 120,
            "interval_hours": 120,
            "prices": [
                450, 475, 460, 490, 480, 510, 500, 530, 520, 545,
                540, 560, 555, 575, 570,
            ],
            "asks": [590, 600, 585],
        },

        # 25 — Yeezy post-Adidas split, volatile with downward bias
        {
            "sku": "HP6928",
            "name": "Adidas Yeezy Boost 350 V2 Onyx",
            "brand": "Adidas",
            "category": "Sneakers",
            "size": "10",
            "history_days": 36,
            "interval_hours": 18,
            "prices": [
                310, 305, 315, 295, 300, 285, 305, 280, 290, 275,
                295, 270, 280, 265, 285, 260, 270, 255, 275, 250,
                260, 245, 265, 240, 250, 235, 255, 230, 240, 225,
            ],
            "asks": [238, 245, 232],
        },
    ]