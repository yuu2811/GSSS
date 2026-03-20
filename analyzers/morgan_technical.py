"""Morgan Stanley スタイル テクニカル分析"""

from __future__ import annotations

from .stock_data import StockDataFetcher, StockData, AnalysisResult


class MorganTechnical:
    """モルガン・スタンレー流のテクニカル分析ダッシュボード"""

    NAME = "Morgan Stanley テクニカル分析"
    DESCRIPTION = "トレンド分析、移動平均、RSI、MACD、ボリンジャーバンドなど主要テクニカル指標を網羅"

    @staticmethod
    def analyze(stock_data: StockData) -> AnalysisResult:
        info = stock_data.get("info", {})
        history = stock_data.get("history")
        ticker = stock_data.get("ticker", "N/A")
        company_name = StockDataFetcher.get_display_name(info, ticker)

        if history is None or history.empty:
            return {"analyzer": MorganTechnical.NAME, "error": "価格データが取得できません"}

        indicators = StockDataFetcher.calculate_technical_indicators(history)
        fib_levels = StockDataFetcher.calculate_fibonacci_levels(history)

        current_price = indicators.get("current_price", 0)

        # トレンド分析
        trend = MorganTechnical._analyze_trend(history, indicators)

        # サポート/レジスタンス
        support_resistance = MorganTechnical._find_support_resistance(history)

        # 移動平均分析
        ma_analysis = MorganTechnical._analyze_moving_averages(indicators, current_price)

        # RSI分析
        rsi_analysis = MorganTechnical._analyze_rsi(indicators)

        # MACD分析
        macd_analysis = MorganTechnical._analyze_macd(indicators)

        # ボリンジャーバンド分析
        bb_analysis = MorganTechnical._analyze_bollinger(indicators, current_price)

        # 出来高分析
        volume_analysis = MorganTechnical._analyze_volume(indicators)

        # チャートパターン識別
        pattern = MorganTechnical._identify_pattern(history)

        # トレードセットアップ
        trade_setup = MorganTechnical._generate_trade_setup(
            current_price, support_resistance, indicators, trend
        )

        return {
            "analyzer": MorganTechnical.NAME,
            "company_name": company_name,
            "ticker": ticker,
            "current_price": current_price,
            "trend": trend,
            "support_resistance": support_resistance,
            "ma_analysis": ma_analysis,
            "rsi_analysis": rsi_analysis,
            "macd_analysis": macd_analysis,
            "bb_analysis": bb_analysis,
            "volume_analysis": volume_analysis,
            "fibonacci": fib_levels,
            "pattern": pattern,
            "trade_setup": trade_setup,
            "raw_indicators": indicators,
        }

    @staticmethod
    def _analyze_trend(history, indicators):
        close = history["Close"]
        current = close.iloc[-1]

        # 日足トレンド (20日)
        if len(close) >= 20:
            sma20 = close.rolling(20).mean().iloc[-1]
            daily_trend = "上昇" if current > sma20 else "下降"
        else:
            daily_trend = "判定不可"

        # 週足トレンド (50日)
        if len(close) >= 50:
            sma50 = close.rolling(50).mean().iloc[-1]
            weekly_trend = "上昇" if current > sma50 else "下降"
        else:
            weekly_trend = "判定不可"

        # 月足トレンド (200日)
        if len(close) >= 200:
            sma200 = close.rolling(200).mean().iloc[-1]
            monthly_trend = "上昇" if current > sma200 else "下降"
        else:
            monthly_trend = "判定不可"

        # ゴールデンクロス / デッドクロス判定
        crossover = None
        if indicators.get("sma_50") and indicators.get("sma_200"):
            if indicators["sma_50"] > indicators["sma_200"]:
                crossover = "ゴールデンクロス圏"
            else:
                crossover = "デッドクロス圏"

        primary = "上昇" if daily_trend == "上昇" and weekly_trend == "上昇" else \
                  "下降" if daily_trend == "下降" and weekly_trend == "下降" else "レンジ"

        return {
            "primary": primary,
            "daily": daily_trend,
            "weekly": weekly_trend,
            "monthly": monthly_trend,
            "crossover": crossover,
        }

    @staticmethod
    def _find_support_resistance(history):
        if len(history) < 20:
            return {"supports": [], "resistances": []}

        close = history["Close"]
        high = history["High"]
        low = history["Low"]

        # 直近のサポート・レジスタンス
        recent = close.tail(60) if len(close) >= 60 else close

        supports = [
            round(low.tail(20).min(), 0),
            round(low.tail(60).min(), 0) if len(low) >= 60 else None,
        ]
        resistances = [
            round(high.tail(20).max(), 0),
            round(high.tail(60).max(), 0) if len(high) >= 60 else None,
        ]

        supports = [s for s in supports if s is not None]
        resistances = [r for r in resistances if r is not None]

        return {"supports": sorted(set(supports)), "resistances": sorted(set(resistances), reverse=True)}

    @staticmethod
    def _analyze_moving_averages(indicators, current_price):
        mas = {}
        signals = []

        for period in [20, 50, 100, 200]:
            key = f"sma_{period}"
            val = indicators.get(key)
            if val is not None:
                position = "上" if current_price > val else "下"
                mas[f"{period}日"] = {"value": round(val, 0), "position": position}
                if position == "上":
                    signals.append(f"{period}日線の上（強気）")
                else:
                    signals.append(f"{period}日線の下（弱気）")

        bullish_count = sum(1 for v in mas.values() if v["position"] == "上")
        total = len(mas)
        if total > 0:
            if bullish_count == total:
                overall = "全線上抜け（非常に強気）"
            elif bullish_count >= total * 0.75:
                overall = "概ね強気"
            elif bullish_count >= total * 0.5:
                overall = "中立"
            elif bullish_count > 0:
                overall = "概ね弱気"
            else:
                overall = "全線下抜け（非常に弱気）"
        else:
            overall = "データ不足"

        return {"moving_averages": mas, "signals": signals, "overall": overall}

    @staticmethod
    def _analyze_rsi(indicators):
        rsi = indicators.get("rsi")
        if rsi is None:
            return {"value": None, "interpretation": "データなし"}

        rsi = round(rsi, 1)
        if rsi > 70:
            interpretation = "買われすぎ（売りシグナル）"
            signal = "売り"
        elif rsi > 60:
            interpretation = "やや買われすぎ"
            signal = "注意"
        elif rsi < 30:
            interpretation = "売られすぎ（買いシグナル）"
            signal = "買い"
        elif rsi < 40:
            interpretation = "やや売られすぎ"
            signal = "注目"
        else:
            interpretation = "中立圏"
            signal = "中立"

        return {"value": rsi, "interpretation": interpretation, "signal": signal}

    @staticmethod
    def _analyze_macd(indicators):
        macd = indicators.get("macd")
        signal = indicators.get("macd_signal")
        histogram = indicators.get("macd_histogram")

        if macd is None:
            return {"interpretation": "データなし"}

        crossover = None
        momentum = None

        if macd > signal:
            crossover = "MACDがシグナル線の上（強気）"
        else:
            crossover = "MACDがシグナル線の下（弱気）"

        if histogram > 0:
            momentum = "正のモメンタム（上昇圧力）"
        else:
            momentum = "負のモメンタム（下降圧力）"

        return {
            "macd": round(macd, 2),
            "signal": round(signal, 2),
            "histogram": round(histogram, 2),
            "crossover": crossover,
            "momentum": momentum,
        }

    @staticmethod
    def _analyze_bollinger(indicators, current_price):
        upper = indicators.get("bb_upper")
        middle = indicators.get("bb_middle")
        lower = indicators.get("bb_lower")
        width = indicators.get("bb_width")

        if upper is None:
            return {"interpretation": "データなし"}

        if current_price > upper:
            position = "上限バンド突破（買われすぎ）"
        elif current_price > middle:
            position = "上半分（やや強気）"
        elif current_price > lower:
            position = "下半分（やや弱気）"
        else:
            position = "下限バンド割れ（売られすぎ）"

        squeeze = "スクイーズ（収縮）" if width and width < 5 else "拡張"

        return {
            "upper": round(upper, 0),
            "middle": round(middle, 0),
            "lower": round(lower, 0),
            "width": round(width, 2) if width else None,
            "position": position,
            "squeeze_status": squeeze,
        }

    @staticmethod
    def _analyze_volume(indicators):
        ratio = indicators.get("volume_ratio")
        if ratio is None:
            return {"interpretation": "データなし"}

        avg_vol = indicators.get("avg_volume_20", 0)
        cur_vol = indicators.get("current_volume", 0)

        if ratio > 2.0:
            interpretation = "出来高急増（大きな動きの兆候）"
            confirmation = "価格変動を強く裏付け"
        elif ratio > 1.3:
            interpretation = "出来高増加"
            confirmation = "価格変動を裏付け"
        elif ratio > 0.7:
            interpretation = "平均的な出来高"
            confirmation = "中立"
        else:
            interpretation = "出来高減少"
            confirmation = "価格変動の信頼性低い"

        return {
            "current_volume": int(cur_vol) if cur_vol else 0,
            "avg_volume_20d": int(avg_vol) if avg_vol else 0,
            "ratio": round(ratio, 2),
            "interpretation": interpretation,
            "confirmation": confirmation,
        }

    @staticmethod
    def _identify_pattern(history):
        """簡易的なチャートパターン識別"""
        if len(history) < 40:
            return {"pattern": "判定不可", "description": "データ不足"}

        close = history["Close"].tail(60) if len(history) >= 60 else history["Close"]
        high = close.max()
        low = close.min()
        current = close.iloc[-1]
        mid = (high + low) / 2

        # 簡易パターン判定
        recent_10 = close.tail(10)
        recent_30 = close.tail(30)

        if recent_10.is_monotonic_increasing:
            return {"pattern": "上昇トレンド継続", "description": "直近10日間連続上昇", "signal": "強気"}
        elif recent_10.is_monotonic_decreasing:
            return {"pattern": "下降トレンド継続", "description": "直近10日間連続下降", "signal": "弱気"}

        # レンジ判定
        volatility = recent_30.std() / recent_30.mean()
        if volatility < 0.02:
            return {"pattern": "レンジ相場（ボックス圏）", "description": "変動幅が小さく方向感なし", "signal": "中立"}

        # 反転パターン
        first_half = close.iloc[:len(close)//2].mean()
        second_half = close.iloc[len(close)//2:].mean()
        if first_half < second_half and current > mid:
            return {"pattern": "上昇転換の可能性", "description": "後半の平均が前半を上回っている", "signal": "やや強気"}
        elif first_half > second_half and current < mid:
            return {"pattern": "下降転換の可能性", "description": "後半の平均が前半を下回っている", "signal": "やや弱気"}

        return {"pattern": "明確なパターンなし", "description": "継続監視が必要", "signal": "中立"}

    @staticmethod
    def _generate_trade_setup(current_price, sr, indicators, trend):
        if not current_price:
            return {}

        supports = sr.get("supports", [])
        resistances = sr.get("resistances", [])

        if supports:
            stop_loss = round(supports[0] * 0.98, 0)
        else:
            stop_loss = round(current_price * 0.95, 0)

        if resistances:
            target1 = resistances[0]
            target2 = round(resistances[0] * 1.05, 0)
        else:
            target1 = round(current_price * 1.05, 0)
            target2 = round(current_price * 1.10, 0)

        risk = current_price - stop_loss
        reward = target1 - current_price
        rr_ratio = round(reward / risk, 2) if risk > 0 else 0

        return {
            "entry": round(current_price, 0),
            "stop_loss": stop_loss,
            "target_1": target1,
            "target_2": target2,
            "risk_reward_ratio": rr_ratio,
            "direction": "ロング" if trend["primary"] == "上昇" else
                         "ショート" if trend["primary"] == "下降" else "様子見",
        }
