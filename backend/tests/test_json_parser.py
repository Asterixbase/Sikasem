"""
Unit tests: _parse_json_response robustness.

Claude sometimes adds preamble text, markdown fences, or trailing notes.
These tests verify the parser handles all real-world Claude response formats.
"""
import sys, types

if "anthropic" not in sys.modules:
    fake = types.ModuleType("anthropic")
    fake.Anthropic = object
    sys.modules["anthropic"] = fake

from app.services.ocr import _parse_json_response


class TestParseJsonResponse:

    def test_clean_json(self):
        text = '{"product_name": "Indomie", "sell_price": 7.0}'
        result = _parse_json_response(text)
        assert result["product_name"] == "Indomie"

    def test_markdown_fence_json(self):
        text = '```json\n{"product_name": "Milo"}\n```'
        result = _parse_json_response(text)
        assert result["product_name"] == "Milo"

    def test_plain_fence(self):
        text = '```\n{"product_name": "Cowbell"}\n```'
        result = _parse_json_response(text)
        assert result["product_name"] == "Cowbell"

    def test_preamble_text(self):
        """Claude sometimes says 'Here is the extracted data:' before JSON."""
        text = 'Here is the extracted data:\n{"product_name": "Fanta", "sell_price": 3.5}'
        result = _parse_json_response(text)
        assert result["product_name"] == "Fanta"

    def test_trailing_note(self):
        """Claude sometimes adds a note after the JSON block."""
        text = '{"product_name": "Omo", "sell_price": 12.0}\n\nNote: price may vary.'
        result = _parse_json_response(text)
        assert result["product_name"] == "Omo"

    def test_preamble_and_fence(self):
        text = 'Based on the label:\n```json\n{"brand": "Nestlé", "sell_price": 15.0}\n```'
        result = _parse_json_response(text)
        assert result["brand"] == "Nestlé"

    def test_null_values(self):
        text = '{"product_name": null, "brand": null, "sell_price": null}'
        result = _parse_json_response(text)
        assert result["product_name"] is None

    def test_whitespace_padded(self):
        text = '  \n  {"product_name": "Ribena"}  \n  '
        result = _parse_json_response(text)
        assert result["product_name"] == "Ribena"

    def test_empty_response_returns_empty_dict(self):
        """Completely unparseable response → empty dict (not exception)."""
        result = _parse_json_response("Sorry, I cannot process this image.")
        assert result == {}

    def test_nested_json_object(self):
        text = '{"product_name": "Nescafé", "metadata": {"weight": "200g"}}'
        result = _parse_json_response(text)
        assert result["product_name"] == "Nescafé"

    def test_multiline_json(self):
        text = '''```json
{
  "product_name": "Indomie Chicken 70g",
  "brand": "Indomie",
  "sell_price": 7.0,
  "quantity": null
}
```'''
        result = _parse_json_response(text)
        assert result["product_name"] == "Indomie Chicken 70g"
        assert result["sell_price"] == 7.0
