/**
 * GSSS - 10種類の分析エンジン（JavaScript版）
 */

// ===== ユーティリティ =====
function calcSMA(closes, period) {
    if (closes.length < period) return null;
    const slice = closes.slice(-period);
    return slice.reduce((a, b) => a + b, 0) / period;
}

function calcRSI(closes, period = 14) {
    if (closes.length < period + 1) return null;
    let gains = 0, losses = 0;
    for (let i = closes.length - period; i < closes.length; i++) {
        const diff = closes[i] - closes[i - 1];
        if (diff > 0) gains += diff; else losses -= diff;
    }
    const avgGain = gains / period;
    const avgLoss = losses / period;
    if (avgLoss === 0) return 100;
    const rs = avgGain / avgLoss;
    return 100 - 100 / (1 + rs);
}

function calcEMA(closes, span) {
    if (closes.length < span) return [];
    const k = 2 / (span + 1);
    const ema = [closes.slice(0, span).reduce((a, b) => a + b, 0) / span];
    for (let i = span; i < closes.length; i++) {
        ema.push(closes[i] * k + ema[ema.length - 1] * (1 - k));
    }
    return ema;
}

function pctChange(arr) {
    const result = [];
    for (let i = 1; i < arr.length; i++) {
        result.push((arr[i] - arr[i - 1]) / Math.abs(arr[i - 1]));
    }
    return result;
}

function stdDev(arr) {
    const mean = arr.reduce((a, b) => a + b, 0) / arr.length;
    return Math.sqrt(arr.reduce((s, v) => s + (v - mean) ** 2, 0) / arr.length);
}

// ===== 1. Goldman Sachs 株式スクリーナー =====
function analyzeGoldman(data) {
    const { info, history } = data;
    const closes = history.map(h => h.close);
    const currentPrice = info.currentPrice || closes[closes.length - 1] || 0;

    // P/E分析
    const pe = info.trailingPE;
    const fpe = info.forwardPE;
    let peAssessment = 'データなし', peScore = 5;
    if (pe) {
        if (pe < 10) { peAssessment = '割安（バリュー圏）'; peScore = 9; }
        else if (pe < 15) { peAssessment = '適正～やや割安'; peScore = 7; }
        else if (pe < 20) { peAssessment = '適正水準'; peScore = 5; }
        else if (pe < 30) { peAssessment = 'やや割高'; peScore = 3; }
        else { peAssessment = '割高（成長期待込み）'; peScore = 2; }
    }

    // 負債分析
    let deRatio = info.debtToEquity;
    if (deRatio != null && deRatio > 10) deRatio /= 100;
    let deHealth = 'データなし', deScore = 5;
    if (deRatio != null) {
        if (deRatio < 0.3) { deHealth = '非常に健全'; deScore = 10; }
        else if (deRatio < 0.5) { deHealth = '健全'; deScore = 8; }
        else if (deRatio < 1.0) { deHealth = '標準的'; deScore = 6; }
        else if (deRatio < 2.0) { deHealth = 'やや高い'; deScore = 4; }
        else { deHealth = '高リスク'; deScore = 2; }
    }

    // 配当分析
    let divYield = info.dividendYield || 0;
    if (divYield > 0 && divYield < 1) divYield *= 100;
    let payoutRatio = info.payoutRatio;
    let payoutPct = payoutRatio != null ? (payoutRatio < 1 ? payoutRatio * 100 : payoutRatio) : null;
    let divSustain = 'データなし', divScore = 5;
    if (payoutPct != null) {
        if (payoutPct < 40) { divSustain = '非常に持続可能'; divScore = 10; }
        else if (payoutPct < 60) { divSustain = '持続可能'; divScore = 8; }
        else if (payoutPct < 80) { divSustain = 'やや高め'; divScore = 5; }
        else { divSustain = '要注意'; divScore = 3; }
    }

    // モート
    let moatScore = 0;
    const moatReasons = [];
    const mc = info.marketCap || 0;
    if (mc > 1e12) { moatScore += 3; moatReasons.push('大型株（時価総額1兆円超）'); }
    else if (mc > 1e11) { moatScore += 2; moatReasons.push('中大型株'); }
    const pm = info.profitMargins;
    if (pm && pm > 0.20) { moatScore += 3; moatReasons.push(`高利益率 (${(pm * 100).toFixed(1)}%)`); }
    else if (pm && pm > 0.10) { moatScore += 2; moatReasons.push(`安定利益率 (${(pm * 100).toFixed(1)}%)`); }
    const roe = info.returnOnEquity;
    if (roe && roe > 0.15) { moatScore += 2; moatReasons.push(`高ROE (${(roe * 100).toFixed(1)}%)`); }
    if (deScore >= 8) { moatScore += 1; moatReasons.push('低負債'); }
    const moatRating = moatScore >= 8 ? '強い (Strong)' : moatScore >= 5 ? '中程度 (Moderate)' : '弱い (Weak)';

    // 価格ターゲット
    const bullTarget = info.targetHighPrice || currentPrice * 1.20;
    const bearTarget = info.targetLowPrice || currentPrice * 0.85;
    const baseTarget = info.targetMeanPrice || (bullTarget + bearTarget) / 2;

    // リスク
    let risk = 5;
    const beta = info.beta;
    if (beta) { if (beta > 1.5) risk += 2; else if (beta > 1.2) risk += 1; else if (beta < 0.8) risk -= 1; }
    if (deScore <= 3) risk += 1;
    if (peScore <= 3) risk += 1;
    if (mc && mc < 1e10) risk += 1;
    risk = Math.max(1, Math.min(10, risk));
    const riskReasons = [];
    if (beta) riskReasons.push(`ベータ: ${beta.toFixed(2)}`);
    riskReasons.push(`負債健全性: ${deHealth}`);
    riskReasons.push(`バリュエーション: ${peAssessment}`);

    // エントリーゾーン
    const recentLow = closes.length >= 20 ? Math.min(...closes.slice(-20)) : currentPrice * 0.95;
    const recentHigh = closes.length >= 20 ? Math.max(...closes.slice(-20)) : currentPrice * 1.05;
    const stopLoss = Math.round(recentLow * 0.95);

    // 収益成長
    const revGrowth = { years: [], growth_rates: [], trend: 'データなし' };
    if (data.incomeStatements && data.incomeStatements.length >= 2) {
        const stmts = [...data.incomeStatements].reverse();
        for (let i = 1; i < stmts.length; i++) {
            if (stmts[i - 1].totalRevenue > 0) {
                const rate = ((stmts[i].totalRevenue - stmts[i - 1].totalRevenue) / Math.abs(stmts[i - 1].totalRevenue)) * 100;
                revGrowth.growth_rates.push(Math.round(rate * 10) / 10);
                revGrowth.years.push(stmts[i].date?.substring(0, 4) || '');
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
        pe_analysis: { current_pe: pe ? Math.round(pe * 100) / 100 : null, forward_pe: fpe ? Math.round(fpe * 100) / 100 : null, assessment: peAssessment, score: peScore },
        revenue_growth: revGrowth,
        debt_analysis: { debt_to_equity: deRatio != null ? Math.round(deRatio * 100) / 100 : null, total_debt: info.totalDebt, total_cash: info.totalCash, health: deHealth, score: deScore },
        dividend_analysis: { yield_pct: Math.round(divYield * 100) / 100, annual_rate: info.dividendRate, payout_ratio_pct: payoutPct != null ? Math.round(payoutPct * 10) / 10 : null, sustainability: divSustain, score: divScore },
        moat_rating: { rating: moatRating, score: moatScore, max_score: 11, reasons: moatReasons },
        price_targets: {
            bull_target: Math.round(bullTarget), bear_target: Math.round(bearTarget), base_target: Math.round(baseTarget),
            upside_pct: Math.round(((bullTarget / currentPrice) - 1) * 1000) / 10,
            downside_pct: Math.round(((bearTarget / currentPrice) - 1) * 1000) / 10,
            estimated: !info.targetHighPrice,
        },
        risk_rating: { score: risk, reasons: riskReasons },
        entry_zones: {
            ideal_entry: Math.round(currentPrice * 0.97), aggressive_entry: Math.round(currentPrice),
            conservative_entry: Math.round(recentLow * 1.02), stop_loss: stopLoss,
            stop_loss_pct: Math.round(((stopLoss / currentPrice) - 1) * 1000) / 10,
            support: Math.round(recentLow), resistance: Math.round(recentHigh),
        },
        market_cap: mc,
        summary: `${info.longName}の総合評価: 競争優位性は${moatRating}、リスクスコアは${risk}/10。`,
    };
}

// ===== 2. Morgan Stanley テクニカル分析 =====
function analyzeMorganTechnical(data) {
    const { info, history } = data;
    const closes = history.map(h => h.close);
    const highs = history.map(h => h.high);
    const lows = history.map(h => h.low);
    const volumes = history.map(h => h.volume);
    const currentPrice = closes[closes.length - 1] || 0;

    // 移動平均
    const sma20 = calcSMA(closes, 20);
    const sma50 = calcSMA(closes, 50);
    const sma100 = calcSMA(closes, 100);
    const sma200 = calcSMA(closes, 200);

    // トレンド
    const daily = sma20 ? (currentPrice > sma20 ? '上昇' : '下降') : '判定不可';
    const weekly = sma50 ? (currentPrice > sma50 ? '上昇' : '下降') : '判定不可';
    const monthly = sma200 ? (currentPrice > sma200 ? '上昇' : '下降') : '判定不可';
    const crossover = sma50 && sma200 ? (sma50 > sma200 ? 'ゴールデンクロス圏' : 'デッドクロス圏') : null;
    const primary = daily === '上昇' && weekly === '上昇' ? '上昇' : daily === '下降' && weekly === '下降' ? '下降' : 'レンジ';

    // MA分析
    const maData = {};
    const maSignals = [];
    [[20, sma20], [50, sma50], [100, sma100], [200, sma200]].forEach(([p, v]) => {
        if (v != null) {
            const pos = currentPrice > v ? '上' : '下';
            maData[`${p}日`] = { value: Math.round(v), position: pos };
            maSignals.push(`${p}日線の${pos}（${pos === '上' ? '強気' : '弱気'}）`);
        }
    });
    const bullCount = Object.values(maData).filter(v => v.position === '上').length;
    const maTotal = Object.keys(maData).length;
    let maOverall = 'データ不足';
    if (maTotal > 0) {
        if (bullCount === maTotal) maOverall = '全線上抜け（非常に強気）';
        else if (bullCount >= maTotal * 0.75) maOverall = '概ね強気';
        else if (bullCount >= maTotal * 0.5) maOverall = '中立';
        else if (bullCount > 0) maOverall = '概ね弱気';
        else maOverall = '全線下抜け（非常に弱気）';
    }

    // RSI
    const rsi = calcRSI(closes);
    let rsiInterp = '中立圏', rsiSignal = '中立';
    if (rsi != null) {
        if (rsi > 70) { rsiInterp = '買われすぎ（売りシグナル）'; rsiSignal = '売り'; }
        else if (rsi > 60) { rsiInterp = 'やや買われすぎ'; rsiSignal = '注意'; }
        else if (rsi < 30) { rsiInterp = '売られすぎ（買いシグナル）'; rsiSignal = '買い'; }
        else if (rsi < 40) { rsiInterp = 'やや売られすぎ'; rsiSignal = '注目'; }
    }

    // MACD
    const ema12 = calcEMA(closes, 12);
    const ema26 = calcEMA(closes, 26);
    let macdVal = null, macdSignalVal = null, macdHist = null, macdCrossover = '', macdMomentum = '';
    if (ema12.length > 0 && ema26.length > 0) {
        const offset = ema12.length - ema26.length;
        const macdLine = ema26.map((v, i) => ema12[i + offset] - v);
        const signalLine = calcEMA(macdLine, 9);
        if (signalLine.length > 0) {
            const so = macdLine.length - signalLine.length;
            macdVal = macdLine[macdLine.length - 1];
            macdSignalVal = signalLine[signalLine.length - 1];
            macdHist = macdVal - macdSignalVal;
            macdCrossover = macdVal > macdSignalVal ? 'MACDがシグナル線の上（強気）' : 'MACDがシグナル線の下（弱気）';
            macdMomentum = macdHist > 0 ? '正のモメンタム（上昇圧力）' : '負のモメンタム（下降圧力）';
        }
    }

    // ボリンジャーバンド
    let bbUpper = null, bbMiddle = sma20, bbLower = null, bbWidth = null, bbPos = 'データなし', bbSqueeze = '';
    if (closes.length >= 20) {
        const std20 = stdDev(closes.slice(-20));
        bbUpper = sma20 + 2 * std20;
        bbLower = sma20 - 2 * std20;
        bbWidth = ((bbUpper - bbLower) / sma20) * 100;
        if (currentPrice > bbUpper) bbPos = '上限バンド突破（買われすぎ）';
        else if (currentPrice > sma20) bbPos = '上半分（やや強気）';
        else if (currentPrice > bbLower) bbPos = '下半分（やや弱気）';
        else bbPos = '下限バンド割れ（売られすぎ）';
        bbSqueeze = bbWidth < 5 ? 'スクイーズ（収縮）' : '拡張';
    }

    // 出来高
    let volRatio = null, avgVol20 = null, curVol = volumes[volumes.length - 1] || 0;
    if (volumes.length >= 20) {
        avgVol20 = volumes.slice(-20).reduce((a, b) => a + b, 0) / 20;
        volRatio = avgVol20 > 0 ? curVol / avgVol20 : 0;
    }
    let volInterp = 'データなし', volConf = '中立';
    if (volRatio != null) {
        if (volRatio > 2) { volInterp = '出来高急増（大きな動きの兆候）'; volConf = '価格変動を強く裏付け'; }
        else if (volRatio > 1.3) { volInterp = '出来高増加'; volConf = '価格変動を裏付け'; }
        else if (volRatio > 0.7) { volInterp = '平均的な出来高'; volConf = '中立'; }
        else { volInterp = '出来高減少'; volConf = '価格変動の信頼性低い'; }
    }

    // フィボナッチ
    const fib = {};
    if (closes.length >= 20) {
        const high = Math.max(...closes);
        const low = Math.min(...closes);
        const diff = high - low;
        Object.assign(fib, { high, low, level_236: high - diff * 0.236, level_382: high - diff * 0.382, level_500: high - diff * 0.5, level_618: high - diff * 0.618, level_786: high - diff * 0.786 });
    }

    // サポート・レジスタンス
    const s20Low = lows.length >= 20 ? Math.min(...lows.slice(-20)) : null;
    const s60Low = lows.length >= 60 ? Math.min(...lows.slice(-60)) : null;
    const r20High = highs.length >= 20 ? Math.max(...highs.slice(-20)) : null;
    const r60High = highs.length >= 60 ? Math.max(...highs.slice(-60)) : null;
    const supports = [s20Low, s60Low].filter(v => v != null).map(v => Math.round(v));
    const resistances = [r20High, r60High].filter(v => v != null).map(v => Math.round(v));

    // パターン
    let pattern = '明確なパターンなし', patDesc = '継続監視が必要', patSignal = '中立';
    if (closes.length >= 40) {
        const r10 = closes.slice(-10);
        const isUp = r10.every((v, i) => i === 0 || v >= r10[i - 1]);
        const isDown = r10.every((v, i) => i === 0 || v <= r10[i - 1]);
        if (isUp) { pattern = '上昇トレンド継続'; patDesc = '直近10日間連続上昇'; patSignal = '強気'; }
        else if (isDown) { pattern = '下降トレンド継続'; patDesc = '直近10日間連続下降'; patSignal = '弱気'; }
    }

    // トレードセットアップ
    const sl = supports.length > 0 ? Math.round(supports[0] * 0.98) : Math.round(currentPrice * 0.95);
    const t1 = resistances.length > 0 ? resistances[0] : Math.round(currentPrice * 1.05);
    const t2 = resistances.length > 0 ? Math.round(resistances[0] * 1.05) : Math.round(currentPrice * 1.10);
    const riskAmt = currentPrice - sl;
    const rewardAmt = t1 - currentPrice;
    const rrRatio = riskAmt > 0 ? Math.round((rewardAmt / riskAmt) * 100) / 100 : 0;

    return {
        analyzer: 'Morgan Stanley テクニカル分析', company_name: info.longName, ticker: info.ticker, current_price: currentPrice,
        trend: { primary, daily, weekly, monthly, crossover },
        support_resistance: { supports: [...new Set(supports)].sort((a, b) => a - b), resistances: [...new Set(resistances)].sort((a, b) => b - a) },
        ma_analysis: { moving_averages: maData, signals: maSignals, overall: maOverall },
        rsi_analysis: { value: rsi != null ? Math.round(rsi * 10) / 10 : null, interpretation: rsiInterp, signal: rsiSignal },
        macd_analysis: { macd: macdVal != null ? Math.round(macdVal * 100) / 100 : null, signal: macdSignalVal != null ? Math.round(macdSignalVal * 100) / 100 : null, histogram: macdHist != null ? Math.round(macdHist * 100) / 100 : null, crossover: macdCrossover, momentum: macdMomentum },
        bb_analysis: { upper: bbUpper ? Math.round(bbUpper) : null, middle: bbMiddle ? Math.round(bbMiddle) : null, lower: bbLower ? Math.round(bbLower) : null, width: bbWidth ? Math.round(bbWidth * 100) / 100 : null, position: bbPos, squeeze_status: bbSqueeze },
        volume_analysis: { current_volume: Math.round(curVol), avg_volume_20d: avgVol20 ? Math.round(avgVol20) : 0, ratio: volRatio ? Math.round(volRatio * 100) / 100 : null, interpretation: volInterp, confirmation: volConf },
        fibonacci: fib,
        pattern: { pattern, description: patDesc, signal: patSignal },
        trade_setup: { entry: Math.round(currentPrice), stop_loss: sl, target_1: t1, target_2: t2, risk_reward_ratio: rrRatio, direction: primary === '上昇' ? 'ロング' : primary === '下降' ? 'ショート' : '様子見' },
    };
}

// ===== 3. Bridgewater リスク評価 =====
async function analyzeBridgewater(data) {
    const { info, history } = data;
    const closes = history.map(h => h.close);
    const currentPrice = closes[closes.length - 1] || 0;
    const returns = pctChange(closes);

    // ボラティリティ
    const dailyVol = returns.length > 0 ? stdDev(returns) : 0;
    const annualVol = dailyVol * Math.sqrt(252);
    const volLevel = annualVol > 0.40 ? '非常に高い' : annualVol > 0.25 ? '高い' : annualVol > 0.15 ? '中程度' : '低い';
    const sortedReturns = [...returns].sort((a, b) => a - b);
    const var95 = sortedReturns.length > 0 ? sortedReturns[Math.floor(sortedReturns.length * 0.05)] * 100 : 0;

    // ベータ（日経225対比）
    let betaVal = info.beta || null;
    let betaInterp = betaVal ? (betaVal > 1.5 ? '非常にアグレッシブ' : betaVal > 1.0 ? 'やや攻撃的' : betaVal > 0.7 ? '市場並み' : 'ディフェンシブ') : '市場データなし';

    // ドローダウン
    let maxDD = 0, maxDDDate = 'N/A';
    let peak = closes[0] || 0;
    for (let i = 0; i < closes.length; i++) {
        if (closes[i] > peak) peak = closes[i];
        const dd = (closes[i] - peak) / peak;
        if (dd < maxDD) { maxDD = dd; maxDDDate = history[i]?.date ? history[i].date.toISOString().slice(0, 10) : 'N/A'; }
    }

    // ストレステスト
    const scenarios = {
        'リーマンショック級 (-50%)': { estimated_price: Math.round(currentPrice * 0.50), loss_pct: -50.0 },
        'コロナショック級 (-30%)': { estimated_price: Math.round(currentPrice * 0.70), loss_pct: -30.0 },
        '通常調整 (-15%)': { estimated_price: Math.round(currentPrice * 0.85), loss_pct: -15.0 },
        '2σイベント': { estimated_price: Math.round(currentPrice * (1 - 2 * annualVol)), loss_pct: Math.round(-2 * annualVol * 1000) / 10 },
    };

    // 流動性
    const avgVol = info.averageDailyVolume10Day || info.averageVolume || 0;
    let liqLevel = '非常に低い（注意）';
    if (avgVol > 5e6) liqLevel = '非常に高い流動性';
    else if (avgVol > 1e6) liqLevel = '高い流動性';
    else if (avgVol > 1e5) liqLevel = '中程度';
    else if (avgVol > 1e4) liqLevel = '低い流動性';

    // リスクダッシュボード
    const metrics = {};
    const avp = annualVol * 100;
    if (avp < 15) metrics['ボラティリティ'] = { score: 2, label: '低リスク', color: 'green' };
    else if (avp < 25) metrics['ボラティリティ'] = { score: 5, label: '中リスク', color: 'yellow' };
    else if (avp < 35) metrics['ボラティリティ'] = { score: 7, label: '高リスク', color: 'orange' };
    else metrics['ボラティリティ'] = { score: 9, label: '非常に高い', color: 'red' };
    const bv = betaVal || 1;
    if (bv < 0.8) metrics['ベータ'] = { score: 3, label: 'ディフェンシブ', color: 'green' };
    else if (bv < 1.2) metrics['ベータ'] = { score: 5, label: '中立', color: 'yellow' };
    else metrics['ベータ'] = { score: 8, label: 'アグレッシブ', color: 'orange' };
    const mdd = Math.abs(maxDD * 100);
    if (mdd < 15) metrics['ドローダウン'] = { score: 2, label: '軽微', color: 'green' };
    else if (mdd < 30) metrics['ドローダウン'] = { score: 5, label: '中程度', color: 'yellow' };
    else if (mdd < 50) metrics['ドローダウン'] = { score: 7, label: '大きい', color: 'orange' };
    else metrics['ドローダウン'] = { score: 9, label: '深刻', color: 'red' };
    if (avgVol > 1e6) metrics['流動性'] = { score: 2, label: '十分', color: 'green' };
    else if (avgVol > 1e5) metrics['流動性'] = { score: 4, label: '中程度', color: 'yellow' };
    else metrics['流動性'] = { score: 8, label: '低い', color: 'red' };
    const totalRisk = Object.values(metrics).reduce((s, m) => s + m.score, 0) / Object.keys(metrics).length;
    const overallRisk = totalRisk < 4 ? '低リスク' : totalRisk < 6 ? '中リスク' : totalRisk < 8 ? '高リスク' : '非常に高リスク';

    // ヘッジ
    const hedgeStrategies = [];
    if (avp > 30) hedgeStrategies.push('高ボラティリティ: プットオプション買い（ポジションの10-15%）を検討');
    if (bv > 1.2) hedgeStrategies.push(`高ベータ(${bv.toFixed(2)}): 日経平均インバースETF（1571.T）でヘッジ`);
    if (hedgeStrategies.length === 0) hedgeStrategies.push('現時点で大きなヘッジの必要性は低い。定期的なモニタリングを推奨');

    return {
        analyzer: 'Bridgewater リスク評価', company_name: info.longName, ticker: info.ticker, current_price: currentPrice,
        volatility: { daily_pct: Math.round(dailyVol * 10000) / 100, annual_pct: Math.round(annualVol * 10000) / 100, level: volLevel, percentile_95_daily_loss: Math.round(var95 * 100) / 100 },
        beta_analysis: { beta: betaVal ? Math.round(betaVal * 100) / 100 : null, up_beta: null, down_beta: null, interpretation: betaInterp, correlation: null },
        drawdown: { max_drawdown_pct: Math.round(maxDD * 10000) / 100, max_drawdown_date: maxDDDate, recovery_days: 'N/A' },
        interest_sensitivity: { level: '分析中', impact: info.sector || '' },
        stress_test: { current_price: Math.round(currentPrice), scenarios },
        earnings_risk: { avg_daily_move_pct: Math.round(returns.map(Math.abs).reduce((a, b) => a + b, 0) / returns.length * 10000) / 100, estimated_earnings_move_pct: 0 },
        liquidity: { avg_daily_volume: avgVol, liquidity_level: liqLevel, bid_ask_spread_pct: null, market_cap: info.marketCap },
        hedge_recommendation: { strategies: hedgeStrategies },
        risk_dashboard: { metrics, total_risk_score: Math.round(totalRisk * 10) / 10, overall_risk: overallRisk },
    };
}

// ===== 4. JPMorgan 決算分析 =====
function analyzeJPMorgan(data) {
    const { info, earningsHistory, history } = data;
    const closes = history.map(h => h.close);
    const returns = pctChange(closes);
    const currentPrice = info.currentPrice || closes[closes.length - 1] || 0;

    let beats = 0, misses = 0;
    const quarters = (earningsHistory || []).map(q => {
        const beat = q.epsActual != null && q.epsEstimate != null ? q.epsActual > q.epsEstimate : null;
        if (beat === true) beats++;
        if (beat === false) misses++;
        return { date: q.date, eps_estimate: q.epsEstimate, eps_actual: q.epsActual, surprise_pct: q.surprisePct != null ? Math.round(q.surprisePct * 1000) / 10 : null, beat };
    });
    const total = beats + misses;
    const beatRate = total > 0 ? Math.round(beats / total * 100) : 0;

    const dailyVol = returns.length > 0 ? stdDev(returns) : 0;
    const estMove = Math.round(dailyVol * 3 * 10000) / 100;
    const larges = [...returns.map(Math.abs)].sort((a, b) => b - a).slice(0, 8);
    const avgLarge = larges.length > 0 ? Math.round(larges.reduce((a, b) => a + b, 0) / larges.length * 10000) / 100 : 0;
    const maxMove = returns.length > 0 ? Math.round(Math.max(...returns.map(Math.abs)) * 10000) / 100 : 0;

    const strategies = [];
    if (beatRate >= 75) strategies.push({ timing: '決算前', action: '買い検討', reason: `上振れ率${beatRate}%と高い` });
    else if (beatRate <= 40) strategies.push({ timing: '決算前', action: '売り/様子見', reason: `上振れ率${beatRate}%と低い` });
    else strategies.push({ timing: '決算前', action: '様子見推奨', reason: '上振れ/下振れの予測が難しい' });
    strategies.push({ timing: '決算後ギャップアップ時', action: '押し目買い', reason: `想定変動幅±${estMove}%` });
    strategies.push({ timing: '決算後ギャップダウン時', action: '反発を狙う', reason: '過剰反応の場合翌営業日以降に反発傾向' });

    return {
        analyzer: 'JPMorgan 決算アナライザー', company_name: info.longName, ticker: info.ticker, current_price: currentPrice,
        earnings_history: { quarters, beats, misses, beat_rate: beatRate, summary: `直近${total}四半期: ${beats}回上振れ / ${misses}回下振れ (勝率${beatRate}%)` },
        consensus: { forward_eps: info.forwardEps, trailing_eps: info.trailingEps, forward_pe: info.forwardPE, peg_ratio: info.pegRatio, earnings_growth: info.earningsGrowth, revenue_growth: info.revenueGrowth, analyst_target_mean: info.targetMeanPrice, analyst_target_high: info.targetHighPrice, analyst_target_low: info.targetLowPrice, recommendation: info.recommendationKey, num_analysts: info.numberOfAnalystOpinions },
        key_metrics: [
            { name: '売上高成長率', value: info.revenueGrowth ? `${(info.revenueGrowth * 100).toFixed(1)}%` : 'N/A', importance: '高' },
            { name: '営業利益率', value: info.operatingMargins ? `${(info.operatingMargins * 100).toFixed(1)}%` : 'N/A', importance: '高' },
            { name: '純利益率', value: info.profitMargins ? `${(info.profitMargins * 100).toFixed(1)}%` : 'N/A', importance: '高' },
            { name: 'ROE', value: info.returnOnEquity ? `${(info.returnOnEquity * 100).toFixed(1)}%` : 'N/A', importance: '中' },
        ],
        segments: { sector: info.sector, industry: info.industry, full_time_employees: info.fullTimeEmployees, note: 'セグメント別詳細はIR資料を参照' },
        implied_move: { estimated_move_pct: estMove, avg_large_move_pct: avgLarge, max_single_day_move_pct: maxMove },
        positioning: { strategies },
    };
}

// ===== 5. BlackRock 配当分析 =====
function analyzeBlackRock(data, investmentAmount = 1000000) {
    const { info, history } = data;
    const currentPrice = info.currentPrice || 0;
    let divYield = info.dividendYield || 0;
    if (divYield > 0 && divYield < 1) divYield = divYield;
    else if (divYield >= 1) divYield = divYield / 100;
    const divYieldPct = divYield * 100;

    let payoutPct = info.payoutRatio != null ? (info.payoutRatio < 1 ? info.payoutRatio * 100 : info.payoutRatio) : null;
    let safetyScore = 5, safetyReasons = [];
    if (payoutPct != null) {
        if (payoutPct < 40) { safetyScore += 2; safetyReasons.push(`低い配当性向 (${payoutPct.toFixed(0)}%)`); }
        else if (payoutPct < 60) { safetyScore += 1; safetyReasons.push(`適正な配当性向 (${payoutPct.toFixed(0)}%)`); }
        else if (payoutPct > 80) { safetyScore -= 2; safetyReasons.push(`高い配当性向 (${payoutPct.toFixed(0)}%) - 減配リスク`); }
    }
    if (info.freeCashflow && info.freeCashflow > 0) { safetyScore += 1; safetyReasons.push('プラスのフリーキャッシュフロー'); }
    else if (info.freeCashflow && info.freeCashflow < 0) { safetyScore -= 2; safetyReasons.push('マイナスのフリーキャッシュフロー'); }
    safetyScore = Math.max(1, Math.min(10, safetyScore));

    const annualIncome = investmentAmount * divYield;
    const growthRate = 0.03;
    const projections = [];
    for (let y = 1; y <= 20; y++) {
        const inc = annualIncome * Math.pow(1 + growthRate, y - 1);
        projections.push({ year: y, annual_income: Math.round(inc), monthly_income: Math.round(inc / 12), yield_on_cost: Math.round(divYieldPct * Math.pow(1 + growthRate, y - 1) * 100) / 100 });
    }

    // DRIP
    let shares = currentPrice > 0 ? investmentAmount / currentPrice : 0;
    let price = currentPrice;
    let totalDiv = 0;
    const dripResults = [];
    for (let y = 1; y <= 20; y++) {
        const divPerShare = price * divYield * Math.pow(1 + growthRate, y - 1);
        const annDiv = shares * divPerShare;
        totalDiv += annDiv;
        if (price > 0) shares += annDiv / price;
        price *= 1.05;
        dripResults.push({ year: y, shares: Math.round(shares * 10) / 10, price: Math.round(price), total_value: Math.round(shares * price), annual_dividend: Math.round(annDiv), cumulative_dividends: Math.round(totalDiv) });
    }

    // イールドトラップ
    const warnings = [];
    let isTrap = false;
    if (divYieldPct > 6) { warnings.push('利回り6%超: 株価下落による見かけの高利回りの可能性'); isTrap = true; }
    if (payoutPct && payoutPct > 90) { warnings.push('配当性向90%超: 減配リスクが高い'); isTrap = true; }
    if (!warnings.length) warnings.push('イールドトラップの兆候は検出されませんでした');

    return {
        analyzer: 'BlackRock 配当インカム分析', company_name: info.longName, ticker: info.ticker, current_price: currentPrice, investment_amount: investmentAmount,
        yield_analysis: { current_yield_pct: Math.round(divYieldPct * 100) / 100, five_year_avg_yield: info.fiveYearAvgDividendYield ? Math.round(info.fiveYearAvgDividendYield * 100) / 100 : null, dividend_rate: info.dividendRate, assessment: divYieldPct > 5 ? '高配当' : divYieldPct > 3 ? '良好' : divYieldPct > 1.5 ? '中程度' : divYieldPct > 0 ? '低配当' : '無配当' },
        growth_analysis: { growth_rates: {}, consecutive_increases: 0, cagr_pct: 3, status: 'データ参照中', annual_dividends: {} },
        safety: { score: safetyScore, max_score: 10, label: safetyScore >= 8 ? '非常に安全' : safetyScore >= 6 ? '安全' : safetyScore >= 4 ? '注意' : '危険', reasons: safetyReasons },
        income_projection: { initial_annual_income: Math.round(annualIncome), year_10_income: projections[9]?.annual_income || 0, year_20_income: projections[19]?.annual_income || 0, projections, assumed_growth_rate_pct: 3 },
        drip: { initial_shares: currentPrice > 0 ? Math.round(investmentAmount / currentPrice * 10) / 10 : 0, year_10: dripResults[9] || null, year_20: dripResults[19] || null, total_return_20y: dripResults[19] ? Math.round(((dripResults[19].total_value / investmentAmount) - 1) * 1000) / 10 : 0, results: dripResults, assumptions: { price_growth: '年率5%', dividend_growth: '年率3.0%' } },
        ex_dividend: { ex_dividend_date: info.exDividendDate ? new Date(info.exDividendDate * 1000).toISOString().slice(0, 10) : '未定', dividend_rate: info.dividendRate, note: '配当落ち日の前営業日までに株式を保有する必要があります' },
        yield_trap: { is_potential_trap: isTrap, warnings },
    };
}

// ===== 6. Citadel セクターローテーション =====
async function analyzeCitadel() {
    // 日経225でサイクル判定
    let nikkeiHist = [];
    try { nikkeiHist = await StockFetcher.fetchMarketIndex('^N225', '1y'); } catch {}
    const closes = nikkeiHist.map(h => h.close);
    const current = closes[closes.length - 1] || 0;
    const sma200 = calcSMA(closes, 200) || current;
    const ret3m = closes.length >= 66 ? ((current / closes[closes.length - 66]) - 1) * 100 : 0;

    let phase, desc, recommended, avoid;
    if (current > sma200 && ret3m > 0) { phase = '拡大期'; desc = '日経平均は200日線を上回り上昇中'; recommended = ['電機・精密', '機械', '自動車']; avoid = ['電力・ガス', '食品']; }
    else if (current > sma200) { phase = 'ピーク/減速期'; desc = '200日線上だがモメンタム鈍化'; recommended = ['医薬品', '食品']; avoid = ['不動産']; }
    else if (ret3m < 0) { phase = '収縮期'; desc = '200日線下で下降トレンド'; recommended = ['食品', '医薬品', '電力・ガス']; avoid = ['機械', '不動産']; }
    else { phase = '回復期'; desc = '200日線下だが反転の兆候'; recommended = ['銀行', '不動産']; avoid = ['電力・ガス']; }

    const alloc = phase === '拡大期' ? { '攻撃的セクター': 60, '中立セクター': 30, '防御的セクター': 10 }
        : phase === '収縮期' ? { '攻撃的セクター': 10, '中立セクター': 30, '防御的セクター': 60 }
        : { '攻撃的セクター': 40, '中立セクター': 35, '防御的セクター': 25 };

    return {
        analyzer: 'Citadel セクターローテーション',
        economic_cycle: { phase, description: desc, nikkei_current: Math.round(current), nikkei_sma200: Math.round(sma200), nikkei_ret_3m: Math.round(ret3m * 10) / 10, recommended_sectors: recommended, avoid_sectors: avoid },
        sector_performance: [],
        rotation_recommendation: {
            overweight: recommended.map(s => ({ sector: s, reason: '経済サイクル的に有利', conviction: '高' })),
            underweight: avoid.map(s => ({ sector: s, reason: '経済サイクル的に不利', conviction: '中' })),
            positioning: phase === '拡大期' || phase === '回復期' ? 'リスクオン' : 'リスクオフ',
        },
        model_allocation: { phase, allocation: alloc, note: 'モデルポートフォリオの目安です' },
    };
}

// ===== 7. Renaissance 定量スクリーナー =====
function analyzeRenaissance(data) {
    const { info, history } = data;
    const closes = history.map(h => h.close);

    const factor = (checks) => { let s = 0; const d = []; checks.forEach(([cond, pts, txt]) => { if (cond) { s += pts; d.push(txt); } }); return { score: Math.min(s, 100), max_score: 100, details: d }; };

    const pe = info.trailingPE;
    const pb = info.priceToBook;
    const evEb = info.enterpriseToEbitda;
    const value = factor([
        [pe && pe < 15, 25, `P/E ${pe?.toFixed(1)} （割安）`], [pe && pe >= 15 && pe < 20, 15, `P/E ${pe?.toFixed(1)}`], [pe && pe >= 20, 5, `P/E ${pe?.toFixed(1)} （割高）`],
        [pb && pb < 1, 25, `PBR ${pb?.toFixed(2)} （割安）`], [pb && pb >= 1 && pb < 2, 15, `PBR ${pb?.toFixed(2)}`], [pb && pb >= 2, 5, `PBR ${pb?.toFixed(2)}`],
        [evEb && evEb < 10, 25, `EV/EBITDA ${evEb?.toFixed(1)}`], [evEb && evEb >= 10, 10, `EV/EBITDA ${evEb?.toFixed(1)}`],
    ]);

    const roe = info.returnOnEquity; const opM = info.operatingMargins; const de = info.debtToEquity;
    const quality = factor([
        [roe && roe > 0.15, 25, `ROE ${(roe*100).toFixed(1)}% （高い）`], [roe && roe > 0.10 && roe <= 0.15, 15, `ROE ${(roe*100).toFixed(1)}%`],
        [opM && opM > 0.20, 25, `営業利益率 ${(opM*100).toFixed(1)}%`], [opM && opM > 0.10 && opM <= 0.20, 15, `営業利益率 ${(opM*100).toFixed(1)}%`],
        [de != null && (de < 50), 25, `D/E比率 低い`], [de != null && de >= 50 && de < 100, 15, `D/E比率 中程度`],
    ]);

    const sma200 = calcSMA(closes, 200);
    const cp = closes[closes.length - 1] || 0;
    const ret52 = closes.length >= 252 ? ((cp / closes[closes.length - 252]) - 1) * 100 : null;
    const ret3m = closes.length >= 66 ? ((cp / closes[closes.length - 66]) - 1) * 100 : null;
    const momentum = factor([
        [sma200 && cp > sma200, 30, `200日線の上方（強気）`],
        [ret52 && ret52 > 20, 25, `52週リターン +${ret52?.toFixed(1)}%`], [ret52 && ret52 > 0 && ret52 <= 20, 15, `52週リターン +${ret52?.toFixed(1)}%`],
        [ret3m && ret3m > 10, 25, `3ヶ月 +${ret3m?.toFixed(1)}%`], [ret3m && ret3m > 0 && ret3m <= 10, 15, `3ヶ月 +${ret3m?.toFixed(1)}%`],
    ]);

    const rg = info.revenueGrowth; const eg = info.earningsGrowth;
    const growth = factor([
        [rg && rg > 0.15, 30, `売上成長率 ${(rg*100).toFixed(1)}%`], [rg && rg > 0.05 && rg <= 0.15, 20, `売上成長率 ${(rg*100).toFixed(1)}%`],
        [eg && eg > 0.20, 35, `EPS成長率 ${(eg*100).toFixed(1)}%`], [eg && eg > 0.05 && eg <= 0.20, 20, `EPS成長率 ${(eg*100).toFixed(1)}%`],
    ]);

    const rec = info.recommendationKey;
    const sentiment = factor([
        [rec === 'strongBuy' || rec === 'strong_buy', 35, 'アナリスト: 強い買い'], [rec === 'buy', 25, 'アナリスト: 買い'], [rec === 'hold', 15, 'アナリスト: 中立'],
        [info.heldPercentInstitutions && info.heldPercentInstitutions > 0.7, 30, `機関投資家保有 ${(info.heldPercentInstitutions*100).toFixed(1)}%`],
    ]);

    const w = { 'バリュー': 0.20, 'クオリティ': 0.25, 'モメンタム': 0.20, '成長': 0.20, 'センチメント': 0.15 };
    const scores = { 'バリュー': value.score, 'クオリティ': quality.score, 'モメンタム': momentum.score, '成長': growth.score, 'センチメント': sentiment.score };
    const composite = Object.keys(w).reduce((s, k) => s + scores[k] * w[k], 0);
    const rating = composite >= 75 ? '非常に魅力的' : composite >= 60 ? '魅力的' : composite >= 45 ? '中立' : composite >= 30 ? 'やや弱い' : '弱い';
    const recommendation = composite >= 75 ? '強い買い推奨' : composite >= 60 ? '買い推奨' : composite >= 45 ? '保持/様子見' : composite >= 30 ? '慎重に検討' : '見送り推奨';

    return {
        analyzer: 'Renaissance Technologies 定量スクリーナー', company_name: info.longName, ticker: info.ticker,
        value_factors: value, quality_factors: quality, momentum_factors: momentum, growth_factors: growth, sentiment_factors: sentiment,
        composite_score: { total_score: Math.round(composite * 10) / 10, max_score: 100, factor_scores: scores, weights: Object.fromEntries(Object.entries(w).map(([k, v]) => [k, `${v*100}%`])), rating, recommendation },
    };
}

// ===== 8. Vanguard ETFポートフォリオ =====
function analyzeVanguard(params = {}) {
    const age = params.age || 40;
    const amount = params.investment_amount || 1000000;
    const riskProfile = params.risk_profile || 'バランス型';
    const profiles = { '積極型': { stocks: 80, bonds: 10, reit: 10 }, 'やや積極型': { stocks: 65, bonds: 25, reit: 10 }, 'バランス型': { stocks: 50, bonds: 40, reit: 10 }, 'やや保守型': { stocks: 35, bonds: 55, reit: 10 }, '保守型': { stocks: 20, bonds: 70, reit: 10 } };
    const alloc = profiles[riskProfile] || profiles['バランス型'];
    const det = { '日本株式': +(alloc.stocks * 0.40).toFixed(1), '先進国株式': +(alloc.stocks * 0.45).toFixed(1), '新興国株式': +(alloc.stocks * 0.15).toFixed(1), '日本債券': +(alloc.bonds * 0.50).toFixed(1), '外国債券': +(alloc.bonds * 0.50).toFixed(1), '国内REIT': +(alloc.reit * 0.50).toFixed(1), '海外REIT': +(alloc.reit * 0.50).toFixed(1) };
    const etfs = [
        { ticker: '1306.T', name: 'TOPIX連動型上場投信', category: '日本株式', expense_ratio: 0.066 },
        { ticker: '2559.T', name: 'MAXIS 全世界株式', category: '先進国株式', expense_ratio: 0.078 },
        { ticker: '1681.T', name: '上場インデックス海外新興国', category: '新興国株式', expense_ratio: 0.264 },
        { ticker: '2510.T', name: 'NEXT FUNDS 国内債券', category: '日本債券', expense_ratio: 0.077 },
        { ticker: '2511.T', name: 'NEXT FUNDS 外国債券', category: '外国債券', expense_ratio: 0.132 },
        { ticker: '1343.T', name: 'NEXT FUNDS 東証REIT', category: '国内REIT', expense_ratio: 0.155 },
    ].map(e => ({ ...e, allocation_pct: det[e.category] || 0, amount: Math.round(amount * (det[e.category] || 0) / 100) }));
    const expRet = (alloc.stocks / 100 * 0.07 + alloc.bonds / 100 * 0.02 + alloc.reit / 100 * 0.05) * 100;
    const monthly = Math.round(amount / 12);

    return {
        analyzer: 'Vanguard ETFポートフォリオ', risk_profile: riskProfile, suggested_profile: age < 30 ? '積極型' : age < 40 ? 'やや積極型' : age < 50 ? 'バランス型' : age < 60 ? 'やや保守型' : '保守型',
        age, investment_amount: amount, allocation: alloc, detailed_allocation: det, etf_picks: etfs,
        expected_return: { expected_annual_return_pct: Math.round(expRet * 10) / 10, best_year_estimate_pct: Math.round((expRet + 20) * 10) / 10, worst_year_estimate_pct: Math.round((expRet - 25) * 10) / 10, assumptions: { '株式リターン': '年率7%', '債券リターン': '年率2%', 'REITリターン': '年率5%' } },
        rebalance_rules: { frequency: riskProfile.includes('積極') ? '四半期' : '半年', threshold_pct: riskProfile.includes('積極') ? 5 : 3, rules: ['目標配分から乖離した場合にリバランス', '急落時の追加投資はリバランスの好機'] },
        tax_optimization: { nisa_account: { recommended: etfs.filter(e => e.category.includes('株式') || e.category.includes('REIT')).map(e => e.name), reason: '成長資産はNISAで非課税メリットを最大化' }, tokutei_account: { recommended: etfs.filter(e => e.category.includes('債券')).map(e => e.name), reason: '債券は特定口座で管理' }, notes: ['新NISA: 成長投資枠240万円/年、つみたて投資枠120万円/年'] },
        dca_plan: { total_monthly: monthly, allocation: etfs.map(e => ({ etf: e.name, ticker: e.ticker, monthly_amount: Math.round(monthly * e.allocation_pct / 100) })), strategy: '毎月定額積立（ドルコスト平均法）で価格変動リスクを分散' },
    };
}

// ===== 9. McKinsey マクロ経済 =====
async function analyzeMcKinsey() {
    const indicators = {};
    try {
        const nk = await StockFetcher.fetchMarketIndex('^N225', '1y');
        if (nk.length > 0) {
            const c = nk[nk.length - 1].close;
            indicators.nikkei225 = { current: Math.round(c), change_ytd: Math.round(((c / nk[0].close) - 1) * 1000) / 10 };
        }
    } catch {}
    try {
        const fx = await StockFetcher.fetchMarketIndex('USDJPY=X', '1y');
        if (fx.length > 0) { indicators.usdjpy = { current: Math.round(fx[fx.length - 1].close * 100) / 100, change_ytd: Math.round(((fx[fx.length - 1].close / fx[0].close) - 1) * 1000) / 10 }; }
    } catch {}

    const rate = indicators.usdjpy?.current || 150;
    const yenStatus = rate > 150 ? '円安水準' : rate > 130 ? 'やや円安' : rate > 110 ? '適正水準' : '円高水準';
    const sectorRecs = [
        { sector: '銀行・金融', stance: 'オーバーウェイト', reason: '金利上昇で利ざや拡大' },
        { sector: rate > 140 ? '自動車・輸出' : '内需・小売', stance: 'オーバーウェイト', reason: rate > 140 ? '円安メリット' : '円高で輸入コスト低下' },
        { sector: '医薬品', stance: '中立', reason: 'ディフェンシブ' },
        { sector: rate > 140 ? '食品・小売' : '自動車・輸出', stance: 'アンダーウェイト', reason: rate > 140 ? '原材料コスト上昇' : '海外売上目減り' },
    ];

    return {
        analyzer: 'McKinsey マクロ経済レポート', market_indicators: indicators,
        interest_rate_analysis: { us_10y_yield: 4.0, environment: '中程度の金利環境', impact: { growth_stocks: '成長株への影響は限定的', value_stocks: 'バリュー株は安定', real_estate: '不動産セクターはやや逆風' }, outlook: '今後6-12ヶ月の金利動向はFRBの政策次第' },
        currency_analysis: { usdjpy: rate, change_1m_pct: indicators.usdjpy?.change_1m_pct || null, yen_status: yenStatus, impact: rate > 140 ? '輸出企業に追い風' : '内需に追い風', beneficiaries: rate > 140 ? ['自動車', '電子部品'] : ['小売', '食品'], losers: rate > 140 ? ['食品', '小売'] : ['自動車'] },
        sector_recommendation: sectorRecs,
        global_risks: [
            { risk: '地政学リスク', severity: '中〜高', impact: 'サプライチェーン混乱' },
            { risk: '米中関係の悪化', severity: '中', impact: 'テクノロジー規制リスク' },
            { risk: 'インフレ再加速', severity: '中', impact: '金利再上昇→バリュエーション圧縮' },
        ],
        timeline: [{ period: '短期（1-3ヶ月）', focus: '決算シーズン、中央銀行政策会合' }, { period: '中期（3-6ヶ月）', focus: '金利見通し、企業業績' }, { period: '長期（6-12ヶ月）', focus: '経済サイクルの転換点' }],
        portfolio_adjustments: { recommended_actions: sectorRecs.filter(s => s.stance !== '中立').map(s => `${s.sector}: ${s.stance} - ${s.reason}`), overall_stance: '慎重な楽観主義。ポジション維持しつつリスク管理を徹底' },
    };
}

// ===== 10. Morgan Stanley DCF =====
function analyzeMorganDCF(data) {
    const { info, incomeStatements, cashflows } = data;
    const currentPrice = info.currentPrice || 0;
    const shares = info.sharesOutstanding || 0;

    // 収益予測
    let baseRev = info.totalRevenue || (incomeStatements[0]?.totalRevenue) || 0;
    let baseGrowth = info.revenueGrowth || 0.05;
    if (baseGrowth > 1) baseGrowth /= 100;
    const projYearly = [];
    let rev = baseRev;
    for (let i = 0; i < 5; i++) {
        const rate = Math.max(baseGrowth * (1 - i * 0.1), 0.02);
        rev *= (1 + rate);
        projYearly.push({ year: 2025 + i, revenue: Math.round(rev), growth_rate_pct: Math.round(rate * 1000) / 10 });
    }

    // FCFマージン
    let fcfMargin = 0.08;
    if (cashflows.length > 0 && incomeStatements.length > 0 && incomeStatements[0].totalRevenue > 0) {
        fcfMargin = Math.max(cashflows[0].freeCashflow / incomeStatements[0].totalRevenue, 0.03);
    } else if (info.operatingMargins) {
        fcfMargin = Math.max(info.operatingMargins * 0.7, 0.03);
    }
    const fcfYearly = projYearly.map(p => ({ year: p.year, fcf: Math.round(p.revenue * fcfMargin), fcf_margin_pct: Math.round(fcfMargin * 1000) / 10 }));

    // WACC
    const beta = info.beta || 1.0;
    const rfr = 0.01;
    const erp = 0.06;
    const coe = rfr + beta * erp;
    let de = info.debtToEquity || 30;
    if (de > 10) de /= 100;
    const eqW = 1 / (1 + de);
    const dW = de / (1 + de);
    const wacc = eqW * coe + dW * 0.015 * 0.7;

    // ターミナルバリュー
    const lastFCF = fcfYearly[fcfYearly.length - 1]?.fcf || 0;
    const tg = 0.015;
    const tvPerp = wacc > tg ? lastFCF * (1 + tg) / (wacc - tg) : lastFCF * 20;

    // PV計算
    let totalPV = 0;
    const pvFcfs = fcfYearly.map((f, i) => { const pv = f.fcf / Math.pow(1 + wacc, i + 1); totalPV += pv; return { year: f.year, fcf: f.fcf, pv: Math.round(pv) }; });
    const pvTV = tvPerp / Math.pow(1 + wacc, 5);
    const netDebt = (info.totalDebt || 0) - (info.totalCash || 0);
    const ev = totalPV + pvTV;
    const equity = ev - netDebt;
    const perShare = shares > 0 ? equity / shares : 0;

    // 感度テーブル
    const waccRange = [wacc - 0.02, wacc - 0.01, wacc, wacc + 0.01, wacc + 0.02];
    const gRange = [0.005, 0.01, 0.015, 0.02, 0.025];
    const table = waccRange.map(w => {
        const row = { wacc_pct: Math.round(w * 1000) / 10 };
        gRange.forEach(g => {
            let tpv = 0;
            fcfYearly.forEach((f, i) => { tpv += f.fcf / Math.pow(1 + w, i + 1); });
            const tv = w > g ? lastFCF * (1 + g) / (w - g) : lastFCF * 20;
            const ptvv = tv / Math.pow(1 + w, 5);
            const eq = tpv + ptvv - netDebt;
            row[`g_${(g * 100).toFixed(1)}%`] = Math.round(shares > 0 ? eq / shares : 0);
        });
        return row;
    });

    const upside = currentPrice > 0 ? ((perShare / currentPrice) - 1) * 100 : 0;
    let verdict, recommendation;
    if (upside > 30) { verdict = '大幅に割安'; recommendation = '強い買い推奨'; }
    else if (upside > 10) { verdict = '割安'; recommendation = '買い推奨'; }
    else if (upside > -10) { verdict = '適正価格'; recommendation = '保持'; }
    else if (upside > -20) { verdict = 'やや割高'; recommendation = '利益確定検討'; }
    else { verdict = '割高'; recommendation = '売り推奨'; }

    return {
        analyzer: 'Morgan Stanley DCFバリュエーション', company_name: info.longName, ticker: info.ticker, current_price: currentPrice, shares_outstanding: shares, market_cap: info.marketCap,
        projections: { base_revenue: baseRev, growth_assumption: `初年度${(baseGrowth * 100).toFixed(1)}%から逓減`, yearly: projYearly },
        fcf_projections: { fcf_margin_assumption: Math.round(fcfMargin * 1000) / 10, yearly: fcfYearly },
        wacc: { wacc_pct: Math.round(wacc * 10000) / 100, cost_of_equity_pct: Math.round(coe * 10000) / 100, cost_of_debt_pct: 1.5, beta: Math.round(beta * 100) / 100, risk_free_rate_pct: 1, equity_risk_premium_pct: 6, debt_equity_ratio: Math.round(de * 100) / 100, tax_rate_pct: 30 },
        terminal_value: { perpetuity_growth: { terminal_value: Math.round(tvPerp), growth_rate_pct: 1.5, method: '永続成長モデル' }, exit_multiple: { terminal_value: Math.round(lastFCF * 10 / 0.7), multiple: 10, method: 'EV/EBITDA 10x出口マルチプル' } },
        valuation: { pv_fcfs: pvFcfs, total_pv_fcf: Math.round(totalPV), pv_terminal_perpetuity: Math.round(pvTV), pv_terminal_multiple: Math.round(lastFCF * 10 / 0.7 / Math.pow(1 + wacc, 5)), enterprise_value_perpetuity: Math.round(ev), net_debt: Math.round(netDebt), equity_value_perpetuity: Math.round(equity), per_share_perpetuity: Math.round(perShare), per_share_multiple: Math.round(perShare), per_share_average: Math.round(perShare) },
        sensitivity: { table, wacc_range: waccRange.map(w => `${(w * 100).toFixed(1)}%`), growth_range: gRange.map(g => `${(g * 100).toFixed(1)}%`), note: 'WACC（横軸）と永続成長率（縦軸）の組み合わせによる理論価値' },
        verdict: { verdict, recommendation, fair_value: Math.round(perShare), current_price: Math.round(currentPrice), upside_pct: Math.round(upside * 10) / 10 },
    };
}

// エクスポート
window.Analyzers = {
    goldman: analyzeGoldman,
    morgan_technical: analyzeMorganTechnical,
    bridgewater: analyzeBridgewater,
    jpmorgan: analyzeJPMorgan,
    blackrock: analyzeBlackRock,
    citadel: analyzeCitadel,
    renaissance: analyzeRenaissance,
    vanguard: analyzeVanguard,
    mckinsey: analyzeMcKinsey,
    morgan_dcf: analyzeMorganDCF,
};
