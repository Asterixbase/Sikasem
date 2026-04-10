"""
Unit tests: report calculation logic.

Tests the reconciliation discrepancy logic and stock urgency scoring
that back the daily-reports.tsx panels. Uses plain Python dicts — no DB.
"""


# ══ Reconciliation discrepancy logic ══════════════════════════════════════════
# Mirrors: backend/app/api/reports.py GET /reports/daily-reconciliation
# Logic: for each product, discrepancy = units_sold (POS) - stock_moved (StockMovement type='sale')
# A flag is raised when discrepancy != 0.

class TestReconciliationLogic:

    def _reconcile(self, pos_items: list[dict], stock_items: list[dict]) -> dict:
        """
        Simulate the reconciliation calculation.
        pos_items: [{"product_id": str, "name": str, "emoji": str, "units_sold": int}]
        stock_items: [{"product_id": str, "quantity": int}]  # quantity is negative for sales
        Returns the same structure as the API.
        """
        stock_by_product = {s["product_id"]: abs(s["quantity"]) for s in stock_items}
        items = []
        total_sold = 0
        total_moved = 0
        discrepancy_count = 0

        for pos in pos_items:
            pid = pos["product_id"]
            sold = pos["units_sold"]
            moved = stock_by_product.get(pid, 0)
            diff = sold - moved
            flag = diff != 0
            if flag:
                discrepancy_count += 1
            total_sold += sold
            total_moved += moved
            items.append({
                "product_id": pid,
                "name": pos["name"],
                "emoji": pos.get("emoji", "📦"),
                "units_sold": sold,
                "stock_moved": moved,
                "discrepancy": diff,
                "flag": flag,
            })

        status = "balanced" if discrepancy_count == 0 else "discrepancy"
        return {
            "items": items,
            "summary": {
                "total_sold": total_sold,
                "total_stock_moved": total_moved,
                "discrepancy_count": discrepancy_count,
            },
            "status": status,
        }

    def test_balanced_when_sold_equals_moved(self):
        pos = [{"product_id": "p1", "name": "Indomie", "units_sold": 5}]
        stock = [{"product_id": "p1", "quantity": -5}]
        result = self._reconcile(pos, stock)
        assert result["status"] == "balanced"
        assert result["summary"]["discrepancy_count"] == 0
        assert result["items"][0]["flag"] is False
        assert result["items"][0]["discrepancy"] == 0

    def test_discrepancy_when_sold_exceeds_moved(self):
        pos = [{"product_id": "p1", "name": "Indomie", "units_sold": 5}]
        stock = [{"product_id": "p1", "quantity": -3}]
        result = self._reconcile(pos, stock)
        assert result["status"] == "discrepancy"
        assert result["summary"]["discrepancy_count"] == 1
        assert result["items"][0]["discrepancy"] == 2
        assert result["items"][0]["flag"] is True

    def test_discrepancy_when_moved_exceeds_sold(self):
        pos = [{"product_id": "p1", "name": "Indomie", "units_sold": 3}]
        stock = [{"product_id": "p1", "quantity": -5}]
        result = self._reconcile(pos, stock)
        assert result["items"][0]["discrepancy"] == -2
        assert result["items"][0]["flag"] is True

    def test_product_sold_but_no_stock_movement(self):
        """Stock was sold (POS) but stock log has no entry — should flag."""
        pos = [{"product_id": "p1", "name": "Milo", "units_sold": 4}]
        result = self._reconcile(pos, [])
        assert result["status"] == "discrepancy"
        assert result["items"][0]["stock_moved"] == 0
        assert result["items"][0]["discrepancy"] == 4

    def test_multiple_products_mixed_status(self):
        pos = [
            {"product_id": "p1", "name": "Indomie", "units_sold": 5},
            {"product_id": "p2", "name": "Milo",    "units_sold": 2},
        ]
        stock = [
            {"product_id": "p1", "quantity": -5},
            {"product_id": "p2", "quantity": -3},  # over-moved
        ]
        result = self._reconcile(pos, stock)
        assert result["status"] == "discrepancy"
        assert result["summary"]["discrepancy_count"] == 1
        # p1 balanced
        p1 = next(i for i in result["items"] if i["product_id"] == "p1")
        assert p1["flag"] is False
        # p2 has discrepancy
        p2 = next(i for i in result["items"] if i["product_id"] == "p2")
        assert p2["flag"] is True
        assert p2["discrepancy"] == -1

    def test_all_balanced_summary_totals(self):
        pos = [
            {"product_id": "p1", "name": "A", "units_sold": 3},
            {"product_id": "p2", "name": "B", "units_sold": 7},
        ]
        stock = [
            {"product_id": "p1", "quantity": -3},
            {"product_id": "p2", "quantity": -7},
        ]
        result = self._reconcile(pos, stock)
        assert result["summary"]["total_sold"] == 10
        assert result["summary"]["total_stock_moved"] == 10
        assert result["status"] == "balanced"


# ══ Stock urgency scoring ══════════════════════════════════════════════════════
# Mirrors: backend/app/api/reports.py GET /reports/morning-stock
# Logic: each product is classified as critical / low / healthy

class TestStockUrgency:

    def _classify(self, current_stock: int, avg_daily_sales: float) -> str:
        """
        Replicate the urgency classification from the morning-stock endpoint.
        days_remaining = current_stock / avg_daily_sales if avg_daily_sales > 0 else 999
        critical: days_remaining <= 2 OR current_stock == 0
        low:      days_remaining <= 7 OR current_stock <= 5 (but not critical)
        healthy:  otherwise
        """
        days_remaining = (current_stock / avg_daily_sales) if avg_daily_sales > 0 else 999
        if current_stock == 0 or days_remaining <= 2:
            return "critical"
        if days_remaining <= 7 or current_stock <= 5:
            return "low"
        return "healthy"

    def test_out_of_stock_is_critical(self):
        assert self._classify(0, 5) == "critical"

    def test_two_days_left_is_critical(self):
        # 4 units / 2 per day = 2 days
        assert self._classify(4, 2) == "critical"

    def test_one_day_left_is_critical(self):
        assert self._classify(3, 3) == "critical"

    def test_five_days_left_is_low(self):
        # 10 units / 2 per day = 5 days
        assert self._classify(10, 2) == "low"

    def test_small_stock_regardless_of_velocity_is_low(self):
        # 5 units but very slow sales (50 days remaining) → still LOW due to low absolute stock
        assert self._classify(5, 0.1) == "low"

    def test_healthy_stock(self):
        # 30 units / 2 per day = 15 days > 7, stock > 5
        assert self._classify(30, 2) == "healthy"

    def test_no_sales_velocity_with_good_stock_is_healthy(self):
        # No sales → days_remaining = 999 → healthy
        assert self._classify(100, 0) == "healthy"

    def test_no_sales_velocity_with_zero_stock_is_critical(self):
        assert self._classify(0, 0) == "critical"

    def test_exactly_seven_days_is_low(self):
        # 7 days ≤ 7 → low
        assert self._classify(7, 1) == "low"

    def test_eight_days_is_healthy(self):
        # 8 days > 7, stock > 5 → healthy
        assert self._classify(16, 2) == "healthy"


# ══ Payment breakdown percentage ══════════════════════════════════════════════
# Mirrors: EodPanel payment bar chart in daily-reports.tsx

class TestPaymentBreakdown:

    def _pct(self, amount: int, total: int) -> int:
        if total == 0:
            return 0
        return round((amount / total) * 100)

    def test_all_cash(self):
        assert self._pct(10000, 10000) == 100

    def test_half_cash_half_momo(self):
        assert self._pct(5000, 10000) == 50

    def test_zero_total_returns_zero(self):
        assert self._pct(0, 0) == 0

    def test_percentages_sum_to_100_with_round(self):
        total = 10000
        cash = 5000
        momo = 3000
        credit = 2000
        # Sum of individual percentages should be 100
        assert self._pct(cash, total) + self._pct(momo, total) + self._pct(credit, total) == 100

    def test_no_payment_type_gives_zero(self):
        total = 10000
        assert self._pct(0, total) == 0
