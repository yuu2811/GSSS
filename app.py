"""
GSSS - Goldman Sachs Style Stock Screener
日本株式分析Webアプリケーション
"""

from __future__ import annotations

import logging
import math
from typing import Any

from flask import Flask, render_template, request, jsonify

from analyzers import (
    StockDataFetcher,
    GoldmanScreener,
    MorganTechnical,
    BridgewaterRisk,
    JPMorganEarnings,
    BlackRockDividend,
    CitadelSector,
    RenaissanceQuant,
    VanguardETF,
    McKinseyMacro,
    MorganDCF,
    AcademicQuant,
    ChartPattern,
)

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger(__name__)

app = Flask(__name__)

# ── 分析タイプの定義 ─────────────────────────────────
ANALYZERS: dict[str, dict[str, Any]] = {
    "goldman": {
        "name": "Goldman Sachs 株式スクリーナー",
        "short": "GS スクリーナー",
        "icon": "📊",
        "description": "P/E比率、収益成長、負債比率、配当利回り、競争優位性の総合分析",
        "needs_ticker": True,
        "class": GoldmanScreener,
    },
    "morgan_technical": {
        "name": "Morgan Stanley テクニカル分析",
        "short": "MS テクニカル",
        "icon": "📈",
        "description": "トレンド、移動平均、RSI、MACD、ボリンジャーバンド等の主要テクニカル指標",
        "needs_ticker": True,
        "class": MorganTechnical,
    },
    "bridgewater": {
        "name": "Bridgewater リスク評価",
        "short": "BW リスク",
        "icon": "🛡️",
        "description": "ボラティリティ、ベータ、最大ドローダウン、ストレステスト、ヘッジ提案",
        "needs_ticker": True,
        "class": BridgewaterRisk,
    },
    "jpmorgan": {
        "name": "JPMorgan 決算アナライザー",
        "short": "JPM 決算",
        "icon": "📋",
        "description": "決算履歴、コンセンサス予想、決算日の値動き予想、ポジション戦略",
        "needs_ticker": True,
        "class": JPMorganEarnings,
    },
    "blackrock": {
        "name": "BlackRock 配当インカム分析",
        "short": "BLK 配当",
        "icon": "💰",
        "description": "配当利回り、増配履歴、配当安全性、DRIP複利シミュレーション",
        "needs_ticker": True,
        "class": BlackRockDividend,
    },
    "citadel": {
        "name": "Citadel セクターローテーション",
        "short": "CTD セクター",
        "icon": "🔄",
        "description": "経済サイクル、セクターパフォーマンス比較、ローテーション推奨",
        "needs_ticker": False,
        "class": CitadelSector,
    },
    "renaissance": {
        "name": "Renaissance 定量スクリーナー",
        "short": "REN 定量",
        "icon": "🔬",
        "description": "バリュー、クオリティ、モメンタム、成長、センチメントの複合スコア",
        "needs_ticker": True,
        "class": RenaissanceQuant,
    },
    "vanguard": {
        "name": "Vanguard ETFポートフォリオ",
        "short": "VGD ETF",
        "icon": "🏗️",
        "description": "アセットアロケーション、ETF選定、リバランスルール、税務最適化",
        "needs_ticker": False,
        "class": VanguardETF,
    },
    "mckinsey": {
        "name": "McKinsey マクロ経済レポート",
        "short": "MCK マクロ",
        "icon": "🌍",
        "description": "金利、インフレ、GDP、為替が市場に与える影響を分析",
        "needs_ticker": False,
        "class": McKinseyMacro,
    },
    "morgan_dcf": {
        "name": "Morgan Stanley DCFバリュエーション",
        "short": "MS DCF",
        "icon": "🧮",
        "description": "5年間の収益予測、WACC、ターミナルバリュー、感度分析による理論株価算出",
        "needs_ticker": True,
        "class": MorganDCF,
    },
    "academic_quant": {
        "name": "Academic Paper 定量分析",
        "short": "学術定量分析",
        "icon": "🎓",
        "description": "Fama-French、モメンタム、低ボラティリティ、QMJ等の学術論文ベースファクター分析",
        "needs_ticker": True,
        "class": AcademicQuant,
    },
    "chart_pattern": {
        "name": "チャートパターン分析",
        "short": "チャートパターン",
        "icon": "📐",
        "description": "ヘッドアンドショルダー、ダブルトップ、三角保ち合い等のパターン認識とトレンド分析",
        "needs_ticker": True,
        "class": ChartPattern,
    },
}


def _get_analyzer_metadata() -> dict[str, dict]:
    """フロントエンド用のメタデータ（class を除外）を返す。"""
    return {
        key: {k: v for k, v in info.items() if k != "class"}
        for key, info in ANALYZERS.items()
    }


def _run_analyzer(analyzer_type: str, stock_data: dict | None, params: dict) -> dict:
    """分析エンジンを実行する。"""
    entry = ANALYZERS.get(analyzer_type)
    if entry is None:
        return {"error": "未実装の分析タイプ"}

    cls = entry["class"]

    # パラメータ付きアナライザー
    if analyzer_type == "blackrock":
        return cls.analyze(
            stock_data,
            investment_amount=_safe_float(params.get("investment_amount"), 1_000_000),
        )
    if analyzer_type == "vanguard":
        return cls.analyze(
            stock_data,
            risk_profile=params.get("risk_profile", "バランス型"),
            investment_amount=_safe_float(params.get("investment_amount"), 1_000_000),
            age=_safe_int(params.get("age"), 40),
        )
    return cls.analyze(stock_data)


def _safe_float(value, default: float) -> float:
    """安全に float 変換する。"""
    try:
        return float(value)
    except (TypeError, ValueError):
        return default


def _safe_int(value, default: int) -> int:
    """安全に int 変換する。"""
    try:
        return int(value)
    except (TypeError, ValueError):
        return default


def _safe_serialize(obj):
    """NaN / Inf 等を安全に JSON 化する。"""
    if isinstance(obj, dict):
        return {k: _safe_serialize(v) for k, v in obj.items()}
    if isinstance(obj, list):
        return [_safe_serialize(v) for v in obj]
    if isinstance(obj, float):
        if math.isnan(obj) or math.isinf(obj):
            return None
    return obj


# ── ルーティング ──────────────────────────────────────

@app.route("/api/health")
def health():
    return jsonify({"status": "ok"})


@app.route("/")
def index():
    return render_template("index.html", analyzers=_get_analyzer_metadata())


@app.route("/api/analyze", methods=["POST"])
def analyze():
    data = request.get_json(silent=True) or {}
    analyzer_type = data.get("analyzer")
    ticker = (data.get("ticker") or "").strip()
    params = data.get("params") or {}

    if not analyzer_type or analyzer_type not in ANALYZERS:
        return jsonify({"error": "不明な分析タイプです"}), 400

    analyzer_info = ANALYZERS[analyzer_type]

    # 銘柄コードが必要な分析
    stock_data = None
    if analyzer_info["needs_ticker"]:
        if not ticker:
            return jsonify({"error": "銘柄コードを入力してください"}), 400
        stock_data = StockDataFetcher.fetch(ticker)
        if not stock_data.get("info"):
            return jsonify({"error": f"銘柄 {ticker} のデータを取得できません"}), 404

    try:
        result = _run_analyzer(analyzer_type, stock_data, params)
        result = _safe_serialize(result)
    except Exception:
        logger.exception("分析中にエラーが発生しました (type=%s, ticker=%s)", analyzer_type, ticker)
        return jsonify({"error": "分析中にエラーが発生しました"}), 500

    metadata = {k: v for k, v in analyzer_info.items() if k != "class"}
    return jsonify({"success": True, "data": result, "analyzer_info": metadata})


@app.route("/api/analyze_all", methods=["POST"])
def analyze_all():
    """銘柄コードを受け取り、全分析を一括実行する。"""
    data = request.get_json(silent=True) or {}
    ticker = (data.get("ticker") or "").strip()
    params = data.get("params") or {}

    if not ticker:
        return jsonify({"error": "銘柄コードを入力してください"}), 400

    stock_data = StockDataFetcher.fetch(ticker)
    if not stock_data.get("info"):
        return jsonify({"error": f"銘柄 {ticker} のデータを取得できません"}), 404

    results: dict[str, Any] = {}
    errors: dict[str, str] = {}

    for key in ANALYZERS:
        try:
            results[key] = _safe_serialize(_run_analyzer(key, stock_data, params))
        except Exception as e:
            logger.warning("アナライザー %s でエラー: %s", key, e)
            errors[key] = str(e)

    return jsonify({
        "success": True,
        "results": results,
        "errors": errors,
        "analyzers": _get_analyzer_metadata(),
    })


@app.route("/api/search", methods=["GET"])
def search_stock():
    """銘柄コード・銘柄名で検索する。"""
    query = (request.args.get("q") or "").strip()
    if not query:
        return jsonify({"results": []})

    try:
        results = StockDataFetcher.search_by_name(query)
        if results:
            return jsonify({"results": results})

        # 最終フォールバック: そのままティッカーとして扱う
        ticker = StockDataFetcher.normalize_ticker(query)
        name = StockDataFetcher.get_company_name(ticker)
        return jsonify({"results": [{"ticker": ticker, "name": name}]})
    except Exception:
        logger.exception("検索エラー (query=%s)", query)
        return jsonify({"results": []})


if __name__ == "__main__":
    app.run(debug=True, host="0.0.0.0", port=5000)
