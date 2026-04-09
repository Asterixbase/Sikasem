"""
Categories router
GET  /v1/categories
POST /v1/categories
POST /v1/categories/suggest  — uses Claude Haiku to pick or CREATE the right category
"""
import re
import uuid

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.core.database import get_db
from app.core.deps import get_current_shop
from app.models.product import Category
from app.schemas.product import CategoryNode, CategoryCreateRequest, CategorySuggestRequest, CategorySuggestResponse

router = APIRouter()


def _build_tree(categories: list[Category], parent_id: str | None = None) -> list[CategoryNode]:
    nodes = []
    for cat in categories:
        if cat.parent_id == parent_id:
            children = _build_tree(categories, cat.id)
            nodes.append(CategoryNode(id=cat.id, name=cat.name, children=children))
    return nodes


@router.get("")
async def get_categories(
    auth=Depends(get_current_shop),
    db: AsyncSession = Depends(get_db),
):
    _, shop = auth
    result = await db.execute(select(Category).where(Category.shop_id == shop.id))
    cats = result.scalars().all()
    return {"tree": _build_tree(list(cats))}


@router.post("", status_code=201)
async def create_category(
    body: CategoryCreateRequest,
    auth=Depends(get_current_shop),
    db: AsyncSession = Depends(get_db),
):
    _, shop = auth
    cat = Category(
        id=str(uuid.uuid4()),
        shop_id=shop.id,
        name=body.name,
        parent_id=body.parent_id,
    )
    db.add(cat)
    await db.commit()
    return CategoryNode(id=cat.id, name=cat.name, children=[])


@router.post("/suggest", response_model=CategorySuggestResponse)
async def suggest_category(
    body: CategorySuggestRequest,
    auth=Depends(get_current_shop),
    db: AsyncSession = Depends(get_db),
):
    _, shop = auth
    result = await db.execute(select(Category).where(Category.shop_id == shop.id))
    cats = list(result.scalars().all())
    tree = _build_tree(cats)

    product_desc = f"{body.brand} — {body.name}" if body.brand else body.name

    # ── Claude Haiku: pick existing OR propose a new category ─────────────────
    try:
        from anthropic import AsyncAnthropic
        from app.core.config import settings

        if cats:
            cat_list = "\n".join(f"- {c.name} (id: {c.id})" for c in cats)
            existing_block = f"Existing categories:\n{cat_list}\n\n"
            rule2 = (
                "2. If no existing category fits well, reply with ONLY "
                "'NEW: <Category Name>' (2-4 words, Title Case, e.g. 'NEW: Canned Foods').\n"
            )
        else:
            existing_block = "No categories exist yet.\n\n"
            rule2 = "2. Suggest a suitable new category: reply with ONLY 'NEW: <Category Name>'.\n"

        client = AsyncAnthropic(api_key=settings.ANTHROPIC_API_KEY)
        resp = await client.messages.create(
            model="claude-haiku-4-5-20251001",
            max_tokens=80,
            messages=[{
                "role": "user",
                "content": (
                    f"You are helping a Ghanaian shopkeeper categorise a retail product.\n\n"
                    f"Product: {product_desc}\n\n"
                    f"{existing_block}"
                    f"Rules:\n"
                    f"1. If an existing category clearly fits, reply with ONLY its id.\n"
                    f"{rule2}"
                    f"One line, no explanation."
                ),
            }],
        )
        picked = resp.content[0].text.strip().strip('"').strip("'")

        # Claude wants to create a new category
        if re.match(r"^NEW\s*:", picked, re.IGNORECASE):
            new_name = re.sub(r"^NEW\s*:\s*", "", picked, flags=re.IGNORECASE).strip()[:80]
            if new_name:
                new_cat = Category(id=str(uuid.uuid4()), shop_id=shop.id, name=new_name, parent_id=None)
                db.add(new_cat)
                await db.commit()
                new_tree = _build_tree(cats + [new_cat])
                return CategorySuggestResponse(
                    suggestion={"category_id": new_cat.id, "name": new_cat.name,
                                "breadcrumb": new_cat.name, "confidence": 0.85},
                    alternatives=[],
                    full_tree=new_tree,
                )

        # Claude picked an existing category
        match = next((c for c in cats if c.id == picked), None)
        if match:
            return CategorySuggestResponse(
                suggestion={"category_id": match.id, "name": match.name,
                            "breadcrumb": match.name, "confidence": 0.90},
                alternatives=[],
                full_tree=tree,
            )

    except Exception:
        pass  # Fall through to keyword heuristic

    # ── Keyword heuristic fallback ─────────────────────────────────────────────
    if not cats:
        # No categories at all and Claude failed — create a sensible default
        return CategorySuggestResponse(
            suggestion={"category_id": "", "name": "General", "breadcrumb": "General", "confidence": 0.0},
            alternatives=[],
            full_tree=tree,
        )

    name_lower = body.name.lower()
    keywords = {
        "drink": "Beverages", "water": "Beverages", "juice": "Beverages",
        "beer": "Beverages", "malt": "Beverages", "tea": "Beverages", "coffee": "Beverages",
        "bread": "Bakery", "biscuit": "Bakery", "cake": "Bakery",
        "rice": "Grains & Staples", "flour": "Grains & Staples", "pasta": "Grains & Staples",
        "oil": "Cooking Essentials", "tomato": "Cooking Essentials", "pepper": "Cooking Essentials",
        "soap": "Personal Care", "shampoo": "Personal Care", "cream": "Personal Care",
        "tablet": "Pharmaceuticals", "capsule": "Pharmaceuticals", "syrup": "Pharmaceuticals",
        "phone": "Electronics", "cable": "Electronics", "charger": "Electronics",
        "milk": "Dairy", "egg": "Dairy", "yoghurt": "Dairy",
    }
    suggested_name = next((cn for kw, cn in keywords.items() if kw in name_lower), None)
    matching = next((c for c in cats if suggested_name and c.name.lower() == suggested_name.lower()), cats[0])

    return CategorySuggestResponse(
        suggestion={"category_id": matching.id, "name": matching.name,
                    "breadcrumb": matching.name, "confidence": 0.40 if suggested_name else 0.30},
        alternatives=[],
        full_tree=tree,
    )
