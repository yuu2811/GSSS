"""Academic Paper ベース 定量ファクター分析"""

import numpy as np
import pandas as pd
from .stock_data import StockDataFetcher


class AcademicQuant:
    """学術論文ベースのマルチファクター定量分析"""

    NAME = "Academic Paper 定量分析"
    DESCRIPTION = "Fama-French、モメンタム、低ボラティリティ、QMJ等の学術論文ベースファクター分析"

    @staticmethod
    def analyze(stock_data: dict) -> dict:
        info = stock_data.get("info", {})
        history = stock_data.get("history")
        ticker = stock_data.get("ticker", "N/A")
        company_name = StockDataFetcher.get_display_name(info, ticker)

        ff = AcademicQuant._fama_french(info, history)
        mom = AcademicQuant._momentum(info, history)
        lv = AcademicQuant._low_volatility(history)
        qmj = AcademicQuant._quality_minus_junk(info)
        dv = AcademicQuant._deep_value(info)
        mr = AcademicQuant._mean_reversion(history)
        vf = AcademicQuant._volatility_forecast(history)
        pt = AcademicQuant._pair_trading(history)
        ped = AcademicQuant._post_earnings_drift(info)
        aa = AcademicQuant._accrual_anomaly(info)
        rp = AcademicQuant._risk_parity(info, history)

        composite = AcademicQuant._composite(ff, mom, lv, qmj, dv, mr, vf, pt, ped, aa, rp)

        return {
            "analyzer": AcademicQuant.NAME,
            "company_name": company_name,
            "ticker": ticker,
            "fama_french": ff,
            "momentum": mom,
            "low_volatility": lv,
            "quality_minus_junk": qmj,
            "deep_value": dv,
            "mean_reversion": mr,
            "volatility_forecast": vf,
            "pair_trading": pt,
            "post_earnings_drift": ped,
            "accrual_anomaly": aa,
            "risk_parity": rp,
            "composite_academic_score": composite,
        }

    # ── Fama-French ──────────────────────────────────────
    @staticmethod
    def _fama_french(info, history):
        score = 0
        details = []
        metrics = {}

        # Size factor (SMB)
        mcap = info.get("marketCap", 0)
        if mcap:
            if mcap < 50e9:  # 小型株プレミアム
                smb = min(30, int(30 * (1 - mcap / 50e9)))
                score += smb
                details.append(f"小型株プレミアム: 時価総額 ¥{mcap/1e8:.0f}億")
            else:
                score += 5
                details.append(f"大型株: 時価総額 ¥{mcap/1e8:.0f}億")
            metrics["時価総額"] = f"¥{mcap/1e8:.0f}億"

        # Value factor (HML)
        pb = info.get("priceToBook")
        if pb and pb > 0:
            if pb < 1.0:
                score += 30
                details.append(f"HML: PBR {pb:.2f} — 強いバリュー")
            elif pb < 1.5:
                score += 20
                details.append(f"HML: PBR {pb:.2f} — バリュー")
            elif pb < 3.0:
                score += 10
                details.append(f"HML: PBR {pb:.2f} — 中立")
            else:
                score += 5
                details.append(f"HML: PBR {pb:.2f} — グロース")
            metrics["PBR"] = f"{pb:.2f}"

        # Profitability (RMW)
        roe = info.get("returnOnEquity")
        if roe:
            roe_pct = roe * 100 if abs(roe) < 1 else roe
            if roe_pct > 15:
                score += 20
                details.append(f"RMW: ROE {roe_pct:.1f}% — 高収益")
            elif roe_pct > 8:
                score += 12
                details.append(f"RMW: ROE {roe_pct:.1f}% — 適正")
            else:
                score += 5
                details.append(f"RMW: ROE {roe_pct:.1f}% — 低収益")
            metrics["ROE"] = f"{roe_pct:.1f}%"

        # Investment (CMA)
        capex = info.get("capitalExpenditures")
        total_assets = info.get("totalAssets")
        if capex and total_assets and total_assets > 0:
            inv_rate = abs(capex) / total_assets * 100
            if inv_rate < 5:
                score += 20
                details.append(f"CMA: 投資率 {inv_rate:.1f}% — 保守的")
            elif inv_rate < 10:
                score += 12
                details.append(f"CMA: 投資率 {inv_rate:.1f}% — 適度")
            else:
                score += 5
                details.append(f"CMA: 投資率 {inv_rate:.1f}% — 積極的")
            metrics["投資率"] = f"{inv_rate:.1f}%"

        return {"score": min(score, 100), "details": details, "factor_exposures": metrics}

    # ── Momentum (Jegadeesh-Titman) ──────────────────────
    @staticmethod
    def _momentum(info, history):
        score = 0
        details = []
        metrics = {}

        if history is not None and not history.empty:
            close = history["Close"]

            # 12-1 momentum (skip most recent month)
            if len(close) >= 252:
                ret_12m = ((close.iloc[-22] / close.iloc[-252]) - 1) * 100
                if ret_12m > 30:
                    score += 40
                    details.append(f"12-1Mモメンタム: +{ret_12m:.1f}% — 強い")
                elif ret_12m > 10:
                    score += 25
                    details.append(f"12-1Mモメンタム: +{ret_12m:.1f}%")
                elif ret_12m > 0:
                    score += 15
                    details.append(f"12-1Mモメンタム: +{ret_12m:.1f}% — 弱い")
                else:
                    score += 5
                    details.append(f"12-1Mモメンタム: {ret_12m:.1f}% — 負")
                metrics["12-1Mリターン"] = f"{ret_12m:+.1f}%"

            # 6-month momentum
            if len(close) >= 132:
                ret_6m = ((close.iloc[-1] / close.iloc[-132]) - 1) * 100
                if ret_6m > 20:
                    score += 30
                elif ret_6m > 5:
                    score += 20
                elif ret_6m > 0:
                    score += 10
                else:
                    score += 5
                details.append(f"6ヶ月リターン: {ret_6m:+.1f}%")
                metrics["6Mリターン"] = f"{ret_6m:+.1f}%"

            # 1-month reversal
            if len(close) >= 22:
                ret_1m = ((close.iloc[-1] / close.iloc[-22]) - 1) * 100
                details.append(f"1ヶ月リターン: {ret_1m:+.1f}% (短期反転シグナル)")
                metrics["1Mリターン"] = f"{ret_1m:+.1f}%"
                if ret_1m < -5:
                    score += 15  # 短期反転期待
                elif ret_1m > 10:
                    score += 5

        return {"score": min(score, 100), "details": details, "metrics": metrics}

    # ── Low Volatility Anomaly (Ang et al.) ──────────────
    @staticmethod
    def _low_volatility(history):
        score = 0
        details = []
        metrics = {}

        if history is not None and not history.empty:
            close = history["Close"]
            returns = close.pct_change().dropna()

            if len(returns) >= 60:
                vol = returns.std() * np.sqrt(252) * 100
                if vol < 20:
                    score += 40
                    details.append(f"年率ボラティリティ {vol:.1f}% — 低ボラ（アノマリー有利）")
                elif vol < 30:
                    score += 25
                    details.append(f"年率ボラティリティ {vol:.1f}% — 中程度")
                elif vol < 45:
                    score += 15
                    details.append(f"年率ボラティリティ {vol:.1f}% — やや高い")
                else:
                    score += 5
                    details.append(f"年率ボラティリティ {vol:.1f}% — 高ボラ")
                metrics["年率ボラティリティ"] = f"{vol:.1f}%"

                # Downside deviation
                neg_ret = returns[returns < 0]
                if len(neg_ret) > 10:
                    dd = neg_ret.std() * np.sqrt(252) * 100
                    details.append(f"下方偏差 {dd:.1f}%")
                    metrics["下方偏差"] = f"{dd:.1f}%"
                    if dd < 15:
                        score += 30
                    elif dd < 25:
                        score += 20
                    else:
                        score += 5

                # Beta estimation
                if len(returns) >= 120:
                    mkt_ret = returns.mean() * 252
                    mkt_vol = returns.std() * np.sqrt(252)
                    beta_est = min(max(mkt_vol / 0.20, 0.3), 2.5)
                    if beta_est < 0.8:
                        score += 20
                        details.append(f"推定ベータ {beta_est:.2f} — 低ベータ")
                    elif beta_est < 1.2:
                        score += 10
                        details.append(f"推定ベータ {beta_est:.2f} — 中立")
                    else:
                        score += 5
                        details.append(f"推定ベータ {beta_est:.2f} — 高ベータ")
                    metrics["推定ベータ"] = f"{beta_est:.2f}"

        return {"score": min(score, 100), "details": details, "metrics": metrics}

    # ── Quality Minus Junk (Asness) ──────────────────────
    @staticmethod
    def _quality_minus_junk(info):
        score = 0
        details = []
        sub_scores = {}

        # Profitability
        gp_margin = info.get("grossMargins")
        if gp_margin:
            gp_pct = gp_margin * 100 if abs(gp_margin) < 1 else gp_margin
            if gp_pct > 40:
                score += 20
                details.append(f"粗利益率 {gp_pct:.1f}% — 高品質")
            elif gp_pct > 20:
                score += 12
                details.append(f"粗利益率 {gp_pct:.1f}% — 適正")
            else:
                score += 5
                details.append(f"粗利益率 {gp_pct:.1f}% — 低い")
            sub_scores["粗利益率"] = f"{gp_pct:.1f}%"

        # Safety (leverage)
        de_ratio = info.get("debtToEquity")  # _enrich_infoで小数形式に正規化済み
        if de_ratio is not None:
            if de_ratio < 0.3:
                score += 25
                details.append(f"D/E {de_ratio:.2f} — 安全（低レバレッジ）")
            elif de_ratio < 0.8:
                score += 15
                details.append(f"D/E {de_ratio:.2f} — 適正")
            elif de_ratio < 1.5:
                score += 8
                details.append(f"D/E {de_ratio:.2f} — やや高い")
            else:
                score += 3
                details.append(f"D/E {de_ratio:.2f} — 高レバレッジ（ジャンク）")
            sub_scores["D/E比率"] = f"{de_ratio:.2f}"

        # Growth stability
        rev_growth = info.get("revenueGrowth")
        if rev_growth:
            rg = rev_growth * 100 if abs(rev_growth) < 1 else rev_growth
            if rg > 10:
                score += 20
                details.append(f"売上成長 {rg:.1f}% — 安定成長")
            elif rg > 0:
                score += 12
                details.append(f"売上成長 {rg:.1f}%")
            else:
                score += 3
                details.append(f"売上成長 {rg:.1f}% — 減収")
            sub_scores["売上成長率"] = f"{rg:.1f}%"

        # Payout
        payout = info.get("payoutRatio")  # _enrich_infoで小数形式に正規化済み
        if payout is not None:
            po_pct = payout * 100
            if 20 < po_pct < 60:
                score += 20
                details.append(f"配当性向 {po_pct:.0f}% — 適正")
            elif po_pct <= 20:
                score += 10
                details.append(f"配当性向 {po_pct:.0f}% — 低い（成長投資）")
            else:
                score += 5
                details.append(f"配当性向 {po_pct:.0f}% — 高い")
            sub_scores["配当性向"] = f"{po_pct:.0f}%"

        # ROA
        roa = info.get("returnOnAssets")
        if roa:
            roa_pct = roa * 100 if abs(roa) < 1 else roa
            if roa_pct > 8:
                score += 15
            elif roa_pct > 3:
                score += 10
            else:
                score += 3
            sub_scores["ROA"] = f"{roa_pct:.1f}%"

        return {"score": min(score, 100), "details": details, "sub_scores": sub_scores}

    # ── Deep Value (LSV) ─────────────────────────────────
    @staticmethod
    def _deep_value(info):
        score = 0
        details = []
        metrics = {}

        pe = info.get("trailingPE")
        if pe and pe > 0:
            if pe < 8:
                score += 30
                details.append(f"P/E {pe:.1f} — ディープバリュー")
            elif pe < 12:
                score += 22
                details.append(f"P/E {pe:.1f} — バリュー")
            elif pe < 18:
                score += 12
                details.append(f"P/E {pe:.1f} — 適正")
            else:
                score += 5
                details.append(f"P/E {pe:.1f} — グロース寄り")
            metrics["P/E"] = f"{pe:.1f}"

        pb = info.get("priceToBook")
        if pb and pb > 0:
            if pb < 0.7:
                score += 30
                details.append(f"PBR {pb:.2f} — 純資産割れ")
            elif pb < 1.0:
                score += 22
                details.append(f"PBR {pb:.2f} — バリュー")
            elif pb < 2.0:
                score += 12
                details.append(f"PBR {pb:.2f} — 適正")
            else:
                score += 5
                details.append(f"PBR {pb:.2f}")
            metrics["PBR"] = f"{pb:.2f}"

        div_yield = info.get("dividendYield")
        if div_yield:
            dy = div_yield * 100 if div_yield < 1 else div_yield
            if dy > 4:
                score += 25
                details.append(f"配当利回り {dy:.2f}% — 高配当")
            elif dy > 2:
                score += 15
                details.append(f"配当利回り {dy:.2f}%")
            elif dy > 0:
                score += 8
                details.append(f"配当利回り {dy:.2f}%")
            metrics["配当利回り"] = f"{dy:.2f}%"

        ev_ebitda = info.get("enterpriseToEbitda")
        if ev_ebitda and ev_ebitda > 0:
            if ev_ebitda < 6:
                score += 15
                details.append(f"EV/EBITDA {ev_ebitda:.1f} — 割安")
            elif ev_ebitda < 12:
                score += 10
            else:
                score += 3
            metrics["EV/EBITDA"] = f"{ev_ebitda:.1f}"

        return {"score": min(score, 100), "details": details, "metrics": metrics}

    # ── Mean Reversion (Poterba-Summers) ─────────────────
    @staticmethod
    def _mean_reversion(history):
        score = 0
        details = []
        metrics = {}

        if history is not None and not history.empty:
            close = history["Close"]
            if len(close) >= 60:
                sma60 = close.rolling(60).mean().iloc[-1]
                current = close.iloc[-1]
                dev = ((current / sma60) - 1) * 100

                if abs(dev) > 15:
                    score += 35
                    direction = "上方" if dev > 0 else "下方"
                    details.append(f"60日平均から{dev:+.1f}%乖離 — 強い回帰シグナル（{direction}）")
                elif abs(dev) > 8:
                    score += 25
                    details.append(f"60日平均から{dev:+.1f}%乖離 — 回帰期待")
                elif abs(dev) > 3:
                    score += 15
                    details.append(f"60日平均から{dev:+.1f}%乖離 — 軽微")
                else:
                    score += 8
                    details.append(f"60日平均から{dev:+.1f}%乖離 — 平均近辺")
                metrics["60日乖離率"] = f"{dev:+.1f}%"

            if len(close) >= 200:
                sma200 = close.rolling(200).mean().iloc[-1]
                dev200 = ((close.iloc[-1] / sma200) - 1) * 100
                details.append(f"200日平均から{dev200:+.1f}%乖離")
                metrics["200日乖離率"] = f"{dev200:+.1f}%"
                if abs(dev200) > 20:
                    score += 25
                elif abs(dev200) > 10:
                    score += 15
                else:
                    score += 8

            # Variance ratio
            if len(close) >= 120:
                rets = close.pct_change().dropna()
                daily_var = rets.var()
                weekly_rets = close.resample("W").last().pct_change().dropna()
                if len(weekly_rets) >= 10 and daily_var > 0:
                    weekly_var = weekly_rets.var()
                    vr = weekly_var / (5 * daily_var)
                    if vr < 0.8:
                        score += 20
                        details.append(f"分散比 {vr:.2f} — 平均回帰傾向")
                    elif vr > 1.2:
                        score += 5
                        details.append(f"分散比 {vr:.2f} — トレンド持続傾向")
                    else:
                        score += 10
                        details.append(f"分散比 {vr:.2f} — ランダムウォーク近似")
                    metrics["分散比"] = f"{vr:.2f}"

        return {"score": min(score, 100), "details": details, "metrics": metrics}

    # ── Volatility Forecast (GARCH) ──────────────────────
    @staticmethod
    def _volatility_forecast(history):
        score = 0
        details = []
        metrics = {}

        if history is not None and not history.empty:
            close = history["Close"]
            if len(close) >= 60:
                rets = close.pct_change().dropna()

                # Realized vol
                rv_30 = rets.tail(30).std() * np.sqrt(252) * 100
                rv_90 = rets.tail(min(90, len(rets))).std() * np.sqrt(252) * 100
                metrics["30日実現ボラ"] = f"{rv_30:.1f}%"
                metrics["90日実現ボラ"] = f"{rv_90:.1f}%"

                # Simple EWMA volatility forecast
                lam = 0.94
                sq_rets = rets.values ** 2
                ewma_var = sq_rets[0]
                for r2 in sq_rets[1:]:
                    ewma_var = lam * ewma_var + (1 - lam) * r2
                ewma_vol = np.sqrt(ewma_var * 252) * 100
                metrics["EWMA予測ボラ"] = f"{ewma_vol:.1f}%"
                details.append(f"EWMA予測ボラティリティ: {ewma_vol:.1f}%")

                # Vol regime
                if rv_30 < 20:
                    score += 35
                    details.append(f"低ボラ環境 (30日: {rv_30:.1f}%)")
                elif rv_30 < 35:
                    score += 22
                    details.append(f"通常ボラ環境 (30日: {rv_30:.1f}%)")
                else:
                    score += 10
                    details.append(f"高ボラ環境 (30日: {rv_30:.1f}%)")

                # Vol trend
                if rv_90 > 0:
                    vol_change = ((rv_30 / rv_90) - 1) * 100
                    if vol_change < -20:
                        score += 30
                        details.append("ボラ縮小トレンド — 安定化")
                    elif vol_change > 20:
                        score += 10
                        details.append("ボラ拡大トレンド — 不安定化")
                    else:
                        score += 20
                        details.append("ボラティリティ安定")

                # Skewness
                skew = rets.skew()
                metrics["歪度"] = f"{skew:.3f}"
                if skew > 0.3:
                    score += 15
                    details.append(f"正の歪度 {skew:.3f} — 上方リスク優勢")
                elif skew < -0.3:
                    score += 5
                    details.append(f"負の歪度 {skew:.3f} — 下方リスク注意")
                else:
                    score += 10

        return {"score": min(score, 100), "details": details, "metrics": metrics}

    # ── Pair Trading (Gatev) ─────────────────────────────
    @staticmethod
    def _pair_trading(history):
        score = 0
        details = []
        metrics = {}

        if history is not None and not history.empty:
            close = history["Close"]
            if len(close) >= 60:
                # Z-score from rolling mean
                sma = close.rolling(60).mean()
                std = close.rolling(60).std()
                if std.iloc[-1] and std.iloc[-1] > 0:
                    z = (close.iloc[-1] - sma.iloc[-1]) / std.iloc[-1]
                    metrics["Zスコア(60日)"] = f"{z:.2f}"

                    if abs(z) > 2.0:
                        score += 40
                        sig = "売りシグナル" if z > 0 else "買いシグナル"
                        details.append(f"Zスコア {z:.2f} — 強い{sig}")
                    elif abs(z) > 1.5:
                        score += 30
                        details.append(f"Zスコア {z:.2f} — 乖離拡大")
                    elif abs(z) > 1.0:
                        score += 20
                        details.append(f"Zスコア {z:.2f} — 軽度乖離")
                    else:
                        score += 10
                        details.append(f"Zスコア {z:.2f} — 均衡")

                # Half-life of mean reversion
                if len(close) >= 120:
                    spread = np.log(close.values)
                    lag = spread[:-1]
                    diff = np.diff(spread)
                    if len(lag) > 0:
                        beta = np.polyfit(lag, diff, 1)[0]
                        if beta < 0:
                            hl = -np.log(2) / beta
                            metrics["半減期"] = f"{hl:.0f}日"
                            if hl < 20:
                                score += 30
                                details.append(f"平均回帰半減期 {hl:.0f}日 — 速い")
                            elif hl < 60:
                                score += 20
                                details.append(f"平均回帰半減期 {hl:.0f}日 — 適度")
                            else:
                                score += 10
                                details.append(f"平均回帰半減期 {hl:.0f}日 — 遅い")
                        else:
                            score += 5
                            details.append("トレンド持続（平均回帰なし）")

        return {"score": min(score, 100), "details": details, "metrics": metrics}

    # ── Post-Earnings Drift (Bernard-Thomas) ─────────────
    @staticmethod
    def _post_earnings_drift(info):
        score = 0
        details = []
        metrics = {}

        eps_growth = info.get("earningsGrowth")
        if eps_growth:
            eg = eps_growth * 100 if abs(eps_growth) < 5 else eps_growth
            if eg > 20:
                score += 40
                details.append(f"EPS成長率 {eg:+.1f}% — 強いポジティブサプライズ期待")
            elif eg > 5:
                score += 25
                details.append(f"EPS成長率 {eg:+.1f}% — ポジティブドリフト")
            elif eg > -5:
                score += 15
                details.append(f"EPS成長率 {eg:+.1f}% — 中立")
            else:
                score += 5
                details.append(f"EPS成長率 {eg:+.1f}% — ネガティブドリフト")
            metrics["EPS成長率"] = f"{eg:+.1f}%"

        rev_growth = info.get("revenueGrowth")
        if rev_growth:
            rg = rev_growth * 100 if abs(rev_growth) < 5 else rev_growth
            if rg > 15:
                score += 30
                details.append(f"売上成長 {rg:+.1f}% — 好決算持続")
            elif rg > 0:
                score += 18
                details.append(f"売上成長 {rg:+.1f}%")
            else:
                score += 5
                details.append(f"売上成長 {rg:+.1f}% — 減収")
            metrics["売上成長率"] = f"{rg:+.1f}%"

        # Analyst consensus
        rec = info.get("recommendationKey", "")
        if rec in ["strongBuy", "strong_buy"]:
            score += 20
            details.append("アナリスト: 強い買い → ドリフト継続期待")
        elif rec == "buy":
            score += 15
            details.append("アナリスト: 買い")
        elif rec == "hold":
            score += 8
        elif rec:
            score += 3

        return {"score": min(score, 100), "details": details, "metrics": metrics}

    # ── Accrual Anomaly (Sloan) ──────────────────────────
    @staticmethod
    def _accrual_anomaly(info):
        score = 0
        details = []
        metrics = {}

        ocf = info.get("operatingCashflow")
        net_income = info.get("netIncomeToCommon")
        total_assets = info.get("totalAssets")

        if ocf and net_income and total_assets and total_assets > 0:
            accrual_ratio = (net_income - ocf) / total_assets * 100
            metrics["アクルーアル比率"] = f"{accrual_ratio:.1f}%"

            if accrual_ratio < -5:
                score += 40
                details.append(f"アクルーアル {accrual_ratio:.1f}% — 低い（質の高い利益）")
            elif accrual_ratio < 0:
                score += 30
                details.append(f"アクルーアル {accrual_ratio:.1f}% — CFが利益を上回る")
            elif accrual_ratio < 5:
                score += 18
                details.append(f"アクルーアル {accrual_ratio:.1f}% — 適正")
            else:
                score += 5
                details.append(f"アクルーアル {accrual_ratio:.1f}% — 高い（利益の質に注意）")

        # CFO / Net Income ratio
        if ocf and net_income and net_income != 0:
            cf_quality = ocf / net_income
            metrics["CF/利益比率"] = f"{cf_quality:.2f}"
            if cf_quality > 1.2:
                score += 30
                details.append(f"CF/利益 {cf_quality:.2f} — 高品質")
            elif cf_quality > 0.8:
                score += 20
                details.append(f"CF/利益 {cf_quality:.2f} — 適正")
            elif cf_quality > 0:
                score += 10
                details.append(f"CF/利益 {cf_quality:.2f} — やや低い")
            else:
                score += 3
                details.append(f"CF/利益 {cf_quality:.2f} — 注意")

        # FCF margin
        fcf = info.get("freeCashflow")
        rev = info.get("totalRevenue")
        if fcf and rev and rev > 0:
            fcf_margin = fcf / rev * 100
            metrics["FCFマージン"] = f"{fcf_margin:.1f}%"
            if fcf_margin > 15:
                score += 20
            elif fcf_margin > 5:
                score += 12
            elif fcf_margin > 0:
                score += 8
            else:
                score += 3

        return {"score": min(score, 100), "details": details, "metrics": metrics}

    # ── Risk Parity (Maillard) ───────────────────────────
    @staticmethod
    def _risk_parity(info, history):
        score = 0
        details = []
        metrics = {}

        if history is not None and not history.empty:
            close = history["Close"]
            returns = close.pct_change().dropna()

            if len(returns) >= 60:
                vol = returns.std() * np.sqrt(252) * 100
                sharpe_est = (returns.mean() * 252) / (returns.std() * np.sqrt(252)) if returns.std() > 0 else 0
                metrics["年率ボラ"] = f"{vol:.1f}%"
                metrics["推定シャープ"] = f"{sharpe_est:.2f}"

                if sharpe_est > 1.0:
                    score += 35
                    details.append(f"推定シャープレシオ {sharpe_est:.2f} — 優秀")
                elif sharpe_est > 0.5:
                    score += 25
                    details.append(f"推定シャープレシオ {sharpe_est:.2f} — 良好")
                elif sharpe_est > 0:
                    score += 15
                    details.append(f"推定シャープレシオ {sharpe_est:.2f} — 正")
                else:
                    score += 5
                    details.append(f"推定シャープレシオ {sharpe_est:.2f} — 負")

                # Max drawdown
                cummax = close.cummax()
                dd = ((close - cummax) / cummax).min() * 100
                metrics["最大DD"] = f"{dd:.1f}%"
                if dd > -10:
                    score += 30
                    details.append(f"最大ドローダウン {dd:.1f}% — 小さい")
                elif dd > -20:
                    score += 20
                    details.append(f"最大ドローダウン {dd:.1f}% — 中程度")
                elif dd > -35:
                    score += 10
                    details.append(f"最大ドローダウン {dd:.1f}% — 大きい")
                else:
                    score += 3
                    details.append(f"最大ドローダウン {dd:.1f}% — 非常に大きい")

                # Risk contribution suggestion
                if vol < 20:
                    score += 20
                    details.append("リスクパリティ推奨ウェイト: 高め（低ボラ銘柄）")
                elif vol < 35:
                    score += 12
                    details.append("リスクパリティ推奨ウェイト: 中程度")
                else:
                    score += 5
                    details.append("リスクパリティ推奨ウェイト: 低め（高ボラ銘柄）")

                # Sortino
                neg = returns[returns < 0]
                if len(neg) > 0:
                    sortino = (returns.mean() * 252) / (neg.std() * np.sqrt(252)) if neg.std() > 0 else 0
                    metrics["ソルティノ比率"] = f"{sortino:.2f}"

        return {"score": min(score, 100), "details": details, "metrics": metrics}

    # ── Composite ────────────────────────────────────────
    @staticmethod
    def _composite(ff, mom, lv, qmj, dv, mr, vf, pt, ped, aa, rp):
        weights = {
            "Fama-French": 0.15,
            "モメンタム": 0.12,
            "低ボラティリティ": 0.10,
            "QMJ": 0.12,
            "ディープバリュー": 0.10,
            "平均回帰": 0.08,
            "ボラティリティ予測": 0.08,
            "ペアトレーディング": 0.05,
            "決算ドリフト": 0.08,
            "アクルーアル": 0.07,
            "リスクパリティ": 0.05,
        }

        scores = {
            "Fama-French": ff["score"],
            "モメンタム": mom["score"],
            "低ボラティリティ": lv["score"],
            "QMJ": qmj["score"],
            "ディープバリュー": dv["score"],
            "平均回帰": mr["score"],
            "ボラティリティ予測": vf["score"],
            "ペアトレーディング": pt["score"],
            "決算ドリフト": ped["score"],
            "アクルーアル": aa["score"],
            "リスクパリティ": rp["score"],
        }

        total = sum(scores[k] * weights[k] for k in weights)

        if total >= 70:
            rating = "非常に魅力的"
            rec = "強い買い推奨 — 複数ファクターが支持"
        elif total >= 55:
            rating = "魅力的"
            rec = "買い推奨"
        elif total >= 40:
            rating = "中立"
            rec = "保持/様子見"
        elif total >= 25:
            rating = "やや弱い"
            rec = "慎重に検討"
        else:
            rating = "弱い"
            rec = "見送り推奨"

        return {
            "total_score": round(total, 1),
            "max_score": 100,
            "factor_scores": scores,
            "weights": {k: f"{v*100:.0f}%" for k, v in weights.items()},
            "rating": rating,
            "recommendation": rec,
        }
