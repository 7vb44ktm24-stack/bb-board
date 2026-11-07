// Today: what to place now (best first, every column the picks table carries), what is in play with its count so far,
// the day's doubles and fun parlays, then this week in one glance and the three things worth knowing.

import { esc, money, pct, spct, odds, num, isNum, until, greekDay, dayLabel, addDays, weekStart, fromGreek, load, ukHM, ukDay, ukStamp, stakeDayNote } from '../util.js';
import { bookChip, statusTag, signClass, section, goAttr, chips, recordLine, tierBadge } from '../ui.js';
import { agg, byDay } from '../metrics.js';
import { compName } from '../data.js';
import * as C from '../charts.js';
import { state as liveState, standing } from '../live.js';
import { insights } from '../insights.js';
import { rowsOf, byWho } from '../lines.js';
import { guideCard } from './guide.js';
import { nbaCard } from './nba.js';
import { acesCard } from './aces.js';
import { moreCard, parityCard } from './more.js';
import { moreView, eventsCard } from './viewscore.js';
import { justifyHtml, partsFor } from '../justify.js';
import { bestRows, verdictWord } from '../best.js';
import { playerCard } from '../players.js';

const SORTS = [{ id: 'best', label: 'Best first' }, { id: 'kick', label: 'By kick-off' }];

// the BB Picks bot's name (the feed's), for the Placed button's link: none, no button
let BOT = null;
export function setBot(name) { BOT = name || null; }
let TIER_ON = false, TIER_STATUS = null;                                               // the feed's tier_on and tier_status (fm/tier_badge.py): live since the user's yes of 31 Oct, labelled unproven
let BOARD = null;                                                                       // the board's data, for "Why this pick?" (justify.js partsFor, 5 Nov 2026)
// placed or not: the record's taps (the slip's buttons and the board's), and a tap from this phone the feed has not caught up with
function placedControl(p) {
  if (!BOT || !p.tap || p.wait) return '';
  if (p.mine) return `<div class="pick-placed"><span class="tag tag-placed">✓ placed${p.mine_at ? ` ${esc(ukHM(p.mine_at))}` : ''}</span>${p.mine_as ? `<span class="small">as ${esc(p.mine_as)}: the same bet, don't place it again</span>` : `<button type="button" class="link small" data-unplace="${esc(p.tap)}">undo</button>`}</div>`;
  const local = (load('placedLocal', {}) || {})[p.tap];
  if (local && Date.now() - local < 30 * 60e3) return `<div class="pick-placed"><span class="tag">✓ sent to the bot: shows here at the next update</span></div>`;
  return `<div class="pick-placed"><button type="button" class="btn-soft" data-place="${esc(p.tap)}">Mark placed</button><span class="muted small">logs it through the BB Picks bot, as the slip’s ▢ does</span></div>`;
}

function overlayAt(ours, price) { return isNum(ours) && isNum(price) ? ours * price - 1 : null; }

// the same view's safer line (fm.page.safer_line, the user's choice of 19 Oct 2026, T7): the nearest line on the safe side at
// its best price, 3%+ over it; shown only, never staked or counted (one view, one pick)
export function saferLine(p) {
  const s = p.safer;
  if (!s || !isNum(s.price)) return '';
  const ov = isNum(s.ov) ? s.ov / 100 : overlayAt(p.ours, s.price);
  return `<div class="rivals"><span class="rival">⤵ safer: ${esc(s.pick || '')} ${bookChip(s.at)} ${odds(s.price)} <span class="${signClass(ov)}">${spct(ov)}</span></span><span class="muted small">shown only, not staked</span></div>`;
}

// a builder's price at the other bookmaker for the same legs, its overlay on the same careful chance
function bbRivals(x) {
  const r = (x.rivals || []).filter((o) => o.book && o.book !== x.book && isNum(o.price));
  return r.length ? `<div class="rivals">${r.map((o) => `<span class="rival">${bookChip(o.book)} ${odds(o.price)} <span class="${signClass(overlayAt(x.chance, o.price))}">${spct(overlayAt(x.chance, o.price))}</span></span>`).join('')}<span class="muted small">same legs</span></div>` : '';
}

// a pick at a hot account (data.heatOf, 19 Oct 2026): what that bookmaker can read already, and any rival priced as well (best
// value first: a rival is named, the pick is never moved)
function heatNote(p) {
  const h = p.heat;
  const same = (p.rivals || []).filter((r) => r.book && r.book !== p.book && isNum(r.price) && isNum(p.price) && r.price >= p.price * 0.97);
  const kind = h.kind && isNum(h.cut) && h.bets >= 3 ? `; its ${esc(h.kind)} was cut after ${pct(h.cut)} of ${h.bets} bets` : '';
  return `<div class="pick-heat"><button type="button" class="tag tag-warn" ${goAttr({ tab: 'money', moneyPart: 'accounts' })}>hot account</button><span class="small">${esc(h.book)} can be ${esc(h.sure || 'fairly sure')} (${h.t.toFixed(2)}) that you beat its prices${kind}.${same.length
    ? ` Priced as well at ${same.map((r) => `${esc(r.book)} ${odds(r.price)}`).join(', ')}.` : ''}</span></div>`;
}

// one verdict a pick (fm.verdict, the user's ask of 27 Oct 2026: "Should I bet or not? Need to be clear in each pick I see"): at the
// top of every card, a chip on every line; ✅ BET, 📄 PAPER (don't bet) or ⛔ DON'T BET, with its reason
const V_CLASS = { BET: 'v-bet', PAPER: 'v-paper', "DON'T BET": 'v-stop', UNPROVEN: 'v-unproven' };   // 🧪 unproven: your call (31 Oct 2026)
// the amount on top of a pick (31 Oct 2026, DECISIONS 77d8a88): the plan's real money; about the match day's while it waits;
// a pick outside the plan (another sport, a lane on paper) its stake
// the plan's own stake beside the paper one (31 Oct 2026, Rest's changes from the 13:00 run): ●●● at 100 a pick, the level
// picks at half the plan's stake (their own record), any other plan stake that differs from the pick log's
export function planNote(p) {
  return p.plan_set === 'top' && isNum(p.plan_stake) ? ` · ●●● plan ${money(p.plan_stake, '£', 0, false)}`
    : p.plan_set === 'level' ? ' · level, half stake'
      : p.plan_set === 'plan' && isNum(p.plan_stake) ? ` · plan ${money(p.plan_stake, '£', 0, false)}` : '';
}
export function amountOf(p) {
  // only a ✅ BET card shows a bare money amount (the orchestrator, 1 Nov 2026, on the user's "Amount £88" under a test pick): a
  // 📄 PAPER card says "paper £25", a ⛔ DON'T BET one "not to bet", in every sport; a unit record (stake 1) says no £
  const paper = isNum(p.stake) && p.stake > 1 ? `paper ${money(p.stake, '£', 0, false)}` : 'its own record';
  if (p.verdict === "DON'T BET") return { v: 'not to bet', sub: paper };
  if (p.verdict === 'PAPER') return { v: isNum(p.stake) && p.stake > 1 ? paper : 'paper', sub: isNum(p.stake) && p.stake > 1 ? 'no real money' : 'its own record' };
  // a later day's pick the preview gives nothing (31 Oct 2026: eight of Sunday's read "~£0" under ✅): none as things stand,
  // the match day's run decides; the verdict stays the system's
  if (p.wait && isNum(p.would_place) && p.would_place <= 0) return { v: 'none yet', sub: `${isNum(p.capped_at) ? 'its cap' : 'day cap: better picks first'}${planNote(p)}` };
  if (p.wait) return { v: isNum(p.would_place) ? `~${money(p.would_place, '£', 0, false)}` : '⏳', sub: `on the match day${isNum(p.would_place) && isNum(p.capped_at) ? ' (its cap)' : ''}${planNote(p)}` };
  // one view, one pick across the day's runs (fm/one_view.py, 31 Oct 2026): an earlier instruction at another line or bookmaker
  // makes this the same bet, "in all", never a second amount on top
  if (isNum(p.place) && p.place > 0 && p.moved_from) return { v: `${money(p.place, '£', 0, false)} in all`, sub: p.moved_from.kind === 'level' ? `a level pick went out ${esc(p.moved_from.at || '')}` : `moved since our ${esc(p.moved_from.at || '')} pick` };
  if (isNum(p.place)) return { v: money(p.place, '£', 0, false), sub: (p.place > 0 ? 'real money' : 'no real money') + planNote(p) };
  // a tennis real-money test's pick: the test's own logged stake is the amount, the paper stake only beside it (1 Nov 2026: "BET
  // 20 at Superbet (the double-faults test)" sat above "Amount £88", the paper stake; the user places the amount)
  if (isNum(p.real) && p.real > 0) return { v: money(p.real, '£', 0, false), sub: `real money, ${esc(p.real_test || 'the aces test')}${isNum(p.stake) ? ` · paper ${money(p.stake, '£', 0, false)}` : ''}` };
  // sent unproven: the amount is the user's call; a record kept in units (basketball's counts, 1 a pick) shows no "£1" (31 Oct 2026)
  if (p.verdict === 'UNPROVEN') return { v: 'your call', sub: isNum(p.stake) && p.stake > 1 ? `paper ${money(p.stake, '£', 0, false)}` : 'its own record' };
  if (extraLeague(p)) return { v: '–', sub: 'paper: its own record' };   // under its bar now: one unit a pick in its record, no "£1"
  return { v: money(p.stake, '£', 0, false), sub: 'stake' };
}
// the extra leagues' picks sent unproven (board.today_more, the user's "start including them ... as leagues ready", 31 Oct 2026)
export const extraLeague = (p) => String(p.kind || '').startsWith('extra leagues');
// the 1-3 score as Today shows it, for the game page (the feed's own switch, so it shows before Today was opened)
export function scoreBadge(p, feedToday) {
  const t = feedToday || {};
  return tierBadge(p, !!t.tier_on, t.tier_status || null);
}

export function verdictBar(p) {
  if (!p.verdict_label) return '';
  return `<div class="verdict ${V_CLASS[p.verdict] || 'v-paper'}"><b>${esc(p.verdict_label)}</b>${p.verdict_why ? `<span>${esc(p.verdict_why)}</span>` : ''}</div>`;
}
export function verdictChip(p) {
  return p.verdict_label ? `<span class="vchip ${V_CLASS[p.verdict] || 'v-paper'}">${esc(String(p.verdict_label).split(',')[0])}</span>` : '';
}

export function pickCard(p, now) {
  const J = partsFor(p, BOARD);                                     // "Why this pick?" (football's from the feed, basketball's built here)
  const kick = p.kickAt ? p.kickAt.getTime() : null;
  const started = kick !== null && kick <= now;
  const live = liveState.get(p.key);
  const stand = live ? standing(p, live) : null;
  // the other bookmakers, and (basketball and tennis, 22 Oct 2026) the same view at another line: one card a view, never two
  const rivals = (p.rivals || []).filter((r) => r.book && (r.book !== p.book || (isNum(r.line) && r.line !== p.line)));
  const moved = (p.moved || []).filter((m) => m && m.at);
  const sentTag = (p.keyval ? '<span class="tag tag-key" title="Marked as the key value of the run">key value</span>' : '')
    + (p.fast ? '<span class="tag tag-fast" title="Found by the half-hourly fast lane">fast lane</span>' : p.sent ? '<span class="tag">sent</span>' : '');
  const gone = p.gone ? '<span class="tag tag-warn" title="The fast lane found this price gone">price gone</span>' : '';
  // one score on top (the user, 31 Oct 2026, DECISIONS 77d8a88): signals, the run's tags and the top check in the card's
  // details, still shown; the top keeps the verdict, the 1-3 score, the price, overlay and amount. Confidence (High, Medium, Low)
  // retired for the 1-3 score the same morning (the user, about 07:40 UK): never shown
  const measures = `${isNum(p.signals) ? `<span class="tag">${p.signals} signal${p.signals === 1 ? '' : 's'}</span>` : ''}${sentTag}`
    // 🎯 the stat's sharp book, 📏 the books' games length (tennis aces and double faults): in the details, never in the score
    // (Rest's columns, the user's choices of 31 Oct 2026; each its own record on Results)
    + (p.sharp ? `<span class="tag${p.sharp === 'agrees' ? ' tag-fast' : ''}"${p.sharp_why ? ` title="${esc(p.sharp_why)}"` : ''}>🎯 sharp book: ${esc(p.sharp)}</span>` : '')
    + (p.length ? `<span class="tag${p.length === 'agrees' ? ' tag-fast' : ''}">📏 the books’ length ${esc(p.length)}</span>` : '');
  const changed = isNum(p.first_price) && isNum(p.price) && Math.abs(p.first_price - p.price) >= 0.01 ? `<span class="muted small">first ${odds(p.first_price)}</span>` : '';
  const liveBlock = live && live.state !== 'pre' ? `
    <div class="live-row">
      <span class="live-dot${live.state === 'in' ? ' on' : ''}" aria-hidden="true"></span>
      <b>${esc(live.score)}</b><span class="muted">${esc(live.clock)}</span>
      ${live.so !== null ? `<span class="live-count"><b>${num(live.so, 0)}</b> so far${isNum(live.heading) && live.state === 'in' ? `, heading for <b>${num(live.heading, 1)}</b>` : ''} · line ${num(p.line)}</span>` : '<span class="muted small">count not on the live feed</span>'}
      ${stand ? `<span class="pill pill-${stand.tone}">${esc(stand.word)}</span>` : ''}
    </div>
    ${live.so !== null ? progress(p, live) : ''}` : '';
  return `<article class="pick" data-key="${esc(p.key)}">
    ${verdictBar(p)}
    <div class="pick-top">
      <span class="kick">${p.kick ? esc(ukHM(p.kick)) : '–'}<span class="muted"> · ${started ? (live && live.state === 'in' ? 'in play' : 'started') : until(kick - now)}${stakeDayNote(p.kick) ? ` · ${esc(stakeDayNote(p.kick))}` : ''}</span></span>
      <span class="pick-tags">${gone}</span>
    </div>
    <button type="button" class="pick-title" data-match="${esc(p.match)}">${esc(p.match)} <span class="muted small">${esc(compName(p.comp))}</span></button>
    <div class="pick-bet"><span>${tierBadge(p, TIER_ON, TIER_STATUS)}${p.plan_set === 'level' ? '<span class="tier" title="A level pick: in the real-money plan at half stake, its own record (unproven)">🧪 level</span>' : ''}${extraLeague(p) ? '<span class="tier" title="The extra leagues: a lane still proving itself, its own record (Extra leagues on Results), never in the real-money plan">🧪 extra leagues</span>' : ''}${p.kind === 'line-gap single' && !isNum(p.tier) ? '<span class="tier t3" title="Not scored: a line-gap single (rule D on them is on Monday’s list)">—</span>' : ''}${esc(p.bet)}</span>${bookChip(p.book, { go: { tab: 'slices', f: { book: [p.book] }, rows: 'stat', cols: 'side' } })}${p.url && /^https:\/\/(www\.stoiximan\.gr|superbet\.gr)\//.test(p.url) ? `<a class="link small" href="${esc(p.url)}" target="_blank" rel="noopener">open at ${esc(p.book)} ↗</a>` : ''}</div>
    <div class="pick-grid g3">
      <div><small>Price</small><b>${odds(p.price)}</b>${changed}${p.stale ? `<span class="small muted">${esc(p.stale)}</span>` : ''}${isNum(p.over_price) ? `<span class="small muted">the over ${odds(p.over_price)}</span>` : ''}</div>
      <div><small>Overlay</small><b class="${signClass(p.edge)}">${spct(p.edge)}</b></div>
      <div><small>Amount</small><b>${amountOf(p).v}</b><span class="small muted">${amountOf(p).sub}</span></div>
    </div>
    ${rivals.length ? `<div class="rivals">${rivals.map((r) => {
    const other = isNum(r.line) && isNum(p.line) && r.line !== p.line;          // another line of the same view: its own overlay
    const ov = isNum(r.edge) ? r.edge : overlayAt(p.ours, r.price);
    return isNum(r.price)
      ? `<span class="rival">${bookChip(r.book)}${other ? ` <span class="muted">${esc(r.way || p.side || '')} ${num(r.line, 1)}</span>` : ''} ${odds(r.price)} <span class="${signClass(ov)}">${spct(ov)}</span>${r.stale ? ` <span class="muted small">${esc(r.stale)}</span>` : ''}${r.earlier ? ` <span class="muted small">earlier, ${esc(String(r.earlier).slice(5))}</span>` : ''}</span>`
      : `<span class="rival">${bookChip(r.book)} <span class="muted">line ${num(r.line, 1)}</span></span>`;
  }).join('')}</div>` : ''}
    ${saferLine(p)}
    ${p.place_at ? `<div class="moved"><span>${esc(p.place_at)}</span></div>` : ''}
    ${moved.length ? `<div class="moved">${moved.map((m) => `<span>↪ ${money(m.place, '£', 0, false)} at ${bookChip(m.at)} ${esc(m.bet || '')} ${odds(m.price)}</span>`).join('')}</div>` : ''}
    ${liveBlock}
    ${placedControl(p)}
    <details class="why"><summary>${J ? 'Why this pick?' : 'Why, the checks and the rest'}</summary>
      ${J ? `${justifyHtml(p, J, now)}<h4 class="jrest">The checks and the rest</h4>` : ''}
      ${measures ? `<div class="pick-measures">${measures}</div>` : ''}
      ${p.top_check ? `<p class="small ${p.top_check.startsWith('Top pick: checked') ? 'pos' : 'neg'}" style="margin:0">${esc(p.top_check)}</p>` : ''}
      ${p.side_conf ? `<p class="small muted" style="margin:0">${esc(p.side_conf)}</p>` : ''}
      ${p.sharp_why ? `<p class="small muted" style="margin:0">${esc(p.sharp_why)}</p>` : ''}
      ${isNum(p.edge2) ? `<p class="small muted" style="margin:0">The second test, the overlay on the Poisson count: <b class="${signClass(p.edge2)}">${spct(p.edge2)}</b></p>` : ''}
      <div class="pick-chance">
        ${chanceBar(p.ours, p.needs, p.bookp, p.one_sided)}
        <div class="pick-levels">${isNum(p.expected) ? `We expect <b>${num(p.expected, 1)}</b>, they price <b>${num(p.theirs, 1)}</b> · ` : ''}fair ${odds(p.fair)} · ${extraLeague(p) ? 'one unit a pick (its own record)' : p.plan_set === 'level' ? `level stake ${money(p.stake, '£', 2, false)} (half the usual stake; its own record)` : `paper stake ${money(p.stake, '£', 2, false)}${isNum(p.plan_stake) ? ` · the plan’s ${money(p.plan_stake, '£', 0, false)}${p.plan_set === 'top' ? ' (●●●)' : ''}` : ''}`}</div>
      </div>
      ${p.b365 ? `<p class="muted small">${bookChip('bet365')} ${esc(p.b365)}</p>` : ''}
      ${p.pame ? `<p class="muted small">${bookChip('Pamestoixima')} ${esc(p.pame)}</p>` : ''}
      ${p.heat && !started ? heatNote(p) : ''}
      ${p.counted ? `<p class="muted small">Counted once in the record, as first shown: ${esc(p.counted.bet || '')} at ${esc(p.counted.book || '')} ${odds(p.counted.price)} (${spct(p.counted.edge)}), ${esc(String(p.counted.shown || '').slice(5))}.</p>` : ''}
      <p>${esc(p.why || 'No reason saved.')}</p>
      ${isNum(p.ours) && p.sport === 'football' && !extraLeague(p) ? `<p class="small">Still over the 20% send bar down to <b>${odds(1.2 / p.ours)}</b>; break-even on our chance at ${odds(1 / p.ours)}.</p>` : ''}
      <p class="muted small">Shown ${p.runs > 1 ? `${p.runs} times, first at ${esc(p.first_at || '')} at ${odds(p.first_price)}` : `at ${esc(p.shown || '')}`}${p.read ? `; price read ${esc(ukStamp(p.read))}` : ''}. The bookmaker's own chance ${pct(p.bookp)}.</p>
      <div class="why-links">
        <button type="button" class="link" ${goAttr({ tab: 'slices', f: { stat: [p.stat], side: [p.side] }, rows: 'book', cols: 'comp' })}>How ${esc(p.stat)} ${esc(p.side)} has done</button>
        <button type="button" class="link" data-match="${esc(p.match)}">Everything on this match</button>
      </div>
    </details>
  </article>`;
}

// the pre-game view (scripts/pregame_view.py, lane L, the user's of 21-22 Oct 2026): each match a row a team and a match total,
// every stat ours / the bookmaker's level, the gap judged on the count's spread (🟢 0.6 and over, 🟡 0.4), ▼ we expect fewer,
// ▲ more, ⚠️ untested (the conversions always: H68), 🔀 the total agrees but the teams' shares do not
const PG_EMOJI = { big: '🟢', some: '🟡' };
// a match's name as a tap to its sheet (the pre-game table, the picks, the record): every card that names a match opens it (23 Oct
// 2026: the gap slip's legs, the gap builders, the ideas and the angles named one and opened nothing)
const mLink = (match) => `<button type="button" class="link" data-match="${esc(match)}">${esc(match)}</button>`;
const PG_ARROW = { down: '▼', up: '▲' };
function pgCell(c, split, d = 1) {
  if (!c) return '<td class="muted">–</td>';
  const others = Object.entries(c.books || {}).filter(([b]) => b !== c.book).map(([b, v]) => `${b} ${num(v, d)}`).join(' · ');
  const gap = c.mark ? ` <span class="pg-gap">${PG_EMOJI[c.mark]}${PG_ARROW[c.arrow]}${num(Math.abs(c.diff), d)}</span>` : '';
  return `<td title="${esc(`${c.book || ''}${others ? `; also ${others}` : ''}`)}"><b>${num(c.ours, d)}</b> / ${isNum(c.theirs) ? num(c.theirs, d) : '–'}${gap}${split ? ' 🔀' : ''}</td>`;
}
function pgConv(c) {
  if (!c) return '<td class="muted">–</td>';
  return `<td>${pct(c.ours)} / ${pct(c.theirs)}${c.mark ? ` <span class="pg-gap">${PG_EMOJI[c.mark]}${PG_ARROW[c.arrow]}${Math.round(Math.abs(c.diff) * 100)}</span>` : ''}</td>`;
}
// basketball's and tennis's views (the R14 task, 23 Oct 2026) share the table: no goals column, a stat's own digits (tennis's sets
// and tie-breaks two), the builder idea of two or more marked gaps at one bookmaker under it (paper)
export function pregameTable(m, stats) {
  const label = Object.fromEntries((stats || []).map((s) => [s.id, s.label]));
  const digits = Object.fromEntries((stats || []).map((s) => [s.id, s.digits || 1]));
  const cols = (stats || []).map((s) => s.id).filter((id) => m.rows.some((r) => r.cells[id]));
  const convs = ['accuracy', 'finishing'].filter((k) => m.rows.some((r) => r.conv && r.conv[k]));
  const split = new Set((m.splits || []).map((s) => s.stat));
  const goals = m.rows.some((r) => 'goals' in r && r.goals !== null);
  const untested = (id) => m.rows.some((r) => r.cells[id] && !r.cells[id].tested);
  const head = `<tr><th></th>${goals ? '<th>Goals</th>' : ''}${cols.map((id) => `<th>${esc(label[id] || id)}${untested(id) ? ' ⚠️' : ''}</th>`).join('')}${convs.map((k) => `<th>${k === 'accuracy' ? 'On target per shot' : 'Goals per on target'} ⚠️</th>`).join('')}</tr>`;
  const body = m.rows.map((r) => `<tr${r.row === 't' ? ' class="pg-total"' : ''}><th>${esc(r.team)}</th>${goals ? `<td>${isNum(r.goals) ? num(r.goals, 2) : '–'}</td>` : ''}${cols.map((id) => pgCell(r.cells[id], r.row === 't' && split.has(id), digits[id])).join('')}${convs.map((k) => pgConv(r.conv && r.conv[k])).join('')}</tr>`).join('');
  const notes = (m.splits || []).map((s) => `<li>🔀 ${esc((label[s.stat] || s.stat).toLowerCase())}: the match total agrees; ${esc(s.down)} under, ${esc(s.up)} over <span class="muted">(paper)</span></li>`).join('');
  const combo = m.combo ? `<li>🧩 at ${esc(m.combo.book)}: ${esc(m.combo.legs.map((l) => `${l.row === 't' ? 'match' : l.team} ${(label[l.stat] || l.stat).toLowerCase()} ${l.way} (ours ${num(l.ours, 1)}, theirs ${num(l.theirs, 1)})`).join(' + '))} <span class="muted">(builder idea: paper)</span></li>` : '';
  const note = m.note ? `<li class="muted">${esc(m.note)}</li>` : '';   // e.g. basketball's "no Pamestoixima counts yet" (27 Oct 2026)
  return `<div class="pg-wrap"><table class="pg">${head}${body}</table></div>${notes || combo || note ? `<ul class="plain small">${notes}${combo}${note}</ul>` : ''}`;
}
function pgLine(m, stats) {
  const label = Object.fromEntries((stats || []).map((s) => [s.id, s.label]));
  const gaps = [];
  for (const r of m.rows) for (const [id, c] of Object.entries(r.cells)) if (c.mark) gaps.push({ r, id, c });
  gaps.sort((a, b) => Math.abs(b.c.sd) - Math.abs(a.c.sd));
  const said = gaps.slice(0, 3).map((g) => `${PG_EMOJI[g.c.mark]} ${esc(g.r.row === 't' ? 'match' : g.r.team)} ${esc((label[g.id] || g.id).toLowerCase())} ${PG_ARROW[g.c.arrow]}${num(Math.abs(g.c.diff), 1)}`);
  return `<button type="button" class="bet-line" data-match="${esc(m.match)}"><span class="bl-main"><span class="bl-bet">${esc(m.match)}</span><span class="bl-match muted">${esc(dayLabel(ukDay(m.kick) || '').slice(0, 3))} ${esc(ukHM(m.kick))} · ${esc(compName(m.comp))} · ${said.length ? said.join(' · ') : 'no big gap'}${(m.splits || []).length ? ' · 🔀' : ''}</span></span></button>`;
}

// NHL and basketball, each its own folded section (the user, 4 Nov 2026 about 06:00 UK: "start flowing picks and stats for the NHL in
// the dashboard, and the NBA, and expand picks"): the sport's picks still to start, a line each with its verdict (the filters above
// cover them); a gap table a game, ours against each book's own number per team and the match (basketball's pre-game view, the NBA's
// games in it; the NHL's from its lane's judged pass, the players with the biggest gaps under them), 🟢🟡 on the count's spread as
// football's, ▲ we expect more, ▼ fewer; and the sport's rows of "How our best bets are doing"
const SPORT_DAY = {
  basketball: { title: 'Basketball', none: 'No basketball pick open right now.',
    sub: 'The team counts sent 🧪 unproven, your call (their own record); the player lines on paper. Each game: our number against each book’s own, per team and the match. Tap a game for its table.' },
  nhl: { title: 'NHL', none: 'No NHL pick open right now.', toBet: 'No NHL pick to bet', paperSet: 'held',
    sub: 'Shots on goal sent 🧪 unproven, your call (their own record). Each game: our shots against each book’s own number (its main line’s chance as a count), per team, the match and the players with the biggest gaps. The lane judges at 16:15 and 22:30 UK.' },
};
function gapsSaid(m, label) {
  const gaps = [];
  for (const r of m.rows || []) for (const [id, c] of Object.entries(r.cells || {})) if (c && c.mark) gaps.push({ r, id, c });
  gaps.sort((a, b) => Math.abs(b.c.sd) - Math.abs(a.c.sd));
  return gaps.slice(0, 3).map((g) => `${PG_EMOJI[g.c.mark]} ${esc(g.r.row === 't' ? 'match' : g.r.team)} ${esc((label[g.id] || g.id).toLowerCase())} ${PG_ARROW[g.c.arrow]}${num(Math.abs(g.c.diff), 1)}`).join(' · ') || 'no big gap';
}
function bestLines(EW, sp) {
  return bestRows(EW).filter((b) => b.sport === sp).map((b) => {
    const r = b.row;
    return `<li><b>${esc(b.label)}</b>: ${r && r.n ? `${r.n} bet${r.n === 1 ? '' : 's'}, won ${pct(r.won)} (we said ${pct(r.said)}), return ${spct(r.return)}${isNum(r.luck) ? ` ±${pct(r.luck)}` : ''}: ` : ''}${esc(verdictWord(r))}</li>`;
  }).join('');
}
// 🔎 Today's gaps, a deep look (Rest's gap verdicts, scripts/gap_verdicts.py, the user's "approach this programmatically" of 5 Nov
// 2026; the orchestrator's ask, the Telegram message's own source): every 🟢/🟡 gap on the pre-game view through the senders' own
// rules, a block a match with a BET or a MIDDLE (its stake by rule), the rest one line with why each was skipped
const GAP_WHY = { bias: 'a known bias in our number', range: 'the price outside 1.50-3.50', untested: 'our number untested here', bar: 'under the bar',
  price: 'no price worth it at the line', 'test-rule': 'outside the test’s rules', kept: 'kept back', 'same-view': 'the same view as a pick', test: 'the European test',
  picked: 'a pick', old: 'an old read (over an hour): re-read it before a stake' };
const GAP_STAT = { fouls: 'fouls', offsides: 'offsides', shots: 'shots', sot: 'shots on target', corners: 'corners', throwins: 'throw-ins', goalkicks: 'goal kicks', tackles: 'tackles' };
function gapAmount(r) {
  const rule = String(r.stake_rule || '');
  if (rule.startsWith('unproven')) return { mark: '🧪', words: 'unproven: your call, no stake set' };
  if (!isNum(r.stake) || r.stake <= 0) return { mark: '📄', words: 'paper only today (the plan places nothing)' };
  return { mark: '✅', words: `${money(r.stake, '£', 2, false)} (${rule.startsWith('a tested pick') ? 'a sent pick, the plan’s amount' : rule === 'the European test' ? 'the European test' : esc(rule)})` };
}
export function gapsCard(G, now) {
  const rows = ((G && G.rows) || []).filter((r) => { const t = Date.parse(r.kickoff_utc); return !Number.isFinite(t) || t > now - 2 * 3600e3; });
  if (!rows.length) return '';
  const by = new Map();
  for (const r of [...rows].sort((a, b) => String(a.kickoff_utc).localeCompare(String(b.kickoff_utc)) || String(a.match).localeCompare(String(b.match)))) {
    if (!by.has(r.match)) by.set(r.match, []);
    by.get(r.match).push(r);
  }
  const who = (r) => (r.row === 't' ? 'the match' : r.team);
  const nums = (r) => `ours ${num(r.ours_adj, 1)}, ${esc(r.theirs_book || 'the book')} ${num(r.theirs, 1)}${isNum(r.real) ? `, the books’ real line about ${num(r.real, 1)}` : ''}`;
  const old = (r) => (r.fresh === false && isNum(r.bet_age_h) ? ` <span class="neg small">read ${num(r.bet_age_h, 1)} h ago</span>` : '');
  // an earlier run's pick the latest run dropped (its line or price moved): Rest's DROPPED verdict (from 5 Nov's 17:00 run), or before it
  // a tested pick "not on today's page"; never a bet now (one view, one pick)
  const dropped = (r) => r.verdict === 'DROPPED' || (r.verdict === 'BET' && /not on today/.test(String(r.stake_rule || '')));
  const blocks = [], skipped = [];
  for (const [match, rs] of by) {
    const plays = rs.filter((r) => r.verdict === 'BET' || r.verdict === 'MIDDLE' || r.verdict === 'DROPPED');
    if (!plays.length) { skipped.push({ match, rs }); continue; }
    const lines = plays.map((r) => {
      const a = gapAmount(r);
      // (Rest's DROPPED bet text ends with its book's line now: "... as picked; Stoiximan now: over 11.5 at 1.95")
      if (dropped(r)) return `<li>📄 <b>Not today</b>, an earlier pick the latest run dropped (its line or price has moved). Don’t bet it: ${esc(r.bet)}.<br><span class="muted small">${nums(r)}</span></li>`;
      if (r.verdict === 'BET') return `<li>${a.mark} <b>BET</b> ${esc(r.bet)}: ${a.words}${old(r)}<br><span class="muted small">${nums(r)}</span></li>`;
      const win = `${Math.round(r.mid_low + 0.5)}${r.mid_high - r.mid_low > 1 ? `-${Math.round(r.mid_high - 0.5)}` : ''}`;
      return `<li>↔️ <b>MIDDLE</b> ${esc(who(r))} ${esc(GAP_STAT[r.stat] || r.stat)}: over ${num(r.mid_low, 1)} at ${esc(r.mid_over_book)} ${odds(r.mid_over_price)} (${money(r.mid_stake_over, '£', 2, false)})
        + under ${num(r.mid_high, 1)} at ${esc(r.mid_under_book)} ${odds(r.mid_under_price)} (${money(r.mid_stake_under, '£', 2, false)}): both win on ${win} (our chance ${pct(r.mid_in_ours)}),
        worth ${spct(r.mid_ev_ours)}; ${a.words}${old(r)}<br><span class="muted small">${nums(r)}</span></li>`;
    });
    const skips = rs.filter((r) => r.verdict === 'SKIP').map((r) => `${esc(who(r))} ${esc(GAP_STAT[r.stat] || r.stat)} ${r.lean === 'under' ? '▼' : '▲'} (${esc(GAP_WHY[r.funnel] || r.funnel)})`);
    blocks.push(`<div class="gap-match"><p><b>${esc(match)}</b> <span class="muted small">${esc(compName(rs[0].comp))} · ${esc(ukHM(rs[0].kickoff_utc))} UK</span></p>
      <ul class="plain small lines-text">${lines.join('')}${skips.length ? `<li class="muted">SKIP ${skips.join('; ')}</li>` : ''}</ul></div>`);
  }
  const why = {};
  for (const s of skipped) for (const r of s.rs) why[r.funnel] = (why[r.funnel] || 0) + 1;
  const n = (v) => rows.filter((r) => r.verdict === v && !dropped(r)).length;
  const nDropped = rows.filter(dropped).length;
  const rest = skipped.length ? `<p class="muted small"><b>Skipped</b> (${skipped.length} match${skipped.length === 1 ? '' : 'es'}): ${skipped.map((s) => `${esc(s.match)} ${esc(ukHM(s.rs[0].kickoff_utc))}`).join(', ')}.
    Why: ${Object.entries(why).sort((a, b) => b[1] - a[1]).map(([k, c]) => `${esc(GAP_WHY[k] || k)} ${c}`).join('; ')}.</p>` : '';
  return section(`🔎 Today’s gaps, a deep look (${n('BET')} bet · ${n('MIDDLE')} middle · ${n('SKIP')} skipped${nDropped ? ` · ${nDropped} not today` : ''})`, `${blocks.join('')}${rest}`,
    { sub: `Every 🟢/🟡 gap on the pre-game view put through the senders’ own rules${G.made ? ` (made ${esc(ukHM(G.made))} UK)` : ''}: ✅ a sent pick or the European test at its stake, 🧪 unproven: your call, 📄 paper, ↔️ a middle (both sides at two books). The same as the Telegram message.`,
      id: 'gaps', wide: true, fold: 'today.gaps' });
}

// Live's sends of 5 Nov 2026 on the board the same day (the user's rule: every send shows on the board; the orchestrator's ask):
// the in-play unders (scripts/inplay_unders.py, H123 fouls and H127 throw-ins at Superbet's main line) and the sure middles in
// real money (scripts/sure_middles.py). Each its own record; the record over time is in "How our best bets are doing" (best.js).
const INPLAY_TEST = { H123: 'the in-play fouls test, H123', H127: 'the in-play throw-ins test, H127' };
export function inplayCard(rows, now) {
  // sent, "held: game changed" or "not sent: Telegram refused"; any other status is no send and never shown as one
  const held = (r) => String(r.status || '').startsWith('held');
  const isRefused = (r) => String(r.status || '').startsWith('not sent');
  const day = (rows || []).filter((r) => { const t = Date.parse(r.at); return Number.isFinite(t) && t > now - 24 * 3600e3 && (r.status === 'sent' || held(r) || isRefused(r)); });
  if (!day.length) return '';
  const sent = day.filter((r) => r.status === 'sent');
  const kept = day.filter(held);
  const refused = day.filter(isRefused);
  const what = (r) => `${r.team ? `${esc(r.team)} ${esc(r.stat)}` : `the match’s ${esc(r.stat)}`} under ${num(r.line, 1)}`;
  const state = (r) => `${num(r.minute, 0)}’ ${esc(r.score || '')}`;
  const result = (r) => (r.won === true ? `<span class="pos">✅ won</span>: ${num(r.final, 0)}` : r.won === false ? `<span class="neg">❌ lost</span>: ${num(r.final, 0)}`
    : '<span class="muted">open: settles on the full-time count</span>');
  const line = (r) => `<li>🧪 <b>${what(r)}</b> @ ${odds(r.price)} at Superbet · ${esc(r.match)} <span class="muted">(${esc(compName(r.comp))}, ${state(r)}, sent ${esc(ukHM(r.at))} UK)</span><br>
    ${isNum(r.ours) ? `our chance ${pct(r.ours)} (${spct(r.edge)}) · ` : ''}${esc(INPLAY_TEST[r.rule] || r.rule || '')} · no stake suggested · ${result(r)}</li>`;
  const done = sent.filter((r) => r.won === true || r.won === false);
  const level = done.reduce((s, r) => s + (r.won ? r.price - 1 : -1), 0);
  const tally = done.length ? ` In the last day: ${done.filter((r) => r.won).length} of ${done.length} settled won, ${money(level, '', 2)} at a unit a line.` : '';
  return section(`🧪 In-play unders sent (${sent.length}${kept.length ? ` · ${kept.length} held` : ''})`,
    `${sent.length ? `<ul class="plain small lines-text">${sent.map(line).join('')}</ul>` : '<p class="empty">None sent in the last day: each line that qualified was in a changed game.</p>'}
    ${kept.length ? `<p class="muted small"><b>Held, game changed</b> (never sent): ${kept.map((r) => `${esc(r.match)}, ${what(r)} (${state(r)})`).join('; ')}.</p>` : ''}
    ${refused.length ? `<p class="neg small">Not sent (Telegram refused): ${refused.map((r) => `${esc(r.match)}, ${what(r)}`).join('; ')}.</p>` : ''}`,
    { sub: `The Telegram message’s lines, the last 24 hours: unders at Superbet’s main line in the European cups, calm games only. 🧪 Unproven: your call, no stake suggested; their own record.${tally}`,
      id: 'inplay', wide: true, fold: sent.some((r) => now - Date.parse(r.at) < 30 * 60e3) ? null : 'today.inplay' });
}

// live tennis tracked, not sent (6 Nov 2026, the user's answer in DECISIONS 9590d17: the sends stopped, tracking kept; Live's
// logs/tennis_live_tracked.csv): the last day's suggestions that would have gone out, a line each, 📄, each its result once settled
export function liveTrackedCard(bets, now) {
  const day = (bets || []).filter((r) => r.set === 'livetracked' && r.sport === 'tennis' && r.kickAt && now - r.kickAt <= 864e5)
    .sort((a, b) => b.kickAt - a.kickAt);
  if (!day.length) return '';
  const res = (r) => (r.status === 'won' ? '<span class="pos">✅ won</span>' : r.status === 'lost' ? '<span class="neg">❌ lost</span>' : r.status === 'void' ? 'void' : '<span class="muted">open</span>');
  return section(`📄 Live tennis, tracked not sent (${day.length})`, `<ul class="plain small lines-text">${day.map((r) => `<li><b>${esc(r.bet)}</b> @ ${odds(r.price)} at Superbet · ${esc(r.match)}
    <span class="muted">(${esc(r.comp)}, ${esc(ukHM(r.kickAt))} UK)</span> · ${spct(r.edge)} · ${res(r)}</li>`).join('')}</ul>`,
  { sub: 'What live tennis would have sent under the old rule, tracked to learn: nothing goes to Telegram (your answer of 6 Nov). Its record is Results’ “Live tracked, not sent”.', id: 'livetracked', wide: true, fold: 'today.livetracked' });
}

export function middlesCard(rows, now, sport = 'all') {
  // open middles up to a week after their start (waiting for a count), settled ones for 30 hours after it
  const keep = (rows || []).filter((r) => {
    if (sport !== 'all' && r.sport !== sport) return false;
    const t = Date.parse(r.start);
    return !Number.isFinite(t) ? !r.settled : r.settled ? t > now - 30 * 3600e3 : t > now - 7 * 864e5;
  }).sort((a, b) => String(a.start).localeCompare(String(b.start)));
  if (!keep.length) return '';
  const when = (t) => (ukDay(t) === ukDay(new Date(now)) ? ukHM(t) : `${dayLabel(ukDay(t) || '').slice(0, 3)} ${ukHM(t)}`);
  const win = (lo, hi) => { const a = Math.round(lo + 0.5), b = Math.round(hi - 0.5); return a === b ? `${a}` : `${a}-${b}`; };
  const stake = (r) => (r.over_stake || 0) + (r.under_stake || 0);
  const toPlace = (r) => !r.settled && Date.parse(r.start) > now;
  const result = (r) => {
    if (r.void) return `↩️ Void (${esc(r.void)}): both stakes back.`;
    if (r.settled && isNum(r.profit)) return `${r.profit > 0.5 * stake(r) ? '✅✅ Both won' : '✅ One leg won'} on ${num(r.actual, 0)}: <b class="${signClass(r.profit)}">${money(r.profit, '£', 2)}</b>.`;
    return `<span class="muted">${toPlace(r) ? 'Not started yet' : 'Started, waiting for its count'}: settles on ${esc(r.source || 'the count')}.</span>`;
  };
  const card = (r) => `<div class="gap-match"><p><b>${esc(r.match)}</b> <span class="muted small">${r.sport === 'tennis' ? 'Tennis' : 'Football'} · ${esc(when(r.start))} UK · ${esc(r.count || '')}</span></p>
    <ul class="plain small"><li>Over ${num(r.over_line, 1)} at ${esc(r.over_book)} @ ${odds(r.over_price)}: <b>${money(r.over_stake, '£', 2, false)}</b></li>
      <li>Under ${num(r.under_line, 1)} at ${esc(r.under_book)} @ ${odds(r.under_price)}: <b>${money(r.under_stake, '£', 2, false)}</b></li>
      <li>At worst ${money(r.worst, '£', 2)}; on ${win(r.over_line, r.under_line)} both win: ${money(r.inside, '£', 2)}. <span class="muted">Sent ${esc(ukHM(r.sent))} UK, prices read ${esc(r.read || '–')} UK.</span></li>
      <li>${result(r)}</li></ul></div>`;
  const open = keep.filter(toPlace);
  const done = keep.filter((r) => r.settled && isNum(r.profit));
  const tally = done.length ? ` Settled here: ${money(done.reduce((s, r) => s + r.profit, 0), '£', 2)} on ${money(done.reduce((s, r) => s + stake(r), 0), '£', 2, false)} staked.` : '';
  return section(`💶 Sure middles, real money (${keep.length}${open.length ? ` · ${open.length} still to start` : ''})`, keep.map(card).join(''),
    { sub: `A middle that can’t lose at the prices posted: an over at one book and an under at a higher line at another, about £20 split so either miss is break-even or better, at most £100 a match day. Place the legs in the Telegram message’s order, each price still there.${tally}`,
      id: 'middles', wide: true, fold: open.length ? null : 'today.middles' });
}

// the sport's picks held on paper, never sent (the NHL's set "held": every player pick from 6 Nov 2026, DECISIONS 9590d17), a 📄 line
// each in the section's fold (the orchestrator, 6 Nov 2026 23:30 UK: every pick carries its verdict on the board); still to start only
export function paperOf(bets, sp, now) {
  const set = (SPORT_DAY[sp] || {}).paperSet;
  return !set ? [] : (bets || []).filter((r) => r.set === set && r.sport === sp && r.status === 'open' && (!r.kickAt || r.kickAt > now - 2 * 3600e3))
    .sort((a, b) => (a.kickAt || 0) - (b.kickAt || 0));
}
function paperLine(r) {
  const why = (String(r.kind || '').match(/\((.+)\)\s*$/) || [])[1];
  return `<li>📄 <b>${esc(r.bet)}</b> @ ${odds(r.price)} at ${esc(r.book)} · ${esc(r.match)} <span class="muted">(${esc(r.kickAt ? ukHM(r.kickAt) : '')} UK)</span> · ${spct(r.edge)}${why ? ` <span class="muted">· ${esc(why)}</span>` : ''}</li>`;
}
export function sportDay(sp, picks, view, EW, now, line, extra = '', paper = []) {
  const C = SPORT_DAY[sp];
  const stats = (view && view.stats) || [];
  const label = Object.fromEntries(stats.map((s) => [s.id, s.label]));
  const games = ((view && (view.games || view.matches)) || []).filter((m) => { const t = Date.parse(m.kick_utc); return !Number.isFinite(t) || t > now - 2 * 3600e3; });
  if (!picks.length && !games.length && !paper.length) return '';
  const list = (picks.length ? `<div class="lines">${picks.map(line).join('')}</div>`
    : `<p class="empty">${esc(paper.length && C.toBet ? `${C.toBet} · ${paper.length} on paper` : C.none)}</p>`)
    + (paper.length ? `<details class="fold"><summary class="small">📄 On paper, not sent (${paper.length})</summary><ul class="plain small lines-text">${paper.map(paperLine).join('')}</ul>
      <p class="muted small">Held by rule, never sent: one unit each, their own record (Results, “Held on paper 📄”).</p></details>` : '');
  const tables = games.map((m) => `<details class="fold pg-game"><summary><b>${esc(m.match)}</b> <span class="muted small">${esc(ukHM(m.kick_utc))} UK · ${esc(compName(m.comp))} · ${gapsSaid(m, label)}</span></summary>
      ${pregameTable(m, stats)}${isNum(m.players) && m.players > 0 ? `<p class="muted small">The ${Math.min(m.players, 6)} players with the biggest gaps of ${m.players} judged${m.judged ? `, judged ${esc(ukHM(m.judged))} UK` : ''}.</p>` : ''}</details>`).join('');
  const best = bestLines(EW, sp);
  return section(`${C.title} (${picks.length} pick${picks.length === 1 ? '' : 's'}, ${games.length} game${games.length === 1 ? '' : 's'})`,
    `${list}${tables ? `<h3 class="sub-h">The games: ours / the book’s</h3>${tables}` : '<p class="muted small">No game judged yet.</p>'}${extra}${best ? `<h3 class="sub-h">How our best bets are doing</h3><ul class="plain small lines-text">${best}</ul>` : ''}`,
    { sub: C.sub, id: `sport-${sp}`, wide: true, fold: `today.${sp}` });
}
function gapSlipCard(s) {
  return `<article class="mini"><div class="mini-top"><span class="tag">gap slip · paper</span><span class="muted small">${esc(s.day || '')}</span><b class="mini-price">${odds(s.price)}</b></div>
    <ul class="legs">${(s.legs || []).map((l) => `<li><span>${esc(l.pick)}</span><b>${odds(l.price)}</b><span class="muted">${mLink(l.match)} · ${esc(ukHM(l.kick))} · ours ${pct(l.ours)}, Stoiximan's ${pct(l.theirs)}</span></li>`).join('')}</ul>
    <div class="mini-foot"><span>our chance ${pct(s.ours)}</span><span>Stoiximan's ${pct(s.theirs)}</span><span>stake ${money(s.stake, '£', 0, false)}</span></div>
    <p class="muted small" style="margin:0">The day's biggest tested gaps at Stoiximan, one leg a match. For fun: never a pick, never the paper account (ledger/gap_slips.md).</p></article>`;
}
// the gap builders (scripts/gap_builders.py, the user's 78 slip of 21 Oct 2026, asked for every run on 22 Oct): two legs of one
// stat in one match where our numbers lean from Stoiximan's, the day's best matches, their slip; paper, never a pick
function gapBuilderCard(b) {
  return `<article class="mini"><div class="mini-top"><span class="tag">builder · paper</span><span class="muted small">${esc(ukHM(b.kick))} · ${esc(compName(b.comp))}</span><b class="mini-price">≈ ${odds(b.price)}</b></div>
    <p class="small" style="margin:0"><b>${mLink(b.match)}</b></p>
    <ul class="legs">${(b.legs || []).map((l, i) => `<li><span>${esc(l)}</span><b>${odds((b.prices || [])[i])}</b></li>`).join('')}</ul>
    <div class="mini-foot"><span>ours ${pct(b.ours)}</span><span>Stoiximan's ${pct(b.theirs)}</span>${b.tested ? '' : '<span>⚠️ untested numbers</span>'}</div>
    <p class="muted small" style="margin:0">${esc(b.why || '')}. The price is predicted: check Stoiximan's builder.</p></article>`;
}
function gapBuilders(days) {
  return (days || []).map((d) => `<h3 class="sub-h">Gap builders, ${esc(d.day)}${d.slip ? ` · the best ${(d.slip.matches || []).length} together ≈ ${odds(d.slip.price)}, ours ${pct(d.slip.ours)}, Stoiximan's ${pct(d.slip.theirs)}` : ''}</h3>
    <div class="minis">${(d.builders || []).map(gapBuilderCard).join('')}</div>`).join('');
}

// the pre-game view's scorecard and builder ideas (scripts/pregame_score.py, the R14 task of 23 Oct 2026): ours against each bookmaker
// the feed names (basketball's Pamestoixima too from 27 Oct 2026) against the count, 7 days (28 where 7 is empty); the ideas and
// grade-A legs on paper, never picks
const PG_LABEL = { fouls: 'Fouls', shots: 'Shots', sot: 'On target', corners: 'Corners', offsides: 'Offsides', throwins: 'Throw-ins', goalkicks: 'Goal kicks', tackles: 'Tackles', cards: 'Cards' };
function pgScore(sc, label = PG_LABEL, who = '') {
  if (!sc || !(sc.rows || []).length) return '';
  const win = sc.rows.some((r) => r.window === '7') ? '7' : '28';
  const rows = sc.rows.filter((r) => r.window === win && r.book !== 'main')
    .sort((a, b) => (a.stat + a.kind + a.book).localeCompare(b.stat + b.kind + b.book));
  const body = rows.map((r) => `<tr><td>${esc(label[r.stat] || r.stat)} ${r.kind === 'side' ? 'side' : 'match'}</td><td>${esc(r.book)}</td><td>${r.n}</td>
    <td>${num(r.our_mae, 2)} / ${num(r.book_mae, 2)}</td><td>${num(r.our_bias, 2)} / ${num(r.book_bias, 2)}</td><td class="${r.nearer >= 0.5 ? 'pos' : 'neg'}">${pct(r.nearer)}</td>
    <td>${isNum(r.showed) ? pct(r.showed) : '–'}</td></tr>`).join('');
  return `<details class="fold"><summary>How the ${who ? `${esc(who)} ` : ''}view did: ${win} days to ${esc(sc.until || '')}</summary>
    <div class="tbl-wrap"><table class="small"><thead><tr><th>Count</th><th>Against</th><th>n</th><th>Miss ours / theirs</th><th>Bias ours / theirs</th><th>Ours nearer</th><th>Our gap showed</th></tr></thead><tbody>${body}</tbody></table></div>
    ${(sc.slipping || []).length ? `<p class="small">Slipping: ${esc(sc.slipping.join('; '))}.</p>` : ''}
    <p class="muted small">Miss = how far from the count; bias + = expected too many; our gap showed: 100% = ours right where the two differed, 0% = theirs.</p></details>`;
}
function pgIdeas(g) {
  if (!g) return '';
  const ideas = Object.entries(g.days || {}).flatMap(([, bs]) => bs);
  const legs = (g.legs || []).filter((x) => x.grade === 'A').slice(0, 8);
  if (!ideas.length && !legs.length) return '';
  return `<h3 class="sub-h">Builder ideas from the gaps (paper)</h3>
    ${ideas.length ? `<ul class="legs">${ideas.map((b) => `<li><span>${mLink(b.match)} ${esc(ukHM(b.kick))}: ${esc(b.legs.join(' + '))}</span> <b>≈${odds(b.price)}</b> <span class="muted">ours ${pct(b.ours)}, Stoiximan ${pct(b.theirs)} · ${esc(b.grades)}</span></li>`).join('')}</ul>` : ''}
    ${legs.length ? `<p class="small">Grade A legs (a big gap, a stat whose gap has shown up, a second signal): ${esc(legs.map((x) => `${x.match}: ${x.text} @${num(x.price, 2)}`).join('; '))}.</p>` : ''}`;
}

// a slip pasted to the BB Picks bot and judged there (scripts/slip_check.py, the user's ask of 19 Oct 2026, T7): each part with
// its value, the whole bet on the careful chances, the better swap, the bot's answer in full; the user's own wagering
function slipCard(s) {
  const parts = (s.parts || []).map((p) => {
    const v = isNum(p.chance) && isNum(p.price) ? p.chance * p.price - 1 : null;
    return `<li><span>${esc(p.builder ? `Builder: ${(p.legs || []).join(' + ')}` : (p.legs || []).join(''))}</span>${isNum(p.price) ? ` <b>${odds(p.price)}</b>` : ''}${p.error
      ? ' <span class="muted">not judged</span>' : v !== null ? ` <span class="${signClass(v)}">${spct(v)}</span>` : ''}</li>`;
  }).join('');
  return `<article class="mini">
    <div class="mini-top">${bookChip(s.book)}<span class="muted small">${esc(ukHM(s.greek))} · ${esc(s.kind || 'bet')}</span><b class="mini-price">${odds(s.price)}</b></div>
    <ul class="legs">${parts}</ul>
    <div class="mini-foot">${isNum(s.edge) ? `<span class="${signClass(s.edge)}">${spct(s.edge)} careful</span>` : ''}<span>${esc(s.verdict || '')}</span>${isNum(s.stake) ? `<span>stake ${num(s.stake, 2)}</span>` : ''}</div>
    ${s.swap ? `<p class="small" style="margin:0">Better: ${esc(s.swap.pick)} at ${esc(s.swap.at)}: ${odds(s.swap.price)}, <span class="${signClass(s.swap.edge)}">${spct(s.swap.edge)}</span></p>` : ''}
    <details class="fold"><summary>The bot's answer</summary><p class="small" style="white-space:pre-wrap;margin:0">${esc(s.text || '')}</p></details>
  </article>`;
}

// oneSided (Live's column, 30 Oct 2026): only this side of the line was read, so the bookmaker's own chance is not known: "—"
function chanceBar(ours, needs, bookp, oneSided = false) {
  if (!isNum(ours) || !isNum(needs)) return '';
  if (oneSided) bookp = null;
  const w = (v) => Math.max(0, Math.min(100, v * 100)).toFixed(1);
  return `<div class="chance" role="img" aria-label="Our chance ${pct(ours)} against ${pct(needs)} the price needs">
    <div class="chance-track"><span class="chance-fill" style="width:${w(ours)}%"></span><span class="chance-need" style="left:${w(needs)}%" title="the price needs ${pct(needs)}"></span>${isNum(bookp) ? `<span class="chance-book" style="left:${w(bookp)}%" title="the bookmaker's own chance ${pct(bookp)}"></span>` : ''}</div>
    <div class="chance-legend"><span>Our chance <b>${pct(ours)}</b></span><span>needs <b>${pct(needs)}</b></span>${isNum(bookp) ? `<span class="muted">theirs ${pct(bookp)}</span>` : oneSided ? '<span class="muted" title="Only this side of the line was read: the bookmaker’s own chance is not known">theirs —</span>' : ''}</div>
  </div>`;
}

function progress(p, live) {
  const top = Math.max(p.line * 1.5, (live.so || 0) + 1, isNum(live.heading) ? live.heading : 0);
  const at = (v) => Math.max(0, Math.min(100, (v / top) * 100)).toFixed(1);
  return `<div class="prog" aria-hidden="true"><span class="prog-fill" style="width:${at(live.so)}%"></span>${isNum(live.heading) && live.state === 'in' ? `<span class="prog-head" style="left:${at(live.heading)}%"></span>` : ''}<span class="prog-line" style="left:${at(p.line)}%"></span></div>`;
}

function doubleCard(d) {
  return `<article class="mini">
    <div class="mini-top">${bookChip(d.book)}<span class="muted small">${esc(d.kind || 'double')}${d.rank ? ' · #' + d.rank : ''}</span><b class="mini-price">${odds(d.price)}</b></div>
    <ul class="legs">${(d.legs || []).map((l) => `<li><span>${esc(l.bet)}</span><span class="muted small">${esc(l.match)}${l.kick ? ' · ' + esc(ukHM(l.kick)) : ''}</span><b>${odds(l.price)}</b></li>`).join('')}</ul>
    <div class="mini-foot"><span>chance ${pct(d.chance)}</span><span class="${signClass(d.edge)}">overlay ${spct(d.edge)}</span><span>stake ${money(d.stake, '£', 2, false)}</span></div>
  </article>`;
}

function funCard(f, kind) {
  return `<article class="mini mini-fun">
    <div class="mini-top">${bookChip(f.book)}<span class="muted small">${esc(f.theme || f.kind || kind)}${f.band ? ' · ' + esc(f.band) : ''}</span><b class="mini-price">${odds(f.price)}</b></div>
    <ul class="legs">${(f.legs || []).map((l) => `<li><span>${esc(l.bet)}</span><span class="muted small">${esc(l.match || '')}</span><b>${odds(l.price)}</b></li>`).join('')}</ul>
    <div class="mini-foot"><span>chance ${pct(f.chance)}</span>${isNum(f.edge) ? `<span class="${signClass(f.edge)}">edge ${spct(f.edge, 1)}</span>` : ''}<span>stake ${money(f.stake, '£', 0, false)}</span></div>
  </article>`;
}

// the domestic cups (scripts/cups_view.py, the user's ask of 26 Oct 2026: the Greek Cup this week, the DFB-Pokal and Coppa
// Italia beside it): a new competition, so each tie shows our paper forecast and the lines 20%+ over the price, never a pick
const CUP_STAT = { ...PG_LABEL, yellows: 'Yellows' };
const utc = (s) => (/(?:[zZ]|[+-]\d{2}:?\d{2})$/.test(String(s)) ? String(s) : `${String(s).replace(' ', 'T')}Z`);   // a cup's kick-off is kickoff_utc
// 🌍 Internationals (the user's key workstream of 7 Nov 2026, the orchestrator's ask; the Nations League's last group games and the
// friendlies, 12-17 Nov): the national teams' picks still to start on top, each with its verdict (🧪 sent unproven, your call; 📄
// paper), then a fold a match: what each side plays for (Rest's motive, H155) and the stats gap table, ours / the book's, as the
// pre-game view's (Rest's deep forecasts, logs/intl_view.json through board.py intl_view); its own record on Results (the sets "intl"
// and "intlpaper", the band by match)
const INTL_SETS = { intl: '🧪 sent, your call', intlpaper: '📄 paper' };
const isIntl = (r) => r.set === 'intl' || r.set === 'intlpaper';
export function intlOf(bets, now) {
  return (bets || []).filter((r) => isIntl(r) && r.status === 'open' && (!r.kickAt || r.kickAt > now - 2 * 3600e3))
    .sort((a, b) => (a.set === b.set ? 0 : a.set === 'intl' ? -1 : 1) || (a.kickAt || 0) - (b.kickAt || 0) || (b.edge || 0) - (a.edge || 0));
}
function intlLine(r) {
  const when = r.kickAt ? `${dayLabel(ukDay(r.kickAt) || '').slice(0, 3)} ${ukHM(r.kickAt)} UK` : '';
  return `<li>${r.set === 'intl' ? '🧪' : '📄'} <b>${esc(r.bet)}</b> @ ${odds(r.price)} at ${esc(r.book)} · ${esc(r.match)}${when ? ` <span class="muted">(${esc(when)})</span>` : ''} · ${spct(r.edge)} <span class="muted">· ${esc(INTL_SETS[r.set])}</span></li>`;
}
export function intlCard(view, bets, now) {
  const V = view || {};
  const stats = V.stats || [];
  const label = Object.fromEntries(stats.map((s) => [s.id, s.label]));
  const at = (m) => Date.parse(m.kick_utc);
  const games = (V.matches || []).filter((m) => !Number.isFinite(at(m)) || at(m) > now - 2 * 3600e3)
    .sort((a, b) => (at(a) || Infinity) - (at(b) || Infinity));
  const picks = intlOf(bets, now);
  if (!picks.length && !games.length) return '';
  const sent = picks.filter((r) => r.set === 'intl').length;
  const top = picks.length ? `<ul class="plain small lines-text">${picks.map(intlLine).join('')}</ul>`
    : `<p class="empty">No national-team pick yet${games.length ? ': the forecasts are below' : ''}.</p>`;
  const tables = games.map((m) => {
    const when = Number.isFinite(at(m)) ? `${dayLabel(ukDay(m.kick_utc) || '').slice(0, 3)} ${ukHM(m.kick_utc)} UK` : 'time to come';
    const mot = (m.motive || []).filter((x) => x && x.says);
    return `<details class="fold pg-game"><summary><b>${esc(m.match)}</b> <span class="muted small">${esc(when)}${m.comp ? ` · ${esc(compName(m.comp))}` : ''} · ${gapsSaid(m, label)}</span></summary>
      ${mot.length ? `<ul class="plain small lines-text">${mot.map((x) => `<li>🎯 <b>${esc(x.team)}</b>: ${esc(x.says)}</li>`).join('')}</ul>` : '<p class="muted small">What each side plays for: not written yet.</p>'}
      ${(m.rows || []).length ? pregameTable(m, stats) : '<p class="muted small">Our counts: not forecast yet.</p>'}</details>`;
  }).join('');
  return section(`🌍 Internationals (${picks.length} pick${picks.length === 1 ? '' : 's'}, ${games.length} match${games.length === 1 ? '' : 'es'})`,
    `${top}${tables ? `<h3 class="sub-h">The matches: what each side plays for, ours / the book’s</h3>${tables}` : ''}`,
    { sub: `The national teams, a new set: sent 🧪 unproven at the club bars (your call; ${sent} still to play), the rest on paper; their own record (Results, “National teams”), judged by match. Each match: what each side plays for, then our counts against each book’s.`,
      id: 'intl', wide: true, fold: 'today.intl', actions: `<button class="link" ${goAttr({ tab: 'results', sport: 'football', set: 'intl' })}>Record →</button>` });
}
function cupLine(x, t) {
  const who = x.row === 't' ? 'match' : x.row === 'h' ? t.home : t.away;
  return `<li>${bookChip(x.book)} ${esc(who)} ${esc((CUP_STAT[x.stat] || x.stat).toLowerCase())} ${esc(x.way)} ${num(x.line, 1)} at <b>${odds(x.price)}</b>:
    ours ${pct(x.ours)}, <span class="${signClass(x.overlay)}">${spct(x.overlay)}</span>${x.flag ? ' <span class="tag tag-fast">20%+</span>' : ''}</li>`;
}
function cupTie(t) {
  const F = t.forecast || {}, avgOf = t.avg_label || 'the cup’s average';
  const when = t.kick ? `${dayLabel(ukDay(utc(t.kick))).slice(0, 3)} ${ukHM(utc(t.kick))}` : esc(dayLabel(t.day).slice(0, 3));
  const tiers = t.tiers ? ` · tiers ${t.tiers[0]} v ${t.tiers[1]}` : '';
  const rows = Object.entries(F).map(([s, f]) => `<tr${f.real ? '' : ' class="muted"'}><td>${esc(CUP_STAT[s] || s)}${f.real ? '' : '*'}</td>
    <td class="n">${num(f.h, 1)}</td><td class="n">${num(f.a, 1)}</td><td class="n">${num(f.h + f.a, 1)}</td></tr>`).join('');
  const ours = (t.lines || []).filter((x) => x.real), avg = (t.lines || []).filter((x) => !x.real);
  const side = t.flagged ? `<span class="tag tag-fast">${t.flagged} at 20%+</span>` : `<span class="muted small">${ours.length ? `${ours.length} lines` : 'no lines of ours yet'}</span>`;
  return `<details class="early-line"><summary class="bet-line">
      <span class="bl-main"><span class="bl-bet">${esc(t.home)} v ${esc(t.away)}</span><span class="bl-match muted">${when} · ${esc(t.name)}${t.stage ? ` · ${esc(t.stage.replace(/-/g, ' '))}` : ''}${tiers}</span></span>
      <span class="bl-side"><span class="tag tag-warn">new competition</span>${side}</span></summary>
    <div class="tbl-wrap"><table class="tbl cup-fc"><thead><tr><th>Our forecast</th><th class="n">${esc(t.home)}</th><th class="n">${esc(t.away)}</th><th class="n">Match</th></tr></thead><tbody>${rows}</tbody></table></div>
    <p class="muted small">${Object.values(F).some((f) => !f.real) ? `* ${esc(avgOf)}: not our forecast, never flagged. ` : ''}${esc(t.note || '')}</p>
    ${(t.sides || []).some((x) => x.incentive || x.lineup) ? `<ul class="plain small">${t.sides.map((x) => `<li><b>${esc(x.team)}</b>: ${esc([x.incentive, x.lineup].filter(Boolean).join('; '))}</li>`).join('')}</ul>` : ''}
    ${ours.length ? `<ul class="book-lines">${ours.slice(0, 8).map((x) => cupLine(x, t)).join('')}</ul>${ours.length > 8 ? `<details><summary class="small">${ours.length - 8} more of our lines</summary><ul class="book-lines">${ours.slice(8).map((x) => cupLine(x, t)).join('')}</ul></details>` : ''}`
    : '<p class="muted small">No line read yet for the stats that are ours: shots lines usually appear near kick-off.</p>'}
    ${avg.length ? `<details><summary class="small">${t.avg_lines || avg.length} lines priced on ${esc(avgOf)} (${esc([...new Set(avg.map((x) => (CUP_STAT[x.stat] || x.stat).toLowerCase()))].join(', '))}; the best ${avg.length} here): not our forecast, never flagged</summary><ul class="book-lines">${avg.map((x) => cupLine(x, t)).join('')}</ul></details>` : ''}
  </details>`;
}

// Today's filter chips (the user, 2 Nov 2026): my PF filter, a bookmaker, kick-off hours (UK), a stat, on top of the sport chips;
// they combine (AND), one tap clears them, and the phone keeps them (state.js saves S in localStorage, try/catch)
const STAT_NAMES = { throwins: 'throw-ins', sot: 'shots on target', goalkicks: 'goal kicks', fk365: 'free kicks', df: 'double faults',
  // basketball's and tennis's keys as their picks carry them (5 Nov 2026: the stat and side chip names them)
  pts: 'points', reb: 'rebounds', oreb: 'offensive rebounds', dreb: 'defensive rebounds', ast: 'assists', fg3: 'threes', fg2m: 'twos made',
  ftm: 'free throws made', tov: 'turnovers', stl: 'steals', blk: 'blocks', total: 'total games' };
export const HOURS = [{ id: 'all', label: 'Any time' }, { id: 'h2', label: 'Next 2 h' }, { id: 'h6', label: '2-6 h' },
  { id: 'today', label: 'Later today' }, { id: 'tomorrow', label: 'Tomorrow' }];
export function todayFilter(D, S, now) {
  const pfKeys = new Set((((D.feed.today || {}).pf || {}).books || []).flatMap((b) => (b.legs || []).map((l) => l.key)));
  const day = ukDay(new Date(now)), next = ukDay(new Date(now + 864e5));
  const inHours = (p) => {
    if (S.tHours === 'all' || !S.tHours) return true;
    if (!p.kickAt) return false;
    const h = (p.kickAt.getTime() - now) / 3600e3, d = ukDay(p.kickAt);
    return S.tHours === 'h2' ? h < 2 : S.tHours === 'h6' ? h >= 2 && h < 6 : S.tHours === 'today' ? h >= 6 && d === day : d === next;
  };
  // a stat and its side as one chip (the user, 4 Nov 2026: "throw-ins under", "aces over", "fouls under"); a stat alone, as saved
  // before, still cuts by the stat
  const statOk = (p) => {
    if (!S.tStat || S.tStat === 'all') return true;
    const [st, sd] = String(S.tStat).split('|');
    return p.stat === st && (!sd || p.side === sd);
  };
  const pass = (p) => (S.tPf !== 'on' || pfKeys.has(p.key)) && (!S.tBook || S.tBook === 'all' || p.book === S.tBook) && statOk(p) && inHours(p);
  const on = [S.tPf === 'on', S.tBook && S.tBook !== 'all', S.tHours && S.tHours !== 'all', S.tStat && S.tStat !== 'all',
    S.todaySport && S.todaySport !== 'all'].filter(Boolean).length;
  const tally = (key) => Object.entries(D.today.reduce((o, p) => { const k = key(p); if (k) o[k] = (o[k] || 0) + 1; return o; }, {})).sort((a, b) => b[1] - a[1]);
  return { pass, on, pfKeys, books: tally((p) => p.book).map(([b]) => b),
    stats: tally((p) => (p.stat && (p.side === 'over' || p.side === 'under') ? `${p.stat}|${p.side}` : null)).map(([id, n]) => ({ id, n })) };
}
export const statSideLabel = (id, n) => {
  const [st, sd] = String(id).split('|');
  const name = statName(st);
  return `${name.charAt(0).toUpperCase()}${name.slice(1)}${sd ? ` ${sd}` : ''}${isNum(n) ? ` (${n})` : ''}`;
};
export const statName = (s) => STAT_NAMES[s] || s;

export function render(ctx) {
  const { D, S } = ctx;
  TIER_ON = !!(D.feed.today || {}).tier_on;
  BOARD = D;
  TIER_STATUS = (D.feed.today || {}).tier_status || null;
  const now = Date.now();
  const today = greekDay();
  const sport = S.todaySport;
  const F = todayFilter(D, S, now);
  const picks = D.today.filter((p) => (sport === 'all' || p.sport === sport) && F.pass(p));
  const upcoming = picks.filter((p) => p.kickAt && p.kickAt.getTime() > now && p.status !== 'won' && p.status !== 'lost');
  const inPlay = picks.filter((p) => p.kickAt && p.kickAt.getTime() <= now && p.status !== 'won' && p.status !== 'lost' && now - p.kickAt.getTime() < 2.7 * 3600e3);
  const sorted = [...upcoming].sort(S.todaySort === 'kick'
    ? (a, b) => a.kickAt - b.kickAt || (b.stake || 0) - (a.stake || 0)
    : (a, b) => (b.stake || 0) - (a.stake || 0) || (b.edge || 0) - (a.edge || 0));
  const next = upcoming.length ? Math.min(...upcoming.map((p) => p.kickAt.getTime())) : null;
  // the plan's real money still to place: a pick a chat's call turned to paper or don't-bet places nothing (31 Oct 2026: Vallecano's
  // throw-ins, called PAPER, still added its 25)
  const placeSum = upcoming.reduce((s, p) => s + (isNum(p.place) && (!p.verdict || p.verdict === 'BET') ? p.place : 0), 0);
  const paperToday = D.bets.filter((r) => r.set === 'paper' && r.sport === 'football' && r.day === today);
  const gToday = agg(paperToday);
  const byBook = {};
  for (const p of upcoming) byBook[p.book] = (byBook[p.book] || 0) + 1;

  const hero = `<section class="hero card">
    <div class="hero-date"><h1>${esc(dayLabel(ukDay(new Date(now))))}</h1><span class="muted">All times UK</span></div>
    <div class="hero-stats">
      <div title="${esc(Object.entries(byBook).map(([b, n]) => `${b} ${n}`).join(' · ') || 'nothing open')}"><small>To bet</small><b>${upcoming.filter((p) => p.verdict === 'BET').length}</b><span class="muted small">${upcoming.filter((p) => p.verdict === 'UNPROVEN').length} 🧪 · ${upcoming.filter((p) => p.verdict === 'PAPER').length} paper<span class="hero-more"> · ${upcoming.filter((p) => p.verdict === "DON'T BET").length} don't bet · ${Object.entries(byBook).map(([b, n]) => `${esc(b)} ${n}`).join(' · ') || 'nothing open'}</span></span></div>
      <div><small>Next kick-off</small><b>${next ? esc(ukHM(next)) : '–'}</b><span class="muted small">${next ? until(next - now) : 'no more today'}</span></div>
      <div><small>Real-money plan</small><b>${money(placeSum, '£', 0, false)}</b><span class="muted small">of the 500 day cap</span></div>
      <div><small>Paper today</small><b class="${signClass(gToday.profit)}">${gToday.n ? money(gToday.profit) : '–'}</b><span class="muted small">${gToday.n ? `${gToday.won} of ${gToday.n} won` : 'none settled yet'}${gToday.open ? ` · ${gToday.open} open` : ''}</span></div>
    </div>
    <div class="hero-controls">${chips('todaySport', [{ id: 'all', label: 'All sports' }, { id: 'football', label: 'Football' }, { id: 'basketball', label: 'Basketball' }, { id: 'tennis', label: 'Tennis' }, { id: 'nhl', label: 'NHL' }], sport, { small: true })}
      ${chips('todaySort', SORTS, S.todaySort || 'best', { small: true })}</div>
  </section>`;

  const shown = upcoming.length + inPlay.length;
  const filterBar = `<section class="card tfilter">
    <div class="tf-row"><div class="seg seg-sm" role="group"><button type="button" class="${S.tPf === 'on' ? 'on' : ''}" data-set="tPf" data-value="${S.tPf === 'on' ? 'off' : 'on'}" aria-pressed="${S.tPf === 'on'}">My filter</button></div>
      <span class="small"><b>${shown}</b> <span class="muted">pick${shown === 1 ? '' : 's'} shown${F.on ? ` · ${F.on} filter${F.on === 1 ? '' : 's'} on` : ''}</span></span>
      ${F.on ? '<button type="button" class="link small" data-set="todayClear" data-value="1">Clear</button>' : ''}</div>
    <details class="tf-more"${S.tBook !== 'all' || S.tHours !== 'all' || S.tStat !== 'all' ? ' open' : ''}><summary class="small muted">Bookmaker, hours, stat and side</summary>
      ${chips('tBook', [{ id: 'all', label: 'Every book' }, ...F.books.map((b) => ({ id: b, label: b }))], S.tBook || 'all', { small: true })}
      ${chips('tHours', HOURS, S.tHours || 'all', { small: true })}
      ${chips('tStat', [{ id: 'all', label: 'Every stat' }, ...F.stats.map((s) => ({ id: s.id, label: statSideLabel(s.id, s.n) }))], S.tStat || 'all', { small: true })}
    </details></section>`;

  // today's open decisions, waiting for the user's yes (the orchestrator's ask of 29 Oct 2026: the user is out, reads
  // the board on the phone); logs/pending_decisions.json, any chat appends to it (board.py's pending_decisions()). Only the
  // unanswered sit at the top (the user, 29 Oct evening: "since the questions are answered, move them from the top of my
  // board"): the answered go to a folded "Answered" card lower down with their choice and date, and a to-do (kind "todo",
  // e.g. pasting the bookmakers' histories) is a small reminder near the bottom until a chat marks it done, never a decision
  const PD = D.feed.pending || [];
  const isTodo = (x) => x.kind === 'todo';
  const onDay = (t) => { const d = new Date(t); return Number.isNaN(d.getTime()) ? String(t).slice(0, 10) : dayLabel(ukDay(d), false); };
  // only live questions wait (the user, 2 Nov 2026: "remove jargon junk"): one withdrawn, or 3 days with no answer, folds into a
  // "dropped" line; never answered, so nothing reads a yes from it
  const stale = (x) => !!x.withdrawn_at || (x.added && now - Date.parse(x.added) > 3 * 864e5);
  const screen = (x) => x.kind === 'screen check';                  // asked by Telegram only, never on the board (the user, 2 Nov 2026)
  const pdDropped = PD.filter((x) => !isTodo(x) && !screen(x) && !x.answered_at && stale(x));
  const pdWaiting = PD.filter((x) => !isTodo(x) && !screen(x) && !x.answered_at && !stale(x));
  const pdAnswered = PD.filter((x) => !isTodo(x) && x.answered_at)
    .sort((a, b) => String(b.answered_at).localeCompare(String(a.answered_at)) || (Number(a.number) || 0) - (Number(b.number) || 0));
  const pdTodo = PD.filter((x) => isTodo(x) && !x.done_at);
  const pendingCard = pdWaiting.length ? section(`Waiting for your yes (${pdWaiting.length})`,
    `<div class="lines">${pdWaiting.map((x) => `<details class="early-line">
      <summary class="bet-line"><span class="bl-main"><span class="bl-bet">${esc(x.title)}</span><span class="bl-match muted">${esc(x.group)}</span></span>
      <span class="bl-side small">${esc(x.label)}</span></summary>
      <p class="small">${esc(x.why)}</p>${(x.alt || []).length ? `<p class="muted small">Or: ${x.alt.map(esc).join('; ')}.</p>` : ''}</details>`).join('')}</div>`,
  { sub: 'The recommended option shown first, with why; paper until you answer - nothing here changes real money by itself. Reply in the BB Picks chat (e.g. "1a 2a 3a 4a") and it is recorded here, not applied.', id: 'pending' }) : '';
  const answeredCard = pdAnswered.length ? section(`Answered (${pdAnswered.length})`,
    `<ul class="plain">${pdAnswered.map((x) => `<li class="small"><b>${esc(x.title)}</b>: ${esc(x.choice)} <span class="muted">(${esc(onDay(x.answered_at))})</span></li>`).join('')}</ul>`,
  { sub: 'Your replies, newest first: recorded from the BB Picks chat; the chats apply them, the bot never does.', id: 'answered', wide: true, fold: 'today.answered' }) : '';
  const droppedLine = pdDropped.length ? `<details class="since" style="border-left-color:var(--muted)"><summary class="small muted">Dropped: ${pdDropped.length} old question${pdDropped.length === 1 ? '' : 's'} with no answer</summary>
    <ul class="plain">${pdDropped.map((x) => `<li class="small muted">${esc(x.title)}${x.withdrawn_at ? ' (withdrawn as stale)' : ''}</li>`).join('')}</ul></details>` : '';
  const todoLine = pdTodo.map((x) => `<div class="since" style="cursor:default;border-left-color:var(--muted)"><span class="since-label">To do</span>
    <span class="since-facts small">${esc(x.label)}${x.why ? ` <span class="muted">(${esc(x.why)})</span>` : ''}${x.answered_at
      ? ` <span class="muted">· you said: ${esc(x.choice)}, ${esc(onDay(x.answered_at))}</span>` : ''}</span></div>`).join('');

  const liveToggle = `<button type="button" class="link small" data-set="liveOn" data-value="${S.liveOn ? 'false' : 'true'}">${S.liveOn ? 'Pause live' : 'Resume live'}</button>`;
  // Live's in-play finding (29 Oct 2026, the orchestrator's ask): in play, our number is less sharp than Superbet's
  // outside fouls; nothing sent changes (the live alerts stay paper, half-time only)
  const liveCard = inPlay.length ? section(`In play (${inPlay.length})`, `<div class="picks">${inPlay.map((p) => pickCard(p, now)).join('')}</div>`,
    { sub: (S.liveOn ? 'Live from ESPN every 75 seconds while this page is open; a count ESPN lacks comes from the laptop.' : 'Live updates are paused to save data.')
        + ' In play, Superbet\'s live price is sharper outside fouls; the live alerts stay paper.', id: 'live', actions: liveToggle, wide: true, fold: 'today.live' }) : '';

  // the day's bets first, a line each (the user, 30 Oct 2026: "make Today more slick and collapse most parts on top"): the ✅ BET
  // picks still to start, best first, a tap opens the pick; every card below folded behind its title until opened
  const bets = sorted.filter((p) => p.verdict === 'BET');
  const yours = sorted.filter((p) => p.verdict === 'UNPROVEN');      // 🧪 unproven: your call (the user's rule of 31 Oct 2026), after the bets
  const kickOf = (p) => (!p.kick ? '' : ukDay(p.kick) === ukDay(new Date(now)) ? ukHM(p.kick) : `${dayLabel(ukDay(p.kick) || '').slice(0, 3)} ${ukHM(p.kick)}`);   // another day's: its day too
  const betLine = (p) => `<button type="button" class="bet-line" data-pick="${esc(p.key)}">
      <span class="bl-main"><span class="bl-bet">${p.verdict === 'UNPROVEN' ? verdictChip(p) : ''}${tierBadge(p, TIER_ON, TIER_STATUS)}${esc(p.bet)}</span><span class="bl-match muted">${esc(kickOf(p))} · ${esc(p.match)}</span></span>
      <span class="bl-side">${bookChip(p.book)}<span class="bl-price">${odds(p.price)}</span><span class="${signClass(p.edge)} small">${spct(p.edge)}</span><span class="bl-profit" title="${esc(amountOf(p).sub)}">${amountOf(p).v}</span></span></button>`;
  const betsCard = section(`To bet (${bets.length}${yours.length ? ` · 🧪 ${yours.length} your call` : ''})`, `${bets.length ? `<div class="lines">${bets.map(betLine).join('')}</div>`
    : `<p class="empty">No ✅ bet open${sport !== 'all' ? ' in this sport' : ''} right now: the picks on paper are under "All picks".</p>`}
    ${yours.length ? `<h3 class="sub-h">🧪 Unproven: your call (${yours.length})</h3><p class="muted small">Lanes still proving themselves, each its own record: send them if you choose, at a stake you choose.</p><div class="lines">${yours.map(betLine).join('')}</div>` : ''}`,
  { sub: 'Each line: the pick, kick-off and match; the bookmaker, price, overlay and stake (the real-money amount where the plan has one). Tap one for its card.', id: 'bets' });

  const FULL = 5;                                                   // the best five in full, the rest a line each (a tap opens one)
  const rest = sorted.slice(FULL);
  const restLine = (p) => `<button type="button" class="bet-line" data-pick="${esc(p.key)}">
      <span class="bl-main"><span class="bl-bet">${verdictChip(p)}${tierBadge(p, TIER_ON, TIER_STATUS)}${esc(p.bet)}</span><span class="bl-match muted">${esc(p.kick ? ukHM(p.kick) : '')} · ${esc(p.match)}</span></span>
      <span class="bl-side">${bookChip(p.book)}<span class="bl-price">${odds(p.price)}</span><span class="${signClass(p.edge)} small">${spct(p.edge)}</span><span class="bl-profit" title="${esc(amountOf(p).sub)}">${amountOf(p).v}</span></span></button>`;
  const restList = rest.length ? `<h3 class="sub-h">${rest.length} more, best first</h3><div class="lines">${rest.map(restLine).join('')}</div>`: '';
  // basketball's and the NHL's own sections (5 Nov 2026): their picks a line each, their games' tables, their best bets' rows
  const PGB = ((D.feed.pregame || {}).sports || {}).basketball;
  const basketCard = sport === 'all' || sport === 'basketball'
    ? sportDay('basketball', sorted.filter((p) => p.sport === 'basketball'), PGB, D.feed.early_winners, now, restLine,
      PGB && PGB.score ? pgScore(PGB.score, Object.fromEntries((PGB.stats || []).map((x) => [x.id, x.label])), 'basketball') : '') : '';
  const nhlCard = sport === 'all' || sport === 'nhl' ? sportDay('nhl', sorted.filter((p) => p.sport === 'nhl'), (D.feed.today || {}).nhl_games, D.feed.early_winners, now, restLine, '', paperOf(D.bets, 'nhl', now)) : '';
  const toPlace = section(`All picks (${upcoming.length}: ${upcoming.filter((p) => p.verdict === 'BET').length} to bet)`, upcoming.length ? `<div class="picks">${sorted.slice(0, FULL).map((p) => pickCard(p, now)).join('')}</div>${restList}`
    : `<p class="empty">Nothing open to place${sport !== 'all' ? ' in this sport' : ''} right now. The next run's picks arrive here on their own.</p>`,
  { sub: sport === 'basketball' ? 'Basketball: the team counts sent 🧪 unproven, your call (since 31 Oct, their own record); the player lines stay paper. Each card says why.'
    : 'Each card says first: ✅ bet, 🧪 unproven: your call (a lane still proving itself, its own record), 📄 paper (don’t bet) or ⛔ don’t bet. Stake on the 1,000 bank; "place" is the real-money plan after the 500 day cap and the bookmakers’ caps.', id: 'place', wide: true, fold: 'today.picks' });

  // the early look (scripts/early_look.py, the user's ask of 18 Oct 2026, late evening): what a run would make of the lines
  // read so far, nothing logged; the bot's /early reads the same feed (one source)
  const E = D.feed.early || {};
  const eRows = (E.rows || []).filter((r) => sport === 'all' || (r.sport || 'football') === sport)   // tennis and basketball rows carry their sport
    .sort((a, b) => (a.bar !== 'send') - (b.bar !== 'send') || String(a.kick).localeCompare(String(b.kick)) || b.edge - a.edge);
  const eQuiet = (E.matches || []).filter((m) => !m.picks && m.note && (sport === 'all' || sport === 'football'));
  const whenOf = (k) => `${dayLabel(ukDay(k) || '').slice(0, 3)} ${esc(ukHM(k))}`;
  const early = eRows.length || eQuiet.length ? section(`Early look (${eRows.filter((r) => r.bar === 'send').length} would go out)`, `
    ${eRows.length ? `<div class="lines">${eRows.map((r) => `<details class="early-line"><summary class="bet-line">
        <span class="bl-main"><span class="bl-bet"><span class="vchip v-paper">📄 not a pick yet</span>${esc(r.bet)}</span><span class="bl-match muted">${whenOf(r.kick)} · ${esc(r.match)}${r.comp ? ` · ${esc(compName(r.comp))}` : ''}</span></span>
        <span class="bl-side">${bookChip(r.book)}<span class="bl-price">${odds(r.price)}</span><span class="${signClass(r.edge)} small">${spct(r.edge)}</span><span class="tag${r.bar === 'send' ? ' tag-fast' : ''}">${r.bar === 'send' ? 'would send' : 'keep back'}</span></span></summary>
        <p class="small">${esc(r.why || '')}</p>
        <p class="muted small">Our chance ${pct(r.ours)} against the ${pct(r.needs)} the price needs${r.stake ? `; stake ${money(r.stake, '£', 1, false)}` : ''}${r.other ? ` · ${esc(r.other)}` : ''}; read ${esc(r.read || '')} UK.</p></details>`).join('')}</div>`
    : '<p class="empty">No line clears 10% yet.</p>'}
    ${eQuiet.length ? `<details class="fold"><summary>${eQuiet.length} matches without a pick, and why</summary><ul class="plain">${eQuiet.map((m) => `<li><b>${esc(m.match)}</b> <span class="muted">${whenOf(m.kick)}</span>: ${esc(m.note)}</li>`).join('')}</ul></details>` : ''}`,
  { wide: true, fold: 'today.early', sub: `What a run would make of the lines read so far (made ${esc(ukStamp(E.made_greek).slice(5))}): league matches on the stat picks’ rule, European ones on fouls and offsides at half stake${E.more_made_greek ? `; tennis and basketball on their lanes’ own rules (made ${esc(ukStamp(E.more_made_greek).slice(5))})` : ''}. Not logged and not picks yet: the runs decide at their own prices.`, id: 'early' }) : '';

  // H77 (the user's choice of 24 Oct 2026): a new-team match's lines, through the same bars, on paper and never sent: shown to
  // look at and place by hand if the user chooses; the new side and "would be sent" or why kept back lead the reason
  const ntRows = sport === 'all' || sport === 'football'
    ? D.bets.filter((r) => r.set === 'newteam' && r.status === 'open' && (!r.kickAt || r.kickAt.getTime() > now - 3 * 3600e3))
      .sort((a, b) => (a.kickAt || 0) - (b.kickAt || 0) || (b.edge || 0) - (a.edge || 0)) : [];
  const newTeam = ntRows.length ? section(`New team, on paper (${ntRows.length})`, `<div class="lines">${ntRows.map((r) => `<details class="early-line"><summary class="bet-line">
      <span class="bl-main"><span class="bl-bet">${esc(r.bet)}</span><span class="bl-match muted">${whenOf(r.kick)} · ${esc(r.match)}${r.comp ? ` · ${esc(compName(r.comp))}` : ''}</span></span>
      <span class="bl-side">${bookChip(r.book)}<span class="bl-price">${odds(r.price)}</span><span class="${signClass(r.edge)} small">${spct(r.edge)}</span><span class="tag tag-warn">new team</span></span></summary>
      <p class="small">${esc(r.why || '')}</p>
      <p class="muted small">Our chance ${pct(r.ours)} against the ${pct(r.needs)} the price needs; paper stake ${money(r.stake, '£', 1, false)}.</p></details>`).join('')}</div>`,
  { wide: true, fold: 'today.newteam', sub: 'Lines in matches where a side has under 20 matches in the data. No pick goes out there, so these go through the same bars, staked on paper and settled apart: not picks, to look at and place by hand if you choose.',
    actions: `<button class="link" ${goAttr({ tab: 'results', sport: 'football', set: 'newteam' })}>Record →</button>`, id: 'newteam' }) : '';

  const intlCard_ = sport === 'all' || sport === 'football' ? intlCard((D.feed.today || {}).intl, D.bets, now) : '';   // 🌍 the internationals (7 Nov 2026)
  const CU = (D.feed.today || {}).cups || {};
  const cupTies = sport === 'all' || sport === 'football'
    ? (CU.ties || []).filter((t) => !t.kick || new Date(t.kick).getTime() > now - 2.5 * 3600e3) : [];
  const cupsCard = cupTies.length ? section(`Domestic cups (${cupTies.length}, new competition)`, `<div class="lines cup-ties">${cupTies.map(cupTie).join('')}</div>`,
    { wide: true, fold: 'today.cups', id: 'cups', sub: `${esc(Object.values(CU.cups || {}).join(', '))}: each tie still to come, our paper forecast beside the bookmakers’ lines (made ${esc(String(CU.made || '').slice(5))} UK). The stats that are ours: those that beat a cup’s own average walking forward (shots and on target; the Coppa Italia on target alone), every stat in the Greek Cup (a league match at that venue, your method); the others are starred and never flagged; 20%+ means our chance times the price, at 1.50 to 3.00. A new competition: paper only, nothing picked or staked.` }) : '';

  // the weekend's early view, all sports (the orchestrator's ask of 29 Oct 2026): a fixture preview, not picks yet (a run
  // makes those closer to kick-off) - board.py's weekend_view(), built from the same pregame and cups data this page already
  // reads, so it costs nothing extra to fetch
  const WK = D.feed.weekend || {};
  const weekendCard = (WK.days || []).length ? section(`The weekend ahead (${esc(String(WK.from || '').slice(5))} to ${esc(String(WK.to || '').slice(5))})`, `
    ${WK.days.map((d) => `<h3 class="sub-h">${esc(dayLabel(d.day))} <span class="muted small">${d.comps.reduce((n, c) => n + c.n, 0)} fixtures</span></h3>
      <ul class="plain">${d.comps.map((c) => `<li><b>${esc(c.comp)}</b> <span class="muted">(${esc(c.sport)})</span>: ${c.n}</li>`).join('')}</ul>`).join('')}
    <p class="muted small">What we read there: ${Object.entries(WK.what || {}).map(([sp, w]) => `<b>${esc(sp)}</b> ${esc(w)}`).join('; ')}.</p>`,
  { wide: true, fold: 'today.weekend', sub: "A fixture preview, not picks: those come from a run closer to kick-off. Fills in on its own as the week's runs add to the schedule.", id: 'weekend' }) : '';

  const T = D.feed.today || {};
  const dbl = (T.doubles || []);
  const doubles = dbl.length ? section(`Doubles (${dbl.length})`, `<div class="minis">${dbl.map(doubleCard).join('')}</div>`, { wide: true, fold: 'today.doubles', sub: 'The best three a bookmaker, as the last run sent them. A double repeats its legs’ singles.' }) : '';
  // PF, the user's own parlay filter (fm/pf.py, H103; the user's ask of 1 Nov 2026): each bookmaker's top 5 of today's football
  // picks, folded under the picks; a preference, never a stake signal (H103's walk-forward did not prove it)
  const PF = T.pf || {};
  const pfCard = PF.day ? section('Your PF filter: the top 5 a bookmaker', (PF.books || []).length ? `<div class="minis">${PF.books.map((b) => `<article class="mini">
    <div class="mini-top">${bookChip(b.book)}<span class="vchip v-paper">a preference</span></div>
    <ul class="legs">${b.legs.map((l) => `<li><span>${esc(l.bet)}${l.note ? ` <i class="muted">(${esc(l.note)})</i>` : ''}</span><span class="muted small">${esc(l.match)} · ${esc(l.kick)} UK · ${spct(l.ov)}</span><b>${odds(l.price)}</b></li>`).join('')}</ul>
    ${b.more ? `<div class="mini-foot"><span class="muted small">and ${b.more} more past these</span></div>` : ''}
  </article>`).join('')}</div>` : '<p class="muted">Nothing among today’s picks still to kick off passes your filter.</p>',
  { wide: true, fold: 'today.pf', id: 'pf', sub: `Today’s football picks through your filter: fouls, shots and throw-ins and the level picks; no Premier League, no ●○○, not 15-19% over the price, a stake of 10 or more, throw-ins overs at Novibet only; each pick’s line at every bookmaker that prices it, one a match, best overlay first, matches still to kick off today (UK). ${esc((PF.label || '').replace(/\s*\(H\d+[^)]*\)/, '').replace(/^./, (c) => c.toUpperCase()))}. Made ${esc(PF.made || '')} UK.` }) : '';
  // multiples (fm/multiples.py, the user's ask of 2 Nov 2026): a double and a treble a bookmaker from the day's bets, on paper, your
  // call; and your own slip: tick picks, each bookmaker's combined price, our chance and overlay at once (nothing is placed)
  const MU = T.multiples || {};
  const muSlip = (name, s) => !s ? '' : `<li><span><b>${name}</b> ${s.legs.map((x) => esc(x.bet)).join(' + ')}<span class="muted small"> · ${s.legs.map((x) => esc(x.match)).join(' · ')}${s.apart ? ` · legs start ${esc(s.kicks.join(', '))} UK` : ` · ${esc(s.kicks[0] || '')} UK`}</span></span>
    <span class="muted small">our chance ${Math.round(100 * s.chance)}% · ${spct(s.ov)}</span><b>${odds(s.price)}</b></li>`;
  const slipPicks = sorted.filter((p) => isNum(p.price) && p.book);
  const multiCard = (MU.books || []).length || slipPicks.length ? section('Multiples: a double and a treble a bookmaker', `${(MU.books || []).length ? `<div class="minis">${MU.books.map((b) => `<article class="mini">
    <div class="mini-top">${bookChip(b.book)}<span class="vchip v-paper">your call</span></div>
    <ul class="legs">${muSlip('Double', b.double)}${muSlip('Treble', b.treble)}</ul></article>`).join('')}</div>` : '<p class="muted">No bookmaker has two of today’s bets that fit (20%+ over, priced 1.50-2.50, one a match, no Premier League, no offsides).</p>'}
    ${slipPicks.length ? `<details class="fold slip-build"><summary>Build your own slip (${slipPicks.length} picks)</summary>
      <p class="muted small">Tick picks: each bookmaker’s slip shows its combined price, our chance and the overlay. Nothing is placed.</p>
      <div class="slip-out small" data-slip-out><span class="muted">Nothing ticked yet.</span></div>
      <ul class="plain slip-list">${slipPicks.map((p) => `<li><label class="small"><input type="checkbox" data-slip data-book="${esc(p.book)}" data-price="${p.price}" data-ours="${isNum(p.ours) ? p.ours : (isNum(p.edge) ? (1 + p.edge) / p.price : '')}" data-match="${esc(p.match)}" data-bet="${esc(p.bet)}">
        ${esc(p.bet)} <span class="muted">· ${esc(p.match)} · ${esc(p.book)} ${odds(p.price)}</span></label></li>`).join('')}</ul></details>` : ''}`,
  { wide: true, fold: 'today.multi', id: 'multi', sub: `On paper, your call: a slip idea from the day’s bets, not a pick. Our chance multiplies the legs’ chances (different matches). ${MU.day ? `For ${esc(dayLabel(MU.day))}; made ${esc(MU.made || '')} UK.` : ''}` }) : '';
  // Stoiximan's throw-ins against ours (Rest's logs/throwins_scan.json, H117b, 2 Nov 2026): a line a match, folded under the picks;
  // Europe's 🧪 unproven (your call), the domestic ones on the usual rules (sent only if the picks' bar passes them)
  const TS = T.throwins_scan || {};
  const tsRows = TS.rows || [];
  const tsChip = (r) => r.where === 'Europe' ? '<span class="vchip v-unproven">🧪 unproven: your call</span>'
    : r.sent ? '<span class="vchip v-bet">sent</span>' : '<span class="vchip v-paper">the usual rules</span>';
  const throwinsCard = tsRows.length ? section(`Stoiximan scan: throw-ins, goal kicks, fouls (${tsRows.length})`, `<div class="minis">${tsRows.map((r) => `<article class="mini">
    <div class="mini-top">${bookChip('Stoiximan')}${tsChip(r)}</div>
    <ul class="legs"><li><span>${esc(r.bet)}${r.outside ? ' <i class="muted">(⚠ a line further out than we have tested)</i>' : ''}</span><span class="muted small">${esc(r.match)} (${esc(r.league)}) · ${esc(r.kick)} UK · ${spct(r.ov)}</span><b>${odds(r.price)}</b></li></ul>
    <div class="mini-foot"><span class="muted small">ours ${Number(r.ours).toFixed(1)}, our chance ${Math.round(100 * r.chance)}%${r.club != null ? `, the clubs’ own ${Number(r.club).toFixed(1)}` : ''}${r.other_price ? ` · the other side ${odds(r.other_price)}` : ''}${r.superbet ? ` · Superbet ${esc(r.superbet)}` : ''}${r.betsson ? ` · Betsson ${esc(r.betsson)}` : ''}</span></div>
  </article>`).join('')}</div>`,
  { wide: true, fold: 'today.throwins', id: 'throwins', sub: `Stoiximan’s throw-ins lines against our count, a line a match still to kick off, best overlay first. Europe’s are 🧪 unproven: your call; the domestic ones are sent only if the picks’ bar passes them. Made ${esc(TS.made || '')} UK.` }) : '';
  // the day's checked top picks as one parlay (fm/top_check.py, CAPABILITIES 1c, 29 Oct 2026): paper only, never a bet
  const tp = (T.top_parlay || {}).parlay;
  const tpRec = (T.top_parlay || {}).record || {};
  const topParlay = tp && (tp.legs || []).length >= 2 ? section('Top picks parlay (paper)', `<div class="minis"><article class="mini">
    <div class="mini-top">${bookChip(tp.bookmaker)}<span class="vchip v-paper">📄 PAPER</span><b class="mini-price">${odds(tp.paid || tp.price)}</b></div>
    <ul class="legs">${tp.legs.map((l) => `<li><span>${esc(l.text || l.leg)}</span><span class="muted small">${esc(l.match)}${l.kick ? ' · ' + esc(ukHM(l.kick)) : ''}</span><b>${odds(l.price)}</b></li>`).join('')}</ul>
    <div class="mini-foot"><span>chance ${pct(tp.chance)}</span><span class="${signClass(tp.overlay)}">overlay ${spct(tp.overlay)}</span><span>paper stake ${money(tp.stake, '£', 2, false)}</span></div>
  </article></div>`, { wide: true, fold: 'today.topparlay', sub: `The day's checked top picks at one bookmaker, from different matches${tp.bonus ? `, its ${Math.round(tp.bonus * 100)}% parlay bonus counted` : ''}. Don't bet: on paper until it shows on its own record${tpRec.settled ? ` (so far ${tpRec.won} of ${tpRec.settled} won, ${money(tpRec.profit, '£', 2)})` : ''}.` }) : '';
  const bbList = (T.bb || []).filter((x) => !x.kick || fromGreek(x.kick).getTime() > now - 3 * 3600e3);
  const bb = bbList.length ? section(`BB ideas (${bbList.length}, paper)`, `<div class="minis">${bbList.map((x) => `<article class="mini">
      <div class="mini-top">${bookChip(x.book)}<span class="muted small">${esc(x.kick ? ukHM(x.kick) : '')}${x.rank ? ' · #' + x.rank : ''}</span><b class="mini-price">${odds(isNum(x.eff) && x.eff > x.price ? x.eff : x.price)}</b></div>
      <button type="button" class="pick-title" data-match="${esc(x.match)}">${esc(x.match)}</button>
      <ul class="legs">${x.legs.map((l) => `<li><span>${esc(l.bet)}</span>${l.base ? '<i class="leg-tag leg-base">our model backs it</i>' : l.why ? '<i class="leg-tag">added</i>' : ''}${l.why && !l.base ? `<span class="muted">${esc(l.why)}</span>` : ''}</li>`).join('')}</ul>
      <div class="mini-foot"><span>chance ${pct(x.chance)}</span><span class="${signClass(x.edge)}">edge ${spct(x.edge)}</span>${isNum(x.boost) && x.boost > 0 ? `<span>boost ${pct(x.boost)}</span>` : ''}</div>
      ${bbRivals(x)}
      ${x.why ? `<p class="muted small" style="margin:0">${esc(x.why)}</p>` : ''}
    </article>`).join('')}</div>`, { wide: true, fold: 'today.bb', sub: 'The BB machine’s bet builders at Stoiximan and Superbet: legs our model backs, priced on our cautious chances, with the other bookmaker’s price for the same legs where it has one. On paper only, settled apart: never the paper account.' }) : '';
  const fun = [...(T.goals || []).map((x) => funCard(x, 'goals')), ...(T.fun || []).map((x) => funCard(x, 'fun'))];
  const cover = (T.cover || []).map((c) => `<li>${bookChip(c.book)} <b>${esc(c.bet)}</b> <span class="muted">${esc(c.match)} · ${esc(c.kick || '')}</span> <b>${odds(c.price)}</b> <span class="muted">place ${money(c.place, '£', 0, false)}</span></li>`).join('');
  // Pamestoixima's promo treble (H34, CAPABILITIES 26, 29 Oct 2026): board.py's pame_promo(), ledger/pame_promo.md
  // read straight through; beside the goals parlays, same as the weekend cover bet - never a pick
  const promo = T.promo || {};
  const promoRows = (promo.rows || []).map((r) => `<li><b>${esc(r.weekend)}</b> @${odds(r.price)} <span class="tag${r.outcome === 'won' ? ' tag-fast' : r.outcome === 'lost' || r.outcome === 'free bet back' ? ' tag-warn' : ''}">${esc(r.outcome)}</span>${r.outcome !== 'open' ? ` <span class="${signClass(r.cash)}">${money(r.cash, '£', 2)}</span>` : ''}</li>`).join('');
  const funCard_ = fun.length || cover || promoRows ? section('For fun (never picks)', `${cover ? `<p class="small muted">Weekend cover bet:</p><ul class="plain">${cover}</ul>` : ''}${promoRows ? `<p class="small muted">Pamestoixima's promo treble:</p><p class="small">${esc(promo.summary || '')}</p><ul class="plain">${promoRows}</ul>` : ''}${fun.length ? `<details class="fold"><summary>${fun.length} goals and fun parlays of the latest run</summary><div class="minis">${fun.join('')}</div></details>` : ''}`,
    { wide: true, fold: 'today.fun', sub: 'Your own wagering: never paper, never mixed with the picks. The bookmakers’ margin is in every leg.' }) : '';

  // this week, football's paper account
  const wk = weekStart(today);
  const weekRows = D.bets.filter((r) => r.set === 'paper' && r.sport === 'football' && r.day >= wk && r.day <= addDays(wk, 6));
  const gWeek = agg(weekRows);
  const week = section('This week', `<p class="record-line">${recordLine(gWeek)}</p><div class="chart" id="ch-week"></div>
    <div class="chart chart-sm" id="ch-bank30"></div>`, { wide: true, fold: 'today.week', sub: 'Football’s paper account, Monday to Sunday by match day; below it the running profit of the last 30 days.', actions: `<button class="link" ${goAttr({ tab: 'results', range: '7d' })}>Results →</button>` });

  // who found the line in the last 7 days, each sport with 30 counts or more (scripts/line_judge.py; the Lines tab)
  const lineWeek = rowsOf(D.feed.lines).filter((r) => r.day >= addDays(today, -6) && r.day <= today);
  const lineSports = ['football', 'basketball', 'tennis'].map((sp) => ({ sp, who: byWho(lineWeek.filter((r) => r.sport === sp), D.feed.lines?.who || []).filter((x) => x.n >= 30) }))
    .filter((x) => x.who.length);
  const linesCard = lineSports.length ? section('Who read the lines best this week', `<div class="lines">${lineSports.map(({ sp, who }) => {
    const ranked = [...who].sort((a, b) => b.found - a.found);
    return `<button type="button" class="bet-line" ${goAttr({ tab: 'lines', range: '7d', lineSport: sp })}><span class="bl-main"><span class="bl-bet">${esc(sp[0].toUpperCase() + sp.slice(1))}: ${esc(ranked[0].who)} found ${pct(ranked[0].found)} <span class="muted" aria-hidden="true">›</span></span>
      <span class="bl-match muted">${ranked.slice(1).map((x) => `${esc(x.who)} ${pct(x.found)}`).join(' · ')} · ${ranked[0].n} counts</span></span></button>`;
  }).join('')}</div>`, { wide: true, fold: 'today.lines', sub: 'Found it: the count on one of the two whole numbers either side of each one’s 50/50 line (20.5 finds 20 or 21), the last 7 days, each on the counts it priced. Tap a sport for its Lines tab and the fair test on the same counts.', actions: `<button class="link" ${goAttr({ tab: 'lines', range: '7d' })}>Lines →</button>` }) : '';

  const paper = D.bets.filter((r) => r.set === 'paper' && r.sport === 'football');
  const all = D.bets.filter((r) => r.sport === 'football');
  const top = insights(D, paper, all).slice(0, 4);
  const ins = top.length ? section('Worth knowing', `<div class="insights">${top.map(insightCard).join('')}</div>`, { wide: true, fold: 'today.insights', actions: `<button class="link" ${goAttr({ tab: 'ideas' })}>All ideas →</button>` }) : '';

  const recent = D.bets.filter((r) => r.set === 'paper' && r.settled && (r.day === today || r.day === addDays(today, -1))).sort((a, b) => (b.kickAt || 0) - (a.kickAt || 0));
  const settledLine = (r) => `<button type="button" class="bet-line" data-bet="${esc(r.id)}"><span class="bl-main"><span class="bl-bet">${esc(r.bet)}</span><span class="bl-match muted">${esc(r.match)} · came to ${esc(r.actual ?? '–')}</span></span><span class="bl-side">${bookChip(r.book)}<span class="bl-price">${odds(r.price)}</span>${statusTag(r.status)}<span class="bl-profit ${signClass(r.profit)}">${money(r.profit, '£', 2)}</span></span></button>`;
  const recentBySport = ['football', 'basketball', 'tennis'].map((sp) => ({ sp, g: agg(recent.filter((r) => r.sport === sp)) })).filter((x) => x.g.n);   // never summed across sports
  const settled = recent.length ? section(`Settled today and yesterday (${recent.length})`, `<p class="record-line">${recentBySport.map((x) => `<b>${esc(x.sp[0].toUpperCase() + x.sp.slice(1))}</b> ${x.g.won} of ${x.g.n} won, <b class="${signClass(x.g.profit)}">${money(x.g.profit, '£')}</b>`).join(' · ')}</p>
    <div class="lines">${recent.slice(0, 8).map(settledLine).join('')}</div>
    ${recent.length > 8 ? `<details class="fold"><summary>The other ${recent.length - 8}</summary><div class="lines">${recent.slice(8).map(settledLine).join('')}</div></details>` : ''}`,
  { wide: true, fold: 'today.settled', actions: `<button class="link" ${goAttr({ tab: 'results', range: '7d' })}>Results →</button>` }) : '';

  // since the last visit (this phone's own memory of what it saw): settled bets and new picks, one tap to see them
  const since = ctx.since ? ctx.since() : null;
  const sinceStrip = since && (since.settled.length || since.picks.length) ? `<button type="button" class="since" data-since="1">
      <span class="since-label">Since your last visit</span>
      <span class="since-facts">${since.settled.length ? `<b>${since.settled.length}</b> settled, ${since.won} won, <b class="${signClass(since.profit)}">${money(since.profit, '£', 0)}</b>` : ''}${since.settled.length && since.picks.length ? ' · ' : ''}${since.picks.length ? `<b>${since.picks.length}</b> new pick${since.picks.length > 1 ? 's' : ''}` : ''}</span>
      <span class="since-go" aria-hidden="true">›</span></button>` : '';

  const slipList = (D.feed && D.feed.slips) || [];
  const slipsCard = slipList.length ? section(`Your slips (${slipList.length})`, `<div class="minis">${slipList.map(slipCard).join('')}</div>`,
    { wide: true, fold: 'today.slips', sub: 'Slips pasted to the BB Picks bot and judged there: each part, the whole bet on our cautious chances, a better swap from our picks. Your own wagering: never the paper account.' }) : '';
  // the section follows the sport switch: football's view with its slip, builders, ideas and scorecard; basketball's and tennis's
  // (PG.sports, the R14 task of 23 Oct 2026) their own games and scorecard; "all" the three under their own headings
  const PG = D.feed.pregame || {};
  const PGS = PG.sports || {};
  const football = sport === 'all' || sport === 'football';
  const pgMatches = football ? (PG.matches || []) : [];
  const pgBuilders = football ? (PG.builders || []) : [];
  const pgOthers = ['tennis'].filter((sp) => (sport === 'all' || sport === sp) && PGS[sp]);   // basketball's in its own section (5 Nov 2026)
  const pgCount = pgMatches.length + pgOthers.reduce((n, sp) => n + (PGS[sp].matches || []).length, 0);
  const pgLabel = (s) => Object.fromEntries((s.stats || []).map((x) => [x.id, x.label]));
  const pgOther = (sp) => {
    const s = PGS[sp], ms = s.matches || [];
    return `${sport === 'all' ? `<h3 class="sub-h">${sp === 'basketball' ? 'Basketball: paper only, not for betting' : 'Tennis'} (${ms.length}) <span class="muted small">made ${esc(String(s.made || '').slice(5))} UK · ${esc((s.books || []).join(', then '))}</span></h3>` : ''}
      ${ms.length ? `<div class="lines">${ms.map((m) => pgLine(m, s.stats)).join('')}</div>` : '<p class="muted small">No game still to start in the view.</p>'}
      ${pgScore(s.score, pgLabel(s), sp)}`;
  };
  const pregame = pgCount || (football && (PG.slip || pgBuilders.length)) || pgOthers.length ? section(`Pre-game view (${pgCount})`, `${pgMatches.length ? `${pgOthers.length ? '<h3 class="sub-h">Football</h3>' : ''}<div class="lines">${pgMatches.map((m) => pgLine(m, PG.stats)).join('')}</div>` : ''}
    ${football && PG.slip ? `<h3 class="sub-h">The gap slip of the day</h3><div class="minis">${gapSlipCard(PG.slip)}</div>` : ''}
    ${gapBuilders(pgBuilders)}
    ${football ? pgIdeas(PG.ideas) + pgScore(PG.score) : ''}
    ${football && (PG.usual || []).length ? `<p class="muted small">The usual gaps (our number's habit, not news): ${esc(PG.usual.join('; '))}.</p>` : ''}
    ${pgOthers.map(pgOther).join('')}`,
  { wide: true, fold: 'today.pregame', sub: `Every ${football ? 'match' : 'game'} still to come, our number against the bookmaker's level for each stat${football ? ` (football made ${esc(String(PG.made || '').slice(5))} UK)` : ''}. The biggest gaps here; tap one for its full table. 🟢🟡 judged on the count's spread, ▼ we expect fewer, ▲ more. Tennis on paper, Superbet first; basketball's games and the NHL's are in their own sections.`, id: 'pregame' }) : '';
  // the cross-bookmaker angles (scripts/cross_angles.py, lane B, 22 Oct 2026): pairs that cannot lose, lines one bookmaker hangs
  // off the others and our number, the middles; on paper, basketball and tennis
  const A = D.feed.angles || {};
  const aShow = (r) => sport === 'all' || r.sport === sport;
  const aCannot = (A.cannot || []).filter(aShow), aOff = (A.off || []).filter(aShow), aMid = (A.middles || []).filter(aShow);
  const aLine = (r, extra) => `<div class="bet-line static"><span class="bl-main"><span class="bl-bet">${esc(r.a)} + ${esc(r.b)}</span><span class="bl-match muted">${mLink(r.match)} · ${esc(r.market)} · ${esc(ukStamp(r.start).slice(5))}</span></span><span class="bl-side small">${extra}</span></div>`;
  const angles = aCannot.length || aOff.length || aMid.length ? section(`Cross-bookmaker angles (${aCannot.length + aOff.length} on paper)`, `
    ${aCannot.length ? `<h3 class="sub-h">Cannot lose (${aCannot.length})</h3><div class="lines">${aCannot.map((r) => aLine(r, `cost ${num(r.cost, 3)} · ${spct(1 / r.cost - 1)} back`)).join('')}</div>` : ''}
    ${aOff.length ? `<h3 class="sub-h">A line off the others and our number (${aOff.length})</h3><div class="lines">${aOff.map((r) => `<div class="bet-line static"><span class="bl-main"><span class="bl-bet">${esc(r.a)}</span><span class="bl-match muted">${mLink(r.match)} · ${esc(r.b)} · ${esc(ukStamp(r.start).slice(5))}</span></span><span class="bl-side small">ours ${pct(r.both)} · <span class="${signClass(r.ev)}">${spct(r.ev)}</span></span></div>`).join('')}</div>` : ''}
    ${aMid.length ? `<details class="fold"><summary>Middles, best ${aMid.length} of ${A.n_middles}</summary><p class="muted small">Their return leans on our own chances: a lead, not an edge (H59, 22 Oct: our tennis engine priced no better than Superbet's own side markets). Only the pairs that cannot lose stand without our number.</p><div class="lines">${aMid.map((r) => aLine(r, `both ${pct(r.both)} · <span class="${signClass(r.ev)}">${spct(r.ev)}</span>`)).join('')}</div></details>` : ''}`,
  { wide: true, fold: 'today.angles', sub: `Two bookmakers' lines side by side (found ${esc(String(A.found || '').slice(5))} UTC). On paper only: read both books' rules for a retirement or a void before calling a pair safe, aces and double faults above all.`, id: 'angles' }) : '';
  // today's decisions that change what to do (fm.verdict.decisions, planning/DECISIONS.md) and the calls made in the chats
  // (logs/pick_calls.json): the user's ask of 27 Oct 2026, "need also dashboard bb to reflect eventually our decision"; the same
  // evening, "move decisions somewhere more discreet ... each one to its section for sport only": a fold near the page's end,
  // each item shown only with its own sport (under "All sports", under its sport's heading). The newest call on a view stands.
  const DEC_SPORTS = ['football', 'basketball', 'tennis'];
  const DEC_NAME = { football: 'Football', basketball: 'Basketball', tennis: 'Tennis' };
  const sportOfText = (t) => (/basket|euroleague|eurocup|\bgbl\b|\bacb\b|\bnba\b|assists|rebounds|threes/i.test(t) ? 'basketball'
    : /tennis|\baces?\b|\batp\b|\bwta\b/i.test(t) ? 'tennis' : 'football');
  const pickSport = {};
  for (const p of D.today) if (p.match && p.sport) pickSport[p.match] = p.sport;
  const lastCall = {};
  for (const c of D.feed.calls || []) lastCall[`${c.match}|${c.view || c.line}`] = c;
  const decItems = [
    ...Object.values(lastCall).map((c) => ({ sport: c.sport || pickSport[c.match] || sportOfText(`${c.match} ${c.line}`),
      html: `<li><span class="vchip ${V_CLASS[c.verdict] || 'v-paper'}">${esc(c.verdict === 'PAPER' ? '📄 PAPER' : "⛔ DON'T BET")}</span><b>${esc(c.line)}</b> <span class="muted">(${esc(c.match)})</span>: ${esc(c.reason || '')}</li>` })),
    ...(D.feed.decisions || []).map((x) => ({ sport: x.sport || sportOfText(x.text || ''),
      html: `<li>${esc(x.text)} <span class="muted small">${esc(x.who || '')}</span></li>` })),
  ].filter((x) => sport === 'all' || x.sport === sport);
  const decGroups = DEC_SPORTS.map((sp) => ({ sp, li: decItems.filter((x) => x.sport === sp) })).filter((g) => g.li.length);
  const decisionsCard = decItems.length ? section(`Decisions today (${decItems.length})`, decGroups.map((g) =>
    `${sport === 'all' ? `<h3 class="sub-h">${DEC_NAME[g.sp]} (${g.li.length})</h3>` : ''}<ul class="plain">${g.li.map((x) => x.html).join('')}</ul>`).join(''),
  { wide: true, fold: 'today.decisions', id: 'decisions' }) : '';
  const guide = guideCard(D.feed.today?.guide);                    // "How our numbers work", on today's top pick (29 Oct 2026)
  const nba = sport === 'all' || sport === 'basketball' ? nbaCard(D.feed.nba, now) : '';   // the NBA on paper (29 Oct 2026)
  const aces = sport === 'all' || sport === 'tennis' ? acesCard(D.feed.tennis_aces, now)
    + eventsCard(D.feed.tennis_events) : '';   // aces lines across the bookmakers (30 Oct 2026), each event day by day (Live's, 1 Nov)
  const more = sport === 'all' || sport === 'football' ? moreCard(D.feed.more_leagues, S, now) + parityCard(D.feed.more_parity)
    + moreView(D.feed.more_view) : '';   // the extra leagues on paper, their checklist (30 Oct 2026), how their view did and each cell’s way (1 Nov)
  // the treble of the day (fm/tier_badge.treble, 31 Oct 2026): the best three tier-1 picks from different matches, paper
  const TR = TIER_ON ? ((D.feed.today || {}).treble || []) : [];
  const trebleCard = TR.length === 3 ? section('Treble of the day (paper)', `<div class="lines">${TR.map((x) => `<button type="button" class="bet-line" data-pick="${esc(x.key)}">
      <span class="bl-main"><span class="bl-bet">${tierBadge({ tier: 1 }, true, TIER_STATUS)}${esc(x.bet)}</span><span class="bl-match muted">${esc(x.kick ? ukHM(x.kick) : '')} · ${esc(x.match)}</span></span>
      <span class="bl-side">${bookChip(x.book)}<span class="bl-price">${odds(x.price)}</span><span class="${signClass(x.edge)} small">${spct(x.edge)}</span></span></button>`).join('')}</div>
    <p class="small">Together ${odds(TR.reduce((m, x) => m * (x.price || 1), 1))} at the prices shown. Paper: never a stake until it shows on its own record.</p>`,
  { id: 'treble', sub: 'The day’s best three tier-1 picks, one a match, by overlay.' }) : '';
  const TD = D.feed.today || {};
  // 👤 each sport's player lines, folded under its own part (DECISIONS 0f4a4b2, 6 Nov 2026; players.js)
  const pl = (sp) => (sport === 'all' || sport === sp ? playerCard(TD.player_lines, sp, D.feed.early_winners, now) : '');
  const html = sinceStrip + hero + filterBar + pendingCard + betsCard + trebleCard + middlesCard(TD.middles, now, sport) + liveCard
    + (sport === 'all' || sport === 'football' ? inplayCard(TD.inplay, now) : '') + toPlace + pfCard + multiCard + throwinsCard + (sport === 'all' || sport === 'football' ? gapsCard((D.feed.today || {}).gaps, now) : '') + intlCard_ + pl('football') + basketCard + pl('basketball') + nba + nhlCard + pl('nhl') + guide + aces + (sport === 'all' || sport === 'tennis' ? liveTrackedCard(D.bets, now) : '') + pl('tennis') + more + pregame + angles + early + newTeam + cupsCard + weekendCard + topParlay + doubles + bb + slipsCard + week + linesCard + ins + settled + decisionsCard + answeredCard + droppedLine + todoLine + funCard_;
  const mount = () => {
    const days = [];
    for (let i = 0; i < 7; i++) {
      const d = addDays(wk, i);
      const g = agg(weekRows.filter((r) => r.day === d));
      days.push({ label: `${dayLabel(d).slice(0, 3)}\n${+d.slice(8)}`, value: g.profit || 0, sub: g.n ? `${g.won} of ${g.n} won · ${money(g.staked, '£', 0, false)} staked` : (g.open ? `${g.open} open` : 'no bets'), day: d });
    }
    const el = document.getElementById('ch-week');
    if (el) C.bars(el, days, { fmt: C.FMT.gbp, horizontal: false, height: 190, onClick: (r) => ctx.go({ tab: 'results', range: 'custom', from: r.day, to: r.day }) });
    const from = addDays(today, -30);
    const run = paper.filter((r) => r.settled && r.day >= from);
    let total = 0;
    const pts = run.sort((a, b) => (a.kickAt || 0) - (b.kickAt || 0)).map((r) => { total += r.profit || 0; return [r.kickAt ? r.kickAt.getTime() : fromGreek(r.day).getTime(), Math.round(total * 100) / 100, `${r.bet} · ${r.status}`]; });
    const el2 = document.getElementById('ch-bank30');
    if (el2 && pts.length) { el2.style.height = '150px'; C.runningChart(el2, [{ name: 'Paper account', pts }]); }
  };
  return { html, mount };
}

export function insightCard(x) {
  return `<article class="insight tone-${x.tone}">
    <button type="button" class="ins-main" ${x.go ? goAttr(x.go) : ''}><h3>${esc(x.title)}</h3><p>${x.body}</p><span class="ins-go">Show me →</span></button>
    ${x.idea ? `<div class="ins-idea"><span>${esc(x.idea.title)}</span><button type="button" class="btn-copy" data-copy="${esc(x.idea.ask)}">Copy request</button></div>` : ''}
  </article>`;
}

// your own slip (the multiples card, 2 Nov 2026): the ticked picks, a slip a bookmaker; the combined price, our chance (the legs'
// chances multiplied) and the overlay; two legs in one match flagged (they move together, so the chance is only a guide)
export function slipSummary(rows) {
  const by = {};
  for (const r of rows) (by[r.book] = by[r.book] || []).push(r);
  return Object.entries(by).map(([book, legs]) => {
    const price = legs.reduce((a, x) => a * x.price, 1);
    const known = legs.every((x) => isNum(x.ours) && x.ours > 0);
    const chance = known ? legs.reduce((a, x) => a * x.ours, 1) : null;
    const matches = new Set(legs.map((x) => x.match));
    return { book, n: legs.length, price, chance, ov: known ? chance * price - 1 : null, sameMatch: matches.size < legs.length };
  });
}
if (typeof document !== 'undefined') {
  document.addEventListener('change', (e) => {
    if (!e.target.matches || !e.target.matches('[data-slip]')) return;
    const card = e.target.closest('.slip-build');
    const out = card && card.querySelector('[data-slip-out]');
    if (!out) return;
    const rows = [...card.querySelectorAll('[data-slip]:checked')].map((x) => ({ book: x.dataset.book, price: Number(x.dataset.price),
      ours: x.dataset.ours === '' ? null : Number(x.dataset.ours), match: x.dataset.match }));
    out.innerHTML = rows.length ? slipSummary(rows).map((s) => `<div>${bookChip(s.book)} <b>${s.n} leg${s.n === 1 ? '' : 's'}</b> · <b>${odds(s.price)}</b>${s.chance === null ? '' : ` · our chance ${Math.round(100 * s.chance)}% · <span class="${signClass(s.ov)}">${spct(s.ov)}</span>`}${s.sameMatch ? ' <span class="muted">(two legs in one match move together: the chance is only a guide)</span>' : ''}</div>`).join('')
      : '<span class="muted">Nothing ticked yet.</span>';
  });
}
