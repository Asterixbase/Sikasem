"""
Demo seed endpoint — POST /v1/admin/seed-demo
Populates the authenticated user's shop with realistic Ghanaian retail data.
Safe to call multiple times (clears demo data first).
"""
import random
import re
import uuid
from datetime import date, datetime, timedelta, timezone

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete

from app.core.database import get_db
from app.core.deps import get_current_shop
from app.models.product import Category, Product, PriceHistory
from app.models.sale import Sale, SaleItem
from app.models.credit import CreditCustomer, CreditSale, CreditSaleItem
from app.models.inventory import StockMovement

router = APIRouter()

# ── Seed catalogue ─────────────────────────────────────────────────────────────
# (name, barcode, emoji, cat_key, buy_ghs, sell_ghs, stock, supplier)
_PRODUCTS = [
    # Beverages
    ("Coca-Cola 500ml",              "5449000000996", "🥤", "bev",  5.00,  6.50, 45, "Metro Dist."),
    ("Fanta Orange 500ml",           "5449000013094", "🥤", "bev",  5.00,  6.50, 30, "Metro Dist."),
    ("Sprite 500ml",                 "5449000000439", "🥤", "bev",  5.00,  6.50, 28, "Metro Dist."),
    ("Club Malt 330ml",              "6001097003023", "🍺", "bev",  4.50,  6.00,  8, "Accra Bev."),
    ("Lipton Yellow Label Tea 25s",  "8722700178743", "🍵", "bev",  8.00, 11.00, 55, "Ghana Goods"),
    ("Nescafé Classic 50g",          "7613036721691", "☕", "bev", 12.00, 16.00, 20, "Ghana Goods"),

    # Snacks & Confectionery
    ("Indomie Noodles Chicken 70g",  "6001098002108", "🍜", "snk",  2.50,  3.50,120, "Indomie GH"),
    ("Digestive Biscuits 400g",      "5000168042841", "🍪", "snk", 14.00, 19.00, 22, "Ghana Goods"),
    ("Pringles Original 165g",       "5053990139712", "🍟", "snk", 28.00, 38.00,  4, "SuperMart"),
    ("Golden Tree Chocolate 35g",    "6111243200018", "🍫", "snk",  5.00,  7.00, 60, "Cocoa Board"),
    ("Beloxxi Cream Crackers 225g",  "6001019020025", "🍘", "snk",  9.00, 13.00, 38, "Ghana Goods"),

    # Grains & Staples
    ("Golden Penny Rice 1kg",        "6001029084020", "🌾", "grs", 18.00, 24.00, 15, "Agri Direct"),
    ("Mama's Choice Semolina 1kg",   "6001039017309", "🫙", "grs", 11.00, 16.00, 40, "Agri Direct"),
    ("Golden Penny Pasta 500g",      "6001034060088", "🍝", "grs",  9.00, 13.00,  5, "Agri Direct"),
    ("Quaker Oats 500g",             "0030000010204", "🌾", "grs", 14.00, 20.00, 18, "Ghana Goods"),

    # Cooking Essentials
    ("Frytol Cooking Oil 1L",        "6001097013022", "🫙", "ckn", 20.00, 27.00, 22, "Frytol GH"),
    ("Gino Tomato Paste 70g",        "6001097052045", "🍅", "ckn",  2.50,  4.00, 80, "Gino GH"),
    ("Maggi Chicken Cubes 100g",     "6001087001068", "🧂", "ckn",  6.00,  9.00, 55, "Nestle GH"),
    ("Shea Butter Natural 250g",     "6940218707132", "🧈", "ckn", 12.00, 18.00,  2, "Local Coop"),

    # Dairy & Eggs
    ("Peak Full Cream Milk 170g",    "8711000502536", "🥛", "dry", 14.00, 18.00, 12, "FrieslandC."),
    ("Cowbell Choco Milk 400g",      "6001049011095", "🍫", "dry", 12.00, 17.00,  6, "Cowbell GH"),
    ("Fresh Eggs Tray (30)",         "2900000000015", "🥚", "dry", 45.00, 60.00,  1, "Local Farm"),

    # Personal Care
    ("Dettol Antibac Soap 100g",     "6001101001102", "🧼", "prs",  7.00, 10.00, 48, "Reckitt GH"),
    ("Sunlight Dish Liquid 750ml",   "6001101001096", "🫧", "prs", 13.00, 18.00, 30, "Unilever GH"),
    ("Vaseline Blue Seal 250ml",     "8710908831546", "🧴", "prs", 16.00, 22.00, 25, "Unilever GH"),
    ("Always Ultra Thin 8s",         "4015400337706", "🌸", "prs", 10.00, 15.00, 35, "P&G Ghana"),

    # Pharmaceuticals
    ("Paracetamol 500mg x16",        "5000168022447", "💊", "pha",  2.50,  4.00,  0, "Pharm Depot"),
    ("Robb Analgesic Balm 40g",      "6001127001244", "🏥", "pha",  5.50,  8.00, 18, "Pharm Depot"),
    ("Alabukun Powder 50s",          "6001006040135", "💊", "pha",  7.00, 11.00, 22, "Pharm Depot"),

    # Household
    ("Omo Detergent 500g",           "6001087002031", "🧺", "hsh", 16.00, 22.00, 16, "Unilever GH"),
    ("Kool Aid Air Freshener 300ml", "0043000210604", "🌬", "hsh", 18.00, 25.00, 10, "SuperMart"),
]

_CATS = {
    "bev": "Beverages",
    "snk": "Snacks & Confectionery",
    "grs": "Grains & Staples",
    "ckn": "Cooking Essentials",
    "dry": "Dairy & Eggs",
    "prs": "Personal Care",
    "pha": "Pharmaceuticals",
    "hsh": "Household Items",
}

_CREDIT_CUSTOMERS = [
    ("Kwame Asante",      "GHA-19921014-12345", "+233244123456", "MTN: 0244123456"),
    ("Abena Mensah",      "GHA-19880322-67890", "+233207654321", "Vodafone: 0207654321"),
    ("Kofi Boateng",      "GHA-19750601-11223", "+233265987654", None),
    ("Akosua Darko",      "GHA-20010910-44556", "+233555012345", "AirtelTigo: 0555012345"),
    ("Yaw Ofori-Atta",    "GHA-19930415-77889", "+233243567890", "MTN: 0243567890"),
]

rng = random.Random(42)   # fixed seed for reproducibility


def _sku(name: str, pid: str) -> str:
    prefix = re.sub(r"[^A-Z0-9]", "", name.upper())[:4].ljust(3, "X")
    return f"{prefix}-{pid[:4].upper()}"


def _pesawas(ghs: float) -> int:
    return round(ghs * 100)


def _sale_ref(shop_id: str, ts: datetime, n: int) -> str:
    return f"DEMO-{ts.strftime('%Y%m%d')}-{shop_id[:4].upper()}-{n:03d}"


def _sale_time(day_offset: int, hour: int, minute: int) -> datetime:
    """Return timezone-aware datetime for a past day at given hour (UTC, Ghana is UTC+0)."""
    d = date.today() - timedelta(days=day_offset)
    return datetime(d.year, d.month, d.day, hour, minute, 0, tzinfo=timezone.utc)


@router.post("/seed-demo")
async def seed_demo(
    auth=Depends(get_current_shop),
    db: AsyncSession = Depends(get_db),
):
    """
    Seeds the authenticated shop with 14 days of realistic demo data.
    Deletes any existing demo data for the shop first (safe to re-run).
    """
    _, shop = auth
    sid = shop.id

    # ── 1. Clear ALL existing data for this shop (FK-safe order) ─────────────
    # Sales and their items first (SaleItem.product_id has no ON DELETE CASCADE)
    all_sale_ids = (await db.execute(
        select(Sale.id).where(Sale.shop_id == sid)
    )).scalars().all()
    if all_sale_ids:
        await db.execute(delete(SaleItem).where(SaleItem.sale_id.in_(all_sale_ids)))
        await db.execute(delete(Sale).where(Sale.id.in_(all_sale_ids)))

    # Credit
    demo_cust_ids = (await db.execute(
        select(CreditCustomer.id).where(CreditCustomer.shop_id == sid)
    )).scalars().all()
    if demo_cust_ids:
        demo_credit_ids = (await db.execute(
            select(CreditSale.id).where(CreditSale.customer_id.in_(demo_cust_ids))
        )).scalars().all()
        if demo_credit_ids:
            await db.execute(delete(CreditSaleItem).where(CreditSaleItem.credit_sale_id.in_(demo_credit_ids)))
            await db.execute(delete(CreditSale).where(CreditSale.id.in_(demo_credit_ids)))
        await db.execute(delete(CreditCustomer).where(CreditCustomer.id.in_(demo_cust_ids)))

    # Stock movements, price history, products, categories for this shop
    demo_prod_ids = (await db.execute(
        select(Product.id).where(Product.shop_id == sid)
    )).scalars().all()
    if demo_prod_ids:
        await db.execute(delete(StockMovement).where(StockMovement.product_id.in_(demo_prod_ids)))
        await db.execute(delete(PriceHistory).where(PriceHistory.product_id.in_(demo_prod_ids)))
        await db.execute(delete(Product).where(Product.id.in_(demo_prod_ids)))
    await db.execute(delete(Category).where(Category.shop_id == sid))
    await db.flush()

    # ── 2. Create categories ───────────────────────────────────────────────────
    cat_map: dict[str, str] = {}
    for key, name in _CATS.items():
        cid = str(uuid.uuid4())
        db.add(Category(id=cid, shop_id=sid, name=name, parent_id=None))
        cat_map[key] = cid
    await db.flush()

    # ── 3. Create products ─────────────────────────────────────────────────────
    products: list[Product] = []
    for name, barcode, emoji, cat_key, buy_ghs, sell_ghs, stock, supplier in _PRODUCTS:
        pid = str(uuid.uuid4())
        p = Product(
            id=pid, shop_id=sid, name=name, barcode=barcode, sku=_sku(name, pid),
            emoji=emoji, category_id=cat_map[cat_key],
            buy_price_pesawas=_pesawas(buy_ghs),
            sell_price_pesawas=_pesawas(sell_ghs),
            current_stock=stock,
        )
        db.add(p)
        products.append(p)

        # Initial stock movement
        if stock > 0:
            db.add(StockMovement(
                id=str(uuid.uuid4()), shop_id=sid, product_id=pid,
                movement_type="purchase", quantity=stock + rng.randint(20, 60),
                unit_cost_pesawas=_pesawas(buy_ghs), notes="Initial stock",
            ))
        # Price history (1-2 supplier entries)
        db.add(PriceHistory(
            id=str(uuid.uuid4()), product_id=pid,
            supplier_name=supplier, unit_cost_pesawas=_pesawas(buy_ghs),
        ))
        # Second older price for variety
        if rng.random() > 0.5:
            older_cost = _pesawas(buy_ghs * rng.uniform(0.85, 0.98))
            db.add(PriceHistory(
                id=str(uuid.uuid4()), product_id=pid,
                supplier_name=supplier, unit_cost_pesawas=older_cost,
                created_at=datetime.now(timezone.utc) - timedelta(days=rng.randint(30, 90)),
            ))

    await db.flush()

    # ── 4. Sales data — 14 days ────────────────────────────────────────────────
    # High-velocity products get more sales
    fast_movers = [p for p in products if "Indomie" in p.name or "Coca" in p.name
                   or "Gino" in p.name or "Maggi" in p.name or "Noodles" in p.name]
    sellable = [p for p in products if p.sell_price_pesawas > 0]

    sale_counter = 0
    for day_offset in range(14, -1, -1):  # 14 days ago → today (0)
        d = date.today() - timedelta(days=day_offset)
        is_weekend = d.weekday() >= 6   # Sunday only quiet
        n_sales = rng.randint(3, 6) if is_weekend else rng.randint(8, 15)

        # Sales clustered in peak hours: 7-10, 12-14, 16-19 (Ghana time ≈ UTC)
        peak_hours = (
            [rng.randint(7, 9) for _ in range(n_sales // 3)] +
            [rng.randint(12, 13) for _ in range(n_sales // 4)] +
            [rng.randint(15, 18) for _ in range(n_sales - n_sales // 3 - n_sales // 4)]
        )
        rng.shuffle(peak_hours)

        for i, hour in enumerate(peak_hours):
            sale_counter += 1
            method = rng.choices(["cash", "momo", "credit"], weights=[55, 30, 15])[0]
            ts = _sale_time(day_offset, hour, rng.randint(0, 59))
            ref = _sale_ref(sid, ts, sale_counter)

            # Pick 1-4 products for this sale
            n_items = rng.randint(1, 4)
            chosen = rng.choices(
                fast_movers * 3 + sellable,  # weight fast movers higher
                k=n_items,
            )
            # Deduplicate
            seen: set[str] = set()
            unique_items = []
            for pp in chosen:
                if pp.id not in seen:
                    seen.add(pp.id)
                    unique_items.append(pp)

            total = 0
            sale_id = str(uuid.uuid4())
            sale_items = []
            for pp in unique_items:
                qty = rng.randint(1, 3)
                total += pp.sell_price_pesawas * qty
                sale_items.append(SaleItem(
                    id=str(uuid.uuid4()), sale_id=sale_id,
                    product_id=pp.id,
                    quantity=qty,
                    unit_price_pesawas=pp.sell_price_pesawas,
                ))

            sale = Sale(
                id=sale_id, shop_id=sid, reference=ref,
                total_pesawas=total, payment_method=method,
                created_at=ts,
            )
            db.add(sale)
            for si in sale_items:
                db.add(si)

    await db.flush()

    # ── 5. Credit customers + credit sales ────────────────────────────────────
    credit_products = rng.choices(sellable, k=10)
    for i, (full_name, id_number, phone, momo_note) in enumerate(_CREDIT_CUSTOMERS):
        cust_id = str(uuid.uuid4())
        db.add(CreditCustomer(
            id=cust_id, shop_id=sid, full_name=full_name,
            id_type="ghana_card", id_number=id_number, phone=phone,
        ))

        # 1-2 credit sales per customer
        for j in range(rng.randint(1, 2)):
            cs_id = str(uuid.uuid4())
            days_ago = rng.randint(2, 20)
            due_days = rng.randint(-5, 15)   # some overdue
            pp = credit_products[i + j]
            qty = rng.randint(1, 4)
            amount = pp.sell_price_pesawas * qty
            status = "overdue" if due_days < 0 else "pending"
            cs_ref = f"CR-{sid[:4].upper()}-{i+1:02d}{j+1:02d}"
            db.add(CreditSale(
                id=cs_id, shop_id=sid, customer_id=cust_id,
                reference=cs_ref, amount_pesawas=amount,
                due_date=date.today() + timedelta(days=due_days),
                status=status,
                created_at=datetime.now(timezone.utc) - timedelta(days=days_ago),
            ))
            db.add(CreditSaleItem(
                id=str(uuid.uuid4()), credit_sale_id=cs_id,
                product_id=pp.id, quantity=qty,
                unit_price_pesawas=pp.sell_price_pesawas,
            ))

    await db.commit()

    return {
        "status": "ok",
        "categories": len(_CATS),
        "products": len(_PRODUCTS),
        "credit_customers": len(_CREDIT_CUSTOMERS),
        "message": "Demo data seeded successfully. Reload the app.",
    }
