// Today: what to place now (best first, every column the picks table carries), what is in play with its count so far,
// the day's doubles and fun parlays, then this week in one glance and the three things worth knowing.

import { esc, money, pct, spct, odds, num, isNum, until, greekDay, dayLabel, addDays, weekStart, fromGreek, load } from '../util.js';
import { bookChip, statusTag, confPill, signClass, section, goAttr, chips, recordLine } from '../ui.js';
import { agg, byDay } from '../metrics.js';
import { compName } from '../data.js';
import * as C from '../charts.js';
import { state as liveState, standing } from '../live.js';
import { insights } from '../insights.js';
import { rowsOf, byWho } from '../lines.js';

const SORTS = [{ id: 'best', label: 'Best first' }, { id: 'kick', label: 'By kick-off' }];

// the BB Picks bot's name (the feed's), for the Placed button's link: none, no button
let BOT = null;
export function setBot(name) { BOT = name || null; }
// placed or not: the record's taps (the slip's buttons and the board's), and a tap from this phone the feed has not caught up with
function placedControl(p) {
  if (!BOT || !p.tap || p.wait) return '';
  if (p.mine) return `<div class="pick-placed"><span class="tag tag-placed">✓ placed${p.mine_at ? ` ${esc(p.mine_at.slice(11))}` : ''}</span>${p.mine_as ? `<span class="small">as ${esc(p.mine_as)}: the same bet, don't place it again</span>` : `<button type="button" class="link small" data-unplace="${esc(p.tap)}">undo</button>`}</div>`;
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

export function pickCard(p, now) {
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
    <div class="pick-top">
      <span class="kick">${p.kick ? esc(p.kick.slice(11)) : '–'}<span class="muted"> GR · ${started ? (live && live.state === 'in' ? 'in play' : 'started') : until(kick - now)}</span></span>
      <span class="pick-tags">${sentTag}${gone}${confPill(p.conf)}</span>
    </div>
    <button type="button" class="pick-title" data-match="${esc(p.match)}">${esc(p.match)} <span class="muted small">${esc(compName(p.comp))}</span></button>
    <div class="pick-bet"><span>${esc(p.bet)}</span>${bookChip(p.book, { go: { tab: 'slices', f: { book: [p.book] }, rows: 'stat', cols: 'side' } })}${p.url && /^https:\/\/www\.stoiximan\.gr\//.test(p.url) ? `<a class="link small" href="${esc(p.url)}" target="_blank" rel="noopener">open at ${esc(p.book)} ↗</a>` : ''}</div>
    <div class="pick-grid">
      <div><small>Price</small><b>${odds(p.price)}</b>${changed}</div>
      <div><small>Fair</small><b>${odds(p.fair)}</b></div>
      <div><small>Overlay</small><b class="${signClass(p.edge)}">${spct(p.edge)}</b></div>
      <div><small>Stake</small><b>${money(p.stake, '£', 2, false)}</b>${p.wait ? '<span class="small muted">place on the match day</span>' : isNum(p.place) ? `<span class="small muted">place ${money(p.place, '£', 0, false)}</span>` : ''}</div>
    </div>
    <div class="pick-chance">
      ${chanceBar(p.ours, p.needs, p.bookp)}
      <div class="pick-levels">${isNum(p.expected) ? `We expect <b>${num(p.expected, 1)}</b>, they price <b>${num(p.theirs, 1)}</b>` : ''}${isNum(p.signals) ? `<span class="muted"> · ${p.signals} signal${p.signals === 1 ? '' : 's'}</span>` : ''}</div>
    </div>
    ${rivals.length ? `<div class="rivals">${rivals.map((r) => {
    const other = isNum(r.line) && isNum(p.line) && r.line !== p.line;          // another line of the same view: its own overlay
    const ov = isNum(r.edge) ? r.edge : overlayAt(p.ours, r.price);
    return isNum(r.price)
      ? `<span class="rival">${bookChip(r.book)}${other ? ` <span class="muted">${esc(r.way || p.side || '')} ${num(r.line, 1)}</span>` : ''} ${odds(r.price)} <span class="${signClass(ov)}">${spct(ov)}</span>${r.earlier ? ` <span class="muted small">earlier, ${esc(String(r.earlier).slice(5))}</span>` : ''}</span>`
      : `<span class="rival">${bookChip(r.book)} <span class="muted">line ${num(r.line, 1)}</span></span>`;
  }).join('')}</div>` : ''}
    ${p.b365 ? `<p class="muted small">${bookChip('bet365')} ${esc(p.b365)}</p>` : ''}
    ${p.counted ? `<p class="muted small">Counted once in the record, as first shown: ${esc(p.counted.bet || '')} at ${esc(p.counted.book || '')} ${odds(p.counted.price)} (${spct(p.counted.edge)}), ${esc(String(p.counted.shown || '').slice(5))}.</p>` : ''}
    ${saferLine(p)}
    ${p.heat && !started ? heatNote(p) : ''}
    ${moved.length ? `<div class="moved">${moved.map((m) => `<span>↪ ${money(m.place, '£', 0, false)} at ${bookChip(m.at)} ${esc(m.bet || '')} ${odds(m.price)}</span>`).join('')}</div>` : ''}
    ${liveBlock}
    ${placedControl(p)}
    <details class="why"><summary>Why, and the rest</summary>
      <p>${esc(p.why || 'No reason saved.')}</p>
      ${p.conf_why ? `<p class="muted small">Confidence: ${esc(p.conf_why)}</p>` : ''}
      ${isNum(p.ours) && p.sport === 'football' ? `<p class="small">Still over the 20% send bar down to <b>${odds(1.2 / p.ours)}</b>; break-even on our chance at ${odds(1 / p.ours)}.</p>` : ''}
      <p class="muted small">Shown ${p.runs > 1 ? `${p.runs} times, first at ${esc(p.first_at || '')} at ${odds(p.first_price)}` : `at ${esc(p.shown || '')}`}${p.read ? `; price read ${esc(p.read)} GR` : ''}. The bookmaker's own chance ${pct(p.bookp)}.</p>
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
  const notes = (m.splits || []).map((s) => `<li>🔀 ${esc((label[s.stat] || s.stat).toLowerCase())}: the match total agrees; ${esc(s.down)} under, ${esc(s.up)} over <span class="muted">(H68's split builders: paper)</span></li>`).join('');
  const combo = m.combo ? `<li>🧩 at ${esc(m.combo.book)}: ${esc(m.combo.legs.map((l) => `${l.row === 't' ? 'match' : l.team} ${(label[l.stat] || l.stat).toLowerCase()} ${l.way} (ours ${num(l.ours, 1)}, theirs ${num(l.theirs, 1)})`).join(' + '))} <span class="muted">(builder idea: paper)</span></li>` : '';
  return `<div class="pg-wrap"><table class="pg">${head}${body}</table></div>${notes || combo ? `<ul class="plain small">${notes}${combo}</ul>` : ''}`;
}
function pgLine(m, stats) {
  const label = Object.fromEntries((stats || []).map((s) => [s.id, s.label]));
  const gaps = [];
  for (const r of m.rows) for (const [id, c] of Object.entries(r.cells)) if (c.mark) gaps.push({ r, id, c });
  gaps.sort((a, b) => Math.abs(b.c.sd) - Math.abs(a.c.sd));
  const said = gaps.slice(0, 3).map((g) => `${PG_EMOJI[g.c.mark]} ${esc(g.r.row === 't' ? 'match' : g.r.team)} ${esc((label[g.id] || g.id).toLowerCase())} ${PG_ARROW[g.c.arrow]}${num(Math.abs(g.c.diff), 1)}`);
  return `<button type="button" class="bet-line" data-match="${esc(m.match)}"><span class="bl-main"><span class="bl-bet">${esc(m.match)}</span><span class="bl-match muted">${esc(dayLabel(String(m.kick || '').slice(0, 10)).slice(0, 3))} ${esc(String(m.kick || '').slice(11))} GR · ${esc(compName(m.comp))} · ${said.length ? said.join(' · ') : 'no big gap'}${(m.splits || []).length ? ' · 🔀' : ''}</span></span></button>`;
}
function gapSlipCard(s) {
  return `<article class="mini"><div class="mini-top"><span class="tag">gap slip · paper</span><span class="muted small">${esc(s.day || '')}</span><b class="mini-price">${odds(s.price)}</b></div>
    <ul class="legs">${(s.legs || []).map((l) => `<li><span>${esc(l.pick)}</span><b>${odds(l.price)}</b><span class="muted">${mLink(l.match)} · ${esc(String(l.kick || '').slice(11))} GR · ours ${pct(l.ours)}, Stoiximan's ${pct(l.theirs)}</span></li>`).join('')}</ul>
    <div class="mini-foot"><span>our chance ${pct(s.ours)}</span><span>Stoiximan's ${pct(s.theirs)}</span><span>stake ${money(s.stake, '£', 0, false)}</span></div>
    <p class="muted small" style="margin:0">The day's biggest tested gaps at Stoiximan, one leg a match. For fun: never a pick, never the paper account (ledger/gap_slips.md).</p></article>`;
}
// the gap builders (scripts/gap_builders.py, the user's 78 slip of 21 Oct 2026, asked for every run on 22 Oct): two legs of one
// stat in one match where our numbers lean from Stoiximan's, the day's best matches, their slip; paper, never a pick
function gapBuilderCard(b) {
  return `<article class="mini"><div class="mini-top"><span class="tag">builder · paper</span><span class="muted small">${esc(String(b.kick || '').slice(11))} GR · ${esc(compName(b.comp))}</span><b class="mini-price">≈ ${odds(b.price)}</b></div>
    <p class="small" style="margin:0"><b>${mLink(b.match)}</b></p>
    <ul class="legs">${(b.legs || []).map((l, i) => `<li><span>${esc(l)}</span><b>${odds((b.prices || [])[i])}</b></li>`).join('')}</ul>
    <div class="mini-foot"><span>ours ${pct(b.ours)}</span><span>Stoiximan's ${pct(b.theirs)}</span>${b.tested ? '' : '<span>⚠️ untested numbers</span>'}</div>
    <p class="muted small" style="margin:0">${esc(b.why || '')}. The price is predicted: check Stoiximan's builder.</p></article>`;
}
function gapBuilders(days) {
  return (days || []).map((d) => `<h3 class="sub-h">Gap builders, ${esc(d.day)}${d.slip ? ` · the best ${(d.slip.matches || []).length} together ≈ ${odds(d.slip.price)}, ours ${pct(d.slip.ours)}, Stoiximan's ${pct(d.slip.theirs)}` : ''}</h3>
    <div class="minis">${(d.builders || []).map(gapBuilderCard).join('')}</div>`).join('');
}

// the pre-game view's scorecard and builder ideas (scripts/pregame_score.py, the R14 task of 23 Oct 2026): ours against Stoiximan and
// Superbet against the count, 7 days (28 where 7 is empty); the ideas and grade-A legs on paper, never picks
const PG_LABEL = { fouls: 'Fouls', shots: 'Shots', sot: 'On target', corners: 'Corners', offsides: 'Offsides', throwins: 'Throw-ins', goalkicks: 'Goal kicks', cards: 'Cards' };
function pgScore(sc, label = PG_LABEL, who = '') {
  if (!sc || !(sc.rows || []).length) return '';
  const win = sc.rows.some((r) => r.window === '7') ? '7' : '28';
  const rows = sc.rows.filter((r) => r.window === win && (r.book === 'Stoiximan' || r.book === 'Superbet'))
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
    ${ideas.length ? `<ul class="legs">${ideas.map((b) => `<li><span>${mLink(b.match)} ${esc(String(b.kick || '').slice(11))}: ${esc(b.legs.join(' + '))}</span> <b>≈${odds(b.price)}</b> <span class="muted">ours ${pct(b.ours)}, Stoiximan ${pct(b.theirs)} · ${esc(b.grades)}</span></li>`).join('')}</ul>` : ''}
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
    <div class="mini-top">${bookChip(s.book)}<span class="muted small">${esc((s.greek || '').slice(11))} GR · ${esc(s.kind || 'bet')}</span><b class="mini-price">${odds(s.price)}</b></div>
    <ul class="legs">${parts}</ul>
    <div class="mini-foot">${isNum(s.edge) ? `<span class="${signClass(s.edge)}">${spct(s.edge)} careful</span>` : ''}<span>${esc(s.verdict || '')}</span>${isNum(s.stake) ? `<span>stake ${num(s.stake, 2)}</span>` : ''}</div>
    ${s.swap ? `<p class="small" style="margin:0">Better: ${esc(s.swap.pick)} at ${esc(s.swap.at)}: ${odds(s.swap.price)}, <span class="${signClass(s.swap.edge)}">${spct(s.swap.edge)}</span></p>` : ''}
    <details class="fold"><summary>The bot's answer</summary><p class="small" style="white-space:pre-wrap;margin:0">${esc(s.text || '')}</p></details>
  </article>`;
}

function chanceBar(ours, needs, bookp) {
  if (!isNum(ours) || !isNum(needs)) return '';
  const w = (v) => Math.max(0, Math.min(100, v * 100)).toFixed(1);
  return `<div class="chance" role="img" aria-label="Our chance ${pct(ours)} against ${pct(needs)} the price needs">
    <div class="chance-track"><span class="chance-fill" style="width:${w(ours)}%"></span><span class="chance-need" style="left:${w(needs)}%" title="the price needs ${pct(needs)}"></span>${isNum(bookp) ? `<span class="chance-book" style="left:${w(bookp)}%" title="the bookmaker's own chance ${pct(bookp)}"></span>` : ''}</div>
    <div class="chance-legend"><span>Our chance <b>${pct(ours)}</b></span><span>needs <b>${pct(needs)}</b></span>${isNum(bookp) ? `<span class="muted">theirs ${pct(bookp)}</span>` : ''}</div>
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
    <ul class="legs">${(d.legs || []).map((l) => `<li><span>${esc(l.bet)}</span><span class="muted small">${esc(l.match)}${l.kick ? ' · ' + esc(l.kick.slice(11)) : ''}</span><b>${odds(l.price)}</b></li>`).join('')}</ul>
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

export function render(ctx) {
  const { D, S } = ctx;
  const now = Date.now();
  const today = greekDay();
  const sport = S.todaySport;
  const picks = D.today.filter((p) => sport === 'all' || p.sport === sport);
  const upcoming = picks.filter((p) => p.kickAt && p.kickAt.getTime() > now && p.status !== 'won' && p.status !== 'lost');
  const inPlay = picks.filter((p) => p.kickAt && p.kickAt.getTime() <= now && p.status !== 'won' && p.status !== 'lost' && now - p.kickAt.getTime() < 2.7 * 3600e3);
  const sorted = [...upcoming].sort(S.todaySort === 'kick'
    ? (a, b) => a.kickAt - b.kickAt || (b.stake || 0) - (a.stake || 0)
    : (a, b) => (b.stake || 0) - (a.stake || 0) || (b.edge || 0) - (a.edge || 0));
  const next = upcoming.length ? Math.min(...upcoming.map((p) => p.kickAt.getTime())) : null;
  const placeSum = upcoming.reduce((s, p) => s + (isNum(p.place) ? p.place : 0), 0);
  const paperToday = D.bets.filter((r) => r.set === 'paper' && r.sport === 'football' && r.day === today);
  const gToday = agg(paperToday);
  const byBook = {};
  for (const p of upcoming) byBook[p.book] = (byBook[p.book] || 0) + 1;

  const hero = `<section class="hero card">
    <div class="hero-date"><h1>${esc(dayLabel(today))}</h1><span class="muted">Greek time</span></div>
    <div class="hero-stats">
      <div><small>To place</small><b>${upcoming.length}</b><span class="muted small">${Object.entries(byBook).map(([b, n]) => `${esc(b)} ${n}`).join(' · ') || 'nothing open'}</span></div>
      <div><small>Next kick-off</small><b>${next ? esc(new Date(next).toLocaleTimeString('en-GB', { timeZone: 'Europe/Athens', hour: '2-digit', minute: '2-digit' })) : '–'}</b><span class="muted small">${next ? until(next - now) : 'no more today'}</span></div>
      <div><small>Real-money plan</small><b>${money(placeSum, '£', 0, false)}</b><span class="muted small">of the 500 day cap</span></div>
      <div><small>Paper today</small><b class="${signClass(gToday.profit)}">${gToday.n ? money(gToday.profit) : '–'}</b><span class="muted small">${gToday.n ? `${gToday.won} of ${gToday.n} won` : 'none settled yet'}${gToday.open ? ` · ${gToday.open} open` : ''}</span></div>
    </div>
    <div class="hero-controls">${chips('todaySport', [{ id: 'all', label: 'All sports' }, { id: 'football', label: 'Football' }, { id: 'basketball', label: 'Basketball' }, { id: 'tennis', label: 'Tennis' }], sport, { small: true })}
      ${chips('todaySort', SORTS, S.todaySort || 'best', { small: true })}</div>
  </section>`;

  const liveToggle = `<button type="button" class="link small" data-set="liveOn" data-value="${S.liveOn ? 'false' : 'true'}">${S.liveOn ? 'Pause live' : 'Resume live'}</button>`;
  const liveCard = inPlay.length ? section(`In play (${inPlay.length})`, `<div class="picks">${inPlay.map((p) => pickCard(p, now)).join('')}</div>`,
    { sub: S.liveOn ? 'Live from ESPN every 75 seconds while this page is open; a count ESPN lacks comes from the laptop.' : 'Live updates are paused to save data.', id: 'live', actions: liveToggle }) : '';

  const FULL = 5;                                                   // the best five in full, the rest a line each (a tap opens one)
  const rest = sorted.slice(FULL);
  const restList = rest.length ? `<h3 class="sub-h">${rest.length} more, best first</h3><div class="lines">${rest.map((p) => `<button type="button" class="bet-line" data-pick="${esc(p.key)}">
      <span class="bl-main"><span class="bl-bet">${esc(p.bet)}</span><span class="bl-match muted">${esc(p.kick ? p.kick.slice(11) : '')} · ${esc(p.match)}</span></span>
      <span class="bl-side">${bookChip(p.book)}<span class="bl-price">${odds(p.price)}</span><span class="${signClass(p.edge)} small">${spct(p.edge)}</span><span class="bl-profit">${money(p.stake, '£', 0, false)}</span></span></button>`).join('')}</div>` : '';
  const toPlace = section(`To place (${upcoming.length})`, upcoming.length ? `<div class="picks">${sorted.slice(0, FULL).map((p) => pickCard(p, now)).join('')}</div>${restList}`
    : `<p class="empty">Nothing open to place${sport !== 'all' ? ' in this sport' : ''} right now. The next run's picks arrive here on their own.</p>`,
  { sub: 'Each selection as its latest showing. Stake on the 1,000 bank; "place" is the real-money plan after the 500 day cap and the bookmakers’ caps.', id: 'place' });

  // the early look (scripts/early_look.py, the user's ask of 18 Oct 2026, late evening): what a run would make of the lines
  // read so far, nothing logged; the bot's /early reads the same feed (one source)
  const E = D.feed.early || {};
  const eRows = (E.rows || []).filter(() => sport === 'all' || sport === 'football')
    .sort((a, b) => (a.bar !== 'send') - (b.bar !== 'send') || String(a.kick).localeCompare(String(b.kick)) || b.edge - a.edge);
  const eQuiet = (E.matches || []).filter((m) => !m.picks && m.note && (sport === 'all' || sport === 'football'));
  const whenOf = (k) => `${dayLabel(String(k).slice(0, 10)).slice(0, 3)} ${esc(String(k).slice(11))}`;
  const early = eRows.length || eQuiet.length ? section(`Early look (${eRows.filter((r) => r.bar === 'send').length} would go out)`, `
    ${eRows.length ? `<div class="lines">${eRows.map((r) => `<details class="early-line"><summary class="bet-line">
        <span class="bl-main"><span class="bl-bet">${esc(r.bet)}</span><span class="bl-match muted">${whenOf(r.kick)} · ${esc(r.match)}${r.comp ? ` · ${esc(compName(r.comp))}` : ''}</span></span>
        <span class="bl-side">${bookChip(r.book)}<span class="bl-price">${odds(r.price)}</span><span class="${signClass(r.edge)} small">${spct(r.edge)}</span><span class="tag${r.bar === 'send' ? ' tag-fast' : ''}">${r.bar === 'send' ? 'would send' : 'keep back'}</span></span></summary>
        <p class="small">${esc(r.why || '')}</p>
        <p class="muted small">Our chance ${pct(r.ours)} against the ${pct(r.needs)} the price needs${r.stake ? `; stake ${money(r.stake, '£', 1, false)}` : ''}${r.conf ? ` · confidence ${esc(r.conf)}` : ''}${r.other ? ` · ${esc(r.other)}` : ''}; read ${esc(r.read || '')} UK.</p></details>`).join('')}</div>`
    : '<p class="empty">No line clears 10% yet.</p>'}
    ${eQuiet.length ? `<details class="fold"><summary>${eQuiet.length} matches without a pick, and why</summary><ul class="plain">${eQuiet.map((m) => `<li><b>${esc(m.match)}</b> <span class="muted">${whenOf(m.kick)}</span>: ${esc(m.note)}</li>`).join('')}</ul></details>` : ''}`,
  { fold: 'today.early', sub: `What a run would make of the lines read so far (made ${esc(String(E.made_greek || '').slice(5))} GR): league matches on the stat picks’ rule, European ones on fouls and offsides at half stake. Not logged and not picks yet: the runs decide at their own prices.`, id: 'early' }) : '';

  const T = D.feed.today || {};
  const dbl = (T.doubles || []);
  const doubles = dbl.length ? section(`Doubles (${dbl.length})`, `<div class="minis">${dbl.map(doubleCard).join('')}</div>`, { fold: 'today.doubles', sub: 'The best three a bookmaker, as the last run sent them. A double repeats its legs’ singles.' }) : '';
  const bbList = (T.bb || []).filter((x) => !x.kick || fromGreek(x.kick).getTime() > now - 3 * 3600e3);
  const bb = bbList.length ? section(`BB ideas (${bbList.length}, paper)`, `<div class="minis">${bbList.map((x) => `<article class="mini">
      <div class="mini-top">${bookChip(x.book)}<span class="muted small">${esc(x.kick ? x.kick.slice(11) : '')} GR${x.rank ? ' · #' + x.rank : ''}</span><b class="mini-price">${odds(isNum(x.eff) && x.eff > x.price ? x.eff : x.price)}</b></div>
      <button type="button" class="pick-title" data-match="${esc(x.match)}">${esc(x.match)}</button>
      <ul class="legs">${x.legs.map((l) => `<li><span>${esc(l.bet)}</span>${l.base ? '<i class="leg-tag leg-base">our model backs it</i>' : l.why ? '<i class="leg-tag">added</i>' : ''}${l.why && !l.base ? `<span class="muted">${esc(l.why)}</span>` : ''}</li>`).join('')}</ul>
      <div class="mini-foot"><span>chance ${pct(x.chance)}</span><span class="${signClass(x.edge)}">edge ${spct(x.edge)}</span>${isNum(x.boost) && x.boost > 0 ? `<span>boost ${pct(x.boost)}</span>` : ''}</div>
      ${bbRivals(x)}
      ${x.why ? `<p class="muted small" style="margin:0">${esc(x.why)}</p>` : ''}
    </article>`).join('')}</div>`, { fold: 'today.bb', sub: 'The BB machine’s bet builders at Stoiximan and Superbet: legs our model backs, priced against our careful chances, with the other bookmaker’s price for the same legs where it has one. On paper only, settled apart: never the paper account.' }) : '';
  const fun = [...(T.goals || []).map((x) => funCard(x, 'goals')), ...(T.fun || []).map((x) => funCard(x, 'fun'))];
  const cover = (T.cover || []).map((c) => `<li>${bookChip(c.book)} <b>${esc(c.bet)}</b> <span class="muted">${esc(c.match)} · ${esc(c.kick || '')}</span> <b>${odds(c.price)}</b> <span class="muted">place ${money(c.place, '£', 0, false)}</span></li>`).join('');
  const funCard_ = fun.length || cover ? section('For fun (never picks)', `${cover ? `<p class="small muted">Weekend cover bet:</p><ul class="plain">${cover}</ul>` : ''}${fun.length ? `<details class="fold"><summary>${fun.length} goals and fun parlays of the latest run</summary><div class="minis">${fun.join('')}</div></details>` : ''}`,
    { fold: 'today.fun', sub: 'Your own wagering: never paper, never mixed with the picks. The bookmakers’ margin is in every leg.' }) : '';

  // this week, football's paper account
  const wk = weekStart(today);
  const weekRows = D.bets.filter((r) => r.set === 'paper' && r.sport === 'football' && r.day >= wk && r.day <= addDays(wk, 6));
  const gWeek = agg(weekRows);
  const week = section('This week', `<p class="record-line">${recordLine(gWeek)}</p><div class="chart" id="ch-week"></div>
    <div class="chart chart-sm" id="ch-bank30"></div>`, { fold: 'today.week', sub: 'Football’s paper account, Monday to Sunday by match day; below it the running profit of the last 30 days.', actions: `<button class="link" ${goAttr({ tab: 'results', range: '7d' })}>Results →</button>` });

  // who found the line in the last 7 days, each sport with 30 counts or more (scripts/line_judge.py; the Lines tab)
  const lineWeek = rowsOf(D.feed.lines).filter((r) => r.day >= addDays(today, -6) && r.day <= today);
  const lineSports = ['football', 'basketball', 'tennis'].map((sp) => ({ sp, who: byWho(lineWeek.filter((r) => r.sport === sp), D.feed.lines?.who || []).filter((x) => x.n >= 30) }))
    .filter((x) => x.who.length);
  const linesCard = lineSports.length ? section('Who read the lines best this week', `<div class="lines">${lineSports.map(({ sp, who }) => {
    const ranked = [...who].sort((a, b) => b.found - a.found);
    return `<button type="button" class="bet-line" ${goAttr({ tab: 'lines', range: '7d', lineSport: sp })}><span class="bl-main"><span class="bl-bet">${esc(sp[0].toUpperCase() + sp.slice(1))}: ${esc(ranked[0].who)} found ${pct(ranked[0].found)} <span class="muted" aria-hidden="true">›</span></span>
      <span class="bl-match muted">${ranked.slice(1).map((x) => `${esc(x.who)} ${pct(x.found)}`).join(' · ')} · ${ranked[0].n} counts</span></span></button>`;
  }).join('')}</div>`, { fold: 'today.lines', sub: 'Found it: the count on one of the two whole numbers either side of each one’s 50/50 line (20.5 finds 20 or 21), the last 7 days, each on the counts it priced. Tap a sport for its Lines tab and the fair test on the same counts.', actions: `<button class="link" ${goAttr({ tab: 'lines', range: '7d' })}>Lines →</button>` }) : '';

  const paper = D.bets.filter((r) => r.set === 'paper' && r.sport === 'football');
  const all = D.bets.filter((r) => r.sport === 'football');
  const top = insights(D, paper, all).slice(0, 4);
  const ins = top.length ? section('Worth knowing', `<div class="insights">${top.map(insightCard).join('')}</div>`, { fold: 'today.insights', actions: `<button class="link" ${goAttr({ tab: 'ideas' })}>All ideas →</button>` }) : '';

  const recent = D.bets.filter((r) => r.set === 'paper' && r.settled && (r.day === today || r.day === addDays(today, -1))).sort((a, b) => (b.kickAt || 0) - (a.kickAt || 0));
  const settledLine = (r) => `<button type="button" class="bet-line" data-bet="${esc(r.id)}"><span class="bl-main"><span class="bl-bet">${esc(r.bet)}</span><span class="bl-match muted">${esc(r.match)} · came to ${esc(r.actual ?? '–')}</span></span><span class="bl-side">${bookChip(r.book)}<span class="bl-price">${odds(r.price)}</span>${statusTag(r.status)}<span class="bl-profit ${signClass(r.profit)}">${money(r.profit, '£', 2)}</span></span></button>`;
  const recentBySport = ['football', 'basketball', 'tennis'].map((sp) => ({ sp, g: agg(recent.filter((r) => r.sport === sp)) })).filter((x) => x.g.n);   // never summed across sports
  const settled = recent.length ? section(`Settled today and yesterday (${recent.length})`, `<p class="record-line">${recentBySport.map((x) => `<b>${esc(x.sp[0].toUpperCase() + x.sp.slice(1))}</b> ${x.g.won} of ${x.g.n} won, <b class="${signClass(x.g.profit)}">${money(x.g.profit, '£')}</b>`).join(' · ')}</p>
    <div class="lines">${recent.slice(0, 8).map(settledLine).join('')}</div>
    ${recent.length > 8 ? `<details class="fold"><summary>The other ${recent.length - 8}</summary><div class="lines">${recent.slice(8).map(settledLine).join('')}</div></details>` : ''}`,
  { fold: 'today.settled', actions: `<button class="link" ${goAttr({ tab: 'results', range: '7d' })}>Results →</button>` }) : '';

  // since the last visit (this phone's own memory of what it saw): settled bets and new picks, one tap to see them
  const since = ctx.since ? ctx.since() : null;
  const sinceStrip = since && (since.settled.length || since.picks.length) ? `<button type="button" class="since" data-since="1">
      <span class="since-label">Since your last visit</span>
      <span class="since-facts">${since.settled.length ? `<b>${since.settled.length}</b> settled, ${since.won} won, <b class="${signClass(since.profit)}">${money(since.profit, '£', 0)}</b>` : ''}${since.settled.length && since.picks.length ? ' · ' : ''}${since.picks.length ? `<b>${since.picks.length}</b> new pick${since.picks.length > 1 ? 's' : ''}` : ''}</span>
      <span class="since-go" aria-hidden="true">›</span></button>` : '';

  const slipList = (D.feed && D.feed.slips) || [];
  const slipsCard = slipList.length ? section(`Your slips (${slipList.length})`, `<div class="minis">${slipList.map(slipCard).join('')}</div>`,
    { fold: 'today.slips', sub: 'Slips pasted to the BB Picks bot and judged there: each part, the whole bet on the careful chances, a better swap from our picks. Your own wagering: never the paper account.' }) : '';
  // the section follows the sport switch: football's view with its slip, builders, ideas and scorecard; basketball's and tennis's
  // (PG.sports, the R14 task of 23 Oct 2026) their own games and scorecard; "all" the three under their own headings
  const PG = D.feed.pregame || {};
  const PGS = PG.sports || {};
  const football = sport === 'all' || sport === 'football';
  const pgMatches = football ? (PG.matches || []) : [];
  const pgBuilders = football ? (PG.builders || []) : [];
  const pgOthers = ['basketball', 'tennis'].filter((sp) => (sport === 'all' || sport === sp) && PGS[sp]);
  const pgCount = pgMatches.length + pgOthers.reduce((n, sp) => n + (PGS[sp].matches || []).length, 0);
  const pgLabel = (s) => Object.fromEntries((s.stats || []).map((x) => [x.id, x.label]));
  const pgOther = (sp) => {
    const s = PGS[sp], ms = s.matches || [];
    return `${sport === 'all' ? `<h3 class="sub-h">${sp === 'basketball' ? 'Basketball' : 'Tennis'} (${ms.length}) <span class="muted small">made ${esc(String(s.made || '').slice(5))} UK · ${esc((s.books || []).join(', then '))}</span></h3>` : ''}
      ${ms.length ? `<div class="lines">${ms.map((m) => pgLine(m, s.stats)).join('')}</div>` : '<p class="muted small">No game still to start in the view.</p>'}
      ${pgScore(s.score, pgLabel(s), sp)}`;
  };
  const pregame = pgCount || (football && (PG.slip || pgBuilders.length)) || pgOthers.length ? section(`Pre-game view (${pgCount})`, `${pgMatches.length ? `${pgOthers.length ? '<h3 class="sub-h">Football</h3>' : ''}<div class="lines">${pgMatches.map((m) => pgLine(m, PG.stats)).join('')}</div>` : ''}
    ${football && PG.slip ? `<h3 class="sub-h">The gap slip of the day</h3><div class="minis">${gapSlipCard(PG.slip)}</div>` : ''}
    ${gapBuilders(pgBuilders)}
    ${football ? pgIdeas(PG.ideas) + pgScore(PG.score) : ''}
    ${football && (PG.usual || []).length ? `<p class="muted small">The usual gaps (our number's habit, not news): ${esc(PG.usual.join('; '))}.</p>` : ''}
    ${pgOthers.map(pgOther).join('')}`,
  { fold: 'today.pregame', sub: `Every ${football ? 'match' : 'game'} still to come, our number against the bookmaker's level for each stat${football ? ` (football made ${esc(String(PG.made || '').slice(5))} UK)` : ''}. The biggest gaps here; tap one for its full table. 🟢🟡 judged on the count's spread, ▼ we expect fewer, ▲ more. Basketball and tennis on paper: Stoiximan first in basketball, Superbet first in tennis.`, id: 'pregame' }) : '';
  // the cross-bookmaker angles (scripts/cross_angles.py, lane B, 22 Oct 2026): pairs that cannot lose, lines one bookmaker hangs
  // off the others and our number, the middles; on paper, basketball and tennis
  const A = D.feed.angles || {};
  const aShow = (r) => sport === 'all' || r.sport === sport;
  const aCannot = (A.cannot || []).filter(aShow), aOff = (A.off || []).filter(aShow), aMid = (A.middles || []).filter(aShow);
  const aLine = (r, extra) => `<div class="bet-line static"><span class="bl-main"><span class="bl-bet">${esc(r.a)} + ${esc(r.b)}</span><span class="bl-match muted">${mLink(r.match)} · ${esc(r.market)} · ${esc(String(r.start || '').slice(5))} GR</span></span><span class="bl-side small">${extra}</span></div>`;
  const angles = aCannot.length || aOff.length || aMid.length ? section(`Cross-bookmaker angles (${aCannot.length + aOff.length} on paper)`, `
    ${aCannot.length ? `<h3 class="sub-h">Cannot lose (${aCannot.length})</h3><div class="lines">${aCannot.map((r) => aLine(r, `cost ${num(r.cost, 3)} · ${spct(1 / r.cost - 1)} back`)).join('')}</div>` : ''}
    ${aOff.length ? `<h3 class="sub-h">A line off the others and our number (${aOff.length})</h3><div class="lines">${aOff.map((r) => `<div class="bet-line static"><span class="bl-main"><span class="bl-bet">${esc(r.a)}</span><span class="bl-match muted">${mLink(r.match)} · ${esc(r.b)} · ${esc(String(r.start || '').slice(5))} GR</span></span><span class="bl-side small">ours ${pct(r.both)} · <span class="${signClass(r.ev)}">${spct(r.ev)}</span></span></div>`).join('')}</div>` : ''}
    ${aMid.length ? `<details class="fold"><summary>Middles, best ${aMid.length} of ${A.n_middles}</summary><p class="muted small">Their return leans on our own chances: a lead, not an edge (H59, 22 Oct: our tennis engine priced no better than Superbet's own side markets). Only the pairs that cannot lose stand without our number.</p><div class="lines">${aMid.map((r) => aLine(r, `both ${pct(r.both)} · <span class="${signClass(r.ev)}">${spct(r.ev)}</span>`)).join('')}</div></details>` : ''}`,
  { fold: 'today.angles', sub: `Two bookmakers' lines side by side (found ${esc(String(A.found || '').slice(5))} UTC). On paper only: read both books' rules for a retirement or a void before calling a pair safe, aces and double faults above all.`, id: 'angles' }) : '';
  const html = sinceStrip + hero + liveCard + toPlace + pregame + angles + early + doubles + bb + slipsCard + week + linesCard + ins + settled + funCard_;
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
