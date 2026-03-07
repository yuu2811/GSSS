# GSSS - Goldman Sachs Style Stock Screener

**日本株式プロフェッショナル分析Webアプリケーション**

世界トップクラスの投資銀行・ヘッジファンドのスタイルで日本株を分析する10種類の分析エンジンを搭載したWebアプリです。銘柄コードを入力するだけで、プロフェッショナルレベルの分析レポートを即座に生成します。

---

## 主な機能

### 10種類の分析エンジン

| # | 分析名 | 概要 | 銘柄入力 |
|---|--------|------|:--------:|
| 1 | **Goldman Sachs 株式スクリーナー** | P/E比率、収益成長、負債比率、配当利回り、競争優位性（モート）の総合評価 | 必要 |
| 2 | **Morgan Stanley テクニカル分析** | 移動平均、RSI、MACD、ボリンジャーバンド、フィボナッチ、チャートパターン | 必要 |
| 3 | **Bridgewater リスク評価** | ボラティリティ、ベータ分析、最大ドローダウン、ストレステスト、ヘッジ提案 | 必要 |
| 4 | **JPMorgan 決算アナライザー** | 決算履歴（Beat/Miss）、コンセンサス予想、インプライドムーブ、ポジション戦略 | 必要 |
| 5 | **BlackRock 配当インカム分析** | 配当利回り、増配履歴、安全性スコア、DRIP複利シミュレーション、イールドトラップ判定 | 必要 |
| 6 | **Citadel セクターローテーション** | 経済サイクル判定、17セクターのパフォーマンス比較、ローテーション推奨 | 不要 |
| 7 | **Renaissance Technologies 定量スクリーナー** | バリュー/クオリティ/モメンタム/成長/センチメントの5ファクター複合スコア | 必要 |
| 8 | **Vanguard ETFポートフォリオ** | アセットアロケーション、ETF選定、リバランスルール、NISA/iDeCo税務最適化 | 不要 |
| 9 | **McKinsey マクロ経済レポート** | 金利環境、為替（USD/JPY）、グローバルリスク、セクター影響、ポートフォリオ調整提案 | 不要 |
| 10 | **Morgan Stanley DCFバリュエーション** | 5年間収益予測、WACC推定、ターミナルバリュー、感度分析テーブル | 必要 |

---

## セットアップ

### 必要環境

- Python 3.9 以上
- pip（Pythonパッケージマネージャー）

### インストール

```bash
# リポジトリをクローン
git clone <repository-url>
cd GSSS

# 依存パッケージをインストール
pip install -r requirements.txt
```

### 起動

```bash
# 開発サーバーを起動（デフォルト: http://localhost:5000）
python app.py
```

ブラウザで **http://localhost:5000** にアクセスしてください。

### 本番環境での起動（Gunicorn）

```bash
gunicorn -w 4 -b 0.0.0.0:5000 app:app
```

---

## 使い方

### 1. 銘柄を指定して分析する場合

1. 画面上部の入力欄に **銘柄コード**（例: `7203`）または **銘柄コード.T**（例: `7203.T`）を入力
2. **「銘柄確認」** ボタンをクリック（会社名が表示されます）
3. 実行したい分析カードをクリック
4. 分析結果が画面下部に表示されます

### 2. 銘柄不要の分析を実行する場合

以下の3つの分析は銘柄入力なしで実行できます:

- **Citadel セクターローテーション** — 日本株セクター全体の分析
- **Vanguard ETFポートフォリオ** — パラメータ（年齢・投資金額・リスク許容度）入力後に実行
- **McKinsey マクロ経済レポート** — 現在のマクロ環境の分析

### 代表的な銘柄コード例

| コード | 銘柄名 |
|--------|--------|
| 7203 | トヨタ自動車 |
| 9984 | ソフトバンクグループ |
| 6758 | ソニーグループ |
| 6861 | キーエンス |
| 9432 | 日本電信電話（NTT） |
| 8306 | 三菱UFJフィナンシャル・グループ |
| 6501 | 日立製作所 |
| 7974 | 任天堂 |
| 4063 | 信越化学工業 |
| 6902 | デンソー |

---

## 技術スタック

| レイヤー | 技術 |
|----------|------|
| バックエンド | Python 3 + Flask |
| 株価データ | yfinance（Yahoo Finance API） |
| フロントエンド | HTML5 + Tailwind CSS（CDN）+ Vanilla JavaScript |
| フォント | Noto Sans JP（Google Fonts） |

### プロジェクト構成

```
GSSS/
├── app.py                           # Flask Webアプリ（ルーティング・API）
├── requirements.txt                 # Python依存パッケージ
├── .gitignore
│
├── analyzers/                       # 分析エンジン群
│   ├── __init__.py
│   ├── stock_data.py                # yfinance データ取得・テクニカル指標計算
│   ├── goldman_screener.py          # GS 株式スクリーナー
│   ├── morgan_technical.py          # MS テクニカル分析
│   ├── bridgewater_risk.py          # BW リスク評価
│   ├── jpmorgan_earnings.py         # JPM 決算分析
│   ├── blackrock_dividend.py        # BLK 配当分析
│   ├── citadel_sector.py            # CTD セクターローテーション
│   ├── renaissance_quant.py         # REN 定量スクリーナー
│   ├── vanguard_etf.py              # VGD ETFポートフォリオ
│   ├── mckinsey_macro.py            # MCK マクロ経済
│   └── morgan_dcf.py                # MS DCFバリュエーション
│
├── templates/                       # HTMLテンプレート
│   ├── base.html                    # ベースレイアウト
│   └── index.html                   # メインページ
│
└── static/js/                       # フロントエンドJS
    ├── main.js                      # UI制御・API通信
    └── renderers.js                 # 10種類の分析結果レンダリング
```

---

## API リファレンス

### `POST /api/analyze`

分析を実行します。

**リクエストボディ（JSON）:**

```json
{
  "analyzer": "goldman",
  "ticker": "7203",
  "params": {}
}
```

| パラメータ | 型 | 説明 |
|------------|------|------|
| `analyzer` | string | 分析タイプ（後述の一覧参照） |
| `ticker` | string | 銘柄コード（例: `7203`, `7203.T`）。銘柄不要の分析では空文字 |
| `params` | object | 追加パラメータ（分析タイプにより異なる） |

**分析タイプ一覧:**

| analyzer 値 | 分析名 | 追加パラメータ |
|-------------|--------|---------------|
| `goldman` | Goldman Sachs スクリーナー | なし |
| `morgan_technical` | Morgan Stanley テクニカル | なし |
| `bridgewater` | Bridgewater リスク評価 | なし |
| `jpmorgan` | JPMorgan 決算分析 | なし |
| `blackrock` | BlackRock 配当分析 | `investment_amount` (数値) |
| `citadel` | Citadel セクターローテーション | なし |
| `renaissance` | Renaissance 定量スクリーナー | なし |
| `vanguard` | Vanguard ETFポートフォリオ | `age` (数値), `investment_amount` (数値), `risk_profile` (文字列) |
| `mckinsey` | McKinsey マクロ経済 | なし |
| `morgan_dcf` | Morgan Stanley DCF | なし |

**レスポンス例:**

```json
{
  "success": true,
  "data": { ... },
  "analyzer_info": {
    "name": "Goldman Sachs 株式スクリーナー",
    "icon": "📊",
    "description": "..."
  }
}
```

### `GET /api/search?q={query}`

銘柄コードを検索し、会社名を取得します。

```json
{
  "results": [
    { "ticker": "7203.T", "name": "Toyota Motor Corporation" }
  ]
}
```

---

## 注意事項

- **免責事項**: 本ツールの分析結果は情報提供のみを目的としており、投資助言ではありません。投資判断は自己責任で行ってください。
- **データソース**: 株価データは [yfinance](https://github.com/ranaroussi/yfinance)（Yahoo Finance）から取得しています。リアルタイムデータではなく、遅延がある場合があります。
- **対応市場**: 東京証券取引所（TSE）に上場している日本株が対象です。銘柄コードの末尾に `.T` が自動付与されます。
- **利用制限**: yfinance の利用規約に準拠します。過度なAPIリクエストは制限される場合があります。

---

## ライセンス

MIT License
