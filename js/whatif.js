// What if: football's own picks replayed under another rule (the user's choice of 18 Oct 2026): another send bar, a ceiling
// on the overlay, bookmakers, stats or sides left out, more or fewer picks a match, other stakes. A replay of the bets we
// logged, not a walk-forward test: the picks stay as they were shown, only the rule that keeps them and the stakes change.
// A setting worth keeping still goes through scripts/rule_test.py, old against new, before anything changes.

import { isNum } from './util.js';
import { agg } from './metrics.js';
import { simulate } from './lines.js';

export const BARS = [0.10, 0.15, 0.20, 0.25, 0.30, 0.40];
export const CAPS = [{ id: 'none', label: 'No ceiling', v: null }, { id: '0.6', label: 'Up to 60%', v: 0.6 }, { id: '0.4', label: 'Up to 40%', v: 0.4 }];
export const PER = [{ id: '1', label: '1' }, { id: '2', label: '2' }, { id: '3', label: '3' }, { id: 'all', label: 'Any' }];
export const NOW = { bar: 0.2, cap: null, per: '2', style: 'staked' };      // the rule in force since 17 Oct 2026

const isBuilder = (r) => /builder/.test(r.kind || '') || r.stat === 'bet builder';
export const keyOf = (r) => `${r.day}|${r.match}|${r.bet}|${r.book}`;

// football's candidates: the paper account's stat picks and the lines kept back (10% to 20%, or a third in a match), each
// selection once a match day, the paper account's row first. Builders are left out: off the stakes since 15 Oct.
export function candidates(bets) {
  const seen = new Set(), out = [];
  for (const set of ['paper', 'kept']) {
    for (const r of bets) {
      if (r.sport !== 'football' || r.set !== set || isBuilder(r) || !isNum(r.edge)) continue;
      const k = keyOf(r);
      if (seen.has(k)) continue;
      seen.add(k);
      out.push(r);
    }
  }
  return out;
}

// the picks a rule keeps. rule: {bar, cap, per ('1', '2', '3' or 'all'), outBook, outStat, outSide (lists left out)}; a
// match keeps its best `per` by overlay (then by stake)
export function keep(cands, rule) {
  const cap = rule.cap === null || rule.cap === undefined ? null : +rule.cap;
  let pool = cands.filter((r) => r.edge >= rule.bar - 1e-9 && (cap === null || r.edge <= cap + 1e-9)
    && !(rule.outBook || []).includes(r.book) && !(rule.outStat || []).includes(r.stat) && !(rule.outSide || []).includes(r.side));
  if (rule.per && rule.per !== 'all') {
    const n = +rule.per, byMatch = new Map();
    for (const r of pool) { const k = `${r.day}|${r.match}`; if (!byMatch.has(k)) byMatch.set(k, []); byMatch.get(k).push(r); }
    pool = [...byMatch.values()].flatMap((g) => g.sort((a, b) => b.edge - a.edge || (b.stake || 0) - (a.stake || 0)).slice(0, n));
  }
  return pool;
}

// Kelly stakes on the careful chance where the record has one (as the stakes themselves are sized), else on ours
const forKelly = (rows) => rows.map((r) => (isNum(r.ps) ? { ...r, ours: r.ps } : r));

// the replay against the record as it was (its stat picks, as staked): each played from a bank of 1,000 a match day at a
// time (lines.simulate: a tenth of the bank a bet, a quarter a match, half a day for Kelly), with what the rule added and
// what it dropped
export function replay(cands, record, rule) {
  const kept = keep(cands, rule);
  const sim = simulate(rule.style === 'staked' ? kept : forKelly(kept), { style: rule.style || 'staked' });
  const base = simulate(record, { style: 'staked' });
  const inRecord = new Set(record.map(keyOf)), inKept = new Set(kept.map(keyOf));
  const added = kept.filter((r) => !inRecord.has(keyOf(r))), dropped = record.filter((r) => !inKept.has(keyOf(r)));
  return { rule, kept, sim, base, a: agg(kept), b: agg(record), added: agg(added), dropped: agg(dropped), addedRows: added, droppedRows: dropped };
}

// the rule in words, for a request to test it properly
export function describe(rule) {
  const bits = [`picks ${Math.round(rule.bar * 100)}% or more above their price`];
  if (rule.cap !== null && rule.cap !== undefined) bits.push(`no more than ${Math.round(rule.cap * 100)}% above`);
  if (rule.per && rule.per !== 'all') bits.push(`at most ${rule.per} a match`);
  if ((rule.outBook || []).length) bits.push(`not at ${rule.outBook.join(' or ')}`);
  if ((rule.outStat || []).length) bits.push(`no ${rule.outStat.join(' or ')}`);
  if ((rule.outSide || []).length) bits.push(`no ${rule.outSide.join(' or ')}s`);
  bits.push({ staked: 'stakes as the record had them', level: 'level £10 stakes', k8: 'Kelly ⅛', k4: 'Kelly ¼', k2: 'Kelly ½' }[rule.style || 'staked']);
  return bits.join(', ');
}
