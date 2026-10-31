// Trends: the record over time, cut by overlay band or any other cut (the user's ask of 18 Oct 2026: "more evolution graphs
// around roi bands performance"). Where each group's return stood at the end of every match day, what the overlay promised
// against what came back, whether the price moved our way after a pick was shown, which groups stand clear of luck, and the
// hot and cold list with luck taken out. Pure sums with no page: the Trends tab, the chat and the Claude connector read them,
// so all three say the same.

import { isNum, sum, mean, uniq } from './util.js';
import { agg, group } from './metrics.js';

// cuts whose keys run in an order (an overlay band, a price band): drawn in one hue, light to dark; the rest are names
export const ORDINAL = new Set(['eband', 'eband2', 'pband', 'lead', 'margin', 'hour']);
const SKIP = new Set(['(not known)', 'bet builder', 'not recorded']);
const isBuilder = (r) => /builder/.test(r.kind || '') || r.stat === 'bet builder';
// cuts a bet builder has no part in (it has no one stat or side): builders left out of them, as the Slices tab does
const STAT_DIMS = new Set(['stat', 'side', 'statSide', 'scope', 'margin', 'landed', 'nearer']);

export const settledRows = (rows) => rows.filter((r) => r.settled && isNum(r.stake) && isNum(r.price) && r.day);
const byKick = (a, b) => (a.kickAt?.getTime() || 0) - (b.kickAt?.getTime() || 0) || (a.day < b.day ? -1 : a.day > b.day ? 1 : 0);

export function cutRows(rows, dim) { return STAT_DIMS.has(dim) ? rows.filter((r) => !isBuilder(r)) : rows; }

// the match days with a settled bet, in order
export function daysOf(rows) { return uniq(settledRows(rows).map((r) => r.day)).sort(); }

// the groups a chart draws: an ordered cut whole and in its order; a cut of names its `top` largest, the rest as "Other"
export function lineGroups(rows, dim, { top = 5 } = {}) {
  const gs = group(settledRows(cutRows(rows, dim)), dim).filter((g) => !SKIP.has(String(g.key)));
  if (ORDINAL.has(dim) || gs.length <= top + 1) return gs.map((g) => ({ key: String(g.key), rows: g.rows }));
  const big = [...gs].sort((a, b) => b.n - a.n);
  return [...big.slice(0, top).map((g) => ({ key: String(g.key), rows: g.rows })),
    { key: 'Other', rows: big.slice(top).flatMap((g) => g.rows), other: true }];
}

// where a group stood at the end of each of `days`: the return so far (from its `minN`th settled bet), the profit so far,
// the return of its last `window` bets (once it has that many), or the return at level stakes; with the luck band there
export function dailyPoints(rows, days, { measure = 'ret', minN = 8, window = 20 } = {}) {
  const list = settledRows(rows).sort(byKick);
  const out = [];
  let i = 0, n = 0, staked = 0, profit = 0, varSum = 0, lvl = 0, lvlVar = 0;
  for (const d of days) {
    while (i < list.length && list[i].day <= d) {
      const r = list[i++];
      n++; staked += r.stake; profit += r.profit ?? 0; varSum += r.stake * r.stake * (r.price - 1);
      lvl += r.w * r.price - 1; lvlVar += r.price - 1;
    }
    let value = null, luck = staked ? Math.sqrt(varSum) / staked : null;
    if (measure === 'profit') value = n ? profit : null;
    else if (measure === 'level') { value = n >= minN ? lvl / n : null; luck = n ? Math.sqrt(lvlVar) / n : null; }
    else if (measure === 'roll') {
      const last = list.slice(Math.max(0, i - window), i);
      const s = sum(last, (r) => r.stake);
      value = last.length >= window && s ? sum(last, (r) => r.profit) / s : null;
      luck = s ? Math.sqrt(sum(last, (r) => r.stake * r.stake * (r.price - 1))) / s : null;
    } else value = n >= minN && staked ? profit / staked : null;
    out.push({ day: d, n, value, luck, staked, profit });
  }
  return out;
}

// every group of a cut as a line over the same days
export function seriesBy(rows, dim, opts = {}) {
  const days = daysOf(rows);
  return { days, series: lineGroups(rows, dim, opts).map((g) => ({ key: g.key, other: !!g.other, now: agg(g.rows), pts: dailyPoints(g.rows, days, opts) })) };
}

// how a line moved: where it first stood, its highest and lowest, where it stands now
export function moveOf(pts) {
  const v = pts.filter((p) => isNum(p.value));
  if (!v.length) return null;
  const hi = v.reduce((a, b) => (b.value > a.value ? b : a)), lo = v.reduce((a, b) => (b.value < a.value ? b : a));
  return { first: v[0], last: v[v.length - 1], hi, lo, change: v[v.length - 1].value - v[0].value };
}

// ------------------------------------------------------------------------------------------------ the promise

// what the overlay promised against what came back: the overlay as shown (stake x overlay) and the careful overlay the
// stakes were sized on (stake x (careful chance x price - 1)), on the bets that have one, beside the profit
export function promise(rows) {
  const d = settledRows(rows);
  const g = agg(rows);
  const staked = sum(d, (r) => r.stake);
  const shown = sum(d, (r) => (isNum(r.edge) ? r.stake * r.edge : 0));
  const withPs = d.filter((r) => isNum(r.ps));
  const carefulStaked = sum(withPs, (r) => r.stake);
  const careful = sum(withPs, (r) => r.stake * (r.ps * r.price - 1));
  return { ...g, promised: staked ? shown / staked : null, promisedProfit: shown, careful: carefulStaked ? careful / carefulStaked : null,
    carefulShare: staked ? carefulStaked / staked : 0, gap: isNum(g.ret) && staked ? g.ret - shown / staked : null };
}

// the running promise of a whole view: the profit, the profit the overlay shown promised and (where the careful chance is
// known for almost every bet) the profit the careful chances promised, at the end of each match day
export function promisePoints(rows, days = daysOf(rows)) {
  const list = settledRows(rows).sort(byKick);
  const withPs = list.filter((r) => isNum(r.ps));
  const carefulOk = sum(list, (r) => r.stake) > 0 && sum(withPs, (r) => r.stake) / sum(list, (r) => r.stake) >= 0.8;
  const out = [];
  let i = 0, actual = 0, shown = 0, careful = 0;
  for (const d of days) {
    while (i < list.length && list[i].day <= d) {
      const r = list[i++];
      actual += r.profit ?? 0;
      shown += isNum(r.edge) ? r.stake * r.edge : 0;
      careful += isNum(r.ps) ? r.stake * (r.ps * r.price - 1) : isNum(r.edge) ? r.stake * r.edge : 0;
    }
    out.push({ day: d, actual, shown, careful: carefulOk ? careful : null });
  }
  return out;
}

// ------------------------------------------------------------------------------------------------ the market's answer

const READ = (r) => r.moved && r.moved !== 'no later reading' && r.moved !== 'bet builder';
const BEAT = (r) => /we beat it/.test(r.moved || '');
// of the picks whose price was read again later: how often it shortened by 3% or more (the market came our way), how often
// it drifted, by how much on average, and the return when it came our way against the rest
export function follow(rows) {
  const read = rows.filter(READ);
  const beat = read.filter(BEAT);
  return { n: read.length, beat: beat.length, drift: read.filter((r) => /drifted/.test(r.moved)).length, share: read.length ? beat.length / read.length : null,
    avg: mean(read, (r) => r.beat), whenBeat: agg(beat), otherwise: agg(read.filter((r) => !BEAT(r))) };
}
// the same a day at a time (picks of that match day)
export function followByDay(rows, days = uniq(rows.filter(READ).map((r) => r.day)).sort()) {
  return days.map((d) => ({ day: d, ...follow(rows.filter((r) => r.day === d)) }));
}

// ------------------------------------------------------------------------------------------------ luck

// each group as a point (settled bets across, the return at level stakes up) against the funnel luck alone would fill:
// two bands either side of break-even for a bet at the view's average price
export function funnel(rows, dim, { top = 8 } = {}) {
  const pts = lineGroups(rows, dim, { top }).map((g) => { const a = agg(g.rows); return { key: g.key, n: a.n, level: a.level, levelLuck: a.levelLuck, ret: a.ret, won: a.won }; })
    .filter((p) => p.n && isNum(p.level));
  const m = mean(settledRows(rows), (r) => r.price - 1) || 1;
  const maxN = Math.max(10, ...pts.map((p) => p.n));
  const edge = [];
  for (let n = 4; n <= maxN * 1.08; n += Math.max(1, Math.round(maxN / 60))) edge.push([n, 2 * Math.sqrt(m / n)]);
  return { pts, m, edge };
}

// each group's return pulled toward the whole by its size (empirical Bayes: the spread between the groups beyond luck,
// against each group's own luck band): a 4 of 4 at long prices no longer tops the list. k is how much of a group's own
// result is kept (0: none of it stands out from luck, 1: all of it).
export function shrink(rows, dim, { min = 3 } = {}) {
  const base = cutRows(rows, dim);
  const mu = agg(base).ret ?? 0;
  const gs = group(settledRows(base), dim).filter((g) => !SKIP.has(String(g.key)) && g.n >= min && isNum(g.ret) && isNum(g.luck) && g.luck > 0);
  if (gs.length < 2) return { mu, tau: 0, groups: gs.map((g) => ({ ...pickG(g), dim, mu, shrunk: mu, k: 0 })) };
  // the spread between groups beyond luck, DerSimonian-Laird: each group weighed by its own precision, so a group of three
  // with a huge luck band neither hides nor invents a spread
  const w = gs.map((g) => 1 / g.luck ** 2), W = w.reduce((s, x) => s + x, 0);
  const yw = gs.reduce((s, g, i) => s + w[i] * g.ret, 0) / W;
  const Q = gs.reduce((s, g, i) => s + w[i] * (g.ret - yw) ** 2, 0);
  const tau2 = Math.max(0, (Q - (gs.length - 1)) / (W - w.reduce((s, x) => s + x * x, 0) / W));
  return { mu, tau: Math.sqrt(tau2), groups: gs.map((g) => { const k = tau2 / (tau2 + g.luck ** 2); return { ...pickG(g), dim, mu, shrunk: mu + k * (g.ret - mu), k }; }) };
}
function pickG(g) { return { key: String(g.key), n: g.n, won: g.won, staked: g.staked, profit: g.profit, ret: g.ret, luck: g.luck, verdict: g.verdict, level: g.level }; }

// the hottest and coldest groups across several cuts, luck taken out (the user's choice of 18 Oct 2026: stats, leagues and
// bookmakers), each against the whole view's return
export function hotCold(rows, dims = ['statSide', 'comp', 'book'], { n = 5, min = 5 } = {}) {
  const mu = agg(rows).ret ?? 0;
  const all = dims.flatMap((d) => shrink(rows, d, { min }).groups);
  const up = [...all].sort((a, b) => (b.shrunk - b.mu) - (a.shrunk - a.mu));
  return { mu, all, hot: up.filter((x) => x.shrunk > x.mu + 0.005).slice(0, n), cold: [...up].reverse().filter((x) => x.shrunk < x.mu - 0.005).slice(0, n),
    anyStandOut: all.some((x) => x.k > 0.05) };
}
