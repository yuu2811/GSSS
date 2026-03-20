"""Renaissance Technologies スタイル 定量スクリーニング"""

from __future__ import annotations

from .stock_data import StockDataFetcher, StockData, AnalysisResult
from .scoring import weighted_composite


class RenaissanceQuant:
    """ルネッサンス・テクノロジーズ流のマルチファクタースクリーニング"""

    NAME = "Renaissance Technologies 定量スクリーナー"
    DESCRIPTION = "バリュー、クオリティ、モメンタム、成長、センチメント各ファクターの複合スコア"

    @staticmethod
    def analyze(stock_data: StockData) -> AnalysisResult:
        info = stock_data.get("info", {})
        history = stock_data.get("history")
        ticker = stock_data.get("ticker", "N/A")
        company_name = StockDataFetcher.get_display_name(info, ticker)

        # 各ファクタースコア計算
        value = RenaissanceQuant._value_factors(info)
        quality = RenaissanceQuant._quality_factors(info)
        momentum = RenaissanceQuant._momentum_factors(info, history)
        growth = RenaissanceQuant._growth_factors(info)
        sentiment = RenaissanceQuant._sentiment_factors(info)

        # 複合スコア計算
        composite = RenaissanceQuant._composite_score(value, quality, momentum, growth, sentiment)

        return {
            "analyzer": RenaissanceQuant.NAME,
            "company_name": company_name,
            "ticker": ticker,
            "value_factors": value,
            "quality_factors": quality,
            "momentum_factors": momentum,
            "growth_factors": growth,
            "sentiment_factors": sentiment,
            "composite_score": composite,
        }

    @staticmethod
    def _value_factors(info):
        score = 0
        details = []

        pe = info.get("trailingPE")
        if pe and pe < 15:
            score += 25
            details.append(f"P/E {pe:.1f} （割安）")
        elif pe and pe < 20:
            score += 15
            details.append(f"P/E {pe:.1f} （適正）")
        elif pe:
            score += 5
            details.append(f"P/E {pe:.1f} （割高）")

        pb = info.get("priceToBook")
        if pb and pb < 1:
            score += 25
            details.append(f"PBR {pb:.2f} （割安）")
        elif pb and pb < 2:
            score += 15
            details.append(f"PBR {pb:.2f} （適正）")
        elif pb:
            score += 5
            details.append(f"PBR {pb:.2f}")

        ev_ebitda = info.get("enterpriseToEbitda")
        if ev_ebitda and ev_ebitda < 10:
            score += 25
            details.append(f"EV/EBITDA {ev_ebitda:.1f} （割安）")
        elif ev_ebitda and ev_ebitda < 15:
            score += 15
            details.append(f"EV/EBITDA {ev_ebitda:.1f}")
        elif ev_ebitda:
            score += 5
            details.append(f"EV/EBITDA {ev_ebitda:.1f} （割高）")

        fcf_yield = None
        fcf = info.get("freeCashflow")
        mcap = info.get("marketCap")
        if fcf and mcap and mcap > 0:
            fcf_yield = (fcf / mcap) * 100
            if fcf_yield > 8:
                score += 25
                details.append(f"FCF利回り {fcf_yield:.1f}% （高い）")
            elif fcf_yield > 4:
                score += 15
                details.append(f"FCF利回り {fcf_yield:.1f}%")
            else:
                score += 5
                details.append(f"FCF利回り {fcf_yield:.1f}%")

        return {"score": min(score, 100), "max_score": 100, "details": details}

    @staticmethod
    def _quality_factors(info):
        score = 0
        details = []

        roe = info.get("returnOnEquity")
        if roe is not None:
            roe_pct = roe * 100  # _enrich_infoで小数形式に正規化済み
            if roe_pct > 15:
                score += 25
                details.append(f"ROE {roe_pct:.1f}% （高い）")
            elif roe_pct > 10:
                score += 15
                details.append(f"ROE {roe_pct:.1f}%")
            else:
                score += 5
                details.append(f"ROE {roe_pct:.1f}% （低い）")

        margin = info.get("operatingMargins")
        if margin is not None:
            margin_pct = margin * 100  # _enrich_infoで小数形式に正規化済み
            if margin_pct > 20:
                score += 25
                details.append(f"営業利益率 {margin_pct:.1f}% （高い）")
            elif margin_pct > 10:
                score += 15
                details.append(f"営業利益率 {margin_pct:.1f}%")
            else:
                score += 5
                details.append(f"営業利益率 {margin_pct:.1f}%")

        de_ratio = info.get("debtToEquity")  # _enrich_infoで小数形式に正規化済み
        if de_ratio is not None:
            if de_ratio < 0.5:
                score += 25
                details.append(f"D/E比率 {de_ratio:.2f} （低い）")
            elif de_ratio < 1.0:
                score += 15
                details.append(f"D/E比率 {de_ratio:.2f}")
            else:
                score += 5
                details.append(f"D/E比率 {de_ratio:.2f} （高い）")

        roa = info.get("returnOnAssets")
        if roa is not None:
            roa_pct = roa * 100  # _enrich_infoで小数形式に正規化済み
            if roa_pct > 10:
                score += 25
                details.append(f"ROA {roa_pct:.1f}% （高い）")
            elif roa_pct > 5:
                score += 15
                details.append(f"ROA {roa_pct:.1f}%")
            else:
                score += 5
                details.append(f"ROA {roa_pct:.1f}%")

        return {"score": min(score, 100), "max_score": 100, "details": details}

    @staticmethod
    def _momentum_factors(info, history):
        score = 0
        details = []

        if history is not None and not history.empty:
            close = history["Close"]

            # 200日移動平均との位置関係
            if len(close) >= 200:
                sma200 = close.rolling(200).mean().iloc[-1]
                if close.iloc[-1] > sma200:
                    score += 30
                    pct_above = ((close.iloc[-1] / sma200) - 1) * 100
                    details.append(f"200日線の{pct_above:.1f}%上方（強気）")
                else:
                    score += 5
                    pct_below = ((close.iloc[-1] / sma200) - 1) * 100
                    details.append(f"200日線の{pct_below:.1f}%下方（弱気）")

            # 52週リターン
            if len(close) >= 252:
                ret_52w = ((close.iloc[-1] / close.iloc[-252]) - 1) * 100
                if ret_52w > 20:
                    score += 25
                    details.append(f"52週リターン +{ret_52w:.1f}%")
                elif ret_52w > 0:
                    score += 15
                    details.append(f"52週リターン +{ret_52w:.1f}%")
                else:
                    score += 5
                    details.append(f"52週リターン {ret_52w:.1f}%")

            # 3ヶ月モメンタム
            if len(close) >= 66:
                ret_3m = ((close.iloc[-1] / close.iloc[-66]) - 1) * 100
                if ret_3m > 10:
                    score += 25
                    details.append(f"3ヶ月リターン +{ret_3m:.1f}%")
                elif ret_3m > 0:
                    score += 15
                    details.append(f"3ヶ月リターン +{ret_3m:.1f}%")
                else:
                    score += 5
                    details.append(f"3ヶ月リターン {ret_3m:.1f}%")

        # 52週高値/安値
        week52_high = info.get("fiftyTwoWeekHigh")
        week52_low = info.get("fiftyTwoWeekLow")
        current = info.get("currentPrice") or info.get("regularMarketPrice", 0)
        if week52_high and current:
            pct_from_high = ((current / week52_high) - 1) * 100
            if pct_from_high > -5:
                score += 20
                details.append(f"52週高値から{pct_from_high:.1f}%")
            else:
                details.append(f"52週高値から{pct_from_high:.1f}%")

        return {"score": min(score, 100), "max_score": 100, "details": details}

    @staticmethod
    def _growth_factors(info):
        score = 0
        details = []

        rev_growth = info.get("revenueGrowth")
        if rev_growth is not None:
            rg_pct = rev_growth * 100  # _enrich_infoで小数形式に正規化済み
            if rg_pct > 15:
                score += 30
                details.append(f"売上成長率 {rg_pct:.1f}% （高成長）")
            elif rg_pct > 5:
                score += 20
                details.append(f"売上成長率 {rg_pct:.1f}%")
            elif rg_pct > 0:
                score += 10
                details.append(f"売上成長率 {rg_pct:.1f}%")
            else:
                score += 0
                details.append(f"売上成長率 {rg_pct:.1f}% （減収）")

        eps_growth = info.get("earningsGrowth")
        if eps_growth is not None:
            eg_pct = eps_growth * 100  # _enrich_infoで小数形式に正規化済み
            if eg_pct > 20:
                score += 35
                details.append(f"EPS成長率 {eg_pct:.1f}% （高成長）")
            elif eg_pct > 5:
                score += 20
                details.append(f"EPS成長率 {eg_pct:.1f}%")
            elif eg_pct > 0:
                score += 10
                details.append(f"EPS成長率 {eg_pct:.1f}%")
            else:
                details.append(f"EPS成長率 {eg_pct:.1f}% （減益）")

        margin_trend = info.get("operatingMargins")
        if margin_trend is not None:
            m_pct = margin_trend * 100  # _enrich_infoで小数形式に正規化済み
            if m_pct > 15:
                score += 20
                details.append(f"営業利益率 {m_pct:.1f}% （高マージン）")
            elif m_pct > 0:
                score += 10

        peg = info.get("pegRatio")
        if peg and peg > 0:
            if peg < 1:
                score += 15
                details.append(f"PEG {peg:.2f} （割安成長）")
            elif peg < 2:
                score += 10
                details.append(f"PEG {peg:.2f}")
            else:
                score += 5
                details.append(f"PEG {peg:.2f} （割高）")

        return {"score": min(score, 100), "max_score": 100, "details": details}

    @staticmethod
    def _sentiment_factors(info):
        score = 0
        details = []

        # アナリスト推奨
        rec = info.get("recommendationKey", "")
        if rec in ["strongBuy", "strong_buy"]:
            score += 35
            details.append("アナリスト推奨: 強い買い")
        elif rec in ["buy"]:
            score += 25
            details.append("アナリスト推奨: 買い")
        elif rec in ["hold"]:
            score += 15
            details.append("アナリスト推奨: 中立")
        elif rec:
            score += 5
            details.append(f"アナリスト推奨: {rec}")

        # 機関投資家保有
        inst = info.get("heldPercentInstitutions")
        if inst is not None:
            inst_pct = inst * 100 if inst < 1 else inst
            if inst_pct > 70:
                score += 30
                details.append(f"機関投資家保有 {inst_pct:.1f}% （高い）")
            elif inst_pct > 40:
                score += 20
                details.append(f"機関投資家保有 {inst_pct:.1f}%")
            else:
                score += 10
                details.append(f"機関投資家保有 {inst_pct:.1f}%")

        # ショートインタレスト
        short_pct = info.get("shortPercentOfFloat")
        if short_pct is not None:
            sp = short_pct * 100 if short_pct < 1 else short_pct
            if sp < 3:
                score += 20
                details.append(f"ショート比率 {sp:.1f}% （低い - 強気）")
            elif sp < 10:
                score += 10
                details.append(f"ショート比率 {sp:.1f}%")
            else:
                score += 5
                details.append(f"ショート比率 {sp:.1f}% （高い - 注意）")

        # インサイダー保有
        insider = info.get("heldPercentInsiders")
        if insider is not None:
            ins_pct = insider * 100 if insider < 1 else insider
            if ins_pct > 10:
                score += 15
                details.append(f"インサイダー保有 {ins_pct:.1f}%")
            else:
                score += 10

        return {"score": min(score, 100), "max_score": 100, "details": details}

    @staticmethod
    def _composite_score(value, quality, momentum, growth, sentiment):
        weights = {
            "バリュー": 0.20,
            "クオリティ": 0.25,
            "モメンタム": 0.20,
            "成長": 0.20,
            "センチメント": 0.15,
        }

        scores = {
            "バリュー": value["score"],
            "クオリティ": quality["score"],
            "モメンタム": momentum["score"],
            "成長": growth["score"],
            "センチメント": sentiment["score"],
        }

        thresholds = [
            (75, "非常に魅力的", "強い買い推奨"),
            (60, "魅力的", "買い推奨"),
            (45, "中立", "保持/様子見"),
            (30, "やや弱い", "慎重に検討"),
            (0, "弱い", "見送り推奨"),
        ]
        return weighted_composite(scores, weights, thresholds)
