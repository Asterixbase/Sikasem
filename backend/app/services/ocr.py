"""
OCR service — Claude Vision API
Primary:  claude-haiku-4-5-20251001  (fast, cheap)
Fallback: claude-sonnet-4-6          (higher accuracy, triggered when confidence < 0.70)
          Logged as "Cloud Vision" to match demo terminology.

Requires ANTHROPIC_API_KEY in environment.
Falls back gracefully to empty results when key is absent.
"""
import json
import logging
import base64

logger = logging.getLogger(__name__)

# ── Confidence threshold for Cloud Vision fallback ─────────────────────────────
_FALLBACK_THRESHOLD = 0.70
_PRIMARY_MODEL  = "claude-haiku-4-5-20251001"
_FALLBACK_MODEL = "claude-sonnet-4-6"


# ── Helpers ────────────────────────────────────────────────────────────────────

def _detect_media_type(image_base64: str) -> str:
    """Detect image MIME type from base64 data or data-URL prefix."""
    if "," in image_base64:
        header = image_base64.split(",")[0].lower()
        if "jpeg" in header or "jpg" in header:
            return "image/jpeg"
        if "png" in header:
            return "image/png"
        if "webp" in header:
            return "image/webp"
    try:
        first = base64.b64decode(image_base64[:16] + "==")
        if first[:2] == b"\xff\xd8":
            return "image/jpeg"
        if first[:8] == b"\x89PNG\r\n\x1a\n":
            return "image/png"
    except Exception:
        pass
    return "image/jpeg"


def _strip_data_url(image_base64: str) -> str:
    """Remove 'data:image/...;base64,' prefix if present."""
    if "," in image_base64:
        return image_base64.split(",", 1)[1]
    return image_base64


def _calc_confidence(values: list) -> float:
    """Fraction of values that are non-null and non-empty."""
    if not values:
        return 0.0
    filled = sum(1 for v in values if v not in (None, "", 0))
    return round(filled / len(values), 3)


_MAX_IMAGE_BYTES = 4 * 1024 * 1024  # 4 MB — Claude hard limit is 5 MB


def _compress_image_if_needed(raw_b64: str, media_type: str) -> tuple[str, str]:
    """Compress image to stay under Claude's 5 MB limit.

    Uses Pillow to progressively reduce JPEG quality until the base64-encoded
    size is under _MAX_IMAGE_BYTES. Returns (new_b64, new_media_type).
    """
    raw_bytes = len(raw_b64.encode())
    if raw_bytes <= _MAX_IMAGE_BYTES:
        return raw_b64, media_type

    try:
        import io
        from PIL import Image

        img_data = base64.b64decode(raw_b64)
        img = Image.open(io.BytesIO(img_data))

        # Resize if very large (> 4000px on longest side)
        max_dim = 3000
        w, h = img.size
        if max(w, h) > max_dim:
            scale = max_dim / max(w, h)
            img = img.resize((int(w * scale), int(h * scale)), Image.LANCZOS)

        # Try progressively lower JPEG quality until under limit
        for quality in (85, 75, 65, 50):
            buf = io.BytesIO()
            img.convert("RGB").save(buf, format="JPEG", quality=quality, optimize=True)
            compressed_b64 = base64.b64encode(buf.getvalue()).decode()
            if len(compressed_b64.encode()) <= _MAX_IMAGE_BYTES:
                logger.info(
                    "Compressed image for Claude: original=%.1fMB quality=%d result=%.1fMB",
                    raw_bytes / 1e6, quality, len(compressed_b64.encode()) / 1e6,
                )
                return compressed_b64, "image/jpeg"

        logger.warning("Could not compress image below 4 MB — sending anyway")
    except Exception as exc:
        logger.warning("Image compression failed (%s) — sending original", exc)

    return raw_b64, media_type


async def _call_vision(image_base64: str, prompt: str, model: str) -> str:
    """Send an image + prompt to Claude and return the text response."""
    from anthropic import AsyncAnthropic
    from app.core.config import settings

    raw_b64    = _strip_data_url(image_base64)
    media_type = _detect_media_type(image_base64)
    raw_b64, media_type = _compress_image_if_needed(raw_b64, media_type)

    client = AsyncAnthropic(api_key=settings.ANTHROPIC_API_KEY)
    response = await client.messages.create(
        model=model,
        max_tokens=1024,
        messages=[{
            "role": "user",
            "content": [
                {
                    "type": "image",
                    "source": {
                        "type": "base64",
                        "media_type": media_type,
                        "data": raw_b64,
                    },
                },
                {"type": "text", "text": prompt},
            ],
        }],
    )
    return response.content[0].text


def _parse_json_response(text: str) -> dict:
    """Extract JSON from Claude response robustly.

    Handles:
      - Clean JSON: '{"key": "value"}'
      - Markdown fences: ```json\\n{...}\\n```
      - Preamble text:  'Here is the data:\\n{...}'
      - Mixed:          '```\\n{...}\\n```\\nNote: ...'
    """
    import re
    text = text.strip()

    # 1. Strip markdown code fences (```json ... ``` or ``` ... ```)
    if "```" in text:
        lines = text.splitlines()
        text = "\n".join(l for l in lines if not l.startswith("```")).strip()

    # 2. Try direct parse first (most common fast path)
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        pass

    # 3. Extract the first {...} block from anywhere in the text
    match = re.search(r'\{[^{}]*(?:\{[^{}]*\}[^{}]*)?\}', text, re.DOTALL)
    if match:
        try:
            return json.loads(match.group(0))
        except json.JSONDecodeError:
            pass

    # 4. Last resort: find first { and last } and try parsing that range
    start = text.find('{')
    end   = text.rfind('}')
    if start != -1 and end != -1 and end > start:
        try:
            return json.loads(text[start:end + 1])
        except json.JSONDecodeError:
            pass

    logger.warning("Could not parse JSON from Claude response: %.200s", text)
    return {}


# ── Invoice OCR ────────────────────────────────────────────────────────────────

_INVOICE_PROMPT = """\
You are an OCR system for Ghanaian retail tax invoices (VAT + NHIL + GETFund).
Extract the following fields from the invoice image and return ONLY a valid JSON object.
Ghana VAT structure: total = taxable × 1.20  (15% VAT + 2.5% NHIL + 2.5% GETFund).

{
  "vendor_name":       "string or null",
  "vendor_tin":        "Ghana TIN (C + 10 digits) or null",
  "invoice_number":    "string or null",
  "invoice_date":      "YYYY-MM-DD or null",
  "total_amount_ghs":  number or null,
  "vat_amount_ghs":    number or null,
  "nhil_amount_ghs":   number or null,
  "getfund_amount_ghs": number or null,
  "invoice_type":      "input or output"
}

Return ONLY the JSON object — no explanation, no markdown."""


def _build_invoice_fields(data: dict, period: str) -> dict:
    """Map Claude JSON → field dict with per-field confidence."""

    def ghs_to_p(val) -> int | None:
        if val is None:
            return None
        try:
            return int(round(float(val) * 100))
        except (ValueError, TypeError):
            return None

    def field(value, conf=0.85):
        if value in (None, "", 0):
            return {"value": value, "confidence": 0.0}
        return {"value": value, "confidence": conf}

    total_p  = ghs_to_p(data.get("total_amount_ghs"))
    vat_p    = ghs_to_p(data.get("vat_amount_ghs"))
    nhil_p   = ghs_to_p(data.get("nhil_amount_ghs"))
    getfund_p = ghs_to_p(data.get("getfund_amount_ghs"))

    # Derive sub-levies from total when not explicitly stated
    if total_p and not vat_p:
        taxable_p  = round(total_p / 1.20)
        vat_p      = round(taxable_p * 0.15)
        nhil_p     = round(taxable_p * 0.025)
        getfund_p  = round(taxable_p * 0.025)
        taxable_conf = 0.75  # derived, lower confidence
    else:
        taxable_p    = round(total_p / 1.20) if total_p else None
        taxable_conf = 0.85

    return {
        "vendor_name":              field(data.get("vendor_name")),
        "vendor_tin":               field(data.get("vendor_tin")),
        "invoice_number":           field(data.get("invoice_number")),
        "invoice_date":             field(data.get("invoice_date")),
        "total_amount_pesawas":     field(total_p),
        "taxable_amount_pesawas":   field(taxable_p, taxable_conf),
        "vat_amount_pesawas":       field(vat_p),
        "nhil_amount_pesawas":      field(nhil_p),
        "getfund_amount_pesawas":   field(getfund_p),
    }


def _empty_invoice(period: str) -> dict:
    return {
        "fields": {
            "vendor_name":              {"value": "",  "confidence": 0.0},
            "vendor_tin":               {"value": "",  "confidence": 0.0},
            "invoice_number":           {"value": "",  "confidence": 0.0},
            "invoice_date":             {"value": "",  "confidence": 0.0},
            "total_amount_pesawas":     {"value": 0,   "confidence": 0.0},
            "taxable_amount_pesawas":   {"value": 0,   "confidence": 0.0},
            "vat_amount_pesawas":       {"value": 0,   "confidence": 0.0},
            "nhil_amount_pesawas":      {"value": 0,   "confidence": 0.0},
            "getfund_amount_pesawas":   {"value": 0,   "confidence": 0.0},
        },
        "auto_period":  period,
        "invoice_type": "input",
        "confidence":   0.0,
    }


async def extract_invoice(image_base64: str, period: str) -> dict:
    """Extract tax invoice fields using Claude Vision with Cloud Vision fallback."""
    from app.core.config import settings
    if not settings.ANTHROPIC_API_KEY:
        logger.warning("ANTHROPIC_API_KEY not set — returning empty OCR result")
        return _empty_invoice(period)

    try:
        raw  = await _call_vision(image_base64, _INVOICE_PROMPT, _PRIMARY_MODEL)
        data = _parse_json_response(raw)
        fields     = _build_invoice_fields(data, period)
        confidence = _calc_confidence([f["value"] for f in fields.values()])

        logger.info(
            "OCR invoice extraction confidence=%.3f model=%s period=%s",
            confidence, _PRIMARY_MODEL, period,
        )

        if confidence < _FALLBACK_THRESHOLD:
            logger.info("Low conf — Cloud Vision called (model=%s)", _FALLBACK_MODEL)
            raw2   = await _call_vision(image_base64, _INVOICE_PROMPT, _FALLBACK_MODEL)
            data2  = _parse_json_response(raw2)
            fields = _build_invoice_fields(data2, period)
            confidence = _calc_confidence([f["value"] for f in fields.values()])
            data   = data2
            logger.info("Cloud Vision result confidence=%.3f", confidence)

        return {
            "fields":       fields,
            "auto_period":  period,
            "invoice_type": data.get("invoice_type", "input"),
            "confidence":   confidence,
        }

    except Exception as exc:
        logger.error("OCR invoice extraction failed: %s", exc)
        return _empty_invoice(period)


# ── ID card OCR ────────────────────────────────────────────────────────────────

_ID_CARD_PROMPT = """\
You are an OCR system for Ghanaian identity documents (Ghana Card, Voter ID, Passport, NHIS).
Extract the following fields from the ID card image and return ONLY a valid JSON object.

{
  "full_name":  "string or null",
  "id_type":    "ghana_card | voters_id | passport | nhis",
  "id_number":  "string or null",
  "dob":        "YYYY-MM-DD or null"
}

Return ONLY the JSON object — no explanation, no markdown."""


async def extract_id_card(image_base64: str) -> dict:
    """Extract Ghana ID card fields using Claude Vision with Cloud Vision fallback."""
    from app.core.config import settings
    if not settings.ANTHROPIC_API_KEY:
        logger.warning("ANTHROPIC_API_KEY not set — returning empty ID OCR result")
        return {"full_name": "", "id_type": "ghana_card", "id_number": "", "dob": "", "confidence": 0.0}

    try:
        raw  = await _call_vision(image_base64, _ID_CARD_PROMPT, _PRIMARY_MODEL)
        data = _parse_json_response(raw)

        fields = {
            "full_name": data.get("full_name") or "",
            "id_type":   data.get("id_type") or "ghana_card",
            "id_number": data.get("id_number") or "",
            "dob":       data.get("dob") or "",
        }
        confidence = _calc_confidence(list(fields.values()))
        logger.info("OCR ID card confidence=%.3f model=%s", confidence, _PRIMARY_MODEL)

        if confidence < _FALLBACK_THRESHOLD:
            logger.info("Low conf — Cloud Vision called (model=%s)", _FALLBACK_MODEL)
            raw2  = await _call_vision(image_base64, _ID_CARD_PROMPT, _FALLBACK_MODEL)
            data2 = _parse_json_response(raw2)
            fields = {
                "full_name": data2.get("full_name") or "",
                "id_type":   data2.get("id_type") or "ghana_card",
                "id_number": data2.get("id_number") or "",
                "dob":       data2.get("dob") or "",
            }
            confidence = _calc_confidence(list(fields.values()))
            logger.info("Cloud Vision result confidence=%.3f", confidence)

        return {**fields, "confidence": confidence}

    except Exception as exc:
        logger.error("OCR ID card extraction failed: %s", exc)
        return {"full_name": "", "id_type": "ghana_card", "id_number": "", "dob": "", "confidence": 0.0}


# ── Product label OCR ─────────────────────────────────────────────────────────

_PRODUCT_LABEL_PROMPT = """\
You are a product label reader for a retail shop inventory system.
The image may be a product package, a shelf price tag, a sticker, a handwritten label, or a photo taken in poor lighting.

Your job: extract as much information as you can from ANY visible text in the image.
Even if the image is blurry, partially cut off, or low quality — extract whatever you can read.
Partial or uncertain values are better than null.

Return ONLY a valid JSON object with these fields:

{
  "product_name": "Full product name including size/weight/variant if visible. Combine brand + product type + flavour + weight (e.g. 'Indomie Instant Noodles Chicken 70g'). If only a brand name is visible, use that. String or null.",
  "brand":        "Brand name only (e.g. 'Indomie', 'Milo', 'Cowbell', 'Nestlé'). Infer from logo or product name if clearly recognisable. String or null.",
  "sell_price":   "Retail selling price as a plain number. Search the ENTIRE image for any price: look for 'GH₵', 'GHS', 'Price:', 'P:', 'Retail:', 'MRP', '£', '$', '€' or any sticker with a number. Currency does not matter — extract the number. If image shows a price tag, that is the sell price. Number or null.",
  "quantity":     "Pack count or quantity if visible (e.g. '12 pack' → 12, 'qty: 5' → 5). Integer or null.",
  "barcode":      "Barcode digits if a barcode number string is visible in the image (not the barcode bars — the digits printed below). String or null."
}

Critical rules:
- If ANY readable text appears in the image, fill in at least product_name with your best interpretation.
- For sell_price: ANY visible price number counts. A price sticker, a handwritten number, a till receipt — all valid.
- If the image shows a product you recognise (e.g. a Coca-Cola can, a pack of Indomie) even without clear text, use your knowledge to fill product_name and brand.
- A best guess with low confidence beats null — the user can correct it.
- Return ONLY the JSON object, no markdown, no explanation."""


def _ocr_field(value, conf: float = 0.85) -> dict:
    """Wrap an extracted value in the standard {value, confidence} shape."""
    if value in (None, "", 0):
        return {"value": None, "confidence": 0.0}
    return {"value": value, "confidence": conf}


def parse_sell_price(val) -> int | None:
    """Convert a sell price value to pesawas, handling currency symbols and formats.
    Accepts: 7.00, "7.00", "GH₵7.00", "GHS 7.00", "7,00", "P: 7", "MRP GHS 12.00", etc."""
    if val is None:
        return None
    if isinstance(val, (int, float)):
        return int(round(float(val) * 100)) if float(val) > 0 else None
    import re
    # Strip currency prefixes/suffixes: GH₵, GHS, GH¢, P:, MRP:, ₵, etc.
    s = re.sub(r'[^\d.,]', '', str(val).strip())
    # Normalise comma-as-decimal separator: "7,00" → "7.00"
    if s.count(',') == 1 and s.count('.') == 0:
        s = s.replace(',', '.')
    else:
        s = s.replace(',', '')
    try:
        result = float(s)
        return int(round(result * 100)) if result > 0 else None
    except (ValueError, ZeroDivisionError):
        return None


def build_label_result(data: dict) -> tuple[dict, float]:
    """Parse Claude JSON into field dict. Confidence scored only on the 3 key fields
    (product_name, brand, sell_price) — quantity/barcode are nice-to-have.
    buy_price is never on a retail label so it is not requested or scored."""
    sell_pesawas = parse_sell_price(data.get("sell_price"))

    result = {
        "product_name": _ocr_field(data.get("product_name")),
        "brand":        _ocr_field(data.get("brand")),
        "sell_price":   _ocr_field(sell_pesawas),
        "buy_price":    _ocr_field(None),          # never on a label; kept for schema compat
        "quantity":     _ocr_field(data.get("quantity")),
        "barcode":      _ocr_field(data.get("barcode")),
    }
    # Score only the 3 key fields; buy_price is intentionally excluded
    key_values = [
        result["product_name"]["value"],
        result["brand"]["value"],
        result["sell_price"]["value"],
    ]
    confidence = _calc_confidence(key_values)
    return result, confidence


async def extract_product_label(image_base64: str) -> dict:
    """Extract product details from a label/packaging image."""
    from app.core.config import settings
    if not settings.ANTHROPIC_API_KEY:
        return {"product_name": None, "brand": None, "sell_price": None, "buy_price": None, "quantity": None, "barcode": None, "confidence": 0.0}

    # Product labels: 2/3 key fields is sufficient — threshold 0.60 avoids unnecessary
    # Sonnet calls when product_name + brand are read but price tag is absent.
    _LABEL_THRESHOLD = 0.60

    try:
        raw  = await _call_vision(image_base64, _PRODUCT_LABEL_PROMPT, _PRIMARY_MODEL)
        data = _parse_json_response(raw)
        result, confidence = build_label_result(data)

        logger.info("OCR product label confidence=%.3f model=%s", confidence, _PRIMARY_MODEL)
        if confidence == 0.0:
            logger.warning(
                "OCR label: all fields null after primary model. "
                "Parsed data=%s | Raw response=%.500s",
                data, raw,
            )

        if confidence < _LABEL_THRESHOLD:
            logger.info("Low conf — Cloud Vision called for label (model=%s)", _FALLBACK_MODEL)
            raw2  = await _call_vision(image_base64, _PRODUCT_LABEL_PROMPT, _FALLBACK_MODEL)
            data2 = _parse_json_response(raw2)
            result2, confidence2 = build_label_result(data2)
            # Keep whichever attempt extracted more fields
            if confidence2 >= confidence:
                result, confidence = result2, confidence2
            logger.info("Cloud Vision product label confidence=%.3f", confidence)
            if confidence == 0.0:
                logger.warning(
                    "OCR label: all fields null after fallback model too. "
                    "Parsed data=%s | Raw response=%.500s",
                    data2, raw2,
                )

        result["confidence"] = confidence
        return result

    except Exception as exc:
        logger.error("OCR product label extraction failed: %s", exc)
        return {
            "product_name": {"value": None, "confidence": 0.0},
            "brand":        {"value": None, "confidence": 0.0},
            "sell_price":   {"value": None, "confidence": 0.0},
            "buy_price":    {"value": None, "confidence": 0.0},
            "quantity":     {"value": None, "confidence": 0.0},
            "barcode":      {"value": None, "confidence": 0.0},
            "confidence":   0.0,
        }


# ── Bulk scan OCR ──────────────────────────────────────────────────────────────

_BULK_SCAN_PROMPT = """\
You are a stock-counting assistant for a retail shop.
Count or estimate the number of items visible in this image.
Return ONLY a valid JSON object.

{
  "quantity":   integer,
  "strategy":   "count | estimate",
  "confidence": float between 0.0 and 1.0,
  "notes":      "brief description of what is visible"
}

Return ONLY the JSON object — no explanation, no markdown."""


async def extract_bulk_scan(image_base64: str) -> dict:
    """Count items in an image using Claude Vision with Cloud Vision fallback."""
    from app.core.config import settings
    if not settings.ANTHROPIC_API_KEY:
        logger.warning("ANTHROPIC_API_KEY not set — returning empty bulk scan result")
        return {"quantity": 0, "strategy": "manual", "strategy_label": "Manual Entry", "confidence": 0.0, "fields": []}

    try:
        raw  = await _call_vision(image_base64, _BULK_SCAN_PROMPT, _PRIMARY_MODEL)
        data = _parse_json_response(raw)

        qty        = int(data.get("quantity") or 0)
        confidence = float(data.get("confidence") or 0.0)
        strategy   = data.get("strategy") or "estimate"

        logger.info(
            "OCR bulk scan quantity=%d confidence=%.3f model=%s",
            qty, confidence, _PRIMARY_MODEL,
        )

        if confidence < _FALLBACK_THRESHOLD:
            logger.info("Low conf — Cloud Vision called (model=%s)", _FALLBACK_MODEL)
            raw2   = await _call_vision(image_base64, _BULK_SCAN_PROMPT, _FALLBACK_MODEL)
            data2  = _parse_json_response(raw2)
            qty        = int(data2.get("quantity") or 0)
            confidence = float(data2.get("confidence") or 0.0)
            strategy   = data2.get("strategy") or "estimate"
            logger.info("Cloud Vision result quantity=%d confidence=%.3f", qty, confidence)

        strategy_label = "AI Count" if strategy == "count" else "AI Estimate"

        return {
            "quantity":       qty,
            "strategy":       strategy,
            "strategy_label": strategy_label,
            "confidence":     confidence,
            "fields":         [],
        }

    except Exception as exc:
        logger.error("OCR bulk scan failed: %s", exc)
        return {"quantity": 0, "strategy": "manual", "strategy_label": "Manual Entry", "confidence": 0.0, "fields": []}
