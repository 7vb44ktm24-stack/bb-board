// The charts: ECharts drawn in the page's own colours (read from the CSS tokens, so light and dark both work), thin marks,
// hairline grids, a tooltip on every mark, and a click on a mark that opens the view behind it.

const live = new Map();          // element id -> chart

export function tokens() {
  const cs = getComputedStyle(document.documentElement);
  const v = (n) => cs.getPropertyValue(n).trim();
  return {
    ink: v('--ink'), ink2: v('--ink-2'), muted: v('--muted'), grid: v('--grid'), axis: v('--axis'), panel: v('--panel'), bg: v('--bg'),
    line: v('--line'), good: v('--good'), bad: v('--bad'), goodFill: v('--good-fill'), badFill: v('--bad-fill'), mid: v('--mid'),
    accent: v('--accent'), s1: v('--s1'), s2: v('--s2'), s3: v('--s3'), s4: v('--s4'), s5: v('--s5'),
    book: { Stoiximan: v('--bk-stoiximan'), Superbet: v('--bk-superbet'), Pamestoixima: v('--bk-pame'), Novibet: v('--bk-novibet'), bet365: v('--bk-bet365') },
  };
}
export const bookColor = (b, t = tokens()) => t.book[b] || t.muted;

function hexToRgb(h) {
  const s = h.replace('#', '');
  const n = parseInt(s.length === 3 ? s.split('').map((c) => c + c).join('') : s, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
function mix(a, b, t) {
  const x = hexToRgb(a), y = hexToRgb(b);
  return `rgb(${x.map((v, i) => Math.round(v + (y[i] - v) * t)).join(',')})`;
}
// a diverging fill for a signed value: the loss colour, a neutral grey at zero, the profit colour
export function divColor(v, max, t = tokens()) {
  if (v === null || v === undefined || !Number.isFinite(v)) return t.mid;
  const k = Math.min(1, Math.abs(v) / (max || 1));
  return mix(t.mid, v >= 0 ? t.goodFill : t.badFill, Math.sqrt(k));
}
export function seqColor(v, max, t = tokens()) {
  const k = Math.min(1, Math.max(0, v / (max || 1)));
  return mix(t.mid, t.s1, Math.sqrt(k));
}

function base(t) {
  return {
    animationDuration: matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 450,
    textStyle: { fontFamily: getComputedStyle(document.body).fontFamily, color: t.ink2 },
    tooltip: {
      confine: true, backgroundColor: t.panel, borderColor: t.line, borderWidth: 1, padding: [8, 10],
      textStyle: { color: t.ink, fontSize: 12 }, extraCssText: 'border-radius:10px; box-shadow:0 8px 24px rgba(0,0,0,.18);',
      triggerOn: 'mousemove|click',
    },
  };
}
function axis(t, extra = {}) {
  return {
    axisLine: { lineStyle: { color: t.axis } }, axisTick: { show: false },
    axisLabel: { color: t.muted, fontSize: 11, hideOverlap: true }, splitLine: { lineStyle: { color: t.grid, width: 1 } }, ...extra,
  };
}

export function mount(el, option, { onClick, height } = {}) {
  if (!el || !window.echarts) return null;
  if (height) el.style.height = height + 'px';
  const old = live.get(el.id);
  if (old) { old.dispose(); live.delete(el.id); }
  const c = window.echarts.init(el, null, { renderer: 'svg' });
  c.setOption(option);
  if (onClick) c.on('click', (p) => onClick(p));
  live.set(el.id, c);
  return c;
}
export function disposeIn(root) {
  for (const [id, c] of live) {
    const el = document.getElementById(id);
    if (!el || !document.body.contains(el) || (root && root.contains(el))) { c.dispose(); live.delete(id); }
  }
}
export function resizeAll() { for (const c of live.values()) c.resize(); }

const pctFmt = (v) => `${v > 0 ? '+' : v < 0 ? '−' : ''}${Math.abs(Math.round(v * 100))}%`;
const gbp = (v) => `${v < 0 ? '−' : v > 0 ? '+' : ''}£${Math.abs(Math.round(v)).toLocaleString('en-GB')}`;
export const FMT = { pct: pctFmt, gbp, n: (v) => String(Math.round(v)), pp: (v) => `${v > 0 ? '+' : v < 0 ? '−' : ''}${Math.abs(Math.round(v * 100))} pts`, x: (v) => v.toFixed(1) };

// ------------------------------------------------------------------------------------------------ the running profit

// series: [{name, color, pts: [[time, value, label]]}], one line each, never added together
export function runningChart(el, series, { fmt = gbp, area = true, onClick, daily = false } = {}) {
  const t = tokens();
  const legendChars = series.reduce((s, x) => s + String(x.name).length + 4, 0);   // a legend longer than a phone's width takes two rows
  const opt = {
    ...base(t),
    grid: { left: 6, right: 58, top: series.length > 1 ? (legendChars > 44 ? 50 : 30) : 18, bottom: 6, containLabel: true },
    xAxis: { type: 'time', ...(daily ? { minInterval: 864e5 } : {}), ...axis(t, { splitLine: { show: false } }), axisLabel: { color: t.muted, fontSize: 11, hideOverlap: true, formatter: '{d} {MMM}' } },
    yAxis: { type: 'value', ...axis(t), axisLine: { show: false }, axisLabel: { color: t.muted, fontSize: 11, formatter: (v) => fmt(v) } },
    tooltip: { ...base(t).tooltip, trigger: 'axis', axisPointer: { type: 'line', lineStyle: { color: t.axis } },
      formatter: (ps) => ps.map((p) => `<div style="display:flex;gap:8px;align-items:center"><span style="width:10px;height:2px;background:${p.color};display:inline-block"></span><b>${fmt(p.value[1])}</b><span style="color:${t.muted}">${p.seriesName}</span></div>${p.value[2] ? `<div style="color:${t.muted};font-size:11px;max-width:240px;white-space:normal">${p.value[2]}</div>` : ''}`).join('') },
    legend: series.length > 1 ? { top: 0, right: 0, icon: 'roundRect', itemWidth: 12, itemHeight: 3, textStyle: { color: t.ink2, fontSize: 11 } } : undefined,
    series: series.map((s) => ({
      name: s.name, type: 'line', data: s.pts, showSymbol: false, symbol: 'circle', symbolSize: 8, step: false,
      lineStyle: { width: 2, color: s.color || t.s1, cap: 'round', join: 'round' }, itemStyle: { color: s.color || t.s1, borderColor: t.panel, borderWidth: 2 },
      areaStyle: area && series.length === 1 ? { color: s.color || t.s1, opacity: 0.1 } : undefined,
      markLine: { silent: true, symbol: 'none', lineStyle: { color: t.axis, width: 1, type: 'solid' }, label: { show: false }, data: [{ yAxis: 0 }] },
      endLabel: { show: true, formatter: (p) => fmt(p.value[1]), color: t.ink, fontSize: 11 },
      labelLayout: { moveOverlap: 'shiftY' },
    })),
  };
  return mount(el, opt, { onClick });
}

// the fall from the highest point so far, its own small chart below the running profit (never a second axis)
export function drawdownChart(el, pts, { fmt = gbp } = {}) {
  const t = tokens();
  return mount(el, {
    ...base(t),
    grid: { left: 6, right: 14, top: 6, bottom: 4, containLabel: true },
    xAxis: { type: 'time', show: false },
    yAxis: { type: 'value', max: 0, ...axis(t), axisLine: { show: false }, axisLabel: { color: t.muted, fontSize: 10, formatter: (v) => fmt(v) }, splitNumber: 2 },
    tooltip: { ...base(t).tooltip, trigger: 'axis', formatter: (ps) => `Below the top: <b>${fmt(ps[0].value[1])}</b>` },
    series: [{ type: 'line', data: pts, showSymbol: false, lineStyle: { width: 1.5, color: t.bad }, areaStyle: { color: t.bad, opacity: 0.12 } }],
  });
}

// how sure each bookmaker can be that the account beats its prices, a match day at a time (fm/accounts.py's trail on every bet
// up to that day, 19 Oct 2026): a line a bookmaker in its own colour, each with its own marker and its name at the end (red and
// green sit close for colour-blind eyes, so the colour is never alone), the words as recessive lines at 1, 2 and 3.
// days: ['Fri 16', ...]; series: [{name, color, pts: [{value, words, read, cut, bets} | null per day]}]
export function heatChart(el, days, series, { onClick } = {}) {
  const t = tokens();
  const SHAPES = ['circle', 'diamond', 'triangle', 'rect'];
  const LEVELS = [[1, 'a lean'], [2, 'likely'], [3, 'near certain']];
  const top = Math.max(3.5, ...series.flatMap((s) => s.pts.map((p) => (p && Number.isFinite(p.value) ? p.value + 0.3 : 0))));
  const pctOf = (v) => (Number.isFinite(v) ? `${Math.round(v * 100)}%` : '–');
  return mount(el, {
    ...base(t),
    grid: { left: 6, right: 96, top: series.length > 1 ? 30 : 14, bottom: 6, containLabel: true },
    xAxis: { type: 'category', data: days, boundaryGap: false, ...axis(t, { splitLine: { show: false } }) },
    yAxis: { type: 'value', min: 0, max: Math.ceil(top), interval: 1, ...axis(t), axisLine: { show: false }, axisLabel: { color: t.muted, fontSize: 11 } },
    tooltip: { ...base(t).tooltip, trigger: 'axis', axisPointer: { type: 'line', lineStyle: { color: t.axis } },
      formatter: (ps) => `<div style="color:${t.muted}">${ps[0] ? ps[0].axisValue : ''}</div>` + ps.filter((p) => p.value !== null && p.value !== undefined).map((p) => {
        const d = series[p.seriesIndex].pts[p.dataIndex] || {};
        return `<div style="display:flex;gap:8px;align-items:center"><span style="width:10px;height:2px;background:${p.color};display:inline-block"></span><b>${p.value.toFixed(2)}</b><span>${p.seriesName}: ${d.words || 'too few yet'}</span></div>`
          + `<div style="color:${t.muted};font-size:11px">that day: ${d.bets || 0} bets, ${d.read || 0} read again, cut 3%+ after ${pctOf(d.cut)}</div>`;
      }).join('') },
    legend: series.length > 1 ? { top: 0, right: 0, icon: 'roundRect', itemWidth: 12, itemHeight: 3, textStyle: { color: t.ink2, fontSize: 11 } } : undefined,
    series: series.map((s, i) => ({
      name: s.name, type: 'line', data: s.pts.map((p) => (p && Number.isFinite(p.value) ? p.value : null)), connectNulls: false,
      showSymbol: true, symbol: SHAPES[i % SHAPES.length], symbolSize: 8,
      lineStyle: { width: 2, color: s.color, cap: 'round', join: 'round' }, itemStyle: { color: s.color, borderColor: t.panel, borderWidth: 2 },
      endLabel: { show: true, formatter: (p) => `${s.name} ${Number(p.value).toFixed(2)}`, color: t.ink, fontSize: 11 },
      labelLayout: { moveOverlap: 'shiftY' },
      markLine: i === 0 ? { silent: true, symbol: 'none', lineStyle: { color: t.axis, width: 1, type: 'dashed' },
        label: { position: 'insideStartTop', color: t.muted, fontSize: 10, formatter: (p) => p.name }, data: LEVELS.map(([y, w]) => ({ yAxis: y, name: w })) } : undefined,
    })),
  }, { onClick });
}

// ------------------------------------------------------------------------------------------------ bars

// rows: [{label, value, color?, sub?}] - horizontal when there are many labels or long ones
export function bars(el, rows, { fmt = pctFmt, horizontal = true, onClick, signed = true, height } = {}) {
  const t = tokens();
  const cats = rows.map((r) => r.label);
  const data = rows.map((r) => ({
    value: r.value, r,
    itemStyle: { color: r.color || (signed ? (r.value >= 0 ? t.good : t.bad) : t.s1), borderRadius: horizontal ? (r.value >= 0 ? [0, 4, 4, 0] : [4, 0, 0, 4]) : (r.value >= 0 ? [4, 4, 0, 0] : [0, 0, 4, 4]) },
  }));
  const valueAxis = { type: 'value', ...axis(t), axisLine: { show: false }, axisLabel: { color: t.muted, fontSize: 11, hideOverlap: true, formatter: (v) => fmt(v) } };
  const catAxis = { type: 'category', data: cats, ...axis(t, { splitLine: { show: false } }), axisLabel: { color: t.ink2, fontSize: 11, width: horizontal ? 120 : 70, overflow: 'truncate', interval: 0 }, inverse: horizontal };
  const h = height || (horizontal ? Math.max(140, rows.length * 30 + 40) : 220);
  el.style.height = h + 'px';
  return mount(el, {
    ...base(t),
    grid: { left: 6, right: 28, top: 10, bottom: 6, containLabel: true },
    xAxis: horizontal ? valueAxis : catAxis, yAxis: horizontal ? catAxis : valueAxis,
    tooltip: { ...base(t).tooltip, trigger: 'item', formatter: (p) => `<b>${fmt(p.value)}</b> <span style="color:${t.muted}">${p.name}</span>${p.data.r.sub ? `<div style="color:${t.muted};font-size:11px">${p.data.r.sub}</div>` : ''}` },
    series: [{ type: 'bar', data, barMaxWidth: 22, barCategoryGap: '35%',
      label: { show: rows.length <= 14, position: horizontal ? 'right' : 'top', color: t.ink2, fontSize: 11, formatter: (p) => fmt(p.value) },
      markLine: signed ? { silent: true, symbol: 'none', lineStyle: { color: t.axis, width: 1, type: 'solid' }, label: { show: false }, data: [horizontal ? { xAxis: 0 } : { yAxis: 0 }] } : undefined }],
  }, { onClick: onClick ? (p) => p.data && onClick(p.data.r) : null });
}

// a return with its luck band: the bar is the return, the whisker one band of luck either side
export function luckBars(el, rows, { onClick } = {}) {
  const t = tokens();
  const cats = rows.map((r) => r.label);
  el.style.height = Math.max(150, rows.length * 34 + 40) + 'px';
  // a return cannot fall below -100%; a very long luck band (builders at long prices) is cut at the edge rather than squashing the rest
  const hi = Math.min(1.5, Math.max(0.5, ...rows.map((r) => r.value + Math.min(r.luck || 0, 1))));
  const lo = Math.max(-1.05, Math.min(-0.5, ...rows.map((r) => r.value - (r.luck || 0))));
  return mount(el, {
    ...base(t),
    grid: { left: 6, right: 40, top: 10, bottom: 6, containLabel: true },
    xAxis: { type: 'value', min: Math.floor(lo * 10) / 10, max: Math.ceil(hi * 10) / 10, ...axis(t), axisLine: { show: false }, axisLabel: { color: t.muted, fontSize: 11, formatter: pctFmt } },
    yAxis: { type: 'category', data: cats, inverse: true, ...axis(t, { splitLine: { show: false } }), axisLabel: { color: t.ink2, fontSize: 11, width: 120, overflow: 'truncate', interval: 0 } },
    tooltip: { ...base(t).tooltip, trigger: 'item', formatter: (p) => { const r = p.data.r; return `<b>${pctFmt(r.value)}</b> <span style="color:${t.muted}">${r.label}</span><div style="font-size:11px;color:${t.muted}">luck alone ±${Math.round((r.luck || 0) * 100)}% · ${r.n} settled · ${r.verdict}</div>`; } },
    series: [
      { type: 'bar', barMaxWidth: 16, data: rows.map((r) => ({ value: r.value, r, itemStyle: { color: r.value >= 0 ? t.good : t.bad, opacity: r.verdict === 'too early' || r.verdict === 'too few' ? 0.45 : 1, borderRadius: r.value >= 0 ? [0, 4, 4, 0] : [4, 0, 0, 4] } })),
        markLine: { silent: true, symbol: 'none', lineStyle: { color: t.axis, width: 1, type: 'solid' }, label: { show: false }, data: [{ xAxis: 0 }] } },
      { type: 'custom', silent: true, z: 5, clip: true, encode: { x: [1, 2], y: 0 }, data: rows.map((r, i) => [i, r.value - (r.luck || 0), r.value + (r.luck || 0)]),
        renderItem: (params, api) => {
          const y = api.value(0), lo = api.coord([api.value(1), y]), hi = api.coord([api.value(2), y]);
          const s = { stroke: t.ink2, lineWidth: 1.2 };
          return { type: 'group', children: [
            { type: 'line', shape: { x1: lo[0], y1: lo[1], x2: hi[0], y2: hi[1] }, style: s },
            { type: 'line', shape: { x1: lo[0], y1: lo[1] - 5, x2: lo[0], y2: lo[1] + 5 }, style: s },
            { type: 'line', shape: { x1: hi[0], y1: hi[1] - 5, x2: hi[0], y2: hi[1] + 5 }, style: s },
          ] };
        } },
    ],
  }, { onClick: onClick ? (p) => p.data && p.data.r && onClick(p.data.r) : null });
}

// several series side by side per category (said / needed / won), each series one colour
export function groupedBars(el, cats, series, { fmt = pctFmt, onClick, height = 240 } = {}) {
  const t = tokens();
  el.style.height = height + 'px';
  return mount(el, {
    ...base(t),
    legend: { top: 0, left: 0, icon: 'roundRect', itemWidth: 10, itemHeight: 10, textStyle: { color: t.ink2, fontSize: 11 } },
    grid: { left: 6, right: 10, top: 30, bottom: 6, containLabel: true },
    xAxis: { type: 'category', data: cats, ...axis(t, { splitLine: { show: false } }), axisLabel: { color: t.ink2, fontSize: 11, interval: 0, width: 70, overflow: 'truncate' } },
    yAxis: { type: 'value', ...axis(t), axisLine: { show: false }, axisLabel: { color: t.muted, fontSize: 11, formatter: fmt } },
    tooltip: { ...base(t).tooltip, trigger: 'axis', axisPointer: { type: 'shadow', shadowStyle: { color: t.grid, opacity: 0.4 } },
      formatter: (ps) => `<div style="color:${t.muted};margin-bottom:2px">${ps[0].name}</div>` + ps.map((p) => `<div><span style="width:10px;height:2px;background:${p.color};display:inline-block;margin-right:6px;vertical-align:middle"></span><b>${p.value === null || p.value === undefined ? '–' : fmt(p.value)}</b> <span style="color:${t.muted}">${p.seriesName}</span></div>`).join('') },
    series: series.map((s) => ({ name: s.name, type: 'bar', data: s.data, barMaxWidth: 14, barGap: '20%', itemStyle: { color: s.color, borderRadius: [4, 4, 0, 0] } })),
  }, { onClick });
}

// ------------------------------------------------------------------------------------------------ heatmap and calendar

// cells: [{x, y, value, n, label}] on keys xs (columns) and ys (rows)
export function heatmap(el, xs, ys, cells, { fmt = pctFmt, metric = 'ret', min = 0, onClick } = {}) {
  const t = tokens();
  const inner = cells.filter((c) => !c.total);
  const vals = inner.filter((c) => c.n >= min && Number.isFinite(c.value)).map((c) => Math.abs(c.value));
  const max = metric === 'n' ? Math.max(1, ...inner.map((c) => c.value || 0)) : Math.max(0.0001, ...(vals.length ? vals : [1]));
  const cap = metric === 'ret' || metric === 'level' ? Math.min(max, 1) : max;
  const h = Math.max(160, ys.length * 38 + 70);
  el.style.height = h + 'px';
  // up to five columns: each name breaks onto two lines within its column (they had run into each other on a phone);
  // more: slanted and cut short
  const colW = Math.max(40, ((el.clientWidth || 340) - 120) / Math.max(1, xs.length));
  const xLabel = xs.length <= 5 ? { width: Math.floor(colW) - 6, overflow: 'break', rotate: 0, lineHeight: 13 } : { width: 72, overflow: 'truncate', rotate: 30 };
  const data = cells.map((c) => {
    const ok = c.n >= min && Number.isFinite(c.value);
    const fill = !ok ? t.bg : metric === 'n' ? seqColor(Math.min(c.value, max), max, t) : divColor(c.value, cap, t);
    // a total (c.total: 'row', 'col' or 'all', the user's ask of 19 Oct 2026) is framed and bold, and never sets the colour scale
    return { value: [xs.indexOf(c.x), ys.indexOf(c.y), c.value], c, itemStyle: { color: fill, borderColor: c.total ? t.muted : t.panel, borderWidth: c.total ? 1.5 : 2, borderRadius: 4 },
      label: { show: true, color: ok ? t.ink : t.muted, fontSize: 11, fontWeight: c.total ? 700 : 400, formatter: () => (ok ? `${fmt(c.value)}\n{n|${c.n}}` : c.n ? `{n|${c.n}}` : ''), rich: { n: { color: t.muted, fontSize: 9, lineHeight: 12 } } } };
  });
  return mount(el, {
    ...base(t),
    grid: { left: 6, right: 6, top: 6, bottom: 6, containLabel: true },
    xAxis: { type: 'category', data: xs, position: 'top', ...axis(t, { splitLine: { show: false } }), axisLine: { show: false }, axisLabel: { color: t.ink2, fontSize: 11, interval: 0, ...xLabel } },
    yAxis: { type: 'category', data: ys, inverse: true, ...axis(t, { splitLine: { show: false } }), axisLine: { show: false }, axisLabel: { color: t.ink2, fontSize: 11, width: 110, overflow: 'truncate', interval: 0 } },
    tooltip: { ...base(t).tooltip, trigger: 'item', formatter: (p) => { const c = p.data.c; return `<div style="color:${t.muted}">${c.y} · ${c.x}</div><b>${Number.isFinite(c.value) ? fmt(c.value) : '–'}</b> on ${c.n} settled<div style="font-size:11px;color:${t.muted}">return ${pctFmt(c.ret || 0)}, luck ±${Math.round((c.luck || 0) * 100)}% · ${c.verdict}</div>`; } },
    series: [{ type: 'heatmap', data, emphasis: { itemStyle: { borderColor: t.ink, borderWidth: 2 } } }],
  }, { onClick: onClick ? (p) => p.data && onClick(p.data.c) : null });
}

// days: [[ 'YYYY-MM-DD', profit, n ]]
export function calendar(el, days, { onClick } = {}) {
  const t = tokens();
  if (!days.length) { el.innerHTML = ''; return null; }
  const first = days[0][0], last = days[days.length - 1][0];
  const max = Math.max(1, ...days.map((d) => Math.abs(d[1])));
  const weeks = Math.max(1, Math.ceil((Date.parse(last) - Date.parse(first)) / (7 * 864e5)) + 1);
  el.style.height = Math.min(320, 40 + weeks * 30) + 'px';
  return mount(el, {
    ...base(t),
    tooltip: { ...base(t).tooltip, trigger: 'item', formatter: (p) => `<div style="color:${t.muted}">${p.value[0]}</div><b>${gbp(p.value[1])}</b> on ${p.value[2]} settled` },
    calendar: { orient: 'vertical', range: [first, last], cellSize: ['auto', 26], top: 30, left: 30, right: 6, bottom: 6,
      itemStyle: { color: t.bg, borderColor: t.panel, borderWidth: 3 }, splitLine: { show: false },
      dayLabel: { firstDay: 1, color: t.muted, fontSize: 10, nameMap: ['S', 'M', 'T', 'W', 'T', 'F', 'S'] },
      monthLabel: { color: t.muted, fontSize: 10, nameMap: 'en' }, yearLabel: { show: false } },
    series: [{ type: 'heatmap', coordinateSystem: 'calendar', data: days.map((d) => ({ value: d, itemStyle: { color: divColor(d[1], max, t), borderRadius: 4 } })),
      label: { show: true, fontSize: 9, color: t.ink, formatter: (p) => (Math.abs(p.value[1]) >= 1 ? `${p.value[1] > 0 ? '+' : '−'}${Math.abs(Math.round(p.value[1]))}` : '') } }],
  }, { onClick: onClick ? (p) => p.value && onClick(p.value[0]) : null });
}

// ------------------------------------------------------------------------------------------------ scatter and calibration

export function calibrationChart(el, bins) {
  const t = tokens();
  el.style.height = '280px';
  const pts = bins.filter((b) => b.n && Number.isFinite(b.said));
  const xMin = Math.max(0, Math.floor((Math.min(0.3, ...pts.map((b) => b.said)) - 0.05) * 10) / 10);
  const xMax = Math.min(1, Math.ceil((Math.max(0.8, ...pts.map((b) => b.said)) + 0.05) * 10) / 10);
  return mount(el, {
    ...base(t),
    grid: { left: 6, right: 14, top: 24, bottom: 26, containLabel: true },
    legend: { top: 0, left: 0, textStyle: { color: t.ink2, fontSize: 11 }, itemWidth: 12, itemHeight: 8 },
    xAxis: { type: 'value', min: xMin, max: xMax, name: 'We said', nameLocation: 'middle', nameGap: 24, nameTextStyle: { color: t.muted, fontSize: 11 }, ...axis(t), axisLabel: { color: t.muted, fontSize: 11, formatter: (v) => Math.round(v * 100) + '%' } },
    yAxis: { type: 'value', min: 0, max: 1, ...axis(t), axisLine: { show: false }, axisLabel: { color: t.muted, fontSize: 11, formatter: (v) => Math.round(v * 100) + '%' } },
    tooltip: { ...base(t).tooltip, trigger: 'item', formatter: (p) => { const b = p.data.b; return b ? `<div style="color:${t.muted}">We said ${Math.round(b.lo * 100)}–${Math.round(Math.min(b.hi, 1) * 100)}%</div><b>won ${Math.round(b.won * 100)}%</b> of ${b.n} · said ${Math.round(b.said * 100)}% · prices needed ${Math.round(b.needed * 100)}%<div style="font-size:11px;color:${t.muted}">95% range ${Math.round(b.ci[0] * 100)}–${Math.round(b.ci[1] * 100)}%</div>` : ''; } },
    series: [
      { name: 'Right on', type: 'line', data: [[xMin, xMin], [xMax, xMax]], showSymbol: false, silent: true, lineStyle: { color: t.axis, width: 1 } },
      { name: 'Won', type: 'scatter', data: pts.map((b) => ({ value: [b.said, b.won], b, symbolSize: Math.max(10, Math.min(30, 6 + Math.sqrt(b.n) * 3)) })), itemStyle: { color: t.s1, borderColor: t.panel, borderWidth: 2 } },
      { name: 'Prices needed', type: 'scatter', symbol: 'diamond', data: pts.map((b) => ({ value: [b.said, b.needed], b, symbolSize: 9 })), itemStyle: { color: t.muted } },
      { type: 'custom', silent: true, clip: true, data: pts.map((b) => [b.said, b.ci[0], b.ci[1]]),
        renderItem: (params, api) => { const lo = api.coord([api.value(0), api.value(1)]), hi = api.coord([api.value(0), api.value(2)]); return { type: 'line', shape: { x1: lo[0], y1: lo[1], x2: hi[0], y2: hi[1] }, style: { stroke: t.s1, lineWidth: 1, opacity: 0.5 } }; } },
    ],
  });
}

export function scatter(el, pts, { onClick, xName, yName, xFmt = (v) => v.toFixed(1), yFmt = (v) => v.toFixed(1), quad = true } = {}) {
  const t = tokens();
  el.style.height = '280px';
  return mount(el, {
    ...base(t),
    grid: { left: 6, right: 14, top: 10, bottom: 24, containLabel: true },
    xAxis: { type: 'value', name: xName, nameLocation: 'middle', nameGap: 24, nameTextStyle: { color: t.muted, fontSize: 11 }, ...axis(t), axisLabel: { color: t.muted, fontSize: 11, formatter: xFmt } },
    yAxis: { type: 'value', name: yName, nameTextStyle: { color: t.muted, fontSize: 11, align: 'left' }, ...axis(t), axisLine: { show: false }, axisLabel: { color: t.muted, fontSize: 11, formatter: yFmt } },
    tooltip: { ...base(t).tooltip, trigger: 'item', formatter: (p) => p.data.tip || '' },
    series: [{ type: 'scatter', symbolSize: 10, data: pts.map((p) => ({ value: [p.x, p.y], tip: p.tip, p, itemStyle: { color: p.color || t.s1, borderColor: t.panel, borderWidth: 2, opacity: 0.9 } })),
      markLine: quad ? { silent: true, symbol: 'none', lineStyle: { color: t.axis, width: 1, type: 'solid' }, label: { show: false }, data: [{ xAxis: 0 }, { yAxis: 0 }] } : undefined }],
  }, { onClick: onClick ? (p) => p.data && onClick(p.data.p) : null });
}

// a dot with a whisker for each row, against a zero line: our forecasts against a bookmaker's (Brier gap: lower is ours
// better; the found-it gap of the Lines tab: higher is)
export function dotWhisker(el, rows, { fmt = (v) => v.toFixed(3), onClick, better = 'lower', axisFmt, unit = ' a line' } = {}) {
  const t = tokens();
  el.style.height = Math.max(150, rows.length * 30 + 40) + 'px';
  const good = (v) => (better === 'higher' ? v > 0 : v < 0);
  return mount(el, {
    ...base(t),
    grid: { left: 6, right: 20, top: 10, bottom: 6, containLabel: true },
    xAxis: { type: 'value', splitNumber: 3, ...axis(t), axisLine: { show: false }, axisLabel: { color: t.muted, fontSize: 10, hideOverlap: true, formatter: axisFmt || ((v) => (v === 0 ? '0' : `${v > 0 ? '+' : '−'}${Math.abs(v).toFixed(2)}`)) } },
    yAxis: { type: 'category', data: rows.map((r) => r.label), inverse: true, ...axis(t, { splitLine: { show: false } }), axisLabel: { color: t.ink2, fontSize: 11, width: 130, overflow: 'truncate', interval: 0 } },
    tooltip: { ...base(t).tooltip, trigger: 'item', formatter: (p) => { const r = p.data && p.data.r; return r ? `<div style="color:${t.muted}">${r.label}</div><b>${fmt(r.value)}</b>${unit}${r.sub ? `<div style="font-size:11px;color:${t.muted}">${r.sub}</div>` : ''}` : ''; } },
    series: [
      { type: 'custom', silent: true, encode: { x: [1, 2], y: 0 }, data: rows.map((r, i) => [i, r.lo, r.hi]),
        renderItem: (params, api) => { const lo = api.coord([api.value(1), api.value(0)]), hi = api.coord([api.value(2), api.value(0)]); return { type: 'line', shape: { x1: lo[0], y1: lo[1], x2: hi[0], y2: hi[1] }, style: { stroke: t.ink2, lineWidth: 1.2 } }; } },
      { type: 'scatter', symbolSize: 10, data: rows.map((r) => ({ value: [r.value, r.label], r, itemStyle: { color: r.value === 0 ? t.muted : good(r.value) ? t.good : t.bad, borderColor: t.panel, borderWidth: 2 } })),
        markLine: { silent: true, symbol: 'none', lineStyle: { color: t.axis, width: 1, type: 'solid' }, label: { show: false }, data: [{ xAxis: 0 }] } },
    ],
  }, { onClick: onClick ? (p) => p.data && p.data.r && onClick(p.data.r) : null });
}

// a score for each row and column (the Lines tab: stat by forecaster), each cell coloured by how far it stands from its
// row's average, so the best in a stat shows whatever the stat's own level; cells: [{x, y, value, n}]
export function scoreGrid(el, xs, ys, cells, { fmt = pctFmt, better = 'higher', min = 10, onClick } = {}) {
  const t = tokens();
  const ok = (c) => c.n >= min && Number.isFinite(c.value);
  const rowMean = new Map(ys.map((y) => { const v = cells.filter((c) => c.y === y && ok(c)).map((c) => c.value); return [y, v.length ? v.reduce((s, x) => s + x, 0) / v.length : null]; }));
  const dev = (c) => { const m = rowMean.get(c.y); if (m === null || !ok(c)) return null; const d = c.value - m; return better === 'lower' ? -d : better === 'zero' ? Math.abs(m) - Math.abs(c.value) : d; };
  const span = Math.max(1e-9, ...cells.map((c) => Math.abs(dev(c) || 0)));
  el.style.height = Math.max(160, ys.length * 38 + 60) + 'px';
  const data = cells.map((c) => {
    const d = dev(c);
    return { value: [xs.indexOf(c.x), ys.indexOf(c.y), c.value], c, itemStyle: { color: d === null ? t.bg : divColor(d, span, t), borderColor: t.panel, borderWidth: 2, borderRadius: 4 },
      label: { show: true, color: ok(c) ? t.ink : t.muted, fontSize: 11, formatter: () => (ok(c) ? `${fmt(c.value)}\n{n|${c.n}}` : c.n ? `{n|${c.n}}` : ''), rich: { n: { color: t.muted, fontSize: 9, lineHeight: 12 } } } };
  });
  return mount(el, {
    ...base(t),
    grid: { left: 6, right: 6, top: 6, bottom: 6, containLabel: true },
    xAxis: { type: 'category', data: xs, position: 'top', ...axis(t, { splitLine: { show: false } }), axisLine: { show: false }, axisLabel: { color: t.ink2, fontSize: 11, interval: 0, width: 66, overflow: 'truncate' } },
    yAxis: { type: 'category', data: ys, inverse: true, ...axis(t, { splitLine: { show: false } }), axisLine: { show: false }, axisLabel: { color: t.ink2, fontSize: 11, width: 116, overflow: 'truncate', interval: 0 } },
    tooltip: { ...base(t).tooltip, trigger: 'item', formatter: (p) => { const c = p.data.c; return `<div style="color:${t.muted}">${c.y} · ${c.x}</div><b>${Number.isFinite(c.value) ? fmt(c.value) : '–'}</b> on ${c.n} counts${c.sub ? `<div style="font-size:11px;color:${t.muted}">${c.sub}</div>` : ''}`; } },
    series: [{ type: 'heatmap', data, emphasis: { itemStyle: { borderColor: t.ink, borderWidth: 2 } } }],
  }, { onClick: onClick ? (p) => p.data && onClick(p.data.c) : null });
}

// stakes a match day: settled and still open stacked, against a limit line (the real-money day cap)
export function exposure(el, days, { cap = 500, onClick } = {}) {
  const t = tokens();
  el.style.height = '220px';
  return mount(el, {
    ...base(t),
    legend: { top: 0, left: 0, icon: 'roundRect', itemWidth: 10, itemHeight: 10, textStyle: { color: t.ink2, fontSize: 11 } },
    grid: { left: 6, right: 10, top: 30, bottom: 6, containLabel: true },
    xAxis: { type: 'category', data: days.map((d) => d.label), ...axis(t, { splitLine: { show: false } }), axisLabel: { color: t.ink2, fontSize: 11, hideOverlap: true } },
    yAxis: { type: 'value', ...axis(t), axisLine: { show: false }, axisLabel: { color: t.muted, fontSize: 11, formatter: (v) => '£' + v } },
    tooltip: { ...base(t).tooltip, trigger: 'axis', axisPointer: { type: 'shadow', shadowStyle: { color: t.grid, opacity: 0.4 } },
      formatter: (ps) => `<div style="color:${t.muted}">${ps[0].name}</div>` + ps.map((p) => `<div><span style="width:10px;height:2px;background:${p.color};display:inline-block;margin-right:6px;vertical-align:middle"></span><b>£${Math.round(p.value)}</b> <span style="color:${t.muted}">${p.seriesName}</span></div>`).join('') },
    series: [
      { name: 'Settled', type: 'bar', stack: 'day', barMaxWidth: 22, data: days.map((d) => d.settled), itemStyle: { color: t.s1 } },
      { name: 'Open', type: 'bar', stack: 'day', barMaxWidth: 22, data: days.map((d) => d.open), itemStyle: { color: t.s5, borderRadius: [4, 4, 0, 0] },
        markLine: cap ? { silent: true, symbol: 'none', lineStyle: { color: t.bad, width: 1, type: 'solid' }, label: { show: true, position: 'insideEndTop', color: t.muted, fontSize: 10, formatter: `£${cap} day cap (real money)` }, data: [{ yAxis: cap }] } : undefined },
    ],
  }, { onClick });
}

// a small line for a tile: the last points of a running total
export function spark(el, values, { color } = {}) {
  const t = tokens();
  return mount(el, {
    animation: false, grid: { left: 0, right: 2, top: 2, bottom: 2 }, xAxis: { type: 'category', show: false, data: values.map((_, i) => i) },
    yAxis: { type: 'value', show: false, scale: true },
    series: [{ type: 'line', data: values, showSymbol: false, lineStyle: { width: 1.6, color: color || t.s1 }, areaStyle: { color: color || t.s1, opacity: 0.1 },
      markPoint: { symbol: 'circle', symbolSize: 6, itemStyle: { color: color || t.s1, borderColor: t.panel, borderWidth: 2 }, label: { show: false }, data: [{ coord: [values.length - 1, values[values.length - 1]] }] } }],
  });
}

// ------------------------------------------------------------------------------------------------ the Trends tab's marks

// an ordered cut (overlay bands, price bands) in one hue, light to dark (dark mode: dim to bright), each ramp checked with
// the dataviz validator (--ordinal, 18 Oct 2026): monotone lightness, gaps of 0.06 or more, the light end 2:1 on the panel
const RAMP_LIGHT = {
  2: ['#b096d9', '#5a2391'], 3: ['#b096d9', '#845eb6', '#5a2391'], 4: ['#baa5dc', '#9779c2', '#754da7', '#551c8b'],
  5: ['#bda9df', '#a186ca', '#8563b4', '#6b419e', '#521888'], 6: ['#bda9df', '#a68ccd', '#8f70bc', '#7954a9', '#643797', '#501485'],
  7: ['#bda9df', '#a990d0', '#9678c0', '#8261b1', '#7049a1', '#5e2f91', '#4d0f81'],
};
const RAMP_DARK = {
  2: ['#75589d', '#d6bbff'], 3: ['#75589d', '#a488ce', '#d6bbff'], 4: ['#694d91', '#8e72b7', '#b599df', '#ddc2ff'],
  5: ['#694d91', '#8669ae', '#a387cd', '#c1a5ec', '#e0c5ff'], 6: ['#674a8e', '#7d61a5', '#957abd', '#ad93d5', '#c6aced', '#dfc7ff'],
  7: ['#64478b', '#775c9f', '#8c71b4', '#a186c9', '#b69cde', '#ccb3f4', '#e2caff'],
};
function isDark(t) { const c = (t.panel || '').trim(); if (!c.startsWith('#')) return false; const [r, g, b] = hexToRgb(c); return 0.2126 * r + 0.7152 * g + 0.0722 * b < 110; }
export function ordinalColors(n, t = tokens()) {
  const m = Math.max(2, Math.min(7, n));
  const ramp = (isDark(t) ? RAMP_DARK : RAMP_LIGHT)[m];
  return n === 1 ? [ramp[m - 1]] : ramp.slice(0, n);
}
// a cut of names: the bookmakers in their own colours, everything else in the board's series order, "Other" in grey
export function nominalColors(keys, t = tokens()) {
  const order = [t.s1, t.s2, t.s3, t.s4, t.s5];
  let i = 0;
  return keys.map((k) => (k === 'Other' ? t.muted : t.book[k] || order[i++ % order.length]));
}

const tipBox = (t, head, body, foot) => `<div style="color:${t.muted}">${head}</div>${body}${foot ? `<div style="font-size:11px;color:${t.muted}">${foot}</div>` : ''}`;

// a return beside what was promised: the bar what came back, the whisker one luck band, the diamond the overlay shown, the
// ring the careful overlay the stakes were sized on. rows: [{label, value, luck, promised, careful, n, verdict, key}]
export function promiseBars(el, rows, { onClick } = {}) {
  const t = tokens();
  el.style.height = Math.max(150, rows.length * 40 + 56) + 'px';
  const vals = rows.flatMap((r) => [r.value - (r.luck || 0), r.value + Math.min(r.luck || 0, 1), r.promised, r.careful]).filter(Number.isFinite);
  const lo = Math.max(-1.05, Math.min(-0.2, ...vals)), hi = Math.min(1.6, Math.max(0.4, ...vals));
  const tip = (r) => tipBox(t, r.label, `<b>${pctFmt(r.value)}</b> came back on ${r.n} settled`,
    `the overlay shown promised ${Number.isFinite(r.promised) ? pctFmt(r.promised) : '–'}${Number.isFinite(r.careful) ? ` · the careful chance ${pctFmt(r.careful)}` : ''}<br>luck alone ±${Math.round((r.luck || 0) * 100)}% · ${r.verdict}`);
  return mount(el, {
    ...base(t),
    legend: { top: 0, left: 0, itemWidth: 12, itemHeight: 8, textStyle: { color: t.ink2, fontSize: 11 }, data: ['Came back', 'Overlay shown', 'Careful'] },
    grid: { left: 6, right: 40, top: 30, bottom: 6, containLabel: true },
    xAxis: { type: 'value', min: Math.floor(lo * 10) / 10, max: Math.ceil(hi * 10) / 10, splitNumber: 4, ...axis(t), axisLine: { show: false }, axisLabel: { color: t.muted, fontSize: 11, hideOverlap: true, formatter: pctFmt } },
    yAxis: { type: 'category', data: rows.map((r) => r.label), inverse: true, ...axis(t, { splitLine: { show: false } }), axisLabel: { color: t.ink2, fontSize: 11, width: 110, overflow: 'truncate', interval: 0 } },
    tooltip: { ...base(t).tooltip, trigger: 'item', formatter: (p) => (p.data && p.data.r ? tip(p.data.r) : '') },
    series: [
      { name: 'Came back', type: 'bar', barMaxWidth: 16, itemStyle: { color: t.good }, data: rows.map((r) => ({ value: r.value, r, itemStyle: { color: r.value >= 0 ? t.good : t.bad, opacity: r.verdict === 'too early' || r.verdict === 'too few' ? 0.5 : 1, borderRadius: r.value >= 0 ? [0, 4, 4, 0] : [4, 0, 0, 4] } })),
        markLine: { silent: true, symbol: 'none', lineStyle: { color: t.axis, width: 1, type: 'solid' }, label: { show: false }, data: [{ xAxis: 0 }] } },
      { type: 'custom', silent: true, z: 5, clip: true, encode: { x: [1, 2], y: 0 }, data: rows.map((r, i) => [i, r.value - (r.luck || 0), r.value + (r.luck || 0)]),
        renderItem: (params, api) => {
          const y = api.value(0), a = api.coord([api.value(1), y]), b = api.coord([api.value(2), y]);
          const s = { stroke: t.ink2, lineWidth: 1.2 };
          return { type: 'group', children: [{ type: 'line', shape: { x1: a[0], y1: a[1], x2: b[0], y2: b[1] }, style: s },
            { type: 'line', shape: { x1: a[0], y1: a[1] - 5, x2: a[0], y2: a[1] + 5 }, style: s }, { type: 'line', shape: { x1: b[0], y1: b[1] - 5, x2: b[0], y2: b[1] + 5 }, style: s }] };
        } },
      { name: 'Overlay shown', type: 'scatter', symbol: 'diamond', symbolSize: 13, z: 6, data: rows.map((r, i) => (Number.isFinite(r.promised) ? { value: [r.promised, i], r } : null)).filter(Boolean),
        itemStyle: { color: t.ink, borderColor: t.panel, borderWidth: 2 } },
      { name: 'Careful', type: 'scatter', symbol: 'circle', symbolSize: 10, z: 6, data: rows.map((r, i) => (Number.isFinite(r.careful) ? { value: [r.careful, i], r } : null)).filter(Boolean),
        itemStyle: { color: t.panel, borderColor: t.ink2, borderWidth: 2 } },
    ],
  }, { onClick: onClick ? (p) => p.data && p.data.r && onClick(p.data.r) : null });
}

// each group as a point against the funnel luck alone fills (two bands either side of break-even): across, settled bets;
// up, the return at level stakes. fu: trends.funnel(); colors: {key: colour}
export function funnelChart(el, fu, { colors = {}, onClick } = {}) {
  const t = tokens();
  el.style.height = '260px';
  const minN = Math.max(4, Math.min(...fu.pts.map((p) => p.n)));
  const wide = 2 * Math.sqrt(fu.m / minN) * 1.05;                      // the funnel where the smallest group sits
  const top = Math.min(1.5, Math.max(0.4, wide, ...fu.pts.map((p) => p.level + 0.1))), bottom = Math.max(-1.05, Math.min(-0.4, -wide, ...fu.pts.map((p) => p.level - 0.1)));
  const short = (s) => (s.length > 14 ? s.slice(0, 13) + '…' : s);
  const side = new Map([...fu.pts].sort((a, b) => a.n - b.n).map((p, i) => [p.key, i % 2 ? 'bottom' : 'top']));
  return mount(el, {
    ...base(t),
    grid: { left: 6, right: 16, top: 12, bottom: 24, containLabel: true },
    xAxis: { type: 'value', name: 'settled bets', nameLocation: 'middle', nameGap: 24, nameTextStyle: { color: t.muted, fontSize: 11 }, min: 0, ...axis(t), axisLabel: { color: t.muted, fontSize: 11 } },
    yAxis: { type: 'value', min: Math.floor(bottom * 5) / 5, max: Math.ceil(top * 5) / 5, interval: 0.2 * Math.max(1, Math.round((top - bottom) / 1.2)), ...axis(t), axisLine: { show: false }, axisLabel: { color: t.muted, fontSize: 11, hideOverlap: true, formatter: pctFmt } },
    tooltip: { ...base(t).tooltip, trigger: 'item', formatter: (p) => { const q = p.data && p.data.p; return q ? tipBox(t, q.key, `<b>${pctFmt(q.level)}</b> at level stakes on ${q.n} settled`, `luck alone reaches ±${Math.round(2 * Math.sqrt(fu.m / q.n) * 100)}% at this size (two bands)`) : ''; } },
    series: [
      { type: 'line', silent: true, showSymbol: false, data: fu.edge.filter(([, e]) => e <= top * 1.02).map(([n, e]) => [n, e]), lineStyle: { color: t.muted, width: 1, type: 'dashed' } },
      { type: 'line', silent: true, showSymbol: false, data: fu.edge.filter(([, e]) => -e >= bottom * 1.02).map(([n, e]) => [n, -e]), lineStyle: { color: t.muted, width: 1, type: 'dashed' },
        markLine: { silent: true, symbol: 'none', lineStyle: { color: t.axis, width: 1, type: 'solid' }, label: { show: false }, data: [{ yAxis: 0 }] } },
      { type: 'scatter', symbolSize: 12, z: 5, data: fu.pts.map((p) => ({ value: [p.n, p.level], p, itemStyle: { color: colors[p.key] || t.s1, borderColor: t.panel, borderWidth: 2 },
          label: { position: side.get(p.key) } })),     // labels above and below in turn by size, so two groups of a like size do not cover each other
        label: { show: fu.pts.length <= 8, color: t.ink2, fontSize: 10, distance: 6, formatter: (p) => short(p.data.p.key) } },
    ],
  }, { onClick: onClick ? (p) => p.data && p.data.p && onClick(p.data.p) : null });
}

// luck taken out: each row's own return (the hollow ring) pulled toward the whole (the dashed line) by its size (the filled
// dot is what is left). rows: [{label, raw, shrunk, n, k, mu}]
export function dumbbell(el, rows, { mu = 0, onClick } = {}) {
  const t = tokens();
  el.style.height = Math.max(140, rows.length * 32 + 40) + 'px';
  const vals = rows.flatMap((r) => [r.raw, r.shrunk]).concat([mu]).filter(Number.isFinite);
  const lo = Math.max(-1.05, Math.min(...vals) - 0.05), hi = Math.min(1.6, Math.max(...vals) + 0.05);
  return mount(el, {
    ...base(t),
    grid: { left: 6, right: 30, top: 10, bottom: 6, containLabel: true },
    xAxis: { type: 'value', min: Math.floor(lo * 10) / 10, max: Math.ceil(hi * 10) / 10, splitNumber: 4, ...axis(t), axisLine: { show: false }, axisLabel: { color: t.muted, fontSize: 11, hideOverlap: true, formatter: pctFmt } },
    yAxis: { type: 'category', data: rows.map((r) => r.label), inverse: true, ...axis(t, { splitLine: { show: false } }), axisLabel: { color: t.ink2, fontSize: 11, width: 120, overflow: 'truncate', interval: 0 } },
    tooltip: { ...base(t).tooltip, trigger: 'item', formatter: (p) => { const r = p.data && p.data.r; return r ? tipBox(t, r.label, `its own return <b>${pctFmt(r.raw)}</b> on ${r.n} settled<br>luck taken out <b>${pctFmt(r.shrunk)}</b>`, `${Math.round(r.k * 100)}% of its own result kept; the rest is what luck alone could do at its size`) : ''; } },
    series: [
      { type: 'custom', silent: true, data: rows.map((r, i) => [i, r.raw, r.shrunk]),
        renderItem: (params, api) => { const a = api.coord([api.value(1), api.value(0)]), b = api.coord([api.value(2), api.value(0)]); return { type: 'line', shape: { x1: a[0], y1: a[1], x2: b[0], y2: b[1] }, style: { stroke: t.axis, lineWidth: 2 } }; } },
      { type: 'scatter', symbol: 'circle', symbolSize: 10, z: 4, data: rows.map((r) => ({ value: [r.raw, r.label], r })), itemStyle: { color: t.panel, borderColor: t.muted, borderWidth: 1.5 } },
      { type: 'scatter', symbol: 'circle', symbolSize: 11, z: 5, data: rows.map((r) => ({ value: [r.shrunk, r.label], r, itemStyle: { color: r.shrunk >= (r.mu ?? mu) ? t.good : t.bad, borderColor: t.panel, borderWidth: 2 } })),
        markLine: { silent: true, symbol: 'none', lineStyle: { color: t.ink2, width: 1, type: 'dashed' }, label: { show: false }, data: [{ xAxis: mu }] } },
    ],
  }, { onClick: onClick ? (p) => p.data && p.data.r && onClick(p.data.r) : null });
}

// likely paths for the bank: nine in ten and the middle half shaded, the middle path a line. q: [{day, p5, p25, p50, p75, p95}]
export function fanChart(el, q, { fmt = gbp, fall = null } = {}) {
  const t = tokens();
  el.style.height = '240px';
  // stacked on the lower edge whatever its sign ('all': the default stacks losses and gains apart, which would tear a band
  // that crosses zero)
  const band = (lo, hi, op) => [{ type: 'line', data: q.map((x) => x[lo]), stack: lo + hi, stackStrategy: 'all', lineStyle: { opacity: 0 }, showSymbol: false, silent: true },
    { type: 'line', data: q.map((x) => x[hi] - x[lo]), stack: lo + hi, stackStrategy: 'all', lineStyle: { opacity: 0 }, showSymbol: false, silent: true, areaStyle: { color: t.s1, opacity: op } }];
  const marks = [{ yAxis: 0 }];
  if (fall !== null) marks.push({ yAxis: fall, lineStyle: { color: t.bad, type: 'dashed' }, label: { show: true, position: 'insideStartTop', color: t.muted, fontSize: 10, formatter: `a fall of ${fmt(fall)}` } });
  return mount(el, {
    ...base(t),
    grid: { left: 6, right: 58, top: 14, bottom: 22, containLabel: true },
    xAxis: { type: 'category', data: q.map((x) => x.day), boundaryGap: false, name: 'days from now', nameLocation: 'middle', nameGap: 22, nameTextStyle: { color: t.muted, fontSize: 11 }, ...axis(t, { splitLine: { show: false } }), axisLabel: { color: t.muted, fontSize: 11, interval: Math.max(0, Math.round(q.length / 6) - 1) } },
    yAxis: { type: 'value', ...axis(t), axisLine: { show: false }, axisLabel: { color: t.muted, fontSize: 11, formatter: (v) => fmt(v) } },
    tooltip: { ...base(t).tooltip, trigger: 'axis', formatter: (ps) => { const x = q[ps[0].dataIndex]; return tipBox(t, `Day ${x.day}`, `the middle path <b>${fmt(x.p50)}</b>`, `half the paths ${fmt(x.p25)} to ${fmt(x.p75)}<br>nine in ten ${fmt(x.p5)} to ${fmt(x.p95)}`); } },
    series: [...band('p5', 'p95', 0.12), ...band('p25', 'p75', 0.22),
      { type: 'line', data: q.map((x) => x.p50), showSymbol: false, lineStyle: { width: 2, color: t.s1 }, endLabel: { show: true, formatter: (p) => fmt(p.value), color: t.ink, fontSize: 11 },
        markLine: { silent: true, symbol: 'none', lineStyle: { color: t.axis, width: 1, type: 'solid' }, label: { show: false }, data: marks } }],
  });
}
