/**
 * GSSS - Yahoo Finance データフェッチャー（クライアントサイド）
 * CORSプロキシ経由でYahoo Finance APIからデータを取得
 *
 * 注意: Yahoo Finance APIはv10/quoteSummaryに認証(crumb)が必要になったため、
 * v8/chartをメインに使用し、quoteSummaryは複数のフォールバック手段で取得を試みる。
 */

const CORS_PROXIES = [
    'https://corsproxy.io/?url=',
    'https://api.allorigins.win/raw?url=',
    'https://api.codetabs.com/v1/proxy?quest=',
];

let activeProxy = CORS_PROXIES[0];
let _crumb = null;
let _crumbFailed = false;

/**
 * CORSプロキシ経由でURLを取得
 */
async function fetchWithProxy(url, options = {}) {
    const errors = [];
    for (const proxy of CORS_PROXIES) {
        try {
            const fetchUrl = proxy + encodeURIComponent(url);
            const res = await fetch(fetchUrl, {
                signal: AbortSignal.timeout(options.timeout || 15000),
            });
            if (res.ok) {
                activeProxy = proxy;
                const text = await res.text();
                try {
                    return JSON.parse(text);
                } catch {
                    // JSONパース失敗 - HTMLが返った場合など
                    errors.push(`${proxy}: JSONパースエラー`);
                    continue;
                }
            } else {
                errors.push(`${proxy}: HTTP ${res.status}`);
            }
        } catch (e) {
            errors.push(`${proxy}: ${e.message}`);
            continue;
        }
    }
    throw new Error('データの取得に失敗しました。しばらく待ってから再試行してください。\n' + errors.join('\n'));
}

/**
 * Yahoo Finance crumbを取得（quoteSummary認証用）
 */
async function fetchCrumb() {
    if (_crumb) return _crumb;
    if (_crumbFailed) return null;

    try {
        // crumb取得のためにYahoo Financeのページからcrumbを抽出
        for (const proxy of CORS_PROXIES) {
            try {
                const res = await fetch(proxy + encodeURIComponent('https://query2.finance.yahoo.com/v1/test/getcrumb'), {
                    signal: AbortSignal.timeout(10000),
                });
                if (res.ok) {
                    const text = await res.text();
                    if (text && text.length < 50 && !text.includes('<')) {
                        _crumb = text;
                        return _crumb;
                    }
                }
            } catch {
                continue;
            }
        }
    } catch {
        // crumb取得失敗
    }

    _crumbFailed = true;
    return null;
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
 * Yahoo Finance v10は認証が必要なため、複数の方法で取得を試みる
 */
async function fetchQuoteSummary(ticker) {
    const modules = [
        'summaryDetail', 'financialData', 'defaultKeyStatistics',
        'summaryProfile', 'calendarEvents', 'earningsHistory',
        'earningsTrend', 'incomeStatementHistory', 'balanceSheetHistory',
        'cashflowStatementHistory', 'price',
    ].join(',');

    // 方法1: crumb付きでv10を試行
    const crumb = await fetchCrumb();
    if (crumb) {
        try {
            const url = `https://query2.finance.yahoo.com/v10/finance/quoteSummary/${ticker}?modules=${modules}&crumb=${encodeURIComponent(crumb)}`;
            const data = await fetchWithProxy(url);
            if (data.quoteSummary && data.quoteSummary.result && data.quoteSummary.result.length > 0) {
                return data.quoteSummary.result[0];
            }
        } catch {
            // crumb付きでも失敗
        }
    }

    // 方法2: crumbなしでv10を試行（一部プロキシで動作する場合がある）
    try {
        const url = `https://query2.finance.yahoo.com/v10/finance/quoteSummary/${ticker}?modules=${modules}`;
        const data = await fetchWithProxy(url);
        if (data.quoteSummary && data.quoteSummary.result && data.quoteSummary.result.length > 0) {
            return data.quoteSummary.result[0];
        }
    } catch {
        // v10失敗
    }

    // 方法3: v6 finance quoteを試行（一部データを取得）
    try {
        const url = `https://query1.finance.yahoo.com/v6/finance/quote?symbols=${ticker}`;
        const data = await fetchWithProxy(url);
        if (data.quoteResponse && data.quoteResponse.result && data.quoteResponse.result.length > 0) {
            return convertV6ToSummary(data.quoteResponse.result[0]);
        }
    } catch {
        // v6も失敗
    }

    // 方法4: v7 finance quoteを試行
    try {
        const url = `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${ticker}`;
        const data = await fetchWithProxy(url);
        if (data.quoteResponse && data.quoteResponse.result && data.quoteResponse.result.length > 0) {
            return convertV6ToSummary(data.quoteResponse.result[0]);
        }
    } catch {
        // v7も失敗
    }

    // 全て失敗 - nullを返してchartデータのみで分析
    return null;
}

/**
 * v6/v7のquoteレスポンスをquoteSummary形式に変換
 */
function convertV6ToSummary(quote) {
    return {
        summaryDetail: {
            trailingPE: { raw: quote.trailingPE },
            forwardPE: { raw: quote.forwardPE },
            dividendYield: { raw: quote.dividendYield || (quote.trailingAnnualDividendYield) },
            dividendRate: { raw: quote.dividendRate || quote.trailingAnnualDividendRate },
            payoutRatio: { raw: quote.payoutRatio },
            fiftyTwoWeekHigh: { raw: quote.fiftyTwoWeekHigh },
            fiftyTwoWeekLow: { raw: quote.fiftyTwoWeekLow },
            averageVolume: { raw: quote.averageDailyVolume3Month },
            averageDailyVolume10Day: { raw: quote.averageDailyVolume10Day },
            marketCap: { raw: quote.marketCap },
            priceToBook: { raw: quote.priceToBook },
            bid: { raw: quote.bid },
            ask: { raw: quote.ask },
            fiveYearAvgDividendYield: { raw: quote.fiveYearAvgDividendYield },
        },
        financialData: {
            currentPrice: { raw: quote.regularMarketPrice },
            targetHighPrice: { raw: quote.targetPriceHigh },
            targetLowPrice: { raw: quote.targetPriceLow },
            targetMeanPrice: { raw: quote.targetPriceMean },
            recommendationKey: quote.recommendationKey || '',
            numberOfAnalystOpinions: { raw: quote.numberOfAnalystOpinions },
            totalRevenue: { raw: quote.totalRevenue },
            revenueGrowth: { raw: quote.revenueGrowth },
            earningsGrowth: { raw: quote.earningsGrowth },
            profitMargins: { raw: quote.profitMargins },
            returnOnEquity: { raw: quote.returnOnEquity },
        },
        defaultKeyStatistics: {
            trailingEps: { raw: quote.trailingEps || quote.epsTrailingTwelveMonths },
            forwardEps: { raw: quote.forwardEps || quote.epsForward },
            beta: { raw: quote.beta },
            pegRatio: { raw: quote.pegRatio },
            priceToBook: { raw: quote.priceToBook },
            sharesOutstanding: { raw: quote.sharesOutstanding },
            heldPercentInstitutions: { raw: quote.heldPercentInstitutions },
            heldPercentInsiders: { raw: quote.heldPercentInsiders },
            shortPercentOfFloat: { raw: quote.shortPercentOfFloat },
            enterpriseToEbitda: { raw: quote.enterpriseToEbitda },
        },
        summaryProfile: {
            sector: quote.sector || '',
            industry: quote.industry || '',
        },
        price: {
            longName: quote.longName || quote.shortName || '',
            shortName: quote.shortName || '',
            regularMarketPrice: { raw: quote.regularMarketPrice },
            marketCap: { raw: quote.marketCap },
            currency: quote.currency || 'JPY',
        },
        calendarEvents: {},
        earningsHistory: {},
        incomeStatementHistory: {},
        balanceSheetHistory: {},
        cashflowStatementHistory: {},
    };
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
 * chartメタデータからinfoを生成（quoteSummaryが失敗した場合のフォールバック）
 */
function buildInfoFromChart(ticker, meta, history) {
    const closes = history.map(h => h.close);
    const currentPrice = meta.regularMarketPrice || (closes.length > 0 ? closes[closes.length - 1] : 0);

    // 簡易的なファンダメンタルデータの推定
    const volumes = history.slice(-30).map(h => h.volume);
    const avgVolume = volumes.length > 0 ? volumes.reduce((a, b) => a + b, 0) / volumes.length : 0;

    // 52週高値・安値（1年分のデータから）
    const oneYearData = history.slice(-252);
    const oneYearCloses = oneYearData.map(h => h.close);
    const fiftyTwoWeekHigh = oneYearCloses.length > 0 ? Math.max(...oneYearCloses) : null;
    const fiftyTwoWeekLow = oneYearCloses.length > 0 ? Math.min(...oneYearCloses) : null;

    return {
        ticker,
        longName: meta.longName || meta.shortName || meta.symbol || ticker,
        shortName: meta.shortName || meta.symbol || ticker,
        sector: '',
        industry: '',
        currency: meta.currency || 'JPY',
        currentPrice,
        regularMarketPrice: currentPrice,
        marketCap: null,
        trailingPE: null,
        forwardPE: null,
        trailingEps: null,
        forwardEps: null,
        dividendYield: null,
        dividendRate: null,
        payoutRatio: null,
        fiveYearAvgDividendYield: null,
        exDividendDate: null,
        priceToBook: null,
        enterpriseToEbitda: null,
        pegRatio: null,
        profitMargins: null,
        operatingMargins: null,
        revenueGrowth: null,
        earningsGrowth: null,
        returnOnEquity: null,
        returnOnAssets: null,
        debtToEquity: null,
        totalDebt: null,
        totalCash: null,
        freeCashflow: null,
        operatingCashflow: null,
        beta: null,
        averageVolume: Math.round(avgVolume),
        averageDailyVolume10Day: null,
        fiftyTwoWeekHigh,
        fiftyTwoWeekLow,
        targetHighPrice: null,
        targetLowPrice: null,
        targetMeanPrice: null,
        recommendationKey: '',
        numberOfAnalystOpinions: null,
        heldPercentInstitutions: null,
        heldPercentInsiders: null,
        shortPercentOfFloat: null,
        sharesOutstanding: null,
        fullTimeEmployees: null,
        bid: null,
        ask: null,
        totalRevenue: null,
    };
}

/**
 * 包括的な株式データを取得
 */
async function fetchStockData(ticker) {
    ticker = normalizeTicker(ticker);

    // chartとsummaryを並列取得（summaryは失敗してもOK）
    const [chart, summary] = await Promise.all([
        fetchChart(ticker).catch((e) => {
            console.warn('Chart取得失敗:', e.message);
            return null;
        }),
        fetchQuoteSummary(ticker).catch((e) => {
            console.warn('QuoteSummary取得失敗（チャートデータで代替）:', e.message);
            return null;
        }),
    ]);

    if (!chart && !summary) {
        throw new Error(`銘柄 ${ticker} のデータを取得できません。CORSプロキシの制限により一時的にアクセスできない場合があります。`);
    }

    const history = chart ? chart.history : [];
    const meta = chart ? chart.meta : {};

    // summaryがある場合はそこから情報を構築
    let info;
    if (summary) {
        const sd = summary.summaryDetail || {};
        const fd = summary.financialData || {};
        const ks = summary.defaultKeyStatistics || {};
        const sp = summary.summaryProfile || {};
        const pr = summary.price || {};
        const ce = summary.calendarEvents || {};

        info = {
            ticker,
            longName: pr.longName || pr.shortName || meta.symbol || ticker,
            shortName: pr.shortName || ticker,
            sector: sp.sector || '',
            industry: sp.industry || '',
            currency: meta.currency || pr.currency || 'JPY',
            currentPrice: yVal(fd.currentPrice) || yVal(pr.regularMarketPrice) || meta.regularMarketPrice,
            regularMarketPrice: yVal(pr.regularMarketPrice) || meta.regularMarketPrice,
            marketCap: yVal(pr.marketCap) || yVal(sd.marketCap),
            trailingPE: yVal(sd.trailingPE) || yVal(ks.trailingPE),
            forwardPE: yVal(sd.forwardPE) || yVal(ks.forwardPE),
            trailingEps: yVal(ks.trailingEps),
            forwardEps: yVal(ks.forwardEps),
            dividendYield: yVal(sd.dividendYield) || yVal(ks.lastDividendValue),
            dividendRate: yVal(sd.dividendRate),
            payoutRatio: yVal(sd.payoutRatio),
            fiveYearAvgDividendYield: yVal(sd.fiveYearAvgDividendYield),
            exDividendDate: yVal(ce.exDividendDate),
            priceToBook: yVal(ks.priceToBook) || yVal(sd.priceToBook),
            enterpriseToEbitda: yVal(ks.enterpriseToEbitda),
            pegRatio: yVal(ks.pegRatio),
            profitMargins: yVal(ks.profitMargins) || yVal(fd.profitMargins),
            operatingMargins: yVal(fd.operatingMargins),
            revenueGrowth: yVal(fd.revenueGrowth),
            earningsGrowth: yVal(fd.earningsGrowth),
            returnOnEquity: yVal(fd.returnOnEquity),
            returnOnAssets: yVal(fd.returnOnAssets),
            debtToEquity: yVal(fd.debtToEquity),
            totalDebt: yVal(fd.totalDebt),
            totalCash: yVal(fd.totalCash),
            freeCashflow: yVal(fd.freeCashflow) || yVal(fd.freeCashFlow),
            operatingCashflow: yVal(fd.operatingCashflow),
            beta: yVal(ks.beta) || yVal(ks['beta3Year']),
            averageVolume: yVal(sd.averageVolume) || yVal(pr.averageDailyVolume3Month),
            averageDailyVolume10Day: yVal(sd.averageDailyVolume10Day) || yVal(pr.averageDailyVolume10Day),
            fiftyTwoWeekHigh: yVal(sd.fiftyTwoWeekHigh),
            fiftyTwoWeekLow: yVal(sd.fiftyTwoWeekLow),
            targetHighPrice: yVal(fd.targetHighPrice),
            targetLowPrice: yVal(fd.targetLowPrice),
            targetMeanPrice: yVal(fd.targetMeanPrice),
            recommendationKey: fd.recommendationKey || '',
            numberOfAnalystOpinions: yVal(fd.numberOfAnalystOpinions),
            heldPercentInstitutions: yVal(ks.heldPercentInstitutions),
            heldPercentInsiders: yVal(ks.heldPercentInsiders),
            shortPercentOfFloat: yVal(ks.shortPercentOfFloat),
            sharesOutstanding: yVal(ks.sharesOutstanding) || yVal(pr.sharesOutstanding),
            fullTimeEmployees: sp.fullTimeEmployees,
            bid: yVal(sd.bid),
            ask: yVal(sd.ask),
            totalRevenue: yVal(fd.totalRevenue),
        };
    } else {
        // summaryが取得できなかった場合はchartメタデータから生成
        info = buildInfoFromChart(ticker, meta, history);
    }

    // 決算履歴（summaryがない場合は空配列）
    const eh = summary?.earningsHistory || {};
    const earningsHistoryData = (eh.history || []).map(q => ({
        date: q.quarter ? yStr(q.quarter) : '',
        epsEstimate: yVal(q.epsEstimate),
        epsActual: yVal(q.epsActual),
        surprisePct: yVal(q.surprisePercent),
    }));

    // 財務諸表（summaryがない場合は空配列）
    const is_ = summary?.incomeStatementHistory?.incomeStatementHistory || [];
    const bs = summary?.balanceSheetHistory?.balanceSheetHistory || [];
    const cf = summary?.cashflowStatementHistory?.cashflowStatements || [];

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
        _dataSource: summary ? 'full' : 'chart_only',
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

/**
 * 銘柄検索（Yahoo Finance Search API - 認証不要）
 */
async function searchTicker(query) {
    try {
        const url = `https://query1.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(query)}&quotesCount=5&newsCount=0&listsCount=0`;
        const data = await fetchWithProxy(url, { timeout: 10000 });
        if (data.quotes && data.quotes.length > 0) {
            return data.quotes.map(q => ({
                symbol: q.symbol,
                name: q.longname || q.shortname || q.symbol,
                type: q.quoteType,
                exchange: q.exchange,
            }));
        }
    } catch {
        // 検索失敗
    }
    return [];
}

// エクスポート
window.StockFetcher = {
    normalizeTicker,
    fetchStockData,
    fetchChart,
    fetchQuoteSummary,
    fetchMarketIndex,
    searchTicker,
    yVal,
};
