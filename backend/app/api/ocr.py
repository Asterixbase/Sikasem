"""
OCR router
POST /v1/ocr/extract   (mode=id_card | hint=bulk_scan)
"""
from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel

from app.core.deps import get_current_shop
from app.services.ocr import extract_id_card, extract_bulk_scan

router = APIRouter()


class OcrRequest(BaseModel):
    image_base64: str


@router.post("/extract")
async def ocr_extract(
    body: OcrRequest,
    mode: str = Query(default=""),
    hint: str = Query(default=""),
    auth=Depends(get_current_shop),
):
    if mode == "id_card":
        return await extract_id_card(body.image_base64)
    return await extract_bulk_scan(body.image_base64)
