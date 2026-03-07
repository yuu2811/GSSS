/**
 * GSSS - Yahoo Finance データフェッチャー
 *
 * Yahoo Finance API (v8 chart / v10 quoteSummary) からデータを取得する。
 * quoteSummary は認証 (crumb) が必要なため、複数のフォールバックで取得を試みる。
 */

// ── 定数 ──────────────────────────────────────────────
const CORS_PROXIES = [
    'https://corsproxy.io/?url=',
    'https://api.allorigins.win/raw?url=',
    'https://api.codetabs.com/v1/proxy?quest=',
];

const FETCH_TIMEOUT_MS = 15000;
const CRUMB_TIMEOUT_MS = 10000;
const CRUMB_TTL_MS = 30 * 60 * 1000; // 30 分

const QUOTE_SUMMARY_MODULES = [
    'summaryDetail', 'financialData', 'defaultKeyStatistics',
    'summaryProfile', 'calendarEvents', 'earningsHistory',
    'earningsTrend', 'incomeStatementHistory', 'balanceSheetHistory',
    'cashflowStatementHistory', 'price',
].join(',');

// ── 状態 ──────────────────────────────────────────────
let _crumb = null;
let _crumbExpiry = 0;

// ── ユーティリティ ────────────────────────────────────
/** Yahoo Finance 値オブジェクトから数値を取り出す */
function yVal(obj) {
    if (obj == null) return null;
    if (typeof obj === 'number') return obj;
    if (obj.raw != null) return obj.raw;
    if (obj.value != null) return obj.value;
    return null;
}

function yStr(obj) {
    if (obj == null) return null;
    if (typeof obj === 'string') return obj;
    if (obj.fmt) return obj.fmt;
    return String(obj);
}

/**
 * 比率値を正規化する (0‑1 に統一)
 * Yahoo Finance は同じフィールドでも 0.35 (35%) と 35 (35%) を返す場合がある
 */
function normalizeRatio(val) {
    if (val == null) return null;
    return Math.abs(val) > 5 ? val / 100 : val;
}

/**
 * 銘柄コードを正規化する
 * "7203" → "7203.T"、"^N225" はそのまま
 */
function normalizeTicker(code) {
    code = code.trim().toUpperCase();
    if (code.startsWith('^')) return code;
    const num = code.replace('.T', '');
    if (/^\d+$/.test(num)) return num + '.T';
    return code.endsWith('.T') ? code : code + '.T';
}

// ── CORS プロキシ付き fetch ──────────────────────────
async function fetchWithProxy(url, opts = {}) {
    const timeout = opts.timeout || FETCH_TIMEOUT_MS;
    const errors = [];

    for (const proxy of CORS_PROXIES) {
        try {
            const res = await fetch(proxy + encodeURIComponent(url), {
                signal: AbortSignal.timeout(timeout),
            });
            if (!res.ok) { errors.push(`${proxy}: HTTP ${res.status}`); continue; }

            const text = await res.text();
            try { return JSON.parse(text); }
            catch { errors.push(`${proxy}: JSON パースエラー`); continue; }
        } catch (e) {
            errors.push(`${proxy}: ${e.message}`);
        }
    }
    throw new Error('データ取得に失敗しました。しばらく待ってから再試行してください。');
}

// ── Crumb 認証 ───────────────────────────────────────
async function fetchCrumb() {
    if (_crumb && Date.now() < _crumbExpiry) return _crumb;

    for (const proxy of CORS_PROXIES) {
        try {
            const res = await fetch(
                proxy + encodeURIComponent('https://query2.finance.yahoo.com/v1/test/getcrumb'),
                { signal: AbortSignal.timeout(CRUMB_TIMEOUT_MS) },
            );
            if (!res.ok) continue;
            const text = await res.text();
            if (text && text.length < 50 && !text.includes('<')) {
                _crumb = text;
                _crumbExpiry = Date.now() + CRUMB_TTL_MS;
                return _crumb;
            }
        } catch { /* 次のプロキシへ */ }
    }
    return null;
}

// ── チャートデータ取得 ───────────────────────────────
async function fetchChart(ticker, range = '5y', interval = '1d') {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${ticker}`
        + `?range=${range}&interval=${interval}&includePrePost=false`;
    const data = await fetchWithProxy(url);

    const result = data?.chart?.result?.[0];
    if (!result) throw new Error(`銘柄 ${ticker} のチャートデータを取得できません`);

    const ts = result.timestamp || [];
    const q = result.indicators?.quote?.[0] || {};
    const history = [];
    for (let i = 0; i < ts.length; i++) {
        if (q.close?.[i] != null) {
            history.push({
                date: new Date(ts[i] * 1000),
                open: q.open[i], high: q.high[i], low: q.low[i],
                close: q.close[i], volume: q.volume?.[i] || 0,
            });
        }
    }
    return { ticker, meta: result.meta || {}, history };
}

// ── QuoteSummary 取得 (フォールバック付き) ────────────
async function fetchQuoteSummary(ticker) {
    // 方法 1: crumb 付き v10
    const crumb = await fetchCrumb();
    if (crumb) {
        try {
            const url = `https://query2.finance.yahoo.com/v10/finance/quoteSummary/${ticker}`
                + `?modules=${QUOTE_SUMMARY_MODULES}&crumb=${encodeURIComponent(crumb)}`;
            const d = await fetchWithProxy(url);
            if (d?.quoteSummary?.result?.[0]) return d.quoteSummary.result[0];
        } catch { /* fallback */ }
    }

    // 方法 2: crumb なし v10
    try {
        const url = `https://query2.finance.yahoo.com/v10/finance/quoteSummary/${ticker}`
            + `?modules=${QUOTE_SUMMARY_MODULES}`;
        const d = await fetchWithProxy(url);
        if (d?.quoteSummary?.result?.[0]) return d.quoteSummary.result[0];
    } catch { /* fallback */ }

    // 方法 3: v7 quote
    try {
        const url = `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${ticker}`;
        const d = await fetchWithProxy(url);
        if (d?.quoteResponse?.result?.[0]) return convertQuoteToSummary(d.quoteResponse.result[0]);
    } catch { /* fallback */ }

    // 方法 4: v6 quote
    try {
        const url = `https://query1.finance.yahoo.com/v6/finance/quote?symbols=${ticker}`;
        const d = await fetchWithProxy(url);
        if (d?.quoteResponse?.result?.[0]) return convertQuoteToSummary(d.quoteResponse.result[0]);
    } catch { /* fallback */ }

    return null; // chart データのみで続行
}

/** v6 / v7 quote レスポンスを quoteSummary 互換に変換 */
function convertQuoteToSummary(q) {
    const wrap = (v) => (v != null ? { raw: v } : {});
    return {
        summaryDetail: {
            trailingPE: wrap(q.trailingPE), forwardPE: wrap(q.forwardPE),
            dividendYield: wrap(q.dividendYield ?? q.trailingAnnualDividendYield),
            dividendRate: wrap(q.dividendRate ?? q.trailingAnnualDividendRate),
            payoutRatio: wrap(q.payoutRatio),
            fiftyTwoWeekHigh: wrap(q.fiftyTwoWeekHigh), fiftyTwoWeekLow: wrap(q.fiftyTwoWeekLow),
            averageVolume: wrap(q.averageDailyVolume3Month),
            averageDailyVolume10Day: wrap(q.averageDailyVolume10Day),
            marketCap: wrap(q.marketCap), priceToBook: wrap(q.priceToBook),
            bid: wrap(q.bid), ask: wrap(q.ask),
            fiveYearAvgDividendYield: wrap(q.fiveYearAvgDividendYield),
        },
        financialData: {
            currentPrice: wrap(q.regularMarketPrice),
            targetHighPrice: wrap(q.targetPriceHigh), targetLowPrice: wrap(q.targetPriceLow),
            targetMeanPrice: wrap(q.targetPriceMean),
            recommendationKey: q.recommendationKey || '',
            numberOfAnalystOpinions: wrap(q.numberOfAnalystOpinions),
            totalRevenue: wrap(q.totalRevenue), revenueGrowth: wrap(q.revenueGrowth),
            earningsGrowth: wrap(q.earningsGrowth), profitMargins: wrap(q.profitMargins),
            returnOnEquity: wrap(q.returnOnEquity),
        },
        defaultKeyStatistics: {
            trailingEps: wrap(q.trailingEps ?? q.epsTrailingTwelveMonths),
            forwardEps: wrap(q.forwardEps ?? q.epsForward),
            beta: wrap(q.beta), pegRatio: wrap(q.pegRatio), priceToBook: wrap(q.priceToBook),
            sharesOutstanding: wrap(q.sharesOutstanding),
            heldPercentInstitutions: wrap(q.heldPercentInstitutions),
            heldPercentInsiders: wrap(q.heldPercentInsiders),
            shortPercentOfFloat: wrap(q.shortPercentOfFloat),
            enterpriseToEbitda: wrap(q.enterpriseToEbitda),
        },
        summaryProfile: { sector: q.sector || '', industry: q.industry || '' },
        price: {
            longName: q.longName || q.shortName || '',
            shortName: q.shortName || '',
            regularMarketPrice: wrap(q.regularMarketPrice),
            marketCap: wrap(q.marketCap), currency: q.currency || 'JPY',
        },
        calendarEvents: {}, earningsHistory: {},
        incomeStatementHistory: {}, balanceSheetHistory: {}, cashflowStatementHistory: {},
    };
}

// ── info ビルダー ────────────────────────────────────
function buildInfo(ticker, meta, history, summary) {
    if (summary) return buildInfoFromSummary(ticker, meta, summary);
    return buildInfoFromChart(ticker, meta, history);
}

function buildInfoFromSummary(ticker, meta, s) {
    const sd = s.summaryDetail || {};
    const fd = s.financialData || {};
    const ks = s.defaultKeyStatistics || {};
    const sp = s.summaryProfile || {};
    const pr = s.price || {};

    return {
        ticker,
        longName: pr.longName || pr.shortName || meta.symbol || ticker,
        shortName: pr.shortName || ticker,
        sector: sp.sector || '', industry: sp.industry || '',
        currency: meta.currency || pr.currency || 'JPY',
        currentPrice: yVal(fd.currentPrice) ?? yVal(pr.regularMarketPrice) ?? meta.regularMarketPrice,
        regularMarketPrice: yVal(pr.regularMarketPrice) ?? meta.regularMarketPrice,
        marketCap: yVal(pr.marketCap) ?? yVal(sd.marketCap),
        trailingPE: yVal(sd.trailingPE), forwardPE: yVal(sd.forwardPE),
        trailingEps: yVal(ks.trailingEps), forwardEps: yVal(ks.forwardEps),
        dividendYield: normalizeRatio(yVal(sd.dividendYield)),
        dividendRate: yVal(sd.dividendRate),
        payoutRatio: normalizeRatio(yVal(sd.payoutRatio)),
        fiveYearAvgDividendYield: yVal(sd.fiveYearAvgDividendYield),
        exDividendDate: yVal(s.calendarEvents?.exDividendDate),
        priceToBook: yVal(ks.priceToBook) ?? yVal(sd.priceToBook),
        enterpriseToEbitda: yVal(ks.enterpriseToEbitda),
        pegRatio: yVal(ks.pegRatio),
        profitMargins: normalizeRatio(yVal(ks.profitMargins) ?? yVal(fd.profitMargins)),
        operatingMargins: normalizeRatio(yVal(fd.operatingMargins)),
        revenueGrowth: normalizeRatio(yVal(fd.revenueGrowth)),
        earningsGrowth: normalizeRatio(yVal(fd.earningsGrowth)),
        returnOnEquity: normalizeRatio(yVal(fd.returnOnEquity)),
        returnOnAssets: normalizeRatio(yVal(fd.returnOnAssets)),
        debtToEquity: yVal(fd.debtToEquity),
        totalDebt: yVal(fd.totalDebt), totalCash: yVal(fd.totalCash),
        freeCashflow: yVal(fd.freeCashflow) ?? yVal(fd.freeCashFlow),
        operatingCashflow: yVal(fd.operatingCashflow),
        beta: yVal(ks.beta),
        averageVolume: yVal(sd.averageVolume),
        averageDailyVolume10Day: yVal(sd.averageDailyVolume10Day),
        fiftyTwoWeekHigh: yVal(sd.fiftyTwoWeekHigh), fiftyTwoWeekLow: yVal(sd.fiftyTwoWeekLow),
        targetHighPrice: yVal(fd.targetHighPrice), targetLowPrice: yVal(fd.targetLowPrice),
        targetMeanPrice: yVal(fd.targetMeanPrice),
        recommendationKey: fd.recommendationKey || '',
        numberOfAnalystOpinions: yVal(fd.numberOfAnalystOpinions),
        heldPercentInstitutions: normalizeRatio(yVal(ks.heldPercentInstitutions)),
        heldPercentInsiders: normalizeRatio(yVal(ks.heldPercentInsiders)),
        shortPercentOfFloat: normalizeRatio(yVal(ks.shortPercentOfFloat)),
        sharesOutstanding: yVal(ks.sharesOutstanding) ?? yVal(pr.sharesOutstanding),
        fullTimeEmployees: sp.fullTimeEmployees,
        bid: yVal(sd.bid), ask: yVal(sd.ask),
        totalRevenue: yVal(fd.totalRevenue),
    };
}

function buildInfoFromChart(ticker, meta, history) {
    const closes = history.map(h => h.close);
    const currentPrice = meta.regularMarketPrice ?? (closes.length > 0 ? closes[closes.length - 1] : 0);
    const volumes = history.slice(-30).map(h => h.volume);
    const avgVolume = volumes.length > 0 ? volumes.reduce((a, b) => a + b, 0) / volumes.length : 0;
    const yr = history.slice(-252).map(h => h.close);

    return {
        ticker,
        longName: meta.longName || meta.shortName || meta.symbol || ticker,
        shortName: meta.shortName || meta.symbol || ticker,
        sector: '', industry: '', currency: meta.currency || 'JPY',
        currentPrice, regularMarketPrice: currentPrice,
        marketCap: null, trailingPE: null, forwardPE: null,
        trailingEps: null, forwardEps: null,
        dividendYield: null, dividendRate: null, payoutRatio: null,
        fiveYearAvgDividendYield: null, exDividendDate: null,
        priceToBook: null, enterpriseToEbitda: null, pegRatio: null,
        profitMargins: null, operatingMargins: null,
        revenueGrowth: null, earningsGrowth: null,
        returnOnEquity: null, returnOnAssets: null,
        debtToEquity: null, totalDebt: null, totalCash: null,
        freeCashflow: null, operatingCashflow: null,
        beta: null,
        averageVolume: Math.round(avgVolume),
        averageDailyVolume10Day: null,
        fiftyTwoWeekHigh: yr.length > 0 ? Math.max(...yr) : null,
        fiftyTwoWeekLow: yr.length > 0 ? Math.min(...yr) : null,
        targetHighPrice: null, targetLowPrice: null, targetMeanPrice: null,
        recommendationKey: '', numberOfAnalystOpinions: null,
        heldPercentInstitutions: null, heldPercentInsiders: null,
        shortPercentOfFloat: null, sharesOutstanding: null,
        fullTimeEmployees: null, bid: null, ask: null, totalRevenue: null,
    };
}

// ── メイン: 包括的な株式データ取得 ───────────────────
async function fetchStockData(ticker) {
    ticker = normalizeTicker(ticker);

    const [chart, summary] = await Promise.all([
        fetchChart(ticker).catch(e => { console.warn('Chart 取得失敗:', e.message); return null; }),
        fetchQuoteSummary(ticker).catch(e => { console.warn('QuoteSummary 取得失敗:', e.message); return null; }),
    ]);

    if (!chart && !summary) {
        throw new Error(`銘柄 ${ticker} のデータを取得できません。CORSプロキシの制限により一時的にアクセスできない場合があります。`);
    }

    const history = chart?.history || [];
    const meta = chart?.meta || {};
    const info = buildInfo(ticker, meta, history, summary);

    // 決算履歴
    const eh = summary?.earningsHistory?.history || [];
    const earningsHistory = eh.map(q => ({
        date: q.quarter ? yStr(q.quarter) : '',
        epsEstimate: yVal(q.epsEstimate), epsActual: yVal(q.epsActual),
        surprisePct: yVal(q.surprisePercent),
    }));

    // 財務諸表
    const mapStatements = (arr, mapper) => (arr || []).map(mapper);
    const incomeStatements = mapStatements(
        summary?.incomeStatementHistory?.incomeStatementHistory,
        s => ({ date: yStr(s.endDate), totalRevenue: yVal(s.totalRevenue), operatingIncome: yVal(s.operatingIncome), netIncome: yVal(s.netIncome) }),
    );
    const balanceSheets = mapStatements(
        summary?.balanceSheetHistory?.balanceSheetHistory,
        s => ({ date: yStr(s.endDate), totalAssets: yVal(s.totalAssets), totalLiab: yVal(s.totalLiab), totalStockholderEquity: yVal(s.totalStockholderEquity) }),
    );
    const cashflows = mapStatements(
        summary?.cashflowStatementHistory?.cashflowStatements,
        s => {
            const opCF = yVal(s.totalCashFromOperatingActivities) || 0;
            const capex = yVal(s.capitalExpenditures) || 0;
            return { date: yStr(s.endDate), operatingCashflow: opCF, capitalExpenditures: capex, freeCashflow: opCF + capex };
        },
    );

    return {
        ticker, info, history, earningsHistory,
        incomeStatements, balanceSheets, cashflows,
        _dataSource: summary ? 'full' : 'chart_only',
    };
}

// ── 市場インデックスデータ ───────────────────────────
async function fetchMarketIndex(ticker, range = '1y') {
    try { return (await fetchChart(ticker, range, '1d')).history; }
    catch { return []; }
}

// ── 銘柄検索 (認証不要) ─────────────────────────────
async function searchTicker(query) {
    try {
        const url = `https://query1.finance.yahoo.com/v1/finance/search`
            + `?q=${encodeURIComponent(query)}&quotesCount=5&newsCount=0&listsCount=0`;
        const d = await fetchWithProxy(url, { timeout: 10000 });
        return (d?.quotes || []).map(q => ({
            symbol: q.symbol, name: q.longname || q.shortname || q.symbol,
            type: q.quoteType, exchange: q.exchange,
        }));
    } catch { return []; }
}

// ── エクスポート ─────────────────────────────────────
window.StockFetcher = {
    normalizeTicker, normalizeRatio,
    fetchStockData, fetchChart, fetchQuoteSummary,
    fetchMarketIndex, searchTicker, yVal,
};
