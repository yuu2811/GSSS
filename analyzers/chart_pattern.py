"""チャートパターン認識 + トレンド分析"""

import numpy as np
from .stock_data import StockDataFetcher


class ChartPattern:
    """古典的チャートパターン、ローソク足パターン、トレンド分析"""

    NAME = "チャートパターン分析"
    DESCRIPTION = "ヘッドアンドショルダー、ダブルトップ、三角保ち合い等のパターン認識とトレンド分析"

    @staticmethod
    def analyze(stock_data: dict) -> dict:
        info = stock_data.get("info", {})
        history = stock_data.get("history")
        ticker = stock_data.get("ticker", "N/A")
        company_name = StockDataFetcher.get_display_name(info, ticker)

        if history is None or history.empty:
            return {"analyzer": ChartPattern.NAME, "error": "価格データが取得できません"}

        classical = ChartPattern._classical_patterns(history, info)
        candle = ChartPattern._candlestick_patterns(history)
        trend = ChartPattern._trend_analysis(history)
        ma_cross = ChartPattern._ma_crossover(history)
        sr = ChartPattern._support_resistance(history)
        chart_data = ChartPattern._chart_data(history)
        signals = ChartPattern._signals_summary(classical, candle, trend, ma_cross, info)

        return {
            "analyzer": ChartPattern.NAME,
            "company_name": company_name,
            "ticker": ticker,
            "signals_summary": signals,
            "chart_data": chart_data,
            "classical_patterns": classical,
            "candlestick_patterns": candle,
            "trend_analysis": trend,
            "ma_crossover_systems": ma_cross,
            "support_resistance": sr,
        }

    # ── Chart data for candlestick rendering ─────────────
    @staticmethod
    def _chart_data(history):
        recent = history.tail(120)
        ohlcv = []
        for idx, row in recent.iterrows():
            ohlcv.append({
                "date": idx.strftime("%Y-%m-%d") if hasattr(idx, "strftime") else str(idx),
                "open": float(row.get("Open", 0)),
                "high": float(row.get("High", 0)),
                "low": float(row.get("Low", 0)),
                "close": float(row.get("Close", 0)),
                "volume": int(row.get("Volume", 0)),
            })
        return {"ohlcv": ohlcv}

    # ── Classical patterns ───────────────────────────────
    @staticmethod
    def _classical_patterns(history, info):
        patterns = []
        close = history["Close"]
        high = history["High"]
        low = history["Low"]
        current = float(close.iloc[-1])

        if len(close) < 60:
            return patterns

        # ── Double Top ───────────────────────────────────
        if len(high) >= 60:
            window = high.tail(60)
            peaks = []
            vals = window.values
            for i in range(2, len(vals) - 2):
                if vals[i] > vals[i-1] and vals[i] > vals[i-2] and vals[i] > vals[i+1] and vals[i] > vals[i+2]:
                    peaks.append((i, vals[i]))
            if len(peaks) >= 2:
                p1, p2 = peaks[-2], peaks[-1]
                if p1[1] > 0 and abs(p1[1] - p2[1]) / p1[1] < 0.03 and p2[0] - p1[0] >= 10:
                    neckline = float(low.tail(60).iloc[p1[0]:p2[0]].min())
                    target = neckline - (p1[1] - neckline)
                    patterns.append({
                        "name": "ダブルトップ",
                        "signal": "弱気",
                        "confidence": 65,
                        "description": f"2つの高値 ¥{p1[1]:.0f} / ¥{p2[1]:.0f} が近似。ネックライン ¥{neckline:.0f}",
                        "target_price": round(target),
                    })

        # ── Double Bottom ────────────────────────────────
        if len(low) >= 60:
            window = low.tail(60)
            troughs = []
            vals = window.values
            for i in range(2, len(vals) - 2):
                if vals[i] < vals[i-1] and vals[i] < vals[i-2] and vals[i] < vals[i+1] and vals[i] < vals[i+2]:
                    troughs.append((i, vals[i]))
            if len(troughs) >= 2:
                t1, t2 = troughs[-2], troughs[-1]
                if t1[1] > 0 and abs(t1[1] - t2[1]) / t1[1] < 0.03 and t2[0] - t1[0] >= 10:
                    neckline = float(high.tail(60).iloc[t1[0]:t2[0]].max())
                    target = neckline + (neckline - t1[1])
                    patterns.append({
                        "name": "ダブルボトム",
                        "signal": "強気",
                        "confidence": 65,
                        "description": f"2つの安値 ¥{t1[1]:.0f} / ¥{t2[1]:.0f} が近似。ネックライン ¥{neckline:.0f}",
                        "target_price": round(target),
                    })

        # ── Head and Shoulders ───────────────────────────
        if len(high) >= 90:
            window = high.tail(90)
            peaks = []
            vals = window.values
            for i in range(3, len(vals) - 3):
                if vals[i] > vals[i-1] and vals[i] > vals[i-2] and vals[i] > vals[i+1] and vals[i] > vals[i+2]:
                    peaks.append((i, vals[i]))
            if len(peaks) >= 3:
                for j in range(len(peaks) - 2):
                    left, head, right = peaks[j], peaks[j+1], peaks[j+2]
                    if head[1] > left[1] and head[1] > right[1]:
                        if left[1] > 0 and abs(left[1] - right[1]) / left[1] < 0.05:
                            neckline = float(low.tail(90).iloc[left[0]:right[0]].min())
                            target = neckline - (head[1] - neckline)
                            patterns.append({
                                "name": "ヘッドアンドショルダー",
                                "signal": "弱気",
                                "confidence": 70,
                                "description": f"頭 ¥{head[1]:.0f}、左肩 ¥{left[1]:.0f}、右肩 ¥{right[1]:.0f}",
                                "target_price": round(target),
                            })
                            break

        # ── Triangle (Ascending / Descending / Symmetric) ─
        if len(close) >= 40:
            recent_high = high.tail(40).values
            recent_low = low.tail(40).values
            high_slope = np.polyfit(range(len(recent_high)), recent_high, 1)[0]
            low_slope = np.polyfit(range(len(recent_low)), recent_low, 1)[0]

            if abs(high_slope) < 0.5 and low_slope > 0.5:
                patterns.append({
                    "name": "上昇三角形",
                    "signal": "強気",
                    "confidence": 60,
                    "description": "高値が水平、安値が切り上げ — ブレイクアウト期待",
                })
            elif high_slope < -0.5 and abs(low_slope) < 0.5:
                patterns.append({
                    "name": "下降三角形",
                    "signal": "弱気",
                    "confidence": 60,
                    "description": "高値が切り下げ、安値が水平 — ブレイクダウン注意",
                })
            elif high_slope < -0.3 and low_slope > 0.3:
                patterns.append({
                    "name": "対称三角形",
                    "signal": "中立",
                    "confidence": 55,
                    "description": "高値切り下げ・安値切り上げの三角保ち合い",
                })

        # ── Wedge ────────────────────────────────────────
        if len(close) >= 30:
            rc = close.tail(30).values
            rh = high.tail(30).values
            rl = low.tail(30).values
            h_s = np.polyfit(range(len(rh)), rh, 1)[0]
            l_s = np.polyfit(range(len(rl)), rl, 1)[0]
            if h_s > 0 and l_s > 0 and h_s < l_s * 0.6:
                patterns.append({
                    "name": "上昇ウェッジ",
                    "signal": "弱気",
                    "confidence": 55,
                    "description": "上昇しながら収束 — 反転下落の可能性",
                })
            elif h_s < 0 and l_s < 0 and abs(h_s) < abs(l_s) * 0.6:
                patterns.append({
                    "name": "下降ウェッジ",
                    "signal": "強気",
                    "confidence": 55,
                    "description": "下降しながら収束 — 反転上昇の可能性",
                })

        return patterns

    # ── Candlestick patterns ─────────────────────────────
    @staticmethod
    def _candlestick_patterns(history):
        patterns = []
        if len(history) < 5:
            return patterns

        recent = history.tail(5)
        o = recent["Open"].values
        h = recent["High"].values
        l = recent["Low"].values
        c = recent["Close"].values

        # Latest candle
        body = abs(c[-1] - o[-1])
        upper = h[-1] - max(c[-1], o[-1])
        lower = min(c[-1], o[-1]) - l[-1]
        total_range = h[-1] - l[-1]

        if total_range > 0:
            # ── Doji ─────────────────────────────────────
            if body / total_range < 0.1:
                patterns.append({
                    "name": "十字線（同時線）",
                    "signal": "中立",
                    "description": "始値と終値がほぼ同じ — トレンド転換の可能性",
                })

            # ── Hammer ───────────────────────────────────
            if lower > body * 2 and upper < body * 0.5 and c[-1] > o[-1]:
                patterns.append({
                    "name": "ハンマー",
                    "signal": "強気",
                    "description": "長い下ヒゲに小さな実体 — 底値反転シグナル",
                })

            # ── Shooting Star ────────────────────────────
            if upper > body * 2 and lower < body * 0.5 and c[-1] < o[-1]:
                patterns.append({
                    "name": "シューティングスター",
                    "signal": "弱気",
                    "description": "長い上ヒゲに小さな実体 — 天井反転シグナル",
                })

            # ── Engulfing ────────────────────────────────
            if len(c) >= 2:
                prev_body = abs(c[-2] - o[-2])
                if c[-1] > o[-1] and c[-2] < o[-2] and body > prev_body * 1.2:
                    if c[-1] > o[-2] and o[-1] < c[-2]:
                        patterns.append({
                            "name": "強気の包み足",
                            "signal": "強気",
                            "description": "陽線が前日の陰線を完全に包み込む — 反転上昇",
                        })
                elif c[-1] < o[-1] and c[-2] > o[-2] and body > prev_body * 1.2:
                    if o[-1] > c[-2] and c[-1] < o[-2]:
                        patterns.append({
                            "name": "弱気の包み足",
                            "signal": "弱気",
                            "description": "陰線が前日の陽線を完全に包み込む — 反転下落",
                        })

            # ── Morning Star (3 candles) ─────────────────
            if len(c) >= 3:
                body_3 = abs(c[-3] - o[-3])
                body_2 = abs(c[-2] - o[-2])
                if total_range > 0 and body_3 > 0:
                    if (c[-3] < o[-3] and body_2 < body_3 * 0.3
                            and c[-1] > o[-1] and body > body_3 * 0.5):
                        patterns.append({
                            "name": "明けの明星",
                            "signal": "強気",
                            "description": "3本足の底値反転パターン — 強い買いシグナル",
                        })
                    elif (c[-3] > o[-3] and body_2 < body_3 * 0.3
                            and c[-1] < o[-1] and body > body_3 * 0.5):
                        patterns.append({
                            "name": "宵の明星",
                            "signal": "弱気",
                            "description": "3本足の天井反転パターン — 強い売りシグナル",
                        })

            # ── Marubozu ─────────────────────────────────
            if body / total_range > 0.9:
                if c[-1] > o[-1]:
                    patterns.append({
                        "name": "陽線坊主",
                        "signal": "強気",
                        "description": "ヒゲがほぼない大陽線 — 強い買い圧力",
                    })
                else:
                    patterns.append({
                        "name": "陰線坊主",
                        "signal": "弱気",
                        "description": "ヒゲがほぼない大陰線 — 強い売り圧力",
                    })

        return patterns

    # ── Trend analysis with ADX ──────────────────────────
    @staticmethod
    def _trend_analysis(history):
        close = history["Close"]
        high = history["High"]
        low = history["Low"]

        adx_data = {"adx": None, "plus_di": None, "minus_di": None, "trend_strength": "N/A"}
        direction = "N/A"

        if len(close) < 30:
            return {"adx_data": adx_data, "direction": direction}

        # Calculate ADX
        n = 14
        tr_list = []
        plus_dm_list = []
        minus_dm_list = []
        for i in range(1, len(close)):
            hi = float(high.iloc[i])
            lo = float(low.iloc[i])
            prev_close = float(close.iloc[i - 1])
            prev_hi = float(high.iloc[i - 1])
            prev_lo = float(low.iloc[i - 1])
            tr = max(hi - lo, abs(hi - prev_close), abs(lo - prev_close))
            plus_dm = max(hi - prev_hi, 0) if (hi - prev_hi) > (prev_lo - lo) else 0
            minus_dm = max(prev_lo - lo, 0) if (prev_lo - lo) > (hi - prev_hi) else 0
            tr_list.append(tr)
            plus_dm_list.append(plus_dm)
            minus_dm_list.append(minus_dm)

        if len(tr_list) < n + 1:
            return {"adx_data": adx_data, "direction": direction}

        # Smoothed TR, +DM, -DM
        atr = sum(tr_list[:n])
        apdm = sum(plus_dm_list[:n])
        amdm = sum(minus_dm_list[:n])
        dx_list = []
        for i in range(n, len(tr_list)):
            atr = atr - atr / n + tr_list[i]
            apdm = apdm - apdm / n + plus_dm_list[i]
            amdm = amdm - amdm / n + minus_dm_list[i]
            plus_di = (apdm / atr * 100) if atr > 0 else 0
            minus_di = (amdm / atr * 100) if atr > 0 else 0
            di_sum = plus_di + minus_di
            dx = abs(plus_di - minus_di) / di_sum * 100 if di_sum > 0 else 0
            dx_list.append(dx)

        if len(dx_list) >= n:
            adx = sum(dx_list[:n]) / n
            for i in range(n, len(dx_list)):
                adx = (adx * (n - 1) + dx_list[i]) / n

            # Latest +DI, -DI
            latest_plus_di = (apdm / atr * 100) if atr > 0 else 0
            latest_minus_di = (amdm / atr * 100) if atr > 0 else 0

            if adx >= 40:
                strength = "非常に強いトレンド"
            elif adx >= 25:
                strength = "強いトレンド"
            elif adx >= 15:
                strength = "弱いトレンド"
            else:
                strength = "レンジ相場"

            if latest_plus_di > latest_minus_di:
                direction = "上昇トレンド"
            else:
                direction = "下降トレンド"

            adx_data = {
                "adx": round(adx, 1),
                "plus_di": round(latest_plus_di, 1),
                "minus_di": round(latest_minus_di, 1),
                "trend_strength": strength,
            }

        return {"adx_data": adx_data, "direction": direction}

    # ── Moving Average Crossover ─────────────────────────
    @staticmethod
    def _ma_crossover(history):
        close = history["Close"]
        result = {
            "crossover_status": "N/A",
            "days_since_crossover": None,
            "alignment": "N/A",
            "sma_50": None,
            "sma_200": None,
        }

        if len(close) < 200:
            if len(close) >= 50:
                result["sma_50"] = round(float(close.rolling(50).mean().iloc[-1]), 1)
            return result

        sma50 = close.rolling(50).mean()
        sma200 = close.rolling(200).mean()
        result["sma_50"] = round(float(sma50.iloc[-1]), 1)
        result["sma_200"] = round(float(sma200.iloc[-1]), 1)

        # Detect crossover
        current_above = sma50.iloc[-1] > sma200.iloc[-1]
        days_since = 0
        for i in range(2, min(len(sma50), 252)):
            prev = sma50.iloc[-i] > sma200.iloc[-i]
            if prev != current_above:
                days_since = i - 1
                break

        if current_above:
            result["crossover_status"] = "ゴールデンクロス"
        else:
            result["crossover_status"] = "デッドクロス"

        result["days_since_crossover"] = days_since if days_since > 0 else None

        # MA alignment
        current_price = float(close.iloc[-1])
        if current_price > sma50.iloc[-1] > sma200.iloc[-1]:
            result["alignment"] = "完全強気整列（価格 > SMA50 > SMA200）"
        elif current_price < sma50.iloc[-1] < sma200.iloc[-1]:
            result["alignment"] = "完全弱気整列（価格 < SMA50 < SMA200）"
        elif current_price > sma200.iloc[-1]:
            result["alignment"] = "やや強気（価格 > SMA200）"
        else:
            result["alignment"] = "やや弱気（価格 < SMA200）"

        return result

    # ── Support / Resistance ─────────────────────────────
    @staticmethod
    def _support_resistance(history):
        close = history["Close"]
        high = history["High"]
        low = history["Low"]
        current = float(close.iloc[-1])

        levels = []
        if len(close) < 30:
            return {"levels": levels}

        # Find pivot highs/lows
        window = min(120, len(close))
        h_vals = high.tail(window).values
        l_vals = low.tail(window).values

        resistance_prices = []
        support_prices = []

        for i in range(5, len(h_vals) - 5):
            if h_vals[i] == max(h_vals[i-5:i+6]):
                resistance_prices.append(float(h_vals[i]))
            if l_vals[i] == min(l_vals[i-5:i+6]):
                support_prices.append(float(l_vals[i]))

        # Cluster nearby levels
        def cluster(prices, threshold=0.02):
            if not prices:
                return []
            prices.sort()
            clusters = [[prices[0]]]
            for p in prices[1:]:
                if clusters[-1][-1] > 0 and (p - clusters[-1][-1]) / clusters[-1][-1] < threshold:
                    clusters[-1].append(p)
                else:
                    clusters.append([p])
            return [sum(c) / len(c) for c in clusters]

        res_levels = [r for r in cluster(resistance_prices) if r > current]
        sup_levels = [s for s in cluster(support_prices) if s < current]

        # Nearest resistances
        res_levels.sort()
        for r in res_levels[:3]:
            dist = ((r / current) - 1) * 100
            levels.append({
                "type": "resistance",
                "price": round(r, 1),
                "distance_pct": round(dist, 1),
            })

        # Nearest supports
        sup_levels.sort(reverse=True)
        for s in sup_levels[:3]:
            dist = ((s / current) - 1) * 100
            levels.append({
                "type": "support",
                "price": round(s, 1),
                "distance_pct": round(dist, 1),
            })

        return {"levels": levels}

    # ── Signals summary ──────────────────────────────────
    @staticmethod
    def _signals_summary(classical, candle, trend, ma_cross, info):
        bullish = 0
        bearish = 0

        for p in classical:
            if p["signal"] == "強気":
                bullish += 2
            elif p["signal"] == "弱気":
                bearish += 2

        for p in candle:
            if p["signal"] == "強気":
                bullish += 1
            elif p["signal"] == "弱気":
                bearish += 1

        # Trend direction
        if trend.get("direction") == "上昇トレンド":
            bullish += 1
        elif trend.get("direction") == "下降トレンド":
            bearish += 1

        # MA crossover
        if ma_cross.get("crossover_status") == "ゴールデンクロス":
            bullish += 1
        elif ma_cross.get("crossover_status") == "デッドクロス":
            bearish += 1

        total = bullish + bearish
        if total == 0:
            direction = "中立"
            confidence = 50
        elif bullish > bearish:
            direction = "強気" if bullish > bearish * 2 else "やや強気"
            confidence = min(90, 50 + int((bullish - bearish) / max(total, 1) * 50))
        elif bearish > bullish:
            direction = "弱気" if bearish > bullish * 2 else "やや弱気"
            confidence = min(90, 50 + int((bearish - bullish) / max(total, 1) * 50))
        else:
            direction = "中立"
            confidence = 50

        # Price targets from classical patterns
        price_targets = []
        for p in classical:
            if p.get("target_price"):
                price_targets.append({
                    "pattern": p["name"],
                    "label": p["name"],
                    "price": p["target_price"],
                    "type": "bullish" if p["signal"] == "強気" else "bearish",
                })

        return {
            "direction": direction,
            "confidence": confidence,
            "bullish_count": bullish,
            "bearish_count": bearish,
            "price_targets": price_targets,
        }
