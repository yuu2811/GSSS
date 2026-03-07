/**
 * GSSS - 分析結果レンダラー (Polished Design - Flask版)
 */

// ── カラーマッピング ─────────────────────────────────
const SAFE_COLORS = {
    green: 'bg-green-500/10 text-green-400 border border-green-500/20',
    red: 'bg-red-500/10 text-red-400 border border-red-500/20',
    yellow: 'bg-yellow-500/10 text-yellow-400 border border-yellow-500/20',
    orange: 'bg-orange-500/10 text-orange-400 border border-orange-500/20',
    'gs-accent': 'bg-gs-accent/10 text-gs-accent border border-gs-accent/20',
};

function renderAnalysis(type, data, info) {
    const priceHtml = data.current_price
        ? `<div class="mt-4 flex items-baseline gap-2">
            <span class="text-3xl text-white font-bold tracking-tight">¥${formatNumber(data.current_price)}</span>
            <span class="text-gs-text-muted text-sm">現在値</span>
           </div>`
        : '';

    const header = `
        <div class="banner-glow rounded-2xl p-5 sm:p-6 mb-6 fade-in">
            <div class="flex items-center gap-4">
                <div class="text-4xl">${info.icon}</div>
                <div class="flex-1">
                    <h2 class="text-white font-bold text-xl sm:text-2xl tracking-tight">${info.name}</h2>
                    ${data.company_name ? `<p class="text-gs-text-muted mt-0.5">${data.company_name} <span class="text-gs-accent/70">(${data.ticker})</span></p>` : ''}
                </div>
            </div>
            ${priceHtml}
        </div>`;

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
        default: content = `<pre class="text-xs overflow-auto p-4 bg-gs-darker rounded-xl">${JSON.stringify(data, null, 2)}</pre>`;
    }

    return header + content;
}

// === カードヘルパー ===
function card(title, body) {
    return `<div class="card-elevated rounded-2xl p-5 sm:p-6 mb-4 fade-in">
        <h3 class="text-white font-semibold mb-4 text-sm flex items-center gap-2">
            <span class="w-1 h-4 bg-gs-border-light rounded-full"></span>
            ${title}
        </h3>
        <div class="space-y-0">${body}</div>
    </div>`;
}

function metric(label, value, sub = '') {
    return `<div class="py-2.5 flex justify-between items-center border-b border-gs-border/30 last:border-0">
        <span class="text-gs-text-muted text-sm">${label}</span>
        <div class="text-right flex items-center gap-1">
            <span class="text-white font-medium text-sm">${value}</span>${sub ? `<span class="text-gs-text-muted text-xs ml-1.5">${sub}</span>` : ''}
        </div>
    </div>`;
}

function badge(text, color = 'gs-accent') {
    return `<span class="text-xs px-2.5 py-0.5 rounded-md font-medium ${SAFE_COLORS[color] || SAFE_COLORS['gs-accent']}">${text}</span>`;
}

function scoreBar(score, max, label = '') {
    const pct = Math.min((score / max) * 100, 100);
    const color = scoreColor(score, max);
    const r = score / max;
    const textCl = r >= 0.7 ? 'text-green-400' : r >= 0.5 ? 'text-yellow-400' : r >= 0.3 ? 'text-orange-400' : 'text-red-400';
    return `<div class="mb-3">
        <div class="flex justify-between text-xs mb-1.5">
            <span class="text-gs-text-muted">${label}</span>
            <span class="${textCl} font-semibold">${score}/${max}</span>
        </div>
        <div class="w-full bg-gs-darker rounded-full h-2 overflow-hidden">
            <div class="${color} h-2 rounded-full score-bar" style="width:${pct}%"></div>
        </div>
    </div>`;
}

function bannerCard(content) {
    return `<div class="banner-glow rounded-2xl p-5 sm:p-6 mb-6 fade-in">${content}</div>`;
}

function bigScore(score, max, label, colorFn) {
    const r = score / max;
    const cl = typeof colorFn === 'function' ? colorFn(score) : (r >= 0.7 ? 'text-green-400' : r >= 0.5 ? 'text-yellow-400' : r >= 0.3 ? 'text-orange-400' : 'text-red-400');
    return `<div class="text-center py-2">
        <div class="text-5xl font-bold ${cl} leading-none">${score ?? 'N/A'}</div>
        <div class="text-gs-text-muted text-sm mt-1">/ ${max}</div>
        ${label ? `<div class="text-sm mt-2 ${cl} font-medium">${escapeHtml(label)}</div>` : ''}
    </div>`;
}

// === Goldman Sachs ===
function renderGoldman(d) {
    let html = '<div class="grid grid-cols-1 lg:grid-cols-2 gap-4">';

    const pe = d.pe_analysis || {};
    html += card('P/E比率分析', `
        ${metric('現在PER', pe.current_pe ? pe.current_pe + '倍' : 'N/A')}
        ${metric('フォワードPER', pe.forward_pe ? pe.forward_pe + '倍' : 'N/A')}
        ${metric('評価', pe.assessment || 'N/A')}
        ${scoreBar(pe.score || 5, 10, 'バリュエーション')}
    `);

    const debt = d.debt_analysis || {};
    html += card('負債健全性チェック', `
        ${metric('D/Eレシオ', debt.debt_to_equity !== null ? debt.debt_to_equity + '倍' : 'N/A')}
        ${metric('総負債', formatCurrency(debt.total_debt))}
        ${metric('手元現金', formatCurrency(debt.total_cash))}
        ${metric('健全性', debt.health || 'N/A')}
        ${scoreBar(debt.score || 5, 10, '財務健全性')}
    `);

    const div = d.dividend_analysis || {};
    html += card('配当分析', `
        ${metric('配当利回り', div.yield_pct ? div.yield_pct + '%' : '0%')}
        ${metric('年間配当', div.annual_rate ? '¥' + formatNumber(div.annual_rate) : 'N/A')}
        ${metric('配当性向', div.payout_ratio_pct ? div.payout_ratio_pct + '%' : 'N/A')}
        ${metric('持続可能性', div.sustainability || 'N/A')}
        ${scoreBar(div.score || 5, 10, '配当安全性')}
    `);

    const moat = d.moat_rating || {};
    html += card('競争優位性（モート）', `
        <div class="text-center mb-4"><span class="text-2xl text-white font-bold">${moat.rating || 'N/A'}</span></div>
        ${scoreBar(moat.score || 0, moat.max_score || 11, 'モートスコア')}
        <div class="mt-3 space-y-1.5">${(moat.reasons || []).map(r => `<div class="text-xs text-gs-text-muted flex gap-1.5"><span class="text-gs-accent/60">&#x2022;</span>${r}</div>`).join('')}</div>
    `);

    const pt = d.price_targets || {};
    html += card('12ヶ月価格ターゲット', `
        ${metric('強気ケース', pt.bull_target ? '¥' + formatNumber(pt.bull_target) : 'N/A', pt.upside_pct ? formatPercent(pt.upside_pct) : '')}
        ${metric('ベースケース', pt.base_target ? '¥' + formatNumber(pt.base_target) : 'N/A')}
        ${metric('弱気ケース', pt.bear_target ? '¥' + formatNumber(pt.bear_target) : 'N/A', pt.downside_pct ? formatPercent(pt.downside_pct) : '')}
        ${pt.estimated ? '<div class="text-xs text-gs-text-muted/60 mt-3 italic">※推定値（アナリスト目標価格なし）</div>' : ''}
    `);

    const risk = d.risk_rating || {};
    html += card('リスク評価', `
        ${bigScore(risk.score || 'N/A', 10, null, riskColor)}
        <div class="mt-3 space-y-1.5">${(risk.reasons || []).map(r => `<div class="text-xs text-gs-text-muted flex gap-1.5"><span class="text-gs-accent/60">&#x2022;</span>${r}</div>`).join('')}</div>
    `);

    const ez = d.entry_zones || {};
    html += card('エントリー価格ゾーン', `
        ${metric('積極的エントリー', ez.aggressive_entry ? '¥' + formatNumber(ez.aggressive_entry) : 'N/A')}
        ${metric('理想的エントリー', ez.ideal_entry ? '¥' + formatNumber(ez.ideal_entry) : 'N/A')}
        ${metric('保守的エントリー', ez.conservative_entry ? '¥' + formatNumber(ez.conservative_entry) : 'N/A')}
        ${metric('ストップロス', ez.stop_loss ? '¥' + formatNumber(ez.stop_loss) : 'N/A', ez.stop_loss_pct ? ez.stop_loss_pct + '%' : '')}
        ${metric('サポートライン', ez.support ? '¥' + formatNumber(ez.support) : 'N/A')}
        ${metric('レジスタンスライン', ez.resistance ? '¥' + formatNumber(ez.resistance) : 'N/A')}
    `);

    const rev = d.revenue_growth || {};
    html += card('収益成長トレンド', `
        ${metric('トレンド', rev.trend || 'N/A')}
        ${(rev.growth_rates || []).map((r, i) => metric(rev.years?.[i] || '', formatPercent(r))).join('')}
    `);

    html += '</div>';

    if (d.summary) {
        html += `<div class="banner-glow rounded-2xl p-5 sm:p-6 mt-4"><p class="text-white leading-relaxed">${d.summary}</p></div>`;
    }

    return html;
}

// === Morgan Stanley Technical ===
function renderMorganTechnical(d) {
    let html = '';

    const ts = d.trade_setup || {};
    if (ts.entry) {
        html += bannerCard(`<h3 class="text-gs-accent font-bold mb-4 text-sm tracking-wide">トレードセットアップ</h3>
            <div class="grid grid-cols-2 md:grid-cols-5 gap-3 sm:gap-4 text-center">
                <div class="bg-gs-darker/60 rounded-xl p-3"><div class="text-[10px] text-gs-text-muted mb-1">方向</div><div class="text-white font-bold text-lg">${ts.direction}</div></div>
                <div class="bg-gs-darker/60 rounded-xl p-3"><div class="text-[10px] text-gs-text-muted mb-1">エントリー</div><div class="text-white font-bold">¥${formatNumber(ts.entry)}</div></div>
                <div class="bg-gs-darker/60 rounded-xl p-3"><div class="text-[10px] text-gs-text-muted mb-1">ストップロス</div><div class="text-red-400 font-bold">¥${formatNumber(ts.stop_loss)}</div></div>
                <div class="bg-gs-darker/60 rounded-xl p-3"><div class="text-[10px] text-gs-text-muted mb-1">利確目標1</div><div class="text-green-400 font-bold">¥${formatNumber(ts.target_1)}</div></div>
                <div class="bg-gs-darker/60 rounded-xl p-3"><div class="text-[10px] text-gs-text-muted mb-1">R/R比率</div><div class="text-gs-gold font-bold">${ts.risk_reward_ratio}</div></div>
            </div>`);
    }

    html += '<div class="grid grid-cols-1 lg:grid-cols-2 gap-4">';

    const tr = d.trend || {};
    html += card('トレンド分析', `
        ${metric('主要トレンド', tr.primary || 'N/A')}
        ${metric('日足トレンド', tr.daily || 'N/A')}
        ${metric('週足トレンド', tr.weekly || 'N/A')}
        ${metric('月足トレンド', tr.monthly || 'N/A')}
        ${tr.crossover ? metric('クロスオーバー', tr.crossover) : ''}
    `);

    const rsi = d.rsi_analysis || {};
    html += card('RSI (14日)', `
        <div class="text-center mb-4"><span class="text-4xl font-bold text-white">${rsi.value || 'N/A'}</span></div>
        ${metric('判定', rsi.interpretation || 'N/A')}
        ${metric('シグナル', rsi.signal || 'N/A')}
    `);

    const ma = d.ma_analysis || {};
    html += card('移動平均分析', `
        ${metric('総合判定', ma.overall || 'N/A')}
        ${Object.entries(ma.moving_averages || {}).map(([k, v]) => metric(k + '移動平均', '¥' + formatNumber(v.value), v.position === '上' ? '<span class="text-green-400">&#x2191;上</span>' : '<span class="text-red-400">&#x2193;下</span>')).join('')}
    `);

    const macd = d.macd_analysis || {};
    html += card('MACD分析', `
        ${metric('MACD', macd.macd !== undefined ? macd.macd : 'N/A')}
        ${metric('シグナル', macd.signal !== undefined ? macd.signal : 'N/A')}
        ${metric('ヒストグラム', macd.histogram !== undefined ? macd.histogram : 'N/A')}
        ${metric('クロスオーバー', macd.crossover || 'N/A')}
        ${metric('モメンタム', macd.momentum || 'N/A')}
    `);

    const bb = d.bb_analysis || {};
    html += card('ボリンジャーバンド', `
        ${metric('上限バンド', bb.upper ? '¥' + formatNumber(bb.upper) : 'N/A')}
        ${metric('中央線', bb.middle ? '¥' + formatNumber(bb.middle) : 'N/A')}
        ${metric('下限バンド', bb.lower ? '¥' + formatNumber(bb.lower) : 'N/A')}
        ${metric('ポジション', bb.position || 'N/A')}
        ${metric('バンド幅', bb.squeeze_status || 'N/A')}
    `);

    const vol = d.volume_analysis || {};
    html += card('出来高分析', `
        ${metric('現在の出来高', vol.current_volume ? formatNumber(vol.current_volume) : 'N/A')}
        ${metric('20日平均', vol.avg_volume_20d ? formatNumber(vol.avg_volume_20d) : 'N/A')}
        ${metric('出来高比率', vol.ratio ? vol.ratio + 'x' : 'N/A')}
        ${metric('判定', vol.interpretation || 'N/A')}
    `);

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

    const dash = d.risk_dashboard || {};
    if (dash.metrics) {
        html += bannerCard(`<div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-5">
                <h3 class="text-gs-accent font-bold text-sm tracking-wide">リスクダッシュボード</h3>
                <div class="flex items-baseline gap-2"><span class="text-3xl font-bold ${riskColor(dash.total_risk_score || 5)}">${dash.total_risk_score}/10</span><span class="text-gs-text-muted text-sm">${dash.overall_risk}</span></div>
            </div>
            <div class="grid grid-cols-2 md:grid-cols-4 gap-3">${Object.entries(dash.metrics).map(([k, v]) => {
                const colors = { green: 'text-green-400', red: 'text-red-400', yellow: 'text-yellow-400', orange: 'text-orange-400' };
                const tc = colors[v.color] || 'text-white';
                return `<div class="text-center p-3 sm:p-4 bg-gs-darker/60 rounded-xl"><div class="text-[10px] text-gs-text-muted mb-1.5">${k}</div><div class="text-2xl font-bold ${tc}">${v.score}/10</div><div class="text-[10px] text-gs-text-muted mt-1">${v.label}</div></div>`;
            }).join('')}</div>`);
    }

    html += '<div class="grid grid-cols-1 lg:grid-cols-2 gap-4">';

    const vol = d.volatility || {};
    html += card('ボラティリティプロファイル', `
        ${metric('日次ボラティリティ', vol.daily_pct ? vol.daily_pct + '%' : 'N/A')}
        ${metric('年間ボラティリティ', vol.annual_pct ? vol.annual_pct + '%' : 'N/A')}
        ${metric('リスクレベル', vol.level || 'N/A')}
        ${metric('95%VaR（日次）', vol.percentile_95_daily_loss ? vol.percentile_95_daily_loss + '%' : 'N/A')}
    `);

    const beta = d.beta_analysis || {};
    html += card('ベータ分析（対日経225）', `
        ${metric('ベータ', beta.beta !== null ? beta.beta : 'N/A')}
        ${metric('上昇時ベータ', beta.up_beta !== undefined ? beta.up_beta : 'N/A')}
        ${metric('下降時ベータ', beta.down_beta !== undefined ? beta.down_beta : 'N/A')}
        ${metric('相関係数', beta.correlation !== undefined ? beta.correlation : 'N/A')}
        ${metric('解釈', beta.interpretation || 'N/A')}
    `);

    const dd = d.drawdown || {};
    html += card('最大ドローダウン', `
        ${metric('最大ドローダウン', dd.max_drawdown_pct ? dd.max_drawdown_pct + '%' : 'N/A')}
        ${metric('発生日', dd.max_drawdown_date || 'N/A')}
        ${metric('回復期間', dd.recovery_days !== undefined ? dd.recovery_days + (typeof dd.recovery_days === 'number' ? '日' : '') : 'N/A')}
    `);

    const st = d.stress_test || {};
    if (st.scenarios) {
        let stBody = metric('現在価格', '¥' + formatNumber(st.current_price));
        for (const [name, scenario] of Object.entries(st.scenarios)) {
            stBody += metric(name, '¥' + formatNumber(scenario.estimated_price), `<span class="text-red-400">${scenario.loss_pct}%</span>`);
        }
        html += card('リセッションストレステスト', stBody);
    }

    const ir = d.interest_sensitivity || {};
    html += card('金利感応度', `
        ${metric('感応度レベル', ir.level || 'N/A')}
        ${metric('影響', ir.impact || 'N/A')}
    `);

    const liq = d.liquidity || {};
    html += card('流動性リスク', `
        ${metric('平均日次出来高', liq.avg_daily_volume ? formatNumber(liq.avg_daily_volume) : 'N/A')}
        ${metric('流動性レベル', liq.liquidity_level || 'N/A')}
        ${metric('ビッドアスクスプレッド', liq.bid_ask_spread_pct ? liq.bid_ask_spread_pct + '%' : 'N/A')}
    `);

    const hedge = d.hedge_recommendation || {};
    html += card('ヘッジ推奨', `
        ${(hedge.strategies || []).map(s => `<div class="py-2.5 text-sm border-b border-gs-border/30 last:border-0 text-gs-text-muted">${s}</div>`).join('')}
    `);

    html += '</div>';
    return html;
}

// === JPMorgan Earnings ===
function renderJPMorgan(d) {
    let html = '<div class="grid grid-cols-1 lg:grid-cols-2 gap-4">';

    const eh = d.earnings_history || {};
    let ehBody = `<p class="text-sm text-gs-text-muted mb-4">${eh.summary || ''}</p>`;
    if (eh.quarters && eh.quarters.length > 0) {
        ehBody += '<div class="overflow-x-auto -mx-1"><table class="w-full text-xs"><thead><tr class="text-gs-text-muted border-b border-gs-border"><th class="py-2 px-1 text-left font-medium">日付</th><th class="text-right py-2 px-1 font-medium">予想EPS</th><th class="text-right py-2 px-1 font-medium">実績EPS</th><th class="text-right py-2 px-1 font-medium">サプライズ</th></tr></thead><tbody>';
        eh.quarters.forEach(q => {
            const color = q.beat === true ? 'text-green-400' : q.beat === false ? 'text-red-400' : 'text-gs-text';
            ehBody += `<tr class="border-b border-gs-border/20 hover:bg-gs-border/5 transition-colors ${color}"><td class="py-2 px-1">${q.date}</td><td class="text-right py-2 px-1">${q.eps_estimate ?? 'N/A'}</td><td class="text-right py-2 px-1">${q.eps_actual ?? 'N/A'}</td><td class="text-right py-2 px-1">${q.surprise_pct ? q.surprise_pct + '%' : 'N/A'}</td></tr>`;
        });
        ehBody += '</tbody></table></div>';
    }
    html += card('決算履歴', ehBody);

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

    const km = d.key_metrics || [];
    html += card('注目すべき指標', `
        ${km.map(m => metric(m.name, m.value, badge(m.importance, m.importance === '高' ? 'red' : 'yellow'))).join('')}
    `);

    const im = d.implied_move || {};
    html += card('決算日の想定値動き', `
        ${metric('推定変動幅', im.estimated_move_pct ? '±' + im.estimated_move_pct + '%' : 'N/A')}
        ${metric('過去の大きな値動き（平均）', im.avg_large_move_pct ? im.avg_large_move_pct + '%' : 'N/A')}
        ${metric('最大単日変動', im.max_single_day_move_pct ? im.max_single_day_move_pct + '%' : 'N/A')}
    `);

    const pos = d.positioning || {};
    if (pos.strategies) {
        let posBody = '';
        pos.strategies.forEach(s => {
            const actionColor = s.action.includes('買い') ? 'green' : s.action.includes('売り') ? 'red' : 'yellow';
            posBody += `<div class="py-3 border-b border-gs-border/30 last:border-0">
                <div class="flex items-center gap-2 mb-1.5">${badge(s.timing)} ${badge(s.action, actionColor)}</div>
                <p class="text-xs text-gs-text-muted leading-relaxed">${s.reason}</p>
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

    const ya = d.yield_analysis || {};
    html += card('配当利回り分析', `
        ${metric('現在利回り', ya.current_yield_pct ? ya.current_yield_pct + '%' : '0%')}
        ${metric('5年平均利回り', ya.five_year_avg_yield ? ya.five_year_avg_yield + '%' : 'N/A')}
        ${metric('年間配当', ya.dividend_rate ? '¥' + formatNumber(ya.dividend_rate) : 'N/A')}
        ${metric('評価', ya.assessment || 'N/A')}
    `);

    const sf = d.safety || {};
    const sfColor = sf.score >= 7 ? 'text-green-400' : sf.score >= 5 ? 'text-yellow-400' : 'text-red-400';
    html += card('配当安全性スコア', `
        ${bigScore(sf.score, 10, sf.label, () => sfColor)}
        ${scoreBar(sf.score || 0, 10, '安全性')}
        <div class="mt-2 space-y-1">${(sf.reasons || []).map(r => `<div class="text-xs text-gs-text-muted flex gap-1.5"><span class="text-gs-accent/60">&#x2022;</span>${r}</div>`).join('')}</div>
    `);

    const ga = d.growth_analysis || {};
    html += card('配当成長履歴', `
        ${metric('連続増配年数', ga.consecutive_increases + '年')}
        ${metric('CAGR', ga.cagr_pct ? ga.cagr_pct + '%' : 'N/A')}
        ${metric('ステータス', ga.status || 'N/A')}
        ${Object.entries(ga.annual_dividends || {}).map(([y, v]) => metric(y + '年', '¥' + formatNumber(v, 2))).join('')}
    `);

    const ip = d.income_projection || {};
    html += card('配当収入予測', `
        ${metric('投資金額', formatCurrency(d.investment_amount))}
        ${metric('初年度配当収入', formatCurrency(ip.initial_annual_income))}
        ${metric('10年後配当収入', formatCurrency(ip.year_10_income))}
        ${metric('20年後配当収入', formatCurrency(ip.year_20_income))}
        ${metric('想定成長率', ip.assumed_growth_rate_pct ? ip.assumed_growth_rate_pct + '%/年' : 'N/A')}
    `);

    const drip = d.drip || {};
    if (drip.year_10) {
        html += card('DRIP再投資シミュレーション', `
            ${metric('初期株数', drip.initial_shares ? drip.initial_shares + '株' : 'N/A')}
            ${metric('10年後株数', drip.year_10.shares + '株')}
            ${metric('10年後評価額', formatCurrency(drip.year_10.total_value))}
            ${metric('10年後累計配当', formatCurrency(drip.year_10.cumulative_dividends))}
            ${drip.year_20 ? metric('20年後評価額', formatCurrency(drip.year_20.total_value)) : ''}
            ${metric('20年間トータルリターン', drip.total_return_20y ? '+' + drip.total_return_20y + '%' : 'N/A')}
            <div class="text-xs text-gs-text-muted/60 mt-3 italic">前提: ${drip.assumptions ? drip.assumptions.price_growth + ' / 配当' + drip.assumptions.dividend_growth : ''}</div>
        `);
    }

    const yt = d.yield_trap || {};
    html += card('イールドトラップチェック', `
        <div class="mb-3">${yt.is_potential_trap ? badge('要注意', 'red') : badge('問題なし', 'green')}</div>
        ${(yt.warnings || []).map(w => `<div class="text-xs py-1 flex gap-1.5 ${yt.is_potential_trap ? 'text-red-400' : 'text-gs-text-muted'}"><span>&#x2022;</span>${w}</div>`).join('')}
    `);

    const ex = d.ex_dividend || {};
    html += card('配当落ち日', `
        ${metric('次回配当落ち日', ex.ex_dividend_date || '未定')}
        ${metric('配当額', ex.dividend_rate ? '¥' + formatNumber(ex.dividend_rate) : 'N/A')}
        ${ex.note ? `<div class="text-xs text-gs-text-muted/60 mt-3 italic">${ex.note}</div>` : ''}
    `);

    html += '</div>';
    return html;
}

// === Citadel Sector ===
function renderCitadel(d) {
    let html = '';

    const cycle = d.economic_cycle || {};
    html += bannerCard(`<h3 class="text-gs-accent font-bold mb-2 text-sm tracking-wide">経済サイクル: <span class="text-white text-base">${cycle.phase || 'N/A'}</span></h3>
        <p class="text-sm text-gs-text-muted mb-4 leading-relaxed">${cycle.description || ''}</p>
        <div class="grid grid-cols-2 gap-4 text-sm">
            <div class="bg-gs-darker/60 rounded-xl p-3">${metric('日経平均', cycle.nikkei_current ? '¥' + formatNumber(cycle.nikkei_current) : 'N/A')}</div>
            <div class="bg-gs-darker/60 rounded-xl p-3">${metric('200日移動平均', cycle.nikkei_sma200 ? '¥' + formatNumber(cycle.nikkei_sma200) : 'N/A')}</div>
        </div>`);

    html += '<div class="grid grid-cols-1 lg:grid-cols-2 gap-4">';

    const sp = d.sector_performance || [];
    if (sp.length > 0) {
        let spBody = '<div class="overflow-x-auto -mx-1"><table class="w-full text-xs"><thead><tr class="text-gs-text-muted border-b border-gs-border"><th class="py-2 px-1 text-left font-medium">セクター</th><th class="text-right py-2 px-1 font-medium">1ヶ月</th><th class="text-right py-2 px-1 font-medium">3ヶ月</th><th class="text-right py-2 px-1 font-medium">6ヶ月</th></tr></thead><tbody>';
        sp.forEach(s => {
            spBody += `<tr class="border-b border-gs-border/20 hover:bg-gs-border/5 transition-colors"><td class="py-2 px-1">${s.sector}</td><td class="text-right py-2 px-1 ${s.return_1m > 0 ? 'text-green-400' : 'text-red-400'}">${s.return_1m !== null ? formatPercent(s.return_1m) : 'N/A'}</td><td class="text-right py-2 px-1 ${s.return_3m > 0 ? 'text-green-400' : 'text-red-400'}">${s.return_3m !== null ? formatPercent(s.return_3m) : 'N/A'}</td><td class="text-right py-2 px-1 ${s.return_6m > 0 ? 'text-green-400' : 'text-red-400'}">${formatPercent(s.return_6m)}</td></tr>`;
        });
        spBody += '</tbody></table></div>';
        html += card('セクターパフォーマンスランキング', spBody);
    }

    const rot = d.rotation_recommendation || {};
    let rotBody = `<p class="text-sm mb-4">ポジショニング: ${badge(rot.positioning || 'N/A', rot.positioning === 'リスクオン' ? 'green' : 'yellow')}</p>`;
    rotBody += '<div class="mb-4"><h4 class="text-xs text-green-400 mb-2 font-semibold tracking-wide">オーバーウェイト</h4>';
    (rot.overweight || []).forEach(o => { rotBody += `<div class="text-xs py-1.5 border-b border-gs-border/20 last:border-0 text-gs-text-muted">${o.sector} &mdash; ${o.reason} ${badge(o.conviction)}</div>`; });
    rotBody += '</div><div><h4 class="text-xs text-red-400 mb-2 font-semibold tracking-wide">アンダーウェイト</h4>';
    (rot.underweight || []).forEach(o => { rotBody += `<div class="text-xs py-1.5 border-b border-gs-border/20 last:border-0 text-gs-text-muted">${o.sector} &mdash; ${o.reason}</div>`; });
    rotBody += '</div>';
    html += card('セクターローテーション推奨', rotBody);

    const alloc = d.model_allocation || {};
    html += card('モデルアロケーション', `
        ${Object.entries(alloc.allocation || {}).map(([k, v]) => `
            <div class="mb-3">
                <div class="flex justify-between text-xs mb-1.5"><span class="text-gs-text-muted">${k}</span><span class="text-white font-medium">${v}%</span></div>
                <div class="w-full bg-gs-darker rounded-full h-2 overflow-hidden"><div class="bg-gs-accent h-2 rounded-full score-bar" style="width:${v}%"></div></div>
            </div>
        `).join('')}
        <div class="text-xs text-gs-text-muted/60 mt-3 italic">${alloc.note || ''}</div>
    `);

    html += '</div>';
    return html;
}

// === Renaissance Quant ===
function renderRenaissance(d) {
    let html = '';

    const cs = d.composite_score || {};
    const csColor = cs.total_score >= 60 ? 'text-green-400' : cs.total_score >= 40 ? 'text-yellow-400' : 'text-red-400';
    html += bannerCard(`<div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-5">
            <h3 class="text-gs-accent font-bold text-sm tracking-wide">複合スコア</h3>
            <div class="flex items-baseline gap-1"><span class="text-5xl font-bold text-white tracking-tight">${cs.total_score || 'N/A'}</span><span class="text-gs-text-muted text-lg">/100</span></div>
        </div>
        <div class="text-center mb-5"><span class="text-lg font-semibold ${csColor}">${cs.rating || ''} &mdash; ${cs.recommendation || ''}</span></div>
        <div class="grid grid-cols-5 gap-2 sm:gap-3">${Object.entries(cs.factor_scores || {}).map(([k, v]) => `
            <div class="text-center p-2 sm:p-3 bg-gs-darker/60 rounded-xl">
                <div class="text-[10px] text-gs-text-muted mb-1">${k}</div>
                <div class="text-lg sm:text-xl font-bold text-white">${v}</div>
                <div class="text-[10px] text-gs-text-muted mt-0.5">${cs.weights?.[k] || ''}</div>
            </div>
        `).join('')}</div>`);

    html += '<div class="grid grid-cols-1 lg:grid-cols-2 gap-4">';

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
            <div class="space-y-1.5">${(fData.details || []).map(detail => `<div class="text-xs text-gs-text-muted flex gap-1.5"><span class="text-gs-accent/60">&#x2022;</span>${detail}</div>`).join('')}</div>
        `);
    });

    html += '</div>';
    return html;
}

// === Vanguard ETF ===
function renderVanguard(d) {
    let html = bannerCard(`<div class="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4 text-center">
        <div class="bg-gs-darker/60 rounded-xl p-3 sm:p-4"><div class="text-[10px] text-gs-text-muted mb-1">リスクプロファイル</div><div class="text-white font-bold text-lg">${d.risk_profile}</div></div>
        <div class="bg-gs-darker/60 rounded-xl p-3 sm:p-4"><div class="text-[10px] text-gs-text-muted mb-1">投資金額</div><div class="text-white font-bold">${formatCurrency(d.investment_amount)}</div></div>
        <div class="bg-gs-darker/60 rounded-xl p-3 sm:p-4"><div class="text-[10px] text-gs-text-muted mb-1">年齢</div><div class="text-white font-bold">${d.age}歳</div></div>
        <div class="bg-gs-darker/60 rounded-xl p-3 sm:p-4"><div class="text-[10px] text-gs-text-muted mb-1">期待リターン</div><div class="text-green-400 font-bold">${d.expected_return?.expected_annual_return_pct}%/年</div></div>
    </div>`);

    html += '<div class="grid grid-cols-1 lg:grid-cols-2 gap-4">';

    const det = d.detailed_allocation || {};
    html += card('アセットアロケーション', `
        ${Object.entries(det).map(([k, v]) => `
            <div class="mb-3">
                <div class="flex justify-between text-xs mb-1.5"><span class="text-gs-text-muted">${k}</span><span class="text-white font-medium">${v}%</span></div>
                <div class="w-full bg-gs-darker rounded-full h-2 overflow-hidden"><div class="bg-gs-accent h-2 rounded-full score-bar" style="width:${v * 1.5}%"></div></div>
            </div>
        `).join('')}
    `);

    const etfs = d.etf_picks || [];
    let etfBody = '<div class="overflow-x-auto -mx-1"><table class="w-full text-xs"><thead><tr class="text-gs-text-muted border-b border-gs-border"><th class="py-2 px-1 text-left font-medium">ETF</th><th class="text-right py-2 px-1 font-medium">配分</th><th class="text-right py-2 px-1 font-medium">金額</th><th class="text-right py-2 px-1 font-medium">信託報酬</th></tr></thead><tbody>';
    etfs.forEach(e => {
        etfBody += `<tr class="border-b border-gs-border/20 hover:bg-gs-border/5 transition-colors"><td class="py-2 px-1"><div class="font-medium text-white">${e.name}</div><div class="text-gs-text-muted/60">${e.ticker}</div></td><td class="text-right py-2 px-1">${e.allocation_pct}%</td><td class="text-right py-2 px-1">¥${formatNumber(e.amount)}</td><td class="text-right py-2 px-1">${e.expense_ratio}%</td></tr>`;
    });
    etfBody += '</tbody></table></div>';
    html += card('推奨ETF一覧', etfBody);

    const rb = d.rebalance_rules || {};
    html += card('リバランスルール', `
        ${metric('頻度', rb.frequency || 'N/A')}
        ${metric('閾値', rb.threshold_pct ? '±' + rb.threshold_pct + '%' : 'N/A')}
        ${(rb.rules || []).map(r => `<div class="text-xs text-gs-text-muted py-1 flex gap-1.5"><span class="text-gs-accent/60">&#x2022;</span>${r}</div>`).join('')}
    `);

    const tax = d.tax_optimization || {};
    html += card('税務最適化', `
        <div class="mb-4"><h4 class="text-xs text-gs-accent mb-2 font-semibold">NISA口座推奨</h4>
        ${(tax.nisa_account?.recommended || []).map(n => `<div class="text-xs text-gs-text-muted flex gap-1.5"><span class="text-gs-accent/60">&#x2022;</span>${n}</div>`).join('')}
        <div class="text-xs text-gs-text-muted/60 mt-1.5 italic">${tax.nisa_account?.reason || ''}</div></div>
        <div><h4 class="text-xs text-gs-accent mb-2 font-semibold">特定口座推奨</h4>
        ${(tax.tokutei_account?.recommended || []).map(n => `<div class="text-xs text-gs-text-muted flex gap-1.5"><span class="text-gs-accent/60">&#x2022;</span>${n}</div>`).join('')}
        <div class="text-xs text-gs-text-muted/60 mt-1.5 italic">${tax.tokutei_account?.reason || ''}</div></div>
        ${(tax.notes || []).map(n => `<div class="text-xs text-gs-text-muted/50 mt-2">※ ${n}</div>`).join('')}
    `);

    const dca = d.dca_plan || {};
    html += card('ドルコスト平均法計画', `
        ${metric('月次投資額合計', formatCurrency(dca.total_monthly))}
        ${(dca.allocation || []).map(a => metric(a.etf, '¥' + formatNumber(a.monthly_amount) + '/月')).join('')}
        <div class="text-xs text-gs-text-muted/60 mt-3 italic">${dca.strategy || ''}</div>
    `);

    html += '</div>';
    return html;
}

// === McKinsey Macro ===
function renderMcKinsey(d) {
    let html = '';

    const mi = d.market_indicators || {};
    html += bannerCard(`<h3 class="text-gs-accent font-bold mb-4 text-sm tracking-wide">マーケット指標</h3>
        <div class="grid grid-cols-2 md:grid-cols-5 gap-3 text-center">
            ${mi.nikkei225 ? `<div class="bg-gs-darker/60 rounded-xl p-3"><div class="text-[10px] text-gs-text-muted mb-1">日経225</div><div class="text-white font-bold">¥${formatNumber(mi.nikkei225.current)}</div><div class="text-[10px] ${mi.nikkei225.change_ytd > 0 ? 'text-green-400' : 'text-red-400'}">YTD ${formatPercent(mi.nikkei225.change_ytd)}</div></div>` : ''}
            ${mi.sp500 ? `<div class="bg-gs-darker/60 rounded-xl p-3"><div class="text-[10px] text-gs-text-muted mb-1">S&P500</div><div class="text-white font-bold">${formatNumber(mi.sp500.current)}</div><div class="text-[10px] ${mi.sp500.change_ytd > 0 ? 'text-green-400' : 'text-red-400'}">YTD ${formatPercent(mi.sp500.change_ytd)}</div></div>` : ''}
            ${mi.usdjpy ? `<div class="bg-gs-darker/60 rounded-xl p-3"><div class="text-[10px] text-gs-text-muted mb-1">USD/JPY</div><div class="text-white font-bold">¥${mi.usdjpy.current}</div></div>` : ''}
            ${mi.us10y ? `<div class="bg-gs-darker/60 rounded-xl p-3"><div class="text-[10px] text-gs-text-muted mb-1">米10年債</div><div class="text-white font-bold">${mi.us10y.current}%</div></div>` : ''}
            ${mi.vix ? `<div class="bg-gs-darker/60 rounded-xl p-3"><div class="text-[10px] text-gs-text-muted mb-1">VIX</div><div class="text-white font-bold">${mi.vix.current}</div></div>` : ''}
        </div>`);

    html += '<div class="grid grid-cols-1 lg:grid-cols-2 gap-4">';

    const ir = d.interest_rate_analysis || {};
    html += card('金利環境分析', `
        ${metric('米10年債利回り', ir.us_10y_yield ? ir.us_10y_yield + '%' : 'N/A')}
        ${metric('環境', ir.environment || 'N/A')}
        ${Object.entries(ir.impact || {}).map(([k, v]) => metric(k, v)).join('')}
        <div class="text-xs text-gs-text-muted/60 mt-3 italic">${ir.outlook || ''}</div>
    `);

    const cur = d.currency_analysis || {};
    html += card('為替分析', `
        ${metric('USD/JPY', cur.usdjpy ? '¥' + cur.usdjpy : 'N/A')}
        ${metric('1ヶ月変動', cur.change_1m_pct ? formatPercent(cur.change_1m_pct) : 'N/A')}
        ${metric('状況', cur.yen_status || 'N/A')}
        ${metric('影響', cur.impact || 'N/A')}
        ${cur.beneficiaries?.length ? '<div class="mt-3 text-xs text-green-400 flex gap-1"><span class="font-semibold">恩恵:</span> ' + cur.beneficiaries.join(', ') + '</div>' : ''}
        ${cur.losers?.length ? '<div class="text-xs text-red-400 flex gap-1 mt-1"><span class="font-semibold">逆風:</span> ' + cur.losers.join(', ') + '</div>' : ''}
    `);

    const sr = d.sector_recommendation || [];
    let srBody = '';
    sr.forEach(s => {
        const color = s.stance.includes('オーバー') ? 'green' : s.stance.includes('アンダー') ? 'red' : 'yellow';
        srBody += `<div class="py-2.5 border-b border-gs-border/20 last:border-0">
            <div class="flex justify-between items-center"><span class="text-sm text-white">${s.sector}</span><div>${badge(s.stance, color)}</div></div>
            <div class="text-xs text-gs-text-muted mt-1">${s.reason}</div>
        </div>`;
    });
    html += card('セクター推奨', srBody);

    const gr = d.global_risks || [];
    let grBody = '';
    gr.forEach(r => {
        const color = r.severity.includes('高') ? 'red' : r.severity.includes('中') ? 'orange' : 'yellow';
        grBody += `<div class="py-2.5 border-b border-gs-border/20 last:border-0">
            <div class="flex justify-between items-center"><span class="text-sm text-white">${r.risk}</span>${badge(r.severity, color)}</div>
            <div class="text-xs text-gs-text-muted mt-1">${r.impact}</div>
        </div>`;
    });
    html += card('グローバルリスクファクター', grBody);

    html += card('影響タイムライン', `
        ${(d.timeline || []).map(t => `<div class="py-2.5 border-b border-gs-border/20 last:border-0">
            <div class="text-sm text-gs-accent font-medium">${t.period}</div>
            <div class="text-xs text-gs-text-muted mt-0.5">${t.focus}</div>
        </div>`).join('')}
    `);

    const adj = d.portfolio_adjustments || {};
    html += card('ポートフォリオ調整提案', `
        <div class="space-y-1.5">${(adj.recommended_actions || []).map(a => `<div class="text-xs text-gs-text-muted flex gap-1.5"><span class="text-gs-accent/60">&#x2022;</span>${a}</div>`).join('')}</div>
        <div class="mt-4 p-4 bg-gs-darker/60 rounded-xl text-sm text-white leading-relaxed">${adj.overall_stance || ''}</div>
    `);

    html += '</div>';
    return html;
}

// === Morgan Stanley DCF ===
function renderMorganDCF(d) {
    let html = '';

    const v = d.verdict || {};
    if (v.verdict) {
        const color = v.upside_pct > 10 ? 'green' : v.upside_pct > -10 ? 'yellow' : 'red';
        const colors = { green: 'text-green-400', red: 'text-red-400', yellow: 'text-yellow-400' };
        const tc = colors[color] || 'text-white';
        html += bannerCard(`<div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div><h3 class="text-gs-accent font-bold mb-2 text-sm tracking-wide">DCFバリュエーション判定</h3><span class="text-2xl font-bold ${tc}">${v.verdict}</span><span class="text-gs-text-muted ml-2">${v.recommendation}</span></div>
                <div class="text-right"><div class="text-xs text-gs-text-muted mb-1">理論株価</div><div class="text-3xl font-bold text-white tracking-tight">¥${formatNumber(v.fair_value)}</div><div class="text-sm mt-1 ${v.upside_pct > 0 ? 'text-green-400' : 'text-red-400'} font-medium">${formatPercent(v.upside_pct)} vs 現在値</div></div>
            </div>`);
    }

    html += '<div class="grid grid-cols-1 lg:grid-cols-2 gap-4">';

    const proj = d.projections || {};
    if (proj.yearly) {
        let projBody = `<div class="text-xs text-gs-text-muted/60 mb-3 italic">前提: ${proj.growth_assumption || ''}</div>`;
        projBody += '<div class="overflow-x-auto -mx-1"><table class="w-full text-xs"><thead><tr class="text-gs-text-muted border-b border-gs-border"><th class="py-2 px-1 text-left font-medium">年度</th><th class="text-right py-2 px-1 font-medium">売上高</th><th class="text-right py-2 px-1 font-medium">成長率</th></tr></thead><tbody>';
        proj.yearly.forEach(y => {
            projBody += `<tr class="border-b border-gs-border/20 hover:bg-gs-border/5 transition-colors"><td class="py-2 px-1">${y.year}</td><td class="text-right py-2 px-1">${formatCurrency(y.revenue)}</td><td class="text-right py-2 px-1">${y.growth_rate_pct}%</td></tr>`;
        });
        projBody += '</tbody></table></div>';
        html += card('5年間収益予測', projBody);
    }

    const fcf = d.fcf_projections || {};
    if (fcf.yearly) {
        let fcfBody = `<div class="text-xs text-gs-text-muted/60 mb-3 italic">FCFマージン: ${fcf.fcf_margin_assumption}%</div>`;
        fcfBody += '<div class="overflow-x-auto -mx-1"><table class="w-full text-xs"><thead><tr class="text-gs-text-muted border-b border-gs-border"><th class="py-2 px-1 text-left font-medium">年度</th><th class="text-right py-2 px-1 font-medium">FCF</th><th class="text-right py-2 px-1 font-medium">マージン</th></tr></thead><tbody>';
        fcf.yearly.forEach(y => {
            fcfBody += `<tr class="border-b border-gs-border/20 hover:bg-gs-border/5 transition-colors"><td class="py-2 px-1">${y.year}</td><td class="text-right py-2 px-1">${formatCurrency(y.fcf)}</td><td class="text-right py-2 px-1">${y.fcf_margin_pct}%</td></tr>`;
        });
        fcfBody += '</tbody></table></div>';
        html += card('FCF予測', fcfBody);
    }

    const wacc = d.wacc || {};
    html += card('WACC推定', `
        ${metric('WACC', wacc.wacc_pct ? wacc.wacc_pct + '%' : 'N/A')}
        ${metric('株主資本コスト', wacc.cost_of_equity_pct ? wacc.cost_of_equity_pct + '%' : 'N/A')}
        ${metric('負債コスト', wacc.cost_of_debt_pct ? wacc.cost_of_debt_pct + '%' : 'N/A')}
        ${metric('ベータ', wacc.beta || 'N/A')}
        ${metric('リスクフリーレート', wacc.risk_free_rate_pct ? wacc.risk_free_rate_pct + '%' : 'N/A')}
        ${metric('D/E比率', wacc.debt_equity_ratio || 'N/A')}
    `);

    const tv = d.terminal_value || {};
    html += card('ターミナルバリュー', `
        <h4 class="text-xs text-gs-accent mb-2 font-semibold">${tv.perpetuity_growth?.method || ''}</h4>
        ${metric('ターミナルバリュー', formatCurrency(tv.perpetuity_growth?.terminal_value))}
        ${metric('永続成長率', tv.perpetuity_growth?.growth_rate_pct ? tv.perpetuity_growth.growth_rate_pct + '%' : 'N/A')}
        <h4 class="text-xs text-gs-accent mb-2 mt-4 font-semibold">${tv.exit_multiple?.method || ''}</h4>
        ${metric('ターミナルバリュー', formatCurrency(tv.exit_multiple?.terminal_value))}
    `);

    const val = d.valuation || {};
    html += card('企業価値・株式価値', `
        ${metric('FCF現在価値合計', formatCurrency(val.total_pv_fcf))}
        ${metric('TV現在価値（永続成長）', formatCurrency(val.pv_terminal_perpetuity))}
        ${metric('TV現在価値（マルチプル）', formatCurrency(val.pv_terminal_multiple))}
        ${metric('純有利子負債', formatCurrency(val.net_debt))}
        <div class="border-t border-gs-border/40 mt-3 pt-3">
        ${metric('1株価値（永続成長法）', val.per_share_perpetuity ? '¥' + formatNumber(val.per_share_perpetuity) : 'N/A')}
        ${metric('1株価値（マルチプル法）', val.per_share_multiple ? '¥' + formatNumber(val.per_share_multiple) : 'N/A')}
        ${metric('1株価値（平均）', val.per_share_average ? '¥' + formatNumber(val.per_share_average) : 'N/A')}
        </div>
    `);

    const sens = d.sensitivity || {};
    if (sens.table && sens.table.length > 0) {
        let sensBody = '<div class="overflow-x-auto -mx-1"><table class="w-full text-xs"><thead><tr class="text-gs-text-muted border-b border-gs-border"><th class="py-2 px-1 text-left font-medium">WACC</th>';
        (sens.growth_range || []).forEach(g => { sensBody += `<th class="text-right py-2 px-1 font-medium">g=${g}</th>`; });
        sensBody += '</tr></thead><tbody>';
        sens.table.forEach(row => {
            sensBody += `<tr class="border-b border-gs-border/20 hover:bg-gs-border/5 transition-colors"><td class="py-2 px-1 font-medium text-white">${row.wacc_pct}%</td>`;
            (sens.growth_range || []).forEach(g => {
                const key = `g_${g}`;
                const val = row[key];
                const color = d.current_price && val > d.current_price ? 'text-green-400' : 'text-red-400';
                sensBody += `<td class="text-right py-2 px-1 ${color} font-medium">¥${formatNumber(val)}</td>`;
            });
            sensBody += '</tr>';
        });
        sensBody += '</tbody></table></div>';
        sensBody += `<div class="text-xs text-gs-text-muted/60 mt-3 italic">${sens.note || ''}</div>`;
        html += card('感度分析テーブル', sensBody);
    }

    html += '</div>';
    return html;
}
