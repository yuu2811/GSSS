/**
 * GSSS - メインJavaScript
 */

let currentTicker = '';
let currentAnalyzer = '';

// 銘柄検索
async function searchStock() {
    const input = document.getElementById('tickerInput').value.trim();
    if (!input) return;

    try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(input)}`);
        const data = await res.json();
        if (data.results && data.results.length > 0) {
            const stock = data.results[0];
            currentTicker = stock.ticker;
            document.getElementById('stockName').textContent = stock.name;
            document.getElementById('stockTicker').textContent = `(${stock.ticker})`;
            document.getElementById('stockInfo').classList.remove('hidden');
        }
    } catch (e) {
        console.error('検索エラー:', e);
    }
}

// Enterキーで検索
document.getElementById('tickerInput').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') searchStock();
});

// 分析実行
async function runAnalysis(analyzerType) {
    const needsTicker = document.querySelector(`[data-analyzer="${analyzerType}"]`)
        .getAttribute('data-needs-ticker') === 'true';

    if (needsTicker) {
        const input = document.getElementById('tickerInput').value.trim();
        if (!input && !currentTicker) {
            alert('銘柄コードを入力してください');
            document.getElementById('tickerInput').focus();
            return;
        }
        if (!currentTicker) {
            currentTicker = input.endsWith('.T') ? input : (input.match(/^\d+$/) ? input + '.T' : input);
        }
    }

    // パラメータが必要な分析
    if (analyzerType === 'blackrock' || analyzerType === 'vanguard') {
        showParamsForm(analyzerType);
        return;
    }

    currentAnalyzer = analyzerType;
    await executeAnalysis(analyzerType, {});
}

// パラメータフォーム表示
function showParamsForm(analyzerType) {
    currentAnalyzer = analyzerType;
    const section = document.getElementById('paramsSection');
    const content = document.getElementById('paramsContent');
    const title = document.getElementById('paramsTitle');

    section.classList.remove('hidden');

    if (analyzerType === 'blackrock') {
        title.textContent = 'BlackRock 配当分析 - パラメータ設定';
        content.innerHTML = `
            <div>
                <label class="block text-sm text-gs-text/70 mb-1">投資金額（円）</label>
                <input type="number" id="param_investment_amount" value="1000000"
                    class="w-full bg-gs-dark border border-gs-border rounded-lg px-4 py-2 text-white focus:border-gs-accent focus:outline-none">
            </div>
        `;
    } else if (analyzerType === 'vanguard') {
        title.textContent = 'Vanguard ETFポートフォリオ - パラメータ設定';
        content.innerHTML = `
            <div>
                <label class="block text-sm text-gs-text/70 mb-1">年齢</label>
                <input type="number" id="param_age" value="35"
                    class="w-full bg-gs-dark border border-gs-border rounded-lg px-4 py-2 text-white focus:border-gs-accent focus:outline-none">
            </div>
            <div>
                <label class="block text-sm text-gs-text/70 mb-1">投資金額（円）</label>
                <input type="number" id="param_investment_amount" value="1000000"
                    class="w-full bg-gs-dark border border-gs-border rounded-lg px-4 py-2 text-white focus:border-gs-accent focus:outline-none">
            </div>
            <div>
                <label class="block text-sm text-gs-text/70 mb-1">リスクプロファイル</label>
                <select id="param_risk_profile"
                    class="w-full bg-gs-dark border border-gs-border rounded-lg px-4 py-2 text-white focus:border-gs-accent focus:outline-none">
                    <option value="積極型">積極型</option>
                    <option value="やや積極型">やや積極型</option>
                    <option value="バランス型" selected>バランス型</option>
                    <option value="やや保守型">やや保守型</option>
                    <option value="保守型">保守型</option>
                </select>
            </div>
        `;
    }

    section.scrollIntoView({ behavior: 'smooth' });
}

// パラメータ付き実行
async function submitWithParams() {
    const params = {};

    if (currentAnalyzer === 'blackrock') {
        params.investment_amount = document.getElementById('param_investment_amount').value;
    } else if (currentAnalyzer === 'vanguard') {
        params.age = document.getElementById('param_age').value;
        params.investment_amount = document.getElementById('param_investment_amount').value;
        params.risk_profile = document.getElementById('param_risk_profile').value;
    }

    document.getElementById('paramsSection').classList.add('hidden');
    await executeAnalysis(currentAnalyzer, params);
}

// 分析API呼び出し
async function executeAnalysis(analyzerType, params) {
    const loading = document.getElementById('loading');
    const results = document.getElementById('results');
    const loadingText = document.getElementById('loadingText');

    loading.classList.remove('hidden');
    results.classList.add('hidden');
    results.innerHTML = '';
    loadingText.textContent = '分析データを取得中...';

    loading.scrollIntoView({ behavior: 'smooth' });

    try {
        const res = await fetch('/api/analyze', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                analyzer: analyzerType,
                ticker: currentTicker,
                params: params,
            }),
        });

        const data = await res.json();

        loading.classList.add('hidden');

        if (data.error) {
            results.innerHTML = renderError(data.error);
            results.classList.remove('hidden');
            return;
        }

        results.innerHTML = renderAnalysis(analyzerType, data.data, data.analyzer_info);
        results.classList.remove('hidden');
        results.scrollIntoView({ behavior: 'smooth' });

    } catch (e) {
        loading.classList.add('hidden');
        results.innerHTML = renderError('通信エラーが発生しました: ' + e.message);
        results.classList.remove('hidden');
    }
}

// エラー表示
function renderError(message) {
    return `
        <div class="bg-red-900/30 border border-red-700/50 rounded-xl p-6 text-center">
            <p class="text-red-400 font-medium">エラー</p>
            <p class="text-red-300/80 mt-2">${escapeHtml(message)}</p>
        </div>
    `;
}

// HTMLエスケープ
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// 数値フォーマット
function formatNumber(num, decimals = 0) {
    if (num === null || num === undefined) return 'N/A';
    if (typeof num !== 'number') return String(num);
    return num.toLocaleString('ja-JP', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

function formatCurrency(num) {
    if (num === null || num === undefined) return 'N/A';
    if (typeof num !== 'number') return String(num);
    if (Math.abs(num) >= 1e12) return `¥${(num / 1e12).toFixed(1)}兆`;
    if (Math.abs(num) >= 1e8) return `¥${(num / 1e8).toFixed(0)}億`;
    if (Math.abs(num) >= 1e4) return `¥${(num / 1e4).toFixed(0)}万`;
    return `¥${num.toLocaleString('ja-JP')}`;
}

function formatPercent(num) {
    if (num === null || num === undefined) return 'N/A';
    return `${num >= 0 ? '+' : ''}${num.toFixed(1)}%`;
}

// スコアバーの色
function scoreColor(score, max = 10) {
    const ratio = score / max;
    if (ratio >= 0.7) return 'bg-green-500';
    if (ratio >= 0.5) return 'bg-yellow-500';
    if (ratio >= 0.3) return 'bg-orange-500';
    return 'bg-red-500';
}

function riskColor(score) {
    if (score <= 3) return 'text-green-400';
    if (score <= 5) return 'text-yellow-400';
    if (score <= 7) return 'text-orange-400';
    return 'text-red-400';
}
