"""BlackRock スタイル 配当インカム分析"""

from .stock_data import StockDataFetcher


class BlackRockDividend:
    """ブラックロック流の配当分析"""

    NAME = "BlackRock 配当インカム分析"
    DESCRIPTION = "配当利回り、増配履歴、配当安全性スコア、DRIP複利シミュレーション"

    @staticmethod
    def analyze(stock_data: dict, investment_amount: float = 1_000_000) -> dict:
        info = stock_data.get("info", {})
        dividends = stock_data.get("dividends")
        history = stock_data.get("history")
        ticker = stock_data.get("ticker", "N/A")
        company_name = StockDataFetcher.get_display_name(info, ticker)

        current_price = StockDataFetcher.get_current_price(info)

        # 配当利回り分析
        yield_analysis = BlackRockDividend._yield_analysis(info)

        # 配当成長率
        growth_analysis = BlackRockDividend._dividend_growth(dividends)

        # 配当安全性スコア
        safety = BlackRockDividend._safety_score(info)

        # インカムプロジェクション
        income_projection = BlackRockDividend._income_projection(
            info, investment_amount, growth_analysis
        )

        # DRIPシミュレーション
        drip = BlackRockDividend._drip_simulation(
            current_price, info, investment_amount, growth_analysis
        )

        # 配当落ち日カレンダー
        ex_div = BlackRockDividend._ex_dividend_info(info)

        # イールドトラップチェック
        yield_trap = BlackRockDividend._yield_trap_check(info, history)

        return {
            "analyzer": BlackRockDividend.NAME,
            "company_name": company_name,
            "ticker": ticker,
            "current_price": current_price,
            "investment_amount": investment_amount,
            "yield_analysis": yield_analysis,
            "growth_analysis": growth_analysis,
            "safety": safety,
            "income_projection": income_projection,
            "drip": drip,
            "ex_dividend": ex_div,
            "yield_trap": yield_trap,
        }

    @staticmethod
    def _yield_analysis(info):
        div_yield = info.get("dividendYield") or 0
        div_yield_pct = div_yield * 100  # _enrich_infoで小数形式に正規化済み
        five_yr_avg = info.get("fiveYearAvgDividendYield")

        if div_yield_pct > 5:
            assessment = "高配当（持続性要確認）"
        elif div_yield_pct > 3:
            assessment = "良好な配当水準"
        elif div_yield_pct > 1.5:
            assessment = "中程度の配当"
        elif div_yield_pct > 0:
            assessment = "低配当（成長株の可能性）"
        else:
            assessment = "無配当"

        return {
            "current_yield_pct": round(div_yield_pct, 2),
            "five_year_avg_yield": round(five_yr_avg, 2) if five_yr_avg else None,
            "dividend_rate": info.get("dividendRate"),
            "assessment": assessment,
        }

    @staticmethod
    def _dividend_growth(dividends):
        if dividends is None or dividends.empty or len(dividends) < 2:
            return {"growth_rates": {}, "consecutive_increases": 0, "trend": "データなし"}

        # 年間配当を集計
        annual = dividends.groupby(dividends.index.year).sum()

        if len(annual) < 2:
            return {"growth_rates": {}, "consecutive_increases": 0, "trend": "データ不足"}

        # 成長率計算
        growth_rates = {}
        values = annual.values
        years = annual.index.tolist()

        for i in range(1, len(values)):
            if values[i - 1] > 0:
                rate = ((values[i] - values[i - 1]) / values[i - 1]) * 100
                growth_rates[str(years[i])] = round(rate, 1)

        # 連続増配年数
        consecutive = 0
        for i in range(len(values) - 1, 0, -1):
            if values[i] >= values[i - 1]:
                consecutive += 1
            else:
                break

        # CAGR計算
        if len(values) >= 2 and values[0] > 0:
            n_years = len(values) - 1
            cagr = ((values[-1] / values[0]) ** (1 / n_years) - 1) * 100
        else:
            cagr = 0

        if consecutive >= 25:
            status = "配当キング（25年以上連続増配）"
        elif consecutive >= 10:
            status = "配当アリストクラット候補（10年以上）"
        elif consecutive >= 5:
            status = "安定増配（5年以上）"
        else:
            status = "増配実績あり"

        return {
            "growth_rates": growth_rates,
            "consecutive_increases": consecutive,
            "cagr_pct": round(cagr, 1),
            "status": status,
            "annual_dividends": {str(y): round(float(v), 2) for y, v in zip(years, values)},
        }

    @staticmethod
    def _safety_score(info):
        score = 5  # ベースライン
        reasons = []

        payout = info.get("payoutRatio")  # _enrich_infoで小数形式に正規化済み
        if payout is not None:
            payout_pct = payout * 100
            if payout_pct < 40:
                score += 2
                reasons.append(f"低い配当性向 ({payout_pct:.0f}%)")
            elif payout_pct < 60:
                score += 1
                reasons.append(f"適正な配当性向 ({payout_pct:.0f}%)")
            elif payout_pct > 80:
                score -= 2
                reasons.append(f"高い配当性向 ({payout_pct:.0f}%) - 減配リスク")

        de_ratio = info.get("debtToEquity")  # _enrich_infoで小数形式に正規化済み
        if de_ratio is not None:
            if de_ratio < 0.5:
                score += 1
                reasons.append("低い負債比率")
            elif de_ratio > 1.5:
                score -= 1
                reasons.append("高い負債比率 - 配当持続性にリスク")

        fcf = info.get("freeCashflow")
        if fcf is not None and fcf > 0:
            score += 1
            reasons.append("プラスのフリーキャッシュフロー")
        elif fcf is not None and fcf < 0:
            score -= 2
            reasons.append("マイナスのフリーキャッシュフロー - 要警戒")

        score = max(1, min(10, score))

        return {
            "score": score,
            "max_score": 10,
            "label": "非常に安全" if score >= 8 else "安全" if score >= 6 else "注意" if score >= 4 else "危険",
            "reasons": reasons,
        }

    @staticmethod
    def _income_projection(info, investment_amount, growth_analysis):
        div_yield = info.get("dividendYield") or 0  # _enrich_infoで小数形式に正規化済み
        div_yield_pct = div_yield

        cagr = growth_analysis.get("cagr_pct", 3)
        growth_rate = cagr / 100

        projections = []
        annual_income = investment_amount * div_yield_pct

        for year in range(1, 21):
            income = annual_income * ((1 + growth_rate) ** (year - 1))
            projections.append({
                "year": year,
                "annual_income": round(income, 0),
                "monthly_income": round(income / 12, 0),
                "yield_on_cost": round(div_yield_pct * 100 * ((1 + growth_rate) ** (year - 1)), 2),
            })

        return {
            "initial_annual_income": round(annual_income, 0),
            "year_10_income": projections[9]["annual_income"] if len(projections) >= 10 else 0,
            "year_20_income": projections[19]["annual_income"] if len(projections) >= 20 else 0,
            "projections": projections,
            "assumed_growth_rate_pct": round(cagr, 1),
        }

    @staticmethod
    def _drip_simulation(current_price, info, investment_amount, growth_analysis):
        if not current_price or current_price == 0:
            return {"note": "現在価格が取得できません"}

        div_yield = info.get("dividendYield") or 0  # _enrich_infoで小数形式に正規化済み
        div_yield_pct = div_yield

        price_growth = 0.05  # 年間5%の株価成長を想定
        div_growth = growth_analysis.get("cagr_pct", 3) / 100

        shares = investment_amount / current_price
        price = current_price
        total_value = investment_amount
        total_dividends = 0

        drip_results = []
        for year in range(1, 21):
            annual_div_per_share = price * div_yield_pct * ((1 + div_growth) ** (year - 1))
            annual_dividend = shares * annual_div_per_share
            total_dividends += annual_dividend

            # 配当で追加購入
            new_shares = annual_dividend / price if price > 0 else 0
            shares += new_shares
            price *= (1 + price_growth)
            total_value = shares * price

            drip_results.append({
                "year": year,
                "shares": round(shares, 1),
                "price": round(price, 0),
                "total_value": round(total_value, 0),
                "annual_dividend": round(annual_dividend, 0),
                "cumulative_dividends": round(total_dividends, 0),
            })

        return {
            "initial_shares": round(investment_amount / current_price, 1),
            "year_10": drip_results[9] if len(drip_results) >= 10 else None,
            "year_20": drip_results[19] if len(drip_results) >= 20 else None,
            "total_return_20y": round(((drip_results[-1]["total_value"] / investment_amount) - 1) * 100, 1) if drip_results else 0,
            "results": drip_results,
            "assumptions": {
                "price_growth": "年率5%",
                "dividend_growth": f"年率{growth_analysis.get('cagr_pct', 3):.1f}%",
            },
        }

    @staticmethod
    def _ex_dividend_info(info):
        ex_date = info.get("exDividendDate")
        if ex_date:
            from datetime import datetime
            try:
                if isinstance(ex_date, (int, float)):
                    ex_date_str = datetime.fromtimestamp(ex_date).strftime("%Y-%m-%d")
                else:
                    ex_date_str = str(ex_date)
            except Exception:
                ex_date_str = str(ex_date)
        else:
            ex_date_str = "未定"

        return {
            "ex_dividend_date": ex_date_str,
            "dividend_rate": info.get("dividendRate"),
            "note": "配当を受け取るには、配当落ち日の前営業日までに株式を保有する必要があります",
        }

    @staticmethod
    def _yield_trap_check(info, history):
        warnings = []
        is_trap = False

        div_yield = info.get("dividendYield", 0)  # _enrich_infoで小数形式に正規化済み
        if div_yield is not None and div_yield > 0.06:
            warnings.append("利回り6%超: 株価下落による見かけの高利回りの可能性")
            is_trap = True

        payout = info.get("payoutRatio")  # _enrich_infoで小数形式に正規化済み
        if payout is not None and payout > 0.9:
            warnings.append("配当性向90%超: 減配リスクが高い")
            is_trap = True

        if history is not None and not history.empty and len(history) > 60:
            close = history["Close"]
            price_change = (close.iloc[-1] / close.iloc[-60] - 1) * 100
            if price_change < -20:
                warnings.append(f"直近60日で{price_change:.1f}%下落: 株価急落による見かけの高利回り")
                is_trap = True

        if not warnings:
            warnings.append("イールドトラップの兆候は検出されませんでした")

        return {
            "is_potential_trap": is_trap,
            "warnings": warnings,
        }
