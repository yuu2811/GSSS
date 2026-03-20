"""Morgan Stanley スタイル DCFバリュエーション"""

from .stock_data import StockDataFetcher


class MorganDCF:
    """モルガン・スタンレー流のDCF（割引キャッシュフロー）分析"""

    NAME = "Morgan Stanley DCFバリュエーション"
    DESCRIPTION = "5年間の収益予測、WACC推定、ターミナルバリュー、感度分析"

    @staticmethod
    def analyze(stock_data: dict) -> dict:
        info = stock_data.get("info", {})
        financials = stock_data.get("financials")
        cashflow = stock_data.get("cashflow")
        balance_sheet = stock_data.get("balance_sheet")
        ticker = stock_data.get("ticker", "N/A")
        company_name = StockDataFetcher.get_display_name(info, ticker)

        current_price = StockDataFetcher.get_current_price(info)
        shares_outstanding = info.get("sharesOutstanding", 0)
        market_cap = info.get("marketCap", 0)

        # 過去の財務データ抽出
        historical = MorganDCF._extract_historical(financials, cashflow)

        # 5年間の収益予測
        projections = MorganDCF._project_revenue(historical, info)

        # FCF予測
        fcf_projections = MorganDCF._project_fcf(projections, historical, info)

        # WACC推定
        wacc = MorganDCF._estimate_wacc(info)

        # ターミナルバリュー
        terminal_value = MorganDCF._terminal_value(fcf_projections, wacc)

        # 企業価値・株式価値計算
        valuation = MorganDCF._calculate_valuation(
            fcf_projections, terminal_value, wacc, info, shares_outstanding
        )

        # 感度分析
        sensitivity = MorganDCF._sensitivity_analysis(
            fcf_projections, wacc, info, shares_outstanding
        )

        # 判定
        verdict = MorganDCF._verdict(valuation, current_price, wacc)

        return {
            "analyzer": MorganDCF.NAME,
            "company_name": company_name,
            "ticker": ticker,
            "current_price": current_price,
            "shares_outstanding": shares_outstanding,
            "market_cap": market_cap,
            "historical": historical,
            "projections": projections,
            "fcf_projections": fcf_projections,
            "wacc": wacc,
            "terminal_value": terminal_value,
            "valuation": valuation,
            "sensitivity": sensitivity,
            "verdict": verdict,
        }

    @staticmethod
    def _extract_historical(financials, cashflow):
        result = {"revenue": [], "operating_income": [], "net_income": [], "fcf": []}

        if financials is not None and not financials.empty:
            for row_name, key in [("Total Revenue", "revenue"),
                                   ("Operating Income", "operating_income"),
                                   ("Net Income", "net_income")]:
                if row_name in financials.index:
                    vals = financials.loc[row_name].dropna().sort_index()
                    result[key] = [{"year": str(d)[:4], "value": float(v)} for d, v in zip(vals.index, vals.values)]

        if cashflow is not None and not cashflow.empty:
            if "Free Cash Flow" in cashflow.index:
                vals = cashflow.loc["Free Cash Flow"].dropna().sort_index()
                result["fcf"] = [{"year": str(d)[:4], "value": float(v)} for d, v in zip(vals.index, vals.values)]

        return result

    @staticmethod
    def _project_revenue(historical, info):
        rev_hist = historical.get("revenue", [])

        # 成長率の推定
        rev_growth = info.get("revenueGrowth")
        if rev_growth:
            base_growth = rev_growth if rev_growth < 1 else rev_growth / 100
        elif len(rev_hist) >= 2:
            latest = rev_hist[-1]["value"]
            prev = rev_hist[-2]["value"]
            base_growth = (latest / prev - 1) if prev > 0 else 0.05
        else:
            base_growth = 0.05

        # 成長率の逓減（保守的）
        growth_rates = []
        for i in range(5):
            rate = base_growth * (1 - i * 0.1)  # 毎年10%ずつ成長率低下
            rate = max(rate, 0.02)  # 最低2%
            growth_rates.append(rate)

        # 直近の売上高
        if rev_hist:
            base_revenue = rev_hist[-1]["value"]
            base_year = int(rev_hist[-1]["year"])
        else:
            base_revenue = info.get("totalRevenue", 0)
            base_year = 2024

        projections = []
        revenue = base_revenue
        for i, rate in enumerate(growth_rates):
            revenue = revenue * (1 + rate)
            projections.append({
                "year": base_year + i + 1,
                "revenue": round(revenue, 0),
                "growth_rate_pct": round(rate * 100, 1),
            })

        return {
            "base_revenue": base_revenue,
            "base_year": base_year,
            "growth_assumption": f"初年度{base_growth*100:.1f}%から逓減",
            "yearly": projections,
        }

    @staticmethod
    def _project_fcf(projections, historical, info):
        # FCFマージンの推定
        fcf_hist = historical.get("fcf", [])
        rev_hist = historical.get("revenue", [])

        if fcf_hist and rev_hist and len(fcf_hist) > 0 and len(rev_hist) > 0:
            latest_fcf = fcf_hist[-1]["value"]
            latest_rev = rev_hist[-1]["value"]
            fcf_margin = latest_fcf / latest_rev if latest_rev > 0 else 0.08
        else:
            # デフォルトのFCFマージン
            op_margin = info.get("operatingMargins", 0.10)
            if op_margin is not None and op_margin < 1:
                fcf_margin = op_margin * 0.7  # 営業利益率の70%をFCFマージンと推定
            else:
                fcf_margin = 0.08

        fcf_margin = max(fcf_margin, 0.03)  # 最低3%

        yearly = projections.get("yearly", [])
        fcf_projections = []

        for p in yearly:
            fcf = p["revenue"] * fcf_margin
            fcf_projections.append({
                "year": p["year"],
                "fcf": round(fcf, 0),
                "fcf_margin_pct": round(fcf_margin * 100, 1),
            })

        return {
            "fcf_margin_assumption": round(fcf_margin * 100, 1),
            "yearly": fcf_projections,
        }

    @staticmethod
    def _estimate_wacc(info):
        beta = info.get("beta", 1.0) or 1.0

        risk_free_rate = 0.01  # 日本10年国債（約1%）
        market_premium = 0.06  # 株式リスクプレミアム
        cost_of_equity = risk_free_rate + beta * market_premium

        de_ratio = info.get("debtToEquity")  # _enrich_infoで小数形式に正規化済み
        de = de_ratio if de_ratio is not None else 0.3

        cost_of_debt = 0.015  # 日本企業の平均借入金利
        tax_rate = 0.30  # 実効税率

        equity_weight = 1 / (1 + de)
        debt_weight = de / (1 + de)

        wacc = equity_weight * cost_of_equity + debt_weight * cost_of_debt * (1 - tax_rate)

        return {
            "wacc_pct": round(wacc * 100, 2),
            "cost_of_equity_pct": round(cost_of_equity * 100, 2),
            "cost_of_debt_pct": round(cost_of_debt * 100, 2),
            "beta": round(beta, 2),
            "risk_free_rate_pct": round(risk_free_rate * 100, 2),
            "equity_risk_premium_pct": round(market_premium * 100, 2),
            "debt_equity_ratio": round(de, 2),
            "tax_rate_pct": round(tax_rate * 100, 0),
        }

    @staticmethod
    def _terminal_value(fcf_projections, wacc):
        yearly = fcf_projections.get("yearly", [])
        if not yearly:
            return {"exit_multiple": {}, "perpetuity_growth": {}}

        last_fcf = yearly[-1]["fcf"]
        wacc_rate = wacc["wacc_pct"] / 100

        # 永続成長法
        terminal_growth = 0.015  # 1.5%永続成長
        if wacc_rate > terminal_growth:
            tv_perpetuity = last_fcf * (1 + terminal_growth) / (wacc_rate - terminal_growth)
        else:
            tv_perpetuity = last_fcf * 20

        # マルチプル法
        ev_ebitda_multiple = 10  # 標準的なEV/EBITDA倍率
        tv_multiple = last_fcf * ev_ebitda_multiple / 0.7  # FCFからEBITDAを逆算（概算）

        return {
            "perpetuity_growth": {
                "terminal_value": round(tv_perpetuity, 0),
                "growth_rate_pct": round(terminal_growth * 100, 1),
                "method": "永続成長モデル (Gordon Growth Model)",
            },
            "exit_multiple": {
                "terminal_value": round(tv_multiple, 0),
                "multiple": ev_ebitda_multiple,
                "method": f"EV/EBITDA {ev_ebitda_multiple}x出口マルチプル",
            },
        }

    @staticmethod
    def _calculate_valuation(fcf_projections, terminal_value, wacc, info, shares):
        yearly = fcf_projections.get("yearly", [])
        wacc_rate = wacc["wacc_pct"] / 100

        # FCFの現在価値
        pv_fcfs = []
        total_pv_fcf = 0
        for i, y in enumerate(yearly):
            discount = (1 + wacc_rate) ** (i + 1)
            pv = y["fcf"] / discount
            pv_fcfs.append({"year": y["year"], "fcf": y["fcf"], "pv": round(pv, 0)})
            total_pv_fcf += pv

        # ターミナルバリューの現在価値
        n = len(yearly)
        tv_perp = terminal_value.get("perpetuity_growth", {}).get("terminal_value", 0)
        tv_mult = terminal_value.get("exit_multiple", {}).get("terminal_value", 0)

        pv_tv_perp = tv_perp / ((1 + wacc_rate) ** n) if n > 0 else 0
        pv_tv_mult = tv_mult / ((1 + wacc_rate) ** n) if n > 0 else 0

        # 企業価値
        ev_perp = total_pv_fcf + pv_tv_perp
        ev_mult = total_pv_fcf + pv_tv_mult

        # 株式価値
        net_debt = (info.get("totalDebt", 0) or 0) - (info.get("totalCash", 0) or 0)

        equity_perp = ev_perp - net_debt
        equity_mult = ev_mult - net_debt

        # 1株あたり価値
        per_share_perp = equity_perp / shares if shares > 0 else 0
        per_share_mult = equity_mult / shares if shares > 0 else 0
        per_share_avg = (per_share_perp + per_share_mult) / 2

        return {
            "pv_fcfs": pv_fcfs,
            "total_pv_fcf": round(total_pv_fcf, 0),
            "pv_terminal_perpetuity": round(pv_tv_perp, 0),
            "pv_terminal_multiple": round(pv_tv_mult, 0),
            "enterprise_value_perpetuity": round(ev_perp, 0),
            "enterprise_value_multiple": round(ev_mult, 0),
            "net_debt": round(net_debt, 0),
            "equity_value_perpetuity": round(equity_perp, 0),
            "equity_value_multiple": round(equity_mult, 0),
            "per_share_perpetuity": round(per_share_perp, 0),
            "per_share_multiple": round(per_share_mult, 0),
            "per_share_average": round(per_share_avg, 0),
        }

    @staticmethod
    def _sensitivity_analysis(fcf_projections, wacc, info, shares):
        base_wacc = wacc["wacc_pct"] / 100
        yearly = fcf_projections.get("yearly", [])
        net_debt = (info.get("totalDebt", 0) or 0) - (info.get("totalCash", 0) or 0)

        wacc_range = [base_wacc - 0.02, base_wacc - 0.01, base_wacc, base_wacc + 0.01, base_wacc + 0.02]
        growth_range = [0.005, 0.010, 0.015, 0.020, 0.025]

        table = []
        for w in wacc_range:
            row = {"wacc_pct": round(w * 100, 1)}
            for g in growth_range:
                # 簡易DCF計算
                total_pv = 0
                for i, y in enumerate(yearly):
                    total_pv += y["fcf"] / ((1 + w) ** (i + 1))

                if yearly and w > g:
                    last_fcf = yearly[-1]["fcf"]
                    tv = last_fcf * (1 + g) / (w - g)
                    pv_tv = tv / ((1 + w) ** len(yearly))
                    ev = total_pv + pv_tv
                else:
                    ev = total_pv + (yearly[-1]["fcf"] * 20 if yearly else 0)

                equity = ev - net_debt
                per_share = equity / shares if shares > 0 else 0
                row[f"g_{g*100:.1f}%"] = round(per_share, 0)

            table.append(row)

        return {
            "table": table,
            "wacc_range": [f"{w*100:.1f}%" for w in wacc_range],
            "growth_range": [f"{g*100:.1f}%" for g in growth_range],
            "note": "WACC（横軸）と永続成長率（縦軸）の組み合わせによる1株あたり理論価値",
        }

    @staticmethod
    def _verdict(valuation, current_price, wacc):
        fair_value = valuation.get("per_share_average", 0)

        if not current_price or not fair_value:
            return {"verdict": "判定不可", "details": "データ不足"}

        upside = ((fair_value / current_price) - 1) * 100

        if upside > 30:
            verdict = "大幅に割安"
            recommendation = "強い買い推奨"
        elif upside > 10:
            verdict = "割安"
            recommendation = "買い推奨"
        elif upside > -10:
            verdict = "適正価格"
            recommendation = "保持"
        elif upside > -20:
            verdict = "やや割高"
            recommendation = "利益確定検討"
        else:
            verdict = "割高"
            recommendation = "売り推奨"

        return {
            "verdict": verdict,
            "recommendation": recommendation,
            "fair_value": round(fair_value, 0),
            "current_price": round(current_price, 0),
            "upside_pct": round(upside, 1),
            "key_assumptions": [
                f"WACC: {wacc.get('wacc_pct', 0):.1f}%に基づく割引",
                "成長率は逓減モデル（保守的）",
                "ターミナルバリューは永続成長法とマルチプル法の平均",
            ],
        }
