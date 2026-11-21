// Under test (the user, 7 Nov 2026: "explore wider before the limits come, all on the board, so they can review in their own time and
// decide"; the Orchestrator's ask to PA): every lane of fm/lanes.json not in real money, its record, its calibration, its status
// and its next step. A lane appears by its row alone (board.py feed.lanes; its set by data.js addLaneSets, its bets by its own
// builder or board.py auto_sets). The Ideas tab's card and the bot's "under test" read these same rows.

import { isNum, mean } from './util.js';
import { agg } from './metrics.js';

export const CAL_GAP = 0.05;          // as scripts/weekly_review.py's calibration: 5 points, beyond two bands, on 10 matches or more
export const CAL_MIN_MATCHES = 10;

// a lane in real money: its row's `real` (fm/lanes.json), or "real money" in its label
export const isReal = (L) => L.real === true || /real money/i.test(L.label || '');

// our chance said against what landed, on the settled picks with a chance: the gap (landed - said), its band the wider of the
// spread by match and luck alone at our chances (weekly_review.calibration_section's rule, 7c036db1); null with no chance said
export function calGap(rows) {
  const g = rows.filter((r) => r.settled && isNum(r.ours));
  if (!g.length) return null;
  const n = g.length, gap = mean(g, (r) => r.w - r.ours);
  const m = new Map();
  for (const r of g) {
    const k = r.match ? `${r.day || ''}|${r.match}` : `#${r.id}`;
    const x = m.get(k) || [0, 0];
    x[0] += r.w - r.ours; x[1] += 1;
    m.set(k, x);
  }
  let s2 = 0;
  for (const [s, c] of m.values()) s2 += (s - gap * c) ** 2;
  const band = Math.max(Math.sqrt(s2) / n, Math.sqrt(g.reduce((s, r) => s + r.ours * (1 - r.ours), 0)) / n);
  return { n, matches: m.size, said: mean(g, (r) => r.ours), won: mean(g, (r) => r.w), gap, band,
    off: m.size >= CAL_MIN_MATCHES && Math.abs(gap) >= CAL_GAP && Math.abs(gap) >= 2 * band };
}

const RANK = { behind: 0, ahead: 1, 'checklist done': 2, collecting: 3 };

// one row a lane: {L, a (metrics.agg), cal, status, word (collecting / ahead / behind / checklist done or the owner's own), next}
export function underTestRows(D) {
  const lanes = ((D.feed || {}).lanes || []).filter((L) => L.set && !isReal(L));
  return lanes.map((L) => {
    const rows = (D.bets || []).filter((r) => r.sport === L.sport && r.set === L.set);
    const a = agg(rows), cal = calGap(rows);
    const word = L.status ? String(L.status) : /^ahead/.test(a.verdict || '') ? 'ahead' : a.verdict === 'behind' ? 'behind' : 'collecting';
    return { L, a, cal, word, verdict: a.verdict, next: L.next || null, nextDate: L.next_date || null };
  }).sort((x, y) => ((RANK[x.word] ?? 2.5) - (RANK[y.word] ?? 2.5)) || (y.a.matches - x.a.matches));
}

// Does the score earn it? (the user, 8 Nov 2026 about 08:00 UK: "when a lower overlay band pays more than a higher one, or the 1-2-3
// score doesn't rank the returns", the Orchestrator's standing check): scripts/order_check.py's rows through board.py's feed.order,
// every board set and set x stat with 60+ settled. ❌ beyond luck, ⚠️ inside luck, ✓ in order; the Ideas card and the bot's "order".
export const ORDER_MARK = { 2: '❌', 1: '⚠️', 0: '✓' };
export const orderLabel = (r) => `${r.sport} · ${r.set}${r.stat ? ` · ${r.stat}` : ''}`;
const sgn = (x) => `${x >= 0 ? '+' : '−'}${Math.round(Math.abs(x) * 100)}%`;

// "<10 +28% ±18% (69) · 10-15 +14% ±11% (386) …", cells on 5+ matches; the slope after it when there is one
export function orderStrip(cells, slope, per) {
  const s = (cells || []).filter((c) => c && c[2] >= 5 && c[3] !== null && c[3] !== undefined)
    .map(([nm, n, , ret, band]) => `${nm} ${sgn(ret)} ±${Math.round(band * 100)}% (${n})`).join(' · ');
  if (!s) return '';
  return s + (slope ? `; ${per} ${sgn(slope[0])} ±${Math.round(slope[1] * 100)}%` : '');
}

// the feed's order check: its rows (sport filter optional), counts, the luck line; null before the first build with it
export function orderCheck(D, sport = null) {
  const o = (D.feed || {}).order || {};
  if (!o.rows || !o.luck) return null;
  const rows = o.rows.filter((r) => !sport || r.sport === sport);
  const n = (lv) => rows.filter((r) => r.level === lv).length;
  const L = o.luck;
  return { rows, bad: n(2), watch: n(1), ok: n(0), luck: L, min: o.min_settled || 60,
    luckLine: `Out of order: ${L.out} rows, ${L.out2} beyond luck; luck alone (overlay and score shuffled across each row’s picks) puts about ${L.expected} out of order and ${L.expected2} beyond luck.` };
}
