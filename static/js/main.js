/**
 * GSSS - メインJavaScript (Polished Design - Flask版)
 *
 * 機能: 検索履歴, キーボードショートカット, スケルトンローダー
 */

let currentTicker = '';
let currentAnalyzer = '';
let statusTimer = null;
const HISTORY_KEY = 'gsss_search_history';
const MAX_HISTORY = 8;

// ══════════════════════════════════════════════════════
// 検索履歴
// ══════════════════════════════════════════════════════
function getSearchHistory() {
    try { return JSON.parse(localStorage.getItem(HISTORY_KEY)) || []; }
    catch { return []; }
}

function addToHistory(ticker, name) {
    const history = getSearchHistory().filter(h => h.ticker !== ticker);
    history.unshift({ ticker, name, ts: Date.now() });
    if (history.length > MAX_HISTORY) history.length = MAX_HISTORY;
    try { localStorage.setItem(HISTORY_KEY, JSON.stringify(history)); } catch {}
    renderSearchHistory();
}

function removeFromHistory(ticker) {
    const history = getSearchHistory().filter(h => h.ticker !== ticker);
    try { localStorage.setItem(HISTORY_KEY, JSON.stringify(history)); } catch {}
    renderSearchHistory();
}

function clearSearchHistory() {
    try { localStorage.removeItem(HISTORY_KEY); } catch {}
    renderSearchHistory();
}

function renderSearchHistory() {
    const container = document.getElementById('searchHistory');
    const chips = document.getElementById('searchHistoryChips');
    if (!container || !chips) return;
    const history = getSearchHistory();

    if (history.length === 0) {
        container.classList.add('hidden');
        return;
    }
    container.classList.remove('hidden');
    chips.innerHTML = history.map(h => {
        const code = h.ticker.replace('.T', '');
        const label = h.name ? `${code} ${h.name.substring(0, 6)}` : code;
        return `<div class="history-chip ticker-chip text-xs bg-gs-darker/80 text-gs-text-muted px-2.5 py-1 rounded-lg flex items-center gap-1.5 cursor-pointer" onclick="quickTicker('${escapeHtml(code)}')">
            <span>${escapeHtml(label)}</span>
            <button class="close-btn text-gs-text-muted/40 hover:text-red-400 text-sm leading-none" onclick="event.stopPropagation();removeFromHistory('${escapeHtml(h.ticker)}')">&times;</button>
        </div>`;
    }).join('');
}

function quickTicker(code) {
    document.getElementById('tickerInput').value = code;
    searchStock();
}

// ══════════════════════════════════════════════════════
// キーボードショートカット
// ══════════════════════════════════════════════════════
function showShortcutsModal() {
    document.getElementById('shortcutsModal').classList.remove('hidden');
}

function hideShortcutsModal() {
    document.getElementById('shortcutsModal').classList.add('hidden');
}

function setupKeyboardShortcuts() {
    document.addEventListener('keydown', e => {
        const tag = document.activeElement?.tagName;
        if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA') {
            if (e.key === 'Escape') { document.activeElement.blur(); return; }
            return;
        }

        switch (e.key) {
            case '/':
                e.preventDefault();
                document.getElementById('tickerInput').focus();
                break;
            case '?':
                e.preventDefault();
                showShortcutsModal();
                break;
            case 'Escape':
                hideShortcutsModal();
                break;
            case 'r':
            case 'R':
                const results = document.getElementById('results');
                if (!results.classList.contains('hidden')) {
                    results.scrollIntoView({ behavior: 'smooth' });
                }
                break;
            case 't':
            case 'T':
                window.scrollTo({ top: 0, behavior: 'smooth' });
                break;
        }
    });
}

// ══════════════════════════════════════════════════════
// スケルトンローダー
// ══════════════════════════════════════════════════════
function showSkeletonLoader() {
    const results = document.getElementById('results');
    results.innerHTML = `
        <div class="fade-in">
            <div class="card-elevated rounded-2xl p-6 mb-6">
                <div class="flex items-center gap-4">
                    <div class="skeleton w-12 h-12 rounded-xl"></div>
                    <div class="flex-1">
                        <div class="skeleton h-6 w-48 mb-2"></div>
                        <div class="skeleton h-4 w-32"></div>
                    </div>
                </div>
                <div class="skeleton h-10 w-40 mt-4"></div>
            </div>
            <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
                ${[1,2,3,4].map(() => `
                    <div class="card-elevated rounded-2xl p-5">
                        <div class="skeleton h-4 w-32 mb-4"></div>
                        <div class="space-y-3">
                            <div class="flex justify-between"><div class="skeleton h-3 w-24"></div><div class="skeleton h-3 w-16"></div></div>
                            <div class="flex justify-between"><div class="skeleton h-3 w-20"></div><div class="skeleton h-3 w-20"></div></div>
                            <div class="flex justify-between"><div class="skeleton h-3 w-28"></div><div class="skeleton h-3 w-12"></div></div>
                            <div class="skeleton h-2 w-full mt-2"></div>
                        </div>
                    </div>
                `).join('')}
            </div>
        </div>`;
    results.classList.remove('hidden');
}

// ── 初期化 ──────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('tickerInput').addEventListener('keydown', (e) => {
        if (e.key === 'Enter') searchStock();
    });
    renderSearchHistory();
    setupKeyboardShortcuts();
});

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
            addToHistory(stock.ticker, stock.name);
            showStatus('データ取得完了', 'success');
        }
    } catch (e) {
        console.error('検索エラー:', e);
        showStatus('銘柄検索に失敗しました', 'error');
    }
}

// 分析実行
async function runAnalysis(analyzerType) {
    const needsTicker = document.querySelector(`[data-analyzer="${analyzerType}"]`)
        .getAttribute('data-needs-ticker') === 'true';

    if (needsTicker) {
        const input = document.getElementById('tickerInput').value.trim();
        if (!input && !currentTicker) {
            showStatus('銘柄コードを入力してください', 'error');
            document.getElementById('tickerInput').focus();
            return;
        }
        if (!currentTicker) {
            currentTicker = input.endsWith('.T') ? input : (input.match(/^\d+$/) ? input + '.T' : input);
        }
    }

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

    const inputClass = 'input-glow w-full bg-gs-darker border border-gs-border rounded-xl px-4 py-3 text-white focus:border-gs-accent focus:outline-none text-base transition-all duration-200';

    if (analyzerType === 'blackrock') {
        title.textContent = 'BlackRock 配当分析 - パラメータ設定';
        content.innerHTML = `<div><label class="block text-sm text-gs-text-muted mb-1.5">投資金額（円）</label><input type="number" id="param_investment_amount" value="1000000" class="${inputClass}"></div>`;
    } else if (analyzerType === 'vanguard') {
        title.textContent = 'Vanguard ETFポートフォリオ - パラメータ設定';
        content.innerHTML = `
            <div><label class="block text-sm text-gs-text-muted mb-1.5">年齢</label><input type="number" id="param_age" value="35" class="${inputClass}"></div>
            <div><label class="block text-sm text-gs-text-muted mb-1.5">投資金額（円）</label><input type="number" id="param_investment_amount" value="1000000" class="${inputClass}"></div>
            <div><label class="block text-sm text-gs-text-muted mb-1.5">リスクプロファイル</label><select id="param_risk_profile" class="${inputClass}"><option value="積極型">積極型</option><option value="やや積極型">やや積極型</option><option value="バランス型" selected>バランス型</option><option value="やや保守型">やや保守型</option><option value="保守型">保守型</option></select></div>`;
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
    showSkeletonLoader();
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
        showStatus('分析完了', 'success');

    } catch (e) {
        loading.classList.add('hidden');
        results.innerHTML = renderError('通信エラーが発生しました: ' + e.message);
        results.classList.remove('hidden');
        showStatus('分析中にエラーが発生しました', 'error');
    }
}

// エラー表示
function renderError(message) {
    return `<div class="bg-red-900/20 border border-red-700/30 rounded-2xl p-6 sm:p-8 text-center fade-in">
        <div class="text-red-400 text-3xl mb-3">&#x26A0;</div>
        <p class="text-red-400 font-semibold text-lg">エラー</p>
        <p class="text-red-300/70 mt-2 text-sm leading-relaxed">${escapeHtml(message)}</p>
        <button onclick="location.reload()" class="mt-5 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 text-red-300 px-5 py-2.5 rounded-xl text-sm transition-colors font-medium">ページを再読み込み</button>
    </div>`;
}

// ステータス通知
function showStatus(message, type = 'info') {
    let el = document.getElementById('statusBar');
    if (!el) {
        el = document.createElement('div');
        el.id = 'statusBar';
        document.body.appendChild(el);
    }

    const colors = {
        info: 'bg-gs-accent/90 border-gs-accent/30',
        success: 'bg-green-600/90 border-green-500/30',
        warning: 'bg-yellow-600/90 border-yellow-500/30',
        error: 'bg-red-600/90 border-red-500/30'
    };
    el.className = `status-toast fixed bottom-4 left-1/2 -translate-x-1/2 px-5 py-2.5 rounded-xl text-sm font-medium text-white transition-all duration-300 z-50 max-w-[90vw] text-center border ${colors[type] || colors.info}`;
    el.textContent = message;
    el.style.opacity = '1';
    el.style.transform = 'translateX(-50%) translateY(0)';

    clearTimeout(statusTimer);
    statusTimer = setTimeout(() => {
        el.style.opacity = '0';
        el.style.transform = 'translateX(-50%) translateY(8px)';
    }, type === 'error' ? 5000 : 3000);
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
