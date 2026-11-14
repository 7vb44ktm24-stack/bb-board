// The extra leagues' picks (scripts/more_board.py; the user's "add all of them to the dashboard so I can start reviewing", 30 Oct
// 2026): Rest's paper picks in leagues our model has not been tested in, every one still to start, fouls first, unders first within
// a stat, then by overlay. A filter: all, both tests, 25%+. Each "untested league, paper": never a pick, never real money.
import { esc, pct, spct, num, isNum } from '../util.js';
import { section, signClass, chips, select } from '../ui.js';
import { compName } from '../data.js';

const CUTS = [{ id: 'all', label: 'All' }, { id: 'both', label: 'Both tests' }, { id: 'p25', label: '25%+' }];
const keep = { all: () => true, both: (p) => p.both, p25: (p) => isNum(p.overlay) && p.overlay >= 0.25 };
const ov = (x) => (isNum(x) ? `<span class="${signClass(x)}">${spct(x)}</span>` : '–');

const tag = (t, warn, title) => `<span class="tag${warn ? ' tag-warn' : ''}"${title ? ` title="${esc(title)}"` : ''}>${esc(t)}</span>`;
function pickLine(p) {
  const counts = `ours ${num(p.expected, 1)}${isNum(p.expected_book) ? ` · ${esc(p.book || 'the book')}’s 50/50 ${num(p.expected_book, 1)}` : ''}`;
  const tags = [p.sent && !p.withdrawn ? tag('sent') : '', p.withdrawn ? tag('withdrawn', true, 'Sent, then taken back') : '',
    p.doubtful ? tag('doubtful: level runs low', true, 'Our level runs low on unders here: doubtful until Rest’s level fix passes') : '',
  ].filter(Boolean).join(' ');                                   // confidence retired for the 1-3 score (the user, 31 Oct 2026)
  return `<li class="more-pick" style="display:block;padding:8px 0;border-top:1px solid var(--grid)${p.withdrawn ? ';opacity:.6' : ''}">
    <div class="small muted">${esc(String(p.kick_uk).slice(11))} · ${esc(compName(p.league))} · ${esc(p.match)}</div>
    <div><b>${esc(p.bet)}</b> at ${esc(p.book || 'Superbet')} <b>${num(p.price, 2)}</b> · overlay ${ov(p.overlay)} <span class="muted small">(Poisson ${ov(p.overlay_poisson)})</span>${p.both ? ' <span class="pos" title="10%+ on our chance and on the Poisson chance at our number">✓ both tests</span>' : ''}</div>
    ${tags ? `<div style="margin:3px 0">${tags}</div>` : ''}
    <div class="small muted">${counts} · our chance ${pct(p.ours)}${isNum(p.theirs) ? `, the book’s ${pct(p.theirs)}` : ''}${p.other_books ? ` · ${esc(p.other_books)}` : ''} · ${esc(p.label)}</div>
    ${p.withdrawn && p.note ? `<div class="small">${esc(p.note)}</div>` : ''}</li>`;
}

export function moreCard(M, S, now = Date.now()) {
  if (!M || !M.picks) return '';
  const left = M.picks.filter((p) => Date.parse(p.kick_utc) > now);
  if (!left.length) return '';
  const cut = CUTS.find((c) => c.id === (S && S.moreCut)) || CUTS[0];
  const shown = left.filter(keep[cut.id]);
  const stats = [...new Set(shown.map((p) => p.stat))];
  const body = `${chips('moreCut', CUTS.map((c) => ({ id: c.id, label: `${c.label} (${left.filter(keep[c.id]).length})` })), cut.id, { small: true })}
    ${stats.map((s) => `<h3 class="sub-h">${esc(s[0].toUpperCase() + s.slice(1))} (${shown.filter((p) => p.stat === s).length})</h3>
      <ul class="plain" style="gap:0">${shown.filter((p) => p.stat === s).map(pickLine).join('')}</ul>`).join('') || '<p class="empty">None in this cut.</p>'}`;
  return section(`Extra leagues (untested, paper) (${left.length})`, body, {
    fold: 'today.more', wide: true, id: 'more',
    sub: 'Rest’s picks in leagues our model has not been tested in (Turkey, Portugal, the Netherlands, the Championship and more), every one still to start, at its newest reading: fouls first, unders first, then by overlay. The price is Superbet’s; the overlay is on our chance, the Poisson one on a Poisson count at our number; “both tests” means 10%+ on both. Every one is an untested league, on paper: never a pick and never real money, kept apart from the headline. “Doubtful: level runs low” marks an under while our level runs low there (until Rest’s level fix passes); a line sent and then withdrawn stays, dimmed, with why. Times are UK.',
  });
}

// the parity checklist (Rest's logs/more_parity.csv, the orchestrator's spec of 30 Oct 2026): a league's stats, each with its ticks for
// data, model, books, record and the board, the day each was first set; the extra leagues go live only when every tick is in
const TICKS = [['data', 'Data'], ['model', 'Model'], ['books', 'Books'], ['record', 'Record'], ['dashboard', 'Board']];
const STAT_NAME = { fouls: 'Fouls', shots: 'Shots', 'shots on target': 'On target', cards: 'Cards' };
const short = (d) => { const [, m, dd] = String(d).split('-'); return `${+dd}/${+m}`; };
export function parityCard(P) {
  if (!P || !(P.leagues || []).length) return '';
  const all = P.leagues.flatMap((l) => l.stats);
  const ready = all.filter((s) => TICKS.every(([t]) => s[t])).length;
  const pad = 'style="padding:6px"';
  const body = P.leagues.map((l) => {
    const notes = [...new Set(l.stats.flatMap((s) => [s.note, s.wait]).filter(Boolean))];
    return `<h3 class="sub-h">${esc(compName(l.league))}</h3><div class="tbl-wrap"><table class="tbl"><thead><tr><th ${pad}>Stat</th>${TICKS.map(([, n]) => `<th class="n" ${pad}>${n}</th>`).join('')}</tr></thead>
      <tbody>${l.stats.map((s) => `<tr><td ${pad}>${esc(STAT_NAME[s.stat] || s.stat)}</td>${TICKS.map(([t]) => `<td class="n" ${pad}>${s[t] ? `<span class="pos">✓</span><br><span class="small muted">${short(s[t])}</span>` : '<span class="muted">·</span>'}</td>`).join('')}</tr>`
        + (s.verdict ? `<tr><td colspan="6" class="small" style="padding:0 6px 8px;white-space:normal">${esc(s.verdict)}</td></tr>` : '')).join('')}</tbody></table></div>
      ${notes.length ? `<p class="muted small" style="margin:4px 0 0">${notes.map(esc).join(' · ')}</p>` : ''}`;
  }).join('');
  return section(`Extra leagues: parity checklist (${ready} of ${all.length} ready)`, body, {
    fold: 'today.parity', wide: true, id: 'parity',
    sub: 'Each extra league and stat against the six leagues’ standard: the data (history and counts), the model (level, side calibration, bar, labels), the books read, the record settled, and the board showing it. A tick is the day it was first set (Rest’s logs/more_parity.csv; the board sets its own). Nothing is sent from a league until every tick is in.',
  });
}

// the extra leagues on the Lines tab (Rest's logs/more_paper_lines.csv, every line side the last run judged; the orchestrator's spec of
// 30 Oct 2026): coming lines, so by stat the counts judged, our mean gap to Superbet's 50/50 count, the lines 10%+ over the price, both
// tests and held; then the league's best lines. No "who found the line" until their counts settle.
export function moreLinesCard(L, S) {
  if (!L || !(L.leagues || []).length) return '';
  const pick = L.leagues.find((l) => l.league === (S && S.moreLeague)) || L.leagues[0];
  const pad = 'style="padding:6px"';
  const gap = (x) => (isNum(x) ? `${x > 0 ? '+' : x < 0 ? '−' : ''}${Math.abs(x).toFixed(1)}` : '–');
  const body = `${select('moreLeague', L.leagues.map((l) => ({ id: l.league, label: compName(l.league) })), pick.league, 'League')}
    <p class="small" style="margin:8px 0 4px"><b>${esc(compName(pick.league))}</b>: ${pick.matches} matches to come</p>
    <div class="tbl-wrap"><table class="tbl"><thead><tr><th ${pad}>Stat</th><th class="n" ${pad}>Counts</th><th class="n" ${pad}>Gap</th><th class="n" ${pad}>10%+</th><th class="n" ${pad}>Both</th><th class="n" ${pad}>Held</th></tr></thead>
      <tbody>${pick.stats.map((x) => `<tr><td ${pad}>${esc(STAT_NAME[x.stat] || x.stat)}</td><td class="n" ${pad}>${x.counts}<br><span class="small muted">${x.lines} lines</span></td>
      <td class="n" ${pad}>${gap(x.gap)}</td><td class="n" ${pad}>${x.over10}</td><td class="n" ${pad}>${x.both}</td><td class="n" ${pad}>${x.held}</td></tr>`).join('')}</tbody></table></div>
    ${pick.top.length ? `<h3 class="sub-h">Best over the price</h3><ul class="plain" style="gap:0">${pick.top.map((t) => `<li style="display:block;padding:6px 0;border-top:1px solid var(--grid)">
      <div class="small muted">${esc(t.kick_uk)} · ${esc(t.match)}</div><div><b>${esc(t.bet)}</b> at Superbet <b>${num(t.price, 2)}</b> · ${ov(t.overlay)}${t.both ? ' <span class="pos">✓ both tests</span>' : ''}${t.held ? ` <span class="tag">held: ${esc(t.held)}</span>` : ''}</div></li>`).join('')}</ul>` : ''}`;
  return section('Extra leagues: the lines judged (paper)', body, {
    id: 'more-lines', fold: 'lines.more', wide: true,
    sub: 'Every line side the last run judged in the extra leagues, coming matches only: by stat, the counts judged (a match’s or a side’s count once), our mean gap to Superbet’s 50/50 count (+ we expect more), the lines 10%+ over the price, those on both tests and those held back; then the best lines. Untested leagues, paper. “Who found the line” joins them once their counts settle.',
  });
}
