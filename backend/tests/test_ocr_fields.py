"""
Unit tests: OCR field extraction and price parsing.

Tests the parse_sell_price helper and build_label_result logic
without hitting the Anthropic API. Validates that:
  - Currency symbols are stripped correctly
  - Price is converted to pesawas
  - field() helper wraps values correctly
  - Confidence scoring works as expected
  - Frontend field-mapping contract is satisfied
"""
import sys, types

# ── Patch anthropic so the module loads without an API key ─────────────────────
if "anthropic" not in sys.modules:
    fake = types.ModuleType("anthropic")
    fake.Anthropic = object
    sys.modules["anthropic"] = fake

# ── Import the public helpers from the refactored OCR service ─────────────────
from app.services.ocr import parse_sell_price, build_label_result


# ══ parse_sell_price tests ════════════════════════════════════════════════════

class TestParseSellPrice:

    def test_integer_ghs_converts_to_pesawas(self):
        assert parse_sell_price(7) == 700

    def test_float_ghs_converts_to_pesawas(self):
        assert parse_sell_price(7.5) == 750

    def test_string_float(self):
        assert parse_sell_price("7.00") == 700

    def test_currency_symbol_ghs(self):
        assert parse_sell_price("GHS 7.00") == 700

    def test_currency_symbol_gha_cedi(self):
        assert parse_sell_price("GH₵7.50") == 750

    def test_comma_decimal_separator(self):
        # "7,50" — one comma, no dot → treat comma as decimal point
        assert parse_sell_price("7,50") == 750

    def test_thousands_separator(self):
        # "1,200.00" — comma as thousands separator
        assert parse_sell_price("1,200.00") == 120_000

    def test_price_with_label(self):
        assert parse_sell_price("P: 7") == 700

    def test_mpr_prefix(self):
        assert parse_sell_price("MRP GHS 12.00") == 1200

    def test_none_returns_none(self):
        assert parse_sell_price(None) is None

    def test_zero_returns_none(self):
        assert parse_sell_price(0) is None

    def test_zero_string_returns_none(self):
        assert parse_sell_price("0.00") is None

    def test_negative_returns_none(self):
        assert parse_sell_price(-5) is None

    def test_non_numeric_string_returns_none(self):
        assert parse_sell_price("N/A") is None

    def test_retail_prefix(self):
        assert parse_sell_price("Retail: GH₵ 3.50") == 350

    def test_plain_int_string(self):
        assert parse_sell_price("12") == 1200


# ══ build_label_result tests ══════════════════════════════════════════════════

class TestBuildLabelResult:

    def _r(self, data: dict):
        return build_label_result(data)

    def test_full_product_data(self):
        data = {"product_name": "Indomie Chicken 70g", "brand": "Indomie", "sell_price": "7.00"}
        result, conf = self._r(data)
        assert result["product_name"]["value"] == "Indomie Chicken 70g"
        assert result["brand"]["value"] == "Indomie"
        assert result["sell_price"]["value"] == 700
        assert result["buy_price"]["value"] is None  # never on retail label
        assert conf > 0.5

    def test_two_of_three_key_fields_passes_threshold(self):
        # product_name + brand but no price — confidence should be ~0.67
        data = {"product_name": "Milo 400g", "brand": "Nestlé", "sell_price": None}
        result, conf = self._r(data)
        # 0.60 threshold for labels — 0.67 > 0.60 so no Sonnet fallback needed
        assert conf >= 0.60

    def test_only_one_key_field_below_threshold(self):
        data = {"product_name": "Unknown", "brand": None, "sell_price": None}
        result, conf = self._r(data)
        assert conf < 0.60

    def test_sell_price_currency_stripped(self):
        data = {"product_name": "Cowbell 400g", "brand": "Cowbell", "sell_price": "GH₵15.00"}
        result, _ = self._r(data)
        assert result["sell_price"]["value"] == 1500

    def test_quantity_extracted(self):
        data = {"product_name": "Fanta", "brand": "Fanta", "sell_price": "3.00", "quantity": 24}
        result, _ = self._r(data)
        assert result["quantity"]["value"] == 24

    def test_empty_data_all_null(self):
        data = {}
        result, conf = self._r(data)
        assert result["product_name"]["value"] is None
        assert result["sell_price"]["value"] is None
        assert conf == 0.0

    def test_sell_price_absent_gives_null(self):
        data = {"product_name": "omo", "brand": "Unilever"}
        result, _ = self._r(data)
        assert result["sell_price"]["value"] is None

    def test_all_three_key_fields_max_confidence(self):
        data = {"product_name": "Something", "brand": "Brand", "sell_price": "5.00"}
        _, conf = self._r(data)
        assert conf == 1.0  # 3/3 fields present


# ══ Frontend field-mapping contract ══════════════════════════════════════════
# These tests mirror the logic in scan-result.tsx to verify the contract between
# backend OCR output and the frontend form field population.
#
# scan-result.tsx lines 79-99 (useFocusEffect):
#   ocr.product_name.value  → name field (string)
#   ocr.brand.value         → brand field (string)
#   ocr.sell_price.value    → sellPrice (pesawas ÷ 100 → GHS string "7.00")
#   ocr.buy_price.value     → buyPrice  (pesawas ÷ 100 → GHS string, always blank for labels)
#   ocr.quantity.value      → stock field (integer string)

class TestFrontendFieldMappingContract:

    def _populate(self, ocr_result: dict) -> dict:
        """Simulate the scan-result.tsx useFocusEffect field-population logic."""
        fields = {"name": "", "brand": "", "sell_price": "", "buy_price": "", "stock": "1"}
        if ocr_result.get("product_name", {}).get("value"):
            fields["name"] = str(ocr_result["product_name"]["value"])
        if ocr_result.get("brand", {}).get("value"):
            fields["brand"] = str(ocr_result["brand"]["value"])
        sell = ocr_result.get("sell_price", {}).get("value")
        if sell is not None and float(sell) > 0:
            fields["sell_price"] = f"{float(sell) / 100:.2f}"
        buy = ocr_result.get("buy_price", {}).get("value")
        if buy is not None and float(buy) > 0:
            fields["buy_price"] = f"{float(buy) / 100:.2f}"
        qty = ocr_result.get("quantity", {}).get("value")
        if qty:
            fields["stock"] = str(qty)
        return fields

    def test_full_label_populates_correctly(self):
        data = {"product_name": "Indomie Chicken 70g", "brand": "Indomie", "sell_price": "7.00"}
        result, _ = build_label_result(data)
        fields = self._populate(result)
        assert fields["name"] == "Indomie Chicken 70g"
        assert fields["brand"] == "Indomie"
        assert fields["sell_price"] == "7.00"
        assert fields["buy_price"] == ""  # never on retail label

    def test_pesawas_to_ghs_conversion(self):
        """Backend returns pesawas; frontend divides by 100 for GHS display."""
        data = {"product_name": "Milo", "brand": "Nestlé", "sell_price": "GHS 15.50"}
        result, _ = build_label_result(data)
        fields = self._populate(result)
        assert fields["sell_price"] == "15.50"

    def test_no_price_leaves_sell_price_blank(self):
        """When price tag is absent, sell_price stays blank — user must fill in."""
        data = {"product_name": "Generic Item", "brand": "Brand X", "sell_price": None}
        result, _ = build_label_result(data)
        fields = self._populate(result)
        assert fields["sell_price"] == ""

    def test_quantity_populates_stock(self):
        data = {"product_name": "Fanta 330ml", "brand": "Fanta", "sell_price": "3.50", "quantity": 12}
        result, _ = build_label_result(data)
        fields = self._populate(result)
        assert fields["stock"] == "12"

    def test_empty_ocr_leaves_all_fields_blank(self):
        data = {}
        result, _ = build_label_result(data)
        fields = self._populate(result)
        assert fields["name"] == ""
        assert fields["sell_price"] == ""
        assert fields["stock"] == "1"  # default

    def test_high_value_product(self):
        """GHS 150 = 15000 pesawas → display "150.00"."""
        data = {"product_name": "Hair Dryer", "brand": "Remington", "sell_price": "GH₵150.00"}
        result, _ = build_label_result(data)
        fields = self._populate(result)
        assert fields["sell_price"] == "150.00"
