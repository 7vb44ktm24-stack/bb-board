// "How our numbers work" (docs/OVERLAY.md, written by Rest; the orchestrator's ask of 29 Oct 2026, from the user: "I use overlay a
// lot as a criterion ... I should understand how it works along with the other key signals"). Each term in plain words, worked on
// today's top pick with its own numbers (board.py's guide_feed, fresh every build), the rules as the code holds them (send_bars:
// stat_case's bars, fm.top_check's threshold, fm.value's bank) and the weekly review's overlay bands (logs/overlay_bands.json).
// The words are guide_terms.js's, which the bot answers from too. One folded card on Today, phone-first.
import { esc, pct, spct, isNum } from '../util.js';
import { section } from '../ui.js';
import { TERMS } from '../guide_terms.js';

const term = (title, words, mine) => `<div class="guide-term"><h3 style="margin:12px 0 4px">${esc(title)}</h3><p style="margin:0">${words}</p>${
  mine ? `<p class="small muted" style="margin:4px 0 0">${mine}</p>` : ''}</div>`;

export function bandsTable(B) {
  const rows = (B && B.bands) || [];
  if (!rows.length) return '<p class="small muted">The table by overlay band appears after the weekly review\'s first refresh.</p>';
  const th = (t, n) => `<th${n ? ' class="n"' : ''} style="padding:8px">${t}</th>`;
  return `<div class="tbl-wrap"><table class="tbl"><thead><tr>${th('Overlay')}${th('Picks', 1)}${th('We said', 1)}${th('Landed', 1)}${th('Return ± luck', 1)}</tr></thead><tbody>${
    rows.map((r) => `<tr><td>${esc(r.band)}</td><td class="n">${r.picks}</td><td class="n">${pct(r.said)}</td><td class="n">${pct(r.landed)}</td><td class="n">${spct(r.ret)}${isNum(r.luck) ? ` ± ${pct(r.luck)}` : ''}</td></tr>`).join('')
  }</tbody></table></div><p class="small muted">Our settled picks, ${esc(B.from || '')} to ${esc(B.to || '')}, at level stakes; luck counts a match as one result. Inside one band of luck a difference shows nothing yet. Refreshed each Monday.</p>`;
}

export function guideCard(G) {
  if (!G) return '';
  const E = G.example;
  const b = G.bars || {};
  const body = [
    E ? `<p class="small">Worked on today's top pick: <b>${esc(E.bet)}</b> at ${esc(E.book)} (${esc(E.match)}).</p>`
      : '<p class="small muted">No football pick to work through yet today: the examples come with the next one.</p>',
    ...TERMS.map((t) => term(t.title, t.words(b), E ? t.mine(E, b) : '')),
    term('The record by overlay band', 'How our own picks have done by overlay, what we said against how often they landed:', ''),
    bandsTable(G.bands),
  ].join('');
  return section('How our numbers work', body, { sub: 'Overlay and the other signals, in plain words, on today\'s top pick', id: 'guide', fold: 'guide', wide: true });
}
