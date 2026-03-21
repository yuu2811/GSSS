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

// ══════════════════════════════════════════════════════
// 検索サジェスト
// ══════════════════════════════════════════════════════
let suggestTimer = null;

function showSuggestions(results) {
    let container = document.getElementById('suggestionsContainer');
    if (!container) {
        container = document.createElement('div');
        container.id = 'suggestionsContainer';
        container.className = 'absolute left-0 right-0 top-full mt-1 bg-gs-card border border-gs-border rounded-xl shadow-2xl z-50 overflow-hidden max-h-64 overflow-y-auto';
        const inputWrapper = document.getElementById('tickerInput').parentElement;
        inputWrapper.style.position = 'relative';
        inputWrapper.appendChild(container);
    }

    if (!results || results.length === 0) {
        container.classList.add('hidden');
        return;
    }

    container.innerHTML = results.map((r, i) => {
        const code = (r.code || r.ticker || '').replace('.T', '');
        return `<div class="suggestion-item px-4 py-2.5 cursor-pointer hover:bg-gs-accent/10 transition-colors border-b border-gs-border/30 last:border-b-0 flex items-center gap-3"
                     onclick="selectSuggestion('${escapeHtml(code)}', '${escapeHtml(r.name)}')">
            <span class="text-gs-accent font-mono text-sm font-semibold min-w-[3.5rem]">${escapeHtml(code)}</span>
            <span class="text-white text-sm truncate">${escapeHtml(r.name)}</span>
        </div>`;
    }).join('');
    container.classList.remove('hidden');
}

function hideSuggestions() {
    const container = document.getElementById('suggestionsContainer');
    if (container) container.classList.add('hidden');
}

function selectSuggestion(code, name) {
    document.getElementById('tickerInput').value = code;
    hideSuggestions();
    currentTicker = code.endsWith('.T') ? code : code + '.T';
    document.getElementById('stockName').textContent = name;
    document.getElementById('stockTicker').textContent = `(${currentTicker})`;
    document.getElementById('stockInfo').classList.remove('hidden');
    addToHistory(currentTicker, name);
    // 自動的に全分析実行
    runAllAnalyses();
}

async function onSearchInput(value) {
    clearTimeout(suggestTimer);
    if (!value || value.length < 1) {
        hideSuggestions();
        return;
    }
    // 数字のみの入力で4桁未満の場合はまだサジェストしない
    if (/^\d+$/.test(value) && value.length < 4) {
        hideSuggestions();
        return;
    }
    suggestTimer = setTimeout(async () => {
        try {
            const res = await fetch(`/api/search?q=${encodeURIComponent(value)}`);
            if (!res.ok) { hideSuggestions(); return; }
            const data = await res.json();
            if (data.results && data.results.length > 0) {
                // 数字4桁で1件だけマッチ → 自動選択して全分析実行
                if (/^\d{4,}$/.test(value) && data.results.length === 1) {
                    const r = data.results[0];
                    const code = (r.code || r.ticker || '').replace('.T', '');
                    selectSuggestion(code, r.name);
                    return;
                }
                showSuggestions(data.results);
            } else {
                hideSuggestions();
            }
        } catch (e) {
            hideSuggestions();
        }
    }, 300);
}

// ── 初期化 ──────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
    const tickerInput = document.getElementById('tickerInput');
    tickerInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            hideSuggestions();
            searchStock();
        }
        if (e.key === 'Escape') hideSuggestions();
    });
    tickerInput.addEventListener('input', (e) => {
        onSearchInput(e.target.value.trim());
    });
    // クリック外でサジェストを閉じる
    document.addEventListener('click', (e) => {
        if (!e.target.closest('#tickerInput') && !e.target.closest('#suggestionsContainer')) {
            hideSuggestions();
        }
    });
    renderSearchHistory();
    setupKeyboardShortcuts();
});

// 銘柄検索 → 全分析一括実行
async function searchStock() {
    const input = document.getElementById('tickerInput').value.trim();
    if (!input) return;

    try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(input)}`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        if (data.results && data.results.length > 0) {
            const stock = data.results[0];
            currentTicker = stock.ticker;
            document.getElementById('stockName').textContent = stock.name;
            document.getElementById('stockTicker').textContent = `(${stock.ticker})`;
            document.getElementById('stockInfo').classList.remove('hidden');
            addToHistory(stock.ticker, stock.name);
            // 自動的に全分析実行
            runAllAnalyses();
        } else {
            showStatus('銘柄が見つかりませんでした', 'warning');
        }
    } catch (e) {
        console.error('検索エラー:', e);
        showStatus('銘柄検索に失敗しました', 'error');
    }
}

// 全分析一括実行
async function runAllAnalyses() {
    if (!currentTicker) {
        showStatus('銘柄コードを入力してください', 'error');
        return;
    }

    const loading = document.getElementById('loading');
    const results = document.getElementById('results');
    const loadingText = document.getElementById('loadingText');

    loading.classList.remove('hidden');
    showSkeletonLoader();
    loadingText.textContent = '全分析を一括実行中...';
    loading.scrollIntoView({ behavior: 'smooth' });

    try {
        const res = await fetch('/api/analyze_all', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ticker: currentTicker, params: {} }),
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);

        const data = await res.json();
        loading.classList.add('hidden');

        if (data.error) {
            results.innerHTML = renderError(data.error);
            results.classList.remove('hidden');
            return;
        }

        results.innerHTML = renderAllResults(data.results, data.analyzers, data.errors);
        results.classList.remove('hidden');
        results.scrollIntoView({ behavior: 'smooth' });

        const count = Object.keys(data.results).length;
        showStatus(`${count}件の分析が完了しました`, 'success');

    } catch (e) {
        loading.classList.add('hidden');
        results.innerHTML = renderError('通信エラーが発生しました: ' + e.message);
        results.classList.remove('hidden');
        showStatus('分析中にエラーが発生しました', 'error');
    }
}

// 全結果をタブ表示
function renderAllResults(allResults, analyzers, errors) {
    const keys = Object.keys(allResults);
    if (keys.length === 0) return renderError('分析結果がありません');

    // タブ順序
    const tabOrder = [
        'goldman', 'morgan_technical', 'chart_pattern', 'bridgewater',
        'jpmorgan', 'blackrock', 'renaissance', 'academic_quant',
        'morgan_dcf', 'citadel', 'vanguard', 'mckinsey'
    ];
    const orderedKeys = tabOrder.filter(k => keys.includes(k));

    let tabsHtml = '<div class="flex flex-wrap gap-1.5 sm:gap-2 mb-6 border-b border-gs-border/40 pb-4">';
    orderedKeys.forEach((key, i) => {
        const info = analyzers[key] || {};
        const active = i === 0 ? 'bg-gs-accent/20 text-gs-accent border-gs-accent/40' : 'bg-gs-darker/60 text-gs-text-muted border-gs-border/30 hover:border-gs-accent/30 hover:text-white';
        tabsHtml += `<button class="analysis-tab px-3 py-1.5 sm:px-4 sm:py-2 rounded-lg text-xs sm:text-sm font-medium border transition-all duration-200 ${active}" data-tab="${key}" onclick="switchTab('${key}')">
            <span class="mr-1">${info.icon || ''}</span>${escapeHtml(info.short || key)}
        </button>`;
    });
    tabsHtml += '</div>';

    let panelsHtml = '';
    orderedKeys.forEach((key, i) => {
        const info = analyzers[key] || {};
        const hidden = i === 0 ? '' : 'hidden';
        const content = renderAnalysis(key, allResults[key], info);
        panelsHtml += `<div class="analysis-panel ${hidden}" data-panel="${key}">${content}</div>`;
    });

    // エラー表示
    let errHtml = '';
    const errKeys = Object.keys(errors || {});
    if (errKeys.length > 0) {
        errHtml = `<div class="mt-4 bg-red-900/10 border border-red-700/20 rounded-xl p-3 text-xs text-red-400/70">
            <span class="font-semibold">一部エラー:</span> ${errKeys.map(k => `${analyzers[k]?.short || k}: ${escapeHtml(errors[k])}`).join(' / ')}
        </div>`;
    }

    return tabsHtml + panelsHtml + errHtml;
}

// タブ切替
function switchTab(key) {
    document.querySelectorAll('.analysis-tab').forEach(tab => {
        if (tab.dataset.tab === key) {
            tab.classList.add('bg-gs-accent/20', 'text-gs-accent', 'border-gs-accent/40');
            tab.classList.remove('bg-gs-darker/60', 'text-gs-text-muted', 'border-gs-border/30');
        } else {
            tab.classList.remove('bg-gs-accent/20', 'text-gs-accent', 'border-gs-accent/40');
            tab.classList.add('bg-gs-darker/60', 'text-gs-text-muted', 'border-gs-border/30');
        }
    });
    document.querySelectorAll('.analysis-panel').forEach(panel => {
        panel.classList.toggle('hidden', panel.dataset.panel !== key);
    });
}

// 分析実行
async function runAnalysis(analyzerType) {
    const el = document.querySelector(`[data-analyzer="${analyzerType}"]`);
    const needsTicker = el ? el.getAttribute('data-needs-ticker') === 'true' : true;

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
        if (!res.ok) throw new Error(`HTTP ${res.status}`);

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
