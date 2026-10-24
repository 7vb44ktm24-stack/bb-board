// Slices: any cut against any other. A heatmap of the two (tap a square for its bets), the rows ranked with their luck
// bands, and the table behind them. Presets for the questions asked most.

import { esc, money, pct, spct, isNum } from '../util.js';
import { section, table, cutCols, goAttr, select, chips, betLine, verdictPill, signClass } from '../ui.js';
import { group, cross, metricOf, agg } from '../metrics.js';
import { DIMS, DIM, METRICS } from '../state.js';
import { compName } from '../data.js';
import * as C from '../charts.js';

const PRESETS = [
  { label: 'Stat × direction', rows: 'stat', cols: 'side' },
  { label: 'Stat × bookmaker', rows: 'stat', cols: 'book' },
  { label: 'Bookmaker × league', rows: 'book', cols: 'comp' },
  { label: 'League × stat', rows: 'comp', cols: 'stat' },
  { label: 'Overlay × price', rows: 'eband', cols: 'pband' },
  { label: 'Confidence × stat', rows: 'conf', cols: 'stat' },
  { label: 'Shown before kick-off', rows: 'lead', cols: 'book' },
  { label: 'Kick-off time × day', rows: 'hour', cols: 'dow' },
  { label: 'Where it landed', rows: 'margin', cols: 'landed' },
];

const ALL = 'All';               // the totals' row and column (the user's ask of 19 Oct 2026)
const fmtFor = (m) => (m === 'profit' ? C.FMT.gbp : m === 'n' ? C.FMT.n : m === 'z' ? C.FMT.x : m === 'edge' || m === 'calib' ? C.FMT.pp : C.FMT.pct);
const nameOf = (dim, k) => (dim === 'comp' ? compName(k) : k);

// cuts a bet builder has no part in (it has no one stat, side or margin): builders left out of them, and said so
const STAT_DIMS = new Set(['stat', 'side', 'statSide', 'scope', 'margin', 'landed', 'nearer']);
const isBuilder = (r) => /builder/.test(r.kind || '') || r.stat === 'bet builder';

export function render(ctx) {
  const { S, scope } = ctx;
  const rowsDim = DIM[S.rows] ? S.rows : 'stat';
  const colsDim = S.cols === 'none' || !DIM[S.cols] ? 'none' : S.cols;
  const every = scope();
  const statCut = STAT_DIMS.has(rowsDim) || STAT_DIMS.has(colsDim);
  const rows = statCut ? every.filter((r) => !isBuilder(r)) : every;
  const builders = statCut ? every.filter((r) => isBuilder(r) && r.settled).length : 0;
  const metric = METRICS.some((m) => m.id === S.metric) ? S.metric : 'ret';
  const min = S.min || 5;
  const dimOpts = DIMS.map((d) => ({ id: d.id, label: d.label }));

  const presets = `<div class="presets">${PRESETS.map((p) => `<button type="button" class="chip${p.rows === rowsDim && p.cols === colsDim ? ' on' : ''}" ${goAttr({ rows: p.rows, cols: p.cols, keep: true })}>${esc(p.label)}</button>`).join('')}</div>`;
  const controls = `<div class="controls controls-grid">
    ${select('rows', dimOpts, rowsDim, 'Rows')}
    ${select('cols', [{ id: 'none', label: 'Nothing (one cut)' }, ...dimOpts], colsDim, 'Across')}
    ${select('metric', METRICS.map((m) => ({ id: m.id, label: m.label })), metric, 'Show')}
    <div class="sel"><span>At least</span>${chips('min', [1, 5, 10, 20].map((n) => ({ id: n, label: `${n} bet${n > 1 ? 's' : ''}` })), min, { small: true })}</div>
  </div>`;

  const g = agg(rows);
  const groups = group(rows, rowsDim);
  const ranked = groups.filter((x) => x.n >= min && isNum(x.ret));
  const top = [...ranked].sort((a, b) => (b.z ?? -9) - (a.z ?? -9))[0];
  const bottom = [...ranked].sort((a, b) => (a.z ?? 9) - (b.z ?? 9))[0];
  const reading = ranked.length >= 2 ? `<p class="reading">Highest in luck bands: <button class="link" ${goAttr({ f: { [rowsDim]: [top.key] }, keep: true })}>${esc(nameOf(rowsDim, top.key))}</button> ${spct(top.ret)} on ${top.n} ${verdictPill(top.verdict, top.more)};
    lowest: <button class="link" ${goAttr({ f: { [rowsDim]: [bottom.key] }, keep: true })}>${esc(nameOf(rowsDim, bottom.key))}</button> ${spct(bottom.ret)} on ${bottom.n} ${verdictPill(bottom.verdict, bottom.more)}. A slice inside its luck band is not a result yet.</p>` : '';

  const heat = colsDim !== 'none' ? section(`${DIM[rowsDim].label} × ${DIM[colsDim].label}`, `<div class="chart" id="ch-heat"></div>
    <p class="muted small">Each square: ${esc(METRICS.find((m) => m.id === metric).label.toLowerCase())}, the number of settled bets under it. Squares with fewer than ${min} settled are left pale. Tap one for its bets.</p>`) : '';
  const bars = section(`${DIM[rowsDim].label}: return with its luck band`, `${reading}<div class="chart" id="ch-luck"></div>
    <p class="muted small">The bar is the return as staked; the whisker one band of what luck alone would do. Pale bars are still inside their band. Tap a bar to filter to it.</p>`);
  const tbl = section(`${DIM[rowsDim].label}: the numbers`, table({ id: 't-cut', cols: cutCols(DIM[rowsDim].label, { dim: rowsDim }), rows: groups, rowGo: (r) => ({ f: { [rowsDim]: [r.key] }, keep: true }), sort: ctx.sortOf('t-cut'),
    foot: groups.length > 1 ? { ...g, key: ALL } : null }));

  const html = `<p class="record-line small">${g.n} settled in this view. ${S.sport === 'football' ? '' : `<b>${esc(S.sport)}</b>. `}Filters and range apply to every slice.${builders ? ` ${builders} settled bet builder${builders > 1 ? 's' : ''} left out of this cut (no one stat or side): <button class="link" ${goAttr({ rows: 'kind', cols: 'none', keep: true })}>see Kind of bet</button>.` : ''}</p>` + presets + controls + heat + bars + tbl;
  const mount = () => {
    const el = document.getElementById('ch-heat');
    if (el) {
      const x = cross(rows, rowsDim, colsDim);
      const cell = (c, more) => ({ value: metricOf(c, metric), n: c.n, ret: c.ret, luck: c.luck, verdict: c.verdict, rows: c.rows, ...more });
      const cells = x.cells.map((c) => cell(c, { x: nameOf(colsDim, String(c.b)), y: nameOf(rowsDim, String(c.a)), rawX: c.b, rawY: c.a }));
      // the totals: each row's whole in a last column, each column's in a last row, everything in the corner
      cells.push(...x.rowTotals.map((r) => cell(r, { x: ALL, y: nameOf(rowsDim, String(r.key)), rawX: null, rawY: r.key, total: 'row' })),
        ...group(rows, colsDim).map((c) => cell(c, { x: nameOf(colsDim, String(c.key)), y: ALL, rawX: c.key, rawY: null, total: 'col' })),
        cell({ ...g, rows }, { x: ALL, y: ALL, rawX: null, rawY: null, total: 'all' }));
      C.heatmap(el, [...x.colsKeys.map((k) => nameOf(colsDim, String(k))), ALL], [...x.rowsKeys.map((k) => nameOf(rowsDim, String(k))), ALL], cells,
        { fmt: fmtFor(metric), metric, min, onClick: (c) => openCell(ctx, rowsDim, colsDim, c) });
    }
    const lb = document.getElementById('ch-luck');
    if (lb) C.luckBars(lb, ranked.map((x) => ({ label: nameOf(rowsDim, x.key), value: x.ret, luck: x.luck, n: x.n, verdict: x.verdict, key: x.key })),
      { onClick: (r) => ctx.go({ f: { [rowsDim]: [r.key] }, keep: true }) });
  };
  return { html, mount };
}

function openCell(ctx, a, b, c) {
  const list = (c.rows || []).slice().sort((x, y) => (y.kickAt || 0) - (x.kickAt || 0));
  const g = agg(list);
  const ya = c.rawY == null ? ALL : nameOf(a, c.rawY), xb = c.rawX == null ? ALL : nameOf(b, c.rawX);     // a total: one cut, or none
  const f = { ...(c.rawY == null ? {} : { [a]: [c.rawY] }), ...(c.rawX == null ? {} : { [b]: [c.rawX] }) };
  const body = `<p>${esc(DIM[a].label)} <b>${esc(ya)}</b> · ${esc(DIM[b].label)} <b>${esc(xb)}</b></p>
    <p class="record-line">${g.n ? `<b class="${signClass(g.profit)}">${money(g.profit)}</b> on ${money(g.staked, '£', 0, false)} (${spct(g.ret)}, luck ±${pct(g.luck)}) ${verdictPill(g.verdict, g.more)} · ${g.won} of ${g.n} won` : 'Nothing settled.'}${g.open ? ` · ${g.open} open` : ''}</p>
    ${Object.keys(f).length ? `<div class="sheet-actions"><button type="button" class="btn" ${goAttr({ f, keep: true })}>Filter the board to this</button></div>` : ''}
    <div class="lines">${list.map((r) => betLine(r)).join('')}</div>`;
  ctx.sheet(`${ya} · ${xb}`, body);
}
