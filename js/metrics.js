// The sums, the same way the record counts them (ledger/TRACKING.md): return = profit over stakes on settled bets,
// luck alone = root of the sum of stake squared x (price - 1), over the stakes; verdicts as scripts/what_works.py.

import { isNum, sum, mean, uniq, dowOf } from './util.js';

export function verdict(ret, luck, n) {
  if (!isNum(ret) || !isNum(luck) || luck <= 0 || !n) return { word: 'too few', z: null, more: null };
  const z = ret / luck;
  const a = Math.abs(z);
  const word = a >= 2 ? (z > 0 ? 'ahead' : 'behind') : a >= 1 ? (z > 0 ? 'leaning ahead' : 'leaning behind') : 'too early';
  const more = a >= 2 ? 0 : z === 0 ? null : Math.ceil((n * 4) / (z * z) - n);
  return { word, z, more };
}

export function wilson(w, n, zc = 1.96) {
  if (!n) return [null, null];
  const p = w / n, d = 1 + (zc * zc) / n;
  const c = p + (zc * zc) / (2 * n), s = zc * Math.sqrt((p * (1 - p)) / n + (zc * zc) / (4 * n * n));
  return [(c - s) / d, (c + s) / d];
}

// one group of bets, every number the views show
export function agg(rows) {
  const done = rows.filter((r) => r.settled && isNum(r.stake) && isNum(r.price));
  const open = rows.filter((r) => r.status === 'open' || r.status === 'in play');
  const staked = sum(done, (r) => r.stake);
  const profit = sum(done, (r) => r.profit);
  const varSum = sum(done, (r) => r.stake * r.stake * (r.price - 1));
  const n = done.length;
  const won = done.filter((r) => r.w).length;
  const ret = staked ? profit / staked : null;
  const luck = staked ? Math.sqrt(varSum) / staked : null;
  const levelRet = n ? mean(done, (r) => r.w * r.price - 1) : null;
  const levelLuck = n ? Math.sqrt(sum(done, (r) => r.price - 1)) / n : null;
  const v = verdict(ret, luck, n);
  const beat = rows.filter((r) => isNum(r.beat));
  return {
    bets: rows.length, n, won, lost: n - won, open: open.length, void: rows.filter((r) => r.status === 'void').length,
    staked, profit, ret, luck, z: v.z, verdict: v.word, more: v.more,
    wonPct: n ? won / n : null, needed: n ? mean(done, (r) => r.needs ?? 1 / r.price) : null, said: n ? mean(done, (r) => r.ours) : null,
    bookp: n ? mean(done, (r) => r.bookp) : null, level: levelRet, levelLuck,
    openStake: sum(open, (r) => r.stake), avgPrice: n ? mean(done, (r) => r.price) : null, avgEdge: rows.length ? mean(rows, (r) => r.edge) : null,
    clv: beat.length ? mean(beat, (r) => r.beat) : null, clvN: beat.length, beatShare: beat.length ? beat.filter((r) => r.beat > 0.005).length / beat.length : null,
    matches: uniq(rows.map((r) => r.match)).length, provisional: done.filter((r) => r.settled_on && r.settled_on !== 'match table').length,
    ci: wilson(won, n),
  };
}

// --------------------------------------------------------------------------------------------- cuts and their order

const ORDER = {
  pband: ['under 1.30', '1.30 to 1.59', '1.60 to 1.99', '2.00 to 2.49', '2.50 to 3.49', '3.50 and over'],
  margin: ['very close', 'close', 'far', 'very far'],
  landed: ['past our number', 'between the line and our number', 'on the wrong side of the line'],
  nearer: ['our number', 'their number'],
  conf: ['High', 'Medium', 'Low', 'Fast lane', 'not recorded'],
  hour: ['before 15:00', '15:00 to 17:59', '18:00 to 20:59', '21:00 and later'],
  lead: ['under 2 hours', '2 to 6 hours', '6 to 24 hours', 'a day or more'],
  dow: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
  side: ['over', 'under'],
  scope: ['home team', 'away team', 'match total'],
  status: ['won', 'lost', 'open', 'in play', 'void'],
};
const leadNum = (s) => { const m = String(s).match(/(-?\d+(\.\d+)?)/); return m ? (String(s).startsWith('under') ? -1 + +m[1] / 1000 : +m[1]) : 999; };

export function orderKeys(dim, keys, stats) {
  if (ORDER[dim]) return [...ORDER[dim].filter((k) => keys.includes(k)), ...keys.filter((k) => !ORDER[dim].includes(k)).sort()];
  if (dim === 'eband' || dim === 'eband2') return [...keys].sort((a, b) => leadNum(a) - leadNum(b));
  if (dim === 'day' || dim === 'week') return [...keys].sort();
  if (stats) return [...keys].sort((a, b) => (stats[b]?.n || 0) - (stats[a]?.n || 0) || String(a).localeCompare(String(b)));
  return [...keys].sort();
}

export function valueOf(r, dim) {
  const v = r[dim];
  return v === null || v === undefined || v === '' ? '(not known)' : v;
}

export function group(rows, dim) {
  const m = new Map();
  for (const r of rows) {
    const k = valueOf(r, dim);
    if (!m.has(k)) m.set(k, []);
    m.get(k).push(r);
  }
  const stats = {};
  for (const [k, g] of m) stats[k] = { key: k, rows: g, ...agg(g) };
  return orderKeys(dim, [...m.keys()], stats).map((k) => stats[k]);
}

export function cross(rows, a, b) {
  const ga = group(rows, a);
  const keysB = orderKeys(b, uniq(rows.map((r) => valueOf(r, b))), Object.fromEntries(group(rows, b).map((x) => [x.key, x])));
  const cells = [];
  for (const x of ga) for (const y of group(x.rows, b)) cells.push({ a: x.key, b: y.key, ...y });
  return { rowsKeys: ga.map((x) => x.key), colsKeys: keysB, cells, rowTotals: ga };
}

export function metricOf(g, metric) {
  if (!g) return null;
  switch (metric) {
    case 'ret': return g.ret;
    case 'level': return g.level;
    case 'profit': return g.profit;
    case 'edge': return isNum(g.wonPct) && isNum(g.needed) ? g.wonPct - g.needed : null;
    case 'calib': return isNum(g.wonPct) && isNum(g.said) ? g.wonPct - g.said : null;
    case 'z': return g.z;
    case 'n': return g.n;
    default: return g.ret;
  }
}

// --------------------------------------------------------------------------------------------- time series

export function byDay(rows) {
  const m = new Map();
  for (const r of rows) if (r.day) { if (!m.has(r.day)) m.set(r.day, []); m.get(r.day).push(r); }
  return [...m.keys()].sort().map((d) => ({ day: d, ...agg(m.get(d)) }));
}

export function byPeriod(rows, period) {
  const key = period === 'week' ? (r) => r.week : period === 'month' ? (r) => (r.day ? r.day.slice(0, 7) : null) : (r) => r.day;
  const m = new Map();
  for (const r of rows) { const k = key(r); if (!k) continue; if (!m.has(k)) m.set(k, []); m.get(k).push(r); }
  return [...m.keys()].sort().map((k) => ({ key: k, ...agg(m.get(k)) }));
}

// the running profit of the settled bets, in kick-off order, with the fall from the highest point so far
export function running(rows) {
  const done = rows.filter((r) => r.settled && isNum(r.profit)).sort((a, b) => (a.kickAt?.getTime() || 0) - (b.kickAt?.getTime() || 0) || (a.day || '').localeCompare(b.day || ''));
  let total = 0, peak = 0, staked = 0, worst = 0;
  const pts = done.map((r) => {
    total += r.profit; staked += r.stake || 0; peak = Math.max(peak, total);
    worst = Math.min(worst, total - peak);
    return { t: r.kickAt ? r.kickAt.getTime() : null, day: r.day, total, dd: total - peak, staked, r };
  });
  return { pts, maxDD: worst, peak, now: total, ddNow: total - peak };
}

export function streak(days) {
  let cur = 0, sign = 0, best = 0, worst = 0, run = 0, runSign = 0;
  for (const d of days) {
    if (!d.n) continue;
    const s = d.profit > 0 ? 1 : d.profit < 0 ? -1 : 0;
    if (s === runSign && s !== 0) run++; else { run = s ? 1 : 0; runSign = s; }
    if (runSign > 0) best = Math.max(best, run);
    if (runSign < 0) worst = Math.max(worst, run);
    cur = run; sign = runSign;
  }
  return { current: cur, sign, best, worst };
}

// --------------------------------------------------------------------------------------------- the model

export const CAL_BINS = [[0, 0.35], [0.35, 0.45], [0.45, 0.55], [0.55, 0.65], [0.65, 0.75], [0.75, 1.01]];
export function calibration(rows) {
  const done = rows.filter((r) => r.settled && isNum(r.ours));
  return CAL_BINS.map(([lo, hi]) => {
    const g = done.filter((r) => r.ours >= lo && r.ours < hi);
    const w = g.filter((r) => r.w).length;
    return { lo, hi, n: g.length, said: mean(g, (r) => r.ours), won: g.length ? w / g.length : null, needed: mean(g, (r) => r.needs ?? 1 / r.price), ci: wilson(w, g.length) };
  });
}

// how much of the distance from the bookmaker's number to ours showed up in the counts (scripts/ledger.py shown_up)
export function shownUp(rows) {
  let gg = 0, gt = 0;
  const pairs = [];
  for (const r of rows) {
    if (!r.settled || !isNum(r.expected) || !isNum(r.theirs) || !isNum(r.swing) || !r.swing) continue;
    const got = parseFloat(r.actual);
    if (!Number.isFinite(got)) continue;
    const gap = (r.expected - r.theirs) / r.swing, x = (got - r.theirs) / r.swing;
    if (!gap) continue;
    gg += gap * gap; gt += gap * x; pairs.push([gap, x]);
  }
  if (pairs.length < 2) return { share: null, se: null, n: pairs.length };
  const share = gt / gg;
  const resid = sum(pairs, ([g, x]) => (x - share * g) ** 2);
  return { share, se: Math.sqrt(resid / (pairs.length - 1) / gg), n: pairs.length };
}

// each settled stat pick as a point: across, how far past the line we put our number; up, how far past the line it came
export function afterPoints(rows) {
  const out = [];
  for (const r of rows) {
    if (!r.settled || !isNum(r.expected) || !isNum(r.line) || !isNum(r.by) || !isNum(r.swing) || !r.swing) continue;
    const ours = r.side === 'over' ? r.expected - r.line : r.line - r.expected;
    out.push({ x: ours / r.swing, y: r.by / r.swing, r });
  }
  return out;
}

export { dowOf };
