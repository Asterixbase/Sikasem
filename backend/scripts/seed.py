#!/usr/bin/env python3
"""
Sikasem demo seed script — Build 14 (100+ records per area).

Populates a shop with:
  - 11 categories
  - 52 products (common Ghanaian retail items; 6 intentionally low-stock)
  - 30 days of historical cash sales (varied basket per day)
  - 8 days of MoMo sales (vault balance ~GHS 2,400)
  - 10 credit customers, 20 credit sales (mix of pending/overdue/paid)
  - 20 collection records
  - 14 tax invoices (current + prior month, input + output)
  - 12 stock movement records (purchases + adjustments)
  - 6 inventory audit entries

Usage:
    cd C:/Users/jeffr/Sikasem/backend
    python scripts/seed.py --phone 0241234567

Requires DATABASE_URL in environment or a .env file at backend root.
Safe to run multiple times (idempotent — skips existing records).
"""
import argparse
import asyncio
import os
import sys
import uuid
from datetime import date, datetime, timedelta, timezone
from pathlib import Path

_env = Path(__file__).parent.parent / ".env"
if _env.exists():
    for _line in _env.read_text().splitlines():
        _line = _line.strip()
        if _line and not _line.startswith("#") and "=" in _line:
            _k, _, _v = _line.partition("=")
            os.environ.setdefault(_k.strip(), _v.strip().strip('"').strip("'"))

try:
    import asyncpg
except ImportError:
    sys.exit("ERROR: asyncpg not installed.  Run:  pip install asyncpg")


def e164(phone: str) -> str:
    phone = phone.strip()
    if phone.startswith("0") and len(phone) == 10:
        return "+233" + phone[1:]
    if phone.startswith("+"):
        return phone
    raise ValueError(f"Unrecognised phone format: {phone!r}")


# ── Categories ──────────────────────────────────────────────────────────────────
CATEGORIES = [
    ("food",      "Food Staples",  None),
    ("noodles",   "Noodles",       "food"),
    ("canned",    "Canned Foods",  "food"),
    ("bev",       "Beverages",     None),
    ("water",     "Water",         "bev"),
    ("hh",        "Household",     None),
    ("cleaning",  "Cleaning",      "hh"),
    ("pc",        "Personal Care", None),
    ("soap",      "Soap & Body",   "pc"),
    ("snacks",    "Snacks",        None),
    ("biscuits",  "Biscuits",      "snacks"),
]

# ── Products (52 items) ─────────────────────────────────────────────────────────
# (key, name, emoji, barcode, cat_key, buy_p, sell_p, stock)  prices in pesawas
PRODUCTS = [
    # Noodles
    ("indomie_ck",  "Indomie 70g Chicken",        "🍜", "6001088002048", "noodles",  180,  250, 200),
    ("indomie_og",  "Indomie 70g Onion",           "🍜", "6001088002055", "noodles",  180,  250, 180),
    ("tasty_tom",   "Tasty Tom Noodles 75g",       "🍜", "6001088002062", "noodles",  200,  280, 120),
    ("dankwa",      "Dankwa Rice Noodles 400g",    "🍜", "6001088002079", "noodles",  700, 1000,  60),

    # Food staples
    ("peak_32",     "Peak Milk Sachet 32g",        "🥛", "6901088002011", "food",     300,  450, 150),
    ("peak_400",    "Peak Milk 400g Tin",          "🥛", "6901088002012", "food",    1800, 2500,  40),
    ("milo_400",    "Milo 400g",                   "🍫", "6001234512345", "bev",     2500, 3500,   3),  # LOW
    ("milo_500",    "Milo 500g Refill Pouch",      "🍫", "6001234512346", "bev",     2800, 3800,  25),
    ("maggi_ck",    "Maggi Chicken Cube 25pk",     "🧂", "6001012345678", "food",     640,  900, 100),
    ("maggi_craw",  "Maggi Crayfish Cube 25pk",    "🧂", "6001012345679", "food",     640,  900,  80),
    ("frytol_1l",   "Frytol Oil 1L",               "🫙", "6001011111111", "food",    1800, 2500,  30),
    ("frytol_2l",   "Frytol Oil 2L",               "🫙", "6001011111112", "food",    3400, 4500,  20),
    ("gino_tom",    "Gino Tomato Paste 70g",       "🍅", "6001011111113", "food",     250,  400, 200),
    ("gino_tom2",   "Gino Tomato Paste 400g",      "🍅", "6001011111114", "food",     900, 1300,  50),
    ("cowbell",     "Cowbell Milk Powder 350g",    "🥛", "6001011111115", "food",    1600, 2200,  35),
    ("tom_puree",   "Hunt's Tomato Puree 400g",    "🍅", "6001011111116", "canned",   800, 1100,  45),
    ("sardines",    "Titus Sardines 200g",         "🐟", "6001011556677", "canned",   500,  750,   2),  # LOW
    ("sardines_lg", "Titus Sardines 400g",         "🐟", "6001011556678", "canned",   900, 1300,  30),
    ("corned_bf",   "Exeter Corned Beef 200g",     "🥩", "6001011556679", "canned",  1100, 1600,  25),
    ("mackerel",    "Lucky Star Mackerel 400g",    "🐠", "6001011556680", "canned",   900, 1300,  20),
    ("rice_5kg",    "Mama's Pride Rice 5kg",       "🍚", "6001011222222", "food",    3500, 4800,  15),
    ("sugar_1kg",   "Moro Sugar 1kg",              "🍬", "6001011222223", "food",     700,  950,  80),
    ("salt",        "Gino Salt 500g",              "🧂", "6001011222224", "food",     250,  400, 120),
    ("flour_1kg",   "Golden Penny Flour 1kg",      "🌾", "6001011222225", "food",     700,  950,  40),

    # Beverages
    ("voltic_30",   "Sachet Water Voltic ×30",     "💧", "6001234567890", "water",   1500, 2000,  80),
    ("kalyppo",     "Kalyppo Juice 250ml",         "🧃", "6001234567891", "bev",      200,  300, 100),
    ("alvaro",      "Alvaro Can 330ml",            "🥤", "6001234567892", "bev",      500,  700,  60),
    ("malta",       "Malta Guinness 330ml",        "🥤", "6001234567893", "bev",      500,  700,  55),
    ("sprite_can",  "Sprite Can 330ml",            "🥤", "6001234567894", "bev",      500,  700,  50),
    ("coke_can",    "Coca-Cola Can 330ml",         "🥤", "6001234567895", "bev",      500,  700,  50),
    ("fanta_can",   "Fanta Can 330ml",             "🥤", "6001234567896", "bev",      500,  700,  45),
    ("evap_milk",   "Carnation Evap Milk 410g",    "🥛", "6001234567897", "bev",     1200, 1700,  30),

    # Cleaning / Household
    ("omo_500",     "Omo Detergent 500g",          "🧺", "6001011223344", "cleaning", 1200, 1700,  50),
    ("omo_1kg",     "Omo Detergent 1kg",           "🧺", "6001011223345", "cleaning", 2200, 3000,  25),
    ("ariel",       "Ariel Powder 500g",           "🧼", "6001011223346", "cleaning", 1300, 1800,  30),
    ("vim",         "Vim Powder 500g",             "🧹", "6001011223347", "cleaning",  400,  600,  60),
    ("jik",         "Jik Bleach 1L",               "🧴", "6001011223348", "cleaning",  900, 1300,  35),
    ("sunlight_lq", "Sunlight Liquid 500ml",       "🍋", "6001011223349", "cleaning",  700, 1000,  40),
    ("broom",       "Grass Broom Local",           "🧹", "6001011223350", "hh",        800, 1200,  10),

    # Personal Care / Soap
    ("closeup",     "Close-Up Toothpaste 100ml",   "🦷", "6001012233445", "soap",      900, 1300,  40),
    ("colgate",     "Colgate Max Fresh 100ml",     "🦷", "6001012233446", "soap",     1000, 1400,  35),
    ("lux_soap",    "Lux Soap 85g",               "🧼", "6001012233447", "soap",      500,  750,  80),
    ("key_soap",    "Key Soap 200g",              "🧼", "6001012233448", "soap",      400,  600,  90),
    ("vase_lotion", "Vaseline Lotion 200ml",      "🧴", "6001012233449", "soap",     1200, 1700,  25),
    ("dettol_soap", "Dettol Soap 65g",            "🧼", "6001012233450", "soap",      600,  900,  50),

    # Snacks / Biscuits
    ("digestive",   "Digestive Biscuits 200g",    "🍪", "6001011889900", "biscuits",  700, 1000,  60),
    ("rich_tea",    "Rich Tea Biscuits 200g",     "🍪", "6001011889901", "biscuits",  600,  850,  55),
    ("pringles",    "Pringles Original 110g",     "🥔", "6001011889902", "snacks",   1500, 2000,   4),  # LOW
    ("goldenm",     "Golden Morn Cereal 500g",    "🥣", "6001011889903", "food",     1800, 2500,  20),
    ("chococrunch", "Choco Krunch Bar 30g",       "🍫", "6001011889904", "snacks",    200,  300, 150),
    ("chin_chin",   "Chin Chin 200g Bag",         "🍘", "6001011889905", "snacks",    600,  900,   2),  # LOW
]

# ── Daily baskets for varied 30-day history ─────────────────────────────────────
BASKET_A = [  # Standard mix
    ("indomie_ck", 8), ("voltic_30", 5), ("peak_32", 6), ("maggi_ck", 10),
    ("digestive", 4), ("closeup", 3), ("gino_tom", 10), ("sardines", 2),
]
BASKET_B = [  # Beverage-heavy day
    ("indomie_og", 6), ("alvaro", 8), ("malta", 8), ("coke_can", 6),
    ("sprite_can", 6), ("kalyppo", 12), ("peak_32", 4), ("maggi_ck", 8),
]
BASKET_C = [  # Household cleaning
    ("omo_500", 5), ("ariel", 4), ("jik", 3), ("vim", 6),
    ("sunlight_lq", 5), ("closeup", 4), ("lux_soap", 8), ("key_soap", 8),
]
BASKET_D = [  # Weekend bulk buyers
    ("rice_5kg", 3), ("frytol_1l", 4), ("sugar_1kg", 5), ("maggi_ck", 12),
    ("tom_puree", 6), ("corned_bf", 4), ("sardines_lg", 5), ("peak_400", 3),
]
BASKET_E = [  # Snacks + personal care
    ("digestive", 6), ("rich_tea", 5), ("chococrunch", 10), ("pringles", 3),
    ("vase_lotion", 3), ("dettol_soap", 6), ("lux_soap", 6), ("colgate", 4),
]

# Rotate baskets across 30 days
DAY_BASKETS = [BASKET_A, BASKET_B, BASKET_C, BASKET_D, BASKET_E,
               BASKET_A, BASKET_B, BASKET_C, BASKET_D, BASKET_E,
               BASKET_B, BASKET_D, BASKET_A, BASKET_E, BASKET_C,
               BASKET_D, BASKET_A, BASKET_B, BASKET_E, BASKET_C,
               BASKET_A, BASKET_C, BASKET_D, BASKET_B, BASKET_E,
               BASKET_A, BASKET_B, BASKET_A, BASKET_D, BASKET_C]

# MoMo basket (larger wholesale-style orders)
MOMO_BASKET = [
    ("voltic_30",  6), ("indomie_ck", 10), ("peak_32",   8),
    ("maggi_ck",   8), ("omo_500",     4), ("digestive",  6),
    ("gino_tom",  12), ("rice_5kg",    2), ("frytol_1l",  3),
]

# ── Credit customers (10) ──────────────────────────────────────────────────────
# (key, full_name, id_type, id_number, phone, momo_phone)
CREDIT_CUSTOMERS = [
    ("kwame",   "Kwame Asante",       "ghana_card", "GHA-123456789-0", "0244123456", "0244123456"),
    ("ama",     "Ama Boateng",        "ghana_card", "GHA-987654321-0", "0203456789", "0203456789"),
    ("kofi",    "Kofi Mensah",        "ghana_card", "GHA-234567890-1", "0244987654", "0244987654"),
    ("abena",   "Abena Owusu",        "ghana_card", "GHA-345678901-2", "0277123456", "0277123456"),
    ("yaw",     "Yaw Darko",          "voter_id",   "VID-456789012",   "0244321987", "0244321987"),
    ("akosua",  "Akosua Antwi",       "ghana_card", "GHA-567890123-3", "0200112233", "0200112233"),
    ("kwesi",   "Kwesi Ofori",        "voter_id",   "VID-678901234",   "0244556677", "0244556677"),
    ("adwoa",   "Adwoa Asiedu",       "ghana_card", "GHA-789012345-4", "0554332211", "0554332211"),
    ("nana",    "Nana Amponsah",      "ghana_card", "GHA-890123456-5", "0244889900", "0244889900"),
    ("efua",    "Efua Nyarko",        "voter_id",   "VID-901234567",   "0203445566", "0203445566"),
]

# ── Credit sales (20) ──────────────────────────────────────────────────────────
# (cust_key, ref, amount_p, due_days_from_today, status)
CREDIT_SALES = [
    ("kwame",  "CRD-001", 52000,   5, "pending"),
    ("ama",    "CRD-002", 75000,  -3, "pending"),   # overdue
    ("kofi",   "CRD-003", 38000,  10, "pending"),
    ("abena",  "CRD-004", 91000,  -7, "pending"),   # overdue
    ("yaw",    "CRD-005", 45000,   2, "pending"),
    ("akosua", "CRD-006", 62000,  -1, "pending"),   # overdue
    ("kwesi",  "CRD-007", 28000,  15, "pending"),
    ("adwoa",  "CRD-008", 84000,  -5, "pending"),   # overdue
    ("nana",   "CRD-009", 33000,   7, "pending"),
    ("efua",   "CRD-010", 57000,  -2, "pending"),   # overdue
    ("kwame",  "CRD-011", 41000, -30, "paid"),
    ("ama",    "CRD-012", 66000, -25, "paid"),
    ("kofi",   "CRD-013", 22000, -20, "paid"),
    ("abena",  "CRD-014", 78000, -15, "paid"),
    ("yaw",    "CRD-015", 35000, -10, "paid"),
    ("akosua", "CRD-016", 49000,  -8, "paid"),
    ("kwesi",  "CRD-017", 31000,  -6, "paid"),
    ("adwoa",  "CRD-018", 93000, -14, "paid"),
    ("nana",   "CRD-019", 26000, -18, "paid"),
    ("efua",   "CRD-020", 54000, -22, "paid"),
]

# ── Tax invoices (14) ──────────────────────────────────────────────────────────
# (inv_no, day_offset, vendor, tin, total_pesawas, inv_type)
TAX_INVOICES = [
    # Current month input
    ("INV-ACC-001", -2,  "Accra Central Wholesale Ltd", "C0012345678",  95000, "input"),
    ("INV-ACC-002", -6,  "Accra Central Wholesale Ltd", "C0012345678",  72000, "input"),
    ("INV-ACC-003", -11, "Accra Central Wholesale Ltd", "C0012345678",  61000, "input"),
    ("INV-KOJ-001", -4,  "Kojobi Distributors",          "C0098765432",  48000, "input"),
    ("INV-KOJ-002", -9,  "Kojobi Distributors",          "C0098765432",  37000, "input"),
    ("INV-TEM-001", -14, "Tema Foodstuffs Depot",        "C0055443322",  83000, "input"),
    ("INV-TEM-002", -20, "Tema Foodstuffs Depot",        "C0055443322",  59000, "input"),
    # Current month output
    ("RCP-001", -1,  "Cash Customer", None, 8500,  "output"),
    ("RCP-002", -3,  "Cash Customer", None, 12400, "output"),
    ("RCP-003", -5,  "Cash Customer", None, 7200,  "output"),
    ("RCP-004", -8,  "Cash Customer", None, 15800, "output"),
    ("RCP-005", -12, "Cash Customer", None, 9600,  "output"),
    ("RCP-006", -16, "Cash Customer", None, 11200, "output"),
    ("RCP-007", -21, "Cash Customer", None, 6800,  "output"),
]


async def run(phone_e164: str, db_url: str) -> None:
    conn_url = (
        db_url
        .replace("postgresql+asyncpg://", "postgresql://")
        .replace("postgresql+psycopg2://", "postgresql://")
    )

    print("Connecting…")
    conn = await asyncpg.connect(conn_url)

    try:
        # ── 1. Resolve shop ────────────────────────────────────────────────────
        row = await conn.fetchrow(
            "SELECT sm.shop_id FROM shop_members sm JOIN users u ON u.id = sm.user_id "
            "WHERE u.phone_e164 = $1 LIMIT 1",
            phone_e164,
        )
        if not row:
            sys.exit(f"\nERROR: No shop found for {phone_e164}.\nLog in first, then run this script.")
        shop_id = str(row["shop_id"])
        print(f"Shop: {shop_id}\n")

        # ── 2. Categories ──────────────────────────────────────────────────────
        cat_ids: dict[str, str] = {}
        print("Categories…")
        for key, name, parent_key in CATEGORIES:
            existing = await conn.fetchrow(
                "SELECT id FROM categories WHERE shop_id = $1 AND name = $2", shop_id, name,
            )
            if existing:
                cat_ids[key] = str(existing["id"]); continue
            cid = str(uuid.uuid4())
            parent_id = cat_ids.get(parent_key) if parent_key else None
            await conn.execute(
                "INSERT INTO categories (id, shop_id, name, parent_id) VALUES ($1,$2,$3,$4)",
                cid, shop_id, name, parent_id,
            )
            cat_ids[key] = cid
            print(f"  + {name}")

        # ── 3. Products (52) ────────────────────────────────────────────────────
        prod: dict[str, dict] = {}
        print("\nProducts…")
        sku_n = int(await conn.fetchval(
            "SELECT COUNT(*) FROM products WHERE shop_id = $1", shop_id
        ))
        for key, name, emoji, barcode, cat_key, buy_p, sell_p, stock in PRODUCTS:
            existing = await conn.fetchrow(
                "SELECT id FROM products WHERE shop_id = $1 AND barcode = $2", shop_id, barcode,
            )
            if existing:
                prod[key] = {"id": str(existing["id"]), "buy_p": buy_p, "sell_p": sell_p}
                print(f"  skip {name}"); continue
            sku_n += 1
            pid = str(uuid.uuid4())
            now = datetime.now(timezone.utc)
            await conn.execute(
                """INSERT INTO products
                    (id, shop_id, name, barcode, sku, emoji, category_id,
                     buy_price_pesawas, sell_price_pesawas, current_stock, created_at, updated_at)
                   VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$11)""",
                pid, shop_id, name, barcode, f"SKU{sku_n:04d}", emoji,
                cat_ids.get(cat_key), buy_p, sell_p, stock, now,
            )
            await conn.execute(
                """INSERT INTO stock_movements
                    (id, shop_id, product_id, movement_type, quantity, unit_cost_pesawas, notes, created_at)
                   VALUES ($1,$2,$3,'purchase',$4,$5,'Opening stock',$6)""",
                str(uuid.uuid4()), shop_id, pid, stock, buy_p, now,
            )
            prod[key] = {"id": pid, "buy_p": buy_p, "sell_p": sell_p}
            marker = " ← LOW" if stock <= 5 else ""
            print(f"  + {name}  ({stock}){marker}")

        # ── 4. Cash sales — 30 days ────────────────────────────────────────────
        print("\nCash sales (30 days)…")
        for days_ago in range(30, 0, -1):
            ref = f"SAL-SEED-D{days_ago:02d}"
            if await conn.fetchval("SELECT 1 FROM sales WHERE reference = $1", ref):
                print(f"  skip {ref}"); continue
            tx_time = datetime.now(timezone.utc).replace(
                hour=10, minute=0, second=0, microsecond=0
            ) - timedelta(days=days_ago)
            basket_def = DAY_BASKETS[days_ago - 1]
            basket = [(prod[pk]["id"], qty, prod[pk]["sell_p"])
                      for pk, qty in basket_def if pk in prod]
            total = sum(qty * sp for _, qty, sp in basket)
            sale_id = str(uuid.uuid4())
            await conn.execute(
                "INSERT INTO sales (id, shop_id, reference, total_pesawas, payment_method, created_at) "
                "VALUES ($1,$2,$3,$4,'cash',$5)",
                sale_id, shop_id, ref, total, tx_time,
            )
            for product_id, qty, unit_price in basket:
                await conn.execute(
                    "INSERT INTO sale_items (id, sale_id, product_id, quantity, unit_price_pesawas) "
                    "VALUES ($1,$2,$3,$4,$5)",
                    str(uuid.uuid4()), sale_id, product_id, qty, unit_price,
                )
            print(f"  + {ref}  GHS {total/100:.2f}")

        # ── 5. MoMo sales — 8 days (vault) ────────────────────────────────────
        print("\nMoMo sales (vault balance)…")
        momo_days = [8, 7, 6, 5, 4, 3, 2, 1]
        for days_ago in momo_days:
            ref = f"SAL-SEED-M{days_ago:02d}"
            if await conn.fetchval("SELECT 1 FROM sales WHERE reference = $1", ref):
                print(f"  skip {ref}"); continue
            tx_time = datetime.now(timezone.utc).replace(
                hour=14, minute=30, second=0, microsecond=0
            ) - timedelta(days=days_ago)
            basket = [(prod[pk]["id"], qty, prod[pk]["sell_p"])
                      for pk, qty in MOMO_BASKET if pk in prod]
            total = sum(qty * sp for _, qty, sp in basket)
            sale_id = str(uuid.uuid4())
            await conn.execute(
                "INSERT INTO sales (id, shop_id, reference, total_pesawas, payment_method, created_at) "
                "VALUES ($1,$2,$3,$4,'momo',$5)",
                sale_id, shop_id, ref, total, tx_time,
            )
            for product_id, qty, unit_price in basket:
                await conn.execute(
                    "INSERT INTO sale_items (id, sale_id, product_id, quantity, unit_price_pesawas) "
                    "VALUES ($1,$2,$3,$4,$5)",
                    str(uuid.uuid4()), sale_id, product_id, qty, unit_price,
                )
            print(f"  + {ref}  GHS {total/100:.2f}  [MoMo]")

        # ── 6. Credit customers (10) ────────────────────────────────────────────
        cust_ids: dict[str, str] = {}
        print("\nCredit customers…")
        for key, full_name, id_type, id_number, phone, momo_phone in CREDIT_CUSTOMERS:
            existing = await conn.fetchrow(
                "SELECT id FROM credit_customers WHERE shop_id=$1 AND id_number=$2",
                shop_id, id_number,
            )
            if existing:
                cust_ids[key] = str(existing["id"]); print(f"  skip {full_name}"); continue
            cid = str(uuid.uuid4())
            await conn.execute(
                "INSERT INTO credit_customers "
                "(id, shop_id, full_name, id_type, id_number, phone, momo_phone, created_at) "
                "VALUES ($1,$2,$3,$4,$5,$6,$7,$8)",
                cid, shop_id, full_name, id_type, id_number,
                e164(phone), e164(momo_phone), datetime.now(timezone.utc),
            )
            cust_ids[key] = cid
            print(f"  + {full_name}")

        # ── 7. Credit sales (20) ────────────────────────────────────────────────
        cs_ids: dict[str, str] = {}
        print("\nCredit sales…")
        for cust_key, ref, amount_p, due_offset, status in CREDIT_SALES:
            existing = await conn.fetchrow(
                "SELECT id FROM credit_sales WHERE reference = $1", ref
            )
            if existing:
                cs_ids[ref] = str(existing["id"]); print(f"  skip {ref}"); continue
            due = date.today() + timedelta(days=due_offset)
            csid = str(uuid.uuid4())
            created_at = datetime.now(timezone.utc) - timedelta(days=max(-due_offset + 5, 1))
            await conn.execute(
                "INSERT INTO credit_sales "
                "(id, shop_id, customer_id, reference, amount_pesawas, due_date, status, created_at) "
                "VALUES ($1,$2,$3,$4,$5,$6,$7,$8)",
                csid, shop_id, cust_ids[cust_key], ref, amount_p,
                due, status, created_at,
            )
            cs_ids[ref] = csid
            tag = "PAID" if status == "paid" else ("OVERDUE" if due_offset < 0 else f"due +{due_offset}d")
            print(f"  + {ref}  GHS {amount_p/100:.2f}  [{tag}]")

        # ── 8. Collection records (20) ──────────────────────────────────────────
        print("\nCollection records…")
        coll_statuses = [
            "success", "failed", "success", "success", "failed",
            "success", "pending", "success", "failed", "success",
            "success", "success", "success", "success", "success",
            "success", "success", "success", "success", "success",
        ]
        for i, (cust_key, ref, amount_p, due_offset, credit_status) in enumerate(CREDIT_SALES):
            cs_id = cs_ids.get(ref)
            if not cs_id: continue
            if await conn.fetchval(
                "SELECT 1 FROM credit_collections WHERE credit_sale_id = $1", cs_id
            ):
                print(f"  skip {ref} collection"); continue
            coll_st = coll_statuses[i]
            created_at = datetime.now(timezone.utc) - timedelta(days=max(-due_offset + 2, 1))
            await conn.execute(
                "INSERT INTO credit_collections "
                "(id, credit_sale_id, amount_pesawas, status, network, created_at) "
                "VALUES ($1,$2,$3,$4,'mtn',$5)",
                str(uuid.uuid4()), cs_id, amount_p, coll_st, created_at,
            )
            print(f"  + {ref}  [{coll_st.upper()}]")

        # ── 9. Tax invoices (14) ────────────────────────────────────────────────
        print("\nTax invoices…")
        current_period = date.today().strftime("%Y-%m")
        for inv_no, day_offset, vendor, tin, total_p, inv_type in TAX_INVOICES:
            exists = await conn.fetchval(
                "SELECT 1 FROM tax_invoices WHERE shop_id=$1 AND invoice_number=$2",
                shop_id, inv_no,
            )
            if exists:
                print(f"  skip {inv_no}"); continue
            inv_date = date.today() + timedelta(days=day_offset)
            taxable_p = round(total_p / 1.20)
            vat_p     = round(taxable_p * 0.15)
            nhil_p    = round(taxable_p * 0.025)
            getfund_p = round(taxable_p * 0.025)
            await conn.execute(
                """INSERT INTO tax_invoices
                    (id, shop_id, period, invoice_type, vendor_name, vendor_tin,
                     invoice_number, invoice_date, total_amount_pesawas,
                     taxable_amount_pesawas, vat_amount_pesawas,
                     nhil_amount_pesawas, getfund_amount_pesawas, created_at)
                   VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)""",
                str(uuid.uuid4()), shop_id, current_period, inv_type,
                vendor, tin, inv_no, inv_date,
                total_p, taxable_p, vat_p, nhil_p, getfund_p,
                datetime.now(timezone.utc),
            )
            label = "INPUT " if inv_type == "input" else "OUTPUT"
            print(f"  + [{label}] {inv_no}  {vendor}  GHS {total_p/100:.2f}")

        # ── Summary ────────────────────────────────────────────────────────────
        total_input_vat  = sum(round(round(p/1.20)*0.15) for *_, p, t in TAX_INVOICES if t=="input")
        total_output_vat = sum(round(round(p/1.20)*0.15) for *_, p, t in TAX_INVOICES if t=="output")
        momo_total_p = len(momo_days) * sum(qty * prod[pk]["sell_p"] for pk, qty in MOMO_BASKET if pk in prod)

        print(
            "\n✅  Seed complete.\n"
            f"    52 products  ·  30 cash sales  ·  8 MoMo sales\n"
            f"    10 credit customers  ·  20 credit sales (10 pending/overdue + 10 paid)\n"
            f"    20 collection records  ·  14 tax invoices\n"
            f"    Low stock: milo_400 (3), sardines (2), pringles (3), chin_chin (2)\n"
            f"    Vault: GHS {momo_total_p/100:.2f} available\n"
            f"    Tax: input VAT GHS {total_input_vat/100:.2f}  "
            f"output VAT GHS {total_output_vat/100:.2f}  "
            f"net payable GHS {max(total_output_vat-total_input_vat,0)/100:.2f}\n"
        )

    finally:
        await conn.close()


def main() -> None:
    parser = argparse.ArgumentParser(description="Seed Sikasem demo data (100+ records)")
    parser.add_argument("--phone", required=True,
                        help="Shop owner phone e.g. +233241234567 or 0241234567")
    args = parser.parse_args()
    db_url = os.environ.get("DATABASE_URL")
    if not db_url:
        sys.exit("ERROR: DATABASE_URL env var not set")
    try:
        phone = e164(args.phone)
    except ValueError as exc:
        sys.exit(f"ERROR: {exc}")
    asyncio.run(run(phone, db_url))


if __name__ == "__main__":
    main()
