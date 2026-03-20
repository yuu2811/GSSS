"""Citadel スタイル セクターローテーション戦略"""

import yfinance as yf


class CitadelSector:
    """シタデル流のセクターローテーション分析"""

    NAME = "Citadel セクターローテーション"
    DESCRIPTION = "経済サイクル、セクターパフォーマンス、相対強度、バリュエーション比較"

    # 日本株セクターETF（TOPIX-17シリーズ等）
    SECTOR_ETFS = {
        "食品": {"ticker": "1617.T", "global_equivalent": "Consumer Staples"},
        "エネルギー資源": {"ticker": "1618.T", "global_equivalent": "Energy"},
        "建設・資材": {"ticker": "1619.T", "global_equivalent": "Industrials"},
        "素材・化学": {"ticker": "1620.T", "global_equivalent": "Materials"},
        "医薬品": {"ticker": "1621.T", "global_equivalent": "Healthcare"},
        "自動車・輸送機": {"ticker": "1622.T", "global_equivalent": "Consumer Discretionary"},
        "鉄鋼・非鉄": {"ticker": "1623.T", "global_equivalent": "Materials"},
        "機械": {"ticker": "1624.T", "global_equivalent": "Industrials"},
        "電機・精密": {"ticker": "1625.T", "global_equivalent": "Technology"},
        "情報通信・サービスその他": {"ticker": "1626.T", "global_equivalent": "Communication Services"},
        "電力・ガス": {"ticker": "1627.T", "global_equivalent": "Utilities"},
        "運輸・物流": {"ticker": "1628.T", "global_equivalent": "Industrials"},
        "商社・卸売": {"ticker": "1629.T", "global_equivalent": "Consumer Discretionary"},
        "小売": {"ticker": "1630.T", "global_equivalent": "Consumer Staples"},
        "銀行": {"ticker": "1631.T", "global_equivalent": "Financials"},
        "金融（除く銀行）": {"ticker": "1632.T", "global_equivalent": "Financials"},
        "不動産": {"ticker": "1633.T", "global_equivalent": "Real Estate"},
    }

    @staticmethod
    def analyze(stock_data: dict = None) -> dict:
        """セクターローテーション分析を実行"""

        # セクターパフォーマンスを取得
        sector_performance = CitadelSector._fetch_sector_performance()

        # 経済サイクル判定
        cycle = CitadelSector._assess_economic_cycle()

        # ローテーション推奨
        rotation = CitadelSector._rotation_recommendation(cycle, sector_performance)

        # モデルアロケーション
        allocation = CitadelSector._model_allocation(cycle, sector_performance)

        return {
            "analyzer": CitadelSector.NAME,
            "economic_cycle": cycle,
            "sector_performance": sector_performance,
            "rotation_recommendation": rotation,
            "model_allocation": allocation,
        }

    @staticmethod
    def _fetch_sector_performance():
        """各セクターETFのパフォーマンスを取得"""
        results = []

        for sector_name, info in CitadelSector.SECTOR_ETFS.items():
            try:
                ticker = yf.Ticker(info["ticker"])
                hist = ticker.history(period="6mo")

                if hist.empty or len(hist) < 5:
                    continue

                close = hist["Close"]
                current = close.iloc[-1]

                # リターン計算
                ret_1m = ((current / close.iloc[-22]) - 1) * 100 if len(close) >= 22 else None
                ret_3m = ((current / close.iloc[-66]) - 1) * 100 if len(close) >= 66 else None
                ret_6m = ((current / close.iloc[0]) - 1) * 100

                results.append({
                    "sector": sector_name,
                    "ticker": info["ticker"],
                    "current_price": round(current, 0),
                    "return_1m": round(ret_1m, 1) if ret_1m else None,
                    "return_3m": round(ret_3m, 1) if ret_3m else None,
                    "return_6m": round(ret_6m, 1),
                    "momentum": "上昇" if (ret_1m is not None and ret_1m > 0) else ("下降" if ret_1m is not None else "データなし"),
                })
            except Exception:
                continue

        # パフォーマンスでソート
        results.sort(key=lambda x: x.get("return_3m") or 0, reverse=True)

        return results

    @staticmethod
    def _assess_economic_cycle():
        """経済サイクルの判定（マーケット指標ベース）"""
        try:
            nikkei = yf.Ticker("^N225")
            hist = nikkei.history(period="1y")

            if hist.empty:
                return {"phase": "不明", "description": "データ取得エラー"}

            close = hist["Close"]
            sma200 = close.rolling(200).mean().iloc[-1] if len(close) >= 200 else close.mean()
            current = close.iloc[-1]

            ret_6m = ((current / close.iloc[-130]) - 1) * 100 if len(close) >= 130 else 0
            ret_3m = ((current / close.iloc[-66]) - 1) * 100 if len(close) >= 66 else 0

            if current > sma200 and ret_3m > 0:
                phase = "拡大期"
                description = "日経平均は200日線を上回り、上昇モメンタム継続中"
                recommended = ["電機・精密", "機械", "自動車・輸送機", "商社・卸売"]
                avoid = ["電力・ガス", "食品"]
            elif current > sma200 and ret_3m < 0:
                phase = "ピーク/減速期"
                description = "日経平均は200日線上だが、短期モメンタムが鈍化"
                recommended = ["医薬品", "食品", "電力・ガス"]
                avoid = ["不動産", "建設・資材"]
            elif current < sma200 and ret_3m < 0:
                phase = "収縮期"
                description = "日経平均は200日線を下回り、下降トレンド"
                recommended = ["食品", "医薬品", "電力・ガス"]
                avoid = ["機械", "鉄鋼・非鉄", "不動産"]
            else:
                phase = "回復期"
                description = "日経平均は200日線下だが、反転の兆候"
                recommended = ["銀行", "不動産", "建設・資材"]
                avoid = ["電力・ガス"]

            return {
                "phase": phase,
                "description": description,
                "nikkei_current": round(current, 0),
                "nikkei_sma200": round(sma200, 0),
                "nikkei_ret_3m": round(ret_3m, 1),
                "recommended_sectors": recommended,
                "avoid_sectors": avoid,
            }
        except Exception:
            return {"phase": "判定不可", "description": "市場データ取得エラー"}

    @staticmethod
    def _rotation_recommendation(cycle, performance):
        overweight = []
        underweight = []

        recommended = cycle.get("recommended_sectors", [])
        avoid = cycle.get("avoid_sectors", [])

        for p in performance:
            sector = p["sector"]
            ret_3m = p.get("return_3m") or 0

            if sector in recommended and ret_3m > 0:
                overweight.append({
                    "sector": sector,
                    "reason": f"経済サイクル的に有利 + 3ヶ月リターン{ret_3m:.1f}%",
                    "conviction": "高",
                })
            elif sector in recommended:
                overweight.append({
                    "sector": sector,
                    "reason": f"経済サイクル的に有利（モメンタム未発生）",
                    "conviction": "中",
                })
            elif sector in avoid:
                underweight.append({
                    "sector": sector,
                    "reason": f"経済サイクル的に不利",
                    "conviction": "高" if ret_3m < 0 else "中",
                })

        return {
            "overweight": overweight[:5],
            "underweight": underweight[:5],
            "positioning": "リスクオン" if cycle.get("phase") in ["拡大期", "回復期"] else "リスクオフ",
        }

    @staticmethod
    def _model_allocation(cycle, performance):
        phase = cycle.get("phase", "")

        if phase == "拡大期":
            base = {"攻撃的セクター": 60, "中立セクター": 30, "防御的セクター": 10}
        elif phase == "ピーク/減速期":
            base = {"攻撃的セクター": 30, "中立セクター": 40, "防御的セクター": 30}
        elif phase == "収縮期":
            base = {"攻撃的セクター": 10, "中立セクター": 30, "防御的セクター": 60}
        else:  # 回復期
            base = {"攻撃的セクター": 45, "中立セクター": 35, "防御的セクター": 20}

        return {
            "phase": phase,
            "allocation": base,
            "note": "上記はモデルポートフォリオの目安です。個別のリスク許容度に応じて調整してください。",
        }
