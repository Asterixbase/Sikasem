"""
Categories router
GET  /v1/categories
POST /v1/categories
POST /v1/categories/suggest
"""
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
    cats = result.scalars().all()
    tree = _build_tree(list(cats))

    # Simple keyword-based suggestion
    name_lower = body.name.lower()
    keywords = {
        "drink": "Beverages", "water": "Beverages", "juice": "Beverages", "beer": "Beverages",
        "bread": "Bakery", "biscuit": "Bakery", "cake": "Bakery",
        "rice": "Grains & Staples", "flour": "Grains & Staples", "pasta": "Grains & Staples",
        "soap": "Personal Care", "shampoo": "Personal Care", "cream": "Personal Care",
        "phone": "Electronics", "cable": "Electronics", "charger": "Electronics",
    }

    suggested_name = "General"
    for kw, cat_name in keywords.items():
        if kw in name_lower:
            suggested_name = cat_name
            break

    matching = next((c for c in cats if c.name == suggested_name), None)
    if matching:
        suggestion = {
            "category_id": matching.id,
            "name": matching.name,
            "breadcrumb": matching.name,
            "confidence": 0.75,
        }
    elif cats:
        c = cats[0]
        suggestion = {"category_id": c.id, "name": c.name, "breadcrumb": c.name, "confidence": 0.3}
    else:
        suggestion = {"category_id": "", "name": suggested_name, "breadcrumb": suggested_name, "confidence": 0.3}

    return CategorySuggestResponse(
        suggestion=suggestion,
        alternatives=[],
        full_tree=tree,
    )
