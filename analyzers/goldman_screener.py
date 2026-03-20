"""Goldman Sachs スタイル株式スクリーニング分析"""

from .stock_data import StockDataFetcher


class GoldmanScreener:
    """ゴールドマン・サックス流の株式スクリーニングフレームワーク"""

    NAME = "Goldman Sachs 株式スクリーナー"
    DESCRIPTION = "P/E比率、収益成長、負債比率、配当利回り、競争優位性を総合的に分析"

    @staticmethod
    def analyze(stock_data: dict) -> dict:
        info = stock_data.get("info", {})
        history = stock_data.get("history")
        financials = stock_data.get("financials")
        balance_sheet = stock_data.get("balance_sheet")

        ticker = stock_data.get("ticker", "N/A")
        company_name = StockDataFetcher.get_display_name(info, ticker)
        current_price = StockDataFetcher.get_current_price(info)
        sector = info.get("sector", "不明")
        industry = info.get("industry", "不明")

        # P/E比率分析
        pe_ratio = info.get("trailingPE") or info.get("forwardPE")
        forward_pe = info.get("forwardPE")
        sector_pe = info.get("sectorPE", None)
        pe_analysis = GoldmanScreener._analyze_pe(pe_ratio, forward_pe, sector)

        # 収益成長トレンド
        revenue_growth = GoldmanScreener._analyze_revenue_growth(financials)

        # 負債比率分析
        debt_analysis = GoldmanScreener._analyze_debt(info, balance_sheet)

        # 配当分析
        dividend_analysis = GoldmanScreener._analyze_dividend(info)

        # 競争優位性（モート）評価
        moat_rating = GoldmanScreener._rate_moat(info, revenue_growth, debt_analysis)

        # 価格ターゲット
        price_targets = GoldmanScreener._calculate_targets(current_price, pe_ratio, info)

        # リスク評価
        risk_rating = GoldmanScreener._calculate_risk(info, debt_analysis, pe_analysis)

        # エントリーゾーン
        entry_zones = GoldmanScreener._calculate_entry_zones(current_price, history)

        return {
            "analyzer": GoldmanScreener.NAME,
            "company_name": company_name,
            "ticker": ticker,
            "sector": sector,
            "industry": industry,
            "current_price": current_price,
            "currency": info.get("currency", "JPY"),
            "pe_analysis": pe_analysis,
            "revenue_growth": revenue_growth,
            "debt_analysis": debt_analysis,
            "dividend_analysis": dividend_analysis,
            "moat_rating": moat_rating,
            "price_targets": price_targets,
            "risk_rating": risk_rating,
            "entry_zones": entry_zones,
            "market_cap": info.get("marketCap", 0),
            "summary": GoldmanScreener._generate_summary(
                company_name, moat_rating, risk_rating, price_targets
            ),
        }

    @staticmethod
    def _analyze_pe(pe_ratio, forward_pe, sector):
        if pe_ratio is None:
            return {"current_pe": None, "forward_pe": forward_pe, "assessment": "データなし", "score": 5}

        if pe_ratio < 10:
            assessment = "割安（バリュー圏）"
            score = 9
        elif pe_ratio < 15:
            assessment = "適正～やや割安"
            score = 7
        elif pe_ratio < 20:
            assessment = "適正水準"
            score = 5
        elif pe_ratio < 30:
            assessment = "やや割高"
            score = 3
        else:
            assessment = "割高（成長期待込み）"
            score = 2

        return {
            "current_pe": round(pe_ratio, 2) if pe_ratio else None,
            "forward_pe": round(forward_pe, 2) if forward_pe else None,
            "assessment": assessment,
            "score": score,
        }

    @staticmethod
    def _analyze_revenue_growth(financials):
        if financials is None or financials.empty:
            return {"years": [], "growth_rates": [], "trend": "データなし"}

        try:
            if "Total Revenue" in financials.index:
                revenues = financials.loc["Total Revenue"].dropna().sort_index()
            else:
                return {"years": [], "growth_rates": [], "trend": "データなし"}

            years = []
            growth_rates = []
            rev_values = revenues.values
            rev_dates = revenues.index

            for i in range(1, len(rev_values)):
                if rev_values[i - 1] > 0:
                    rate = ((rev_values[i] - rev_values[i - 1]) / abs(rev_values[i - 1])) * 100
                    growth_rates.append(round(rate, 1))
                    years.append(str(rev_dates[i].year) if hasattr(rev_dates[i], 'year') else str(rev_dates[i]))

            if not growth_rates:
                trend = "データ不足"
            elif all(g > 0 for g in growth_rates):
                trend = "安定成長"
            elif (growth_rates[-1] > growth_rates[0]) if len(growth_rates) > 1 else (growth_rates[-1] > 0):
                trend = "加速成長"
            elif all(g < 0 for g in growth_rates):
                trend = "減収傾向"
            else:
                trend = "変動あり"

            return {
                "years": years,
                "growth_rates": growth_rates,
                "trend": trend,
                "revenues": [float(r) for r in rev_values],
            }
        except Exception:
            return {"years": [], "growth_rates": [], "trend": "計算エラー"}

    @staticmethod
    def _analyze_debt(info, balance_sheet):
        de_ratio = info.get("debtToEquity")  # _enrich_infoで小数形式に正規化済み
        total_debt = info.get("totalDebt", 0)
        total_cash = info.get("totalCash", 0)

        if de_ratio is None:
            health = "データなし"
            score = 5
        elif de_ratio < 0.3:
            health = "非常に健全"
            score = 10
        elif de_ratio < 0.5:
            health = "健全"
            score = 8
        elif de_ratio < 1.0:
            health = "標準的"
            score = 6
        elif de_ratio < 2.0:
            health = "やや高い"
            score = 4
        else:
            health = "高リスク"
            score = 2

        return {
            "debt_to_equity": round(de_ratio, 2) if de_ratio else None,
            "total_debt": total_debt,
            "total_cash": total_cash,
            "net_debt": total_debt - total_cash if total_debt and total_cash else None,
            "health": health,
            "score": score,
        }

    @staticmethod
    def _analyze_dividend(info):
        div_yield = info.get("dividendYield")
        div_rate = info.get("dividendRate")
        payout_ratio = info.get("payoutRatio")

        if div_yield:
            div_yield_pct = div_yield * 100 if div_yield < 1 else div_yield
        else:
            div_yield_pct = 0

        if payout_ratio is not None:
            payout_pct = payout_ratio * 100  # _enrich_infoで小数形式に正規化済み
            if payout_pct < 40:
                sustainability = "非常に持続可能"
                score = 10
            elif payout_pct < 60:
                sustainability = "持続可能"
                score = 8
            elif payout_pct < 80:
                sustainability = "やや高め"
                score = 5
            else:
                sustainability = "要注意"
                score = 3
        else:
            sustainability = "データなし"
            score = 5
            payout_pct = None

        return {
            "yield_pct": round(div_yield_pct, 2) if div_yield_pct else 0,
            "annual_rate": div_rate,
            "payout_ratio_pct": round(payout_pct, 1) if payout_pct else None,
            "sustainability": sustainability,
            "score": score,
        }

    @staticmethod
    def _rate_moat(info, revenue_growth, debt_analysis):
        score = 0
        reasons = []

        # 時価総額
        market_cap = info.get("marketCap", 0)
        if market_cap and market_cap > 1e12:  # 1兆円以上
            score += 3
            reasons.append("大型株（時価総額1兆円超）")
        elif market_cap and market_cap > 1e11:
            score += 2
            reasons.append("中大型株")
        elif market_cap and market_cap > 1e10:
            score += 1

        # 利益率
        profit_margin = info.get("profitMargins")
        if profit_margin and profit_margin > 0.20:
            score += 3
            reasons.append(f"高利益率 ({profit_margin*100:.1f}%)")
        elif profit_margin and profit_margin > 0.10:
            score += 2
            reasons.append(f"安定利益率 ({profit_margin*100:.1f}%)")
        elif profit_margin and profit_margin > 0:
            score += 1

        # ROE
        roe = info.get("returnOnEquity")
        if roe and roe > 0.15:
            score += 2
            reasons.append(f"高ROE ({roe*100:.1f}%)")
        elif roe and roe > 0.10:
            score += 1

        # 収益成長
        if revenue_growth.get("trend") in ["安定成長", "加速成長"]:
            score += 2
            reasons.append("安定した収益成長")

        # 負債
        if debt_analysis.get("score", 5) >= 8:
            score += 1
            reasons.append("低負債")

        if score >= 8:
            rating = "強い (Strong)"
        elif score >= 5:
            rating = "中程度 (Moderate)"
        else:
            rating = "弱い (Weak)"

        return {"rating": rating, "score": score, "max_score": 11, "reasons": reasons}

    @staticmethod
    def _calculate_targets(current_price, pe_ratio, info):
        if not current_price or current_price == 0:
            return {"bull_target": None, "bear_target": None, "base_target": None}

        target_high = info.get("targetHighPrice")
        target_low = info.get("targetLowPrice")
        target_mean = info.get("targetMeanPrice")

        if target_high and target_low:
            return {
                "bull_target": round(target_high, 0),
                "bear_target": round(target_low, 0),
                "base_target": round(target_mean, 0) if target_mean else round((target_high + target_low) / 2, 0),
                "upside_pct": round(((target_high / current_price) - 1) * 100, 1),
                "downside_pct": round(((target_low / current_price) - 1) * 100, 1),
            }

        # アナリスト目標がない場合は推定
        bull = current_price * 1.20
        bear = current_price * 0.85
        return {
            "bull_target": round(bull, 0),
            "bear_target": round(bear, 0),
            "base_target": round(current_price * 1.05, 0),
            "upside_pct": 20.0,
            "downside_pct": -15.0,
            "estimated": True,
        }

    @staticmethod
    def _calculate_risk(info, debt_analysis, pe_analysis):
        risk = 5  # ベースライン

        beta = info.get("beta")
        if beta:
            if beta > 1.5:
                risk += 2
            elif beta > 1.2:
                risk += 1
            elif beta < 0.8:
                risk -= 1

        if debt_analysis.get("score", 5) <= 3:
            risk += 1
        elif debt_analysis.get("score", 5) >= 8:
            risk -= 1

        if pe_analysis.get("score", 5) <= 3:
            risk += 1

        market_cap = info.get("marketCap", 0)
        if market_cap and market_cap < 1e10:
            risk += 1

        risk = max(1, min(10, risk))

        reasons = []
        if beta:
            reasons.append(f"ベータ: {beta:.2f}")
        reasons.append(f"負債健全性: {debt_analysis.get('health', 'N/A')}")
        reasons.append(f"バリュエーション: {pe_analysis.get('assessment', 'N/A')}")

        return {"score": risk, "reasons": reasons}

    @staticmethod
    def _calculate_entry_zones(current_price, history):
        if not current_price or current_price == 0:
            return {}

        if history is not None and not history.empty and len(history) > 20:
            close = history["Close"]
            support = close.rolling(window=20).min().iloc[-1]
            resistance = close.rolling(window=20).max().iloc[-1]
        else:
            support = current_price * 0.95
            resistance = current_price * 1.05

        return {
            "ideal_entry": round(current_price * 0.97, 0),
            "aggressive_entry": round(current_price, 0),
            "conservative_entry": round(support * 1.02, 0),
            "stop_loss": round(support * 0.95, 0),
            "stop_loss_pct": round(((support * 0.95 / current_price) - 1) * 100, 1),
            "support": round(support, 0),
            "resistance": round(resistance, 0),
        }

    @staticmethod
    def _generate_summary(company_name, moat, risk, targets):
        bull = targets.get("bull_target")
        bear = targets.get("bear_target")
        base = f"{company_name}の総合評価: 競争優位性は{moat['rating']}、リスクスコアは{risk['score']}/10。"
        if isinstance(bull, (int, float)) and isinstance(bear, (int, float)):
            base += f"12ヶ月目標: 強気 ¥{bull:,.0f} / 弱気 ¥{bear:,.0f}"
        return base
