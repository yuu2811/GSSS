/**
 * GSSS - GitHub Pages 版 メインアプリケーション (Advanced)
 *
 * 機能: 検索履歴, キーボードショートカット, スケルトンローダー, SVGスパークライン対応
 */

// ── 分析エンジン定義 ────────────────────────────────
const ANALYZERS = {
    goldman:          { name: 'Goldman Sachs 株式スクリーナー', short: 'GS スクリーナー', icon: '📊', description: 'P/E比率、収益成長、負債比率、配当利回り、競争優位性の総合分析', needs_ticker: true },
    morgan_technical: { name: 'Morgan Stanley テクニカル分析', short: 'MS テクニカル', icon: '📈', description: 'トレンド、移動平均、RSI、MACD、ボリンジャーバンド等の主要テクニカル指標', needs_ticker: true },
    bridgewater:      { name: 'Bridgewater リスク評価', short: 'BW リスク', icon: '🛡️', description: 'ボラティリティ、ベータ、最大ドローダウン、ストレステスト、ヘッジ提案', needs_ticker: true },
    jpmorgan:         { name: 'JPMorgan 決算アナライザー', short: 'JPM 決算', icon: '📋', description: '決算履歴、コンセンサス予想、決算日の値動き予想、ポジション戦略', needs_ticker: true },
    blackrock:        { name: 'BlackRock 配当インカム分析', short: 'BLK 配当', icon: '💰', description: '配当利回り、増配履歴、配当安全性、DRIP複利シミュレーション', needs_ticker: true },
    citadel:          { name: 'Citadel セクターローテーション', short: 'CTD セクター', icon: '🔄', description: '経済サイクル、セクターパフォーマンス比較、ローテーション推奨', needs_ticker: false },
    renaissance:      { name: 'Renaissance 定量スクリーナー', short: 'REN 定量', icon: '🔬', description: 'バリュー、クオリティ、モメンタム、成長、センチメントの複合スコア', needs_ticker: true },
    vanguard:         { name: 'Vanguard ETFポートフォリオ', short: 'VGD ETF', icon: '🏗️', description: 'アセットアロケーション、ETF選定、リバランスルール、税務最適化', needs_ticker: false },
    mckinsey:         { name: 'McKinsey マクロ経済レポート', short: 'MCK マクロ', icon: '🌍', description: '金利、インフレ、GDP、為替が市場に与える影響を分析', needs_ticker: false },
    morgan_dcf:       { name: 'Morgan Stanley DCFバリュエーション', short: 'MS DCF', icon: '🧮', description: '5年間の収益予測、WACC、ターミナルバリュー、感度分析による理論株価算出', needs_ticker: true },
    academic_quant:   { name: 'Academic Paper 定量分析', short: '学術定量分析', icon: '🎓', description: 'Fama-French、モメンタム、低ボラティリティ、QMJ等の学術論文ベースファクター分析', needs_ticker: true },
    chart_pattern:    { name: 'チャートパターン分析', short: 'チャートパターン', icon: '📐', description: 'ヘッドアンドショルダー、ダブルトップ、三角保ち合い等のパターン認識とトレンド分析', needs_ticker: true },
};

// ── アプリ状態 ───────────────────────────────────────
let currentTicker = '';
let currentAnalyzer = '';
let cachedStockData = null;
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
    const history = getSearchHistory();

    if (history.length === 0) {
        container.classList.add('hidden');
        return;
    }
    container.classList.remove('hidden');
    chips.innerHTML = history.map(h => {
        const code = h.ticker.replace('.T', '');
        const label = h.name ? `${code} ${h.name.substring(0, 6)}` : code;
        return `<div class="history-chip ticker-chip text-xs bg-gs-darker/80 text-gs-text-muted px-2.5 py-1 rounded-lg flex items-center gap-1.5 cursor-pointer" onclick="quickTicker('${esc(code)}')">
            <span>${esc(label)}</span>
            <button class="close-btn text-gs-text-muted/40 hover:text-red-400 text-sm leading-none" onclick="event.stopPropagation();removeFromHistory('${esc(h.ticker)}')">&times;</button>
        </div>`;
    }).join('');
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
        // Ignore if typing in input/select/textarea
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
            <!-- Header skeleton -->
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
            <!-- Cards skeleton -->
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
function init() {
    const grid = document.getElementById('analyzerGrid');
    for (const [key, a] of Object.entries(ANALYZERS)) {
        const div = document.createElement('div');
        div.className = 'analyzer-card bg-gs-card rounded-2xl p-4 sm:p-5 cursor-pointer';
        div.setAttribute('data-analyzer', key);
        div.onclick = () => runAnalysis(key);
        div.innerHTML = `
            <div class="flex items-start gap-3">
                <div class="text-2xl flex-shrink-0 mt-0.5">${a.icon}</div>
                <div class="flex-1 min-w-0">
                    <h3 class="text-white font-semibold text-sm mb-1 tracking-tight">${a.short}</h3>
                    <p class="text-gs-text-muted text-xs leading-relaxed">${a.description}</p>
                </div>
            </div>
            ${!a.needs_ticker ? '<div class="mt-3"><span class="badge-no-ticker text-[10px] text-gs-accent px-2.5 py-1 rounded-md font-medium inline-block">銘柄コード不要</span></div>' : ''}`;
        grid.appendChild(div);
    }

    document.getElementById('tickerInput').addEventListener('keydown', e => {
        if (e.key === 'Enter') searchStock();
    });

    // Initialize features
    renderSearchHistory();
    setupKeyboardShortcuts();
}

// ── 銘柄検索 ────────────────────────────────────────
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
    showStatus('データを取得中...', 'info');

    try {
        cachedStockData = await StockFetcher.fetchStockData(ticker);
        currentTicker = ticker;
        const name = cachedStockData.info.longName;
        nameEl.textContent = name;
        tickerEl.textContent = `(${ticker})`;
        addToHistory(ticker, name);

        if (cachedStockData._dataSource === 'chart_only') {
            showStatus('基本データ取得成功（一部ファンダメンタルデータは利用不可）', 'warning');
        } else {
            showStatus('データ取得完了', 'success');
        }
    } catch {
        currentTicker = ticker;
        cachedStockData = null;
        try {
            const results = await StockFetcher.searchTicker(input);
            if (results.length > 0) {
                nameEl.textContent = results[0].name;
                tickerEl.textContent = `(${ticker})`;
                addToHistory(ticker, results[0].name);
                showStatus('銘柄が見つかりました。分析メニューをお試しください。', 'info');
            } else {
                nameEl.textContent = ticker;
                tickerEl.textContent = '';
                showStatus('銘柄情報を取得できませんでした。コードを確認してください。', 'error');
            }
        } catch {
            nameEl.textContent = ticker;
            tickerEl.textContent = '(取得失敗)';
            showStatus('データ取得に失敗しました。しばらく待ってから再試行してください。', 'error');
        }
    }
}

// ── 分析実行 ────────────────────────────────────────
async function runAnalysis(analyzerType) {
    const info = ANALYZERS[analyzerType];
    if (!info) return;

    if (info.needs_ticker) {
        const input = document.getElementById('tickerInput').value.trim();
        if (!input && !currentTicker) {
            showStatus('銘柄コードを入力してください', 'error');
            document.getElementById('tickerInput').focus();
            return;
        }
        if (!currentTicker) currentTicker = StockFetcher.normalizeTicker(input);
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

    const inputClass = 'input-glow w-full bg-gs-darker border border-gs-border rounded-xl px-4 py-3 text-white focus:border-gs-accent focus:outline-none text-base transition-all duration-200';

    if (analyzerType === 'blackrock') {
        title.textContent = 'BlackRock 配当分析 - パラメータ';
        content.innerHTML = `<div><label class="block text-sm text-gs-text-muted mb-1.5">投資金額（円）</label><input type="number" id="param_investment_amount" value="1000000" class="${inputClass}"></div>`;
    } else {
        title.textContent = 'Vanguard ETFポートフォリオ - パラメータ';
        content.innerHTML = `
            <div><label class="block text-sm text-gs-text-muted mb-1.5">年齢</label><input type="number" id="param_age" value="35" class="${inputClass}"></div>
            <div><label class="block text-sm text-gs-text-muted mb-1.5">投資金額（円）</label><input type="number" id="param_investment_amount" value="1000000" class="${inputClass}"></div>
            <div><label class="block text-sm text-gs-text-muted mb-1.5">リスクプロファイル</label><select id="param_risk_profile" class="${inputClass}"><option value="積極型">積極型</option><option value="やや積極型">やや積極型</option><option value="バランス型" selected>バランス型</option><option value="やや保守型">やや保守型</option><option value="保守型">保守型</option></select></div>`;
    }
    section.scrollIntoView({ behavior: 'smooth' });
}

async function submitWithParams() {
    const params = {};
    if (currentAnalyzer === 'blackrock') {
        params.investment_amount = Number(document.getElementById('param_investment_amount').value) || 1000000;
    } else if (currentAnalyzer === 'vanguard') {
        params.age = Number(document.getElementById('param_age').value) || 35;
        params.investment_amount = Number(document.getElementById('param_investment_amount').value) || 1000000;
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

    // Show skeleton loader instead of spinner for better UX
    loading.classList.remove('hidden');
    showSkeletonLoader();
    loadingText.textContent = 'データを取得中...';
    loading.scrollIntoView({ behavior: 'smooth' });

    try {
        if (info.needs_ticker) {
            loadingText.textContent = `${currentTicker} のデータを取得中...`;
            if (!cachedStockData || cachedStockData.ticker !== currentTicker) {
                cachedStockData = await StockFetcher.fetchStockData(currentTicker);
            }
            loadingText.textContent = '分析を実行中...';
        }

        const analyzers = {
            goldman: () => Analyzers.goldman(cachedStockData),
            morgan_technical: () => Analyzers.morgan_technical(cachedStockData),
            bridgewater: () => Analyzers.bridgewater(cachedStockData),
            jpmorgan: () => Analyzers.jpmorgan(cachedStockData),
            blackrock: () => Analyzers.blackrock(cachedStockData, params.investment_amount),
            citadel: () => { loadingText.textContent = '市場データを取得中...'; return Analyzers.citadel(); },
            renaissance: () => Analyzers.renaissance(cachedStockData),
            vanguard: () => Analyzers.vanguard(params),
            mckinsey: () => { loadingText.textContent = 'マクロデータを取得中...'; return Analyzers.mckinsey(); },
            morgan_dcf: () => Analyzers.morgan_dcf(cachedStockData),
        };
        const data = await analyzers[analyzerType]();

        loading.classList.add('hidden');

        let dataNotice = '';
        if (cachedStockData && cachedStockData._dataSource === 'chart_only') {
            dataNotice = `<div class="bg-yellow-900/20 border border-yellow-700/30 rounded-2xl p-4 sm:p-5 mb-5 text-center">
                <p class="text-yellow-400 text-sm font-medium">ファンダメンタルデータの一部が取得できませんでした</p>
                <p class="text-yellow-300/50 text-xs mt-1.5">価格チャートデータに基づく分析結果です。P/E、配当利回り等の指標はN/Aと表示される場合があります。</p>
            </div>`;
        }

        // Pass cachedStockData for sparklines and 52-week range
        results.innerHTML = dataNotice + renderAnalysis(analyzerType, data, info, cachedStockData);
        results.classList.remove('hidden');
        results.scrollIntoView({ behavior: 'smooth' });
        showStatus('分析完了', 'success');

    } catch (e) {
        loading.classList.add('hidden');
        console.error('Analysis error:', e);
        results.innerHTML = renderError(e.message || '分析中にエラーが発生しました');
        results.classList.remove('hidden');
        showStatus('分析中にエラーが発生しました', 'error');
    }
}

// ── UI ヘルパー ──────────────────────────────────────
function renderError(msg) {
    return `<div class="bg-red-900/20 border border-red-700/30 rounded-2xl p-6 sm:p-8 text-center fade-in">
        <div class="text-red-400 text-3xl mb-3">&#x26A0;</div>
        <p class="text-red-400 font-semibold text-lg">エラー</p>
        <p class="text-red-300/70 mt-2 text-sm leading-relaxed">${esc(msg)}</p>
        <p class="text-red-300/40 mt-3 text-xs">CORSプロキシの制限やYahoo Finance APIの仕様変更により<br>データを取得できない場合があります。</p>
        <button onclick="location.reload()" class="mt-5 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 text-red-300 px-5 py-2.5 rounded-xl text-sm transition-colors font-medium">ページを再読み込み</button>
    </div>`;
}

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

// ── 起動 ────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', init);
