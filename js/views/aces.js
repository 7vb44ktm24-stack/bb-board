// Tennis aces lines across the bookmakers (scripts/tennis_aces_board.py; the orchestrator's ask of 30 Oct 2026, from the user: "a
// live picture of all games ... lines across all books, detailed"; v2 the same day, the user's spec). Every ATP and WTA match still
// to start with a two-way aces line, its venue; a grid of aces, double faults, games and sets: our expected count beside each book's,
// its main two-way line, the better side, its price and our overlay (bold at 10%+); why a book's aces sit an ace or more from ours
// (its match length or its aces rate); then, folded, each market's lines in full and the over-only ladders as posted (no margin
// out, no count, no overlay: an over-only ladder is not a line). Information, not picks. One folded card on Today, phone-first.
import { esc, pct, spct, num, isNum, dayLabel, ukDay, ukHM } from '../util.js';
import { section, signClass } from '../ui.js';

const th = (t, n) => `<th${n ? ' class="n"' : ''} style="padding:8px">${t}</th>`;
const BOLD_AT = 0.10;            // an overlay this big is shown in bold
const SHORT = { Superbet: 'Superbet', Stoiximan: 'Stoix.', Kambi: 'Kambi', Betsson: 'Betsson' };
// an under as the registry of what each screen shows has it (fm/outlet_display.py, 30 Oct 2026): one the site hides greyed and never
// the better side, one never checked marked; each with a * and its words under the table
const marked = (b, side = 'under') => `<span${b[`${side}_hidden`] ? ' class="muted"' : ''} title="${esc(b[`${side}_note`])}">${num(b[side], 2)}*</span>`;
// a side's words under the table; which side is judged when the other is not on the screen (Kambi's brands, 30 Oct 2026: neither)
const sideNote = (b, side) => {
  const other = side === 'under' ? 'over' : 'under';
  const judged = !b[`${side}_hidden`] ? '' : b[`${other}_hidden`] ? ': neither side is judged here' : `: its ${other} alone is judged here`;
  return `<p class="muted small" style="margin:2px 0 0">* ${esc(b.book)}’s ${side}: ${esc(b[`${side}_note`])}${judged}.</p>`;
};
const ov = (x) => (isNum(x) ? `<span class="${signClass(x)}">${x >= BOLD_AT ? `<b>${spct(x)}</b>` : spct(x)}</span>` : '');

// the grid's cell, three short lines so four books fit at 390 px: the book's expected count; its main two-way line with the better
// side; its price and our overlay
const PAD = 'style="padding:6px"';
const STAT_SHORT = { 'Double faults': 'D. faults' };
function cell(c, digits) {
  if (!c) return `<td class="n" ${PAD}>–</td>`;
  const line = isNum(c.line) ? `<br><span class="small">${c.side ? esc(c.side[0].toUpperCase()) + ' ' : ''}${num(c.line, 1)}</span>` : '';
  const price = isNum(c.price) ? `<br><span class="small">${num(c.price, 2)}${isNum(c.ov) ? ` ${ov(c.ov)}` : ''}</span>` : '';
  return `<td class="n" ${PAD}>${num(c.exp, digits)}${line}${price}</td>`;
}

function gridBlock(m, books) {
  if (!m.grid || !m.grid.length) return '';
  const cols = books.filter((b) => m.grid.some((r) => r.books && r.books[b]));
  const rows = m.grid.map((r) => {
    const d = r.stat === 'sets' ? 2 : 1;
    return `<tr><td ${PAD}>${esc(STAT_SHORT[r.label] || r.label)}</td><td class="n" ${PAD}><b>${num(r.ours, d)}</b></td>${cols.map((b) => cell(r.books[b], d)).join('')}</tr>`;
  }).join('');
  const thg = (t, n) => `<th${n ? ' class="n"' : ''} ${PAD}>${t}</th>`;
  return `<div class="tbl-wrap"><table class="tbl"><thead><tr>${thg('')}${thg('Ours', 1)}${cols.map((b) => thg(esc(SHORT[b] || b), 1)).join('')}</tr></thead><tbody>${rows}</tbody></table></div>`;
}

// why a book's aces sit an ace or more from ours: the share of the gap its match length explains
function whyBlock(m) {
  if (!m.why || !m.why.length) return '';
  return m.why.map((w) => `<p class="small" style="margin:4px 0 0">Why ${esc(w.book)}’s aces differ (${w.gap > 0 ? '+' : ''}${num(w.gap, 1)}): <b>${esc(w.tag)}</b>
    <span class="muted">(its ${num(w.games, 1)} games${isNum(w.sets) ? `, ${num(w.sets, 2)} sets` : ''} against our ${num(w.our_games, 1)}${isNum(w.our_sets) ? `, ${num(w.our_sets, 2)}` : ''}: ${w.length > 0 ? '+' : ''}${num(w.length, 1)} aces of it)</span></p>`).join('');
}

// Rest's paper lean, "follow Superbet" (logs/tennis_follow_paper.csv): the book furthest from Superbet's expected count, its side
function leanLine(k) {
  const l = k.lean;
  return l ? `<p class="small" style="margin:4px 0 0">📄 Lean, follow Superbet: <b>${esc(l.side)} ${num(l.line, 1)}</b> at ${esc(l.book)} ${num(l.price, 2)}${l.screen_note ? ` <span class="tag">${esc(l.screen_note)}</span>` : ''}
    <span class="muted">(${esc(k.label)}; its count ${l.gap > 0 ? '+' : ''}${num(l.gap, 1)} against Superbet’s; paper only)</span></p>` : '';
}

// the over-only ladders (bet365's, Stoiximan's "N+"): each step's price as posted and our chance of it, folded
function ladderBlock(ls) {
  if (!ls || !ls.length) return '';
  const steps = [...new Set(ls.flatMap((x) => x.steps.map((s) => s.line)))].sort((a, b) => a - b);
  const at = (x, line) => x.steps.find((s) => s.line === line);
  const rows = steps.map((line) => {
    const ours = ls.map((x) => at(x, line)).find((s) => s && isNum(s.ours));
    return `<tr><td class="n">over ${num(line, 1)}</td>${ls.map((x) => `<td class="n">${at(x, line) ? num(at(x, line).price, 2) : '–'}</td>`).join('')}<td class="n">${ours ? pct(ours.ours) : '–'}</td></tr>`;
  }).join('');
  return `<details class="fold"><summary class="small">Over-only ladders: ${ls.map((x) => `${esc(x.book)} <span class="muted">read ${esc(ukHM(x.read))}</span>`).join(', ')}</summary>
    <div class="tbl-wrap"><table class="tbl"><thead><tr>${th('Step', 1)}${ls.map((x) => th(esc(SHORT[x.book] || x.book), 1)).join('')}${th('Our over', 1)}</tr></thead><tbody>${rows}</tbody></table></div></details>`;
}

function marketBlock(k) {
  const tags = (k.differ ? ' <span class="tag tag-warn" title="The bookmakers hang different main lines">lines differ</span>' : '')
    + (k.tested ? '' : ' <span class="tag" title="Our number for one player’s aces has not been tested against the bookmakers’ lines">untested</span>');
  const rows = k.books.map((b) => `<tr><td>${esc(b.book)}<div class="muted small">read ${esc(ukHM(b.read))}</div></td>
    <td class="n">${num(b.line, 1)}</td><td class="n">${b.over_note ? marked(b, 'over') : num(b.over, 2)}<br>${b.under_note ? marked(b) : num(b.under, 2)}</td><td class="n">${pct(b.fair_over)}<br>${isNum(b.ours) ? pct(b.ours) : '–'}</td>
    <td>${b.best ? `${esc(b.best)}${b.under_hidden || b.over_hidden ? ' only' : ''}<br>${ov(b.best_ov)}` : '–'}</td></tr>`).join('');
  // the under's words first, as before; an over's only when Kambi's brands leave it off the screen too; one line when both sides
  // are off it for the same reason
  const note = k.books.flatMap((b) => (b.over_hidden && b.under_hidden && b.over_note === b.under_note
    ? [`<p class="muted small" style="margin:2px 0 0">* ${esc(b.book)}: ${esc(b.under_note)}: neither side is judged here.</p>`]
    : ['under', 'over'].filter((s) => b[`${s}_note`]).map((s) => sideNote(b, s)))).join('');
  return `<p class="small" style="margin:10px 0 4px"><b>${esc(k.label)}</b>${tags}</p>
    <div class="tbl-wrap"><table class="tbl"><thead><tr>${th('Book')}${th('Line', 1)}${th('Over<br>under', 1)}${th('Over %<br>book / ours', 1)}${th('Better<br>side')}</tr></thead><tbody>${rows}</tbody></table></div>${note}${ladderBlock(k.ladders)}`;
}

function matchBlock(m, books) {
  const when = [`${dayLabel(ukDay(m.kick))} ${ukHM(m.kick)}`, m.venue || m.court].filter(Boolean).map(esc).join(' · ');
  const held = m.held_under ? '<p class="muted small" style="margin:2px 0">Men’s indoor aces unders are held apart: no under is sent here (your choice of 19 Oct).</p>' : '';
  const markets = m.markets || [];
  return `<h3 class="sheet-h">${esc(m.match)} <span class="muted small">${when}</span></h3>
    <p class="muted small" style="margin:0">${[m.tour, m.event].filter(Boolean).map(esc).join(' · ')}</p>${held}${gridBlock(m, books)}${whyBlock(m)}${markets.map(leanLine).join('')}
    ${markets.length ? `<details class="fold"><summary class="small">Aces lines in full: total, each player’s, the over-only ladders</summary>${markets.map(marketBlock).join('')}</details>` : ''}`;
}

export function acesCard(A, now = Date.now()) {
  if (!A || !A.matches) return '';
  const books = A.books || ['Superbet', 'Stoiximan', 'Kambi'];
  const newest = (m) => (m.markets || []).flatMap((k) => k.books.map((b) => b.read || '')).sort().pop() || '';
  const left = A.matches.filter((m) => Date.parse(m.kick_utc) > now)       // a match leaves the card once it has started
    .sort((a, b) => newest(b).localeCompare(newest(a)) || a.kick_utc.localeCompare(b.kick_utc));
  if (!left.length) return '';
  return section(`Aces lines across bookmakers (${left.length})`, left.map((m) => matchBlock(m, books)).join(''), {
    fold: 'today.aces', wide: true, id: 'aces',
    sub: `Every ATP and WTA match still to start with a two-way aces line, the newest reading first. The grid: our expected count of aces, double faults, games and sets beside each bookmaker’s, then its main line (prices nearest even money; U under, O over, the better side for us), its price and our overlay, bold at ${pct(BOLD_AT)}+. Only lines with both an over and an under make a book’s count or overlay. An under marked * is not on your screen as far as we know (the registry of what each screen shows, kept by your Yes / No answers in the BB Picks chat): greyed where the site hides it, never the better side then; marked where never checked. “Why” splits a gap of an ace or more: <b>mostly match length</b> (the book expects a longer or shorter match: 60%+ of the gap is its games), <b>partly length, mostly rate</b> (25-60%), <b>pure aces forecast</b> (the rest: it expects more or fewer aces a game). 📄 The lean is Rest’s paper rule, follow Superbet (frozen 30 Oct, on paper). Folded: each market’s lines in full and the over-only ladders (${esc((A.ladder_books || []).join(', ') || 'none now')}) at their posted prices with our chance of each step: no under, so no line, count or overlay is read from them. Information, not picks: the aces picks keep their own rules.`,
  });
}
