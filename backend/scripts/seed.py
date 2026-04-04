#!/usr/bin/env python3
"""
Sikasem demo seed script.

Populates a shop with:
  - 5 categories (Food Staples, Beverages, Household, Personal Care, Snacks)
  - 10 products (common Ghanaian retail items, 2 intentionally low-stock)
  - 7 days of historical sales
  - 2 credit customers (1 pending-future, 1 overdue)
  - 2 collection records (1 success, 1 failed — for retry testing)

Usage:
    cd C:/Users/jeffr/Sikasem/backend
    python scripts/seed.py --phone 0241234567
    python scripts/seed.py --phone +233241234567

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

# ── Load .env ──────────────────────────────────────────────────────────────────
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


# ── Phone normaliser ───────────────────────────────────────────────────────────

def e164(phone: str) -> str:
    phone = phone.strip()
    if phone.startswith("0") and len(phone) == 10:
        return "+233" + phone[1:]
    if phone.startswith("+"):
        return phone
    raise ValueError(f"Unrecognised phone format: {phone!r}")


# ── Seed tables ────────────────────────────────────────────────────────────────

# (key, name, parent_key)
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

# (key, name, emoji, barcode, cat_key, buy_p, sell_p, stock)  — prices in pesawas
PRODUCTS = [
    ("indomie",   "Indomie 70g Chicken",       "🍜", "6001088002048", "noodles",  180,  250, 120),
    ("voltic",    "Sachet Water Voltic ×30",    "💧", "6001234567890", "water",   1500, 2000,  45),
    ("peak",      "Peak Milk Sachet 32g",       "🥛", "6901088002011", "food",     300,  450,  80),
    ("maggi",     "Maggi Chicken Cube 25pk",    "🧂", "6001012345678", "food",     640,  900,  60),
    ("frytol",    "Frytol Oil 1L",              "🫙", "6001011111111", "food",    1800, 2500,  12),
    ("milo",      "Milo 400g",                  "🍫", "6001234512345", "bev",     2500, 3500,   4),  # ← low stock
    ("omo",       "Omo Detergent 500g",          "🧺", "6001011223344", "cleaning",1200, 1700,  25),
    ("sardines",  "Titus Sardines 200g",         "🐟", "6001011556677", "canned",   500,  750,   2),  # ← low stock
    ("digestive", "Digestive Biscuits 200g",     "🍪", "6001011889900", "biscuits", 700, 1000,  40),
    ("closeup",   "Close-Up Toothpaste 100ml",   "🦷", "6001012233445", "soap",     900, 1300,  18),
]

# Daily basket for historical cash sales (product_key, qty)
DAILY_BASKET = [
    ("indomie",   5),
    ("voltic",    3),
    ("peak",      4),
    ("maggi",     6),
    ("digestive", 3),
    ("closeup",   2),
]

# Basket for MoMo-method sales (larger customers who pay mobile money)
MOMO_BASKET = [
    ("voltic",    4),
    ("indomie",   6),
    ("peak",      5),
    ("maggi",     5),
    ("omo",       1),
    ("digestive", 4),
]

# (key, full_name, id_type, id_number, phone, momo_phone)
CREDIT_CUSTOMERS = [
    ("kwame", "Kwame Asante",  "ghana_card", "GHA-123456789-0", "0244123456", "0244123456"),
    ("ama",   "Ama Boateng",   "ghana_card", "GHA-987654321-0", "0203456789", "0203456789"),
]


# ── Main ───────────────────────────────────────────────────────────────────────

async def run(phone_e164: str, db_url: str) -> None:
    # asyncpg uses plain postgresql:// (not postgresql+asyncpg://)
    conn_url = (
        db_url
        .replace("postgresql+asyncpg://", "postgresql://")
        .replace("postgresql+psycopg2://", "postgresql://")
    )

    print("Connecting…")
    conn = await asyncpg.connect(conn_url)

    try:
        # ── 1. Resolve shop ────────────────────────────────────────────────
        row = await conn.fetchrow(
            """
            SELECT sm.shop_id
            FROM   shop_members sm
            JOIN   users u ON u.id = sm.user_id
            WHERE  u.phone_e164 = $1
            LIMIT  1
            """,
            phone_e164,
        )
        if not row:
            sys.exit(
                f"\nERROR: No shop found for {phone_e164}.\n"
                "Open the app, log in once, then run this script."
            )
        shop_id = str(row["shop_id"])
        print(f"Shop: {shop_id}\n")

        # ── 2. Categories ──────────────────────────────────────────────────
        cat_ids: dict[str, str] = {}
        print("Categories…")
        for key, name, parent_key in CATEGORIES:
            existing = await conn.fetchrow(
                "SELECT id FROM categories WHERE shop_id = $1 AND name = $2",
                shop_id, name,
            )
            if existing:
                cat_ids[key] = str(existing["id"])
                continue
            cid = str(uuid.uuid4())
            parent_id = cat_ids.get(parent_key) if parent_key else None
            await conn.execute(
                "INSERT INTO categories (id, shop_id, name, parent_id) VALUES ($1,$2,$3,$4)",
                cid, shop_id, name, parent_id,
            )
            cat_ids[key] = cid
            print(f"  + {name}")

        # ── 3. Products ────────────────────────────────────────────────────
        prod: dict[str, dict] = {}  # key → {id, buy_p, sell_p}
        print("\nProducts…")
        sku_n = int(await conn.fetchval(
            "SELECT COUNT(*) FROM products WHERE shop_id = $1", shop_id
        ))
        for key, name, emoji, barcode, cat_key, buy_p, sell_p, stock in PRODUCTS:
            existing = await conn.fetchrow(
                "SELECT id FROM products WHERE shop_id = $1 AND barcode = $2",
                shop_id, barcode,
            )
            if existing:
                prod[key] = {"id": str(existing["id"]), "buy_p": buy_p, "sell_p": sell_p}
                print(f"  skip {name}")
                continue
            sku_n += 1
            pid = str(uuid.uuid4())
            now = datetime.now(timezone.utc)
            await conn.execute(
                """
                INSERT INTO products
                    (id, shop_id, name, barcode, sku, emoji, category_id,
                     buy_price_pesawas, sell_price_pesawas, current_stock,
                     created_at, updated_at)
                VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$11)
                """,
                pid, shop_id, name, barcode, f"SKU{sku_n:04d}", emoji,
                cat_ids.get(cat_key), buy_p, sell_p, stock, now,
            )
            await conn.execute(
                """
                INSERT INTO stock_movements
                    (id, shop_id, product_id, movement_type, quantity,
                     unit_cost_pesawas, notes, created_at)
                VALUES ($1,$2,$3,'purchase',$4,$5,'Opening stock',$6)
                """,
                str(uuid.uuid4()), shop_id, pid, stock, buy_p, now,
            )
            prod[key] = {"id": pid, "buy_p": buy_p, "sell_p": sell_p}
            marker = " ← LOW STOCK" if stock <= 5 else ""
            print(f"  + {name}  ({stock} units){marker}")

        # ── 4. Historical sales — 7 days ───────────────────────────────────
        print("\nSales (7 days history)…")
        for days_ago in range(7, 0, -1):
            ref = f"SAL-SEED-D{days_ago:02d}"
            if await conn.fetchval("SELECT 1 FROM sales WHERE reference = $1", ref):
                print(f"  skip {ref}")
                continue
            tx_time = datetime.now(timezone.utc).replace(
                hour=10, minute=0, second=0, microsecond=0
            ) - timedelta(days=days_ago)

            basket = [
                (prod[pk]["id"], qty, prod[pk]["sell_p"])
                for pk, qty in DAILY_BASKET
                if pk in prod
            ]
            total = sum(qty * sell_p for _, qty, sell_p in basket)

            sale_id = str(uuid.uuid4())
            await conn.execute(
                """
                INSERT INTO sales
                    (id, shop_id, reference, total_pesawas, payment_method, created_at)
                VALUES ($1,$2,$3,$4,'cash',$5)
                """,
                sale_id, shop_id, ref, total, tx_time,
            )
            for product_id, qty, unit_price in basket:
                await conn.execute(
                    """
                    INSERT INTO sale_items
                        (id, sale_id, product_id, quantity, unit_price_pesawas)
                    VALUES ($1,$2,$3,$4,$5)
                    """,
                    str(uuid.uuid4()), sale_id, product_id, qty, unit_price,
                )
            print(f"  + {ref}  GHS {total/100:.2f}")

        # ── 4b. MoMo sales — vault balance ────────────────────────────────
        # Vault only counts payment_method='momo'. Add 4 historical MoMo
        # sales so vault shows ~GHS 880 available before any payout.
        print("\nMoMo sales (vault balance)…")
        momo_days = [7, 5, 3, 1]  # days ago
        for days_ago in momo_days:
            ref = f"SAL-SEED-M{days_ago:02d}"
            if await conn.fetchval("SELECT 1 FROM sales WHERE reference = $1", ref):
                print(f"  skip {ref}")
                continue
            tx_time = datetime.now(timezone.utc).replace(
                hour=14, minute=30, second=0, microsecond=0
            ) - timedelta(days=days_ago)

            basket = [
                (prod[pk]["id"], qty, prod[pk]["sell_p"])
                for pk, qty in MOMO_BASKET
                if pk in prod
            ]
            total = sum(qty * sell_p for _, qty, sell_p in basket)

            sale_id = str(uuid.uuid4())
            await conn.execute(
                """
                INSERT INTO sales
                    (id, shop_id, reference, total_pesawas, payment_method, created_at)
                VALUES ($1,$2,$3,$4,'momo',$5)
                """,
                sale_id, shop_id, ref, total, tx_time,
            )
            for product_id, qty, unit_price in basket:
                await conn.execute(
                    """
                    INSERT INTO sale_items
                        (id, sale_id, product_id, quantity, unit_price_pesawas)
                    VALUES ($1,$2,$3,$4,$5)
                    """,
                    str(uuid.uuid4()), sale_id, product_id, qty, unit_price,
                )
            print(f"  + {ref}  GHS {total/100:.2f}  [MoMo]")

        # ── 5. Credit customers ────────────────────────────────────────────
        cust_ids: dict[str, str] = {}
        print("\nCredit customers…")
        for key, full_name, id_type, id_number, phone, momo_phone in CREDIT_CUSTOMERS:
            existing = await conn.fetchrow(
                "SELECT id FROM credit_customers WHERE shop_id=$1 AND id_number=$2",
                shop_id, id_number,
            )
            if existing:
                cust_ids[key] = str(existing["id"])
                print(f"  skip {full_name}")
                continue
            cid = str(uuid.uuid4())
            await conn.execute(
                """
                INSERT INTO credit_customers
                    (id, shop_id, full_name, id_type, id_number, phone, momo_phone, created_at)
                VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
                """,
                cid, shop_id, full_name, id_type, id_number,
                e164(phone), e164(momo_phone),
                datetime.now(timezone.utc),
            )
            cust_ids[key] = cid
            print(f"  + {full_name}")

        # ── 6. Credit sales ────────────────────────────────────────────────
        cs_ids: dict[str, str] = {}
        print("\nCredit sales…")
        credit_cases = [
            # (cust_key, ref, amount_p, due_days_from_today, status)
            ("kwame", "CRD-SEED-001", 52000,  5, "pending"),   # due in 5 days
            ("ama",   "CRD-SEED-002", 75000, -3, "pending"),   # overdue by 3 days
        ]
        for cust_key, ref, amount_p, due_offset, status in credit_cases:
            existing = await conn.fetchrow(
                "SELECT id FROM credit_sales WHERE reference = $1", ref
            )
            if existing:
                cs_ids[ref] = str(existing["id"])
                print(f"  skip {ref}")
                continue
            due = date.today() + timedelta(days=due_offset)
            csid = str(uuid.uuid4())
            await conn.execute(
                """
                INSERT INTO credit_sales
                    (id, shop_id, customer_id, reference, amount_pesawas,
                     due_date, status, created_at)
                VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
                """,
                csid, shop_id, cust_ids[cust_key], ref, amount_p,
                due, status, datetime.now(timezone.utc),
            )
            cs_ids[ref] = csid
            tag = "OVERDUE" if due_offset < 0 else f"due {due}"
            print(f"  + {ref}  GHS {amount_p/100:.2f}  [{tag}]")

        # ── 7. Collection records ──────────────────────────────────────────
        print("\nCollection records…")
        coll_cases = [
            # (credit_ref, amount_p, status, network)
            ("CRD-SEED-001", 52000, "success", "mtn"),
            ("CRD-SEED-002", 75000, "failed",  "mtn"),
        ]
        for cs_ref, amount_p, status, network in coll_cases:
            cs_id = cs_ids.get(cs_ref)
            if not cs_id:
                continue
            if await conn.fetchval(
                "SELECT 1 FROM credit_collections WHERE credit_sale_id = $1", cs_id
            ):
                print(f"  skip {cs_ref} collection")
                continue
            await conn.execute(
                """
                INSERT INTO credit_collections
                    (id, credit_sale_id, amount_pesawas, status, network, created_at)
                VALUES ($1,$2,$3,$4,$5,$6)
                """,
                str(uuid.uuid4()), cs_id, amount_p, status, network,
                datetime.now(timezone.utc),
            )
            print(f"  + {cs_ref}  [{status.upper()}]")

        # ── 8. Tax invoices (current month purchase invoices) ─────────────
        # Ghana VAT structure: 15% VAT + 2.5% NHIL + 2.5% GETFund = 20% total
        # taxable = total / 1.20  (backing out the levies)
        print("\nTax invoices…")
        current_period = date.today().strftime("%Y-%m")
        tax_invoices = [
            # (inv_no, date_offset_days, vendor, tin, total_pesawas, inv_type)
            # Input tax — supplier purchase invoices
            ("INV-ACC-001", -25, "Accra Central Wholesale Ltd", "C0012345678",  80000, "input"),
            ("INV-ACC-002", -18, "Accra Central Wholesale Ltd", "C0012345678",  54000, "input"),
            ("INV-KOJ-001", -12, "Kojobi Distributors",         "C0098765432",  36000, "input"),
            ("INV-KOJ-002",  -5, "Kojobi Distributors",         "C0098765432",  27000, "input"),
            # Output tax — sales receipts (generated from daily sales)
            ("RCP-SEED-001", -6, "Cash Customer",               None,            5000, "output"),
            ("RCP-SEED-002", -4, "Cash Customer",               None,            7500, "output"),
            ("RCP-SEED-003", -2, "Cash Customer",               None,            4200, "output"),
        ]
        for inv_no, day_offset, vendor, tin, total_p, inv_type in tax_invoices:
            exists = await conn.fetchval(
                "SELECT 1 FROM tax_invoices WHERE shop_id=$1 AND invoice_number=$2",
                shop_id, inv_no,
            )
            if exists:
                print(f"  skip {inv_no}")
                continue
            inv_date = date.today() + timedelta(days=day_offset)
            # Back-calculate tax components from total (inclusive of 20% levies)
            taxable_p = round(total_p / 1.20)
            vat_p     = round(taxable_p * 0.15)
            nhil_p    = round(taxable_p * 0.025)
            getfund_p = round(taxable_p * 0.025)
            await conn.execute(
                """
                INSERT INTO tax_invoices
                    (id, shop_id, period, invoice_type, vendor_name, vendor_tin,
                     invoice_number, invoice_date, total_amount_pesawas,
                     taxable_amount_pesawas, vat_amount_pesawas,
                     nhil_amount_pesawas, getfund_amount_pesawas, created_at)
                VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
                """,
                str(uuid.uuid4()), shop_id, current_period, inv_type,
                vendor, tin, inv_no, inv_date,
                total_p, taxable_p, vat_p, nhil_p, getfund_p,
                datetime.now(timezone.utc),
            )
            label = "INPUT " if inv_type == "input" else "OUTPUT"
            print(f"  + [{label}] {inv_no}  {vendor}  GHS {total_p/100:.2f}")

        # Summary for confirmation
        total_input_vat  = sum(
            round(round(p / 1.20) * 0.15)
            for _, _, _, _, p, t in tax_invoices if t == "input"
        )
        total_output_vat = sum(
            round(round(p / 1.20) * 0.15)
            for _, _, _, _, p, t in tax_invoices if t == "output"
        )
        net_vat = max(total_output_vat - total_input_vat, 0)

        momo_total_p = sum(
            sum(qty * prod[pk]["sell_p"] for pk, qty in MOMO_BASKET if pk in prod)
            for _ in momo_days
        )
        print(
            "\n✅  Seed complete.\n"
            "    10 products  ·  7 cash sales  ·  4 MoMo sales  ·  2 credit customers\n"
            "    Milo (4 units) + Sardines (2 units) → low-stock dashboard alerts\n"
            "    CRD-SEED-002 (Ama Boateng) is overdue → overdue credit alert\n"
            "    CRD-SEED-002 collection is FAILED → retry button visible in collection-logs\n"
            f"    Vault: GHS {momo_total_p/100:.2f} available → payout demo works\n"
            f"    Tax: {current_period}  input VAT GHS {total_input_vat/100:.2f}  "
            f"output VAT GHS {total_output_vat/100:.2f}  "
            f"net payable GHS {net_vat/100:.2f}\n"
            "    → Tax → GRA Export CSV will have real data ready to file\n"
        )

    finally:
        await conn.close()


def main() -> None:
    parser = argparse.ArgumentParser(description="Seed Sikasem demo data")
    parser.add_argument(
        "--phone", required=True,
        help="Phone number of the shop owner, e.g. +233241234567 or 0241234567",
    )
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
