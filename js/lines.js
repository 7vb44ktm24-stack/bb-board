// The Lines tab's sums, kept apart from the page so node can check them against logs/line_judge.json's own summary
// (board/test_lines.mjs). Who found the line: the user's rule of 18 Oct 2026 (20.5 finds 20 or 21) on each forecaster's
// 50/50 line; close, within the stat's band; the miss (the count less the line) and its lean; ours against each
// bookmaker on the same counts. Then the stakes played other ways: as staked, level, and Kelly on our chance.

import { isNum, sum, mean, uniq, weekStart } from './util.js';

export const OURS = 'Ours';

// the feed's part as one object a forecast (scripts/line_judge.py feed(): matches, stats and counts by index)
export function unpack(L) {
  if (!L || !L.rows || !L.rows.g) return [];
  const M = L.matches, C = L.counts, R = L.rows;
  const out = new Array(R.g.length);
  for (let i = 0; i < R.g.length; i++) {
    const g = R.g[i], m = C.m[g], s = L.stats[C.s[g]];
    const line = R.l[i] / 100, count = C.c[g], miss = count - line, low = Math.floor(line);
    out[i] = {
      g, mid: m, who: L.who[R.w[i]], line, count, miss, found: count === low || count === low + 1, close: Math.abs(miss) <= s.half,
      match: M.name[m], day: M.day[m], comp: M.comp[m], sport: M.sport[m], stat: s.stat, scope: s.scope, half: s.half,
      statKey: s.scope === 'match total' ? s.stat : `${s.stat}, ${s.scope}`,
    };
  }
  return out;
}

// the same, kept until the feed's part changes (Today and the Lines tab both read it)
let kept = { made: undefined, rows: [] };
export function rowsOf(L) {
  const made = L ? L.made : null;
  if (kept.made !== made) kept = { made, rows: unpack(L) };
  return kept.rows;
}

// one forecaster's numbers on its rows
export function score(rows) {
  const n = rows.length;
  return {
    n, matches: uniq(rows.map((r) => r.mid)).length,              // a match is its name and day (players meet again)
    found: n ? rows.filter((r) => r.found).length / n : null, close: n ? rows.filter((r) => r.close).length / n : null,
    miss: n ? mean(rows, (r) => Math.abs(r.miss)) : null, lean: n ? mean(rows, (r) => r.miss) : null,
  };
}

export function byWho(rows, order = []) {
  const m = new Map();
  for (const r of rows) { if (!m.has(r.who)) m.set(r.who, []); m.get(r.who).push(r); }
  const keys = [...order.filter((w) => m.has(w)), ...[...m.keys()].filter((w) => !order.includes(w)).sort()];
  return keys.map((who) => ({ who, rows: m.get(who), ...score(m.get(who)) }));
}

// a mean and its standard error with the counts of one match taken together (they move together)
export function clusterMean(xs, groups) {
  const n = xs.length;
  if (!n) return { mean: null, se: null, n: 0 };
  const mu = xs.reduce((s, x) => s + x, 0) / n;
  const by = new Map();
  xs.forEach((x, i) => by.set(groups[i], (by.get(groups[i]) || 0) + (x - mu)));
  let v = 0;
  for (const s of by.values()) v += s * s;
  return { mean: mu, se: Math.sqrt(v) / n, n, clusters: by.size };
}

// one forecaster (ours, unless another is named) against each other on the counts both priced: found gap and nearer share,
// each with its standard error; the fields keep the name "ours" for the reference whoever it is
export function headToHead(rows, ref = OURS) {
  const ours = new Map(rows.filter((r) => r.who === ref).map((r) => [r.g, r]));
  const books = new Map();
  for (const r of rows) {
    if (r.who === ref || !ours.has(r.g)) continue;
    if (!books.has(r.who)) books.set(r.who, []);
    books.get(r.who).push(r);
  }
  return [...books.entries()].map(([who, xs]) => {
    const o = xs.map((r) => ours.get(r.g));
    const m = xs.map((r) => r.mid);
    const gap = clusterMean(xs.map((r, i) => (o[i].found ? 1 : 0) - (r.found ? 1 : 0)), m);
    const near = clusterMean(xs.map((r, i) => { const a = Math.abs(o[i].miss), b = Math.abs(r.miss); return a < b ? 1 : a === b ? 0.5 : 0; }), m);
    return {
      who, ref, n: xs.length, matches: uniq(m).length, oursFound: mean(o, (r) => (r.found ? 1 : 0)), theirFound: mean(xs, (r) => (r.found ? 1 : 0)),
      gap: gap.mean, gapSe: gap.se, nearer: near.mean, nearerSe: near.se,
      oursMiss: mean(o, (r) => Math.abs(r.miss)), theirMiss: mean(xs, (r) => Math.abs(r.miss)),
    };
  }).sort((a, b) => b.n - a.n);
}

export const MEASURES = {
  found: { label: 'Found it', get: (s) => s.found, better: 'higher' },
  close: { label: 'Close', get: (s) => s.close, better: 'higher' },
  miss: { label: 'Average miss', get: (s) => s.miss, better: 'lower' },
  lean: { label: 'Lean', get: (s) => s.lean, better: 'zero' },
};

// stat by forecaster: each cell its score
export function grid(rows, order) {
  const stats = uniq(rows.map((r) => r.statKey));
  const who = byWho(rows, order).map((x) => x.who);
  const cells = [];
  for (const st of stats) for (const w of who) {
    const xs = rows.filter((r) => r.statKey === st && r.who === w);
    if (xs.length) cells.push({ stat: st, who: w, ...score(xs) });
  }
  const size = (st) => sum(cells.filter((c) => c.stat === st), (c) => c.n);
  return { stats: stats.sort((a, b) => size(b) - size(a)), who, cells };
}

// found it week by week, for each forecaster with `least` counts in the week
export function weekly(rows, order, least = 20) {
  return byWho(rows, order).map((x) => {
    const m = new Map();
    for (const r of x.rows) { if (!r.day) continue; const k = weekStart(r.day); if (!m.has(k)) m.set(k, []); m.get(k).push(r); }
    const pts = [...m.keys()].sort().filter((k) => m.get(k).length >= least).map((k) => ({ week: k, ...score(m.get(k)) }));
    return { who: x.who, pts };
  }).filter((s) => s.pts.length);
}

// how far off, in whole counts, for a forecaster's rows: {miss: number of counts}
export function missSpread(rows, width = 6) {
  const out = new Map();
  for (const r of rows) {
    const k = Math.max(-width, Math.min(width, Math.round(r.miss)));
    out.set(k, (out.get(k) || 0) + 1);
  }
  return [...out.entries()].sort((a, b) => a[0] - b[0]);
}

// each parlay once (18 Oct 2026: "the day's three" and "each bookmaker's best" often pick the very same parlay; each rule
// keeps its own record, but a total across them counted it twice): the same day, bookmaker, legs and price
export function distinctParlays(ps) {
  const seen = new Set();
  return ps.filter((p) => { const k = `${p.day}|${p.book}|${p.legs ?? p.id}|${p.price}`; if (seen.has(k)) return false; seen.add(k); return true; });
}

// ------------------------------------------------------------------------------------------------ the stakes, other ways

// a bet's share of the bank by Kelly on our chance: (p x price - 1) / (price - 1), none where we see no edge
export function kelly(p, price) {
  if (!isNum(p) || !isNum(price) || price <= 1) return 0;
  return Math.max(0, (p * price - 1) / (price - 1));
}

export const STYLES = [
  { id: 'staked', label: 'As staked' },
  { id: 'level', label: 'Level £10' },
  { id: 'k8', label: 'Kelly ⅛', f: 0.125 },
  { id: 'k4', label: 'Kelly ¼', f: 0.25 },
  { id: 'k2', label: 'Kelly ½', f: 0.5 },
];

// the settled bets played from a bank of `bank`, a match day at a time: each day's stakes from the bank that morning, its
// results added that night; Kelly stakes capped at `cap` of the bank a bet and `matchCap` a match (the stakes' own rule:
// a tenth and a quarter, fm/value.py) and `dayCap` a day (the real-money day cap, £500 of £1,000), nothing once the bank
// is gone; level is £10 a bet whatever the bank; as staked is the stakes the bets had.
export function simulate(rows, { style = 'k4', bank = 1000, cap = 0.1, matchCap = 0.25, dayCap = 0.5, level = 10 } = {}) {
  const st = STYLES.find((s) => s.id === style) || STYLES[3];
  const done = rows.filter((r) => r.settled && isNum(r.price) && r.day).sort((a, b) => (a.day < b.day ? -1 : a.day > b.day ? 1 : 0));
  let b = bank, staked = 0, peak = bank, worst = 0, n = 0, won = 0, skipped = 0;
  const pts = [], days = uniq(done.map((r) => r.day));
  for (const day of days) {
    const today = done.filter((r) => r.day === day);
    let stakes = today.map((r) => {
      if (st.id === 'staked') return isNum(r.stake) ? r.stake : 0;
      if (st.id === 'level') return level;
      const k = kelly(r.ours, r.price);
      return k > 0 && b > 0 ? Math.min(cap * b, st.f * k * b) : 0;
    });
    if (st.f) {                                                    // a quarter of the bank a match and half a day at most
      const byMatch = new Map();
      today.forEach((r, i) => byMatch.set(r.match, (byMatch.get(r.match) || 0) + stakes[i]));
      stakes = stakes.map((s, i) => { const t = byMatch.get(today[i].match); return t > matchCap * b ? (s * matchCap * b) / t : s; });
      const day = stakes.reduce((s, x) => s + x, 0);
      if (day > dayCap * b) stakes = stakes.map((s) => (s * dayCap * b) / day);
    }
    let pl = 0;
    today.forEach((r, i) => {
      const s = stakes[i];
      if (!(s > 0)) { skipped++; return; }
      n++; staked += s; if (r.w) won++;
      pl += s * (r.w ? r.price - 1 : -1);
    });
    b += pl;
    peak = Math.max(peak, b);
    worst = Math.min(worst, b - peak);
    pts.push({ day, bank: b });
  }
  const profit = b - bank;
  return { style: st.id, label: st.label, bets: n, won, skipped, staked, profit, ret: staked ? profit / staked : null, end: b, maxDD: worst, pts };
}

// every style side by side for a group of bets
export function styles(rows, opts = {}) {
  return Object.fromEntries(STYLES.map((s) => [s.id, simulate(rows, { ...opts, style: s.id })]));
}
