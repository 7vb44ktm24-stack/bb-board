// Trends: how each overlay band, or any other cut, has moved over time (the user's ask of 18 Oct 2026: "more evolution
// graphs around roi bands performance"). The return so far a match day at a time, day or week cells, what the overlay
// promised against what came back, whether the market followed the pick, which groups stand clear of luck, the 20% bar's
// two sides, and the hot and cold list with luck taken out. Range and filters apply to every card.

import { esc, money, pct, spct, isNum, dayLabel, fromGreek } from '../util.js';
import { section, chips, select, goAttr, verdictPill, signClass, betLine } from '../ui.js';
import { agg, cross, group, valueOf } from '../metrics.js';
import { SETS, SPORTS, NEVER_SUMMED } from '../state.js';
import { compName } from '../data.js';
import * as C from '../charts.js';
import * as T from '../trends.js';

export const SPLITS = [
  { id: 'eband', label: 'Overlay band' }, { id: 'eband2', label: 'Overlay, finer' }, { id: 'pband', label: 'Price' },
  { id: 'conf', label: 'Confidence' }, { id: 'statSide', label: 'Stat and direction' }, { id: 'stat', label: 'Stat' },
  { id: 'book', label: 'Bookmaker' }, { id: 'comp', label: 'League' }, { id: 'side', label: 'Over or under' },
  { id: 'kind', label: 'Kind of bet' }, { id: 'lead', label: 'Shown before kick-off' },
];
const MEASURES = [
  { id: 'ret', label: 'Return' }, { id: 'profit', label: 'Profit' }, { id: 'roll', label: 'Last 20' }, { id: 'level', label: 'Level' },
];
const MIN_N = 8, WINDOW = 20;
const BAR_DAY = '2026-10-17';                                       // only 20%+ sent from this day (the kept-back record starts)

const nameOf = (dim, k) => (dim === 'comp' ? compName(k) : k);
const ALL = 'All';               // the totals' row and column (the user's ask of 19 Oct 2026)
const at = (day) => fromGreek(`${day} 00:00`).getTime();     // a match day's point at its start, where the axis puts its date

function colorsFor(dim, keys) {
  const list = T.ORDINAL.has(dim) ? C.ordinalColors(keys.filter((k) => k !== 'Other').length).concat(keys.includes('Other') ? [C.tokens().muted] : []) : C.nominalColors(keys);
  return Object.fromEntries(keys.map((k, i) => [k, list[i]]));
}

// the sentence over the lines: who leads, who moved most since the start, with their luck bands
function reading(dim, series, measure) {
  const live = series.filter((s) => !s.other && s.now.n >= MIN_N && isNum(s.now.ret));
  if (live.length < 2) return '';
  const lead = [...live].sort((a, b) => b.now.ret - a.now.ret)[0], last = [...live].sort((a, b) => a.now.ret - b.now.ret)[0];
  const moves = live.map((s) => ({ s, m: T.moveOf(s.pts) })).filter((x) => x.m && x.m.first.day !== x.m.last.day);
  const big = moves.sort((a, b) => Math.abs(b.m.change) - Math.abs(a.m.change))[0];
  const pick = (s) => `<b>${esc(nameOf(dim, s.key))}</b> ${spct(s.now.ret)} on ${s.now.n} (luck ±${pct(s.now.luck)}) ${verdictPill(s.now.verdict, s.now.more)}`;
  let out = `Highest now: ${pick(lead)}; lowest: ${pick(last)}.`;
  if (big && measure !== 'profit') {
    const m = big.m;
    out += ` Biggest move: ${esc(nameOf(dim, big.s.key))}, from ${spct(m.first.value)} on ${dayLabel(m.first.day, false)} to ${spct(m.last.value)}${m.hi.day !== m.last.day && m.hi.day !== m.first.day ? ` (high ${spct(m.hi.value)} on ${dayLabel(m.hi.day, false)})` : ''}.`;
  }
  return `<p class="reading">${out} A line inside its luck band has not shown anything yet.</p>`;
}

export function render(ctx) {
  const { D, S } = ctx;
  const rows = ctx.scope();
  const dim = T.ORDINAL.has(S.trendBy) || SPLITS.some((s) => s.id === S.trendBy) ? S.trendBy : 'eband';
  const measure = MEASURES.some((m) => m.id === S.trendMeasure) ? S.trendMeasure : 'ret';
  const period = S.trendPeriod === 'week' ? 'week' : 'day';
  const setDef = (SETS[S.sport] || []).find((x) => x.id === S.set) || {};
  const sr = T.seriesBy(rows, dim, { measure, minN: MIN_N, window: WINDOW });
  const keys = sr.series.map((s) => s.key);
  const colors = colorsFor(dim, keys);
  const split = SPLITS.find((s) => s.id === dim) || SPLITS[0];
  const g = agg(rows);

  const controls = `<div class="controls">
    ${chips('sport', SPORTS, S.sport, { small: true })}
    ${chips('set', (SETS[S.sport] || []).map((x) => ({ id: x.id, label: x.label })), S.set, { small: true })}
  </div>
  <div class="controls controls-grid">${select('trendBy', SPLITS, dim, 'Split by')}</div>
  <p class="set-note muted small">${esc(setDef.note || '')}${NEVER_SUMMED.has(S.set) ? ' <b>Never added up:</b> one selection counts as often as it was shown.' : ''} ${g.n} settled in this view over ${sr.days.length} match day${sr.days.length === 1 ? '' : 's'}.</p>`;

  if (sr.days.length < 2 || !sr.series.length) {
    return { html: controls + `<p class="empty">Not enough settled days in this view for a trend yet (${sr.days.length}). Widen the range or take a filter off.</p>` };
  }

  const msub = measure === 'profit' ? 'The profit so far at the end of each match day (Greek dates).'
    : measure === 'roll' ? `The return of each group's last ${WINDOW} settled bets at the end of each match day: a line starts once it has ${WINDOW}.`
      : measure === 'level' ? `The return as if every bet were the same stake, so far, at the end of each match day: a line starts after its ${MIN_N}th settled bet.`
        : `The return as staked so far (ROI), at the end of each match day: a line starts after its ${MIN_N}th settled bet.`;
  const nowRows = sr.series.map((s) => `<button type="button" class="trow"${s.other ? ' disabled' : ` ${goAttr({ tab: 'results', f: { [dim]: [s.key] } })}`}>
      <span class="trow-key"><i style="background:${colors[s.key]}"></i>${esc(nameOf(dim, s.key))}</span>
      <span class="trow-num ${signClass(s.now.ret)}">${s.now.n ? spct(s.now.ret) : '–'}</span>
      <span class="trow-sub muted">${s.now.n} settled · ±${pct(s.now.luck)} · ${money(s.now.profit)}</span>
      ${verdictPill(s.now.verdict, s.now.more)}
    </button>`).join('');
  const lines = section(`How each ${split.label.toLowerCase()} has moved`, `${chips('trendMeasure', MEASURES, measure, { small: true })}
    ${reading(dim, sr.series, measure)}<div class="chart chart-lg" id="ch-tr-lines"></div>
    <div class="trows">${nowRows}</div>`, { sub: msub });

  const cells = section(period === 'week' ? 'Week by week' : 'Day by day', `${chips('trendPeriod', [{ id: 'day', label: 'Days' }, { id: 'week', label: 'Weeks' }], period, { small: true })}
    <div class="chart" id="ch-tr-cells"></div><p class="muted small">Each square: the return as staked that ${period} (newest at the top, the last 14), the settled bets under it. Pale: under 3 settled. Tap a square for its bets.</p>`);

  // what the overlay promised against what came back
  const groups = T.lineGroups(rows, dim);
  const prom = groups.map((x) => ({ key: x.key, other: x.other, ...T.promise(x.rows) }));
  const all = T.promise(rows);
  const pp = T.promisePoints(rows, sr.days);
  const lastP = pp[pp.length - 1];
  const promReading = isNum(all.promisedProfit) && all.n ? `<p class="reading">Over this view the overlay shown promised <b>${money(lastP.shown)}</b> and <b class="${signClass(lastP.actual)}">${money(lastP.actual)}</b> came back${lastP.shown > 0 ? ` (${pct(lastP.actual / lastP.shown)} of it)` : ''}${isNum(lastP.careful) ? `; the careful chances the stakes are sized on promised ${money(lastP.careful)}` : ''}. A band that keeps landing short of its promise has chances that are too high.</p>` : '';
  const promise = section('Did the overlay show up?', `${promReading}<div class="chart" id="ch-tr-promise"></div><div class="chart chart-lg" id="ch-tr-promrun"></div>`,
    { sub: 'Each group: the return that came back (bar, with its luck band), against what the overlay shown promised (◆) and the careful chance the stakes were sized on (○, where the record has it). Below: the profit against the promise, a match day at a time.' });

  // the market's answer
  const fol = T.follow(rows);
  const folRows = groups.map((x) => ({ key: x.key, ...T.follow(x.rows) })).filter((x) => x.n);
  const market = fol.n ? section('Did the market follow us?', `<p class="reading">Of ${fol.n} picks whose price was read again before kick-off, <b>${fol.beat}</b> (${pct(fol.share)}) shortened by 3% or more after we showed them${fol.drift ? `, ${fol.drift} drifted` : ''}; on average the price moved ${spct(fol.avg, 1)} our way.
      ${fol.whenBeat.n && fol.otherwise.n ? ` When the market came our way they returned <b class="${signClass(fol.whenBeat.ret)}">${spct(fol.whenBeat.ret)}</b> on ${fol.whenBeat.n}; otherwise <b class="${signClass(fol.otherwise.ret)}">${spct(fol.otherwise.ret)}</b> on ${fol.otherwise.n}.` : ''}
      A price that shortens after the pick is the earliest sign the edge is real, long before the profit is clear of luck.</p>
    <div class="chart" id="ch-tr-follow"></div>`, { sub: `Each group: the share of its picks read again later whose price shortened by 3% or more. Bets with no later reading are left out.` }) : '';

  // the 20% bar: what was sent against what was kept back since it started
  let bar = '', barData = null, hcData = null;
  if (S.sport === 'football') {
    const base = ctx.scope({ set: null }).filter((r) => r.day >= BAR_DAY);
    const sent = base.filter((r) => r.set === 'paper' && isNum(r.edge) && r.edge >= 0.2), kept = base.filter((r) => r.set === 'kept');
    const a = agg(sent), b = agg(kept);
    if (a.n + b.n >= 4) {
      bar = section('The 20% bar: sent against kept back', `<div class="tiles tiles-2">
        <div class="tile"><div class="tile-label">Sent (20% and over)</div><div class="tile-value ${signClass(a.ret)}">${a.n ? spct(a.ret) : '–'}</div><div class="tile-sub">${a.won} of ${a.n} won · ${money(a.profit)} · ±${pct(a.luck)} ${verdictPill(a.verdict, a.more)}</div></div>
        <div class="tile"><div class="tile-label">Kept back (10% to 20%)</div><div class="tile-value ${signClass(b.ret)}">${b.n ? spct(b.ret) : '–'}</div><div class="tile-sub">${b.won} of ${b.n} won · ${money(b.profit)} · ±${pct(b.luck)} ${verdictPill(b.verdict, b.more)}</div></div>
      </div><div class="chart" id="ch-tr-bar"></div>`, { sub: `Since ${dayLabel(BAR_DAY, false)}, when only picks 20% or more above their price began to be sent; the 10% to 20% ones kept on paper. Same range and filters.` });
      barData = { sent, kept };
    }
  }

  // luck
  const fu = T.funnel(rows, dim);
  const luck = fu.pts.length >= 2 ? section('Which groups stand clear of luck', `<div class="chart" id="ch-tr-funnel"></div>`,
    { sub: 'Each group at level stakes against the funnel luck alone fills (two bands either side of break-even at this view’s average price). Inside the dashed lines is still luck; outside, a result.' }) : '';

  // hot and cold, luck taken out (records only: a set that repeats a selection would look surer than it is)
  let hc = '';
  if (!NEVER_SUMMED.has(S.set)) {
    const h = T.hotCold(rows, ['statSide', 'comp', 'book'], { n: 5, min: 5 });
    const DIM_WORD = { statSide: '', comp: '', book: 'at ' };
    const label = (x) => `${DIM_WORD[x.dim] || ''}${nameOf(x.dim, x.key)}`;
    const list = [...h.hot, ...h.cold];
    hcData = { h, list: list.map((x) => ({ label: label(x), raw: x.ret, shrunk: x.shrunk, n: x.n, k: x.k, mu: x.mu, dim: x.dim, key: x.key })) };
    const tau = (d) => T.shrink(rows, d, { min: 5 }).tau;
    const spread = ['statSide', 'comp', 'book'].map((d) => ({ d, tau: tau(d) }));
    const word = { statSide: 'stats', comp: 'leagues', book: 'bookmakers' };
    const apart = spread.filter((x) => x.tau > 0.02).map((x) => word[x.d]), together = spread.filter((x) => x.tau <= 0.02).map((x) => word[x.d]);
    hc = section('Hot and cold, luck taken out', `<p class="reading">${apart.length ? `Only the ${apart.join(' and ')} differ from each other by more than luck would make them${together.length ? `; the ${together.join(' and ')} are all pulled back to the whole (${spct(h.mu)}): none stands apart yet` : ''}.` : `No stat, league or bookmaker differs from the rest by more than luck would make them yet: each is pulled back to the whole (${spct(h.mu)}).`}</p>
      ${list.length ? '<div class="chart" id="ch-tr-hc"></div>' : ''}
      <p class="muted small">The ring is a group's own return; the dot what is left once luck at its size is taken out (the dashed line is the whole view). Bets on one match move together, so a league with many picks in a few matches can still look surer than it is.</p>`,
    { sub: 'Stats with their direction, leagues and bookmakers, each pulled toward the whole by how much luck its size allows (empirical Bayes).' });
  }

  const html = controls + lines + cells + promise + market + bar + luck + hc;

  const mount = () => {
    const t = C.tokens();
    const fmt = measure === 'profit' ? C.FMT.gbp : C.FMT.pct;
    const el = document.getElementById('ch-tr-lines');
    if (el) {
      el.style.height = '270px';
      const series = sr.series.map((s) => ({ name: nameOf(dim, s.key), color: colors[s.key],
        pts: s.pts.filter((p) => isNum(p.value)).map((p) => [at(p.day), Math.round(p.value * (measure === 'profit' ? 100 : 1e4)) / (measure === 'profit' ? 100 : 1e4), `${p.n} settled · luck ±${pct(p.luck)}`]) })).filter((s) => s.pts.length);
      const byName = Object.fromEntries(sr.series.map((s) => [nameOf(dim, s.key), s]));
      C.runningChart(el, series, { fmt, area: false, daily: true, onClick: (p) => { const s = byName[p.seriesName]; if (s && !s.other) ctx.go({ tab: 'results', f: { [dim]: [s.key] } }); } });
    }
    const ce = document.getElementById('ch-tr-cells');
    if (ce) {
      const base = T.cutRows(rows, dim).filter((r) => r.settled);
      const x = cross(base, dim, period);
      const groupsK = keys.filter((k) => k !== 'Other' && x.rowsKeys.map(String).includes(k));
      const periods = x.colsKeys.map(String).filter((k) => k !== '(not known)').sort().reverse().slice(0, 14);
      const label = (k) => (period === 'week' ? 'w/c ' + dayLabel(k, false) : dayLabel(k));
      const cellsData = x.cells.filter((c) => groupsK.includes(String(c.a)) && periods.includes(String(c.b)))
        .map((c) => ({ x: nameOf(dim, String(c.a)), y: label(String(c.b)), value: c.ret, n: c.n, ret: c.ret, luck: c.luck, verdict: c.verdict, rows: c.rows, rawX: String(c.b), rawY: String(c.a) }));
      // the totals (the user's ask of 19 Oct 2026): each period's whole in a last column, each cut's over the periods shown in a last row
      const shown = base.filter((r) => groupsK.includes(String(valueOf(r, dim))) && periods.includes(String(valueOf(r, period))));
      const tot = (g, more) => ({ value: g.ret, n: g.n, ret: g.ret, luck: g.luck, verdict: g.verdict, rows: g.rows, ...more });
      cellsData.push(...group(shown, period).map((p) => tot(p, { x: ALL, y: label(String(p.key)), rawX: String(p.key), rawY: null, total: 'row' })),
        ...group(shown, dim).map((k) => tot(k, { x: nameOf(dim, String(k.key)), y: ALL, rawX: null, rawY: String(k.key), total: 'col' })),
        tot({ ...agg(shown), rows: shown }, { x: ALL, y: ALL, rawX: null, rawY: null, total: 'all' }));
      C.heatmap(ce, [...groupsK.map((k) => nameOf(dim, k)), ALL], [...periods.map(label), ALL], cellsData, { fmt: C.FMT.pct, metric: 'ret', min: 3, onClick: (c) => openCell(ctx, dim, period, c) });
    }
    const pe = document.getElementById('ch-tr-promise');
    if (pe) C.promiseBars(pe, prom.filter((p) => p.n).map((p) => ({ label: nameOf(dim, p.key), key: p.key, value: p.ret, luck: p.luck, promised: p.promised, careful: p.carefulShare >= 0.5 ? p.careful : null, n: p.n, verdict: p.verdict, other: p.other })),
      { onClick: (r) => { if (!r.other) ctx.go({ tab: 'results', f: { [dim]: [r.key] } }); } });
    const pr = document.getElementById('ch-tr-promrun');
    if (pr) {
      pr.style.height = '220px';
      const series = [{ name: 'Came back', color: t.s1, pts: pp.map((p) => [at(p.day), Math.round(p.actual)]) },
        { name: 'Overlay shown promised', color: t.s2, pts: pp.map((p) => [at(p.day), Math.round(p.shown)]) }];
      if (pp.some((p) => isNum(p.careful))) series.push({ name: 'Careful promised', color: t.s3, pts: pp.map((p) => [at(p.day), Math.round(p.careful)]) });
      C.runningChart(pr, series, { fmt: C.FMT.gbp, area: false, daily: true });
    }
    const fe = document.getElementById('ch-tr-follow');
    if (fe) C.bars(fe, folRows.map((x) => ({ label: nameOf(dim, x.key), value: x.share, color: colors[x.key], sub: `${x.beat} of ${x.n} shortened · average move ${spct(x.avg, 1)} · returned ${spct(x.whenBeat.ret)} when it did` })), { fmt: C.FMT.pct, signed: false });
    const be = document.getElementById('ch-tr-bar');
    if (be && barData) {
      be.style.height = '220px';
      const days = T.daysOf([...barData.sent, ...barData.kept]);
      const line = (list, name, color) => ({ name, color, pts: T.dailyPoints(list, days, { measure: 'ret', minN: 3 }).filter((p) => isNum(p.value)).map((p) => [at(p.day), Math.round(p.value * 1e4) / 1e4, `${p.n} settled · luck ±${pct(p.luck)}`]) });
      C.runningChart(be, [line(barData.sent, 'Sent, 20% and over', t.s1), line(barData.kept, 'Kept back, 10% to 20%', t.s2)].filter((s) => s.pts.length), { fmt: C.FMT.pct, area: false, daily: true });
    }
    const fn = document.getElementById('ch-tr-funnel');
    if (fn) C.funnelChart(fn, fu, { colors, onClick: (p) => { if (p.key !== 'Other') ctx.go({ tab: 'results', f: { [dim]: [p.key] } }); } });
    const he = document.getElementById('ch-tr-hc');
    if (he && hcData) C.dumbbell(he, hcData.list, { mu: hcData.h.mu, onClick: (r) => ctx.go({ tab: 'slices', f: { [r.dim]: [r.key] }, rows: r.dim === 'book' ? 'stat' : 'book', cols: 'side' }) });
  };
  return { html, mount };
}

function openCell(ctx, dim, period, c) {
  const list = (c.rows || []).slice().sort((x, y) => (y.kickAt || 0) - (x.kickAt || 0));
  const g = agg(list);
  const when = c.rawX == null ? `the ${period === 'week' ? 'weeks' : 'days'} shown` : period === 'week' ? `week of ${dayLabel(c.rawX, false)}` : dayLabel(c.rawX);
  const go = { tab: 'results', ...(c.rawX == null ? {} : { range: 'custom', from: c.rawX, to: period === 'week' ? addWeek(c.rawX) : c.rawX }),
    ...(c.rawY == null ? {} : { f: { [dim]: [c.rawY] } }) };                       // a total: one of the two, or neither
  const open = c.rawX == null && c.rawY == null ? '' : `<div class="sheet-actions"><button type="button" class="btn" ${goAttr(go)}>Open in Results</button></div>`;
  ctx.sheet(`${c.rawY == null ? ALL : nameOf(dim, c.rawY)} · ${when}`, `<p class="record-line">${g.n ? `<b class="${signClass(g.profit)}">${money(g.profit)}</b> on ${money(g.staked, '£', 0, false)} (${spct(g.ret)}, luck ±${pct(g.luck)}) ${verdictPill(g.verdict, g.more)} · ${g.won} of ${g.n} won` : 'Nothing settled.'}</p>
    ${open}
    <div class="lines">${list.map((r) => betLine(r)).join('')}</div>`);
}
function addWeek(day) { const d = new Date(`${day}T00:00:00Z`); d.setUTCDate(d.getUTCDate() + 6); return d.toISOString().slice(0, 10); }
