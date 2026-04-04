"""
OCR router
POST /v1/ocr/extract   (mode=id_card | hint=bulk_scan | hint=invoice)

Body: { "image_base64": "<base64 string>" }
Query params: mode=id_card  OR  hint=bulk_scan|invoice
"""
from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel

from app.core.deps import get_current_shop
from app.services.ocr import extract_id_card, extract_bulk_scan, extract_invoice

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
    if hint == "invoice":
        return await extract_invoice(body.image_base64)
    return await extract_bulk_scan(body.image_base64)
