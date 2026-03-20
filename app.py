"""
GSSS - Goldman Sachs Style Stock Screener
日本株式分析Webアプリケーション
"""

from flask import Flask, render_template, request, jsonify
import json
import traceback

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

app = Flask(__name__)

# 分析タイプの定義
ANALYZERS = {
    "goldman": {
        "name": "Goldman Sachs 株式スクリーナー",
        "short": "GS スクリーナー",
        "icon": "📊",
        "description": "P/E比率、収益成長、負債比率、配当利回り、競争優位性の総合分析",
        "needs_ticker": True,
    },
    "morgan_technical": {
        "name": "Morgan Stanley テクニカル分析",
        "short": "MS テクニカル",
        "icon": "📈",
        "description": "トレンド、移動平均、RSI、MACD、ボリンジャーバンド等の主要テクニカル指標",
        "needs_ticker": True,
    },
    "bridgewater": {
        "name": "Bridgewater リスク評価",
        "short": "BW リスク",
        "icon": "🛡️",
        "description": "ボラティリティ、ベータ、最大ドローダウン、ストレステスト、ヘッジ提案",
        "needs_ticker": True,
    },
    "jpmorgan": {
        "name": "JPMorgan 決算アナライザー",
        "short": "JPM 決算",
        "icon": "📋",
        "description": "決算履歴、コンセンサス予想、決算日の値動き予想、ポジション戦略",
        "needs_ticker": True,
    },
    "blackrock": {
        "name": "BlackRock 配当インカム分析",
        "short": "BLK 配当",
        "icon": "💰",
        "description": "配当利回り、増配履歴、配当安全性、DRIP複利シミュレーション",
        "needs_ticker": True,
    },
    "citadel": {
        "name": "Citadel セクターローテーション",
        "short": "CTD セクター",
        "icon": "🔄",
        "description": "経済サイクル、セクターパフォーマンス比較、ローテーション推奨",
        "needs_ticker": False,
    },
    "renaissance": {
        "name": "Renaissance 定量スクリーナー",
        "short": "REN 定量",
        "icon": "🔬",
        "description": "バリュー、クオリティ、モメンタム、成長、センチメントの複合スコア",
        "needs_ticker": True,
    },
    "vanguard": {
        "name": "Vanguard ETFポートフォリオ",
        "short": "VGD ETF",
        "icon": "🏗️",
        "description": "アセットアロケーション、ETF選定、リバランスルール、税務最適化",
        "needs_ticker": False,
    },
    "mckinsey": {
        "name": "McKinsey マクロ経済レポート",
        "short": "MCK マクロ",
        "icon": "🌍",
        "description": "金利、インフレ、GDP、為替が市場に与える影響を分析",
        "needs_ticker": False,
    },
    "morgan_dcf": {
        "name": "Morgan Stanley DCFバリュエーション",
        "short": "MS DCF",
        "icon": "🧮",
        "description": "5年間の収益予測、WACC、ターミナルバリュー、感度分析による理論株価算出",
        "needs_ticker": True,
    },
    "academic_quant": {
        "name": "Academic Paper 定量分析",
        "short": "学術定量分析",
        "icon": "🎓",
        "description": "Fama-French、モメンタム、低ボラティリティ、QMJ等の学術論文ベースファクター分析",
        "needs_ticker": True,
    },
    "chart_pattern": {
        "name": "チャートパターン分析",
        "short": "チャートパターン",
        "icon": "📐",
        "description": "ヘッドアンドショルダー、ダブルトップ、三角保ち合い等のパターン認識とトレンド分析",
        "needs_ticker": True,
    },
}


def _safe_serialize(obj):
    """NaN/Inf等を安全にJSON化"""
    if isinstance(obj, dict):
        return {k: _safe_serialize(v) for k, v in obj.items()}
    elif isinstance(obj, list):
        return [_safe_serialize(v) for v in obj]
    elif isinstance(obj, float):
        if obj != obj:  # NaN
            return None
        if obj == float("inf") or obj == float("-inf"):
            return None
        return obj
    else:
        return obj


@app.route("/")
def index():
    return render_template("index.html", analyzers=ANALYZERS)


@app.route("/api/analyze", methods=["POST"])
def analyze():
    try:
        data = request.get_json()
        analyzer_type = data.get("analyzer")
        ticker = data.get("ticker", "").strip()
        params = data.get("params", {})

        if analyzer_type not in ANALYZERS:
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

        # 分析実行
        result = _run_analyzer(analyzer_type, stock_data, params)
        result = _safe_serialize(result)

        return jsonify({"success": True, "data": result, "analyzer_info": analyzer_info})

    except Exception as e:
        traceback.print_exc()
        return jsonify({"error": f"分析中にエラーが発生しました: {str(e)}"}), 500


@app.route("/api/search", methods=["GET"])
def search_stock():
    """銘柄コード・銘柄名で検索"""
    query = request.args.get("q", "").strip()
    if not query:
        return jsonify({"results": []})

    try:
        # 数字のみの場合は従来通りコード検索
        code = query.replace(".T", "")
        if code.isdigit():
            ticker = StockDataFetcher.normalize_ticker(query)
            name = StockDataFetcher.get_company_name(ticker)
            return jsonify({"results": [{"ticker": ticker, "name": name}]})

        # 銘柄名で検索（ローカルDB + yfinance）
        results = StockDataFetcher.search_by_name(query)
        if results:
            return jsonify({"results": results})

        # それでも見つからない場合はそのまま試行
        ticker = StockDataFetcher.normalize_ticker(query)
        name = StockDataFetcher.get_company_name(ticker)
        return jsonify({"results": [{"ticker": ticker, "name": name}]})
    except Exception:
        return jsonify({"results": []})


def _run_analyzer(analyzer_type: str, stock_data: dict, params: dict) -> dict:
    """分析エンジンを実行"""
    if analyzer_type == "goldman":
        return GoldmanScreener.analyze(stock_data)
    elif analyzer_type == "morgan_technical":
        return MorganTechnical.analyze(stock_data)
    elif analyzer_type == "bridgewater":
        return BridgewaterRisk.analyze(stock_data)
    elif analyzer_type == "jpmorgan":
        return JPMorganEarnings.analyze(stock_data)
    elif analyzer_type == "blackrock":
        amount = params.get("investment_amount", 1_000_000)
        return BlackRockDividend.analyze(stock_data, investment_amount=float(amount))
    elif analyzer_type == "citadel":
        return CitadelSector.analyze(stock_data)
    elif analyzer_type == "renaissance":
        return RenaissanceQuant.analyze(stock_data)
    elif analyzer_type == "vanguard":
        return VanguardETF.analyze(
            stock_data,
            risk_profile=params.get("risk_profile", "バランス型"),
            investment_amount=float(params.get("investment_amount", 1_000_000)),
            age=int(params.get("age", 40)),
        )
    elif analyzer_type == "mckinsey":
        return McKinseyMacro.analyze(stock_data)
    elif analyzer_type == "morgan_dcf":
        return MorganDCF.analyze(stock_data)
    elif analyzer_type == "academic_quant":
        return AcademicQuant.analyze(stock_data)
    elif analyzer_type == "chart_pattern":
        return ChartPattern.analyze(stock_data)
    else:
        return {"error": "未実装の分析タイプ"}


if __name__ == "__main__":
    app.run(debug=True, host="0.0.0.0", port=5000)
