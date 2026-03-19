/**
 * GSSS - 分析結果レンダラー (Polished Design - Flask版)
 *
 * XSS 対策: テンプレートに挿入するデータは escapeHtml() でエスケープ。
 * カラーマッピング: 安全な列挙型を使用。
 */

// ── 安全なカラーマッピング ─────────────────────────────
const SAFE_COLORS = {
    green: 'bg-green-500/10 text-green-400 border border-green-500/20',
    red: 'bg-red-500/10 text-red-400 border border-red-500/20',
    yellow: 'bg-yellow-500/10 text-yellow-400 border border-yellow-500/20',
    orange: 'bg-orange-500/10 text-orange-400 border border-orange-500/20',
    'gs-accent': 'bg-gs-accent/10 text-gs-accent border border-gs-accent/20',
};
const SAFE_TEXT_COLORS = { green: 'text-green-400', red: 'text-red-400', yellow: 'text-yellow-400', orange: 'text-orange-400' };

function scoreColorText(s, m = 10) {
    const r = s / m;
    return r >= 0.7 ? 'text-green-400' : r >= 0.5 ? 'text-yellow-400' : r >= 0.3 ? 'text-orange-400' : 'text-red-400';
}

// ══════════════════════════════════════════════════════
// SVG スパークライン
// ══════════════════════════════════════════════════════
function sparkline(data, options = {}) {
    if (!data || data.length < 2) return '';
    const { width = 200, height = 48, color = '#4A9EFF', showArea = true, label = '' } = options;
    const values = data.map(d => typeof d === 'number' ? d : d.close ?? d.value ?? 0);
    const min = Math.min(...values);
    const max = Math.max(...values);
    const range = max - min || 1;
    const xStep = width / (values.length - 1);
    const points = values.map((v, i) => {
        const x = i * xStep;
        const y = height - 4 - ((v - min) / range) * (height - 8);
        return `${x.toFixed(1)},${y.toFixed(1)}`;
    });
    const pathD = `M${points.join(' L')}`;
    const areaD = `${pathD} L${width},${height} L0,${height} Z`;
    const isUp = values[values.length - 1] >= values[0];
    const lineColor = color === 'auto' ? (isUp ? '#4ade80' : '#f87171') : color;
    const areaColor = color === 'auto' ? (isUp ? '#4ade80' : '#f87171') : color;
    const startVal = values[0];
    const endVal = values[values.length - 1];
    const changePct = ((endVal - startVal) / startVal * 100).toFixed(1);
    const changeClass = endVal >= startVal ? 'price-up' : 'price-down';
    const changeSign = endVal >= startVal ? '+' : '';

    let labelHtml = '';
    if (label) {
        labelHtml = `<div class="flex justify-between items-center mb-1.5">
            <span class="text-[10px] text-gs-text-muted">${escapeHtml(label)}</span>
            <span class="text-[10px] ${changeClass} font-medium">${changeSign}${changePct}%</span>
        </div>`;
    }

    return `<div class="sparkline-container">
        ${labelHtml}
        <svg viewBox="0 0 ${width} ${height}" width="100%" height="${height}" preserveAspectRatio="none" class="overflow-visible">
            ${showArea ? `<path d="${areaD}" fill="${areaColor}" class="sparkline-area"/>` : ''}
            <path d="${pathD}" fill="none" stroke="${lineColor}" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" class="sparkline-path"/>
            <circle cx="${width}" cy="${points[points.length-1].split(',')[1]}" r="2.5" fill="${lineColor}"/>
        </svg>
    </div>`;
}

// ══════════════════════════════════════════════════════
// ヒートマップ感度分析テーブル
// ══════════════════════════════════════════════════════
function heatmapTable(sens, currentPrice) {
    if (!sens.table?.length) return '';
    const gh = sens.growth_range || [];

    let allVals = [];
    sens.table.forEach(row => gh.forEach(g => { const v = row[`g_${g}`]; if (v != null) allVals.push(v); }));
    const minVal = Math.min(...allVals);
    const maxVal = Math.max(...allVals);
    const valRange = maxVal - minVal || 1;

    let html = '<div class="overflow-x-auto -mx-1"><table class="w-full text-xs border-collapse"><thead><tr><th class="py-2 px-1.5 text-left font-medium text-gs-text-muted">WACC</th>';
    gh.forEach(g => { html += `<th class="text-center py-2 px-1.5 font-medium text-gs-text-muted">g=${escapeHtml(String(g))}</th>`; });
    html += '</tr></thead><tbody>';

    sens.table.forEach(row => {
        html += `<tr><td class="py-1.5 px-1.5 font-medium text-white text-xs">${row.wacc_pct}%</td>`;
        gh.forEach(g => {
            const key = `g_${g}`;
            const sv = row[key];
            let bgColor, textColor;
            if (currentPrice) {
                const diff = (sv - currentPrice) / currentPrice;
                if (diff > 0) {
                    const intensity = Math.min(diff / 0.5, 1);
                    bgColor = `rgba(74, 222, 128, ${(intensity * 0.3 + 0.05).toFixed(2)})`;
                    textColor = '#4ade80';
                } else {
                    const intensity = Math.min(Math.abs(diff) / 0.5, 1);
                    bgColor = `rgba(248, 113, 113, ${(intensity * 0.3 + 0.05).toFixed(2)})`;
                    textColor = '#f87171';
                }
            } else {
                const norm = (sv - minVal) / valRange;
                bgColor = `rgba(74, 158, 255, ${(norm * 0.2 + 0.05).toFixed(2)})`;
                textColor = '#C8D6E5';
            }
            html += `<td class="heatmap-cell text-center py-1.5 px-1 rounded" style="background:${bgColor}">
                <span style="color:${textColor}" class="font-medium text-[11px]">¥${formatNumber(sv)}</span>
            </td>`;
        });
        html += '</tr>';
    });
    html += `</tbody></table></div>`;
    if (currentPrice) {
        html += `<div class="flex items-center gap-3 mt-3 text-[10px] text-gs-text-muted/60">
            <span class="flex items-center gap-1"><span class="w-3 h-3 rounded" style="background:rgba(74,222,128,0.25)"></span>割安</span>
            <span class="flex items-center gap-1"><span class="w-3 h-3 rounded" style="background:rgba(248,113,113,0.25)"></span>割高</span>
            <span class="ml-auto italic">${escapeHtml(sens.note || '')}</span>
        </div>`;
    }
    return html;
}

// ── テーブルヘルパー ──────────────────────────────────
function renderTable(headers, rows) {
    let html = '<div class="overflow-x-auto -mx-1"><table class="w-full text-xs"><thead><tr class="text-gs-text-muted border-b border-gs-border">';
    headers.forEach(h => { html += `<th class="py-2 px-1 font-medium ${h.align === 'right' ? 'text-right' : 'text-left'}">${escapeHtml(h.label)}</th>`; });
    html += '</tr></thead><tbody>';
    rows.forEach(row => {
        html += '<tr class="border-b border-gs-border/20 hover:bg-gs-border/5 transition-colors">';
        row.forEach((cell, i) => {
            const align = headers[i]?.align === 'right' ? 'text-right' : '';
            const cls = cell.class || '';
            html += `<td class="py-2 px-1 ${align} ${cls}">${cell.html ?? escapeHtml(cell.text ?? cell)}</td>`;
        });
        html += '</tr>';
    });
    html += '</tbody></table></div>';
    return html;
}

// ── メインディスパッチ ──────────────────────────────
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
                    ${data.company_name ? `<p class="text-gs-text-muted mt-0.5">${escapeHtml(data.company_name)} <span class="text-gs-accent/70">(${escapeHtml(data.ticker)})</span></p>` : ''}
                </div>
            </div>
            ${priceHtml}
        </div>`;

    const renderers = {
        goldman: renderGoldman, morgan_technical: renderMorganTechnical,
        bridgewater: renderBridgewater, jpmorgan: renderJPMorgan,
        blackrock: renderBlackRock, citadel: renderCitadel,
        renaissance: renderRenaissance, vanguard: renderVanguard,
        mckinsey: renderMcKinsey, morgan_dcf: renderMorganDCF,
        academic_quant: renderAcademicQuant, chart_pattern: renderChartPattern,
    };
    const render = renderers[type];
    const content = render ? render(data) : `<pre class="text-xs overflow-auto p-4 bg-gs-darker rounded-xl">${escapeHtml(JSON.stringify(data, null, 2))}</pre>`;
    return header + content;
}

// === カードヘルパー ===
function card(title, body) {
    return `<div class="card-elevated rounded-2xl p-5 sm:p-6 mb-4 fade-in">
        <h3 class="text-white font-semibold mb-4 text-sm flex items-center gap-2">
            <span class="w-1 h-4 bg-gs-border-light rounded-full"></span>
            ${escapeHtml(title)}
        </h3>
        <div class="space-y-0">${body}</div>
    </div>`;
}

function metric(label, value, sub = '') {
    return `<div class="py-2.5 flex justify-between items-center border-b border-gs-border/30 last:border-0">
        <span class="text-gs-text-muted text-sm">${escapeHtml(label)}</span>
        <div class="text-right flex items-center gap-1">
            <span class="text-white font-medium text-sm">${value}</span>${sub ? `<span class="text-gs-text-muted text-xs ml-1.5">${sub}</span>` : ''}
        </div>
    </div>`;
}

function badge(text, color = 'gs-accent') {
    return `<span class="text-xs px-2.5 py-0.5 rounded-md font-medium ${SAFE_COLORS[color] || SAFE_COLORS['gs-accent']}">${escapeHtml(text)}</span>`;
}

function scoreBar(score, max, label = '') {
    const pct = Math.min((score / max) * 100, 100);
    const color = scoreColor(score, max);
    const textCl = scoreColorText(score, max);
    return `<div class="mb-3">
        <div class="flex justify-between text-xs mb-1.5">
            <span class="text-gs-text-muted">${escapeHtml(label)}</span>
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
    const cl = typeof colorFn === 'function' ? colorFn(score) : scoreColorText(score, max);
    return `<div class="text-center py-2">
        <div class="text-5xl font-bold ${cl} leading-none">${score ?? 'N/A'}</div>
        <div class="text-gs-text-muted text-sm mt-1">/ ${max}</div>
        ${label ? `<div class="text-sm mt-2 ${cl} font-medium">${escapeHtml(label)}</div>` : ''}
    </div>`;
}

// === Goldman Sachs ===
function renderGoldman(d) {
    const pe = d.pe_analysis || {};
    const debt = d.debt_analysis || {};
    const div = d.dividend_analysis || {};
    const moat = d.moat_rating || {};
    const pt = d.price_targets || {};
    const risk = d.risk_rating || {};
    const ez = d.entry_zones || {};
    const rev = d.revenue_growth || {};

    let html = '<div class="grid grid-cols-1 lg:grid-cols-2 gap-4">';
    html += card('P/E比率分析', `${metric('現在PER', pe.current_pe != null ? pe.current_pe + '倍' : 'N/A')}${metric('フォワードPER', pe.forward_pe != null ? pe.forward_pe + '倍' : 'N/A')}${metric('評価', pe.assessment || 'N/A')}${scoreBar(pe.score || 5, 10, 'バリュエーション')}`);
    html += card('負債健全性チェック', `${metric('D/Eレシオ', debt.debt_to_equity != null ? debt.debt_to_equity + '倍' : 'N/A')}${metric('総負債', formatCurrency(debt.total_debt))}${metric('手元現金', formatCurrency(debt.total_cash))}${metric('健全性', debt.health || 'N/A')}${scoreBar(debt.score || 5, 10, '財務健全性')}`);
    html += card('配当分析', `${metric('配当利回り', div.yield_pct != null ? div.yield_pct + '%' : '0%')}${metric('年間配当', div.annual_rate ? '¥' + formatNumber(div.annual_rate) : 'N/A')}${metric('配当性向', div.payout_ratio_pct != null ? div.payout_ratio_pct + '%' : 'N/A')}${metric('持続可能性', div.sustainability || 'N/A')}${scoreBar(div.score || 5, 10, '配当安全性')}`);
    html += card('競争優位性（モート）', `<div class="text-center mb-4"><span class="text-2xl text-white font-bold">${escapeHtml(moat.rating || 'N/A')}</span></div>${scoreBar(moat.score || 0, moat.max_score || 11, 'モートスコア')}<div class="mt-3 space-y-1.5">${(moat.reasons || []).map(r => `<div class="text-xs text-gs-text-muted flex gap-1.5"><span class="text-gs-accent/60">&#x2022;</span>${escapeHtml(r)}</div>`).join('')}</div>`);
    html += card('12ヶ月価格ターゲット', `${metric('強気ケース', pt.bull_target ? '¥' + formatNumber(pt.bull_target) : 'N/A', pt.upside_pct != null ? formatPercent(pt.upside_pct) : '')}${metric('ベースケース', pt.base_target ? '¥' + formatNumber(pt.base_target) : 'N/A')}${metric('弱気ケース', pt.bear_target ? '¥' + formatNumber(pt.bear_target) : 'N/A', pt.downside_pct != null ? formatPercent(pt.downside_pct) : '')}${pt.estimated ? '<div class="text-xs text-gs-text-muted/60 mt-3 italic">※推定値（アナリスト目標価格なし）</div>' : ''}`);
    html += card('リスク評価', `${bigScore(risk.score || 'N/A', 10, null, riskColor)}<div class="mt-3 space-y-1.5">${(risk.reasons || []).map(r => `<div class="text-xs text-gs-text-muted flex gap-1.5"><span class="text-gs-accent/60">&#x2022;</span>${escapeHtml(r)}</div>`).join('')}</div>`);
    html += card('エントリー価格ゾーン', `${metric('積極的エントリー', ez.aggressive_entry ? '¥' + formatNumber(ez.aggressive_entry) : 'N/A')}${metric('理想的エントリー', ez.ideal_entry ? '¥' + formatNumber(ez.ideal_entry) : 'N/A')}${metric('保守的エントリー', ez.conservative_entry ? '¥' + formatNumber(ez.conservative_entry) : 'N/A')}${metric('ストップロス', ez.stop_loss ? '¥' + formatNumber(ez.stop_loss) : 'N/A', ez.stop_loss_pct != null ? ez.stop_loss_pct + '%' : '')}${metric('サポートライン', ez.support ? '¥' + formatNumber(ez.support) : 'N/A')}${metric('レジスタンスライン', ez.resistance ? '¥' + formatNumber(ez.resistance) : 'N/A')}`);
    html += card('収益成長トレンド', `${metric('トレンド', rev.trend || 'N/A')}${(rev.growth_rates || []).map((r, i) => metric(rev.years?.[i] || '', formatPercent(r))).join('')}`);
    html += '</div>';
    if (d.summary) html += `<div class="banner-glow rounded-2xl p-5 sm:p-6 mt-4"><p class="text-white leading-relaxed">${escapeHtml(d.summary)}</p></div>`;
    return html;
}

// === Morgan Stanley Technical ===
function renderMorganTechnical(d) {
    let html = '';
    const ts = d.trade_setup || {};
    if (ts.entry) {
        html += bannerCard(`<h3 class="text-gs-accent font-bold mb-4 text-sm tracking-wide">トレードセットアップ</h3>
            <div class="grid grid-cols-2 md:grid-cols-5 gap-3 sm:gap-4 text-center">
                <div class="bg-gs-darker/60 rounded-xl p-3"><div class="text-[10px] text-gs-text-muted mb-1">方向</div><div class="text-white font-bold text-lg">${escapeHtml(ts.direction)}</div></div>
                <div class="bg-gs-darker/60 rounded-xl p-3"><div class="text-[10px] text-gs-text-muted mb-1">エントリー</div><div class="text-white font-bold">¥${formatNumber(ts.entry)}</div></div>
                <div class="bg-gs-darker/60 rounded-xl p-3"><div class="text-[10px] text-gs-text-muted mb-1">ストップロス</div><div class="text-red-400 font-bold">¥${formatNumber(ts.stop_loss)}</div></div>
                <div class="bg-gs-darker/60 rounded-xl p-3"><div class="text-[10px] text-gs-text-muted mb-1">利確目標1</div><div class="text-green-400 font-bold">¥${formatNumber(ts.target_1)}</div></div>
                <div class="bg-gs-darker/60 rounded-xl p-3"><div class="text-[10px] text-gs-text-muted mb-1">R/R比率</div><div class="text-gs-gold font-bold">${ts.risk_reward_ratio}</div></div>
            </div>`);
    }
    html += '<div class="grid grid-cols-1 lg:grid-cols-2 gap-4">';
    const tr = d.trend || {};
    html += card('トレンド分析', `${metric('主要トレンド', tr.primary || 'N/A')}${metric('日足トレンド', tr.daily || 'N/A')}${metric('週足トレンド', tr.weekly || 'N/A')}${metric('月足トレンド', tr.monthly || 'N/A')}${tr.crossover ? metric('クロスオーバー', tr.crossover) : ''}`);
    const rsi = d.rsi_analysis || {};
    html += card('RSI (14日)', `<div class="text-center mb-4"><span class="text-4xl font-bold text-white">${rsi.value ?? 'N/A'}</span></div>${metric('判定', rsi.interpretation || 'N/A')}${metric('シグナル', rsi.signal || 'N/A')}`);
    const ma = d.ma_analysis || {};
    html += card('移動平均分析', `${metric('総合判定', ma.overall || 'N/A')}${Object.entries(ma.moving_averages || {}).map(([k, v]) => metric(k + '移動平均', '¥' + formatNumber(v.value), v.position === '上' ? '<span class="text-green-400">&#x2191;上</span>' : '<span class="text-red-400">&#x2193;下</span>')).join('')}`);
    const macd = d.macd_analysis || {};
    html += card('MACD分析', `${metric('MACD', macd.macd !== undefined ? macd.macd : 'N/A')}${metric('シグナル', macd.signal !== undefined ? macd.signal : 'N/A')}${metric('ヒストグラム', macd.histogram !== undefined ? macd.histogram : 'N/A')}${metric('クロスオーバー', macd.crossover || 'N/A')}${metric('モメンタム', macd.momentum || 'N/A')}`);
    const bb = d.bb_analysis || {};
    html += card('ボリンジャーバンド', `${metric('上限バンド', bb.upper ? '¥' + formatNumber(bb.upper) : 'N/A')}${metric('中央線', bb.middle ? '¥' + formatNumber(bb.middle) : 'N/A')}${metric('下限バンド', bb.lower ? '¥' + formatNumber(bb.lower) : 'N/A')}${metric('ポジション', bb.position || 'N/A')}${metric('バンド幅', bb.squeeze_status || 'N/A')}`);
    const vol = d.volume_analysis || {};
    html += card('出来高分析', `${metric('現在の出来高', vol.current_volume ? formatNumber(vol.current_volume) : 'N/A')}${metric('20日平均', vol.avg_volume_20d ? formatNumber(vol.avg_volume_20d) : 'N/A')}${metric('出来高比率', vol.ratio ? vol.ratio + 'x' : 'N/A')}${metric('判定', vol.interpretation || 'N/A')}`);
    const fib = d.fibonacci || {};
    if (fib.high) html += card('フィボナッチリトレースメント', `${metric('高値', '¥' + formatNumber(fib.high))}${metric('23.6%', '¥' + formatNumber(fib.level_236))}${metric('38.2%', '¥' + formatNumber(fib.level_382))}${metric('50.0%', '¥' + formatNumber(fib.level_500))}${metric('61.8%', '¥' + formatNumber(fib.level_618))}${metric('安値', '¥' + formatNumber(fib.low))}`);
    const pat = d.pattern || {};
    html += card('チャートパターン', `${metric('パターン', pat.pattern || 'N/A')}${metric('説明', pat.description || 'N/A')}${pat.signal ? metric('シグナル', pat.signal) : ''}`);
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
                <div class="flex items-baseline gap-2"><span class="text-3xl font-bold ${riskColor(dash.total_risk_score || 5)}">${dash.total_risk_score}/10</span><span class="text-gs-text-muted text-sm">${escapeHtml(dash.overall_risk)}</span></div>
            </div>
            <div class="grid grid-cols-2 md:grid-cols-4 gap-3">${Object.entries(dash.metrics).map(([k, v]) => {
                const tc = SAFE_TEXT_COLORS[v.color] || 'text-white';
                return `<div class="text-center p-3 sm:p-4 bg-gs-darker/60 rounded-xl"><div class="text-[10px] text-gs-text-muted mb-1.5">${escapeHtml(k)}</div><div class="text-2xl font-bold ${tc}">${v.score}/10</div><div class="text-[10px] text-gs-text-muted mt-1">${escapeHtml(v.label)}</div></div>`;
            }).join('')}</div>`);
    }
    html += '<div class="grid grid-cols-1 lg:grid-cols-2 gap-4">';
    const vol = d.volatility || {};
    html += card('ボラティリティプロファイル', `${metric('日次ボラティリティ', vol.daily_pct ? vol.daily_pct + '%' : 'N/A')}${metric('年間ボラティリティ', vol.annual_pct ? vol.annual_pct + '%' : 'N/A')}${metric('リスクレベル', vol.level || 'N/A')}${metric('95%VaR（日次）', vol.percentile_95_daily_loss ? vol.percentile_95_daily_loss + '%' : 'N/A')}`);
    const beta = d.beta_analysis || {};
    html += card('ベータ分析（対日経225）', `${metric('ベータ', beta.beta !== null ? beta.beta : 'N/A')}${metric('上昇時ベータ', beta.up_beta !== undefined ? beta.up_beta : 'N/A')}${metric('下降時ベータ', beta.down_beta !== undefined ? beta.down_beta : 'N/A')}${metric('相関係数', beta.correlation !== undefined ? beta.correlation : 'N/A')}${metric('解釈', beta.interpretation || 'N/A')}`);
    const dd = d.drawdown || {};
    html += card('最大ドローダウン', `${metric('最大ドローダウン', dd.max_drawdown_pct ? dd.max_drawdown_pct + '%' : 'N/A')}${metric('発生日', dd.max_drawdown_date || 'N/A')}${metric('回復期間', dd.recovery_days !== undefined ? dd.recovery_days + (typeof dd.recovery_days === 'number' ? '日' : '') : 'N/A')}`);
    const st = d.stress_test || {};
    if (st.scenarios) {
        let stBody = metric('現在価格', '¥' + formatNumber(st.current_price));
        for (const [name, scenario] of Object.entries(st.scenarios)) { stBody += metric(name, '¥' + formatNumber(scenario.estimated_price), `<span class="text-red-400">${scenario.loss_pct}%</span>`); }
        html += card('リセッションストレステスト', stBody);
    }
    const ir = d.interest_sensitivity || {};
    html += card('金利感応度', `${metric('感応度レベル', ir.level || 'N/A')}${metric('影響', ir.impact || 'N/A')}`);
    const liq = d.liquidity || {};
    html += card('流動性リスク', `${metric('平均日次出来高', liq.avg_daily_volume ? formatNumber(liq.avg_daily_volume) : 'N/A')}${metric('流動性レベル', liq.liquidity_level || 'N/A')}${metric('ビッドアスクスプレッド', liq.bid_ask_spread_pct ? liq.bid_ask_spread_pct + '%' : 'N/A')}`);
    const hedge = d.hedge_recommendation || {};
    html += card('ヘッジ推奨', `${(hedge.strategies || []).map(s => `<div class="py-2.5 text-sm border-b border-gs-border/30 last:border-0 text-gs-text-muted">${escapeHtml(s)}</div>`).join('')}`);
    html += '</div>';
    return html;
}

// === JPMorgan Earnings ===
function renderJPMorgan(d) {
    let html = '<div class="grid grid-cols-1 lg:grid-cols-2 gap-4">';
    const eh = d.earnings_history || {};
    let ehBody = `<p class="text-sm text-gs-text-muted mb-4">${escapeHtml(eh.summary || '')}</p>`;
    if (eh.quarters && eh.quarters.length > 0) {
        ehBody += renderTable(
            [{ label: '日付' }, { label: '予想EPS', align: 'right' }, { label: '実績EPS', align: 'right' }, { label: 'サプライズ', align: 'right' }],
            eh.quarters.map(q => {
                const color = q.beat === true ? 'text-green-400' : q.beat === false ? 'text-red-400' : '';
                return [{ text: q.date, class: color }, { text: q.eps_estimate ?? 'N/A', class: color }, { text: q.eps_actual ?? 'N/A', class: color }, { text: q.surprise_pct ? q.surprise_pct + '%' : 'N/A', class: color }];
            }),
        );
    }
    html += card('決算履歴', ehBody);
    const con = d.consensus || {};
    html += card('コンセンサス予想', `${metric('フォワードEPS', con.forward_eps ?? 'N/A')}${metric('トレイリングEPS', con.trailing_eps ?? 'N/A')}${metric('フォワードPE', con.forward_pe ? con.forward_pe.toFixed(1) + '倍' : 'N/A')}${metric('PEGレシオ', con.peg_ratio ?? 'N/A')}${metric('EPS成長率', con.earnings_growth ? formatPercent(con.earnings_growth * 100) : 'N/A')}${metric('売上成長率', con.revenue_growth ? formatPercent(con.revenue_growth * 100) : 'N/A')}${metric('アナリスト推奨', con.recommendation || 'N/A')}${metric('アナリスト数', con.num_analysts ?? 'N/A')}`);
    const km = d.key_metrics || [];
    html += card('注目すべき指標', `${km.map(m => metric(m.name, m.value, badge(m.importance, m.importance === '高' ? 'red' : 'yellow'))).join('')}`);
    const im = d.implied_move || {};
    html += card('決算日の想定値動き', `${metric('推定変動幅', im.estimated_move_pct ? '±' + im.estimated_move_pct + '%' : 'N/A')}${metric('過去の大きな値動き（平均）', im.avg_large_move_pct ? im.avg_large_move_pct + '%' : 'N/A')}${metric('最大単日変動', im.max_single_day_move_pct ? im.max_single_day_move_pct + '%' : 'N/A')}`);
    const pos = d.positioning || {};
    if (pos.strategies) {
        let posBody = '';
        pos.strategies.forEach(s => {
            const actionColor = s.action.includes('買い') ? 'green' : s.action.includes('売り') ? 'red' : 'yellow';
            posBody += `<div class="py-3 border-b border-gs-border/30 last:border-0"><div class="flex items-center gap-2 mb-1.5">${badge(s.timing)} ${badge(s.action, actionColor)}</div><p class="text-xs text-gs-text-muted leading-relaxed">${escapeHtml(s.reason)}</p></div>`;
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
    html += card('配当利回り分析', `${metric('現在利回り', ya.current_yield_pct ? ya.current_yield_pct + '%' : '0%')}${metric('5年平均利回り', ya.five_year_avg_yield ? ya.five_year_avg_yield + '%' : 'N/A')}${metric('年間配当', ya.dividend_rate ? '¥' + formatNumber(ya.dividend_rate) : 'N/A')}${metric('評価', ya.assessment || 'N/A')}`);
    const sf = d.safety || {};
    const sfColor = sf.score >= 7 ? 'text-green-400' : sf.score >= 5 ? 'text-yellow-400' : 'text-red-400';
    html += card('配当安全性スコア', `${bigScore(sf.score, 10, sf.label, () => sfColor)}${scoreBar(sf.score || 0, 10, '安全性')}<div class="mt-2 space-y-1">${(sf.reasons || []).map(r => `<div class="text-xs text-gs-text-muted flex gap-1.5"><span class="text-gs-accent/60">&#x2022;</span>${escapeHtml(r)}</div>`).join('')}</div>`);
    const ga = d.growth_analysis || {};
    html += card('配当成長履歴', `${metric('連続増配年数', ga.consecutive_increases + '年')}${metric('CAGR', ga.cagr_pct ? ga.cagr_pct + '%' : 'N/A')}${metric('ステータス', ga.status || 'N/A')}${Object.entries(ga.annual_dividends || {}).map(([y, v]) => metric(y + '年', '¥' + formatNumber(v, 2))).join('')}`);
    const ip = d.income_projection || {};
    html += card('配当収入予測', `${metric('投資金額', formatCurrency(d.investment_amount))}${metric('初年度配当収入', formatCurrency(ip.initial_annual_income))}${metric('10年後配当収入', formatCurrency(ip.year_10_income))}${metric('20年後配当収入', formatCurrency(ip.year_20_income))}${metric('想定成長率', ip.assumed_growth_rate_pct ? ip.assumed_growth_rate_pct + '%/年' : 'N/A')}`);
    const drip = d.drip || {};
    if (drip.year_10) {
        html += card('DRIP再投資シミュレーション', `${metric('初期株数', drip.initial_shares ? drip.initial_shares + '株' : 'N/A')}${metric('10年後株数', drip.year_10.shares + '株')}${metric('10年後評価額', formatCurrency(drip.year_10.total_value))}${metric('10年後累計配当', formatCurrency(drip.year_10.cumulative_dividends))}${drip.year_20 ? metric('20年後評価額', formatCurrency(drip.year_20.total_value)) : ''}${metric('20年間トータルリターン', drip.total_return_20y ? '+' + drip.total_return_20y + '%' : 'N/A')}<div class="text-xs text-gs-text-muted/60 mt-3 italic">前提: ${escapeHtml(drip.assumptions ? drip.assumptions.price_growth + ' / 配当' + drip.assumptions.dividend_growth : '')}</div>`);
    }
    const yt = d.yield_trap || {};
    html += card('イールドトラップチェック', `<div class="mb-3">${yt.is_potential_trap ? badge('要注意', 'red') : badge('問題なし', 'green')}</div>${(yt.warnings || []).map(w => `<div class="text-xs py-1 flex gap-1.5 ${yt.is_potential_trap ? 'text-red-400' : 'text-gs-text-muted'}"><span>&#x2022;</span>${escapeHtml(w)}</div>`).join('')}`);
    const ex = d.ex_dividend || {};
    html += card('配当落ち日', `${metric('次回配当落ち日', ex.ex_dividend_date || '未定')}${metric('配当額', ex.dividend_rate ? '¥' + formatNumber(ex.dividend_rate) : 'N/A')}${ex.note ? `<div class="text-xs text-gs-text-muted/60 mt-3 italic">${escapeHtml(ex.note)}</div>` : ''}`);
    html += '</div>';
    return html;
}

// === Citadel Sector ===
function renderCitadel(d) {
    let html = '';
    const cycle = d.economic_cycle || {};
    html += bannerCard(`<h3 class="text-gs-accent font-bold mb-2 text-sm tracking-wide">経済サイクル: <span class="text-white text-base">${escapeHtml(cycle.phase || 'N/A')}</span></h3>
        <p class="text-sm text-gs-text-muted mb-4 leading-relaxed">${escapeHtml(cycle.description || '')}</p>
        <div class="grid grid-cols-2 gap-4 text-sm">
            <div class="bg-gs-darker/60 rounded-xl p-3">${metric('日経平均', cycle.nikkei_current ? '¥' + formatNumber(cycle.nikkei_current) : 'N/A')}</div>
            <div class="bg-gs-darker/60 rounded-xl p-3">${metric('200日移動平均', cycle.nikkei_sma200 ? '¥' + formatNumber(cycle.nikkei_sma200) : 'N/A')}</div>
        </div>`);
    html += '<div class="grid grid-cols-1 lg:grid-cols-2 gap-4">';
    const sp = d.sector_performance || [];
    if (sp.length > 0) {
        html += card('セクターパフォーマンスランキング', renderTable(
            [{ label: 'セクター' }, { label: '1ヶ月', align: 'right' }, { label: '3ヶ月', align: 'right' }, { label: '6ヶ月', align: 'right' }],
            sp.map(s => [
                { text: s.sector },
                { text: s.return_1m !== null ? formatPercent(s.return_1m) : 'N/A', class: s.return_1m > 0 ? 'text-green-400' : 'text-red-400' },
                { text: s.return_3m !== null ? formatPercent(s.return_3m) : 'N/A', class: s.return_3m > 0 ? 'text-green-400' : 'text-red-400' },
                { text: formatPercent(s.return_6m), class: s.return_6m > 0 ? 'text-green-400' : 'text-red-400' },
            ]),
        ));
    }
    const rot = d.rotation_recommendation || {};
    let rotBody = `<p class="text-sm mb-4">ポジショニング: ${badge(rot.positioning || 'N/A', rot.positioning === 'リスクオン' ? 'green' : 'yellow')}</p>`;
    rotBody += '<div class="mb-4"><h4 class="text-xs text-green-400 mb-2 font-semibold tracking-wide">オーバーウェイト</h4>';
    (rot.overweight || []).forEach(o => { rotBody += `<div class="text-xs py-1.5 border-b border-gs-border/20 last:border-0 text-gs-text-muted">${escapeHtml(o.sector)} &mdash; ${escapeHtml(o.reason)} ${badge(o.conviction)}</div>`; });
    rotBody += '</div><div><h4 class="text-xs text-red-400 mb-2 font-semibold tracking-wide">アンダーウェイト</h4>';
    (rot.underweight || []).forEach(o => { rotBody += `<div class="text-xs py-1.5 border-b border-gs-border/20 last:border-0 text-gs-text-muted">${escapeHtml(o.sector)} &mdash; ${escapeHtml(o.reason)}</div>`; });
    rotBody += '</div>';
    html += card('セクターローテーション推奨', rotBody);
    const alloc = d.model_allocation || {};
    html += card('モデルアロケーション', `${Object.entries(alloc.allocation || {}).map(([k, v]) => `<div class="mb-3"><div class="flex justify-between text-xs mb-1.5"><span class="text-gs-text-muted">${escapeHtml(k)}</span><span class="text-white font-medium">${v}%</span></div><div class="w-full bg-gs-darker rounded-full h-2 overflow-hidden"><div class="bg-gs-accent h-2 rounded-full score-bar" style="width:${v}%"></div></div></div>`).join('')}<div class="text-xs text-gs-text-muted/60 mt-3 italic">${escapeHtml(alloc.note || '')}</div>`);
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
        <div class="text-center mb-5"><span class="text-lg font-semibold ${csColor}">${escapeHtml(cs.rating || '')} &mdash; ${escapeHtml(cs.recommendation || '')}</span></div>
        <div class="grid grid-cols-5 gap-2 sm:gap-3">${Object.entries(cs.factor_scores || {}).map(([k, v]) => `<div class="text-center p-2 sm:p-3 bg-gs-darker/60 rounded-xl"><div class="text-[10px] text-gs-text-muted mb-1">${escapeHtml(k)}</div><div class="text-lg sm:text-xl font-bold text-white">${v}</div><div class="text-[10px] text-gs-text-muted mt-0.5">${escapeHtml(cs.weights?.[k] || '')}</div></div>`).join('')}</div>`);
    html += '<div class="grid grid-cols-1 lg:grid-cols-2 gap-4">';
    [['value_factors', 'バリューファクター'], ['quality_factors', 'クオリティファクター'], ['momentum_factors', 'モメンタムファクター'], ['growth_factors', '成長ファクター'], ['sentiment_factors', 'センチメントファクター']].forEach(([key, name]) => {
        const f = d[key] || {};
        html += card(`${name} (${f.score || 0}/100)`, `${scoreBar(f.score || 0, 100, name)}<div class="space-y-1.5">${(f.details || []).map(detail => `<div class="text-xs text-gs-text-muted flex gap-1.5"><span class="text-gs-accent/60">&#x2022;</span>${escapeHtml(detail)}</div>`).join('')}</div>`);
    });
    html += '</div>';
    return html;
}

// === Vanguard ETF ===
function renderVanguard(d) {
    let html = bannerCard(`<div class="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4 text-center">
        <div class="bg-gs-darker/60 rounded-xl p-3 sm:p-4"><div class="text-[10px] text-gs-text-muted mb-1">リスクプロファイル</div><div class="text-white font-bold text-lg">${escapeHtml(d.risk_profile)}</div></div>
        <div class="bg-gs-darker/60 rounded-xl p-3 sm:p-4"><div class="text-[10px] text-gs-text-muted mb-1">投資金額</div><div class="text-white font-bold">${formatCurrency(d.investment_amount)}</div></div>
        <div class="bg-gs-darker/60 rounded-xl p-3 sm:p-4"><div class="text-[10px] text-gs-text-muted mb-1">年齢</div><div class="text-white font-bold">${d.age}歳</div></div>
        <div class="bg-gs-darker/60 rounded-xl p-3 sm:p-4"><div class="text-[10px] text-gs-text-muted mb-1">期待リターン</div><div class="text-green-400 font-bold">${d.expected_return?.expected_annual_return_pct}%/年</div></div>
    </div>`);
    html += '<div class="grid grid-cols-1 lg:grid-cols-2 gap-4">';
    const det = d.detailed_allocation || {};
    html += card('アセットアロケーション', `${Object.entries(det).map(([k, v]) => `<div class="mb-3"><div class="flex justify-between text-xs mb-1.5"><span class="text-gs-text-muted">${escapeHtml(k)}</span><span class="text-white font-medium">${v}%</span></div><div class="w-full bg-gs-darker rounded-full h-2 overflow-hidden"><div class="bg-gs-accent h-2 rounded-full score-bar" style="width:${v * 1.5}%"></div></div></div>`).join('')}`);
    const etfs = d.etf_picks || [];
    html += card('推奨ETF一覧', renderTable(
        [{ label: 'ETF' }, { label: '配分', align: 'right' }, { label: '金額', align: 'right' }, { label: '信託報酬', align: 'right' }],
        etfs.map(e => [{ html: `<div class="font-medium text-white">${escapeHtml(e.name)}</div><div class="text-gs-text-muted/60">${escapeHtml(e.ticker)}</div>` }, { text: e.allocation_pct + '%' }, { text: '¥' + formatNumber(e.amount) }, { text: e.expense_ratio + '%' }]),
    ));
    const rb = d.rebalance_rules || {};
    html += card('リバランスルール', `${metric('頻度', rb.frequency || 'N/A')}${metric('閾値', rb.threshold_pct ? '±' + rb.threshold_pct + '%' : 'N/A')}${(rb.rules || []).map(r => `<div class="text-xs text-gs-text-muted py-1 flex gap-1.5"><span class="text-gs-accent/60">&#x2022;</span>${escapeHtml(r)}</div>`).join('')}`);
    const tax = d.tax_optimization || {};
    html += card('税務最適化', `<div class="mb-4"><h4 class="text-xs text-gs-accent mb-2 font-semibold">NISA口座推奨</h4>${(tax.nisa_account?.recommended || []).map(n => `<div class="text-xs text-gs-text-muted flex gap-1.5"><span class="text-gs-accent/60">&#x2022;</span>${escapeHtml(n)}</div>`).join('')}<div class="text-xs text-gs-text-muted/60 mt-1.5 italic">${escapeHtml(tax.nisa_account?.reason || '')}</div></div><div><h4 class="text-xs text-gs-accent mb-2 font-semibold">特定口座推奨</h4>${(tax.tokutei_account?.recommended || []).map(n => `<div class="text-xs text-gs-text-muted flex gap-1.5"><span class="text-gs-accent/60">&#x2022;</span>${escapeHtml(n)}</div>`).join('')}<div class="text-xs text-gs-text-muted/60 mt-1.5 italic">${escapeHtml(tax.tokutei_account?.reason || '')}</div></div>${(tax.notes || []).map(n => `<div class="text-xs text-gs-text-muted/50 mt-2">※ ${escapeHtml(n)}</div>`).join('')}`);
    const dca = d.dca_plan || {};
    html += card('ドルコスト平均法計画', `${metric('月次投資額合計', formatCurrency(dca.total_monthly))}${(dca.allocation || []).map(a => metric(a.etf, '¥' + formatNumber(a.monthly_amount) + '/月')).join('')}<div class="text-xs text-gs-text-muted/60 mt-3 italic">${escapeHtml(dca.strategy || '')}</div>`);
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
    html += card('金利環境分析', `${metric('米10年債利回り', ir.us_10y_yield ? ir.us_10y_yield + '%' : 'N/A')}${metric('環境', ir.environment || 'N/A')}${Object.entries(ir.impact || {}).map(([k, v]) => metric(k, v)).join('')}<div class="text-xs text-gs-text-muted/60 mt-3 italic">${escapeHtml(ir.outlook || '')}</div>`);
    const cur = d.currency_analysis || {};
    html += card('為替分析', `${metric('USD/JPY', cur.usdjpy ? '¥' + cur.usdjpy : 'N/A')}${metric('1ヶ月変動', cur.change_1m_pct ? formatPercent(cur.change_1m_pct) : 'N/A')}${metric('状況', cur.yen_status || 'N/A')}${metric('影響', cur.impact || 'N/A')}${cur.beneficiaries?.length ? '<div class="mt-3 text-xs text-green-400 flex gap-1"><span class="font-semibold">恩恵:</span> ' + cur.beneficiaries.map(escapeHtml).join(', ') + '</div>' : ''}${cur.losers?.length ? '<div class="text-xs text-red-400 flex gap-1 mt-1"><span class="font-semibold">逆風:</span> ' + cur.losers.map(escapeHtml).join(', ') + '</div>' : ''}`);
    const sr = d.sector_recommendation || [];
    let srBody = '';
    sr.forEach(s => {
        const color = s.stance.includes('オーバー') ? 'green' : s.stance.includes('アンダー') ? 'red' : 'yellow';
        srBody += `<div class="py-2.5 border-b border-gs-border/20 last:border-0"><div class="flex justify-between items-center"><span class="text-sm text-white">${escapeHtml(s.sector)}</span><div>${badge(s.stance, color)}</div></div><div class="text-xs text-gs-text-muted mt-1">${escapeHtml(s.reason)}</div></div>`;
    });
    html += card('セクター推奨', srBody);
    const gr = d.global_risks || [];
    let grBody = '';
    gr.forEach(r => {
        const color = r.severity.includes('高') ? 'red' : r.severity.includes('中') ? 'orange' : 'yellow';
        grBody += `<div class="py-2.5 border-b border-gs-border/20 last:border-0"><div class="flex justify-between items-center"><span class="text-sm text-white">${escapeHtml(r.risk)}</span>${badge(r.severity, color)}</div><div class="text-xs text-gs-text-muted mt-1">${escapeHtml(r.impact)}</div></div>`;
    });
    html += card('グローバルリスクファクター', grBody);
    html += card('影響タイムライン', `${(d.timeline || []).map(t => `<div class="py-2.5 border-b border-gs-border/20 last:border-0"><div class="text-sm text-gs-accent font-medium">${escapeHtml(t.period)}</div><div class="text-xs text-gs-text-muted mt-0.5">${escapeHtml(t.focus)}</div></div>`).join('')}`);
    const adj = d.portfolio_adjustments || {};
    html += card('ポートフォリオ調整提案', `<div class="space-y-1.5">${(adj.recommended_actions || []).map(a => `<div class="text-xs text-gs-text-muted flex gap-1.5"><span class="text-gs-accent/60">&#x2022;</span>${escapeHtml(a)}</div>`).join('')}</div><div class="mt-4 p-4 bg-gs-darker/60 rounded-xl text-sm text-white leading-relaxed">${escapeHtml(adj.overall_stance || '')}</div>`);
    html += '</div>';
    return html;
}

// === Morgan Stanley DCF ===
function renderMorganDCF(d) {
    let html = '';
    const v = d.verdict || {};
    if (v.verdict) {
        const color = v.upside_pct > 10 ? 'green' : v.upside_pct > -10 ? 'yellow' : 'red';
        const tc = SAFE_TEXT_COLORS[color] || 'text-white';
        html += bannerCard(`<div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div><h3 class="text-gs-accent font-bold mb-2 text-sm tracking-wide">DCFバリュエーション判定</h3><span class="text-2xl font-bold ${tc}">${escapeHtml(v.verdict)}</span><span class="text-gs-text-muted ml-2">${escapeHtml(v.recommendation)}</span></div>
                <div class="text-right"><div class="text-xs text-gs-text-muted mb-1">理論株価</div><div class="text-3xl font-bold text-white tracking-tight">¥${formatNumber(v.fair_value)}</div><div class="text-sm mt-1 ${v.upside_pct > 0 ? 'text-green-400' : 'text-red-400'} font-medium">${formatPercent(v.upside_pct)} vs 現在値</div></div>
            </div>`);
    }
    html += '<div class="grid grid-cols-1 lg:grid-cols-2 gap-4">';

    // Revenue projection with sparkline
    const proj = d.projections || {};
    if (proj.yearly) {
        const revSparklineHtml = sparkline(proj.yearly.map(y => y.revenue), { color: '#4A9EFF', height: 40, showArea: true, label: '売上高推移予測' });
        html += card('5年間収益予測', `<div class="text-xs text-gs-text-muted/60 mb-3 italic">前提: ${escapeHtml(proj.growth_assumption || '')}</div>${revSparklineHtml}<div class="mt-3">${renderTable(
            [{ label: '年度' }, { label: '売上高', align: 'right' }, { label: '成長率', align: 'right' }],
            proj.yearly.map(y => [{ text: y.year }, { html: formatCurrency(y.revenue) }, { text: y.growth_rate_pct + '%' }]),
        )}</div>`);
    }

    // FCF projection with sparkline
    const fcf = d.fcf_projections || {};
    if (fcf.yearly) {
        const fcfSparklineHtml = sparkline(fcf.yearly.map(y => y.fcf), { color: '#4ade80', height: 40, showArea: true, label: 'FCF推移予測' });
        html += card('FCF予測', `<div class="text-xs text-gs-text-muted/60 mb-3 italic">FCFマージン: ${fcf.fcf_margin_assumption}%</div>${fcfSparklineHtml}<div class="mt-3">${renderTable(
            [{ label: '年度' }, { label: 'FCF', align: 'right' }, { label: 'マージン', align: 'right' }],
            fcf.yearly.map(y => [{ text: y.year }, { html: formatCurrency(y.fcf) }, { text: y.fcf_margin_pct + '%' }]),
        )}</div>`);
    }

    const wacc = d.wacc || {};
    html += card('WACC推定', `${metric('WACC', wacc.wacc_pct ? wacc.wacc_pct + '%' : 'N/A')}${metric('株主資本コスト', wacc.cost_of_equity_pct ? wacc.cost_of_equity_pct + '%' : 'N/A')}${metric('負債コスト', wacc.cost_of_debt_pct ? wacc.cost_of_debt_pct + '%' : 'N/A')}${metric('ベータ', wacc.beta || 'N/A')}${metric('リスクフリーレート', wacc.risk_free_rate_pct ? wacc.risk_free_rate_pct + '%' : 'N/A')}${metric('D/E比率', wacc.debt_equity_ratio || 'N/A')}`);
    const tv = d.terminal_value || {};
    html += card('ターミナルバリュー', `<h4 class="text-xs text-gs-accent mb-2 font-semibold">${escapeHtml(tv.perpetuity_growth?.method || '')}</h4>${metric('ターミナルバリュー', formatCurrency(tv.perpetuity_growth?.terminal_value))}${metric('永続成長率', tv.perpetuity_growth?.growth_rate_pct ? tv.perpetuity_growth.growth_rate_pct + '%' : 'N/A')}<h4 class="text-xs text-gs-accent mb-2 mt-4 font-semibold">${escapeHtml(tv.exit_multiple?.method || '')}</h4>${metric('ターミナルバリュー', formatCurrency(tv.exit_multiple?.terminal_value))}`);
    const val = d.valuation || {};
    html += card('企業価値・株式価値', `${metric('FCF現在価値合計', formatCurrency(val.total_pv_fcf))}${metric('TV現在価値（永続成長）', formatCurrency(val.pv_terminal_perpetuity))}${metric('TV現在価値（マルチプル）', formatCurrency(val.pv_terminal_multiple))}${metric('純有利子負債', formatCurrency(val.net_debt))}<div class="border-t border-gs-border/40 mt-3 pt-3">${metric('1株価値（永続成長法）', val.per_share_perpetuity ? '¥' + formatNumber(val.per_share_perpetuity) : 'N/A')}${metric('1株価値（マルチプル法）', val.per_share_multiple ? '¥' + formatNumber(val.per_share_multiple) : 'N/A')}${metric('1株価値（平均）', val.per_share_average ? '¥' + formatNumber(val.per_share_average) : 'N/A')}</div>`);

    // Enhanced sensitivity analysis with heatmap
    const sens = d.sensitivity || {};
    if (sens.table?.length > 0) {
        html += card('感度分析ヒートマップ', heatmapTable(sens, d.current_price));
    }
    html += '</div>';
    return html;
}

// ══════════════════════════════════════════════════════
// SVG レーダーチャート
// ══════════════════════════════════════════════════════
function radarChart(factors, options = {}) {
    const { size = 240, color = '#4A9EFF' } = options;
    const cx = size / 2, cy = size / 2, r = size / 2 - 30;
    const keys = Object.keys(factors);
    const n = keys.length;
    if (n < 3) return '';
    const step = (2 * Math.PI) / n;

    // Grid
    let grid = '';
    [0.2, 0.4, 0.6, 0.8, 1.0].forEach(frac => {
        const pts = keys.map((_, i) => {
            const a = -Math.PI / 2 + i * step;
            return `${(cx + r * frac * Math.cos(a)).toFixed(1)},${(cy + r * frac * Math.sin(a)).toFixed(1)}`;
        }).join(' ');
        grid += `<polygon points="${pts}" fill="none" stroke="#2a2f3a" stroke-width="0.5"/>`;
    });

    // Axes + labels
    let axes = '';
    keys.forEach((k, i) => {
        const a = -Math.PI / 2 + i * step;
        const x2 = cx + r * Math.cos(a), y2 = cy + r * Math.sin(a);
        axes += `<line x1="${cx}" y1="${cy}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}" stroke="#2a2f3a" stroke-width="0.5"/>`;
        const lx = cx + (r + 18) * Math.cos(a), ly = cy + (r + 18) * Math.sin(a);
        const anchor = Math.abs(Math.cos(a)) < 0.1 ? 'middle' : Math.cos(a) > 0 ? 'start' : 'end';
        axes += `<text x="${lx.toFixed(1)}" y="${ly.toFixed(1)}" text-anchor="${anchor}" dominant-baseline="central" fill="#8896AB" font-size="9">${escapeHtml(k)}</text>`;
    });

    // Data polygon
    const pts = keys.map((k, i) => {
        const v = Math.min(Math.max(factors[k] || 0, 0), 100) / 100;
        const a = -Math.PI / 2 + i * step;
        return `${(cx + r * v * Math.cos(a)).toFixed(1)},${(cy + r * v * Math.sin(a)).toFixed(1)}`;
    }).join(' ');

    // Data dots
    let dots = '';
    keys.forEach((k, i) => {
        const v = Math.min(Math.max(factors[k] || 0, 0), 100) / 100;
        const a = -Math.PI / 2 + i * step;
        const dx = cx + r * v * Math.cos(a), dy = cy + r * v * Math.sin(a);
        dots += `<circle cx="${dx.toFixed(1)}" cy="${dy.toFixed(1)}" r="3" fill="${color}"/>`;
    });

    return `<div class="flex justify-center"><svg viewBox="0 0 ${size} ${size}" width="${size}" height="${size}">
        ${grid}${axes}
        <polygon points="${pts}" fill="${color}" fill-opacity="0.15" stroke="${color}" stroke-width="1.5"/>
        ${dots}
    </svg></div>`;
}

// ══════════════════════════════════════════════════════
// SVG ローソク足チャート
// ══════════════════════════════════════════════════════
function candlestickChart(chartData, options = {}) {
    if (!chartData?.ohlcv?.length) return '';
    const { width = 720, height = 320 } = options;
    const ohlcv = chartData.ohlcv;
    const n = ohlcv.length;
    const margin = { top: 10, right: 50, bottom: 40, left: 10 };
    const cw = width - margin.left - margin.right;
    const mainH = (height - margin.top - margin.bottom) * 0.75;
    const volH = (height - margin.top - margin.bottom) * 0.2;
    const gap = (height - margin.top - margin.bottom) * 0.05;

    const allH = ohlcv.map(d => d.high);
    const allL = ohlcv.map(d => d.low);
    const pMin = Math.min(...allL), pMax = Math.max(...allH);
    const pRange = pMax - pMin || 1;
    const maxVol = Math.max(...ohlcv.map(d => d.volume || 0)) || 1;

    const barW = Math.max(cw / n * 0.7, 1);
    const xStep = cw / n;

    function priceY(p) { return margin.top + mainH - ((p - pMin) / pRange) * mainH; }
    function volY(v) { return margin.top + mainH + gap + volH - (v / maxVol) * volH; }

    let candles = '';
    ohlcv.forEach((d, i) => {
        const x = margin.left + i * xStep + xStep / 2;
        const isUp = d.close >= d.open;
        const color = isUp ? '#4ade80' : '#f87171';
        const bodyTop = priceY(Math.max(d.open, d.close));
        const bodyBot = priceY(Math.min(d.open, d.close));
        const bodyH = Math.max(bodyBot - bodyTop, 0.5);
        // Wick
        candles += `<line x1="${x}" y1="${priceY(d.high).toFixed(1)}" x2="${x}" y2="${priceY(d.low).toFixed(1)}" stroke="${color}" stroke-width="1"/>`;
        // Body
        candles += `<rect x="${(x - barW / 2).toFixed(1)}" y="${bodyTop.toFixed(1)}" width="${barW.toFixed(1)}" height="${bodyH.toFixed(1)}" fill="${isUp ? 'none' : color}" stroke="${color}" stroke-width="1" rx="0.5"/>`;
        // Volume
        const vh = (d.volume || 0) / maxVol * volH;
        candles += `<rect x="${(x - barW / 2).toFixed(1)}" y="${(margin.top + mainH + gap + volH - vh).toFixed(1)}" width="${barW.toFixed(1)}" height="${vh.toFixed(1)}" fill="${color}" opacity="0.3"/>`;
    });

    // Trendlines
    let lines = '';
    (chartData.trendlines || []).forEach(tl => {
        const x1 = margin.left + (tl.x1 / n) * cw;
        const x2 = margin.left + (tl.x2 / n) * cw;
        const dash = tl.type === 'resistance' ? '4,2' : '2,2';
        const col = tl.type === 'resistance' ? '#f87171' : '#4ade80';
        lines += `<line x1="${x1.toFixed(1)}" y1="${priceY(tl.y1).toFixed(1)}" x2="${x2.toFixed(1)}" y2="${priceY(tl.y2).toFixed(1)}" stroke="${col}" stroke-width="1" stroke-dasharray="${dash}" opacity="0.7"/>`;
    });

    // S/R horizontal lines
    (chartData.support_resistance_lines || []).forEach(sr => {
        const y = priceY(sr.price);
        const col = sr.type === 'resistance' ? '#f87171' : '#4ade80';
        lines += `<line x1="${margin.left}" y1="${y.toFixed(1)}" x2="${width - margin.right}" y2="${y.toFixed(1)}" stroke="${col}" stroke-width="0.8" stroke-dasharray="3,3" opacity="0.5"/>`;
        lines += `<text x="${width - margin.right + 4}" y="${(y + 3).toFixed(1)}" fill="${col}" font-size="9">¥${formatNumber(sr.price)}</text>`;
    });

    // Pattern annotations
    let annotations = '';
    (chartData.annotations || []).forEach(ann => {
        const x1 = margin.left + (ann.start_idx / n) * cw;
        const x2 = margin.left + ((ann.end_idx || ann.start_idx) / n) * cw;
        const aw = Math.max(x2 - x1, 4);
        annotations += `<rect x="${x1.toFixed(1)}" y="${margin.top}" width="${aw.toFixed(1)}" height="${mainH}" fill="#4A9EFF" opacity="0.07" rx="2"/>`;
        annotations += `<text x="${((x1 + x2) / 2).toFixed(1)}" y="${(margin.top + 12).toFixed(1)}" text-anchor="middle" fill="#4A9EFF" font-size="8">${escapeHtml(ann.label || '')}</text>`;
    });

    // Price axis (right)
    let axis = '';
    for (let i = 0; i <= 4; i++) {
        const p = pMin + (pRange * i) / 4;
        const y = priceY(p);
        axis += `<text x="${width - margin.right + 4}" y="${(y + 3).toFixed(1)}" fill="#8896AB" font-size="9">¥${formatNumber(p)}</text>`;
        axis += `<line x1="${margin.left}" y1="${y.toFixed(1)}" x2="${width - margin.right}" y2="${y.toFixed(1)}" stroke="#2a2f3a" stroke-width="0.5"/>`;
    }

    // Date labels (bottom)
    const dateInterval = Math.max(Math.floor(n / 5), 1);
    for (let i = 0; i < n; i += dateInterval) {
        const x = margin.left + i * xStep + xStep / 2;
        const label = ohlcv[i].date ? ohlcv[i].date.substring(5) : '';
        axis += `<text x="${x.toFixed(1)}" y="${(height - 4).toFixed(1)}" text-anchor="middle" fill="#8896AB" font-size="8">${escapeHtml(label)}</text>`;
    }

    return `<div class="overflow-x-auto -mx-1">
        <svg viewBox="0 0 ${width} ${height}" width="100%" height="${height}" preserveAspectRatio="xMidYMid meet" class="overflow-visible">
            ${axis}${annotations}${candles}${lines}
        </svg>
    </div>`;
}

// === Academic Quant ===
function renderAcademicQuant(d) {
    let html = '';
    const cs = d.composite_academic_score || {};
    const csColor = (cs.total_score || 0) >= 60 ? 'text-green-400' : (cs.total_score || 0) >= 40 ? 'text-yellow-400' : 'text-red-400';

    // Banner with composite score
    html += bannerCard(`<div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-5">
            <h3 class="text-gs-accent font-bold text-sm tracking-wide">学術ファクター総合スコア</h3>
            <div class="flex items-baseline gap-1"><span class="text-5xl font-bold text-white tracking-tight">${cs.total_score ?? 'N/A'}</span><span class="text-gs-text-muted text-lg">/100</span></div>
        </div>
        <div class="text-center mb-5"><span class="text-lg font-semibold ${csColor}">${escapeHtml(cs.rating || '')} — ${escapeHtml(cs.recommendation || '')}</span></div>`);

    // Radar chart
    const factorScores = cs.factor_scores || {};
    if (Object.keys(factorScores).length >= 3) {
        html += `<div class="card-elevated rounded-2xl p-5 sm:p-6 mb-4 fade-in">
            <h3 class="text-white font-semibold mb-4 text-sm flex items-center gap-2">
                <span class="w-1 h-4 bg-gs-border-light rounded-full"></span>ファクターレーダーチャート
            </h3>
            ${radarChart(factorScores)}
        </div>`;
    }

    // Factor cards
    html += '<div class="grid grid-cols-1 lg:grid-cols-2 gap-4">';

    const factorSections = [
        ['fama_french', 'Fama-French マルチファクター'],
        ['momentum', 'モメンタム戦略 (Jegadeesh-Titman)'],
        ['low_volatility', '低ボラティリティ異常 (Ang et al.)'],
        ['quality_minus_junk', 'Quality Minus Junk (Asness)'],
        ['deep_value', 'ディープバリュー (LSV)'],
        ['mean_reversion', '平均回帰 (Poterba-Summers)'],
        ['volatility_forecast', 'ボラティリティ予測 (GARCH)'],
        ['pair_trading', 'ペアトレーディング (Gatev)'],
        ['post_earnings_drift', 'ポスト決算ドリフト (Bernard-Thomas)'],
        ['accrual_anomaly', 'アクルーアル異常 (Sloan)'],
        ['risk_parity', 'リスクパリティ (Maillard)'],
    ];

    factorSections.forEach(([key, name]) => {
        const f = d[key] || {};
        let body = scoreBar(f.score || 0, 100, name);

        // Show metrics if available
        const metrics = f.metrics || f.factor_exposures || f.sub_scores || {};
        Object.entries(metrics).forEach(([mk, mv]) => {
            if (mv != null && typeof mv !== 'object') {
                const val = typeof mv === 'number' ? (Number.isInteger(mv) ? String(mv) : mv.toFixed(3)) : String(mv);
                body += metric(mk, val);
            }
        });

        // Details list
        body += `<div class="mt-2 space-y-1.5">${(f.details || []).map(detail =>
            `<div class="text-xs text-gs-text-muted flex gap-1.5"><span class="text-gs-accent/60">&#x2022;</span>${escapeHtml(detail)}</div>`
        ).join('')}</div>`;

        html += card(`${name} (${f.score ?? 0}/100)`, body);
    });

    html += '</div>';

    // Academic references
    html += `<div class="mt-4 p-4 bg-gs-darker/60 rounded-xl">
        <h4 class="text-xs text-gs-text-muted/60 font-semibold mb-2">参考文献</h4>
        <div class="text-[10px] text-gs-text-muted/40 space-y-0.5 italic">
            <div>Fama & French (1993, 2015) "Common risk factors in the returns on stocks and bonds"</div>
            <div>Jegadeesh & Titman (1993) "Returns to buying winners and selling losers"</div>
            <div>Ang, Hodrick, Xing & Zhang (2006) "The cross-section of volatility and expected returns"</div>
            <div>Asness, Frazzini & Pedersen (2019) "Quality minus junk"</div>
            <div>Lakonishok, Shleifer & Vishny (1994) "Contrarian investment, extrapolation, and risk"</div>
            <div>Poterba & Summers (1988) "Mean reversion in stock prices"</div>
            <div>Bollerslev (1986) "Generalized autoregressive conditional heteroskedasticity"</div>
            <div>Gatev, Goetzmann & Rouwenhorst (2006) "Pairs trading"</div>
            <div>Bernard & Thomas (1989) "Post-earnings-announcement drift"</div>
            <div>Sloan (1996) "Do stock prices fully reflect information in accruals and cash flows?"</div>
            <div>Maillard, Roncalli & Teiletche (2010) "The properties of equally weighted risk contribution portfolios"</div>
        </div>
    </div>`;

    return html;
}

// === Chart Pattern ===
function renderChartPattern(d) {
    let html = '';
    const sig = d.signals_summary || {};

    // Banner with primary signal
    const sigDir = sig.direction || '中立';
    const sigColor = sigDir.includes('強気') ? 'text-green-400' : sigDir.includes('弱気') ? 'text-red-400' : 'text-yellow-400';
    html += bannerCard(`<div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-4">
            <div>
                <h3 class="text-gs-accent font-bold text-sm tracking-wide mb-1">シグナルサマリー</h3>
                <span class="text-2xl font-bold ${sigColor}">${escapeHtml(sigDir)}</span>
                <span class="text-gs-text-muted ml-2">信頼度 ${sig.confidence || 0}%</span>
            </div>
            <div class="text-right">
                <div class="text-xs text-gs-text-muted">強気 ${sig.bullish_count || 0} / 弱気 ${sig.bearish_count || 0}</div>
            </div>
        </div>
        ${(sig.price_targets || []).length ? `<div class="grid grid-cols-2 md:grid-cols-4 gap-3 mt-3">${sig.price_targets.map(t =>
            `<div class="bg-gs-darker/60 rounded-xl p-3 text-center">
                <div class="text-[10px] text-gs-text-muted mb-1">${escapeHtml(t.label || t.pattern || '')}</div>
                <div class="${t.type === 'bullish' ? 'text-green-400' : 'text-red-400'} font-bold">¥${formatNumber(t.price)}</div>
            </div>`
        ).join('')}</div>` : ''}`);

    // Candlestick chart
    if (d.chart_data?.ohlcv?.length) {
        html += `<div class="card-elevated rounded-2xl p-5 sm:p-6 mb-4 fade-in">
            <h3 class="text-white font-semibold mb-4 text-sm flex items-center gap-2">
                <span class="w-1 h-4 bg-gs-border-light rounded-full"></span>ローソク足チャート（120日）
            </h3>
            ${candlestickChart(d.chart_data)}
        </div>`;
    }

    html += '<div class="grid grid-cols-1 lg:grid-cols-2 gap-4">';

    // Classical patterns
    const cp = d.classical_patterns || [];
    if (cp.length > 0) {
        let cpBody = '';
        cp.forEach(p => {
            const pColor = p.signal === '強気' ? 'green' : p.signal === '弱気' ? 'red' : 'yellow';
            cpBody += `<div class="py-2.5 border-b border-gs-border/30 last:border-0">
                <div class="flex items-center justify-between mb-1">
                    <span class="text-sm text-white font-medium">${escapeHtml(p.name)}</span>
                    <div class="flex gap-1.5">${badge(p.signal, pColor)} ${badge('信頼度 ' + (p.confidence || 0) + '%')}</div>
                </div>
                <div class="text-xs text-gs-text-muted">${escapeHtml(p.description || '')}</div>
                ${p.target_price ? `<div class="text-xs mt-1 ${pColor === 'green' ? 'text-green-400' : 'text-red-400'}">目標価格: ¥${formatNumber(p.target_price)}</div>` : ''}
            </div>`;
        });
        html += card('古典的チャートパターン', cpBody);
    } else {
        html += card('古典的チャートパターン', '<div class="text-xs text-gs-text-muted">現在検出されたパターンはありません</div>');
    }

    // Candlestick patterns
    const cs = d.candlestick_patterns || [];
    if (cs.length > 0) {
        let csBody = '';
        cs.forEach(p => {
            const pColor = p.signal === '強気' ? 'green' : p.signal === '弱気' ? 'red' : 'yellow';
            csBody += `<div class="py-2 border-b border-gs-border/30 last:border-0">
                <div class="flex items-center justify-between">
                    <span class="text-sm text-white">${escapeHtml(p.name)}</span>
                    ${badge(p.signal, pColor)}
                </div>
                <div class="text-xs text-gs-text-muted mt-0.5">${escapeHtml(p.description || '')}</div>
            </div>`;
        });
        html += card('ローソク足パターン', csBody);
    } else {
        html += card('ローソク足パターン', '<div class="text-xs text-gs-text-muted">直近で検出されたパターンはありません</div>');
    }

    // Trend analysis
    const tr = d.trend_analysis || {};
    const adx = tr.adx_data || {};
    html += card('トレンド分析', `${metric('ADX', adx.adx != null ? adx.adx.toFixed(1) : 'N/A')}
        ${metric('+DI', adx.plus_di != null ? adx.plus_di.toFixed(1) : 'N/A')}
        ${metric('-DI', adx.minus_di != null ? adx.minus_di.toFixed(1) : 'N/A')}
        ${metric('トレンド強度', adx.trend_strength || 'N/A')}
        ${metric('トレンド方向', tr.direction || 'N/A')}`);

    // MA Crossover
    const ma = d.ma_crossover_systems || {};
    html += card('移動平均クロスオーバー', `${metric('ゴールデン/デッドクロス', ma.crossover_status || 'N/A')}
        ${metric('最終クロスからの日数', ma.days_since_crossover != null ? ma.days_since_crossover + '日' : 'N/A')}
        ${metric('MA整列', ma.alignment || 'N/A')}
        ${metric('SMA50', ma.sma_50 != null ? '¥' + formatNumber(ma.sma_50) : 'N/A')}
        ${metric('SMA200', ma.sma_200 != null ? '¥' + formatNumber(ma.sma_200) : 'N/A')}`);

    // Support/Resistance
    const sr = d.support_resistance || {};
    if ((sr.levels || []).length > 0) {
        let srBody = '';
        (sr.levels || []).forEach(lv => {
            const color = lv.type === 'resistance' ? 'text-red-400' : 'text-green-400';
            srBody += metric(
                `${lv.type === 'resistance' ? 'レジスタンス' : 'サポート'}`,
                `<span class="${color}">¥${formatNumber(lv.price)}</span>`,
                lv.distance_pct != null ? `${lv.distance_pct > 0 ? '+' : ''}${lv.distance_pct.toFixed(1)}%` : ''
            );
        });
        html += card('サポート/レジスタンス', srBody);
    }

    html += '</div>';
    return html;
}
