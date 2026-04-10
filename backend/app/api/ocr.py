"""
OCR router
POST /v1/ocr/extract   (mode=id_card | hint=bulk_scan | hint=invoice)
POST /v1/ocr/voice     (audio_base64 → parsed product name + quantity)

Body: { "image_base64": "<base64 string>" }
Query params: mode=id_card  OR  hint=bulk_scan|invoice
"""
import base64
import re
import logging
from fastapi import APIRouter, Depends, Query, HTTPException
from pydantic import BaseModel

from app.core.deps import get_current_shop
from app.services.ocr import extract_id_card, extract_bulk_scan, extract_invoice, extract_product_label

logger = logging.getLogger(__name__)
router = APIRouter()


class OcrRequest(BaseModel):
    image_base64: str


class VoiceRequest(BaseModel):
    audio_base64: str   # m4a/mp4 audio encoded as base64
    format: str = "m4a"


@router.post("/extract")
async def ocr_extract(
    body: OcrRequest,
    mode: str = Query(default=""),
    hint: str = Query(default=""),
    auth=Depends(get_current_shop),
):
    from datetime import date
    current_period = date.today().strftime("%Y-%m")
    if mode == "id_card":
        return await extract_id_card(body.image_base64)
    if hint == "invoice":
        return await extract_invoice(body.image_base64, current_period)
    if hint == "product_label":
        return await extract_product_label(body.image_base64)
    return await extract_bulk_scan(body.image_base64)


@router.post("/voice")
async def voice_stock_count(
    body: VoiceRequest,
    auth=Depends(get_current_shop),
):
    """
    Receive base64-encoded audio (m4a), transcribe with OpenAI Whisper,
    parse 'product name, quantity' and return structured result.
    """
    import httpx
    from app.core.config import settings

    if not getattr(settings, "OPENAI_API_KEY", None):
        raise HTTPException(status_code=503, detail="Voice transcription not configured")

    try:
        audio_bytes = base64.b64decode(body.audio_base64)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid base64 audio")

    # Call Whisper API
    try:
        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.post(
                "https://api.openai.com/v1/audio/transcriptions",
                headers={"Authorization": f"Bearer {settings.OPENAI_API_KEY}"},
                files={"file": (f"audio.{body.format}", audio_bytes, f"audio/{body.format}")},
                data={"model": "whisper-1", "language": "en"},
            )
            resp.raise_for_status()
            transcript = resp.json().get("text", "").strip()
    except Exception as exc:
        logger.warning("[ocr/voice] Whisper call failed: %s", exc)
        raise HTTPException(status_code=502, detail="Transcription failed")

    # Parse "product name, quantity" — e.g. "Coca-Cola, 42" or "Milo 12"
    parsed_qty = None
    parsed_name = transcript

    # Try "<name>, <number>" or "<name> <number>" at the end
    m = re.search(r"[,\s]+(\d+)\s*$", transcript)
    if m:
        parsed_qty = int(m.group(1))
        parsed_name = transcript[: m.start()].strip().strip(",").strip()
    else:
        # Try "<number> <name>" at the start
        m2 = re.match(r"^(\d+)\s+(.+)", transcript)
        if m2:
            parsed_qty = int(m2.group(1))
            parsed_name = m2.group(2).strip()

    return {
        "transcript": transcript,
        "product_name": parsed_name,
        "quantity": parsed_qty,
        "confidence": 0.85 if parsed_qty is not None else 0.4,
    }
