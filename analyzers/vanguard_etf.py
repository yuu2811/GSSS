"""Vanguard スタイル ETFポートフォリオ構築"""

import numpy as np


class VanguardETF:
    """バンガード流のETFポートフォリオ構築"""

    NAME = "Vanguard ETFポートフォリオ"
    DESCRIPTION = "アセットアロケーション、ETF選定、リバランスルール、税務最適化"

    # 日本で購入可能な主要ETF
    RECOMMENDED_ETFS = {
        "日本株式": [
            {"ticker": "1306.T", "name": "TOPIX連動型上場投信", "expense": 0.066, "category": "国内株式"},
            {"ticker": "1321.T", "name": "日経225連動型上場投信", "expense": 0.198, "category": "国内株式"},
            {"ticker": "1478.T", "name": "iシェアーズ MSCI ジャパン高配当利回り", "expense": 0.209, "category": "国内高配当"},
        ],
        "先進国株式": [
            {"ticker": "1550.T", "name": "MAXIS 海外株式（MSCIコクサイ）", "expense": 0.165, "category": "先進国株式"},
            {"ticker": "2559.T", "name": "MAXIS 全世界株式", "expense": 0.078, "category": "全世界株式"},
        ],
        "新興国株式": [
            {"ticker": "1681.T", "name": "上場インデックスファンド海外新興国株式", "expense": 0.264, "category": "新興国株式"},
        ],
        "日本債券": [
            {"ticker": "2510.T", "name": "NEXT FUNDS 国内債券", "expense": 0.077, "category": "国内債券"},
        ],
        "外国債券": [
            {"ticker": "2511.T", "name": "NEXT FUNDS 外国債券", "expense": 0.132, "category": "先進国債券"},
        ],
        "REIT": [
            {"ticker": "1343.T", "name": "NEXT FUNDS 東証REIT指数連動", "expense": 0.155, "category": "国内REIT"},
            {"ticker": "2515.T", "name": "NEXT FUNDS 外国REIT", "expense": 0.187, "category": "先進国REIT"},
        ],
    }

    RISK_PROFILES = {
        "積極型": {"stocks": 80, "bonds": 10, "reit": 10},
        "やや積極型": {"stocks": 65, "bonds": 25, "reit": 10},
        "バランス型": {"stocks": 50, "bonds": 40, "reit": 10},
        "やや保守型": {"stocks": 35, "bonds": 55, "reit": 10},
        "保守型": {"stocks": 20, "bonds": 70, "reit": 10},
    }

    @staticmethod
    def analyze(stock_data: dict = None, risk_profile: str = "バランス型",
                investment_amount: float = 1_000_000, age: int = 40) -> dict:

        # リスクプロファイル判定
        if age < 30:
            suggested_profile = "積極型"
        elif age < 40:
            suggested_profile = "やや積極型"
        elif age < 50:
            suggested_profile = "バランス型"
        elif age < 60:
            suggested_profile = "やや保守型"
        else:
            suggested_profile = "保守型"

        profile = risk_profile if risk_profile in VanguardETF.RISK_PROFILES else suggested_profile
        allocation = VanguardETF.RISK_PROFILES[profile]

        # 詳細アロケーション
        detailed = VanguardETF._detailed_allocation(allocation)

        # ETF選定
        etf_picks = VanguardETF._select_etfs(detailed, investment_amount)

        # 期待リターン
        expected_return = VanguardETF._expected_return(allocation)

        # リバランスルール
        rebalance = VanguardETF._rebalance_rules(profile)

        # 税務最適化
        tax = VanguardETF._tax_optimization(etf_picks)

        # DCA計画
        dca = VanguardETF._dca_plan(investment_amount, etf_picks)

        return {
            "analyzer": VanguardETF.NAME,
            "risk_profile": profile,
            "suggested_profile": suggested_profile,
            "age": age,
            "investment_amount": investment_amount,
            "allocation": allocation,
            "detailed_allocation": detailed,
            "etf_picks": etf_picks,
            "expected_return": expected_return,
            "rebalance_rules": rebalance,
            "tax_optimization": tax,
            "dca_plan": dca,
        }

    @staticmethod
    def _detailed_allocation(allocation):
        stocks = allocation["stocks"]
        bonds = allocation["bonds"]
        reit = allocation["reit"]

        return {
            "日本株式": round(stocks * 0.40, 1),
            "先進国株式": round(stocks * 0.45, 1),
            "新興国株式": round(stocks * 0.15, 1),
            "日本債券": round(bonds * 0.50, 1),
            "外国債券": round(bonds * 0.50, 1),
            "国内REIT": round(reit * 0.50, 1),
            "海外REIT": round(reit * 0.50, 1),
        }

    @staticmethod
    def _select_etfs(detailed, investment_amount):
        picks = []
        for category, pct in detailed.items():
            amount = investment_amount * pct / 100

            # カテゴリに対応するETFを選択
            for group_name, etfs in VanguardETF.RECOMMENDED_ETFS.items():
                for etf in etfs:
                    if category in etf["category"] or group_name == category:
                        picks.append({
                            "ticker": etf["ticker"],
                            "name": etf["name"],
                            "category": category,
                            "allocation_pct": pct,
                            "amount": round(amount, 0),
                            "expense_ratio": etf["expense"],
                        })
                        break
                else:
                    continue
                break

        return picks

    @staticmethod
    def _expected_return(allocation):
        # 長期期待リターン（ヒストリカルベース）
        expected = {
            "stocks": 0.07,  # 年率7%
            "bonds": 0.02,   # 年率2%
            "reit": 0.05,    # 年率5%
        }

        weighted = sum(
            allocation[k] / 100 * expected[k] for k in expected
        )

        return {
            "expected_annual_return_pct": round(weighted * 100, 1),
            "best_year_estimate_pct": round(weighted * 100 + 20, 1),
            "worst_year_estimate_pct": round(weighted * 100 - 25, 1),
            "assumptions": {
                "株式リターン": "年率7%（長期平均）",
                "債券リターン": "年率2%",
                "REITリターン": "年率5%",
            },
        }

    @staticmethod
    def _rebalance_rules(profile):
        if profile in ["積極型", "やや積極型"]:
            threshold = 5
            frequency = "四半期"
        else:
            threshold = 3
            frequency = "半年"

        return {
            "frequency": frequency,
            "threshold_pct": threshold,
            "rules": [
                f"目標配分から±{threshold}%以上乖離した場合にリバランス実施",
                f"定期リバランスは{frequency}ごと",
                "急落時の追加投資はリバランスの好機",
                "取引コストを考慮し、小さな乖離は許容",
            ],
        }

    @staticmethod
    def _tax_optimization(etf_picks):
        nisa_recommended = []
        tokutei_recommended = []

        for pick in etf_picks:
            if "株式" in pick["category"] or "REIT" in pick["category"]:
                nisa_recommended.append(pick["name"])
            else:
                tokutei_recommended.append(pick["name"])

        return {
            "nisa_account": {
                "recommended": nisa_recommended,
                "reason": "成長が期待される資産はNISAで非課税メリットを最大化",
            },
            "tokutei_account": {
                "recommended": tokutei_recommended,
                "reason": "債券等の安定資産は特定口座で管理",
            },
            "notes": [
                "新NISA（2024年〜）: 成長投資枠240万円/年、つみたて投資枠120万円/年",
                "iDeCo: 所得控除メリットあり。60歳まで引き出し不可",
            ],
        }

    @staticmethod
    def _dca_plan(investment_amount, etf_picks):
        monthly = investment_amount / 12

        plan = []
        for pick in etf_picks:
            monthly_amount = monthly * pick["allocation_pct"] / 100
            plan.append({
                "etf": pick["name"],
                "ticker": pick["ticker"],
                "monthly_amount": round(monthly_amount, 0),
            })

        return {
            "total_monthly": round(monthly, 0),
            "allocation": plan,
            "strategy": "毎月定額積立（ドルコスト平均法）により、価格変動リスクを分散",
        }
