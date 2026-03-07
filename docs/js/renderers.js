/**
 * GSSS - 分析結果レンダラー (Polished Design)
 *
 * XSS 対策: テンプレートに挿入するデータは esc() でエスケープ。
 * カラーマッピング: 安全な列挙型を使用。
 */

// ── 安全なカラーマッピング ───────────────────────────
const SAFE_COLORS = {
    green: 'bg-green-500/10 text-green-400 border border-green-500/20',
    red: 'bg-red-500/10 text-red-400 border border-red-500/20',
    yellow: 'bg-yellow-500/10 text-yellow-400 border border-yellow-500/20',
    orange: 'bg-orange-500/10 text-orange-400 border border-orange-500/20',
    'gs-accent': 'bg-gs-accent/10 text-gs-accent border border-gs-accent/20',
};
const SAFE_TEXT_COLORS = { green: 'text-green-400', red: 'text-red-400', yellow: 'text-yellow-400', orange: 'text-orange-400' };
const SAFE_BG_GLOW = { green: 'shadow-green-500/5', red: 'shadow-red-500/5', yellow: 'shadow-yellow-500/5', orange: 'shadow-orange-500/5' };

// ── HTML ユーティリティ (XSS 対策) ───────────────────
function esc(t) {
    if (t == null) return '';
    const d = document.createElement('div'); d.textContent = String(t); return d.innerHTML;
}

function formatNumber(n, d = 0) {
    if (n == null) return 'N/A';
    if (typeof n !== 'number') return esc(String(n));
    return n.toLocaleString('ja-JP', { minimumFractionDigits: d, maximumFractionDigits: d });
}
function formatCurrency(n) {
    if (n == null) return 'N/A';
    if (typeof n !== 'number') return esc(String(n));
    if (Math.abs(n) >= 1e12) return `&yen;${(n / 1e12).toFixed(1)}兆`;
    if (Math.abs(n) >= 1e8)  return `&yen;${(n / 1e8).toFixed(0)}億`;
    if (Math.abs(n) >= 1e4)  return `&yen;${(n / 1e4).toFixed(0)}万`;
    return `&yen;${n.toLocaleString('ja-JP')}`;
}
function formatPercent(n) {
    if (n == null) return 'N/A';
    return `${n >= 0 ? '+' : ''}${n.toFixed(1)}%`;
}
function scoreColor(s, m = 10) {
    const r = s / m;
    return r >= 0.7 ? 'bg-green-500' : r >= 0.5 ? 'bg-yellow-500' : r >= 0.3 ? 'bg-orange-500' : 'bg-red-500';
}
function scoreColorText(s, m = 10) {
    const r = s / m;
    return r >= 0.7 ? 'text-green-400' : r >= 0.5 ? 'text-yellow-400' : r >= 0.3 ? 'text-orange-400' : 'text-red-400';
}
function riskColor(s) { return s <= 3 ? 'text-green-400' : s <= 5 ? 'text-yellow-400' : s <= 7 ? 'text-orange-400' : 'text-red-400'; }

// ── カードヘルパー ──────────────────────────────────
function card(title, body) {
    return `<div class="card-elevated rounded-2xl p-5 sm:p-6 mb-4 fade-in">
        <h3 class="text-white font-semibold mb-4 text-sm flex items-center gap-2">
            <span class="w-1 h-4 bg-gs-border-light rounded-full"></span>
            ${esc(title)}
        </h3>
        <div class="space-y-0">${body}</div>
    </div>`;
}

function metric(label, value, sub) {
    const s = sub ? `<span class="text-gs-text-muted text-xs ml-1.5">${sub}</span>` : '';
    return `<div class="py-2.5 flex justify-between items-center border-b border-gs-border/30 last:border-0 group">
        <span class="text-gs-text-muted text-sm">${esc(label)}</span>
        <div class="text-right flex items-center gap-1">
            <span class="text-white font-medium text-sm">${value}</span>${s}
        </div>
    </div>`;
}

function badge(text, color = 'gs-accent') {
    return `<span class="text-xs px-2.5 py-0.5 rounded-md font-medium ${SAFE_COLORS[color] || SAFE_COLORS['gs-accent']}">${esc(text)}</span>`;
}

function scoreBar(score, max, label = '') {
    const pct = Math.min((score / max) * 100, 100);
    const colorClass = scoreColor(score, max);
    const textClass = scoreColorText(score, max);
    return `<div class="mb-3">
        <div class="flex justify-between text-xs mb-1.5">
            <span class="text-gs-text-muted">${esc(label)}</span>
            <span class="${textClass} font-semibold">${score}/${max}</span>
        </div>
        <div class="w-full bg-gs-darker rounded-full h-2 overflow-hidden">
            <div class="${colorClass} h-2 rounded-full score-bar" style="width:${pct}%"></div>
        </div>
    </div>`;
}

/** テーブルを生成 */
function renderTable(headers, rows) {
    let html = '<div class="overflow-x-auto -mx-1"><table class="w-full text-xs"><thead><tr class="text-gs-text-muted border-b border-gs-border">';
    headers.forEach(h => { html += `<th class="py-2 px-1 font-medium ${h.align === 'right' ? 'text-right' : 'text-left'}">${esc(h.label)}</th>`; });
    html += '</tr></thead><tbody>';
    rows.forEach(row => {
        html += '<tr class="border-b border-gs-border/20 hover:bg-gs-border/5 transition-colors">';
        row.forEach((cell, i) => {
            const align = headers[i]?.align === 'right' ? 'text-right' : '';
            const cls = cell.class || '';
            html += `<td class="py-2 px-1 ${align} ${cls}">${cell.html ?? esc(cell.text ?? cell)}</td>`;
        });
        html += '</tr>';
    });
    html += '</tbody></table></div>';
    return html;
}

// ══════════════════════════════════════════════════════
// SVG スパークライン
// ══════════════════════════════════════════════════════
function sparkline(data, options = {}) {
    if (!data || data.length < 2) return '';
    const { width = 200, height = 48, color = '#4A9EFF', showArea = true, label = '' } = options;

    // Normalize data
    const values = data.map(d => typeof d === 'number' ? d : d.close ?? d.value ?? 0);
    const min = Math.min(...values);
    const max = Math.max(...values);
    const range = max - min || 1;

    // Build SVG path
    const xStep = width / (values.length - 1);
    const points = values.map((v, i) => {
        const x = i * xStep;
        const y = height - 4 - ((v - min) / range) * (height - 8);
        return `${x.toFixed(1)},${y.toFixed(1)}`;
    });
    const pathD = `M${points.join(' L')}`;

    // Area path (closed)
    const areaD = `${pathD} L${width},${height} L0,${height} Z`;

    // Determine color based on trend
    const isUp = values[values.length - 1] >= values[0];
    const lineColor = color === 'auto' ? (isUp ? '#4ade80' : '#f87171') : color;
    const areaColor = color === 'auto' ? (isUp ? '#4ade80' : '#f87171') : color;

    // Start/end labels
    const startVal = values[0];
    const endVal = values[values.length - 1];
    const changePct = ((endVal - startVal) / startVal * 100).toFixed(1);
    const changeClass = endVal >= startVal ? 'price-up' : 'price-down';
    const changeSign = endVal >= startVal ? '+' : '';

    let labelHtml = '';
    if (label) {
        labelHtml = `<div class="flex justify-between items-center mb-1.5">
            <span class="text-[10px] text-gs-text-muted">${esc(label)}</span>
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
// 52週レンジバー
// ══════════════════════════════════════════════════════
function rangeBar52w(current, low, high) {
    if (low == null || high == null || current == null) return '';
    const range = high - low;
    if (range <= 0) return '';
    const pct = Math.max(0, Math.min(100, ((current - low) / range) * 100));
    const isNearHigh = pct > 80;
    const isNearLow = pct < 20;
    const markerColor = isNearHigh ? '#4ade80' : isNearLow ? '#f87171' : '#4A9EFF';

    return `<div class="mt-4">
        <div class="flex justify-between text-[10px] text-gs-text-muted mb-1.5">
            <span>52週安値 &yen;${formatNumber(low)}</span>
            <span>52週高値 &yen;${formatNumber(high)}</span>
        </div>
        <div class="range-bar bg-gradient-to-r from-red-900/40 via-gs-border to-green-900/40">
            <div class="range-marker" style="left:${pct}%;background:${markerColor}"></div>
        </div>
        <div class="text-center mt-2">
            <span class="text-[10px] text-gs-text-muted">現在 &yen;${formatNumber(current)}</span>
            <span class="text-[10px] text-gs-text-muted/50 ml-1">(レンジ内 ${pct.toFixed(0)}%)</span>
        </div>
    </div>`;
}

// ══════════════════════════════════════════════════════
// ヒートマップ感度分析テーブル
// ══════════════════════════════════════════════════════
function heatmapTable(sens, currentPrice) {
    if (!sens.table?.length) return '';
    const gh = sens.growth_range || [];

    // Calculate min/max for color scaling
    let allVals = [];
    sens.table.forEach(row => gh.forEach(g => { const v = row[`g_${g}`]; if (v != null) allVals.push(v); }));
    const minVal = Math.min(...allVals);
    const maxVal = Math.max(...allVals);
    const valRange = maxVal - minVal || 1;

    let html = '<div class="overflow-x-auto -mx-1"><table class="w-full text-xs border-collapse"><thead><tr><th class="py-2 px-1.5 text-left font-medium text-gs-text-muted">WACC</th>';
    gh.forEach(g => { html += `<th class="text-center py-2 px-1.5 font-medium text-gs-text-muted">g=${esc(g)}</th>`; });
    html += '</tr></thead><tbody>';

    sens.table.forEach(row => {
        html += `<tr><td class="py-1.5 px-1.5 font-medium text-white text-xs">${row.wacc_pct}%</td>`;
        gh.forEach(g => {
            const key = `g_${g}`;
            const sv = row[key];
            const isAbove = currentPrice && sv > currentPrice;

            // Color intensity based on distance from current price
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
                <span style="color:${textColor}" class="font-medium text-[11px]">&yen;${formatNumber(sv)}</span>
            </td>`;
        });
        html += '</tr>';
    });
    html += `</tbody></table></div>`;
    if (currentPrice) {
        html += `<div class="flex items-center gap-3 mt-3 text-[10px] text-gs-text-muted/60">
            <span class="flex items-center gap-1"><span class="w-3 h-3 rounded" style="background:rgba(74,222,128,0.25)"></span>割安</span>
            <span class="flex items-center gap-1"><span class="w-3 h-3 rounded" style="background:rgba(248,113,113,0.25)"></span>割高</span>
            <span class="ml-auto italic">${esc(sens.note || '')}</span>
        </div>`;
    }
    return html;
}

// ── バナーカード ───────────────────────────────────
function bannerCard(content) {
    return `<div class="banner-glow rounded-2xl p-5 sm:p-6 mb-6 fade-in">${content}</div>`;
}

// ── 大きなスコア表示 ──────────────────────────────
function bigScore(score, max, label, colorFn) {
    const cl = typeof colorFn === 'function' ? colorFn(score) : scoreColorText(score, max);
    return `<div class="text-center py-2">
        <div class="text-5xl font-bold ${cl} leading-none">${score ?? 'N/A'}</div>
        <div class="text-gs-text-muted text-sm mt-1">/ ${max}</div>
        ${label ? `<div class="text-sm mt-2 ${cl} font-medium">${esc(label)}</div>` : ''}
    </div>`;
}

// ── メインディスパッチ ──────────────────────────────
function renderAnalysis(type, data, info, stockData) {
    // Price section with change indicator
    let priceHtml = '';
    if (data.current_price) {
        const history = stockData?.history || [];
        const prevClose = history.length > 1 ? history[history.length - 2]?.close : null;
        const change = prevClose ? data.current_price - prevClose : null;
        const changePct = prevClose ? ((change / prevClose) * 100) : null;
        const changeHtml = change != null
            ? `<span class="text-sm font-medium ml-2 ${change >= 0 ? 'price-up' : 'price-down'}">${change >= 0 ? '+' : ''}${change.toFixed(0)} (${changePct >= 0 ? '+' : ''}${changePct.toFixed(2)}%)</span>`
            : '';
        priceHtml = `<div class="mt-4 flex items-baseline gap-1 flex-wrap">
            <span class="text-3xl text-white font-bold tracking-tight">&yen;${formatNumber(data.current_price)}</span>
            ${changeHtml}
        </div>`;
    }

    // 52-week range bar
    const infoData = stockData?.info;
    const range52w = infoData ? rangeBar52w(data.current_price, infoData.fiftyTwoWeekLow, infoData.fiftyTwoWeekHigh) : '';

    // Price sparkline (last 90 days)
    const history = stockData?.history || [];
    const recentHistory = history.slice(-90);
    const sparklineHtml = recentHistory.length > 10
        ? `<div class="mt-4">${sparkline(recentHistory, { color: 'auto', height: 56, label: '90日チャート' })}</div>`
        : '';

    // Sector & industry info
    const sectorHtml = (infoData?.sector || infoData?.industry)
        ? `<div class="flex flex-wrap gap-1.5 mt-2">
            ${infoData.sector ? `<span class="text-[10px] bg-gs-darker/80 text-gs-text-muted px-2 py-0.5 rounded">${esc(infoData.sector)}</span>` : ''}
            ${infoData.industry ? `<span class="text-[10px] bg-gs-darker/80 text-gs-text-muted px-2 py-0.5 rounded">${esc(infoData.industry)}</span>` : ''}
           </div>`
        : '';

    const header = bannerCard(`
        <div class="flex items-start gap-4">
            <div class="text-4xl mt-1">${esc(info.icon)}</div>
            <div class="flex-1">
                <h2 class="text-white font-bold text-xl sm:text-2xl tracking-tight">${esc(info.name)}</h2>
                ${data.company_name ? `<p class="text-gs-text-muted mt-0.5">${esc(data.company_name)} <span class="text-gs-accent/70">(${esc(data.ticker)})</span></p>` : ''}
                ${sectorHtml}
            </div>
        </div>
        ${priceHtml}
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-2">
            <div>${sparklineHtml}</div>
            <div>${range52w}</div>
        </div>
    `);

    const renderers = {
        goldman: renderGoldman, morgan_technical: renderMorganTechnical,
        bridgewater: renderBridgewater, jpmorgan: renderJPMorgan,
        blackrock: renderBlackRock, citadel: renderCitadel,
        renaissance: renderRenaissance, vanguard: renderVanguard,
        mckinsey: renderMcKinsey, morgan_dcf: renderMorganDCF,
    };
    const render = renderers[type];
    const content = render ? render(data, stockData) : `<pre class="text-xs overflow-auto p-4 bg-gs-darker rounded-xl">${esc(JSON.stringify(data, null, 2))}</pre>`;
    return header + content;
}

// ════════════════════════════════════════════════════
// Goldman Sachs
// ════════════════════════════════════════════════════
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
    html += card('P/E比率分析', `${metric('現在PER', pe.current_pe != null ? pe.current_pe + '倍' : 'N/A')}${metric('フォワードPER', pe.forward_pe != null ? pe.forward_pe + '倍' : 'N/A')}${metric('評価', esc(pe.assessment || 'N/A'))}${scoreBar(pe.score || 5, 10, 'バリュエーション')}`);
    html += card('負債健全性チェック', `${metric('D/Eレシオ', debt.debt_to_equity != null ? debt.debt_to_equity + '倍' : 'N/A')}${metric('総負債', formatCurrency(debt.total_debt))}${metric('手元現金', formatCurrency(debt.total_cash))}${metric('健全性', esc(debt.health || 'N/A'))}${scoreBar(debt.score || 5, 10, '財務健全性')}`);
    html += card('配当分析', `${metric('配当利回り', div.yield_pct != null ? div.yield_pct + '%' : '0%')}${metric('年間配当', div.annual_rate ? '&yen;' + formatNumber(div.annual_rate) : 'N/A')}${metric('配当性向', div.payout_ratio_pct != null ? div.payout_ratio_pct + '%' : 'N/A')}${metric('持続可能性', esc(div.sustainability || 'N/A'))}${scoreBar(div.score || 5, 10, '配当安全性')}`);
    html += card('競争優位性（モート）', `<div class="text-center mb-4"><span class="text-2xl text-white font-bold">${esc(moat.rating || 'N/A')}</span></div>${scoreBar(moat.score || 0, moat.max_score || 11, 'モートスコア')}<div class="mt-3 space-y-1.5">${(moat.reasons || []).map(r => `<div class="text-xs text-gs-text-muted flex gap-1.5"><span class="text-gs-accent/60">&#x2022;</span>${esc(r)}</div>`).join('')}</div>`);
    html += card('12ヶ月価格ターゲット', `${metric('強気ケース', pt.bull_target ? '&yen;' + formatNumber(pt.bull_target) : 'N/A', pt.upside_pct != null ? formatPercent(pt.upside_pct) : '')}${metric('ベースケース', pt.base_target ? '&yen;' + formatNumber(pt.base_target) : 'N/A')}${metric('弱気ケース', pt.bear_target ? '&yen;' + formatNumber(pt.bear_target) : 'N/A', pt.downside_pct != null ? formatPercent(pt.downside_pct) : '')}${pt.estimated ? '<div class="text-xs text-gs-text-muted/60 mt-3 italic">※推定値（アナリスト目標価格なし）</div>' : ''}`);
    html += card('リスク評価', `${bigScore(risk.score, 10, null, riskColor)}<div class="mt-3 space-y-1.5">${(risk.reasons || []).map(r => `<div class="text-xs text-gs-text-muted flex gap-1.5"><span class="text-gs-accent/60">&#x2022;</span>${esc(r)}</div>`).join('')}</div>`);
    html += card('エントリー価格ゾーン', `${metric('積極的エントリー', ez.aggressive_entry ? '&yen;' + formatNumber(ez.aggressive_entry) : 'N/A')}${metric('理想的エントリー', ez.ideal_entry ? '&yen;' + formatNumber(ez.ideal_entry) : 'N/A')}${metric('保守的エントリー', ez.conservative_entry ? '&yen;' + formatNumber(ez.conservative_entry) : 'N/A')}${metric('ストップロス', ez.stop_loss ? '&yen;' + formatNumber(ez.stop_loss) : 'N/A', ez.stop_loss_pct != null ? ez.stop_loss_pct + '%' : '')}${metric('サポートライン', ez.support ? '&yen;' + formatNumber(ez.support) : 'N/A')}${metric('レジスタンスライン', ez.resistance ? '&yen;' + formatNumber(ez.resistance) : 'N/A')}`);
    html += card('収益成長トレンド', `${metric('トレンド', esc(rev.trend || 'N/A'))}${(rev.growth_rates || []).map((r, i) => metric(rev.years?.[i] || '', formatPercent(r))).join('')}`);
    html += '</div>';
    if (d.summary) html += `<div class="banner-glow rounded-2xl p-5 sm:p-6 mt-4"><p class="text-white leading-relaxed">${esc(d.summary)}</p></div>`;
    return html;
}

// ════════════════════════════════════════════════════
// Morgan Stanley テクニカル
// ════════════════════════════════════════════════════
function renderMorganTechnical(d) {
    let html = '';
    const ts = d.trade_setup || {};
    if (ts.entry) {
        html += bannerCard(`<h3 class="text-gs-accent font-bold mb-4 text-sm tracking-wide">トレードセットアップ</h3>
            <div class="grid grid-cols-2 md:grid-cols-5 gap-3 sm:gap-4 text-center">
                <div class="bg-gs-darker/60 rounded-xl p-3"><div class="text-[10px] text-gs-text-muted mb-1">方向</div><div class="text-white font-bold text-lg">${esc(ts.direction)}</div></div>
                <div class="bg-gs-darker/60 rounded-xl p-3"><div class="text-[10px] text-gs-text-muted mb-1">エントリー</div><div class="text-white font-bold">&yen;${formatNumber(ts.entry)}</div></div>
                <div class="bg-gs-darker/60 rounded-xl p-3"><div class="text-[10px] text-gs-text-muted mb-1">ストップロス</div><div class="text-red-400 font-bold">&yen;${formatNumber(ts.stop_loss)}</div></div>
                <div class="bg-gs-darker/60 rounded-xl p-3"><div class="text-[10px] text-gs-text-muted mb-1">利確目標1</div><div class="text-green-400 font-bold">&yen;${formatNumber(ts.target_1)}</div></div>
                <div class="bg-gs-darker/60 rounded-xl p-3"><div class="text-[10px] text-gs-text-muted mb-1">R/R比率</div><div class="text-gs-gold font-bold">${ts.risk_reward_ratio}</div></div>
            </div>`);
    }
    html += '<div class="grid grid-cols-1 lg:grid-cols-2 gap-4">';
    const tr = d.trend || {};
    html += card('トレンド分析', `${metric('主要トレンド', esc(tr.primary || 'N/A'))}${metric('日足トレンド', esc(tr.daily || 'N/A'))}${metric('週足トレンド', esc(tr.weekly || 'N/A'))}${metric('月足トレンド', esc(tr.monthly || 'N/A'))}${tr.crossover ? metric('クロスオーバー', esc(tr.crossover)) : ''}`);
    const rsi = d.rsi_analysis || {};
    html += card('RSI (14日)', `<div class="text-center mb-4"><span class="text-4xl font-bold text-white">${rsi.value ?? 'N/A'}</span></div>${metric('判定', esc(rsi.interpretation || 'N/A'))}${metric('シグナル', esc(rsi.signal || 'N/A'))}`);
    const ma = d.ma_analysis || {};
    html += card('移動平均分析', `${metric('総合判定', esc(ma.overall || 'N/A'))}${Object.entries(ma.moving_averages || {}).map(([k, v]) => metric(k + '移動平均', '&yen;' + formatNumber(v.value), v.position === '上' ? '<span class="text-green-400">&#x2191;上</span>' : '<span class="text-red-400">&#x2193;下</span>')).join('')}`);
    const macd = d.macd_analysis || {};
    html += card('MACD分析', `${metric('MACD', macd.macd ?? 'N/A')}${metric('シグナル', macd.signal ?? 'N/A')}${metric('ヒストグラム', macd.histogram ?? 'N/A')}${metric('クロスオーバー', esc(macd.crossover || 'N/A'))}${metric('モメンタム', esc(macd.momentum || 'N/A'))}`);
    const bb = d.bb_analysis || {};
    html += card('ボリンジャーバンド', `${metric('上限バンド', bb.upper != null ? '&yen;' + formatNumber(bb.upper) : 'N/A')}${metric('中央線', bb.middle != null ? '&yen;' + formatNumber(bb.middle) : 'N/A')}${metric('下限バンド', bb.lower != null ? '&yen;' + formatNumber(bb.lower) : 'N/A')}${metric('ポジション', esc(bb.position || 'N/A'))}${metric('バンド幅', esc(bb.squeeze_status || 'N/A'))}`);
    const vol = d.volume_analysis || {};
    html += card('出来高分析', `${metric('現在の出来高', vol.current_volume != null ? formatNumber(vol.current_volume) : 'N/A')}${metric('20日平均', vol.avg_volume_20d != null ? formatNumber(vol.avg_volume_20d) : 'N/A')}${metric('出来高比率', vol.ratio != null ? vol.ratio + 'x' : 'N/A')}${metric('判定', esc(vol.interpretation || 'N/A'))}`);
    const fib = d.fibonacci || {};
    if (fib.high) html += card('フィボナッチリトレースメント', `${metric('高値', '&yen;' + formatNumber(fib.high))}${metric('23.6%', '&yen;' + formatNumber(fib.level_236))}${metric('38.2%', '&yen;' + formatNumber(fib.level_382))}${metric('50.0%', '&yen;' + formatNumber(fib.level_500))}${metric('61.8%', '&yen;' + formatNumber(fib.level_618))}${metric('安値', '&yen;' + formatNumber(fib.low))}`);
    const pat = d.pattern || {};
    html += card('チャートパターン', `${metric('パターン', esc(pat.pattern || 'N/A'))}${metric('説明', esc(pat.description || 'N/A'))}${pat.signal ? metric('シグナル', esc(pat.signal)) : ''}`);
    html += '</div>';
    return html;
}

// ════════════════════════════════════════════════════
// Bridgewater リスク
// ════════════════════════════════════════════════════
function renderBridgewater(d) {
    let html = '';
    const dash = d.risk_dashboard || {};
    if (dash.metrics) {
        html += bannerCard(`<div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-5">
                <h3 class="text-gs-accent font-bold text-sm tracking-wide">リスクダッシュボード</h3>
                <div class="flex items-baseline gap-2"><span class="text-3xl font-bold ${riskColor(dash.total_risk_score || 5)}">${dash.total_risk_score}/10</span><span class="text-gs-text-muted text-sm">${esc(dash.overall_risk)}</span></div>
            </div>
            <div class="grid grid-cols-2 md:grid-cols-4 gap-3">${Object.entries(dash.metrics).map(([k, v]) => {
                const tc = SAFE_TEXT_COLORS[v.color] || 'text-white';
                return `<div class="text-center p-3 sm:p-4 bg-gs-darker/60 rounded-xl"><div class="text-[10px] text-gs-text-muted mb-1.5">${esc(k)}</div><div class="text-2xl font-bold ${tc}">${v.score}/10</div><div class="text-[10px] text-gs-text-muted mt-1">${esc(v.label)}</div></div>`;
            }).join('')}</div>`);
    }
    html += '<div class="grid grid-cols-1 lg:grid-cols-2 gap-4">';
    const vol = d.volatility || {};
    html += card('ボラティリティプロファイル', `${metric('日次ボラティリティ', vol.daily_pct != null ? vol.daily_pct + '%' : 'N/A')}${metric('年間ボラティリティ', vol.annual_pct != null ? vol.annual_pct + '%' : 'N/A')}${metric('リスクレベル', esc(vol.level || 'N/A'))}${metric('95%VaR（日次）', vol.percentile_95_daily_loss != null ? vol.percentile_95_daily_loss + '%' : 'N/A')}`);
    const beta = d.beta_analysis || {};
    html += card('ベータ分析（対日経225）', `${metric('ベータ', beta.beta ?? 'N/A')}${metric('解釈', esc(beta.interpretation || 'N/A'))}`);
    const dd = d.drawdown || {};
    html += card('最大ドローダウン', `${metric('最大ドローダウン', dd.max_drawdown_pct != null ? dd.max_drawdown_pct + '%' : 'N/A')}${metric('発生日', esc(dd.max_drawdown_date || 'N/A'))}${metric('回復期間', dd.recovery_days != null ? esc(String(dd.recovery_days)) + (typeof dd.recovery_days === 'number' ? '日' : '') : 'N/A')}`);
    const st = d.stress_test || {};
    if (st.scenarios) {
        let stBody = metric('現在価格', '&yen;' + formatNumber(st.current_price));
        for (const [name, sc] of Object.entries(st.scenarios)) { stBody += metric(name, '&yen;' + formatNumber(sc.estimated_price), `<span class="text-red-400">${sc.loss_pct}%</span>`); }
        html += card('リセッションストレステスト', stBody);
    }
    const liq = d.liquidity || {};
    html += card('流動性リスク', `${metric('平均日次出来高', liq.avg_daily_volume ? formatNumber(liq.avg_daily_volume) : 'N/A')}${metric('流動性レベル', esc(liq.liquidity_level || 'N/A'))}`);
    const hedge = d.hedge_recommendation || {};
    html += card('ヘッジ推奨', `${(hedge.strategies || []).map(s => `<div class="py-2.5 text-sm border-b border-gs-border/30 last:border-0 text-gs-text-muted">${esc(s)}</div>`).join('')}`);
    html += '</div>';
    return html;
}

// ════════════════════════════════════════════════════
// JPMorgan 決算
// ════════════════════════════════════════════════════
function renderJPMorgan(d) {
    let html = '<div class="grid grid-cols-1 lg:grid-cols-2 gap-4">';
    const eh = d.earnings_history || {};
    let ehBody = `<p class="text-sm text-gs-text-muted mb-4">${esc(eh.summary || '')}</p>`;
    if (eh.quarters?.length > 0) {
        ehBody += renderTable(
            [{ label: '日付' }, { label: '予想EPS', align: 'right' }, { label: '実績EPS', align: 'right' }, { label: 'サプライズ', align: 'right' }],
            eh.quarters.map(q => {
                const color = q.beat === true ? 'text-green-400' : q.beat === false ? 'text-red-400' : '';
                return [{ text: q.date, class: color }, { text: q.eps_estimate ?? 'N/A', class: color }, { text: q.eps_actual ?? 'N/A', class: color }, { text: q.surprise_pct != null ? q.surprise_pct + '%' : 'N/A', class: color }];
            }),
        );
    }
    html += card('決算履歴', ehBody);
    const con = d.consensus || {};
    html += card('コンセンサス予想', `${metric('フォワードEPS', con.forward_eps ?? 'N/A')}${metric('トレイリングEPS', con.trailing_eps ?? 'N/A')}${metric('フォワードPE', con.forward_pe ? con.forward_pe.toFixed(1) + '倍' : 'N/A')}${metric('PEGレシオ', con.peg_ratio ?? 'N/A')}${metric('EPS成長率', con.earnings_growth != null ? formatPercent(con.earnings_growth * 100) : 'N/A')}${metric('売上成長率', con.revenue_growth != null ? formatPercent(con.revenue_growth * 100) : 'N/A')}${metric('アナリスト推奨', esc(con.recommendation || 'N/A'))}${metric('アナリスト数', con.num_analysts ?? 'N/A')}`);
    const km = d.key_metrics || [];
    html += card('注目すべき指標', `${km.map(m => metric(m.name, esc(m.value), badge(m.importance, m.importance === '高' ? 'red' : 'yellow'))).join('')}`);
    const im = d.implied_move || {};
    html += card('決算日の想定値動き', `${metric('推定変動幅', im.estimated_move_pct != null ? '&plusmn;' + im.estimated_move_pct + '%' : 'N/A')}${metric('過去の大きな値動き', im.avg_large_move_pct != null ? im.avg_large_move_pct + '%' : 'N/A')}${metric('最大単日変動', im.max_single_day_move_pct != null ? im.max_single_day_move_pct + '%' : 'N/A')}`);
    const pos = d.positioning || {};
    if (pos.strategies) {
        let posBody = '';
        pos.strategies.forEach(s => {
            const ac = s.action.includes('買い') ? 'green' : s.action.includes('売り') ? 'red' : 'yellow';
            posBody += `<div class="py-3 border-b border-gs-border/30 last:border-0"><div class="flex items-center gap-2 mb-1.5">${badge(s.timing)} ${badge(s.action, ac)}</div><p class="text-xs text-gs-text-muted leading-relaxed">${esc(s.reason)}</p></div>`;
        });
        html += card('ポジション戦略', posBody);
    }
    html += '</div>';
    return html;
}

// ════════════════════════════════════════════════════
// BlackRock 配当
// ════════════════════════════════════════════════════
function renderBlackRock(d) {
    let html = '<div class="grid grid-cols-1 lg:grid-cols-2 gap-4">';
    const ya = d.yield_analysis || {};
    html += card('配当利回り分析', `${metric('現在利回り', ya.current_yield_pct != null ? ya.current_yield_pct + '%' : '0%')}${metric('5年平均利回り', ya.five_year_avg_yield != null ? ya.five_year_avg_yield + '%' : 'N/A')}${metric('年間配当', ya.dividend_rate ? '&yen;' + formatNumber(ya.dividend_rate) : 'N/A')}${metric('評価', esc(ya.assessment || 'N/A'))}`);
    const sf = d.safety || {};
    const sfColor = sf.score >= 7 ? 'text-green-400' : sf.score >= 5 ? 'text-yellow-400' : 'text-red-400';
    html += card('配当安全性スコア', `${bigScore(sf.score, 10, sf.label, () => sfColor)}${scoreBar(sf.score || 0, 10, '安全性')}<div class="mt-2 space-y-1">${(sf.reasons || []).map(r => `<div class="text-xs text-gs-text-muted flex gap-1.5"><span class="text-gs-accent/60">&#x2022;</span>${esc(r)}</div>`).join('')}</div>`);
    const ga = d.growth_analysis || {};
    html += card('配当成長履歴', `${metric('連続増配年数', ga.consecutive_increases + '年')}${metric('CAGR', ga.cagr_pct != null ? ga.cagr_pct + '%' : 'N/A')}${metric('ステータス', esc(ga.status || 'N/A'))}${Object.entries(ga.annual_dividends || {}).map(([y, v]) => metric(y + '年', '&yen;' + formatNumber(v, 2))).join('')}`);
    const ip = d.income_projection || {};
    html += card('配当収入予測', `${metric('投資金額', formatCurrency(d.investment_amount))}${metric('初年度配当収入', formatCurrency(ip.initial_annual_income))}${metric('10年後配当収入', formatCurrency(ip.year_10_income))}${metric('20年後配当収入', formatCurrency(ip.year_20_income))}${metric('想定成長率', ip.assumed_growth_rate_pct != null ? ip.assumed_growth_rate_pct + '%/年' : 'N/A')}`);
    const drip = d.drip || {};
    if (drip.year_10) {
        html += card('DRIP再投資シミュレーション', `${metric('初期株数', drip.initial_shares ? drip.initial_shares + '株' : 'N/A')}${metric('10年後株数', drip.year_10.shares + '株')}${metric('10年後評価額', formatCurrency(drip.year_10.total_value))}${metric('10年後累計配当', formatCurrency(drip.year_10.cumulative_dividends))}${drip.year_20 ? metric('20年後評価額', formatCurrency(drip.year_20.total_value)) : ''}${metric('20年間トータルリターン', drip.total_return_20y ? '+' + drip.total_return_20y + '%' : 'N/A')}<div class="text-xs text-gs-text-muted/60 mt-3 italic">前提: ${esc(drip.assumptions?.price_growth || '')} / 配当${esc(drip.assumptions?.dividend_growth || '')}</div>`);
    }
    const yt = d.yield_trap || {};
    html += card('イールドトラップチェック', `<div class="mb-3">${yt.is_potential_trap ? badge('要注意', 'red') : badge('問題なし', 'green')}</div>${(yt.warnings || []).map(w => `<div class="text-xs py-1 flex gap-1.5 ${yt.is_potential_trap ? 'text-red-400' : 'text-gs-text-muted'}"><span>&#x2022;</span>${esc(w)}</div>`).join('')}`);
    const ex = d.ex_dividend || {};
    html += card('配当落ち日', `${metric('次回配当落ち日', esc(ex.ex_dividend_date || '未定'))}${metric('配当額', ex.dividend_rate ? '&yen;' + formatNumber(ex.dividend_rate) : 'N/A')}${ex.note ? `<div class="text-xs text-gs-text-muted/60 mt-3 italic">${esc(ex.note)}</div>` : ''}`);
    html += '</div>';
    return html;
}

// ════════════════════════════════════════════════════
// Citadel セクター
// ════════════════════════════════════════════════════
function renderCitadel(d) {
    let html = '';
    const cycle = d.economic_cycle || {};
    html += bannerCard(`<h3 class="text-gs-accent font-bold mb-2 text-sm tracking-wide">経済サイクル: <span class="text-white text-base">${esc(cycle.phase || 'N/A')}</span></h3>
        <p class="text-sm text-gs-text-muted mb-4 leading-relaxed">${esc(cycle.description || '')}</p>
        <div class="grid grid-cols-2 gap-4 text-sm">
            <div class="bg-gs-darker/60 rounded-xl p-3">${metric('日経平均', cycle.nikkei_current ? '&yen;' + formatNumber(cycle.nikkei_current) : 'N/A')}</div>
            <div class="bg-gs-darker/60 rounded-xl p-3">${metric('200日移動平均', cycle.nikkei_sma200 ? '&yen;' + formatNumber(cycle.nikkei_sma200) : 'N/A')}</div>
        </div>`);
    html += '<div class="grid grid-cols-1 lg:grid-cols-2 gap-4">';
    const rot = d.rotation_recommendation || {};
    let rotBody = `<p class="text-sm mb-4">ポジショニング: ${badge(rot.positioning || 'N/A', rot.positioning === 'リスクオン' ? 'green' : 'yellow')}</p>`;
    rotBody += '<div class="mb-4"><h4 class="text-xs text-green-400 mb-2 font-semibold tracking-wide">オーバーウェイト</h4>';
    (rot.overweight || []).forEach(o => { rotBody += `<div class="text-xs py-1.5 border-b border-gs-border/20 last:border-0 text-gs-text-muted">${esc(o.sector)} &mdash; ${esc(o.reason)} ${badge(o.conviction)}</div>`; });
    rotBody += '</div><div><h4 class="text-xs text-red-400 mb-2 font-semibold tracking-wide">アンダーウェイト</h4>';
    (rot.underweight || []).forEach(o => { rotBody += `<div class="text-xs py-1.5 border-b border-gs-border/20 last:border-0 text-gs-text-muted">${esc(o.sector)} &mdash; ${esc(o.reason)}</div>`; });
    rotBody += '</div>';
    html += card('セクターローテーション推奨', rotBody);
    const alloc = d.model_allocation || {};
    html += card('モデルアロケーション', `${Object.entries(alloc.allocation || {}).map(([k, v]) => `<div class="mb-3"><div class="flex justify-between text-xs mb-1.5"><span class="text-gs-text-muted">${esc(k)}</span><span class="text-white font-medium">${v}%</span></div><div class="w-full bg-gs-darker rounded-full h-2 overflow-hidden"><div class="bg-gs-accent h-2 rounded-full score-bar" style="width:${v}%"></div></div></div>`).join('')}<div class="text-xs text-gs-text-muted/60 mt-3 italic">${esc(alloc.note || '')}</div>`);
    html += '</div>';
    return html;
}

// ════════════════════════════════════════════════════
// Renaissance 定量
// ════════════════════════════════════════════════════
function renderRenaissance(d) {
    let html = '';
    const cs = d.composite_score || {};
    const csColor = cs.total_score >= 60 ? 'text-green-400' : cs.total_score >= 40 ? 'text-yellow-400' : 'text-red-400';
    html += bannerCard(`<div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-5">
            <h3 class="text-gs-accent font-bold text-sm tracking-wide">複合スコア</h3>
            <div class="flex items-baseline gap-1"><span class="text-5xl font-bold text-white tracking-tight">${cs.total_score ?? 'N/A'}</span><span class="text-gs-text-muted text-lg">/100</span></div>
        </div>
        <div class="text-center mb-5"><span class="text-lg font-semibold ${csColor}">${esc(cs.rating || '')} &mdash; ${esc(cs.recommendation || '')}</span></div>
        <div class="grid grid-cols-5 gap-2 sm:gap-3">${Object.entries(cs.factor_scores || {}).map(([k, v]) => `<div class="text-center p-2 sm:p-3 bg-gs-darker/60 rounded-xl"><div class="text-[10px] text-gs-text-muted mb-1">${esc(k)}</div><div class="text-lg sm:text-xl font-bold text-white">${v}</div><div class="text-[10px] text-gs-text-muted mt-0.5">${esc(cs.weights?.[k] || '')}</div></div>`).join('')}</div>`);
    html += '<div class="grid grid-cols-1 lg:grid-cols-2 gap-4">';
    [['value_factors', 'バリューファクター'], ['quality_factors', 'クオリティファクター'], ['momentum_factors', 'モメンタムファクター'], ['growth_factors', '成長ファクター'], ['sentiment_factors', 'センチメントファクター']].forEach(([key, name]) => {
        const f = d[key] || {};
        html += card(`${name} (${f.score || 0}/100)`, `${scoreBar(f.score || 0, 100, name)}<div class="space-y-1.5">${(f.details || []).map(det => `<div class="text-xs text-gs-text-muted flex gap-1.5"><span class="text-gs-accent/60">&#x2022;</span>${esc(det)}</div>`).join('')}</div>`);
    });
    html += '</div>';
    return html;
}

// ════════════════════════════════════════════════════
// Vanguard ETF
// ════════════════════════════════════════════════════
function renderVanguard(d) {
    let html = bannerCard(`<div class="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4 text-center">
        <div class="bg-gs-darker/60 rounded-xl p-3 sm:p-4"><div class="text-[10px] text-gs-text-muted mb-1">リスクプロファイル</div><div class="text-white font-bold text-lg">${esc(d.risk_profile)}</div></div>
        <div class="bg-gs-darker/60 rounded-xl p-3 sm:p-4"><div class="text-[10px] text-gs-text-muted mb-1">投資金額</div><div class="text-white font-bold">${formatCurrency(d.investment_amount)}</div></div>
        <div class="bg-gs-darker/60 rounded-xl p-3 sm:p-4"><div class="text-[10px] text-gs-text-muted mb-1">年齢</div><div class="text-white font-bold">${d.age}歳</div></div>
        <div class="bg-gs-darker/60 rounded-xl p-3 sm:p-4"><div class="text-[10px] text-gs-text-muted mb-1">期待リターン</div><div class="text-green-400 font-bold">${d.expected_return?.expected_annual_return_pct}%/年</div></div>
    </div>`);
    html += '<div class="grid grid-cols-1 lg:grid-cols-2 gap-4">';
    const det = d.detailed_allocation || {};
    html += card('アセットアロケーション', `${Object.entries(det).map(([k, v]) => `<div class="mb-3"><div class="flex justify-between text-xs mb-1.5"><span class="text-gs-text-muted">${esc(k)}</span><span class="text-white font-medium">${v}%</span></div><div class="w-full bg-gs-darker rounded-full h-2 overflow-hidden"><div class="bg-gs-accent h-2 rounded-full score-bar" style="width:${v * 1.5}%"></div></div></div>`).join('')}`);
    const etfs = d.etf_picks || [];
    html += card('推奨ETF一覧', renderTable(
        [{ label: 'ETF' }, { label: '配分', align: 'right' }, { label: '金額', align: 'right' }, { label: '信託報酬', align: 'right' }],
        etfs.map(e => [{ html: `<div class="font-medium text-white">${esc(e.name)}</div><div class="text-gs-text-muted/60">${esc(e.ticker)}</div>` }, { text: e.allocation_pct + '%' }, { text: '&yen;' + formatNumber(e.amount) }, { text: e.expense_ratio + '%' }]),
    ));
    const rb = d.rebalance_rules || {};
    html += card('リバランスルール', `${metric('頻度', esc(rb.frequency || 'N/A'))}${metric('閾値', rb.threshold_pct ? '&plusmn;' + rb.threshold_pct + '%' : 'N/A')}${(rb.rules || []).map(r => `<div class="text-xs text-gs-text-muted py-1 flex gap-1.5"><span class="text-gs-accent/60">&#x2022;</span>${esc(r)}</div>`).join('')}`);
    const tax = d.tax_optimization || {};
    html += card('税務最適化', `<div class="mb-4"><h4 class="text-xs text-gs-accent mb-2 font-semibold">NISA口座推奨</h4>${(tax.nisa_account?.recommended || []).map(n => `<div class="text-xs text-gs-text-muted flex gap-1.5"><span class="text-gs-accent/60">&#x2022;</span>${esc(n)}</div>`).join('')}<div class="text-xs text-gs-text-muted/60 mt-1.5 italic">${esc(tax.nisa_account?.reason || '')}</div></div><div><h4 class="text-xs text-gs-accent mb-2 font-semibold">特定口座推奨</h4>${(tax.tokutei_account?.recommended || []).map(n => `<div class="text-xs text-gs-text-muted flex gap-1.5"><span class="text-gs-accent/60">&#x2022;</span>${esc(n)}</div>`).join('')}<div class="text-xs text-gs-text-muted/60 mt-1.5 italic">${esc(tax.tokutei_account?.reason || '')}</div></div>${(tax.notes || []).map(n => `<div class="text-xs text-gs-text-muted/50 mt-2">※ ${esc(n)}</div>`).join('')}`);
    const dca = d.dca_plan || {};
    html += card('ドルコスト平均法計画', `${metric('月次投資額合計', formatCurrency(dca.total_monthly))}${(dca.allocation || []).map(a => metric(esc(a.etf), '&yen;' + formatNumber(a.monthly_amount) + '/月')).join('')}<div class="text-xs text-gs-text-muted/60 mt-3 italic">${esc(dca.strategy || '')}</div>`);
    html += '</div>';
    return html;
}

// ════════════════════════════════════════════════════
// McKinsey マクロ
// ════════════════════════════════════════════════════
function renderMcKinsey(d) {
    let html = '';
    const mi = d.market_indicators || {};
    html += bannerCard(`<h3 class="text-gs-accent font-bold mb-4 text-sm tracking-wide">マーケット指標</h3>
        <div class="grid grid-cols-2 md:grid-cols-4 gap-3 text-center">
            ${mi.nikkei225 ? `<div class="bg-gs-darker/60 rounded-xl p-3"><div class="text-[10px] text-gs-text-muted mb-1">日経225</div><div class="text-white font-bold">&yen;${formatNumber(mi.nikkei225.current)}</div><div class="text-[10px] ${mi.nikkei225.change_ytd > 0 ? 'text-green-400' : 'text-red-400'}">YTD ${formatPercent(mi.nikkei225.change_ytd)}</div></div>` : ''}
            ${mi.usdjpy ? `<div class="bg-gs-darker/60 rounded-xl p-3"><div class="text-[10px] text-gs-text-muted mb-1">USD/JPY</div><div class="text-white font-bold">&yen;${mi.usdjpy.current}</div></div>` : ''}
        </div>`);
    html += '<div class="grid grid-cols-1 lg:grid-cols-2 gap-4">';
    const ir = d.interest_rate_analysis || {};
    html += card('金利環境分析', `${metric('米10年債利回り', ir.us_10y_yield ? ir.us_10y_yield + '%' : 'N/A')}${metric('環境', esc(ir.environment || 'N/A'))}${Object.entries(ir.impact || {}).map(([k, v]) => metric(k, esc(v))).join('')}<div class="text-xs text-gs-text-muted/60 mt-3 italic">${esc(ir.outlook || '')}</div>`);
    const cur = d.currency_analysis || {};
    html += card('為替分析', `${metric('USD/JPY', cur.usdjpy ? '&yen;' + cur.usdjpy : 'N/A')}${metric('状況', esc(cur.yen_status || 'N/A'))}${metric('影響', esc(cur.impact || 'N/A'))}${cur.beneficiaries?.length ? '<div class="mt-3 text-xs text-green-400 flex gap-1"><span class="font-semibold">恩恵:</span> ' + cur.beneficiaries.map(esc).join(', ') + '</div>' : ''}${cur.losers?.length ? '<div class="text-xs text-red-400 flex gap-1 mt-1"><span class="font-semibold">逆風:</span> ' + cur.losers.map(esc).join(', ') + '</div>' : ''}`);
    const sr = d.sector_recommendation || [];
    let srBody = '';
    sr.forEach(s => {
        const color = s.stance.includes('オーバー') ? 'green' : s.stance.includes('アンダー') ? 'red' : 'yellow';
        srBody += `<div class="py-2.5 border-b border-gs-border/20 last:border-0"><div class="flex justify-between items-center"><span class="text-sm text-white">${esc(s.sector)}</span><div>${badge(s.stance, color)}</div></div><div class="text-xs text-gs-text-muted mt-1">${esc(s.reason)}</div></div>`;
    });
    html += card('セクター推奨', srBody);
    const gr = d.global_risks || [];
    let grBody = '';
    gr.forEach(r => {
        const color = r.severity.includes('高') ? 'red' : r.severity.includes('中') ? 'orange' : 'yellow';
        grBody += `<div class="py-2.5 border-b border-gs-border/20 last:border-0"><div class="flex justify-between items-center"><span class="text-sm text-white">${esc(r.risk)}</span>${badge(r.severity, color)}</div><div class="text-xs text-gs-text-muted mt-1">${esc(r.impact)}</div></div>`;
    });
    html += card('グローバルリスクファクター', grBody);
    html += card('影響タイムライン', `${(d.timeline || []).map(t => `<div class="py-2.5 border-b border-gs-border/20 last:border-0"><div class="text-sm text-gs-accent font-medium">${esc(t.period)}</div><div class="text-xs text-gs-text-muted mt-0.5">${esc(t.focus)}</div></div>`).join('')}`);
    const adj = d.portfolio_adjustments || {};
    html += card('ポートフォリオ調整提案', `<div class="space-y-1.5">${(adj.recommended_actions || []).map(a => `<div class="text-xs text-gs-text-muted flex gap-1.5"><span class="text-gs-accent/60">&#x2022;</span>${esc(a)}</div>`).join('')}</div><div class="mt-4 p-4 bg-gs-darker/60 rounded-xl text-sm text-white leading-relaxed">${esc(adj.overall_stance || '')}</div>`);
    html += '</div>';
    return html;
}

// ════════════════════════════════════════════════════
// Morgan Stanley DCF
// ════════════════════════════════════════════════════
function renderMorganDCF(d, stockData) {
    let html = '';
    const v = d.verdict || {};
    if (v.verdict) {
        const color = v.upside_pct > 10 ? 'green' : v.upside_pct > -10 ? 'yellow' : 'red';
        const tc = SAFE_TEXT_COLORS[color] || 'text-white';
        html += bannerCard(`<div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div><h3 class="text-gs-accent font-bold mb-2 text-sm tracking-wide">DCFバリュエーション判定</h3><span class="text-2xl font-bold ${tc}">${esc(v.verdict)}</span><span class="text-gs-text-muted ml-2">${esc(v.recommendation)}</span></div>
                <div class="text-right"><div class="text-xs text-gs-text-muted mb-1">理論株価</div><div class="text-3xl font-bold text-white tracking-tight">&yen;${formatNumber(v.fair_value)}</div><div class="text-sm mt-1 ${v.upside_pct > 0 ? 'text-green-400' : 'text-red-400'} font-medium">${formatPercent(v.upside_pct)} vs 現在値</div></div>
            </div>`);
    }
    html += '<div class="grid grid-cols-1 lg:grid-cols-2 gap-4">';

    // Revenue projection with sparkline
    const proj = d.projections || {};
    if (proj.yearly) {
        const revSparkline = sparkline(proj.yearly.map(y => y.revenue), { color: '#4A9EFF', height: 40, showArea: true, label: '売上高推移予測' });
        html += card('5年間収益予測', `<div class="text-xs text-gs-text-muted/60 mb-3 italic">前提: ${esc(proj.growth_assumption || '')}</div>${revSparkline}<div class="mt-3">${renderTable(
            [{ label: '年度' }, { label: '売上高', align: 'right' }, { label: '成長率', align: 'right' }],
            proj.yearly.map(y => [{ text: y.year }, { html: formatCurrency(y.revenue) }, { text: y.growth_rate_pct + '%' }]),
        )}</div>`);
    }

    // FCF projection with sparkline
    const fcf = d.fcf_projections || {};
    if (fcf.yearly) {
        const fcfSparkline = sparkline(fcf.yearly.map(y => y.fcf), { color: '#4ade80', height: 40, showArea: true, label: 'FCF推移予測' });
        html += card('FCF予測', `<div class="text-xs text-gs-text-muted/60 mb-3 italic">FCFマージン: ${fcf.fcf_margin_assumption}%</div>${fcfSparkline}<div class="mt-3">${renderTable(
            [{ label: '年度' }, { label: 'FCF', align: 'right' }, { label: 'マージン', align: 'right' }],
            fcf.yearly.map(y => [{ text: y.year }, { html: formatCurrency(y.fcf) }, { text: y.fcf_margin_pct + '%' }]),
        )}</div>`);
    }
    const wacc = d.wacc || {};
    html += card('WACC推定', `${metric('WACC', wacc.wacc_pct ? wacc.wacc_pct + '%' : 'N/A')}${metric('株主資本コスト', wacc.cost_of_equity_pct ? wacc.cost_of_equity_pct + '%' : 'N/A')}${metric('負債コスト', wacc.cost_of_debt_pct ? wacc.cost_of_debt_pct + '%' : 'N/A')}${metric('ベータ', wacc.beta ?? 'N/A')}${metric('リスクフリーレート', wacc.risk_free_rate_pct ? wacc.risk_free_rate_pct + '%' : 'N/A')}${metric('D/E比率', wacc.debt_equity_ratio ?? 'N/A')}`);
    const tv = d.terminal_value || {};
    html += card('ターミナルバリュー', `<h4 class="text-xs text-gs-accent mb-2 font-semibold">${esc(tv.perpetuity_growth?.method || '')}</h4>${metric('ターミナルバリュー', formatCurrency(tv.perpetuity_growth?.terminal_value))}${metric('永続成長率', tv.perpetuity_growth?.growth_rate_pct ? tv.perpetuity_growth.growth_rate_pct + '%' : 'N/A')}<h4 class="text-xs text-gs-accent mb-2 mt-4 font-semibold">${esc(tv.exit_multiple?.method || '')}</h4>${metric('ターミナルバリュー', formatCurrency(tv.exit_multiple?.terminal_value))}`);
    const val = d.valuation || {};
    html += card('企業価値・株式価値', `${metric('FCF現在価値合計', formatCurrency(val.total_pv_fcf))}${metric('TV現在価値（永続成長）', formatCurrency(val.pv_terminal_perpetuity))}${metric('TV現在価値（マルチプル）', formatCurrency(val.pv_terminal_multiple))}${metric('純有利子負債', formatCurrency(val.net_debt))}<div class="border-t border-gs-border/40 mt-3 pt-3">${metric('1株価値（永続成長法）', val.per_share_perpetuity ? '&yen;' + formatNumber(val.per_share_perpetuity) : 'N/A')}${metric('1株価値（マルチプル法）', val.per_share_multiple ? '&yen;' + formatNumber(val.per_share_multiple) : 'N/A')}${metric('1株価値（平均）', val.per_share_average ? '&yen;' + formatNumber(val.per_share_average) : 'N/A')}</div>`);

    // Enhanced sensitivity analysis with heatmap
    const sens = d.sensitivity || {};
    if (sens.table?.length > 0) {
        html += card('感度分析ヒートマップ', heatmapTable(sens, d.current_price));
    }
    html += '</div>';
    return html;
}
