/**
 * GSSS - 分析結果レンダラー
 */

function renderAnalysis(type, data, info) {
    const header = `
        <div class="bg-gs-card border border-gs-border rounded-xl p-6 mb-6">
            <div class="flex items-center gap-3 mb-2">
                <span class="text-3xl">${info.icon}</span>
                <div>
                    <h2 class="text-white font-bold text-xl">${info.name}</h2>
                    ${data.company_name ? `<p class="text-gs-text/70">${data.company_name} (${data.ticker})</p>` : ''}
                </div>
            </div>
            ${data.current_price ? `<div class="mt-3 text-2xl text-white font-bold">¥${formatNumber(data.current_price)}</div>` : ''}
        </div>
    `;

    let content = '';
    switch (type) {
        case 'goldman': content = renderGoldman(data); break;
        case 'morgan_technical': content = renderMorganTechnical(data); break;
        case 'bridgewater': content = renderBridgewater(data); break;
        case 'jpmorgan': content = renderJPMorgan(data); break;
        case 'blackrock': content = renderBlackRock(data); break;
        case 'citadel': content = renderCitadel(data); break;
        case 'renaissance': content = renderRenaissance(data); break;
        case 'vanguard': content = renderVanguard(data); break;
        case 'mckinsey': content = renderMcKinsey(data); break;
        case 'morgan_dcf': content = renderMorganDCF(data); break;
        default: content = `<pre class="text-xs overflow-auto">${JSON.stringify(data, null, 2)}</pre>`;
    }

    return header + content;
}

// === カードヘルパー ===
function card(title, body) {
    return `<div class="bg-gs-card border border-gs-border rounded-xl p-5 mb-4 fade-in"><h3 class="text-white font-semibold mb-3 text-sm border-b border-gs-border pb-2">${title}</h3>${body}</div>`;
}

function metric(label, value, sub = '') {
    return `<div class="py-2 flex justify-between items-center border-b border-gs-border/50 last:border-0"><span class="text-gs-text/70 text-sm">${label}</span><div class="text-right"><span class="text-white font-medium">${value}</span>${sub ? `<span class="text-gs-text/50 text-xs ml-1">${sub}</span>` : ''}</div></div>`;
}

function badge(text, color = 'gs-accent') {
    const colors = { green: 'bg-green-900/40 text-green-400', red: 'bg-red-900/40 text-red-400', yellow: 'bg-yellow-900/40 text-yellow-400', orange: 'bg-orange-900/40 text-orange-400', 'gs-accent': 'bg-gs-navy/50 text-gs-accent' };
    return `<span class="text-xs px-2 py-0.5 rounded ${colors[color] || colors['gs-accent']}">${text}</span>`;
}

function scoreBar(score, max, label = '') {
    const pct = Math.min((score / max) * 100, 100);
    const color = scoreColor(score, max);
    return `<div class="mb-2"><div class="flex justify-between text-xs mb-1"><span class="text-gs-text/70">${label}</span><span class="text-white">${score}/${max}</span></div><div class="w-full bg-gs-dark rounded-full h-2"><div class="${color} h-2 rounded-full score-bar" style="width:${pct}%"></div></div></div>`;
}

// === Goldman Sachs ===
function renderGoldman(d) {
    let html = '<div class="grid grid-cols-1 lg:grid-cols-2 gap-4">';

    // P/E分析
    const pe = d.pe_analysis || {};
    html += card('P/E比率分析', `
        ${metric('現在PER', pe.current_pe ? pe.current_pe + '倍' : 'N/A')}
        ${metric('フォワードPER', pe.forward_pe ? pe.forward_pe + '倍' : 'N/A')}
        ${metric('評価', pe.assessment || 'N/A')}
        ${scoreBar(pe.score || 5, 10, 'バリュエーション')}
    `);

    // 負債分析
    const debt = d.debt_analysis || {};
    html += card('負債健全性チェック', `
        ${metric('D/Eレシオ', debt.debt_to_equity !== null ? debt.debt_to_equity + '倍' : 'N/A')}
        ${metric('総負債', formatCurrency(debt.total_debt))}
        ${metric('手元現金', formatCurrency(debt.total_cash))}
        ${metric('健全性', debt.health || 'N/A')}
        ${scoreBar(debt.score || 5, 10, '財務健全性')}
    `);

    // 配当分析
    const div = d.dividend_analysis || {};
    html += card('配当分析', `
        ${metric('配当利回り', div.yield_pct ? div.yield_pct + '%' : '0%')}
        ${metric('年間配当', div.annual_rate ? '¥' + formatNumber(div.annual_rate) : 'N/A')}
        ${metric('配当性向', div.payout_ratio_pct ? div.payout_ratio_pct + '%' : 'N/A')}
        ${metric('持続可能性', div.sustainability || 'N/A')}
        ${scoreBar(div.score || 5, 10, '配当安全性')}
    `);

    // 競争優位性
    const moat = d.moat_rating || {};
    html += card('競争優位性（モート）', `
        <div class="text-center mb-3">
            <span class="text-2xl text-white font-bold">${moat.rating || 'N/A'}</span>
        </div>
        ${scoreBar(moat.score || 0, moat.max_score || 11, 'モートスコア')}
        <div class="mt-3 space-y-1">
            ${(moat.reasons || []).map(r => `<div class="text-xs text-gs-text/70">• ${r}</div>`).join('')}
        </div>
    `);

    // 価格ターゲット
    const pt = d.price_targets || {};
    html += card('12ヶ月価格ターゲット', `
        ${metric('強気ケース', pt.bull_target ? '¥' + formatNumber(pt.bull_target) : 'N/A', pt.upside_pct ? formatPercent(pt.upside_pct) : '')}
        ${metric('ベースケース', pt.base_target ? '¥' + formatNumber(pt.base_target) : 'N/A')}
        ${metric('弱気ケース', pt.bear_target ? '¥' + formatNumber(pt.bear_target) : 'N/A', pt.downside_pct ? formatPercent(pt.downside_pct) : '')}
        ${pt.estimated ? '<div class="text-xs text-gs-text/50 mt-2">※推定値（アナリスト目標価格なし）</div>' : ''}
    `);

    // リスク評価
    const risk = d.risk_rating || {};
    html += card('リスク評価', `
        <div class="text-center mb-3">
            <span class="text-4xl font-bold ${riskColor(risk.score || 5)}">${risk.score || 'N/A'}</span>
            <span class="text-gs-text/50">/10</span>
        </div>
        <div class="space-y-1">
            ${(risk.reasons || []).map(r => `<div class="text-xs text-gs-text/70">• ${r}</div>`).join('')}
        </div>
    `);

    // エントリーゾーン
    const ez = d.entry_zones || {};
    html += card('エントリー価格ゾーン', `
        ${metric('積極的エントリー', ez.aggressive_entry ? '¥' + formatNumber(ez.aggressive_entry) : 'N/A')}
        ${metric('理想的エントリー', ez.ideal_entry ? '¥' + formatNumber(ez.ideal_entry) : 'N/A')}
        ${metric('保守的エントリー', ez.conservative_entry ? '¥' + formatNumber(ez.conservative_entry) : 'N/A')}
        ${metric('ストップロス', ez.stop_loss ? '¥' + formatNumber(ez.stop_loss) : 'N/A', ez.stop_loss_pct ? ez.stop_loss_pct + '%' : '')}
        ${metric('サポートライン', ez.support ? '¥' + formatNumber(ez.support) : 'N/A')}
        ${metric('レジスタンスライン', ez.resistance ? '¥' + formatNumber(ez.resistance) : 'N/A')}
    `);

    // 収益成長
    const rev = d.revenue_growth || {};
    html += card('収益成長トレンド', `
        ${metric('トレンド', rev.trend || 'N/A')}
        ${(rev.growth_rates || []).map((r, i) => metric(rev.years?.[i] || '', formatPercent(r))).join('')}
    `);

    html += '</div>';

    // サマリー
    if (d.summary) {
        html += `<div class="bg-gs-navy/40 border border-gs-border rounded-xl p-5 mt-4"><p class="text-white">${d.summary}</p></div>`;
    }

    return html;
}

// === Morgan Stanley Technical ===
function renderMorganTechnical(d) {
    let html = '';

    // トレードセットアップ（トップ）
    const ts = d.trade_setup || {};
    if (ts.entry) {
        html += `<div class="bg-gs-navy/60 border border-gs-accent/30 rounded-xl p-5 mb-6">
            <h3 class="text-gs-accent font-bold mb-3">トレードセットアップ</h3>
            <div class="grid grid-cols-2 md:grid-cols-5 gap-4 text-center">
                <div><div class="text-xs text-gs-text/60">方向</div><div class="text-white font-bold text-lg">${ts.direction}</div></div>
                <div><div class="text-xs text-gs-text/60">エントリー</div><div class="text-white font-bold">¥${formatNumber(ts.entry)}</div></div>
                <div><div class="text-xs text-gs-text/60">ストップロス</div><div class="text-red-400 font-bold">¥${formatNumber(ts.stop_loss)}</div></div>
                <div><div class="text-xs text-gs-text/60">利確目標1</div><div class="text-green-400 font-bold">¥${formatNumber(ts.target_1)}</div></div>
                <div><div class="text-xs text-gs-text/60">R/R比率</div><div class="text-gs-gold font-bold">${ts.risk_reward_ratio}</div></div>
            </div>
        </div>`;
    }

    html += '<div class="grid grid-cols-1 lg:grid-cols-2 gap-4">';

    // トレンド
    const tr = d.trend || {};
    html += card('トレンド分析', `
        ${metric('主要トレンド', tr.primary || 'N/A')}
        ${metric('日足トレンド', tr.daily || 'N/A')}
        ${metric('週足トレンド', tr.weekly || 'N/A')}
        ${metric('月足トレンド', tr.monthly || 'N/A')}
        ${tr.crossover ? metric('クロスオーバー', tr.crossover) : ''}
    `);

    // RSI
    const rsi = d.rsi_analysis || {};
    html += card('RSI (14日)', `
        <div class="text-center mb-3">
            <span class="text-3xl font-bold text-white">${rsi.value || 'N/A'}</span>
        </div>
        ${metric('判定', rsi.interpretation || 'N/A')}
        ${metric('シグナル', rsi.signal || 'N/A')}
    `);

    // 移動平均
    const ma = d.ma_analysis || {};
    html += card('移動平均分析', `
        ${metric('総合判定', ma.overall || 'N/A')}
        ${Object.entries(ma.moving_averages || {}).map(([k, v]) => metric(k + '移動平均', '¥' + formatNumber(v.value), v.position === '上' ? '↑上' : '↓下')).join('')}
    `);

    // MACD
    const macd = d.macd_analysis || {};
    html += card('MACD分析', `
        ${metric('MACD', macd.macd !== undefined ? macd.macd : 'N/A')}
        ${metric('シグナル', macd.signal !== undefined ? macd.signal : 'N/A')}
        ${metric('ヒストグラム', macd.histogram !== undefined ? macd.histogram : 'N/A')}
        ${metric('クロスオーバー', macd.crossover || 'N/A')}
        ${metric('モメンタム', macd.momentum || 'N/A')}
    `);

    // ボリンジャーバンド
    const bb = d.bb_analysis || {};
    html += card('ボリンジャーバンド', `
        ${metric('上限バンド', bb.upper ? '¥' + formatNumber(bb.upper) : 'N/A')}
        ${metric('中央線', bb.middle ? '¥' + formatNumber(bb.middle) : 'N/A')}
        ${metric('下限バンド', bb.lower ? '¥' + formatNumber(bb.lower) : 'N/A')}
        ${metric('ポジション', bb.position || 'N/A')}
        ${metric('バンド幅', bb.squeeze_status || 'N/A')}
    `);

    // 出来高
    const vol = d.volume_analysis || {};
    html += card('出来高分析', `
        ${metric('現在の出来高', vol.current_volume ? formatNumber(vol.current_volume) : 'N/A')}
        ${metric('20日平均', vol.avg_volume_20d ? formatNumber(vol.avg_volume_20d) : 'N/A')}
        ${metric('出来高比率', vol.ratio ? vol.ratio + 'x' : 'N/A')}
        ${metric('判定', vol.interpretation || 'N/A')}
    `);

    // フィボナッチ
    const fib = d.fibonacci || {};
    if (fib.high) {
        html += card('フィボナッチリトレースメント', `
            ${metric('高値', '¥' + formatNumber(fib.high))}
            ${metric('23.6%', '¥' + formatNumber(fib.level_236))}
            ${metric('38.2%', '¥' + formatNumber(fib.level_382))}
            ${metric('50.0%', '¥' + formatNumber(fib.level_500))}
            ${metric('61.8%', '¥' + formatNumber(fib.level_618))}
            ${metric('安値', '¥' + formatNumber(fib.low))}
        `);
    }

    // パターン
    const pat = d.pattern || {};
    html += card('チャートパターン', `
        ${metric('パターン', pat.pattern || 'N/A')}
        ${metric('説明', pat.description || 'N/A')}
        ${pat.signal ? metric('シグナル', pat.signal) : ''}
    `);

    html += '</div>';
    return html;
}

// === Bridgewater Risk ===
function renderBridgewater(d) {
    let html = '';

    // リスクダッシュボード
    const dash = d.risk_dashboard || {};
    if (dash.metrics) {
        html += `<div class="bg-gs-navy/60 border border-gs-accent/30 rounded-xl p-5 mb-6">
            <div class="flex justify-between items-center mb-4">
                <h3 class="text-gs-accent font-bold">リスクダッシュボード</h3>
                <div><span class="text-2xl font-bold ${riskColor(dash.total_risk_score || 5)}">${dash.total_risk_score}/10</span>
                <span class="text-gs-text/60 text-sm ml-2">${dash.overall_risk}</span></div>
            </div>
            <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
                ${Object.entries(dash.metrics).map(([k, v]) => `
                    <div class="text-center p-3 bg-gs-dark/50 rounded-lg">
                        <div class="text-xs text-gs-text/60 mb-1">${k}</div>
                        <div class="text-xl font-bold text-${v.color}-400">${v.score}/10</div>
                        <div class="text-xs text-gs-text/50">${v.label}</div>
                    </div>
                `).join('')}
            </div>
        </div>`;
    }

    html += '<div class="grid grid-cols-1 lg:grid-cols-2 gap-4">';

    // ボラティリティ
    const vol = d.volatility || {};
    html += card('ボラティリティプロファイル', `
        ${metric('日次ボラティリティ', vol.daily_pct ? vol.daily_pct + '%' : 'N/A')}
        ${metric('年間ボラティリティ', vol.annual_pct ? vol.annual_pct + '%' : 'N/A')}
        ${metric('リスクレベル', vol.level || 'N/A')}
        ${metric('95%VaR（日次）', vol.percentile_95_daily_loss ? vol.percentile_95_daily_loss + '%' : 'N/A')}
    `);

    // ベータ
    const beta = d.beta_analysis || {};
    html += card('ベータ分析（対日経225）', `
        ${metric('ベータ', beta.beta !== null ? beta.beta : 'N/A')}
        ${metric('上昇時ベータ', beta.up_beta !== undefined ? beta.up_beta : 'N/A')}
        ${metric('下降時ベータ', beta.down_beta !== undefined ? beta.down_beta : 'N/A')}
        ${metric('相関係数', beta.correlation !== undefined ? beta.correlation : 'N/A')}
        ${metric('解釈', beta.interpretation || 'N/A')}
    `);

    // ドローダウン
    const dd = d.drawdown || {};
    html += card('最大ドローダウン', `
        ${metric('最大ドローダウン', dd.max_drawdown_pct ? dd.max_drawdown_pct + '%' : 'N/A')}
        ${metric('発生日', dd.max_drawdown_date || 'N/A')}
        ${metric('回復期間', dd.recovery_days !== undefined ? dd.recovery_days + (typeof dd.recovery_days === 'number' ? '日' : '') : 'N/A')}
    `);

    // ストレステスト
    const st = d.stress_test || {};
    if (st.scenarios) {
        let stBody = metric('現在価格', '¥' + formatNumber(st.current_price));
        for (const [name, scenario] of Object.entries(st.scenarios)) {
            stBody += metric(name, '¥' + formatNumber(scenario.estimated_price), scenario.loss_pct + '%');
        }
        html += card('リセッションストレステスト', stBody);
    }

    // 金利感応度
    const ir = d.interest_sensitivity || {};
    html += card('金利感応度', `
        ${metric('感応度レベル', ir.level || 'N/A')}
        ${metric('影響', ir.impact || 'N/A')}
    `);

    // 流動性
    const liq = d.liquidity || {};
    html += card('流動性リスク', `
        ${metric('平均日次出来高', liq.avg_daily_volume ? formatNumber(liq.avg_daily_volume) : 'N/A')}
        ${metric('流動性レベル', liq.liquidity_level || 'N/A')}
        ${metric('ビッドアスクスプレッド', liq.bid_ask_spread_pct ? liq.bid_ask_spread_pct + '%' : 'N/A')}
    `);

    // ヘッジ提案
    const hedge = d.hedge_recommendation || {};
    html += card('ヘッジ推奨', `
        ${(hedge.strategies || []).map(s => `<div class="py-2 text-sm border-b border-gs-border/50 last:border-0">${s}</div>`).join('')}
    `);

    html += '</div>';
    return html;
}

// === JPMorgan Earnings ===
function renderJPMorgan(d) {
    let html = '<div class="grid grid-cols-1 lg:grid-cols-2 gap-4">';

    // 決算履歴
    const eh = d.earnings_history || {};
    let ehBody = `<p class="text-sm text-gs-text/70 mb-3">${eh.summary || ''}</p>`;
    if (eh.quarters && eh.quarters.length > 0) {
        ehBody += '<div class="overflow-x-auto"><table class="w-full text-xs"><thead><tr class="text-gs-text/50 border-b border-gs-border"><th class="py-1 text-left">日付</th><th class="text-right">予想EPS</th><th class="text-right">実績EPS</th><th class="text-right">サプライズ</th></tr></thead><tbody>';
        eh.quarters.forEach(q => {
            const color = q.beat === true ? 'text-green-400' : q.beat === false ? 'text-red-400' : 'text-gs-text';
            ehBody += `<tr class="border-b border-gs-border/30 ${color}"><td class="py-1">${q.date}</td><td class="text-right">${q.eps_estimate ?? 'N/A'}</td><td class="text-right">${q.eps_actual ?? 'N/A'}</td><td class="text-right">${q.surprise_pct ? q.surprise_pct + '%' : 'N/A'}</td></tr>`;
        });
        ehBody += '</tbody></table></div>';
    }
    html += card('決算履歴', ehBody);

    // コンセンサス
    const con = d.consensus || {};
    html += card('コンセンサス予想', `
        ${metric('フォワードEPS', con.forward_eps ?? 'N/A')}
        ${metric('トレイリングEPS', con.trailing_eps ?? 'N/A')}
        ${metric('フォワードPE', con.forward_pe ? con.forward_pe.toFixed(1) + '倍' : 'N/A')}
        ${metric('PEGレシオ', con.peg_ratio ?? 'N/A')}
        ${metric('EPS成長率', con.earnings_growth ? formatPercent(con.earnings_growth * 100) : 'N/A')}
        ${metric('売上成長率', con.revenue_growth ? formatPercent(con.revenue_growth * 100) : 'N/A')}
        ${metric('アナリスト推奨', con.recommendation || 'N/A')}
        ${metric('アナリスト数', con.num_analysts ?? 'N/A')}
    `);

    // 注目指標
    const km = d.key_metrics || [];
    html += card('注目すべき指標', `
        ${km.map(m => metric(m.name, m.value, badge(m.importance, m.importance === '高' ? 'red' : 'yellow'))).join('')}
    `);

    // インプライドムーブ
    const im = d.implied_move || {};
    html += card('決算日の想定値動き', `
        ${metric('推定変動幅', im.estimated_move_pct ? '±' + im.estimated_move_pct + '%' : 'N/A')}
        ${metric('過去の大きな値動き（平均）', im.avg_large_move_pct ? im.avg_large_move_pct + '%' : 'N/A')}
        ${metric('最大単日変動', im.max_single_day_move_pct ? im.max_single_day_move_pct + '%' : 'N/A')}
    `);

    // ポジション戦略
    const pos = d.positioning || {};
    if (pos.strategies) {
        let posBody = '';
        pos.strategies.forEach(s => {
            const actionColor = s.action.includes('買い') ? 'green' : s.action.includes('売り') ? 'red' : 'yellow';
            posBody += `<div class="py-3 border-b border-gs-border/50 last:border-0">
                <div class="flex items-center gap-2 mb-1">${badge(s.timing)} ${badge(s.action, actionColor)}</div>
                <p class="text-xs text-gs-text/70">${s.reason}</p>
            </div>`;
        });
        html += card('ポジション戦略', posBody);
    }

    html += '</div>';
    return html;
}

// === BlackRock Dividend ===
function renderBlackRock(d) {
    let html = '<div class="grid grid-cols-1 lg:grid-cols-2 gap-4">';

    // 配当利回り
    const ya = d.yield_analysis || {};
    html += card('配当利回り分析', `
        ${metric('現在利回り', ya.current_yield_pct ? ya.current_yield_pct + '%' : '0%')}
        ${metric('5年平均利回り', ya.five_year_avg_yield ? ya.five_year_avg_yield + '%' : 'N/A')}
        ${metric('年間配当', ya.dividend_rate ? '¥' + formatNumber(ya.dividend_rate) : 'N/A')}
        ${metric('評価', ya.assessment || 'N/A')}
    `);

    // 配当安全性
    const sf = d.safety || {};
    html += card('配当安全性スコア', `
        <div class="text-center mb-3">
            <span class="text-4xl font-bold ${sf.score >= 7 ? 'text-green-400' : sf.score >= 5 ? 'text-yellow-400' : 'text-red-400'}">${sf.score}</span>
            <span class="text-gs-text/50">/10</span>
            <div class="text-sm mt-1 ${sf.score >= 7 ? 'text-green-400' : sf.score >= 5 ? 'text-yellow-400' : 'text-red-400'}">${sf.label}</div>
        </div>
        ${scoreBar(sf.score || 0, 10, '安全性')}
        ${(sf.reasons || []).map(r => `<div class="text-xs text-gs-text/70 py-1">• ${r}</div>`).join('')}
    `);

    // 増配履歴
    const ga = d.growth_analysis || {};
    html += card('配当成長履歴', `
        ${metric('連続増配年数', ga.consecutive_increases + '年')}
        ${metric('CAGR', ga.cagr_pct ? ga.cagr_pct + '%' : 'N/A')}
        ${metric('ステータス', ga.status || 'N/A')}
        ${Object.entries(ga.annual_dividends || {}).map(([y, v]) => metric(y + '年', '¥' + formatNumber(v, 2))).join('')}
    `);

    // インカムプロジェクション
    const ip = d.income_projection || {};
    html += card('配当収入予測', `
        ${metric('投資金額', formatCurrency(d.investment_amount))}
        ${metric('初年度配当収入', formatCurrency(ip.initial_annual_income))}
        ${metric('10年後配当収入', formatCurrency(ip.year_10_income))}
        ${metric('20年後配当収入', formatCurrency(ip.year_20_income))}
        ${metric('想定成長率', ip.assumed_growth_rate_pct ? ip.assumed_growth_rate_pct + '%/年' : 'N/A')}
    `);

    // DRIP
    const drip = d.drip || {};
    if (drip.year_10) {
        html += card('DRIP再投資シミュレーション', `
            ${metric('初期株数', drip.initial_shares ? drip.initial_shares + '株' : 'N/A')}
            ${metric('10年後株数', drip.year_10.shares + '株')}
            ${metric('10年後評価額', formatCurrency(drip.year_10.total_value))}
            ${metric('10年後累計配当', formatCurrency(drip.year_10.cumulative_dividends))}
            ${drip.year_20 ? metric('20年後評価額', formatCurrency(drip.year_20.total_value)) : ''}
            ${metric('20年間トータルリターン', drip.total_return_20y ? '+' + drip.total_return_20y + '%' : 'N/A')}
            <div class="text-xs text-gs-text/50 mt-2">前提: ${drip.assumptions ? drip.assumptions.price_growth + ' / 配当' + drip.assumptions.dividend_growth : ''}</div>
        `);
    }

    // イールドトラップ
    const yt = d.yield_trap || {};
    html += card('イールドトラップチェック', `
        <div class="mb-2">${yt.is_potential_trap ? badge('要注意', 'red') : badge('問題なし', 'green')}</div>
        ${(yt.warnings || []).map(w => `<div class="text-xs py-1 ${yt.is_potential_trap ? 'text-red-400' : 'text-gs-text/70'}">• ${w}</div>`).join('')}
    `);

    // 配当落ち日
    const ex = d.ex_dividend || {};
    html += card('配当落ち日', `
        ${metric('次回配当落ち日', ex.ex_dividend_date || '未定')}
        ${metric('配当額', ex.dividend_rate ? '¥' + formatNumber(ex.dividend_rate) : 'N/A')}
        <div class="text-xs text-gs-text/50 mt-2">${ex.note || ''}</div>
    `);

    html += '</div>';
    return html;
}

// === Citadel Sector ===
function renderCitadel(d) {
    let html = '';

    // 経済サイクル
    const cycle = d.economic_cycle || {};
    html += `<div class="bg-gs-navy/60 border border-gs-accent/30 rounded-xl p-5 mb-6">
        <h3 class="text-gs-accent font-bold mb-2">経済サイクル: ${cycle.phase || 'N/A'}</h3>
        <p class="text-sm text-gs-text/70 mb-3">${cycle.description || ''}</p>
        <div class="grid grid-cols-2 gap-4 text-sm">
            <div>${metric('日経平均', cycle.nikkei_current ? '¥' + formatNumber(cycle.nikkei_current) : 'N/A')}</div>
            <div>${metric('200日移動平均', cycle.nikkei_sma200 ? '¥' + formatNumber(cycle.nikkei_sma200) : 'N/A')}</div>
        </div>
    </div>`;

    html += '<div class="grid grid-cols-1 lg:grid-cols-2 gap-4">';

    // セクターパフォーマンス
    const sp = d.sector_performance || [];
    if (sp.length > 0) {
        let spBody = '<div class="overflow-x-auto"><table class="w-full text-xs"><thead><tr class="text-gs-text/50 border-b border-gs-border"><th class="py-1 text-left">セクター</th><th class="text-right">1ヶ月</th><th class="text-right">3ヶ月</th><th class="text-right">6ヶ月</th></tr></thead><tbody>';
        sp.forEach(s => {
            spBody += `<tr class="border-b border-gs-border/30"><td class="py-1">${s.sector}</td><td class="text-right ${s.return_1m > 0 ? 'text-green-400' : 'text-red-400'}">${s.return_1m !== null ? formatPercent(s.return_1m) : 'N/A'}</td><td class="text-right ${s.return_3m > 0 ? 'text-green-400' : 'text-red-400'}">${s.return_3m !== null ? formatPercent(s.return_3m) : 'N/A'}</td><td class="text-right ${s.return_6m > 0 ? 'text-green-400' : 'text-red-400'}">${formatPercent(s.return_6m)}</td></tr>`;
        });
        spBody += '</tbody></table></div>';
        html += card('セクターパフォーマンスランキング', spBody);
    }

    // ローテーション推奨
    const rot = d.rotation_recommendation || {};
    let rotBody = `<p class="text-sm mb-3">ポジショニング: ${badge(rot.positioning || 'N/A', rot.positioning === 'リスクオン' ? 'green' : 'yellow')}</p>`;
    rotBody += '<div class="mb-3"><h4 class="text-xs text-green-400 mb-1 font-medium">オーバーウェイト</h4>';
    (rot.overweight || []).forEach(o => { rotBody += `<div class="text-xs py-1 border-b border-gs-border/30">${o.sector} - ${o.reason} ${badge(o.conviction)}</div>`; });
    rotBody += '</div><div><h4 class="text-xs text-red-400 mb-1 font-medium">アンダーウェイト</h4>';
    (rot.underweight || []).forEach(o => { rotBody += `<div class="text-xs py-1 border-b border-gs-border/30">${o.sector} - ${o.reason}</div>`; });
    rotBody += '</div>';
    html += card('セクターローテーション推奨', rotBody);

    // モデルアロケーション
    const alloc = d.model_allocation || {};
    html += card('モデルアロケーション', `
        ${Object.entries(alloc.allocation || {}).map(([k, v]) => `
            <div class="mb-2">
                <div class="flex justify-between text-xs mb-1"><span>${k}</span><span>${v}%</span></div>
                <div class="w-full bg-gs-dark rounded-full h-2"><div class="bg-gs-accent h-2 rounded-full" style="width:${v}%"></div></div>
            </div>
        `).join('')}
        <div class="text-xs text-gs-text/50 mt-3">${alloc.note || ''}</div>
    `);

    html += '</div>';
    return html;
}

// === Renaissance Quant ===
function renderRenaissance(d) {
    let html = '';

    // コンポジットスコア
    const cs = d.composite_score || {};
    html += `<div class="bg-gs-navy/60 border border-gs-accent/30 rounded-xl p-5 mb-6">
        <div class="flex justify-between items-center mb-4">
            <h3 class="text-gs-accent font-bold">複合スコア</h3>
            <div><span class="text-4xl font-bold text-white">${cs.total_score || 'N/A'}</span><span class="text-gs-text/50">/100</span></div>
        </div>
        <div class="text-center mb-4">
            <span class="text-lg font-semibold ${cs.total_score >= 60 ? 'text-green-400' : cs.total_score >= 40 ? 'text-yellow-400' : 'text-red-400'}">${cs.rating || ''} - ${cs.recommendation || ''}</span>
        </div>
        <div class="grid grid-cols-5 gap-2">
            ${Object.entries(cs.factor_scores || {}).map(([k, v]) => `
                <div class="text-center p-2 bg-gs-dark/50 rounded">
                    <div class="text-xs text-gs-text/60 mb-1">${k}</div>
                    <div class="text-lg font-bold text-white">${v}</div>
                    <div class="text-xs text-gs-text/50">${cs.weights?.[k] || ''}</div>
                </div>
            `).join('')}
        </div>
    </div>`;

    html += '<div class="grid grid-cols-1 lg:grid-cols-2 gap-4">';

    // 各ファクター
    const factors = [
        { key: 'value_factors', name: 'バリューファクター' },
        { key: 'quality_factors', name: 'クオリティファクター' },
        { key: 'momentum_factors', name: 'モメンタムファクター' },
        { key: 'growth_factors', name: '成長ファクター' },
        { key: 'sentiment_factors', name: 'センチメントファクター' },
    ];

    factors.forEach(f => {
        const fData = d[f.key] || {};
        html += card(`${f.name} (${fData.score || 0}/100)`, `
            ${scoreBar(fData.score || 0, 100, f.name)}
            ${(fData.details || []).map(detail => `<div class="text-xs text-gs-text/70 py-1">• ${detail}</div>`).join('')}
        `);
    });

    html += '</div>';
    return html;
}

// === Vanguard ETF ===
function renderVanguard(d) {
    let html = '';

    // プロファイル
    html += `<div class="bg-gs-navy/60 border border-gs-accent/30 rounded-xl p-5 mb-6">
        <div class="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
            <div><div class="text-xs text-gs-text/60">リスクプロファイル</div><div class="text-white font-bold text-lg">${d.risk_profile}</div></div>
            <div><div class="text-xs text-gs-text/60">投資金額</div><div class="text-white font-bold">${formatCurrency(d.investment_amount)}</div></div>
            <div><div class="text-xs text-gs-text/60">年齢</div><div class="text-white font-bold">${d.age}歳</div></div>
            <div><div class="text-xs text-gs-text/60">期待リターン</div><div class="text-green-400 font-bold">${d.expected_return?.expected_annual_return_pct}%/年</div></div>
        </div>
    </div>`;

    html += '<div class="grid grid-cols-1 lg:grid-cols-2 gap-4">';

    // アロケーション
    const det = d.detailed_allocation || {};
    html += card('アセットアロケーション', `
        ${Object.entries(det).map(([k, v]) => `
            <div class="mb-2">
                <div class="flex justify-between text-xs mb-1"><span>${k}</span><span>${v}%</span></div>
                <div class="w-full bg-gs-dark rounded-full h-2"><div class="bg-gs-accent h-2 rounded-full" style="width:${v * 1.5}%"></div></div>
            </div>
        `).join('')}
    `);

    // ETF選定
    const etfs = d.etf_picks || [];
    let etfBody = '<div class="overflow-x-auto"><table class="w-full text-xs"><thead><tr class="text-gs-text/50 border-b border-gs-border"><th class="py-1 text-left">ETF</th><th class="text-right">配分</th><th class="text-right">金額</th><th class="text-right">信託報酬</th></tr></thead><tbody>';
    etfs.forEach(e => {
        etfBody += `<tr class="border-b border-gs-border/30"><td class="py-1"><div>${e.name}</div><div class="text-gs-text/50">${e.ticker}</div></td><td class="text-right">${e.allocation_pct}%</td><td class="text-right">¥${formatNumber(e.amount)}</td><td class="text-right">${e.expense_ratio}%</td></tr>`;
    });
    etfBody += '</tbody></table></div>';
    html += card('推奨ETF一覧', etfBody);

    // リバランス
    const rb = d.rebalance_rules || {};
    html += card('リバランスルール', `
        ${metric('頻度', rb.frequency || 'N/A')}
        ${metric('閾値', rb.threshold_pct ? '±' + rb.threshold_pct + '%' : 'N/A')}
        ${(rb.rules || []).map(r => `<div class="text-xs text-gs-text/70 py-1">• ${r}</div>`).join('')}
    `);

    // 税務最適化
    const tax = d.tax_optimization || {};
    html += card('税務最適化', `
        <div class="mb-3"><h4 class="text-xs text-gs-accent mb-1">NISA口座推奨</h4>
        ${(tax.nisa_account?.recommended || []).map(n => `<div class="text-xs text-gs-text/70">• ${n}</div>`).join('')}
        <div class="text-xs text-gs-text/50 mt-1">${tax.nisa_account?.reason || ''}</div></div>
        <div><h4 class="text-xs text-gs-accent mb-1">特定口座推奨</h4>
        ${(tax.tokutei_account?.recommended || []).map(n => `<div class="text-xs text-gs-text/70">• ${n}</div>`).join('')}
        <div class="text-xs text-gs-text/50 mt-1">${tax.tokutei_account?.reason || ''}</div></div>
        ${(tax.notes || []).map(n => `<div class="text-xs text-gs-text/50 mt-2">※ ${n}</div>`).join('')}
    `);

    // DCA計画
    const dca = d.dca_plan || {};
    html += card('ドルコスト平均法計画', `
        ${metric('月次投資額合計', formatCurrency(dca.total_monthly))}
        ${(dca.allocation || []).map(a => metric(a.etf, '¥' + formatNumber(a.monthly_amount) + '/月')).join('')}
        <div class="text-xs text-gs-text/50 mt-2">${dca.strategy || ''}</div>
    `);

    html += '</div>';
    return html;
}

// === McKinsey Macro ===
function renderMcKinsey(d) {
    let html = '';

    // マーケット指標
    const mi = d.market_indicators || {};
    html += `<div class="bg-gs-navy/60 border border-gs-accent/30 rounded-xl p-5 mb-6">
        <h3 class="text-gs-accent font-bold mb-3">マーケット指標</h3>
        <div class="grid grid-cols-2 md:grid-cols-5 gap-4 text-center">
            ${mi.nikkei225 ? `<div><div class="text-xs text-gs-text/60">日経225</div><div class="text-white font-bold">¥${formatNumber(mi.nikkei225.current)}</div><div class="text-xs ${mi.nikkei225.change_ytd > 0 ? 'text-green-400' : 'text-red-400'}">YTD ${formatPercent(mi.nikkei225.change_ytd)}</div></div>` : ''}
            ${mi.sp500 ? `<div><div class="text-xs text-gs-text/60">S&P500</div><div class="text-white font-bold">${formatNumber(mi.sp500.current)}</div><div class="text-xs ${mi.sp500.change_ytd > 0 ? 'text-green-400' : 'text-red-400'}">YTD ${formatPercent(mi.sp500.change_ytd)}</div></div>` : ''}
            ${mi.usdjpy ? `<div><div class="text-xs text-gs-text/60">USD/JPY</div><div class="text-white font-bold">¥${mi.usdjpy.current}</div></div>` : ''}
            ${mi.us10y ? `<div><div class="text-xs text-gs-text/60">米10年債</div><div class="text-white font-bold">${mi.us10y.current}%</div></div>` : ''}
            ${mi.vix ? `<div><div class="text-xs text-gs-text/60">VIX</div><div class="text-white font-bold">${mi.vix.current}</div></div>` : ''}
        </div>
    </div>`;

    html += '<div class="grid grid-cols-1 lg:grid-cols-2 gap-4">';

    // 金利分析
    const ir = d.interest_rate_analysis || {};
    html += card('金利環境分析', `
        ${metric('米10年債利回り', ir.us_10y_yield ? ir.us_10y_yield + '%' : 'N/A')}
        ${metric('環境', ir.environment || 'N/A')}
        ${Object.entries(ir.impact || {}).map(([k, v]) => metric(k, v)).join('')}
        <div class="text-xs text-gs-text/50 mt-2">${ir.outlook || ''}</div>
    `);

    // 為替分析
    const cur = d.currency_analysis || {};
    html += card('為替分析', `
        ${metric('USD/JPY', cur.usdjpy ? '¥' + cur.usdjpy : 'N/A')}
        ${metric('1ヶ月変動', cur.change_1m_pct ? formatPercent(cur.change_1m_pct) : 'N/A')}
        ${metric('状況', cur.yen_status || 'N/A')}
        ${metric('影響', cur.impact || 'N/A')}
        ${cur.beneficiaries?.length ? '<div class="mt-2 text-xs text-green-400">恩恵: ' + cur.beneficiaries.join(', ') + '</div>' : ''}
        ${cur.losers?.length ? '<div class="text-xs text-red-400">逆風: ' + cur.losers.join(', ') + '</div>' : ''}
    `);

    // セクター推奨
    const sr = d.sector_recommendation || [];
    let srBody = '';
    sr.forEach(s => {
        const color = s.stance.includes('オーバー') ? 'green' : s.stance.includes('アンダー') ? 'red' : 'yellow';
        srBody += `<div class="py-2 border-b border-gs-border/50 last:border-0 flex justify-between items-center">
            <span class="text-sm">${s.sector}</span>
            <div>${badge(s.stance, color)}</div>
        </div><div class="text-xs text-gs-text/50 pb-2">${s.reason}</div>`;
    });
    html += card('セクター推奨', srBody);

    // グローバルリスク
    const gr = d.global_risks || [];
    let grBody = '';
    gr.forEach(r => {
        const color = r.severity.includes('高') ? 'red' : r.severity.includes('中') ? 'orange' : 'yellow';
        grBody += `<div class="py-2 border-b border-gs-border/50 last:border-0">
            <div class="flex justify-between"><span class="text-sm">${r.risk}</span>${badge(r.severity, color)}</div>
            <div class="text-xs text-gs-text/50">${r.impact}</div>
        </div>`;
    });
    html += card('グローバルリスクファクター', grBody);

    // タイムライン
    const tl = d.timeline || [];
    html += card('影響タイムライン', `
        ${tl.map(t => `<div class="py-2 border-b border-gs-border/50 last:border-0">
            <div class="text-sm text-gs-accent">${t.period}</div>
            <div class="text-xs text-gs-text/70">${t.focus}</div>
        </div>`).join('')}
    `);

    // 調整提案
    const adj = d.portfolio_adjustments || {};
    html += card('ポートフォリオ調整提案', `
        ${(adj.recommended_actions || []).map(a => `<div class="text-xs text-gs-text/70 py-1">• ${a}</div>`).join('')}
        <div class="mt-3 p-3 bg-gs-dark/50 rounded text-sm text-white">${adj.overall_stance || ''}</div>
    `);

    html += '</div>';
    return html;
}

// === Morgan Stanley DCF ===
function renderMorganDCF(d) {
    let html = '';

    // 判定
    const v = d.verdict || {};
    if (v.verdict) {
        const color = v.upside_pct > 10 ? 'green' : v.upside_pct > -10 ? 'yellow' : 'red';
        html += `<div class="bg-gs-navy/60 border border-gs-accent/30 rounded-xl p-5 mb-6">
            <div class="flex justify-between items-center">
                <div>
                    <h3 class="text-gs-accent font-bold mb-1">DCFバリュエーション判定</h3>
                    <span class="text-2xl font-bold text-${color}-400">${v.verdict}</span>
                    <span class="text-gs-text/60 ml-2">${v.recommendation}</span>
                </div>
                <div class="text-right">
                    <div class="text-sm text-gs-text/60">理論株価</div>
                    <div class="text-2xl font-bold text-white">¥${formatNumber(v.fair_value)}</div>
                    <div class="text-sm ${v.upside_pct > 0 ? 'text-green-400' : 'text-red-400'}">${formatPercent(v.upside_pct)} vs 現在値</div>
                </div>
            </div>
        </div>`;
    }

    html += '<div class="grid grid-cols-1 lg:grid-cols-2 gap-4">';

    // 収益予測
    const proj = d.projections || {};
    if (proj.yearly) {
        let projBody = `<div class="text-xs text-gs-text/50 mb-2">前提: ${proj.growth_assumption || ''}</div>`;
        projBody += '<div class="overflow-x-auto"><table class="w-full text-xs"><thead><tr class="text-gs-text/50 border-b border-gs-border"><th class="py-1 text-left">年度</th><th class="text-right">売上高</th><th class="text-right">成長率</th></tr></thead><tbody>';
        proj.yearly.forEach(y => {
            projBody += `<tr class="border-b border-gs-border/30"><td class="py-1">${y.year}</td><td class="text-right">${formatCurrency(y.revenue)}</td><td class="text-right">${y.growth_rate_pct}%</td></tr>`;
        });
        projBody += '</tbody></table></div>';
        html += card('5年間収益予測', projBody);
    }

    // FCF予測
    const fcf = d.fcf_projections || {};
    if (fcf.yearly) {
        let fcfBody = `<div class="text-xs text-gs-text/50 mb-2">FCFマージン: ${fcf.fcf_margin_assumption}%</div>`;
        fcfBody += '<div class="overflow-x-auto"><table class="w-full text-xs"><thead><tr class="text-gs-text/50 border-b border-gs-border"><th class="py-1 text-left">年度</th><th class="text-right">FCF</th><th class="text-right">マージン</th></tr></thead><tbody>';
        fcf.yearly.forEach(y => {
            fcfBody += `<tr class="border-b border-gs-border/30"><td class="py-1">${y.year}</td><td class="text-right">${formatCurrency(y.fcf)}</td><td class="text-right">${y.fcf_margin_pct}%</td></tr>`;
        });
        fcfBody += '</tbody></table></div>';
        html += card('FCF予測', fcfBody);
    }

    // WACC
    const wacc = d.wacc || {};
    html += card('WACC推定', `
        ${metric('WACC', wacc.wacc_pct ? wacc.wacc_pct + '%' : 'N/A')}
        ${metric('株主資本コスト', wacc.cost_of_equity_pct ? wacc.cost_of_equity_pct + '%' : 'N/A')}
        ${metric('負債コスト', wacc.cost_of_debt_pct ? wacc.cost_of_debt_pct + '%' : 'N/A')}
        ${metric('ベータ', wacc.beta || 'N/A')}
        ${metric('リスクフリーレート', wacc.risk_free_rate_pct ? wacc.risk_free_rate_pct + '%' : 'N/A')}
        ${metric('D/E比率', wacc.debt_equity_ratio || 'N/A')}
    `);

    // ターミナルバリュー
    const tv = d.terminal_value || {};
    html += card('ターミナルバリュー', `
        <h4 class="text-xs text-gs-accent mb-2">${tv.perpetuity_growth?.method || ''}</h4>
        ${metric('ターミナルバリュー', formatCurrency(tv.perpetuity_growth?.terminal_value))}
        ${metric('永続成長率', tv.perpetuity_growth?.growth_rate_pct ? tv.perpetuity_growth.growth_rate_pct + '%' : 'N/A')}
        <h4 class="text-xs text-gs-accent mb-2 mt-3">${tv.exit_multiple?.method || ''}</h4>
        ${metric('ターミナルバリュー', formatCurrency(tv.exit_multiple?.terminal_value))}
    `);

    // バリュエーション
    const val = d.valuation || {};
    html += card('企業価値・株式価値', `
        ${metric('FCF現在価値合計', formatCurrency(val.total_pv_fcf))}
        ${metric('TV現在価値（永続成長）', formatCurrency(val.pv_terminal_perpetuity))}
        ${metric('TV現在価値（マルチプル）', formatCurrency(val.pv_terminal_multiple))}
        ${metric('純有利子負債', formatCurrency(val.net_debt))}
        <div class="border-t border-gs-border mt-2 pt-2">
        ${metric('1株価値（永続成長法）', val.per_share_perpetuity ? '¥' + formatNumber(val.per_share_perpetuity) : 'N/A')}
        ${metric('1株価値（マルチプル法）', val.per_share_multiple ? '¥' + formatNumber(val.per_share_multiple) : 'N/A')}
        ${metric('1株価値（平均）', val.per_share_average ? '¥' + formatNumber(val.per_share_average) : 'N/A')}
        </div>
    `);

    // 感度分析
    const sens = d.sensitivity || {};
    if (sens.table && sens.table.length > 0) {
        let sensBody = '<div class="overflow-x-auto"><table class="w-full text-xs"><thead><tr class="text-gs-text/50 border-b border-gs-border"><th class="py-1 text-left">WACC</th>';
        (sens.growth_range || []).forEach(g => { sensBody += `<th class="text-right">g=${g}</th>`; });
        sensBody += '</tr></thead><tbody>';
        sens.table.forEach(row => {
            sensBody += `<tr class="border-b border-gs-border/30"><td class="py-1">${row.wacc_pct}%</td>`;
            (sens.growth_range || []).forEach(g => {
                const key = `g_${g}`;
                const val = row[key];
                const color = d.current_price && val > d.current_price ? 'text-green-400' : 'text-red-400';
                sensBody += `<td class="text-right ${color}">¥${formatNumber(val)}</td>`;
            });
            sensBody += '</tr>';
        });
        sensBody += '</tbody></table></div>';
        sensBody += `<div class="text-xs text-gs-text/50 mt-2">${sens.note || ''}</div>`;
        html += card('感度分析テーブル', sensBody);
    }

    html += '</div>';
    return html;
}
