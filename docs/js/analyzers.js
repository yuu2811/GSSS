/**
 * GSSS - 10 種類の分析エンジン (JavaScript 版)
 */

// ── 定数 ──────────────────────────────────────────────
const PE_THRESHOLDS   = [10, 15, 20, 30];
const DE_THRESHOLDS   = [0.3, 0.5, 1.0, 2.0];
const VOL_THRESHOLDS  = { veryHigh: 0.40, high: 0.25, mid: 0.15 };
const RSI_OVERBOUGHT  = 70;
const RSI_OVERSOLD    = 30;
const TRADING_DAYS    = 252;
const DRIP_PRICE_GROWTH = 0.05;
const DRIP_DIV_GROWTH   = 0.03;
const DCF_RISK_FREE     = 0.01;
const DCF_EQUITY_PREMIUM = 0.06;
const DCF_TERMINAL_GROWTH = 0.015;

// ── テクニカル・ユーティリティ ────────────────────────
function calcSMA(closes, period) {
    if (!closes || closes.length < period) return null;
    return closes.slice(-period).reduce((a, b) => a + b, 0) / period;
}

function calcRSI(closes, period = 14) {
    if (!closes || closes.length < period + 1) return null;
    let gains = 0, losses = 0;
    for (let i = closes.length - period; i < closes.length; i++) {
        const d = closes[i] - closes[i - 1];
        if (d > 0) gains += d; else losses -= d;
    }
    if (losses === 0) return 100;
    const rs = (gains / period) / (losses / period);
    return 100 - 100 / (1 + rs);
}

function calcEMA(data, span) {
    if (!data || data.length < span) return [];
    const k = 2 / (span + 1);
    const ema = [data.slice(0, span).reduce((a, b) => a + b, 0) / span];
    for (let i = span; i < data.length; i++) {
        ema.push(data[i] * k + ema[ema.length - 1] * (1 - k));
    }
    return ema;
}

function pctChange(arr) {
    if (!arr || arr.length < 2) return [];
    const r = [];
    for (let i = 1; i < arr.length; i++) {
        r.push(arr[i - 1] !== 0 ? (arr[i] - arr[i - 1]) / Math.abs(arr[i - 1]) : 0);
    }
    return r;
}

function stdDev(arr) {
    if (!arr || arr.length === 0) return 0;
    const m = arr.reduce((a, b) => a + b, 0) / arr.length;
    return Math.sqrt(arr.reduce((s, v) => s + (v - m) ** 2, 0) / arr.length);
}

/** 安全に数値を丸める */
function round(v, d = 0) { return v != null ? Math.round(v * 10 ** d) / 10 ** d : null; }

/** 安全に比率を % に変換 */
function toPct(v) {
    if (v == null) return null;
    // normalizeRatio が既に 0-1 に揃えているので *100 するだけ
    return round(v * 100, 1);
}

/** D/E 比率を 0‑n 倍に正規化 (Yahoo は 0.35 と 35 の両方あり) */
function normDE(de) {
    if (de == null) return null;
    return de > 10 ? de / 100 : de;
}

/** 配当利回りを 0‑1 に正規化 */
function normDivYield(y) {
    if (y == null || y === 0) return 0;
    return y >= 1 ? y / 100 : y;
}

// ── 共通データ抽出 ──────────────────────────────────
function extractCommon(data) {
    const { info, history } = data;
    const closes = (history || []).map(h => h.close);
    const currentPrice = info?.currentPrice ?? (closes.length > 0 ? closes[closes.length - 1] : 0);
    return { info: info || {}, history: history || [], closes, currentPrice };
}

// ════════════════════════════════════════════════════
// 1. Goldman Sachs 株式スクリーナー
// ════════════════════════════════════════════════════
function analyzeGoldman(data) {
    const { info, closes, currentPrice } = extractCommon(data);

    // P/E
    const pe = info.trailingPE;
    const fpe = info.forwardPE;
    let peAssessment = 'データなし', peScore = 5;
    if (pe != null) {
        if (pe < PE_THRESHOLDS[0])      { peAssessment = '割安（バリュー圏）'; peScore = 9; }
        else if (pe < PE_THRESHOLDS[1]) { peAssessment = '適正～やや割安'; peScore = 7; }
        else if (pe < PE_THRESHOLDS[2]) { peAssessment = '適正水準'; peScore = 5; }
        else if (pe < PE_THRESHOLDS[3]) { peAssessment = 'やや割高'; peScore = 3; }
        else                            { peAssessment = '割高（成長期待込み）'; peScore = 2; }
    }

    // 負債
    const deRatio = normDE(info.debtToEquity);
    let deHealth = 'データなし', deScore = 5;
    if (deRatio != null) {
        if (deRatio < DE_THRESHOLDS[0])      { deHealth = '非常に健全'; deScore = 10; }
        else if (deRatio < DE_THRESHOLDS[1]) { deHealth = '健全'; deScore = 8; }
        else if (deRatio < DE_THRESHOLDS[2]) { deHealth = '標準的'; deScore = 6; }
        else if (deRatio < DE_THRESHOLDS[3]) { deHealth = 'やや高い'; deScore = 4; }
        else                                 { deHealth = '高リスク'; deScore = 2; }
    }

    // 配当
    const divYield = normDivYield(info.dividendYield);
    const divYieldPct = round(divYield * 100, 2);
    const payoutRatio = info.payoutRatio;
    const payoutPct = payoutRatio != null ? round((payoutRatio < 1 ? payoutRatio : payoutRatio / 100) * 100, 1) : null;
    let divSustain = 'データなし', divScore = 5;
    if (payoutPct != null) {
        if (payoutPct < 40)      { divSustain = '非常に持続可能'; divScore = 10; }
        else if (payoutPct < 60) { divSustain = '持続可能'; divScore = 8; }
        else if (payoutPct < 80) { divSustain = 'やや高め'; divScore = 5; }
        else                     { divSustain = '要注意'; divScore = 3; }
    }

    // モート
    let moatScore = 0;
    const moatReasons = [];
    const mc = info.marketCap || 0;
    if (mc > 1e12) { moatScore += 3; moatReasons.push('大型株（時価総額1兆円超）'); }
    else if (mc > 1e11) { moatScore += 2; moatReasons.push('中大型株'); }
    const pm = info.profitMargins;
    if (pm != null && pm > 0.20) { moatScore += 3; moatReasons.push(`高利益率 (${toPct(pm)}%)`); }
    else if (pm != null && pm > 0.10) { moatScore += 2; moatReasons.push(`安定利益率 (${toPct(pm)}%)`); }
    const roe = info.returnOnEquity;
    if (roe != null && roe > 0.15) { moatScore += 2; moatReasons.push(`高ROE (${toPct(roe)}%)`); }
    if (deScore >= 8) { moatScore += 1; moatReasons.push('低負債'); }
    const moatRating = moatScore >= 8 ? '強い (Strong)' : moatScore >= 5 ? '中程度 (Moderate)' : '弱い (Weak)';

    // 価格ターゲット
    const bullTarget = info.targetHighPrice || currentPrice * 1.20;
    const bearTarget = info.targetLowPrice || currentPrice * 0.85;
    const baseTarget = info.targetMeanPrice || (bullTarget + bearTarget) / 2;

    // リスク
    let risk = 5;
    const beta = info.beta;
    if (beta != null) {
        if (beta > 1.5) risk += 2; else if (beta > 1.2) risk += 1; else if (beta < 0.8) risk -= 1;
    }
    if (deScore <= 3) risk += 1;
    if (peScore <= 3) risk += 1;
    if (mc && mc < 1e10) risk += 1;
    risk = Math.max(1, Math.min(10, risk));
    const riskReasons = [];
    if (beta != null) riskReasons.push(`ベータ: ${round(beta, 2)}`);
    riskReasons.push(`負債健全性: ${deHealth}`, `バリュエーション: ${peAssessment}`);

    // エントリーゾーン
    const recentLow = closes.length >= 20 ? Math.min(...closes.slice(-20)) : currentPrice * 0.95;
    const recentHigh = closes.length >= 20 ? Math.max(...closes.slice(-20)) : currentPrice * 1.05;
    const stopLoss = Math.round(recentLow * 0.95);

    // 収益成長
    const revGrowth = { years: [], growth_rates: [], trend: 'データなし' };
    const stmts = data.incomeStatements;
    if (stmts && stmts.length >= 2) {
        const ordered = [...stmts].reverse();
        for (let i = 1; i < ordered.length; i++) {
            if (ordered[i - 1].totalRevenue > 0) {
                const rate = ((ordered[i].totalRevenue - ordered[i - 1].totalRevenue) / Math.abs(ordered[i - 1].totalRevenue)) * 100;
                revGrowth.growth_rates.push(round(rate, 1));
                revGrowth.years.push(ordered[i].date?.substring(0, 4) || '');
            }
        }
        if (revGrowth.growth_rates.every(g => g > 0)) revGrowth.trend = '安定成長';
        else if (revGrowth.growth_rates.some(g => g < 0)) revGrowth.trend = '変動あり';
        else revGrowth.trend = '成長';
    }

    return {
        analyzer: 'Goldman Sachs 株式スクリーナー',
        company_name: info.longName, ticker: info.ticker, sector: info.sector, industry: info.industry,
        current_price: currentPrice, currency: info.currency,
        pe_analysis: { current_pe: round(pe, 2), forward_pe: round(fpe, 2), assessment: peAssessment, score: peScore },
        revenue_growth: revGrowth,
        debt_analysis: { debt_to_equity: round(deRatio, 2), total_debt: info.totalDebt, total_cash: info.totalCash, health: deHealth, score: deScore },
        dividend_analysis: { yield_pct: divYieldPct, annual_rate: info.dividendRate, payout_ratio_pct: payoutPct, sustainability: divSustain, score: divScore },
        moat_rating: { rating: moatRating, score: moatScore, max_score: 11, reasons: moatReasons },
        price_targets: {
            bull_target: Math.round(bullTarget), bear_target: Math.round(bearTarget), base_target: Math.round(baseTarget),
            upside_pct: round(((bullTarget / currentPrice) - 1) * 100, 1),
            downside_pct: round(((bearTarget / currentPrice) - 1) * 100, 1),
            estimated: !info.targetHighPrice,
        },
        risk_rating: { score: risk, reasons: riskReasons },
        entry_zones: {
            ideal_entry: Math.round(currentPrice * 0.97), aggressive_entry: Math.round(currentPrice),
            conservative_entry: Math.round(recentLow * 1.02), stop_loss: stopLoss,
            stop_loss_pct: round(((stopLoss / currentPrice) - 1) * 100, 1),
            support: Math.round(recentLow), resistance: Math.round(recentHigh),
        },
        market_cap: mc,
        summary: `${info.longName || info.ticker}の総合評価: 競争優位性は${moatRating}、リスクスコアは${risk}/10。`,
    };
}

// ════════════════════════════════════════════════════
// 2. Morgan Stanley テクニカル分析
// ════════════════════════════════════════════════════
function analyzeMorganTechnical(data) {
    const { info, closes, currentPrice, history } = extractCommon(data);
    const highs = history.map(h => h.high);
    const lows = history.map(h => h.low);
    const volumes = history.map(h => h.volume);

    // 移動平均
    const sma20 = calcSMA(closes, 20);
    const sma50 = calcSMA(closes, 50);
    const sma100 = calcSMA(closes, 100);
    const sma200 = calcSMA(closes, 200);

    const trendOf = (sma) => sma != null ? (currentPrice > sma ? '上昇' : '下降') : '判定不可';
    const daily = trendOf(sma20), weekly = trendOf(sma50), monthly = trendOf(sma200);
    const crossover = sma50 != null && sma200 != null ? (sma50 > sma200 ? 'ゴールデンクロス圏' : 'デッドクロス圏') : null;
    const primary = daily === '上昇' && weekly === '上昇' ? '上昇' : daily === '下降' && weekly === '下降' ? '下降' : 'レンジ';

    // MA 分析
    const maData = {};
    [[20, sma20], [50, sma50], [100, sma100], [200, sma200]].forEach(([p, v]) => {
        if (v != null) maData[`${p}日`] = { value: Math.round(v), position: currentPrice > v ? '上' : '下' };
    });
    const bullCount = Object.values(maData).filter(v => v.position === '上').length;
    const maTotal = Object.keys(maData).length;
    let maOverall = 'データ不足';
    if (maTotal > 0) {
        const ratio = bullCount / maTotal;
        if (ratio === 1)       maOverall = '全線上抜け（非常に強気）';
        else if (ratio >= 0.75) maOverall = '概ね強気';
        else if (ratio >= 0.5)  maOverall = '中立';
        else if (ratio > 0)     maOverall = '概ね弱気';
        else                    maOverall = '全線下抜け（非常に弱気）';
    }

    // RSI
    const rsi = calcRSI(closes);
    let rsiInterp = '中立圏', rsiSignal = '中立';
    if (rsi != null) {
        if (rsi > RSI_OVERBOUGHT)      { rsiInterp = '買われすぎ（売りシグナル）'; rsiSignal = '売り'; }
        else if (rsi > 60)             { rsiInterp = 'やや買われすぎ'; rsiSignal = '注意'; }
        else if (rsi < RSI_OVERSOLD)   { rsiInterp = '売られすぎ（買いシグナル）'; rsiSignal = '買い'; }
        else if (rsi < 40)             { rsiInterp = 'やや売られすぎ'; rsiSignal = '注目'; }
    }

    // MACD
    const ema12 = calcEMA(closes, 12), ema26 = calcEMA(closes, 26);
    let macdVal = null, macdSignalVal = null, macdHist = null, macdCrossover = '', macdMomentum = '';
    if (ema12.length > 0 && ema26.length > 0) {
        const offset = ema12.length - ema26.length;
        const macdLine = ema26.map((v, i) => ema12[i + offset] - v);
        const signalLine = calcEMA(macdLine, 9);
        if (signalLine.length > 0) {
            macdVal = macdLine[macdLine.length - 1];
            macdSignalVal = signalLine[signalLine.length - 1];
            macdHist = macdVal - macdSignalVal;
            macdCrossover = macdVal > macdSignalVal ? 'MACDがシグナル線の上（強気）' : 'MACDがシグナル線の下（弱気）';
            macdMomentum = macdHist > 0 ? '正のモメンタム（上昇圧力）' : '負のモメンタム（下降圧力）';
        }
    }

    // ボリンジャーバンド
    let bbUpper = null, bbMiddle = sma20, bbLower = null, bbPos = 'データなし', bbSqueeze = '';
    if (closes.length >= 20 && sma20 != null) {
        const std20 = stdDev(closes.slice(-20));
        bbUpper = sma20 + 2 * std20;
        bbLower = sma20 - 2 * std20;
        const bbWidth = ((bbUpper - bbLower) / sma20) * 100;
        if (currentPrice > bbUpper)       bbPos = '上限バンド突破（買われすぎ）';
        else if (currentPrice > sma20)    bbPos = '上半分（やや強気）';
        else if (currentPrice > bbLower)  bbPos = '下半分（やや弱気）';
        else                              bbPos = '下限バンド割れ（売られすぎ）';
        bbSqueeze = bbWidth < 5 ? 'スクイーズ（収縮）' : '拡張';
    }

    // 出来高
    const curVol = volumes[volumes.length - 1] || 0;
    let volRatio = null, avgVol20 = null;
    if (volumes.length >= 20) {
        avgVol20 = volumes.slice(-20).reduce((a, b) => a + b, 0) / 20;
        volRatio = avgVol20 > 0 ? round(curVol / avgVol20, 2) : 0;
    }
    let volInterp = 'データなし';
    if (volRatio != null) {
        if (volRatio > 2)       volInterp = '出来高急増（大きな動きの兆候）';
        else if (volRatio > 1.3) volInterp = '出来高増加';
        else if (volRatio > 0.7) volInterp = '平均的な出来高';
        else                    volInterp = '出来高減少';
    }

    // フィボナッチ
    const fib = {};
    if (closes.length >= 20) {
        const high = Math.max(...closes), low = Math.min(...closes), diff = high - low;
        Object.assign(fib, {
            high, low, level_236: high - diff * 0.236, level_382: high - diff * 0.382,
            level_500: high - diff * 0.5, level_618: high - diff * 0.618,
        });
    }

    // サポート・レジスタンス
    const s20Low = lows.length >= 20 ? Math.min(...lows.slice(-20)) : null;
    const r20High = highs.length >= 20 ? Math.max(...highs.slice(-20)) : null;
    const supports = [s20Low, lows.length >= 60 ? Math.min(...lows.slice(-60)) : null].filter(Boolean).map(Math.round);
    const resistances = [r20High, highs.length >= 60 ? Math.max(...highs.slice(-60)) : null].filter(Boolean).map(Math.round);

    // パターン
    let pattern = '明確なパターンなし', patDesc = '継続監視が必要', patSignal = '中立';
    if (closes.length >= 40) {
        const r10 = closes.slice(-10);
        const isUp = r10.every((v, i) => i === 0 || v >= r10[i - 1]);
        const isDown = r10.every((v, i) => i === 0 || v <= r10[i - 1]);
        if (isUp)       { pattern = '上昇トレンド継続'; patDesc = '直近10日間連続上昇'; patSignal = '強気'; }
        else if (isDown) { pattern = '下降トレンド継続'; patDesc = '直近10日間連続下降'; patSignal = '弱気'; }
    }

    // トレードセットアップ
    const sl = supports.length > 0 ? Math.round(supports[0] * 0.98) : Math.round(currentPrice * 0.95);
    const t1 = resistances.length > 0 ? resistances[0] : Math.round(currentPrice * 1.05);
    const riskAmt = currentPrice - sl;
    const rrRatio = riskAmt > 0 ? round((t1 - currentPrice) / riskAmt, 2) : 0;

    return {
        analyzer: 'Morgan Stanley テクニカル分析', company_name: info.longName, ticker: info.ticker, current_price: currentPrice,
        trend: { primary, daily, weekly, monthly, crossover },
        ma_analysis: { moving_averages: maData, overall: maOverall },
        rsi_analysis: { value: round(rsi, 1), interpretation: rsiInterp, signal: rsiSignal },
        macd_analysis: { macd: round(macdVal, 2), signal: round(macdSignalVal, 2), histogram: round(macdHist, 2), crossover: macdCrossover, momentum: macdMomentum },
        bb_analysis: { upper: round(bbUpper), middle: round(bbMiddle), lower: round(bbLower), position: bbPos, squeeze_status: bbSqueeze },
        volume_analysis: { current_volume: Math.round(curVol), avg_volume_20d: round(avgVol20), ratio: volRatio, interpretation: volInterp },
        fibonacci: fib,
        pattern: { pattern, description: patDesc, signal: patSignal },
        trade_setup: { entry: Math.round(currentPrice), stop_loss: sl, target_1: t1, risk_reward_ratio: rrRatio, direction: primary === '上昇' ? 'ロング' : primary === '下降' ? 'ショート' : '様子見' },
    };
}

// ════════════════════════════════════════════════════
// 3. Bridgewater リスク評価
// ════════════════════════════════════════════════════
async function analyzeBridgewater(data) {
    const { info, closes, currentPrice } = extractCommon(data);
    const returns = pctChange(closes);

    // ボラティリティ
    const dailyVol = stdDev(returns);
    const annualVol = dailyVol * Math.sqrt(TRADING_DAYS);
    const avp = annualVol * 100;
    const volLevel = avp > 40 ? '非常に高い' : avp > 25 ? '高い' : avp > 15 ? '中程度' : '低い';
    const sorted = [...returns].sort((a, b) => a - b);
    const var95 = sorted.length > 0 ? round(sorted[Math.floor(sorted.length * 0.05)] * 100, 2) : 0;

    // ベータ
    const betaVal = info.beta ?? null;
    const betaInterp = betaVal != null
        ? (betaVal > 1.5 ? '非常にアグレッシブ' : betaVal > 1.0 ? 'やや攻撃的' : betaVal > 0.7 ? '市場並み' : 'ディフェンシブ')
        : '市場データなし';

    // 最大ドローダウン
    let maxDD = 0, maxDDDate = 'N/A', peak = closes[0] || 0;
    for (let i = 0; i < closes.length; i++) {
        if (closes[i] > peak) peak = closes[i];
        const dd = (closes[i] - peak) / peak;
        if (dd < maxDD) {
            maxDD = dd;
            const d = data.history[i]?.date;
            maxDDDate = d ? d.toISOString().slice(0, 10) : 'N/A';
        }
    }

    // ストレステスト
    const scenarios = {
        'リーマンショック級 (-50%)': { estimated_price: Math.round(currentPrice * 0.50), loss_pct: -50.0 },
        'コロナショック級 (-30%)':   { estimated_price: Math.round(currentPrice * 0.70), loss_pct: -30.0 },
        '通常調整 (-15%)':           { estimated_price: Math.round(currentPrice * 0.85), loss_pct: -15.0 },
        '2σイベント':                { estimated_price: Math.round(currentPrice * (1 - 2 * annualVol)), loss_pct: round(-2 * annualVol * 100, 1) },
    };

    // 流動性
    const avgVol = info.averageDailyVolume10Day || info.averageVolume || 0;
    const liqLevel = avgVol > 5e6 ? '非常に高い流動性' : avgVol > 1e6 ? '高い流動性' : avgVol > 1e5 ? '中程度' : avgVol > 1e4 ? '低い流動性' : '非常に低い（注意）';

    // リスクダッシュボード
    const score = (val, thresholds) => {
        const [low, mid, high] = thresholds;
        if (val < low) return { score: 2, label: '低リスク', color: 'green' };
        if (val < mid) return { score: 5, label: '中リスク', color: 'yellow' };
        if (val < high) return { score: 7, label: '高リスク', color: 'orange' };
        return { score: 9, label: '非常に高い', color: 'red' };
    };
    const bv = betaVal ?? 1;
    const mdd = Math.abs(maxDD * 100);
    const metrics = {
        'ボラティリティ': score(avp, [15, 25, 35]),
        'ベータ': bv < 0.8 ? { score: 3, label: 'ディフェンシブ', color: 'green' } : bv < 1.2 ? { score: 5, label: '中立', color: 'yellow' } : { score: 8, label: 'アグレッシブ', color: 'orange' },
        'ドローダウン': score(mdd, [15, 30, 50]),
        '流動性': avgVol > 1e6 ? { score: 2, label: '十分', color: 'green' } : avgVol > 1e5 ? { score: 4, label: '中程度', color: 'yellow' } : { score: 8, label: '低い', color: 'red' },
    };
    const totalRisk = round(Object.values(metrics).reduce((s, m) => s + m.score, 0) / Object.keys(metrics).length, 1);
    const overallRisk = totalRisk < 4 ? '低リスク' : totalRisk < 6 ? '中リスク' : totalRisk < 8 ? '高リスク' : '非常に高リスク';

    // ヘッジ
    const hedgeStrategies = [];
    if (avp > 30) hedgeStrategies.push('高ボラティリティ: プットオプション買い（ポジションの10-15%）を検討');
    if (bv > 1.2) hedgeStrategies.push(`高ベータ(${round(bv, 2)}): 日経平均インバースETF（1571.T）でヘッジ`);
    if (!hedgeStrategies.length) hedgeStrategies.push('現時点で大きなヘッジの必要性は低い。定期的なモニタリングを推奨');

    return {
        analyzer: 'Bridgewater リスク評価', company_name: info.longName, ticker: info.ticker, current_price: currentPrice,
        volatility: { daily_pct: round(dailyVol * 100, 2), annual_pct: round(avp, 2), level: volLevel, percentile_95_daily_loss: var95 },
        beta_analysis: { beta: round(betaVal, 2), up_beta: null, down_beta: null, interpretation: betaInterp, correlation: null },
        drawdown: { max_drawdown_pct: round(maxDD * 100, 2), max_drawdown_date: maxDDDate, recovery_days: 'N/A' },
        interest_sensitivity: { level: '分析中', impact: info.sector || '' },
        stress_test: { current_price: Math.round(currentPrice), scenarios },
        liquidity: { avg_daily_volume: avgVol, liquidity_level: liqLevel, bid_ask_spread_pct: null, market_cap: info.marketCap },
        hedge_recommendation: { strategies: hedgeStrategies },
        risk_dashboard: { metrics, total_risk_score: totalRisk, overall_risk: overallRisk },
    };
}

// ════════════════════════════════════════════════════
// 4. JPMorgan 決算アナライザー
// ════════════════════════════════════════════════════
function analyzeJPMorgan(data) {
    const { info, closes, currentPrice } = extractCommon(data);
    const returns = pctChange(closes);

    let beats = 0, misses = 0;
    const quarters = (data.earningsHistory || []).map(q => {
        const beat = q.epsActual != null && q.epsEstimate != null ? q.epsActual > q.epsEstimate : null;
        if (beat === true) beats++;
        if (beat === false) misses++;
        return { date: q.date, eps_estimate: q.epsEstimate, eps_actual: q.epsActual, surprise_pct: q.surprisePct != null ? round(q.surprisePct * 10, 1) : null, beat };
    });
    const total = beats + misses;
    const beatRate = total > 0 ? Math.round(beats / total * 100) : 0;

    const dailyVol = stdDev(returns);
    const estMove = round(dailyVol * 3 * 100, 2);
    const absReturns = returns.map(Math.abs);
    const larges = [...absReturns].sort((a, b) => b - a).slice(0, 8);
    const avgLarge = larges.length > 0 ? round(larges.reduce((a, b) => a + b, 0) / larges.length * 100, 2) : 0;
    const maxMove = absReturns.length > 0 ? round(Math.max(...absReturns) * 100, 2) : 0;

    const strategies = [];
    if (beatRate >= 75) strategies.push({ timing: '決算前', action: '買い検討', reason: `上振れ率${beatRate}%と高い` });
    else if (beatRate <= 40) strategies.push({ timing: '決算前', action: '売り/様子見', reason: `上振れ率${beatRate}%と低い` });
    else strategies.push({ timing: '決算前', action: '様子見推奨', reason: '上振れ/下振れの予測が難しい' });
    strategies.push(
        { timing: '決算後ギャップアップ時', action: '押し目買い', reason: `想定変動幅±${estMove}%` },
        { timing: '決算後ギャップダウン時', action: '反発を狙う', reason: '過剰反応の場合翌営業日以降に反発傾向' },
    );

    return {
        analyzer: 'JPMorgan 決算アナライザー', company_name: info.longName, ticker: info.ticker, current_price: currentPrice,
        earnings_history: { quarters, beats, misses, beat_rate: beatRate, summary: `直近${total}四半期: ${beats}回上振れ / ${misses}回下振れ (勝率${beatRate}%)` },
        consensus: {
            forward_eps: info.forwardEps, trailing_eps: info.trailingEps, forward_pe: info.forwardPE,
            peg_ratio: info.pegRatio, earnings_growth: info.earningsGrowth, revenue_growth: info.revenueGrowth,
            recommendation: info.recommendationKey, num_analysts: info.numberOfAnalystOpinions,
        },
        key_metrics: [
            { name: '売上高成長率', value: toPct(info.revenueGrowth) != null ? `${toPct(info.revenueGrowth)}%` : 'N/A', importance: '高' },
            { name: '営業利益率', value: toPct(info.operatingMargins) != null ? `${toPct(info.operatingMargins)}%` : 'N/A', importance: '高' },
            { name: '純利益率', value: toPct(info.profitMargins) != null ? `${toPct(info.profitMargins)}%` : 'N/A', importance: '高' },
            { name: 'ROE', value: toPct(info.returnOnEquity) != null ? `${toPct(info.returnOnEquity)}%` : 'N/A', importance: '中' },
        ],
        implied_move: { estimated_move_pct: estMove, avg_large_move_pct: avgLarge, max_single_day_move_pct: maxMove },
        positioning: { strategies },
    };
}

// ════════════════════════════════════════════════════
// 5. BlackRock 配当インカム分析
// ════════════════════════════════════════════════════
function analyzeBlackRock(data, investmentAmount = 1000000) {
    const { info, currentPrice } = extractCommon(data);
    const divYield = normDivYield(info.dividendYield);
    const divYieldPct = round(divYield * 100, 2);

    const payoutPct = info.payoutRatio != null ? round((info.payoutRatio < 1 ? info.payoutRatio : info.payoutRatio / 100) * 100, 0) : null;
    let safetyScore = 5;
    const safetyReasons = [];
    if (payoutPct != null) {
        if (payoutPct < 40)      { safetyScore += 2; safetyReasons.push(`低い配当性向 (${payoutPct}%)`); }
        else if (payoutPct < 60) { safetyScore += 1; safetyReasons.push(`適正な配当性向 (${payoutPct}%)`); }
        else if (payoutPct > 80) { safetyScore -= 2; safetyReasons.push(`高い配当性向 (${payoutPct}%) - 減配リスク`); }
    }
    if (info.freeCashflow != null) {
        if (info.freeCashflow > 0) { safetyScore += 1; safetyReasons.push('プラスのフリーキャッシュフロー'); }
        else { safetyScore -= 2; safetyReasons.push('マイナスのフリーキャッシュフロー'); }
    }
    safetyScore = Math.max(1, Math.min(10, safetyScore));

    const annualIncome = investmentAmount * divYield;
    const projections = Array.from({ length: 20 }, (_, i) => {
        const inc = annualIncome * (1 + DRIP_DIV_GROWTH) ** i;
        return { year: i + 1, annual_income: Math.round(inc), monthly_income: Math.round(inc / 12), yield_on_cost: round(divYieldPct * (1 + DRIP_DIV_GROWTH) ** i, 2) };
    });

    // DRIP シミュレーション
    let shares = currentPrice > 0 ? investmentAmount / currentPrice : 0;
    let price = currentPrice;
    let totalDiv = 0;
    const dripResults = [];
    for (let y = 1; y <= 20; y++) {
        const divPerShare = price * divYield * (1 + DRIP_DIV_GROWTH) ** (y - 1);
        const annDiv = shares * divPerShare;
        totalDiv += annDiv;
        if (price > 0) shares += annDiv / price;
        price *= (1 + DRIP_PRICE_GROWTH);
        dripResults.push({ year: y, shares: round(shares, 1), price: Math.round(price), total_value: Math.round(shares * price), annual_dividend: Math.round(annDiv), cumulative_dividends: Math.round(totalDiv) });
    }

    // イールドトラップ判定
    const warnings = [];
    let isTrap = false;
    if (divYieldPct > 6) { warnings.push('利回り6%超: 株価下落による見かけの高利回りの可能性'); isTrap = true; }
    if (payoutPct != null && payoutPct > 90) { warnings.push('配当性向90%超: 減配リスクが高い'); isTrap = true; }
    if (!warnings.length) warnings.push('イールドトラップの兆候は検出されませんでした');

    const assessDiv = divYieldPct > 5 ? '高配当' : divYieldPct > 3 ? '良好' : divYieldPct > 1.5 ? '中程度' : divYieldPct > 0 ? '低配当' : '無配当';
    const safetyLabel = safetyScore >= 8 ? '非常に安全' : safetyScore >= 6 ? '安全' : safetyScore >= 4 ? '注意' : '危険';

    return {
        analyzer: 'BlackRock 配当インカム分析', company_name: info.longName, ticker: info.ticker, current_price: currentPrice, investment_amount: investmentAmount,
        yield_analysis: { current_yield_pct: divYieldPct, five_year_avg_yield: info.fiveYearAvgDividendYield ? round(info.fiveYearAvgDividendYield, 2) : null, dividend_rate: info.dividendRate, assessment: assessDiv },
        growth_analysis: { growth_rates: {}, consecutive_increases: 0, cagr_pct: 3, status: 'データ参照中', annual_dividends: {} },
        safety: { score: safetyScore, max_score: 10, label: safetyLabel, reasons: safetyReasons },
        income_projection: { initial_annual_income: Math.round(annualIncome), year_10_income: projections[9]?.annual_income || 0, year_20_income: projections[19]?.annual_income || 0, projections, assumed_growth_rate_pct: 3 },
        drip: {
            initial_shares: currentPrice > 0 ? round(investmentAmount / currentPrice, 1) : 0,
            year_10: dripResults[9] || null, year_20: dripResults[19] || null,
            total_return_20y: dripResults[19] ? round(((dripResults[19].total_value / investmentAmount) - 1) * 100, 1) : 0,
            results: dripResults, assumptions: { price_growth: '年率5%', dividend_growth: '年率3.0%' },
        },
        ex_dividend: { ex_dividend_date: info.exDividendDate ? new Date(info.exDividendDate * 1000).toISOString().slice(0, 10) : '未定', dividend_rate: info.dividendRate, note: '配当落ち日の前営業日までに株式を保有する必要があります' },
        yield_trap: { is_potential_trap: isTrap, warnings },
    };
}

// ════════════════════════════════════════════════════
// 6. Citadel セクターローテーション
// ════════════════════════════════════════════════════
async function analyzeCitadel() {
    const nikkeiHist = await StockFetcher.fetchMarketIndex('^N225', '1y');
    const closes = nikkeiHist.map(h => h.close);
    const current = closes[closes.length - 1] || 0;
    const sma200 = calcSMA(closes, 200) || current;
    const ret3m = closes.length >= 66 ? round(((current / closes[closes.length - 66]) - 1) * 100, 1) : 0;

    let phase, desc, recommended, avoid;
    if (current > sma200 && ret3m > 0) {
        phase = '拡大期'; desc = '日経平均は200日線を上回り上昇中'; recommended = ['電機・精密', '機械', '自動車']; avoid = ['電力・ガス', '食品'];
    } else if (current > sma200) {
        phase = 'ピーク/減速期'; desc = '200日線上だがモメンタム鈍化'; recommended = ['医薬品', '食品']; avoid = ['不動産'];
    } else if (ret3m < 0) {
        phase = '収縮期'; desc = '200日線下で下降トレンド'; recommended = ['食品', '医薬品', '電力・ガス']; avoid = ['機械', '不動産'];
    } else {
        phase = '回復期'; desc = '200日線下だが反転の兆候'; recommended = ['銀行', '不動産']; avoid = ['電力・ガス'];
    }

    const alloc = phase === '拡大期' ? { '攻撃的セクター': 60, '中立セクター': 30, '防御的セクター': 10 }
        : phase === '収縮期' ? { '攻撃的セクター': 10, '中立セクター': 30, '防御的セクター': 60 }
        : { '攻撃的セクター': 40, '中立セクター': 35, '防御的セクター': 25 };

    return {
        analyzer: 'Citadel セクターローテーション',
        economic_cycle: { phase, description: desc, nikkei_current: Math.round(current), nikkei_sma200: Math.round(sma200), nikkei_ret_3m: ret3m },
        sector_performance: [],
        rotation_recommendation: {
            overweight: recommended.map(s => ({ sector: s, reason: '経済サイクル的に有利', conviction: '高' })),
            underweight: avoid.map(s => ({ sector: s, reason: '経済サイクル的に不利', conviction: '中' })),
            positioning: phase === '拡大期' || phase === '回復期' ? 'リスクオン' : 'リスクオフ',
        },
        model_allocation: { phase, allocation: alloc, note: 'モデルポートフォリオの目安です' },
    };
}

// ════════════════════════════════════════════════════
// 7. Renaissance 定量スクリーナー
// ════════════════════════════════════════════════════
function analyzeRenaissance(data) {
    const { info, closes } = extractCommon(data);
    const cp = closes[closes.length - 1] || 0;

    const scoreFactor = (checks) => {
        let s = 0; const d = [];
        checks.forEach(([cond, pts, txt]) => { if (cond) { s += pts; d.push(txt); } });
        return { score: Math.min(s, 100), max_score: 100, details: d };
    };

    const pe = info.trailingPE, pb = info.priceToBook, evEb = info.enterpriseToEbitda;
    const value = scoreFactor([
        [pe != null && pe < 15, 25, `P/E ${round(pe, 1)} （割安）`],
        [pe != null && pe >= 15 && pe < 20, 15, `P/E ${round(pe, 1)}`],
        [pe != null && pe >= 20, 5, `P/E ${round(pe, 1)} （割高）`],
        [pb != null && pb < 1, 25, `PBR ${round(pb, 2)} （割安）`],
        [pb != null && pb >= 1 && pb < 2, 15, `PBR ${round(pb, 2)}`],
        [pb != null && pb >= 2, 5, `PBR ${round(pb, 2)}`],
        [evEb != null && evEb < 10, 25, `EV/EBITDA ${round(evEb, 1)}`],
        [evEb != null && evEb >= 10, 10, `EV/EBITDA ${round(evEb, 1)}`],
    ]);

    const roe = info.returnOnEquity, opM = info.operatingMargins, de = info.debtToEquity;
    const quality = scoreFactor([
        [roe != null && roe > 0.15, 25, `ROE ${toPct(roe)}% （高い）`],
        [roe != null && roe > 0.10 && roe <= 0.15, 15, `ROE ${toPct(roe)}%`],
        [opM != null && opM > 0.20, 25, `営業利益率 ${toPct(opM)}%`],
        [opM != null && opM > 0.10 && opM <= 0.20, 15, `営業利益率 ${toPct(opM)}%`],
        [de != null && de < 50, 25, 'D/E比率 低い'],
        [de != null && de >= 50 && de < 100, 15, 'D/E比率 中程度'],
    ]);

    const sma200 = calcSMA(closes, 200);
    const ret52 = closes.length >= TRADING_DAYS ? round(((cp / closes[closes.length - TRADING_DAYS]) - 1) * 100, 1) : null;
    const ret3m = closes.length >= 66 ? round(((cp / closes[closes.length - 66]) - 1) * 100, 1) : null;
    const momentum = scoreFactor([
        [sma200 != null && cp > sma200, 30, '200日線の上方（強気）'],
        [ret52 != null && ret52 > 20, 25, `52週リターン +${ret52}%`],
        [ret52 != null && ret52 > 0 && ret52 <= 20, 15, `52週リターン +${ret52}%`],
        [ret3m != null && ret3m > 10, 25, `3ヶ月 +${ret3m}%`],
        [ret3m != null && ret3m > 0 && ret3m <= 10, 15, `3ヶ月 +${ret3m}%`],
    ]);

    const rg = info.revenueGrowth, eg = info.earningsGrowth;
    const growth = scoreFactor([
        [rg != null && rg > 0.15, 30, `売上成長率 ${toPct(rg)}%`],
        [rg != null && rg > 0.05 && rg <= 0.15, 20, `売上成長率 ${toPct(rg)}%`],
        [eg != null && eg > 0.20, 35, `EPS成長率 ${toPct(eg)}%`],
        [eg != null && eg > 0.05 && eg <= 0.20, 20, `EPS成長率 ${toPct(eg)}%`],
    ]);

    const rec = info.recommendationKey;
    const sentiment = scoreFactor([
        [rec === 'strongBuy' || rec === 'strong_buy', 35, 'アナリスト: 強い買い'],
        [rec === 'buy', 25, 'アナリスト: 買い'],
        [rec === 'hold', 15, 'アナリスト: 中立'],
        [info.heldPercentInstitutions != null && info.heldPercentInstitutions > 0.7, 30, `機関投資家保有 ${toPct(info.heldPercentInstitutions)}%`],
    ]);

    const w = { 'バリュー': 0.20, 'クオリティ': 0.25, 'モメンタム': 0.20, '成長': 0.20, 'センチメント': 0.15 };
    const scores = { 'バリュー': value.score, 'クオリティ': quality.score, 'モメンタム': momentum.score, '成長': growth.score, 'センチメント': sentiment.score };
    const composite = Object.keys(w).reduce((s, k) => s + scores[k] * w[k], 0);
    const rating = composite >= 75 ? '非常に魅力的' : composite >= 60 ? '魅力的' : composite >= 45 ? '中立' : composite >= 30 ? 'やや弱い' : '弱い';
    const recommendation = composite >= 75 ? '強い買い推奨' : composite >= 60 ? '買い推奨' : composite >= 45 ? '保持/様子見' : composite >= 30 ? '慎重に検討' : '見送り推奨';

    return {
        analyzer: 'Renaissance Technologies 定量スクリーナー', company_name: info.longName, ticker: info.ticker,
        value_factors: value, quality_factors: quality, momentum_factors: momentum, growth_factors: growth, sentiment_factors: sentiment,
        composite_score: { total_score: round(composite, 1), max_score: 100, factor_scores: scores, weights: Object.fromEntries(Object.entries(w).map(([k, v]) => [k, `${v * 100}%`])), rating, recommendation },
    };
}

// ════════════════════════════════════════════════════
// 8. Vanguard ETF ポートフォリオ
// ════════════════════════════════════════════════════
function analyzeVanguard(params = {}) {
    const age = params.age || 40;
    const amount = params.investment_amount || 1000000;
    const riskProfile = params.risk_profile || 'バランス型';

    const PROFILES = {
        '積極型': { stocks: 80, bonds: 10, reit: 10 },
        'やや積極型': { stocks: 65, bonds: 25, reit: 10 },
        'バランス型': { stocks: 50, bonds: 40, reit: 10 },
        'やや保守型': { stocks: 35, bonds: 55, reit: 10 },
        '保守型': { stocks: 20, bonds: 70, reit: 10 },
    };
    const alloc = PROFILES[riskProfile] || PROFILES['バランス型'];

    const det = {
        '日本株式': round(alloc.stocks * 0.40, 1), '先進国株式': round(alloc.stocks * 0.45, 1), '新興国株式': round(alloc.stocks * 0.15, 1),
        '日本債券': round(alloc.bonds * 0.50, 1), '外国債券': round(alloc.bonds * 0.50, 1),
        '国内REIT': round(alloc.reit * 0.50, 1), '海外REIT': round(alloc.reit * 0.50, 1),
    };

    const ETF_CATALOG = [
        { ticker: '1306.T', name: 'TOPIX連動型上場投信', category: '日本株式', expense_ratio: 0.066 },
        { ticker: '2559.T', name: 'MAXIS 全世界株式', category: '先進国株式', expense_ratio: 0.078 },
        { ticker: '1681.T', name: '上場インデックス海外新興国', category: '新興国株式', expense_ratio: 0.264 },
        { ticker: '2510.T', name: 'NEXT FUNDS 国内債券', category: '日本債券', expense_ratio: 0.077 },
        { ticker: '2511.T', name: 'NEXT FUNDS 外国債券', category: '外国債券', expense_ratio: 0.132 },
        { ticker: '1343.T', name: 'NEXT FUNDS 東証REIT', category: '国内REIT', expense_ratio: 0.155 },
    ];
    const etfs = ETF_CATALOG.map(e => ({
        ...e, allocation_pct: det[e.category] || 0, amount: Math.round(amount * (det[e.category] || 0) / 100),
    }));

    const RETURN_ASSUMPTIONS = { stocks: 0.07, bonds: 0.02, reit: 0.05 };
    const expRet = round((alloc.stocks / 100 * RETURN_ASSUMPTIONS.stocks + alloc.bonds / 100 * RETURN_ASSUMPTIONS.bonds + alloc.reit / 100 * RETURN_ASSUMPTIONS.reit) * 100, 1);
    const monthly = Math.round(amount / 12);
    const suggestedProfile = age < 30 ? '積極型' : age < 40 ? 'やや積極型' : age < 50 ? 'バランス型' : age < 60 ? 'やや保守型' : '保守型';

    return {
        analyzer: 'Vanguard ETFポートフォリオ', risk_profile: riskProfile, suggested_profile: suggestedProfile,
        age, investment_amount: amount, allocation: alloc, detailed_allocation: det, etf_picks: etfs,
        expected_return: { expected_annual_return_pct: expRet, best_year_estimate_pct: round(expRet + 20, 1), worst_year_estimate_pct: round(expRet - 25, 1), assumptions: { '株式リターン': '年率7%', '債券リターン': '年率2%', 'REITリターン': '年率5%' } },
        rebalance_rules: { frequency: riskProfile.includes('積極') ? '四半期' : '半年', threshold_pct: riskProfile.includes('積極') ? 5 : 3, rules: ['目標配分から乖離した場合にリバランス', '急落時の追加投資はリバランスの好機'] },
        tax_optimization: {
            nisa_account: { recommended: etfs.filter(e => e.category.includes('株式') || e.category.includes('REIT')).map(e => e.name), reason: '成長資産はNISAで非課税メリットを最大化' },
            tokutei_account: { recommended: etfs.filter(e => e.category.includes('債券')).map(e => e.name), reason: '債券は特定口座で管理' },
            notes: ['新NISA: 成長投資枠240万円/年、つみたて投資枠120万円/年'],
        },
        dca_plan: { total_monthly: monthly, allocation: etfs.map(e => ({ etf: e.name, ticker: e.ticker, monthly_amount: Math.round(monthly * e.allocation_pct / 100) })), strategy: '毎月定額積立（ドルコスト平均法）で価格変動リスクを分散' },
    };
}

// ════════════════════════════════════════════════════
// 9. McKinsey マクロ経済レポート
// ════════════════════════════════════════════════════
async function analyzeMcKinsey() {
    const indicators = {};
    const fetchIndex = async (ticker, key, transform) => {
        try {
            const hist = await StockFetcher.fetchMarketIndex(ticker, '1y');
            if (hist.length > 0) indicators[key] = transform(hist);
        } catch { /* 取得失敗は無視 */ }
    };

    await Promise.all([
        fetchIndex('^N225', 'nikkei225', h => {
            const c = h[h.length - 1].close;
            return { current: Math.round(c), change_ytd: round(((c / h[0].close) - 1) * 100, 1) };
        }),
        fetchIndex('USDJPY=X', 'usdjpy', h => ({
            current: round(h[h.length - 1].close, 2),
            change_ytd: round(((h[h.length - 1].close / h[0].close) - 1) * 100, 1),
        })),
    ]);

    const rate = indicators.usdjpy?.current || 150;
    const yenStatus = rate > 150 ? '円安水準' : rate > 130 ? 'やや円安' : rate > 110 ? '適正水準' : '円高水準';
    const isWeakYen = rate > 140;

    const sectorRecs = [
        { sector: '銀行・金融', stance: 'オーバーウェイト', reason: '金利上昇で利ざや拡大' },
        { sector: isWeakYen ? '自動車・輸出' : '内需・小売', stance: 'オーバーウェイト', reason: isWeakYen ? '円安メリット' : '円高で輸入コスト低下' },
        { sector: '医薬品', stance: '中立', reason: 'ディフェンシブ' },
        { sector: isWeakYen ? '食品・小売' : '自動車・輸出', stance: 'アンダーウェイト', reason: isWeakYen ? '原材料コスト上昇' : '海外売上目減り' },
    ];

    return {
        analyzer: 'McKinsey マクロ経済レポート', market_indicators: indicators,
        interest_rate_analysis: { us_10y_yield: 4.0, environment: '中程度の金利環境', impact: { growth_stocks: '成長株への影響は限定的', value_stocks: 'バリュー株は安定', real_estate: '不動産セクターはやや逆風' }, outlook: '今後6-12ヶ月の金利動向はFRBの政策次第' },
        currency_analysis: { usdjpy: rate, yen_status: yenStatus, impact: isWeakYen ? '輸出企業に追い風' : '内需に追い風', beneficiaries: isWeakYen ? ['自動車', '電子部品'] : ['小売', '食品'], losers: isWeakYen ? ['食品', '小売'] : ['自動車'] },
        sector_recommendation: sectorRecs,
        global_risks: [
            { risk: '地政学リスク', severity: '中〜高', impact: 'サプライチェーン混乱' },
            { risk: '米中関係の悪化', severity: '中', impact: 'テクノロジー規制リスク' },
            { risk: 'インフレ再加速', severity: '中', impact: '金利再上昇→バリュエーション圧縮' },
        ],
        timeline: [
            { period: '短期（1-3ヶ月）', focus: '決算シーズン、中央銀行政策会合' },
            { period: '中期（3-6ヶ月）', focus: '金利見通し、企業業績' },
            { period: '長期（6-12ヶ月）', focus: '経済サイクルの転換点' },
        ],
        portfolio_adjustments: {
            recommended_actions: sectorRecs.filter(s => s.stance !== '中立').map(s => `${s.sector}: ${s.stance} - ${s.reason}`),
            overall_stance: '慎重な楽観主義。ポジション維持しつつリスク管理を徹底',
        },
    };
}

// ════════════════════════════════════════════════════
// 10. Morgan Stanley DCF バリュエーション
// ════════════════════════════════════════════════════
function analyzeMorganDCF(data) {
    const { info, currentPrice } = extractCommon(data);
    const shares = info.sharesOutstanding || 0;

    // 収益予測
    let baseRev = info.totalRevenue || data.incomeStatements?.[0]?.totalRevenue || 0;
    let baseGrowth = info.revenueGrowth || 0.05;
    if (baseGrowth > 1) baseGrowth /= 100;
    const currentYear = new Date().getFullYear();
    const projYearly = [];
    let rev = baseRev;
    for (let i = 0; i < 5; i++) {
        const rate = Math.max(baseGrowth * (1 - i * 0.1), 0.02);
        rev *= (1 + rate);
        projYearly.push({ year: currentYear + i, revenue: Math.round(rev), growth_rate_pct: round(rate * 100, 1) });
    }

    // FCF マージン
    let fcfMargin = 0.08;
    if (data.cashflows?.length > 0 && data.incomeStatements?.length > 0 && data.incomeStatements[0].totalRevenue > 0) {
        fcfMargin = Math.max(data.cashflows[0].freeCashflow / data.incomeStatements[0].totalRevenue, 0.03);
    } else if (info.operatingMargins) {
        fcfMargin = Math.max(info.operatingMargins * 0.7, 0.03);
    }
    const fcfYearly = projYearly.map(p => ({ year: p.year, fcf: Math.round(p.revenue * fcfMargin), fcf_margin_pct: round(fcfMargin * 100, 1) }));

    // WACC
    const beta = info.beta || 1.0;
    const coe = DCF_RISK_FREE + beta * DCF_EQUITY_PREMIUM;
    let de = normDE(info.debtToEquity) ?? 0.3;
    const eqW = 1 / (1 + de);
    const dW = de / (1 + de);
    const wacc = eqW * coe + dW * 0.015 * 0.7;

    // ターミナルバリュー
    const lastFCF = fcfYearly[fcfYearly.length - 1]?.fcf || 0;
    const tvPerp = wacc > DCF_TERMINAL_GROWTH ? lastFCF * (1 + DCF_TERMINAL_GROWTH) / (wacc - DCF_TERMINAL_GROWTH) : lastFCF * 20;

    // PV
    let totalPV = 0;
    const pvFcfs = fcfYearly.map((f, i) => {
        const pv = f.fcf / (1 + wacc) ** (i + 1);
        totalPV += pv;
        return { year: f.year, fcf: f.fcf, pv: Math.round(pv) };
    });
    const pvTV = tvPerp / (1 + wacc) ** 5;
    const netDebt = (info.totalDebt || 0) - (info.totalCash || 0);
    const ev = totalPV + pvTV;
    const equity = ev - netDebt;
    const perShare = shares > 0 ? equity / shares : 0;

    // 感度テーブル
    const waccRange = [wacc - 0.02, wacc - 0.01, wacc, wacc + 0.01, wacc + 0.02];
    const gRange = [0.005, 0.01, 0.015, 0.02, 0.025];
    const table = waccRange.map(w => {
        const row = { wacc_pct: round(w * 100, 1) };
        gRange.forEach(g => {
            let tpv = 0;
            fcfYearly.forEach((f, i) => { tpv += f.fcf / (1 + w) ** (i + 1); });
            const tv = w > g ? lastFCF * (1 + g) / (w - g) : lastFCF * 20;
            const eq = tpv + tv / (1 + w) ** 5 - netDebt;
            row[`g_${(g * 100).toFixed(1)}%`] = Math.round(shares > 0 ? eq / shares : 0);
        });
        return row;
    });

    const upside = currentPrice > 0 ? ((perShare / currentPrice) - 1) * 100 : 0;
    let verdict, recommendation;
    if (upside > 30)       { verdict = '大幅に割安'; recommendation = '強い買い推奨'; }
    else if (upside > 10)  { verdict = '割安'; recommendation = '買い推奨'; }
    else if (upside > -10) { verdict = '適正価格'; recommendation = '保持'; }
    else if (upside > -20) { verdict = 'やや割高'; recommendation = '利益確定検討'; }
    else                   { verdict = '割高'; recommendation = '売り推奨'; }

    return {
        analyzer: 'Morgan Stanley DCFバリュエーション', company_name: info.longName, ticker: info.ticker, current_price: currentPrice,
        projections: { base_revenue: baseRev, growth_assumption: `初年度${round(baseGrowth * 100, 1)}%から逓減`, yearly: projYearly },
        fcf_projections: { fcf_margin_assumption: round(fcfMargin * 100, 1), yearly: fcfYearly },
        wacc: { wacc_pct: round(wacc * 100, 2), cost_of_equity_pct: round(coe * 100, 2), cost_of_debt_pct: 1.5, beta: round(beta, 2), risk_free_rate_pct: DCF_RISK_FREE * 100, equity_risk_premium_pct: DCF_EQUITY_PREMIUM * 100, debt_equity_ratio: round(de, 2), tax_rate_pct: 30 },
        terminal_value: { perpetuity_growth: { terminal_value: Math.round(tvPerp), growth_rate_pct: DCF_TERMINAL_GROWTH * 100, method: '永続成長モデル' }, exit_multiple: { terminal_value: Math.round(lastFCF * 10 / 0.7), multiple: 10, method: 'EV/EBITDA 10x出口マルチプル' } },
        valuation: { pv_fcfs: pvFcfs, total_pv_fcf: Math.round(totalPV), pv_terminal_perpetuity: Math.round(pvTV), pv_terminal_multiple: Math.round(lastFCF * 10 / 0.7 / (1 + wacc) ** 5), enterprise_value_perpetuity: Math.round(ev), net_debt: Math.round(netDebt), equity_value_perpetuity: Math.round(equity), per_share_perpetuity: Math.round(perShare), per_share_multiple: Math.round(perShare), per_share_average: Math.round(perShare) },
        sensitivity: { table, wacc_range: waccRange.map(w => `${round(w * 100, 1)}%`), growth_range: gRange.map(g => `${round(g * 100, 1)}%`), note: 'WACC（横軸）と永続成長率（縦軸）の組み合わせによる理論価値' },
        verdict: { verdict, recommendation, fair_value: Math.round(perShare), current_price: Math.round(currentPrice), upside_pct: round(upside, 1) },
    };
}

// ── エクスポート ─────────────────────────────────────
window.Analyzers = {
    goldman: analyzeGoldman, morgan_technical: analyzeMorganTechnical,
    bridgewater: analyzeBridgewater, jpmorgan: analyzeJPMorgan,
    blackrock: analyzeBlackRock, citadel: analyzeCitadel,
    renaissance: analyzeRenaissance, vanguard: analyzeVanguard,
    mckinsey: analyzeMcKinsey, morgan_dcf: analyzeMorganDCF,
};
