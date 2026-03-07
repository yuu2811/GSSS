/**
 * GSSS - GitHub Pages版 メインアプリケーション
 */

const ANALYZERS = {
    goldman: { name: 'Goldman Sachs 株式スクリーナー', short: 'GS スクリーナー', icon: '📊', description: 'P/E比率、収益成長、負債比率、配当利回り、競争優位性の総合分析', needs_ticker: true },
    morgan_technical: { name: 'Morgan Stanley テクニカル分析', short: 'MS テクニカル', icon: '📈', description: 'トレンド、移動平均、RSI、MACD、ボリンジャーバンド等の主要テクニカル指標', needs_ticker: true },
    bridgewater: { name: 'Bridgewater リスク評価', short: 'BW リスク', icon: '🛡️', description: 'ボラティリティ、ベータ、最大ドローダウン、ストレステスト、ヘッジ提案', needs_ticker: true },
    jpmorgan: { name: 'JPMorgan 決算アナライザー', short: 'JPM 決算', icon: '📋', description: '決算履歴、コンセンサス予想、決算日の値動き予想、ポジション戦略', needs_ticker: true },
    blackrock: { name: 'BlackRock 配当インカム分析', short: 'BLK 配当', icon: '💰', description: '配当利回り、増配履歴、配当安全性、DRIP複利シミュレーション', needs_ticker: true },
    citadel: { name: 'Citadel セクターローテーション', short: 'CTD セクター', icon: '🔄', description: '経済サイクル、セクターパフォーマンス比較、ローテーション推奨', needs_ticker: false },
    renaissance: { name: 'Renaissance 定量スクリーナー', short: 'REN 定量', icon: '🔬', description: 'バリュー、クオリティ、モメンタム、成長、センチメントの複合スコア', needs_ticker: true },
    vanguard: { name: 'Vanguard ETFポートフォリオ', short: 'VGD ETF', icon: '🏗️', description: 'アセットアロケーション、ETF選定、リバランスルール、税務最適化', needs_ticker: false },
    mckinsey: { name: 'McKinsey マクロ経済レポート', short: 'MCK マクロ', icon: '🌍', description: '金利、インフレ、GDP、為替が市場に与える影響を分析', needs_ticker: false },
    morgan_dcf: { name: 'Morgan Stanley DCFバリュエーション', short: 'MS DCF', icon: '🧮', description: '5年間の収益予測、WACC、ターミナルバリュー、感度分析による理論株価算出', needs_ticker: true },
};

let currentTicker = '';
let currentAnalyzer = '';
let cachedStockData = null;

function init() {
    const grid = document.getElementById('analyzerGrid');
    for (const [key, a] of Object.entries(ANALYZERS)) {
        const div = document.createElement('div');
        div.className = 'analyzer-card bg-gs-card border border-gs-border rounded-xl p-4 sm:p-5 cursor-pointer active:scale-[0.98]';
        div.setAttribute('data-analyzer', key);
        div.setAttribute('data-needs-ticker', a.needs_ticker);
        div.onclick = () => runAnalysis(key);
        div.innerHTML = `
            <div class="flex items-start gap-3">
                <span class="text-2xl flex-shrink-0">${a.icon}</span>
                <div class="flex-1 min-w-0">
                    <h3 class="text-white font-medium text-sm mb-1">${a.short}</h3>
                    <p class="text-gs-text/60 text-xs leading-relaxed">${a.description}</p>
                </div>
            </div>
            ${!a.needs_ticker ? '<div class="mt-3"><span class="text-xs bg-gs-navy/50 text-gs-accent px-2 py-0.5 rounded">銘柄コード不要</span></div>' : ''}
        `;
        grid.appendChild(div);
    }

    document.getElementById('tickerInput').addEventListener('keydown', e => {
        if (e.key === 'Enter') searchStock();
    });
}

async function searchStock() {
    const input = document.getElementById('tickerInput').value.trim();
    if (!input) return;

    const ticker = StockFetcher.normalizeTicker(input);
    const infoEl = document.getElementById('stockInfo');
    const nameEl = document.getElementById('stockName');
    const tickerEl = document.getElementById('stockTicker');

    nameEl.textContent = '読み込み中...';
    tickerEl.textContent = '';
    infoEl.classList.remove('hidden');

    try {
        cachedStockData = await StockFetcher.fetchStockData(ticker);
        currentTicker = ticker;
        nameEl.textContent = cachedStockData.info.longName;
        tickerEl.textContent = `(${ticker})`;
    } catch (e) {
        nameEl.textContent = ticker;
        tickerEl.textContent = '(情報取得中)';
        currentTicker = ticker;
        cachedStockData = null;
    }
}

async function runAnalysis(analyzerType) {
    const info = ANALYZERS[analyzerType];
    if (!info) return;

    if (info.needs_ticker) {
        const input = document.getElementById('tickerInput').value.trim();
        if (!input && !currentTicker) {
            alert('銘柄コードを入力してください');
            document.getElementById('tickerInput').focus();
            return;
        }
        if (!currentTicker) {
            currentTicker = StockFetcher.normalizeTicker(input);
        }
    }

    if (analyzerType === 'blackrock' || analyzerType === 'vanguard') {
        showParamsForm(analyzerType);
        return;
    }

    currentAnalyzer = analyzerType;
    await executeAnalysis(analyzerType, {});
}

function showParamsForm(analyzerType) {
    currentAnalyzer = analyzerType;
    const section = document.getElementById('paramsSection');
    const content = document.getElementById('paramsContent');
    const title = document.getElementById('paramsTitle');
    section.classList.remove('hidden');

    if (analyzerType === 'blackrock') {
        title.textContent = 'BlackRock 配当分析 - パラメータ';
        content.innerHTML = `<div><label class="block text-sm text-gs-text/70 mb-1">投資金額（円）</label><input type="number" id="param_investment_amount" value="1000000" class="w-full bg-gs-dark border border-gs-border rounded-lg px-4 py-3 text-white focus:border-gs-accent focus:outline-none text-base"></div>`;
    } else {
        title.textContent = 'Vanguard ETFポートフォリオ - パラメータ';
        content.innerHTML = `
            <div><label class="block text-sm text-gs-text/70 mb-1">年齢</label><input type="number" id="param_age" value="35" class="w-full bg-gs-dark border border-gs-border rounded-lg px-4 py-3 text-white focus:border-gs-accent focus:outline-none text-base"></div>
            <div><label class="block text-sm text-gs-text/70 mb-1">投資金額（円）</label><input type="number" id="param_investment_amount" value="1000000" class="w-full bg-gs-dark border border-gs-border rounded-lg px-4 py-3 text-white focus:border-gs-accent focus:outline-none text-base"></div>
            <div><label class="block text-sm text-gs-text/70 mb-1">リスクプロファイル</label><select id="param_risk_profile" class="w-full bg-gs-dark border border-gs-border rounded-lg px-4 py-3 text-white focus:border-gs-accent focus:outline-none text-base"><option value="積極型">積極型</option><option value="やや積極型">やや積極型</option><option value="バランス型" selected>バランス型</option><option value="やや保守型">やや保守型</option><option value="保守型">保守型</option></select></div>
        `;
    }
    section.scrollIntoView({ behavior: 'smooth' });
}

async function submitWithParams() {
    const params = {};
    if (currentAnalyzer === 'blackrock') {
        params.investment_amount = Number(document.getElementById('param_investment_amount').value);
    } else if (currentAnalyzer === 'vanguard') {
        params.age = Number(document.getElementById('param_age').value);
        params.investment_amount = Number(document.getElementById('param_investment_amount').value);
        params.risk_profile = document.getElementById('param_risk_profile').value;
    }
    document.getElementById('paramsSection').classList.add('hidden');
    await executeAnalysis(currentAnalyzer, params);
}

async function executeAnalysis(analyzerType, params) {
    const loading = document.getElementById('loading');
    const results = document.getElementById('results');
    const loadingText = document.getElementById('loadingText');
    const info = ANALYZERS[analyzerType];

    loading.classList.remove('hidden');
    results.classList.add('hidden');
    results.innerHTML = '';
    loadingText.textContent = 'データを取得中...';
    loading.scrollIntoView({ behavior: 'smooth' });

    try {
        let data;

        if (info.needs_ticker) {
            loadingText.textContent = `${currentTicker} のデータを取得中...`;
            if (!cachedStockData || cachedStockData.ticker !== currentTicker) {
                cachedStockData = await StockFetcher.fetchStockData(currentTicker);
            }
            loadingText.textContent = '分析を実行中...';
        }

        switch (analyzerType) {
            case 'goldman': data = Analyzers.goldman(cachedStockData); break;
            case 'morgan_technical': data = Analyzers.morgan_technical(cachedStockData); break;
            case 'bridgewater': data = await Analyzers.bridgewater(cachedStockData); break;
            case 'jpmorgan': data = Analyzers.jpmorgan(cachedStockData); break;
            case 'blackrock': data = Analyzers.blackrock(cachedStockData, params.investment_amount); break;
            case 'citadel': loadingText.textContent = '市場データを取得中...'; data = await Analyzers.citadel(); break;
            case 'renaissance': data = Analyzers.renaissance(cachedStockData); break;
            case 'vanguard': data = Analyzers.vanguard(params); break;
            case 'mckinsey': loadingText.textContent = 'マクロデータを取得中...'; data = await Analyzers.mckinsey(); break;
            case 'morgan_dcf': data = Analyzers.morgan_dcf(cachedStockData); break;
        }

        loading.classList.add('hidden');
        results.innerHTML = renderAnalysis(analyzerType, data, info);
        results.classList.remove('hidden');
        results.scrollIntoView({ behavior: 'smooth' });

    } catch (e) {
        loading.classList.add('hidden');
        results.innerHTML = renderError(e.message || '分析中にエラーが発生しました');
        results.classList.remove('hidden');
    }
}

function renderError(msg) {
    return `<div class="bg-red-900/30 border border-red-700/50 rounded-xl p-6 text-center"><p class="text-red-400 font-medium">エラー</p><p class="text-red-300/80 mt-2 text-sm">${msg}</p><p class="text-red-300/50 mt-3 text-xs">CORSプロキシの制限により取得できない場合があります。<br>しばらく待ってから再試行してください。</p></div>`;
}

function escapeHtml(t) { const d = document.createElement('div'); d.textContent = t; return d.innerHTML; }
function formatNumber(n, d = 0) { if (n == null) return 'N/A'; if (typeof n !== 'number') return String(n); return n.toLocaleString('ja-JP', { minimumFractionDigits: d, maximumFractionDigits: d }); }
function formatCurrency(n) { if (n == null) return 'N/A'; if (typeof n !== 'number') return String(n); if (Math.abs(n) >= 1e12) return `¥${(n/1e12).toFixed(1)}兆`; if (Math.abs(n) >= 1e8) return `¥${(n/1e8).toFixed(0)}億`; if (Math.abs(n) >= 1e4) return `¥${(n/1e4).toFixed(0)}万`; return `¥${n.toLocaleString('ja-JP')}`; }
function formatPercent(n) { if (n == null) return 'N/A'; return `${n >= 0 ? '+' : ''}${n.toFixed(1)}%`; }
function scoreColor(s, m = 10) { const r = s / m; return r >= 0.7 ? 'bg-green-500' : r >= 0.5 ? 'bg-yellow-500' : r >= 0.3 ? 'bg-orange-500' : 'bg-red-500'; }
function riskColor(s) { return s <= 3 ? 'text-green-400' : s <= 5 ? 'text-yellow-400' : s <= 7 ? 'text-orange-400' : 'text-red-400'; }

document.addEventListener('DOMContentLoaded', init);
