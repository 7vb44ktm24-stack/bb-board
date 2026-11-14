// The morning digest (5 Nov 2026, the orchestrator's ask; planning/STRATEGY.md §2b row 1, the user's yes of 16:45): one BB Picks
// message a day made from the board's own feed, so it says what the board says: last night's results, the record, yesterday's
// runs, today's picks, what waits for the user, the alerts. Telegram's HTML (bold only), a line each, UK times, about a screen.
// scripts/digest.mjs prints it for scripts/morning_digest.py; the bot's "digest" answers the same (ask.js).
import { esc, money, plainMoney, pct, spct, isNum, ukHM, ukDay, dayLabel } from './util.js';
import { agg, onePerMatch } from './metrics.js';
import { bestRows, verdictWord } from './best.js';
import { provenLines, byMatch } from './proven.js';

const SETS = [                                                      // last night's sets, each its own record, never added together
  { set: 'placeable', label: 'Real-money plan (as placeable)', money: true },   // the plan's amounts, not the tickets placed
  { set: 'aces', label: 'Tennis aces test (real money)', money: true },
  { set: 'dftest', label: 'Tennis double faults test (real money)', money: true },
  { set: 'unproven', label: '🧪 Your call (sent unproven)', money: false },
  { set: 'paper', label: 'Paper account', money: true },
];
const TESTS = ['eu_throwins', 'eu_goalkicks', 'aces', 'df', 'mid_football', 'mid_tennis'];   // the real-money tests' records (best.js)
const t = (x) => Date.parse(x);
const short = (s) => String(s).split(/[:,(]/)[0].trim();            // a failed step's name, its first words

function settledLine(label, rows, withMoney) {
  const done = rows.filter((r) => r.status === 'won' || r.status === 'lost' || r.status === 'void');
  if (!done.length) return null;
  const won = done.filter((r) => r.status === 'won').length;
  const profit = done.reduce((s, r) => s + (isNum(r.profit) ? r.profit : 0), 0);
  return `• ${esc(label)}: ${done.length} settled, ${won} won${withMoney ? `, <b>${money(profit, '£', 2)}</b>` : ''}`;
}

export function lastNight(D, now, since) {
  const inWindow = (ms) => Number.isFinite(ms) && ms >= since && ms <= now;
  const out = [];
  for (const s of SETS) {
    const line = settledLine(s.label, D.bets.filter((b) => b.set === s.set && inWindow(b.kickAt instanceof Date ? b.kickAt.getTime() : t(b.kick))), s.money);
    if (line) out.push(line);
  }
  const T = (D.feed && D.feed.today) || {};
  const eu = (T.eu_test || []).filter((r) => r.won !== null && r.won !== undefined && inWindow(t(r.kick)));
  if (eu.length) {
    const p = eu.reduce((s, r) => s + (r.profit || 0), 0);
    out.splice(1, 0, `• European unders test (real money): ${eu.length} settled, ${eu.filter((r) => r.won).length} won, <b>${money(p, '£', 2)}</b>`);
  }
  const mids = (T.middles || []).filter((r) => r.settled && inWindow(t(r.start)));
  for (const r of mids) {
    const both = r.profit > 0.5 * ((r.over_stake || 0) + (r.under_stake || 0));
    out.splice(1, 0, `• Sure middle, ${esc(r.match)}: ${r.void ? `void (${esc(r.void)}), stakes back` : `${both ? 'both legs won' : 'one leg won'} on ${r.actual}, <b>${money(r.profit, '£', 2)}</b>`}`);
  }
  const ip = (T.inplay || []).filter((r) => r.status === 'sent' && (r.won === true || r.won === false) && inWindow(t(r.at)));
  if (ip.length) out.push(`• 🧪 In-play unders: ${ip.length} settled, ${ip.filter((r) => r.won).length} won`);
  return out;
}

export function record(D) {
  const H = (D.feed && D.feed.headline) || {};
  const S = H.sets || {};
  const out = [];
  const p = S['paper account'], f = S['first shown'];
  if (p && p.settled) {
    const w = verdictWord({ n: p.settled, return: p.return, luck: p.luck_alone });
    // one pick per stat and match first, the board's default (the user's correction of 9 Nov 2026), then every pick as the record keeps it (headline.json)
    const one = agg(onePerMatch(D.bets.filter((b) => b.sport === 'football' && b.set === 'paper'), { by: 'stat' }));
    if (one.n) out.push(`• Paper account, one pick per stat and match: ${one.n} settled, <b>${money(one.profit, '£', 0)}</b> on ${money(one.staked, '£', 0, false)} (${spct(one.ret)}, luck alone ±${pct(one.luck)}: ${esc(verdictWord({ n: one.n, return: one.ret, luck: one.luck }))})`);
    out.push(`• Paper account${one.n ? ', all picks' : ''}: ${p.settled} settled, <b>${money(p.profit, '£', 0)}</b> on ${money(p.staked, '£', 0, false)} (${spct(p.return)}, luck alone ±${pct(p.luck_alone)}: ${esc(w)})`
      + (f && isNum(f.return) ? `; first shown ${spct(f.return)}` : ''));
  }
  const plan = agg(D.bets.filter((b) => b.set === 'placeable'));
  if (plan.n) out.push(`• Real-money plan (as placeable): ${plan.n} settled, <b>${money(plan.profit, '£', 0)}</b> (${spct(plan.ret)}, luck ±${pct(plan.luck)}: ${esc(verdictWord({ n: plan.n, return: plan.ret, luck: plan.luck }))})`);
  const rows = bestRows(D.feed && D.feed.early_winners).filter((b) => TESTS.includes(b.id));
  for (const b of rows.filter((x) => x.row && x.row.n)) out.push(`• ${esc(b.label)}: ${b.row.n} settled, ${spct(b.row.return)} (${esc(verdictWord(b.row))})`);
  const none = rows.filter((x) => !(x.row && x.row.n)).map((b) => esc(b.label.replace(/ \(real money\)$/, '')));
  if (none.length) out.push(`• Nothing settled yet: ${none.join(', ')}`);
  return { lines: out, to: H.results_to };
}

export function runsLine(D, day) {
  const runs = ((D.feed && D.feed.runs) || []).filter((r) => r.day === day);
  if (!runs.length) return null;
  return runs.map((r) => `${r.start} ${isNum(r.minutes) ? `${r.minutes} min` : 'did not finish'}${(r.failed || []).length ? ` (failed: ${r.failed.map((x) => esc(short(x))).join(', ')})` : ''}`).join(' · ');
}

export function todayLines(D, now) {
  const day = ukDay(new Date(now));
  const open = (D.today || []).filter((p) => { const k = p.kickAt instanceof Date ? p.kickAt.getTime() : t(p.kick); return Number.isFinite(k) && k > now && ukDay(new Date(k)) === day; });
  const n = (v) => open.filter((p) => p.verdict === v).length;
  const out = [];
  if (!open.length) { out.push('• No pick open for today yet: the 09:00 run makes them.'); return out; }
  out.push(`• ${open.length} picks for today: ✅ ${n('BET')} to bet, 🧪 ${n('UNPROVEN')} your call, 📄 ${n('PAPER')} paper (the 09:00 run updates them)`);
  const by = new Map();
  for (const p of open) { const m = by.get(p.match) || { match: p.match, n: 0, bet: 0, k: p.kickAt instanceof Date ? p.kickAt : new Date(t(p.kick)) }; m.n++; if (p.verdict === 'BET') m.bet++; by.set(p.match, m); }
  const top = [...by.values()].sort((a, b) => b.bet - a.bet || b.n - a.n || a.k - b.k).slice(0, 3);
  out.push(`• The busiest: ${top.map((m) => `${esc(m.match)} ${ukHM(m.k)} (${m.n})`).join(', ')}`);
  return out;
}

// the internationals (the user's key workstream of 7 Nov 2026): the national-team matches still to come, the picks still to play and
// the sent set's record with its luck band by match (proven.js byMatch); nothing outside the break
export function intlLines(D, now) {
  const V = ((D.feed && D.feed.today) || {}).intl || {};
  const games = (V.matches || []).filter((m) => t(m.kick_utc) > now).sort((a, b) => t(a.kick_utc) - t(b.kick_utc));
  // the tiers in their order (the orchestrator's ask, 9 Nov 22:14): real, £1 learning, paper
  const mine = (D.bets || []).filter((b) => b.set === 'intl' || b.set === 'intllearn' || b.set === 'intlpaper');
  if (!games.length && !mine.length) return [];
  const open = mine.filter((b) => b.status === 'open'), of = (s) => open.filter((b) => b.set === s).length;
  const nx = games[0], R = byMatch(mine.filter((b) => b.set === 'intl'));
  const next = nx ? `, the next ${esc(nx.match)} ${esc(dayLabel(ukDay(nx.kick_utc) || '').slice(0, 3))} ${ukHM(nx.kick_utc)}` : '';
  const rec = R.n ? `real: ${R.n} settled in ${R.matches} match${R.matches === 1 ? '' : 'es'}, ${spct(R.return)} ±${pct(R.luck)} by match` : 'nothing settled yet';
  return [`• 🌍 Internationals: ${games.length} match${games.length === 1 ? '' : 'es'} to come${next}; ${open.length ? `🧪 ${of('intl')} real, ${of('intllearn')} £1 learning, 📄 ${of('intlpaper')} paper to play` : 'no pick open'}; ${rec}`];
}

// the in-play unders in real money, H127 and H123 each on its own (the user kept H127 real and watches it, 7 Nov 2026, after Live's
// replay of H127 at −8.4% ±6.5% on 126 matches; the orchestrator's ask): only the lines that went with a real stake (the board's
// `real`, live_unders_sent.csv's `stake`) at that stake and the sent price; picks, matches, the money, the return with its band by
// match; 🔴 once H127's real result is at −100 or worse (the auto-stop of the whole test stays at −200, inplay_unders)
export const H127_RED = -100;
export function inplayReal(D) {
  const out = [];
  for (const [set, label] of [['h127', 'H127 in-play throw-ins unders'], ['h123', 'H123 in-play fouls unders']]) {
    const rows = (D.bets || []).filter((b) => b.set === set && isNum(b.real) && b.real > 0);
    if (!rows.length) continue;
    const real = rows.map((b) => ({ ...b, stake: b.real,
      profit: b.status === 'won' ? b.real * (b.price - 1) : b.status === 'lost' ? -b.real : b.status === 'void' ? 0 : null }));
    const R = byMatch(real);
    const done = real.filter((b) => b.status === 'won' || b.status === 'lost');
    const profit = done.reduce((s, b) => s + b.profit, 0), staked = done.reduce((s, b) => s + b.stake, 0);
    const open = real.length - real.filter((b) => b.status === 'won' || b.status === 'lost' || b.status === 'void').length;
    const red = set === 'h127' && done.length > 0 && profit <= H127_RED;
    const said = R.n ? `${R.n} settled in ${R.matches} match${R.matches === 1 ? '' : 'es'}, <b>${money(profit, '€', 2)}</b> on ${plainMoney(staked, '€')}, ${spct(R.return)} ±${pct(R.luck)} by match`
      : 'nothing settled yet';
    out.push(`• ${red ? '🔴 ' : ''}${esc(label)}, real money: ${said}${open ? `; ${open} open` : ''}${red ? ` (past ${money(H127_RED, '€')}: the line you watch)` : ''}`);
  }
  return out;
}

// the day's decisions (planning/DECISIONS.md's rows of the day, the feed's `decisions`): a line each, five at most (the
// orchestrator's morning check of 7 Nov 2026: the tackles hold lifted that morning was on the board, not in the digest)
export function decided(D) {
  const X = ((D.feed && D.feed.decisions) || []).filter((x) => x && x.text);
  const cut = (s) => (s.length > 140 ? `${s.slice(0, 140).replace(/\s+\S*$/, '')}…` : s);
  return X.slice(0, 5).map((x) => `• ${esc(cut(String(x.text)))}`).concat(X.length > 5 ? [`• and ${X.length - 5} more (the board’s decisions card)`] : []);
}

// since yesterday (the orchestrator's ask of 8 Nov 2026, so its 07:00 recap retires): planning/DECISIONS.md's rows of yesterday and
// today, every row (what went live, the infrastructure too), newest first, a line each, five at most (board.py decisions_since)
export function sinceYesterday(D) {
  const X = ((D.feed && D.feed.decisions_since) || []).filter((x) => x && x.text);
  const cut = (s) => (s.length > 140 ? `${s.slice(0, 140).replace(/\s+\S*$/, '')}…` : s);
  return X.slice(0, 5).map((x) => `• ${esc(dayLabel(x.day, false))}: ${esc(cut(String(x.text)))}`)
    .concat(X.length > 5 ? [`• and ${X.length - 5} more (planning/DECISIONS.md)`] : []);
}

// the tests decided since yesterday (board.py tests_decided over planning/HYPOTHESES.md): each judged one with its verdict, then the
// new tests on paper and the retired ones on a line each kind; five lines at most
export function testsDecided(D) {
  const X = (D.feed && D.feed.tests_decided) || [];
  const cut = (s) => (s.length > 90 ? `${s.slice(0, 90).replace(/\s+\S*$/, '')}…` : s);
  const judged = X.filter((x) => x.kind === 'judged');
  const out = judged.slice(0, 4).map((x) => `• ${esc(x.id)} ${esc((x.verdict || 'judged').toLowerCase())}: ${esc(cut(String(x.title)))}`);
  if (judged.length > 4) out.push(`• and ${judged.length - 4} more judged`);
  const ids = (k) => X.filter((x) => x.kind === k).map((x) => esc(x.id));
  if (ids('new').length) out.push(`• New on paper: ${ids('new').join(', ')}`);
  if (ids('retired').length) out.push(`• Retired: ${ids('retired').join(', ')}`);
  return out;
}

export function waiting(D, now) {
  const P = (D.feed && D.feed.pending) || [];
  const stale = (x) => !!x.withdrawn_at || (x.added && now - t(x.added) > 3 * 864e5);
  const open = P.filter((x) => x.kind !== 'todo' && x.kind !== 'screen check' && !x.answered_at && !stale(x));
  const todo = P.filter((x) => x.kind === 'todo' && !x.done_at);
  const keys = (D.feed && D.feed.keys_missing) || [];
  const out = [];
  if (open.length) out.push(`• ${open.length} decision${open.length === 1 ? '' : 's'} for your yes: ${open.slice(0, 3).map((x) => `${esc(String(x.number ?? ''))}. ${esc(x.title)}`).join('; ')}${open.length > 3 ? '; …' : ''}`);
  const brief = (s) => { const x = String(s || '').split(/: run |, then /)[0]; return x.length > 70 ? `${x.slice(0, 70).replace(/\s+\S*$/, '')}…` : x; };
  if (todo.length) out.push(`• To do: ${todo.slice(0, 3).map((x) => esc(brief(x.title || x.label))).join('; ')}`);
  if (keys.length) out.push(`• Keys not saved yet: ${keys.map((k) => esc(k.for)).join(', ')}`);
  // the small settings the chats ask of the user (NEXT.md "**Setting for the user (<chat>, <d Mon>):**", board.py settings_waiting; 8 Nov 2026)
  for (const s of ((D.feed && D.feed.settings_waiting) || []).slice(0, 3)) out.push(`• To set: ${esc(s.what)}${s.who ? ` (${esc(s.who)}, ${esc(s.day)})` : ''}`);
  return out;
}

export function alerts(D, now) {
  const A = ((D.feed && D.feed.alerts_day) || []).filter((a) => now - t(a.at) <= 864e5);
  const seen = new Set(), words = [];
  for (const a of A) if (!seen.has(a.what)) { seen.add(a.what); words.push(a.what); }
  const st = (D.feed && D.feed.status) || {};
  const failed = Array.isArray(st.failed) ? st.failed : [];
  const out = [];
  if (st.status && st.status !== 'complete') out.push(`• The last run (${esc(String(st.run || '').slice(-4).replace(/(\d\d)(\d\d)/, '$1:$2'))}) ended ${esc(st.status)}${failed.length ? `: ${failed.map((x) => esc(short(x))).join(', ')}` : ''}`);
  // one line a kind: "A reader started with little memory free: the 13:00 and 17:00 runs"
  const kinds = new Map();
  for (const w of words) {
    const m = w.match(/^the (\d\d:\d\d) run(?:: | )(.+)$/);
    const k = m ? m[2] : w;
    if (!kinds.has(k)) kinds.set(k, []);
    if (m) kinds.get(k).push(m[1]);
  }
  for (const [k, times] of [...kinds].slice(0, 6)) {
    const said = k.charAt(0).toUpperCase() + k.slice(1);
    out.push(`• ${esc(said)}${times.length ? `: the ${times.join(' and ')} run${times.length > 1 ? 's' : ''}` : ''}`);
  }
  return out.concat(lanes(D, ukDay(new Date(now - 864e5))), onBoard(D));
}

// every lane on the board (board.py lane_check over fm/lanes.json, PA's proposal 1, the user's yes in DECISIONS 9590d17): a line a
// gap, its owner named, at most five and the rest counted; silent when every lane shows
export function onBoard(D) {
  const G = (D.feed && D.feed.lane_check) || [];
  const out = G.slice(0, 5).map((g) => `• On the board: ${esc(g.label)}: ${esc(g.what)}${g.owner ? ` (${esc(g.owner)})` : ''}`);
  if (G.length > 5) out.push(`• On the board: ${G.length - 5} more lanes with a gap`);
  return out;
}

// the lanes' passes that did not run (5 Nov 2026, the orchestrator's ask: basketball's skips went unseen), counted from each lane's
// own log (board.py lane_passes): a line a lane for `day`, "Basketball's reads before tip-off yesterday: 2 of 4 skipped (memory 1,
// the lock (refresh.py tennis) 1)", one kind said alone ("3 of 4 skipped (memory)"), silent when every pass ran
export function lanes(D, day, when = 'yesterday') {
  const sum = (o) => Object.values(o || {}).reduce((a, b) => a + b, 0);
  const said = (o) => {
    const e = Object.entries(o || {}).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
    return e.length === 1 ? esc(e[0][0]) : e.map(([k, n]) => `${esc(k)} ${n}`).join(', ');
  };
  const out = [];
  for (const x of ((D.feed && D.feed.lane_passes) || []).filter((r) => r.day === day)) {
    const bits = [];
    if (sum(x.skipped)) bits.push(`${sum(x.skipped)} of ${x.passes} skipped (${said(x.skipped)})`);
    if (sum(x.failed)) bits.push(`${sum(x.failed)} of ${x.passes} failed (${said(x.failed)})`);
    if (sum(x.not_sent)) bits.push(`${sum(x.not_sent)} read but not sent (${said(x.not_sent)})`);
    if (bits.length) out.push(`• ${esc(x.label)} ${when}: ${bits.join('; ')}`);
  }
  return out;
}

// the whole message: Telegram's HTML, a line each
export function digest(D, now = Date.now(), since = null) {
  const from = isNum(since) ? since : now - 864e5;
  const day = ukDay(new Date(now)), yesterday = ukDay(new Date(now - 864e5));
  const built = D.feed && D.feed.built_utc ? ` (the board built ${ukHM(D.feed.built_utc)})` : '';
  const R = record(D);
  const parts = [`☀️ <b>Good morning: ${esc(dayLabel(day))}</b>, ${ukHM(new Date(now))} UK${built}`];
  const night = lastNight(D, now, from);
  parts.push(`<b>Last night</b>\n${night.length ? night.join('\n') : '• Nothing settled since yesterday morning.'}`);
  const RL = [...R.lines, ...inplayReal(D)];                         // the in-play unders' real money, H127 apart (7 Nov 2026)
  if (RL.length) parts.push(`<b>The record</b>${R.to ? ` (results to ${esc(dayLabel(R.to, false))})` : ''}\n${RL.join('\n')}`);
  const F = provenLines(D);                                          // the focus lanes, how close to proven (6 Nov 2026, 0f4a4b2)
  if (F.length) parts.push(`<b>The focus lanes: how close to proven</b>\n${F.join('\n')}`);
  const SY = sinceYesterday(D);                                      // yesterday's and today's rows (8 Nov 2026); before the feed has
  const DC = D.feed && D.feed.decisions_since ? [] : decided(D);     // them, today's as before
  if (SY.length) parts.push(`<b>Since yesterday</b>\n${SY.join('\n')}`);
  if (DC.length) parts.push(`<b>Decided today</b>\n${DC.join('\n')}`);
  const TD = testsDecided(D);
  if (TD.length) parts.push(`<b>Tests decided</b>\n${TD.join('\n')}`);
  const runs = runsLine(D, yesterday);
  parts.push(`<b>Yesterday's runs</b>: ${runs || 'none logged'}`);
  parts.push(`<b>Today</b> (runs 09:00, 13:00, 17:00 UK)\n${[...todayLines(D, now), ...intlLines(D, now)].join('\n')}`);
  const W = waiting(D, now);
  if (W.length) parts.push(`<b>Waiting for you</b>\n${W.join('\n')}`);
  const A = alerts(D, now);
  if (A.length) parts.push(`<b>Alerts</b>\n${A.join('\n')}`);
  return parts.join('\n\n');
}
