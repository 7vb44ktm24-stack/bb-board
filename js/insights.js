// Insights, questions and ideas, worked out from the record in front of you. Each says what it rests on (how many bets,
// the luck band) and opens the view that shows it. An idea is a request for Claude, worded as the project's rule
// wants it (an old-against-new test before anything changes), ready to copy into the chat.

import { agg, group, verdict } from './metrics.js';
import { isNum, money, pct, spct, pp, esc, dayLabel, fromGreek } from './util.js';
import { compName } from './data.js';

const SLICE_DIMS = ['statSide', 'stat', 'book', 'comp', 'pband', 'eband', 'conf', 'lead', 'hour', 'scope', 'side'];
const DIM_WORD = { statSide: '', stat: '', book: 'at ', comp: 'in ', pband: 'priced ', eband: 'shown at ', conf: 'confidence ', lead: 'shown ', hour: 'kick-off ', scope: '', side: '' };
const name = (dim, k) => (dim === 'comp' ? compName(k) : k);
const MIN_N = 12;

function label(dim, k) {
  const w = DIM_WORD[dim] || '';
  const n = name(dim, k);
  return `${w}${n}`.replace(/^at (.*)$/, 'Picks at $1').replace(/^in (.*)$/, 'Picks in $1').replace(/^priced (.*)$/, 'Prices $1').replace(/^shown at (.*)$/, 'Overlays $1')
    .replace(/^confidence (.*)$/, '$1 confidence').replace(/^shown (.*)$/, 'Shown $1 before kick-off').replace(/^kick-off (.*)$/, 'Kick-offs $1');
}
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);

function evidence(g) {
  return `${g.n} settled, won ${pct(g.wonPct)} where the prices needed ${pct(g.needed)} (we said ${pct(g.said)}); luck alone ±${pct(g.luck)}`;
}

export const ASK_TAIL = ' Keep the paper account as the headline with first shown beside it, give each figure its luck band, and answer in plain words.';

// rows: the football paper account in the chosen range; all: every football row in that range (every set)
export function insights(D, rows, all, { range = 'all' } = {}) {
  const out = [];
  const g = agg(rows);
  if (!g.n) return out;
  const first = agg(all.filter((r) => r.set === 'first'));
  out.push({
    id: 'headline', tone: g.profit >= 0 ? 'good' : 'bad', title: `Paper account ${spct(g.ret, 1)} (${money(g.profit)})`,
    body: `On ${money(g.staked, '£', 0, false)} staked across ${g.n} settled bets: luck alone moves this by ±${pct(g.luck, 1)}, so it reads <b>${esc(g.verdict)}</b>${isNum(g.more) && g.more > 0 ? ` (about ${g.more} more settled bets at this rate to know)` : ''}. First shown: ${first.n ? `${spct(first.ret, 1)} on ${first.n}` : 'none settled'}.`,
    go: { tab: 'results', set: 'paper' },
  });

  // the strongest and weakest slices
  const found = [];
  for (const dim of SLICE_DIMS) {
    for (const x of group(rows, dim)) {
      if (x.key === '(not known)' || x.n < MIN_N || !isNum(x.z)) continue;
      if (x.n > g.n * 0.85) continue;                              // a slice that is nearly the whole record says nothing new
      found.push({ dim, ...x });
    }
  }
  const seen = new Set();
  const pickTop = (list) => list.filter((x) => { const k = x.dim + x.key; if (seen.has(k)) return false; seen.add(k); return true; });
  const best = pickTop(found.filter((x) => x.z >= 1).sort((a, b) => b.z - a.z)).slice(0, 3);
  const worst = pickTop(found.filter((x) => x.z <= -1).sort((a, b) => a.z - b.z)).slice(0, 3);
  for (const x of best) {
    out.push({
      id: `best-${x.dim}-${x.key}`, tone: 'good', title: `${cap(label(x.dim, x.key))}: ${spct(x.ret)} on ${x.n}`,
      body: `${evidence(x)}: <b>${esc(x.verdict)}</b>.`, go: { tab: 'slices', f: { [x.dim]: [x.key] }, rows: x.dim === 'stat' ? 'side' : 'stat', cols: 'book' },
      idea: { title: `Lean into ${label(x.dim, x.key)}?`, ask: `${cap(label(x.dim, x.key))} has returned ${spct(x.ret)} on ${x.n} settled paper bets (luck alone ±${pct(x.luck)}, ${x.verdict}). Test old against new with scripts/rule_test.py, walk-forward with picks included: a stake tilt toward these (for example 1.25x quarter Kelly) against the rule as it stands. Say whether it holds outside the bets that found it.${ASK_TAIL}` },
    });
  }
  for (const x of worst) {
    out.push({
      id: `worst-${x.dim}-${x.key}`, tone: 'bad', title: `${cap(label(x.dim, x.key))}: ${spct(x.ret)} on ${x.n}`,
      body: `${evidence(x)}: <b>${esc(x.verdict)}</b>.`, go: { tab: 'slices', f: { [x.dim]: [x.key] }, rows: x.dim === 'stat' ? 'side' : 'stat', cols: 'book' },
      idea: { title: `Leave out ${label(x.dim, x.key)}?`, ask: `${cap(label(x.dim, x.key))} has returned ${spct(x.ret)} on ${x.n} settled paper bets (luck alone ±${pct(x.luck)}, ${x.verdict}). Find why: is it the price band, the bookmaker or our number? Then test old against new with scripts/rule_test.py (walk-forward, picks included) leaving them out or raising their bar, and say what it would have changed.${ASK_TAIL}` },
    });
  }

  // our chances against what landed
  if (g.n >= 30 && isNum(g.said) && isNum(g.wonPct)) {
    const gap = g.wonPct - g.said;
    const hi = rows.filter((r) => r.settled && isNum(r.edge) && r.edge >= 0.2);
    const gh = agg(hi);
    if (Math.abs(gap) >= 0.04 || (gh.n >= 15 && Math.abs(gh.wonPct - gh.said) >= 0.06)) {
      const runsHigh = gap < 0;
      out.push({
        id: 'calibration', tone: runsHigh ? 'bad' : 'good', title: runsHigh ? `Our chances run ${pp(-gap)} high` : `We win ${pp(gap)} more often than we say`,
        body: `We said ${pct(g.said)}, ${g.won} of ${g.n} won (${pct(g.wonPct)}).${gh.n >= 10 ? ` On overlays of 20% and more: said ${pct(gh.said)}, won ${pct(gh.wonPct)} (${gh.n} bets).` : ''} The prices needed ${pct(g.needed)}.`,
        go: { tab: 'model' },
        idea: runsHigh ? { title: 'Pull our chances toward the bookmakers?', ask: `Our stated chance averaged ${pct(g.said)} on ${g.n} settled paper bets and ${pct(g.wonPct)} won${gh.n >= 10 ? `; on 20%+ overlays ${pct(gh.said)} said against ${pct(gh.wonPct)} won` : ''}. Test old against new with scripts/rule_test.py: a heavier careful weight (the staking chance moved further toward the bookmakers' own chance) for the stakes and the send bar, walk-forward with picks included.${ASK_TAIL}` } : null,
      });
    }
  }

  // bigger overlays: do they pay more?
  const bands = group(rows, 'eband').filter((x) => x.n >= 8 && x.key !== '(not known)');
  if (bands.length >= 2) {
    const lo = bands[0], hi = bands[bands.length - 1];
    if (isNum(lo.ret) && isNum(hi.ret)) {
      const pays = hi.ret > lo.ret;
      out.push({
        id: 'bands', tone: pays ? 'good' : 'note', title: pays ? 'Bigger overlays have paid more' : 'Bigger overlays have not paid more',
        body: `${esc(hi.key)}: ${spct(hi.ret)} on ${hi.n} (luck ±${pct(hi.luck)}); ${esc(lo.key)}: ${spct(lo.ret)} on ${lo.n} (luck ±${pct(lo.luck)}).`,
        go: { tab: 'slices', rows: 'eband', cols: 'side', f: {} },
        idea: pays ? null : { title: 'Is the overlay overstated?', ask: `On the paper account, overlays of ${hi.key} returned ${spct(hi.ret)} (${hi.n} bets) against ${spct(lo.ret)} for ${lo.key} (${lo.n} bets). Check whether the large overlays come from our number running high (calibration by band) or from stale prices, and test a cap on the overlay the stake can use, old against new with scripts/rule_test.py.${ASK_TAIL}` },
      });
    }
  }

  // stakes: did the bigger stakes do better than level stakes?
  if (g.n >= 30 && isNum(g.level) && isNum(g.ret)) {
    const better = g.ret > g.level;
    out.push({
      id: 'stakes', tone: better ? 'good' : 'note', title: better ? 'The stakes added to the return' : 'The stakes took from the return',
      body: `As staked ${spct(g.ret, 1)}; the same bets at level stakes ${spct(g.level, 1)} (luck ±${pct(g.levelLuck)}). ${better ? 'Larger stakes went on the better bets.' : 'Larger stakes went on bets that did worse than the small ones.'}`,
      go: { tab: 'results' },
      idea: { title: 'Optimise the stakes', ask: `On the paper account the return as staked is ${spct(g.ret, 1)} against ${spct(g.level, 1)} at level stakes (${g.n} settled). Test quarter Kelly against eighth Kelly, against level stakes and against a stake capped by confidence, old against new with scripts/rule_test.py, walk-forward with picks included; give each its return, luck band and worst fall from the top.${ASK_TAIL}` },
    });
  }

  // kept back against sent
  const kept = agg(all.filter((r) => r.set === 'kept'));
  const sentSince = agg(rows.filter((r) => r.day && r.day >= '2026-10-17' && r.kind === 'stat pick'));
  if (kept.n >= 5) {
    out.push({
      id: 'kept', tone: (kept.level || 0) > (sentSince.level || 0) ? 'note' : 'good', title: `Kept back ${spct(kept.level)} at level stakes`,
      body: `${kept.n} settled kept-back lines (10% to 20% above their price, or a third in a match): won ${pct(kept.wonPct)} where they needed ${pct(kept.needed)}; luck ±${pct(kept.levelLuck)}. Sent since 17 Oct: ${sentSince.n ? `${spct(sentSince.level)} at level on ${sentSince.n}` : 'none settled'}.`,
      go: { tab: 'results', set: 'kept' },
      idea: { title: 'Is the 20% send bar right?', ask: `Since the 20% send bar (17 Oct) the kept-back lines (10% to 20%) returned ${spct(kept.level)} at level stakes on ${kept.n} settled (luck ±${pct(kept.levelLuck)}) and the sent picks ${spct(sentSince.level)} on ${sentSince.n}. Test the bar at 10%, 15% and 20% old against new with scripts/rule_test.py, walk-forward with picks included, and tell me when the record will be large enough to decide.${ASK_TAIL}` },
    });
  }

  // builders
  const builders = agg(rows.filter((r) => r.kind && r.kind.startsWith('builder')));
  if (builders.n) {
    out.push({
      id: 'builders', tone: builders.profit >= 0 ? 'good' : 'bad', title: `Builders: ${builders.won} of ${builders.n} won`,
      body: `${money(builders.profit)} on ${money(builders.staked, '£', 0, false)} on paper. Builders are off the stakes since 15 Oct.`,
      go: { tab: 'slices', f: { kind: ['builder', 'builder, boosted'] }, rows: 'kind', cols: 'book' },
      idea: { title: 'A bet builder rule worth testing', ask: `Paper builders have won ${builders.won} of ${builders.n} (${money(builders.profit)}). Before any builder goes back on the stakes, build one rule from value legs only (each leg a stat pick at Stoiximan, the builder priced against our careful chances, its boost counted only when it applies), and test it old against new on the record with scripts/rule_test.py, walk-forward with picks included.${ASK_TAIL}` },
    });
  }

  // live suggestions
  const lv = agg(all.filter((r) => r.set === 'live'));
  if (lv.n >= 10) {
    out.push({
      id: 'live', tone: lv.level >= 0 ? 'good' : 'bad', title: `Live tests: ${spct(lv.level)} at level`,
      body: `${lv.n} settled live alerts and half-time tests: won ${pct(lv.wonPct)} where the prices needed ${pct(lv.needed)} and we said ${pct(lv.said)}.`,
      go: { tab: 'results', set: 'live' },
      idea: { title: 'Make the live bets earn their place', ask: `Live alerts and half-time tests: ${lv.n} settled, won ${pct(lv.wonPct)} against ${pct(lv.needed)} needed and ${pct(lv.said)} said (level ${spct(lv.level)}). Split them by game state (calm games against the rest), by minute and by stat, and test a stricter live bar old against new on the live record before anything is sent.${ASK_TAIL}` },
    });
  }

  // the price afterwards (the nearest thing to beating the closing price)
  const fs = all.filter((r) => r.set === 'first' && r.kind === 'stat pick' && isNum(r.beat));
  if (fs.length >= 20) {
    const beat = fs.filter((r) => r.beat > 0.005).length / fs.length;
    const drift = fs.filter((r) => r.beat < -0.005).length / fs.length;
    out.push({
      id: 'clv', tone: beat >= drift ? 'good' : 'bad', title: `${pct(beat)} of first showings beat the later price`,
      body: `Of ${fs.length} first showings with a later reading, the price shortened after ${pct(beat)} and drifted after ${pct(drift)}. A price that shortens after we take it is the earliest sign a pick was right.`,
      go: { tab: 'model' },
      idea: { title: 'Act earlier or later?', ask: `Of ${fs.length} first showings with a later price, ${pct(beat)} shortened afterwards and ${pct(drift)} drifted. Test the user's idea H44 (priority to picks nearer kick-off, against very late ones) from the fast lane's price log: by how long before kick-off a pick was shown, what the later price did and what the pick returned.${ASK_TAIL}` },
    });
  }

  // bookmakers side by side
  const books = group(rows, 'book').filter((x) => x.n >= 10 && x.key !== '(not known)');
  if (books.length >= 2) {
    const s = [...books].sort((a, b) => (b.ret ?? -9) - (a.ret ?? -9));
    out.push({
      id: 'books', tone: 'note', title: `${s[0].key} ${spct(s[0].ret)}, ${s[s.length - 1].key} ${spct(s[s.length - 1].ret)}`,
      body: s.map((x) => `${esc(x.key)}: ${spct(x.ret)} on ${x.n} (±${pct(x.luck)})`).join('; ') + '.',
      go: { tab: 'slices', rows: 'stat', cols: 'book', f: {} },
      idea: { title: 'Mask the value picks', ask: `By bookmaker the paper account reads ${s.map((x) => `${x.key} ${spct(x.ret)} on ${x.n}`).join(', ')}. Show what the camouflage has cost so far against the 4% budget (the covered trebles and the weekend cover bets), which picks a bookmaker would see as sharp, and propose a cheaper way to keep the Stoiximan account looking recreational, tested on paper first.${ASK_TAIL}` },
    });
  }

  // the bank's fall from its top
  return out;
}

// ------------------------------------------------------------------------------------------------- real money (euros)
// The tickets pasted from the bookmakers' own histories, never mixed with paper. Luck alone as the record counts it: the root
// of the sum of stake squared x (price - 1), over the stakes (a cash-out at its ticket's price, a free bet at no stake).

export function realSum(ts) {
  const done = ts.filter((t) => t.settled);
  let staked = 0, back = 0, varSum = 0;
  for (const t of done) {
    staked += t.cash || 0;
    back += t.back || 0;
    if (isNum(t.price) && t.price > 1) varSum += (t.cash || 0) ** 2 * (t.price - 1);
  }
  const n = done.length, ret = staked ? (back - staked) / staked : null, luck = staked ? Math.sqrt(varSum) / staked : null;
  const v = verdict(ret, luck, n);
  return { n, won: done.filter((t) => t.status === 'won').length, staked, back, profit: back - staked, ret, luck, verdict: v.word, z: v.z, more: v.more };
}

const eur = (v) => money(v, '€');
const eur0 = (v) => money(v, '€', 0, false);
const plural = (n, w, ws = `${w}s`) => `${n} ${n === 1 ? w : ws}`;

// "+€350 on €900 (+39%, luck ±18%: leaning ahead; 25 tickets, 8 won)"
export function realLine(s) {
  if (!s || !s.n) return 'none settled';
  return `${eur(s.profit)} on ${eur0(s.staked)} (${spct(s.ret)}${isNum(s.luck) ? `, luck ±${pct(s.luck)}: ${s.verdict}` : ''}; ${plural(s.n, 'ticket')}, ${s.won} won)`;
}

// a ticket's legs whatever the price and the order they were picked in (Superbet's "@ 1.90", Stoiximan's price lines)
const legKey = (s) => String(s || '').split(' | ').map((x) => x.replace(/@\s*[\d.]+/g, '').replace(/\s+/g, ' ').trim().toLowerCase())
  .filter((x) => x && !/^\d+\.\d{2}$/.test(x)).sort().join('|');
const minuteOf = (t) => (t.placed && t.placed.length >= 16 ? fromGreek(t.placed.slice(0, 16)).getTime() : null);

// the same ticket placed again (19 Oct 2026): one bookmaker, the same legs whatever the price, each within `minutes` of the one
// before; a risk team reads a run of them as a stake cap walked round
export function ticketStacks(tickets, { minutes = 15 } = {}) {
  const m = new Map();
  for (const t of tickets) {
    if (!t.selections) continue;
    const k = `${t.book}|${t.day || ''}|${legKey(t.selections)}`;
    if (!m.has(k)) m.set(k, []);
    m.get(k).push(t);
  }
  const out = [];
  for (const g of m.values()) {
    if (g.length < 2) continue;
    g.sort((a, b) => String(a.placed).localeCompare(String(b.placed)));
    let cur = [g[0]];
    const flush = () => { if (cur.length >= 2) out.push(stackOf(cur)); };
    for (const t of g.slice(1)) {
      const a = minuteOf(cur[cur.length - 1]), b = minuteOf(t);
      if (a !== null && b !== null && b - a > minutes * 6e4) { flush(); cur = [t]; } else cur.push(t);
    }
    flush();
  }
  return out.sort((a, b) => String(b.placed).localeCompare(String(a.placed)));
}

function stackOf(g) {
  const s = realSum(g), prices = g.map((t) => t.price).filter(isNum), st = [...new Set(g.map((t) => t.status))];
  return { key: g.map((t) => t.key).join(' '), book: g[0].book, placed: g[0].placed, day: g[0].day, legs: g[0].legs, group: g[0].group, source: g[0].source,
    selections: g[0].selections, copies: g.length, free: g.filter((t) => t.free).length, lo: prices.length ? Math.min(...prices) : null, hi: prices.length ? Math.max(...prices) : null,
    staked: g.reduce((x, t) => x + (t.cash || 0), 0), back: s.back, profit: s.profit, settled: s.n, status: st.length === 1 ? st[0] : 'mixed' };
}

// a ticket in a few words: its legs without the match lines' noise, for a sentence
export function shortTicket(sel, n = 90) {
  const parts = String(sel || '').split(' | ').filter((x) => !/^\d+\.\d{2}$/.test(x) && !/^Σκορ /.test(x) && x !== 'Bet Builder');
  const s = parts.join(', ');
  return s.length > n ? s.slice(0, n - 1) + '…' : s;
}

const COUNTED = new Set(['paid', 'approved']);
const dl = (d) => (d ? dayLabel(String(d).slice(0, 10), false) : '?');
// a span with its years where they are needed: "1 Jul to 1 Oct 2026", "20 Oct 2025 to 19 Oct 2026"
export const spanLabel = (a, b) => (String(a).slice(0, 4) === String(b).slice(0, 4) ? `${dl(a)} to ${dl(b)} ${String(b).slice(0, 4)}` : `${dl(a)} ${String(a).slice(0, 4)} to ${dl(b)} ${String(b).slice(0, 4)}`);

// what one bookmaker's own pages say about the account (logs/account_totals.csv and account_payments.csv through the feed's
// account_books), with its trail (the heat) and the runs of the same ticket: is there a cushion to spend?
export function ownBook(book, x, { heat = {}, stacks = [], payments = [], now = Date.now() } = {}) {
  const lines = [];
  const sports = (x.pnl || []).filter((p) => p.kind === 'sports');
  const year = [...sports].sort((a, b) => b.days - a.days)[0];
  const recent = sports.filter((p) => p !== year && p.days <= 120).sort((a, b) => String(b.to).localeCompare(String(a.to)))[0];
  const c = x.cash, h = heat[book] || {};
  if (year) {
    lines.push(year.net < 0
      ? `Down <b>${eur0(-year.net)}</b> on its books, ${spanLabel(year.from, year.to)} (${eur0(year.staked)} staked, ${spct(year.ret)}): it has made money from you.`
      : `Up <b>${eur0(year.net)}</b> on its books, ${spanLabel(year.from, year.to)} (${eur0(year.staked)} staked, ${spct(year.ret)}): it has paid you.`);
  }
  if (recent) {
    lines.push(`${spanLabel(recent.from, recent.to)}: ${recent.net >= 0 ? 'up' : 'down'} <b>${eur0(Math.abs(recent.net))}</b> on ${eur0(recent.staked)} staked (${spct(recent.ret)}).`
      + (year && year.net < 0 && recent.net > 0 && year.from <= recent.from && year.to >= recent.to ? ` Outside that span the year was ${eur(year.net - recent.net)}.` : ''));
  }
  let wd28 = 0, nwd28 = 0;
  if (c) {
    lines.push(`Cash: ${eur0(c.deposited)} in, ${eur0(c.withdrawn)} out${c.with_balance ? `, ${eur0(c.balance)} in the account (${dl(c.balance_on)})` : ''}: <b>${c.net >= 0 ? 'up' : 'down'} ${eur0(Math.abs(c.net))}</b> since ${dl(c.first)}.`);
    for (const p of payments) {
      if (p.book === book && p.kind === 'withdrawal' && COUNTED.has(p.status) && fromGreek(p.at).getTime() >= now - 28 * 864e5) { wd28 += p.amount; nwd28++; }
    }
    if (nwd28) lines.push(`${eur0(wd28)} taken out in the last 28 days (${plural(nwd28, 'withdrawal')}): a withdrawal is often when an account gets looked at.`);
  }
  if (h.sure) lines.push(`Its trail: <b>${esc(h.sure)}</b>${isNum(h.t) ? ` (${h.t.toFixed(2)})` : ''} that you beat its prices${isNum(h.with_price) ? `, from ${h.with_price} of the plan's bets read again` : ''}.`);
  const mine = stacks.filter((s) => s.book === book);
  if (mine.length) lines.push(`${plural(mine.length, 'run')} of the same ticket placed again (${mine.reduce((s, r) => s + r.copies, 0)} tickets, ${eur0(mine.reduce((s, r) => s + r.staked, 0))}).`);
  const up = (year && year.net > 0) || (c && c.net > 0), recentUp = recent && recent.net > 0, hot = isNum(h.t) && h.t >= 2;
  let tone = 'quiet', head = 'Too little pasted to tell';
  if (up) { tone = hot || nwd28 ? 'bad' : 'warn'; head = `No cushion: it is paying you${hot ? ' and can tell you beat its prices' : nwd28 ? ', and the money is coming out' : ''}`; }
  else if (year && year.net < 0) {
    tone = recentUp || hot ? 'warn' : 'note';
    head = recentUp || hot ? `Some cushion (it has made ${eur0(-year.net)} from you), but ${recentUp && hot ? 'the recent months and its trail say winner' : recentUp ? 'the recent months say winner' : 'its trail says you beat its prices'}`
      : `A cushion: it has made ${eur0(-year.net)} from you over the year`;
  }
  return { book, tone, head, lines, wd28, nwd28 };
}

const daysAgo = (n, now = Date.now()) => new Date(now - n * 864e5).toISOString().slice(0, 10);

// real money: what the tickets say. The first four go to the Ideas tab too; `full` gives the Money tab every one.
export function realInsights(tickets, { full = false, books = null } = {}) {
  const out = [];
  const done = tickets.filter((t) => t.settled);
  if (!done.length) return out;
  const sub = (f) => realSum(done.filter(f));
  const go = (o = {}) => ({ tab: 'money', moneyPart: 'money', ...o });

  // 1 the picks against your own reading; the paper-only picks (tennis, basketball, lines kept back) apart: not approved for
  // real money (the user's choice of 19 Oct 2026)
  const model = sub((t) => t.source === 'model'), part = sub((t) => t.source === 'part model'), own = sub((t) => (t.source || 'own') === 'own');
  const paper = sub((t) => t.source === 'paper pick' || t.source === 'part paper pick');
  if (model.n && own.n) {
    out.push({ id: 'real-model', tone: (model.ret ?? -9) >= (own.ret ?? -9) ? 'good' : 'note', title: `The model's real-money picks ${spct(model.ret)}, your own reading ${spct(own.ret)}`,
      body: `Every leg a real-money pick: ${realLine(model)}. Your own reading: ${realLine(own)}.${part.n ? ` Picks with legs of your own added: ${realLine(part)}.` : ''}${paper.n ? ` Paper-only picks placed anyway (not approved for real money): ${realLine(paper)}.` : ''}`,
      go: go({ moneyView: 'source' }),
      idea: { title: 'Follow the picks or your own reading?', ask: `Real money: tickets that followed the model's real-money picks made ${realLine(model)}; my own reading made ${realLine(own)}; picks with my own legs added ${realLine(part)}; paper-only picks placed anyway ${realLine(paper)}. Compare them fairly (stake sizes, legs, markets, sports) and tell me what the difference says.${ASK_TAIL}` } });
  }

  // 2 the same ticket placed again
  const stacks = ticketStacks(tickets);
  if (stacks.length) {
    const copies = stacks.reduce((s, x) => s + x.copies, 0), st = stacks.reduce((s, x) => s + x.staked, 0), pr = stacks.reduce((s, x) => s + x.profit, 0);
    const big = [...stacks].sort((a, b) => b.copies - a.copies || b.staked - a.staked)[0];
    const week = stacks.filter((x) => x.day && x.day >= daysAgo(7));
    out.push({ id: 'real-stacks', tone: 'note', title: `The same ticket placed again: ${plural(stacks.length, 'run')}${week.length ? `, ${week.length} this week` : ''}`,
      body: `${copies} tickets in runs of identical ones a few minutes apart, ${eur0(st)} staked, ${eur(pr)}. The longest: ${big.copies} at ${esc(big.book)} on ${dl(big.day)} (${esc(shortTicket(big.selections, 70))}). Bookmakers' reviews look for this: it reads as a stake cap walked round.`,
      go: { tab: 'money', moneyPart: 'accounts' },
      idea: { title: 'What placing again has cost', ask: `Real money: ${copies} tickets in ${stacks.length} runs of the same ticket placed again, ${eur0(st)} staked, ${eur(pr)}. Compare each run with placing once at the bookmaker's cap and the rest at another bookmaker's passing line, as the plan routes it, and say which bookmakers saw the most of it.${ASK_TAIL}` } });
  }

  // 3 outside football
  const sp = ['tennis', 'basketball'].map((k) => [k, sub((t) => t.sport === k)]).filter(([, s]) => s.n);
  if (sp.length) {
    const all = sub((t) => t.sport && t.sport !== 'football');
    out.push({ id: 'real-sports', tone: all.profit >= 0 ? 'good' : 'bad', title: sp.map(([k, s]) => `${cap(k)} ${s.won} of ${s.n} won`).join(', '),
      body: `${sp.map(([k, s]) => `${cap(k)}: ${realLine(s)}`).join('. ')}. The models' tennis and basketball picks are on paper, not approved for real money${(() => { const pp = sub((t) => t.sport !== 'football' && (t.source === 'paper pick' || t.source === 'part paper pick')); return pp.n ? `; the tickets that followed them: ${realLine(pp)}` : ''; })()}.`,
      go: go({ moneyView: 'sport' }),
      idea: { title: 'Real money outside football', ask: `Real money outside football: ${sp.map(([k, s]) => `${k} ${realLine(s)}`).join('; ')}. Set these tickets against the tennis and basketball paper records for the same days and markets, and tell me whether anything there has earned real money yet.${ASK_TAIL}` } });
  }

  // 4 builders
  const b = sub((t) => t.kind === 'builder');
  if (b.n >= 5) {
    const bm = sub((t) => t.kind === 'builder' && (t.source || 'own') !== 'own');
    out.push({ id: 'real-builders', tone: b.profit >= 0 ? 'good' : 'bad', title: `Builders: ${b.won} of ${b.n} won, ${eur(b.profit)}`,
      body: `${realLine(b)}.${bm.n ? ` With picks among their legs: ${realLine(bm)}.` : ''} The BB machine's builders run on paper (ledger/bb.md); builders are off the plan's stakes.`,
      go: go({ moneyView: 'kind' }),
      idea: { title: 'Builders with real money', ask: `Real money builders: ${realLine(b)}. Set them against the BB machine's paper builders (ledger/bb.md) for the same matches: which legs lost them, and would the machine's own builders have done better?${ASK_TAIL}` } });
  }

  // 5 long tickets
  const long = sub((t) => (t.legs || 0) >= 4);
  if (long.n >= 5) {
    out.push({ id: 'real-long', tone: long.profit >= 0 ? 'good' : 'bad', title: `Tickets of 4+ legs: ${long.won} of ${long.n} won`, body: `${realLine(long)}. Long parlays compound the bookmaker's margin once a leg.`,
      go: go({ moneyView: 'legs' }),
      idea: { title: 'What long parlays have cost', ask: `Real money: tickets of four or more legs ${realLine(long)}. Show the real tickets by number of legs and by group (model, stats, builders, fun, live) with what each cost, and suggest a plain limit I can keep to.${ASK_TAIL}` } });
  }

  // 6 stake size
  const big = sub((t) => (t.cash || 0) >= 50), small = sub((t) => (t.cash || 0) > 0 && t.cash < 50);
  if (big.n >= 5 && small.n >= 5) {
    out.push({ id: 'real-size', tone: (big.ret ?? -9) >= (small.ret ?? -9) ? 'good' : 'note', title: `Tickets of €50 and more ${spct(big.ret)}, smaller ones ${spct(small.ret)}`,
      body: `€50 and more: ${realLine(big)}. Under €50: ${realLine(small)}.`, go: go({ moneyView: 'size' }) });
  }

  // 7 long prices
  const longshot = sub((t) => isNum(t.price) && t.price >= 5), short = sub((t) => isNum(t.price) && t.price < 2.5);
  if (longshot.n >= 5) {
    out.push({ id: 'real-price', tone: longshot.profit >= 0 ? 'good' : 'bad', title: `Prices of 5.00 and over: ${longshot.won} of ${longshot.n} won`,
      body: `${realLine(longshot)}.${short.n ? ` Under 2.50: ${realLine(short)}.` : ''} A long price needs several legs to land: one big win can carry the rest.`, go: go({ moneyView: 'price' }) });
  }

  // 8 the biggest days, against the plan's 500 a match day
  const byDay = new Map();
  for (const t of done) if (t.day) { if (!byDay.has(t.day)) byDay.set(t.day, []); byDay.get(t.day).push(t); }
  const days = [...byDay].map(([d, ts]) => ({ day: d, ...realSum(ts) })).sort((a, b) => b.staked - a.staked);
  if (days.length >= 3) {
    const over = days.filter((d) => d.staked > 500);
    out.push({ id: 'real-days', tone: over.length ? 'note' : 'good', title: over.length ? `${plural(over.length, 'day')} over 500 staked` : 'No day over 500 staked',
      body: `The biggest: ${days.slice(0, 3).map((d) => `${dl(d.day)} ${eur0(d.staked)} on ${plural(d.n, 'ticket')}, ${eur(d.profit)}`).join('; ')}. The plan places at most 500 a match day (Superbet's list shows some tickets at the time they settled, so a late one can land on the next day).`,
      go: go({ moneyView: 'week' }) });
  }

  // 9 the last 7 days against before
  const wk = daysAgo(7), last = sub((t) => t.day && t.day >= wk), before = sub((t) => t.day && t.day < wk);
  if (last.n >= 5 && before.n >= 5) {
    out.push({ id: 'real-recent', tone: last.profit >= 0 ? 'good' : 'bad', title: `The last 7 days ${eur(last.profit)}`,
      body: `Since ${dl(wk)}: ${realLine(last)}. Before: ${realLine(before)}.`, go: go({ moneyView: 'week' }) });
  }

  // 10 cash-outs and free bets
  const cashed = done.filter((t) => t.status === 'cashed out');
  if (cashed.length >= 3) {
    const st = cashed.reduce((s, t) => s + (t.cash || 0), 0), bk = cashed.reduce((s, t) => s + (t.back || 0), 0);
    const atStake = cashed.filter((t) => Math.abs((t.back || 0) - (t.cash || 0)) < 0.01).length;
    out.push({ id: 'real-cashout', tone: 'note', title: `Cashed out ${plural(cashed.length, 'ticket')}: ${eur0(bk)} back on ${eur0(st)}`,
      body: `${atStake ? `${atStake} of them for exactly the stake. ` : ''}What a cashed-out ticket would have paid is not on the page, so the cost of cashing out is not known.`, go: go({ moneyView: 'groups' }) });
  }
  const free = done.filter((t) => t.free);
  if (free.length >= 3) {
    const bk = free.reduce((s, t) => s + (t.back || 0), 0);
    out.push({ id: 'real-free', tone: bk > 0 ? 'good' : 'note', title: `Free bets: ${free.filter((t) => t.status === 'won').length} of ${free.length} won, ${eur0(bk)} back`,
      body: `Face value ${eur0(free.reduce((s, t) => s + (t.stake || 0), 0))}; a free bet stakes nothing of yours, so all it returns is profit.`, go: go({ moneyView: 'size' }) });
  }

  // 11 how much of each account the pasted tickets hold
  for (const [book, x] of Object.entries((books && books.books) || {})) {
    const year = (x.pnl || []).filter((p) => p.kind === 'sports').sort((a, b) => b.days - a.days)[0];
    if (!year || !year.staked) continue;
    const mine = done.filter((t) => t.book === book && t.day && t.day >= year.from && t.day <= year.to);
    const st = mine.reduce((s, t) => s + (t.cash || 0), 0);
    out.push({ id: `real-cover-${book}`, tone: 'note', title: `The pasted tickets are ${pct(st / year.staked)} of ${book}'s year`,
      body: `${eur0(st)} of the ${eur0(year.staked)} ${esc(book)} counts as staked, ${spanLabel(year.from, year.to)} (${plural(mine.length, 'ticket')}). The real-money record is what was pasted; ${esc(book)}'s own page says ${eur(year.net)} over the span.`,
      go: { tab: 'money', moneyPart: 'accounts' } });
  }
  return full ? out : out.slice(0, 4);
}

// the standing menu of jobs to ask Claude, filled with the numbers in front of you
export function ideaMenu(D, rows, all) {
  const g = agg(rows);
  const kept = agg(all.filter((r) => r.set === 'kept'));
  const builders = agg(rows.filter((r) => r.kind && r.kind.startsWith('builder')));
  const live = agg(all.filter((r) => r.set === 'live'));
  const place = agg(all.filter((r) => r.set === 'placeable'));
  return [
    { id: 'stakes', title: 'Optimise the stakes', why: `Quarter Kelly now: ${spct(g.ret, 1)} as staked, ${spct(g.level, 1)} at level stakes on ${g.n} settled.`,
      ask: `Test quarter Kelly against eighth Kelly, half Kelly capped at 5% of the bank, level stakes and a stake scaled by confidence, old against new with scripts/rule_test.py, walk-forward on the paper account with picks included. Give each its return, luck band, worst fall from the top and the real-money amounts it would have placed under the 500 day cap and the bookmakers' caps.${ASK_TAIL}` },
    { id: 'mask', title: 'Mask the value picks', why: 'The covered treble and the weekend cover bet run on paper; the budget is 4% of the real-money stake.',
      ask: `Show what masking has cost so far (the covered trebles as laid against the plain doubles, the weekend cover bets) against the 4% budget, which of our bets look sharp to a bookmaker (stat lines, early, against the price), and propose two cheaper ways to keep the Stoiximan account looking recreational. Test them on paper first and tell me what each would cost a month.${ASK_TAIL}` },
    { id: 'builders', title: 'Bet builders', why: builders.n ? `Paper builders: ${builders.won} of ${builders.n} won, ${money(builders.profit)}.` : 'Builders are off the stakes since 15 Oct.',
      ask: `Build and test one bet builder rule (value legs only: each leg a stat pick, priced against our careful chances at Stoiximan's own builder price, boost only where it applies), old against new with scripts/rule_test.py on the record, walk-forward with picks included. Say what it would have staked and returned, and what the same legs did as singles and as a double.${ASK_TAIL}` },
    { id: 'bar', title: 'The send bar', why: kept.n ? `Kept back (10% to 20%): ${spct(kept.level)} at level on ${kept.n} settled.` : 'Only 20%+ picks are sent since 17 Oct.',
      ask: `Test the send bar at 10%, 15%, 20% and 25% above the price, and two or three picks a match, old against new with scripts/rule_test.py, walk-forward with picks included; include the kept-back record and say when it will be large enough to decide.${ASK_TAIL}` },
    { id: 'doubles', title: 'Doubles and parlays', why: 'The best three doubles a bookmaker are sent each run.',
      ask: `Compare the sent doubles and parlays with the same legs as singles on the record (return, luck band, how often both legs landed against the chance we gave), with the parlay's overlay on careful chances, and tell me whether doubles add anything beyond the singles.${ASK_TAIL}` },
    { id: 'routing', title: 'Caps and routing', why: place.n ? `As placeable: ${spct(place.ret)} on ${place.n} settled parts.` : 'Stoiximan caps fouls at 40 the day before and 60 on the day.',
      ask: `Show what the bookmakers' caps have cost: the capped part, the parts moved to another bookmaker's line and the parts in a double, against the same selections at paper stakes. Suggest a better routing between Stoiximan, Superbet and Pamestoixima within the 500 day cap, best value first, and test it on the record.${ASK_TAIL}` },
    { id: 'live', title: 'Live bets', why: live.n ? `Live tests: ${spct(live.level)} at level on ${live.n} settled.` : 'Live suggestions are on paper.',
      ask: `Go through the live record by game state (calm games against the rest), minute, stat and the size of the overvalue, and test a stricter live bar old against new before anything live is sent; tell me which live suggestions, if any, have earned a real stake.${ASK_TAIL}` },
    { id: 'timing', title: 'When to place', why: 'H44: priority to picks nearer kick-off.',
      ask: `Test H44 from the fast lane's price log: picks shown more than a day, 6 to 24 hours, 2 to 6 hours and under 2 hours before kick-off, what their prices did afterwards and what they returned, and whether placing nearer kick-off would have done better.${ASK_TAIL}` },
    { id: 'review', title: 'Weekly review now', why: 'The review runs itself on Mondays and only proposes.',
      ask: `Run the weekly review now and tell me in plain words what it proposes, with the evidence and the luck band for each proposal.` },
  ];
}

// questions worth asking, from what the record shows
export function questions(D, rows, all) {
  const out = [];
  const g = agg(rows);
  if (!g.n) return out;
  const stats = group(rows, 'stat').filter((x) => x.n >= 10 && x.key !== '(not known)' && x.key !== 'bet builder');
  const top = [...stats].sort((a, b) => (b.ret ?? -9) - (a.ret ?? -9))[0];
  const low = [...stats].sort((a, b) => (a.ret ?? 9) - (b.ret ?? 9))[0];
  if (top) out.push({ q: `Why have ${top.key} picks done best (${spct(top.ret)} on ${top.n})?`, ask: `Why have ${top.key} picks done best on the paper account (${spct(top.ret)} on ${top.n} settled, luck ±${pct(top.luck)})? Is it our number, the bookmakers' prices or luck? Show it by league and bookmaker.${ASK_TAIL}`, go: { tab: 'slices', f: { stat: [top.key] }, rows: 'comp', cols: 'side' } });
  if (low && low !== top) out.push({ q: `What is going wrong with ${low.key} (${spct(low.ret)} on ${low.n})?`, ask: `What is going wrong with ${low.key} picks (${spct(low.ret)} on ${low.n} settled, luck ±${pct(low.luck)})? Check where the counts landed against the line and our number, the bookmaker and the league.${ASK_TAIL}`, go: { tab: 'slices', f: { stat: [low.key] }, rows: 'comp', cols: 'side' } });
  const who = D.model?.who_forecasts?.brier;
  if (who) out.push({ q: 'Where do we forecast better than the bookmakers?', ask: `From who_forecasts.json and the bookmakers' lines, where does our number beat each bookmaker's chance (Brier, by stat and league), beyond luck, and where does it not? Suggest where to look for value next.${ASK_TAIL}`, go: { tab: 'model' } });
  out.push({ q: 'Are we placing at the right bookmaker?', ask: `For the picks of the last 7 days, compare the price we took with every bookmaker's price for the same line and say how much value was left on the table, best value first.${ASK_TAIL}`, go: { tab: 'slices', rows: 'stat', cols: 'book', f: {} } });
  out.push({ q: 'How big is our real edge once luck is taken out?', ask: `Estimate our real edge on the paper account with its uncertainty (bootstrap by match, not by bet), say how many more settled bets it needs to be clear of luck, and what bank growth to expect at the current stakes.${ASK_TAIL}`, go: { tab: 'results' } });
  return out;
}

// the view in words, for "Ask about this view"
export function describeView(S, g, extra = '') {
  const f = Object.entries(S.f || {}).map(([k, v]) => `${k} = ${v.join(' or ')}`).join('; ');
  return `Board view: ${S.tab}, ${S.sport}, set ${S.set}, range ${S.range}${S.range === 'custom' ? ` (${S.from} to ${S.to})` : ''}${f ? `, filters ${f}` : ''}. ` +
    (g && g.n ? `In it: ${g.n} settled, ${g.won} won, ${money(g.profit)} on ${money(g.staked, '£', 0, false)} (${spct(g.ret, 1)}, luck ±${pct(g.luck, 1)}, ${g.verdict}); won ${pct(g.wonPct)}, needed ${pct(g.needed)}, we said ${pct(g.said)}; ${g.open} open.` : 'Nothing settled in it.') + extra;
}
