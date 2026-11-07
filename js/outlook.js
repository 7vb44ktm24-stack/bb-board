// The bank's next days (the user's choice of 18 Oct 2026: "likely paths for the bank over the next 30 days at the current
// return and stakes, with the chance of a 20% fall"). Paths drawn from the record's own recent bets: a day's number of bets
// drawn from the recent days (a day with none counts), each bet one of the recent settled bets with its stake and price,
// won with the chance that gives the assumed return. The return itself is only known to within its luck band, so each path
// draws its own from that band: the fan widens honestly. Seeded, so the same record always draws the same fan.

import { isNum, addDays } from './util.js';
import { agg } from './metrics.js';

export const EDGES = [{ id: 'record', label: 'At the record’s return' }, { id: 'half', label: 'Half of it' }, { id: 'none', label: 'No edge' }];

function rng(seed) {                                               // mulberry32: small, fast, the same draws every time
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function normal(r) { let u = 0; while (u === 0) u = r(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * r()); }
const quant = (sorted, p) => sorted[Math.min(sorted.length - 1, Math.max(0, Math.round(p * (sorted.length - 1))))];

// rows: one record's bets (the paper account, say). Returns null with fewer than 20 settled bets.
export function outlook(rows, { days = 30, paths = 2000, edge = 'record', lookback = 21, seed = 20261018, bank = 1000, fall = 0.2 } = {}) {
  const done = rows.filter((r) => r.settled && isNum(r.stake) && r.stake > 0 && isNum(r.price) && r.price > 1 && r.day);
  if (done.length < 20) return null;
  const last = done.reduce((m, r) => (r.day > m ? r.day : m), '');
  const first = addDays(last, -(lookback - 1));
  let recent = done.filter((r) => r.day >= first);
  if (recent.length < 20) recent = done;
  const start = recent.reduce((m, r) => (r.day < m ? r.day : m), last);
  const perDay = [];
  for (let d = start; d <= last; d = addDays(d, 1)) perDay.push(recent.filter((r) => r.day === d).length);
  const g = agg(recent);
  const base = edge === 'record' ? g.ret : edge === 'half' ? g.ret / 2 : 0;
  const unc = edge === 'none' ? 0 : g.luck || 0;
  const r = rng(seed);
  const track = Array.from({ length: days }, () => new Float64Array(paths));
  const ends = new Float64Array(paths), worst = new Float64Array(paths), edges = new Float64Array(paths);
  for (let p = 0; p < paths; p++) {
    const e = Math.max(-0.6, Math.min(1.5, base + unc * normal(r)));
    edges[p] = e;
    let pl = 0, peak = 0, low = 0;
    for (let d = 0; d < days; d++) {
      const k = perDay[Math.floor(r() * perDay.length)];
      for (let j = 0; j < k; j++) {
        const b = recent[Math.floor(r() * recent.length)];
        const win = Math.min(0.995, Math.max(0.005, (1 + e) / b.price));
        pl += r() < win ? b.stake * (b.price - 1) : -b.stake;
        if (pl > peak) peak = pl;
        if (pl - peak < low) low = pl - peak;
      }
      track[d][p] = pl;
    }
    ends[p] = pl; worst[p] = low;
  }
  const q = track.map((col, d) => {
    const s = Array.from(col).sort((a, b) => a - b);
    return { day: d + 1, p5: quant(s, 0.05), p25: quant(s, 0.25), p50: quant(s, 0.5), p75: quant(s, 0.75), p95: quant(s, 0.95) };
  });
  const endSorted = Array.from(ends).sort((a, b) => a - b);
  let down = 0;
  for (let p = 0; p < paths; p++) if (ends[p] < 0) down++;
  // a fall from the highest point so far, at some time in the days ahead: 20% of the bank (the user's measure), and larger
  const falls = [fall, 0.3, 0.5].map((f) => ({ share: f, at: f * bank, chance: Array.from(worst).filter((w) => w <= -f * bank).length / paths }));
  const worstSorted = Array.from(worst).sort((a, b) => a - b);
  return {
    q, days, paths, edge, base, unc, ret: g.ret, luck: g.luck, n: recent.length, from: start, to: last,
    perDay: perDay.reduce((s, x) => s + x, 0) / perDay.length, avgStake: recent.reduce((s, x) => s + x.stake, 0) / recent.length,
    median: quant(endSorted, 0.5), p5: quant(endSorted, 0.05), p95: quant(endSorted, 0.95), p25: quant(endSorted, 0.25), p75: quant(endSorted, 0.75),
    chanceDown: down / paths, chanceFall: falls[0].chance, fallAt: fall * bank, falls, worstMedian: quant(worstSorted, 0.5), bank,
  };
}
