/**
 * GSSS - Yahoo Finance データフェッチャー（クライアントサイド）
 * CORSプロキシ経由でYahoo Finance APIからデータを取得
 */

const CORS_PROXIES = [
    'https://corsproxy.io/?url=',
    'https://api.allorigins.win/raw?url=',
];

let activeProxy = CORS_PROXIES[0];

/**
 * CORSプロキシ経由でURLを取得
 */
async function fetchWithProxy(url) {
    for (const proxy of CORS_PROXIES) {
        try {
            const res = await fetch(proxy + encodeURIComponent(url), {
                signal: AbortSignal.timeout(15000),
            });
            if (res.ok) {
                activeProxy = proxy;
                return await res.json();
            }
        } catch (e) {
            continue;
        }
    }
    throw new Error('データの取得に失敗しました。しばらく待ってから再試行してください。');
}

/**
 * 銘柄コードを正規化
 */
function normalizeTicker(code) {
    code = code.trim();
    if (code.startsWith('^')) return code;
    const num = code.replace('.T', '');
    if (/^\d+$/.test(num)) return num + '.T';
    if (!code.endsWith('.T')) return code + '.T';
    return code;
}

/**
 * 株価チャートデータを取得（価格履歴）
 */
async function fetchChart(ticker, range = '5y', interval = '1d') {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${ticker}?range=${range}&interval=${interval}&includePrePost=false`;
    const data = await fetchWithProxy(url);

    if (!data.chart || !data.chart.result || data.chart.result.length === 0) {
        throw new Error(`銘柄 ${ticker} のチャートデータを取得できません`);
    }

    const result = data.chart.result[0];
    const timestamps = result.timestamp || [];
    const quote = result.indicators.quote[0] || {};

    const history = [];
    for (let i = 0; i < timestamps.length; i++) {
        if (quote.close[i] != null) {
            history.push({
                date: new Date(timestamps[i] * 1000),
                open: quote.open[i],
                high: quote.high[i],
                low: quote.low[i],
                close: quote.close[i],
                volume: quote.volume[i] || 0,
            });
        }
    }

    return {
        ticker,
        meta: result.meta || {},
        history,
    };
}

/**
 * 銘柄サマリー情報を取得（ファンダメンタルズ）
 */
async function fetchQuoteSummary(ticker) {
    const modules = [
        'summaryDetail', 'financialData', 'defaultKeyStatistics',
        'summaryProfile', 'calendarEvents', 'earningsHistory',
        'earningsTrend', 'incomeStatementHistory', 'balanceSheetHistory',
        'cashflowStatementHistory', 'price',
    ].join(',');

    const url = `https://query2.finance.yahoo.com/v10/finance/quoteSummary/${ticker}?modules=${modules}`;
    const data = await fetchWithProxy(url);

    if (!data.quoteSummary || !data.quoteSummary.result || data.quoteSummary.result.length === 0) {
        throw new Error(`銘柄 ${ticker} の基本情報を取得できません`);
    }

    return data.quoteSummary.result[0];
}

/**
 * Yahoo Financeの値オブジェクトから数値を抽出
 */
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
 * 包括的な株式データを取得
 */
async function fetchStockData(ticker) {
    ticker = normalizeTicker(ticker);

    const [chart, summary] = await Promise.all([
        fetchChart(ticker).catch(() => null),
        fetchQuoteSummary(ticker).catch(() => null),
    ]);

    if (!chart && !summary) {
        throw new Error(`銘柄 ${ticker} のデータを取得できません`);
    }

    const history = chart ? chart.history : [];
    const meta = chart ? chart.meta : {};

    // summaryから情報を整形
    const sd = summary?.summaryDetail || {};
    const fd = summary?.financialData || {};
    const ks = summary?.defaultKeyStatistics || {};
    const sp = summary?.summaryProfile || {};
    const pr = summary?.price || {};
    const ce = summary?.calendarEvents || {};
    const eh = summary?.earningsHistory || {};
    const is_ = summary?.incomeStatementHistory?.incomeStatementHistory || [];
    const bs = summary?.balanceSheetHistory?.balanceSheetHistory || [];
    const cf = summary?.cashflowStatementHistory?.cashflowStatements || [];

    const info = {
        ticker,
        longName: pr.longName || pr.shortName || meta.symbol || ticker,
        shortName: pr.shortName || ticker,
        sector: sp.sector || '',
        industry: sp.industry || '',
        currency: meta.currency || pr.currency || 'JPY',
        currentPrice: yVal(fd.currentPrice) || yVal(pr.regularMarketPrice) || meta.regularMarketPrice,
        regularMarketPrice: yVal(pr.regularMarketPrice) || meta.regularMarketPrice,
        marketCap: yVal(pr.marketCap) || yVal(sd.marketCap),
        // P/E
        trailingPE: yVal(sd.trailingPE) || yVal(ks.trailingPE),
        forwardPE: yVal(sd.forwardPE) || yVal(ks.forwardPE),
        // EPS
        trailingEps: yVal(ks.trailingEps),
        forwardEps: yVal(ks.forwardEps),
        // 配当
        dividendYield: yVal(sd.dividendYield) || yVal(ks.lastDividendValue),
        dividendRate: yVal(sd.dividendRate),
        payoutRatio: yVal(sd.payoutRatio),
        fiveYearAvgDividendYield: yVal(sd.fiveYearAvgDividendYield),
        exDividendDate: yVal(ce.exDividendDate),
        // バリュエーション
        priceToBook: yVal(ks.priceToBook) || yVal(sd.priceToBook),
        enterpriseToEbitda: yVal(ks.enterpriseToEbitda),
        pegRatio: yVal(ks.pegRatio),
        // 利益率
        profitMargins: yVal(ks.profitMargins) || yVal(fd.profitMargins),
        operatingMargins: yVal(fd.operatingMargins),
        // 成長
        revenueGrowth: yVal(fd.revenueGrowth),
        earningsGrowth: yVal(fd.earningsGrowth),
        // ROE / ROA
        returnOnEquity: yVal(fd.returnOnEquity),
        returnOnAssets: yVal(fd.returnOnAssets),
        // 負債
        debtToEquity: yVal(fd.debtToEquity),
        totalDebt: yVal(fd.totalDebt),
        totalCash: yVal(fd.totalCash),
        // キャッシュフロー
        freeCashflow: yVal(fd.freeCashflow) || yVal(fd.freeCashFlow),
        operatingCashflow: yVal(fd.operatingCashflow),
        // ベータ・ボリューム
        beta: yVal(ks.beta) || yVal(ks['beta3Year']),
        averageVolume: yVal(sd.averageVolume) || yVal(pr.averageDailyVolume3Month),
        averageDailyVolume10Day: yVal(sd.averageDailyVolume10Day) || yVal(pr.averageDailyVolume10Day),
        // 52週
        fiftyTwoWeekHigh: yVal(sd.fiftyTwoWeekHigh),
        fiftyTwoWeekLow: yVal(sd.fiftyTwoWeekLow),
        // アナリスト
        targetHighPrice: yVal(fd.targetHighPrice),
        targetLowPrice: yVal(fd.targetLowPrice),
        targetMeanPrice: yVal(fd.targetMeanPrice),
        recommendationKey: fd.recommendationKey || '',
        numberOfAnalystOpinions: yVal(fd.numberOfAnalystOpinions),
        // 保有
        heldPercentInstitutions: yVal(ks.heldPercentInstitutions),
        heldPercentInsiders: yVal(ks.heldPercentInsiders),
        shortPercentOfFloat: yVal(ks.shortPercentOfFloat),
        sharesOutstanding: yVal(ks.sharesOutstanding) || yVal(pr.sharesOutstanding),
        fullTimeEmployees: sp.fullTimeEmployees,
        // Bid/Ask
        bid: yVal(sd.bid),
        ask: yVal(sd.ask),
        totalRevenue: yVal(fd.totalRevenue),
    };

    // 決算履歴
    const earningsHistoryData = (eh.history || []).map(q => ({
        date: q.quarter ? yStr(q.quarter) : '',
        epsEstimate: yVal(q.epsEstimate),
        epsActual: yVal(q.epsActual),
        surprisePct: yVal(q.surprisePercent),
    }));

    // 財務諸表
    const incomeStatements = is_.map(s => ({
        date: yStr(s.endDate),
        totalRevenue: yVal(s.totalRevenue),
        operatingIncome: yVal(s.operatingIncome),
        netIncome: yVal(s.netIncome),
    }));

    const balanceSheets = bs.map(s => ({
        date: yStr(s.endDate),
        totalAssets: yVal(s.totalAssets),
        totalLiab: yVal(s.totalLiab),
        totalStockholderEquity: yVal(s.totalStockholderEquity),
    }));

    const cashflows = cf.map(s => ({
        date: yStr(s.endDate),
        operatingCashflow: yVal(s.totalCashFromOperatingActivities),
        capitalExpenditures: yVal(s.capitalExpenditures),
        freeCashflow: (yVal(s.totalCashFromOperatingActivities) || 0) + (yVal(s.capitalExpenditures) || 0),
    }));

    return {
        ticker,
        info,
        history,
        earningsHistory: earningsHistoryData,
        incomeStatements,
        balanceSheets,
        cashflows,
    };
}

/**
 * 市場インデックスデータ取得
 */
async function fetchMarketIndex(ticker, range = '1y') {
    try {
        const chart = await fetchChart(ticker, range, '1d');
        return chart.history;
    } catch {
        return [];
    }
}

// エクスポート
window.StockFetcher = {
    normalizeTicker,
    fetchStockData,
    fetchChart,
    fetchQuoteSummary,
    fetchMarketIndex,
    yVal,
};
