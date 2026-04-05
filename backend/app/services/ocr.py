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


async def _call_vision(image_base64: str, prompt: str, model: str) -> str:
    """Send an image + prompt to Claude and return the text response."""
    from anthropic import AsyncAnthropic
    from app.core.config import settings

    raw_b64   = _strip_data_url(image_base64)
    media_type = _detect_media_type(image_base64)

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
    """Extract JSON from Claude response, stripping markdown fences if present."""
    text = text.strip()
    if text.startswith("```"):
        lines = text.splitlines()
        text = "\n".join(
            l for l in lines
            if not l.startswith("```")
        ).strip()
    return json.loads(text)


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
You are a product label reader for a Ghanaian retail shop inventory system.
Examine the image carefully — it may be a product package, a shelf price tag, a sticker, or a handwritten label.

Extract every field you can read and return ONLY a valid JSON object with these fields:

{
  "product_name": "Full product name including size/weight/variant (e.g. 'Indomie Instant Noodles Chicken 70g'). String or null.",
  "brand":        "Brand name only (e.g. 'Indomie', 'Milo', 'Cowbell'). String or null.",
  "sell_price":   "Retail selling price in GHS as a number (e.g. 1.50). Look for 'GH₵', 'GHS', 'Price', 'P:' or any visible price. Number or null.",
  "buy_price":    null,
  "quantity":     "If a count or pack size is visible (e.g. '12 pack', 'qty: 5') return that integer. Otherwise null.",
  "barcode":      "If a barcode number is visible (EAN-13 or similar), return the digits as a string. Otherwise null."
}

Important rules:
- product_name: be thorough — include the brand, product type, flavour, and weight/volume if visible.
- sell_price: look anywhere on the label for a price. Ghanaian prices are in GHS (Ghana Cedis). Common formats: 'GH₵1.50', '1.50', 'GHS 1.50', 'P: 1.50'.
- If you are not sure about a value, still include your best guess — a rough value is more useful than null.
- Do NOT add commentary. Return ONLY the JSON object."""


async def extract_product_label(image_base64: str) -> dict:
    """Extract product details from a label/packaging image."""
    from app.core.config import settings
    if not settings.ANTHROPIC_API_KEY:
        return {"product_name": None, "brand": None, "sell_price": None, "buy_price": None, "quantity": None, "barcode": None, "confidence": 0.0}

    def field(value, conf=0.85):
        if value in (None, "", 0):
            return {"value": None, "confidence": 0.0}
        return {"value": value, "confidence": conf}

    try:
        raw  = await _call_vision(image_base64, _PRODUCT_LABEL_PROMPT, _PRIMARY_MODEL)
        data = _parse_json_response(raw)

        sell_p = data.get("sell_price")
        sell_pesawas = int(round(float(sell_p) * 100)) if sell_p else None

        result = {
            "product_name": field(data.get("product_name")),
            "brand":        field(data.get("brand")),
            "sell_price":   field(sell_pesawas),
            "buy_price":    field(None),
            "quantity":     field(data.get("quantity")),
            "barcode":      field(data.get("barcode")),
        }
        values = [f["value"] for f in result.values()]
        confidence = _calc_confidence(values)

        logger.info("OCR product label confidence=%.3f model=%s", confidence, _PRIMARY_MODEL)

        if confidence < _FALLBACK_THRESHOLD:
            raw2  = await _call_vision(image_base64, _PRODUCT_LABEL_PROMPT, _FALLBACK_MODEL)
            data2 = _parse_json_response(raw2)
            sell_p2 = data2.get("sell_price")
            sell_pesawas2 = int(round(float(sell_p2) * 100)) if sell_p2 else None
            result = {
                "product_name": field(data2.get("product_name")),
                "brand":        field(data2.get("brand")),
                "sell_price":   field(sell_pesawas2),
                "buy_price":    field(None),
                "quantity":     field(data2.get("quantity")),
                "barcode":      field(data2.get("barcode")),
            }
            confidence = _calc_confidence([f["value"] for f in result.values()])
            logger.info("Cloud Vision product label confidence=%.3f", confidence)

        result["confidence"] = confidence
        return result

    except Exception as exc:
        logger.error("OCR product label extraction failed: %s", exc)
        return {"product_name": {"value": None, "confidence": 0.0}, "brand": {"value": None, "confidence": 0.0}, "sell_price": {"value": None, "confidence": 0.0}, "buy_price": {"value": None, "confidence": 0.0}, "quantity": {"value": None, "confidence": 0.0}, "barcode": {"value": None, "confidence": 0.0}, "confidence": 0.0}


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
