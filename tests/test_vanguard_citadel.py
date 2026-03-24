"""Tests for VanguardETF and CitadelSector analyzers."""

from analyzers.vanguard_etf import VanguardETF


class TestVanguardETF:
    def test_smoke(self):
        result = VanguardETF.analyze()
        assert result["analyzer"] == VanguardETF.NAME
        assert "allocation" in result
        assert "etf_picks" in result
        assert "expected_return" in result

    def test_risk_profile_selection(self):
        result = VanguardETF.analyze(risk_profile="積極型")
        assert result["risk_profile"] == "積極型"
        assert result["allocation"]["stocks"] == 80

    def test_conservative_profile(self):
        result = VanguardETF.analyze(risk_profile="保守型")
        assert result["allocation"]["stocks"] == 20
        assert result["allocation"]["bonds"] == 70

    def test_age_based_suggestion(self):
        result = VanguardETF.analyze(age=25)
        assert result["suggested_profile"] == "積極型"

        result = VanguardETF.analyze(age=55)
        assert result["suggested_profile"] == "やや保守型"

        result = VanguardETF.analyze(age=65)
        assert result["suggested_profile"] == "保守型"

    def test_invalid_risk_profile_falls_back(self):
        result = VanguardETF.analyze(risk_profile="invalid", age=25)
        assert result["risk_profile"] == "積極型"  # fallback to age-suggested

    def test_investment_amount(self):
        result = VanguardETF.analyze(investment_amount=5_000_000)
        assert result["investment_amount"] == 5_000_000
        total_etf_amount = sum(p["amount"] for p in result["etf_picks"])
        assert abs(total_etf_amount - 5_000_000) < 100  # rounding tolerance

    def test_detailed_allocation_sums(self):
        result = VanguardETF.analyze(risk_profile="バランス型")
        detailed = result["detailed_allocation"]
        total = sum(detailed.values())
        assert abs(total - 100) < 1  # should sum to ~100%

    def test_etf_picks_have_required_fields(self):
        result = VanguardETF.analyze()
        for pick in result["etf_picks"]:
            assert "ticker" in pick
            assert "name" in pick
            assert "category" in pick
            assert "allocation_pct" in pick
            assert "amount" in pick
            assert "expense_ratio" in pick

    def test_dca_plan(self):
        result = VanguardETF.analyze(investment_amount=1_200_000)
        dca = result["dca_plan"]
        assert dca["total_monthly"] == 100_000

    def test_tax_optimization(self):
        result = VanguardETF.analyze()
        tax = result["tax_optimization"]
        assert "nisa_account" in tax
        assert "tokutei_account" in tax

    def test_expected_return_structure(self):
        result = VanguardETF.analyze()
        er = result["expected_return"]
        assert "expected_annual_return_pct" in er
        assert er["expected_annual_return_pct"] > 0


class TestVanguardCategoryMap:
    def test_all_categories_mapped(self):
        allocation = VanguardETF._detailed_allocation({"stocks": 50, "bonds": 40, "reit": 10})
        for cat in allocation:
            assert cat in VanguardETF._CATEGORY_MAP, f"Category {cat} not in _CATEGORY_MAP"
