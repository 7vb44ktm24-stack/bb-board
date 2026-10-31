// The NBA on paper (scripts/nba_board.py; the orchestrator's ask of 29 Oct 2026, from the user: "the NBA on the dashboard so they
// can see it"). Tonight's games, our count against Superbet's line with Pamestoixima's beside it, the gap ("news unknown" where our
// points count sits 7+ off Superbet's line), the anchored number once its log exists ("from tomorrow" until then), the paper record
// with its luck, and the test's status. Every line 📄 PAPER: nothing here is a pick. One folded card on Today, phone-first.
import { esc, pct, spct, num, isNum, dayLabel, ukWhen } from '../util.js';
import { section } from '../ui.js';

const STAT = { pts: 'Points', tov: 'Turnovers' };
const PAD = 'style="padding:6px"';            // a phone's width: the columns stacked two lines deep (30 Oct 2026, the aces grid's way)
const th = (t, n) => `<th${n ? ' class="n"' : ''} ${PAD}>${t}</th>`;
const td = (x, n, wrap) => `<td${n ? ' class="n"' : ''} style="padding:6px${wrap ? ';white-space:normal;min-width:60px' : ''}">${x}</td>`;
const signed = (x) => (isNum(x) ? `${x > 0 ? '+' : ''}${num(x, 1)}` : '–');

// the anchored number at the main line and, under it, the anchor's own paper pick for the game and side (its best line 10%+ over
// Superbet's price, which need not be the main line); points only; "from tomorrow" until its log exists
function anchorCell(l, ready) {
  if (l.stat !== 'pts') return '–';
  if (!ready) return '<span class="muted small">from tomorrow</span>';
  const p = l.anchor_pick;
  return (l.anchor ? num(l.anchor.mu, 1) : '–')
    + (p ? `<br><span class="small">📄 ${esc(p.pick)} ${num(p.line, 1)} at ${num(p.price, 2)}, ${spct(p.edge)}</span>` : '');
}

function gameBlock(g, anchorReady, gap) {
  const rows = g.lines.map((l) => `<tr>${td(`${esc(STAT[l.stat] || l.stat)}<br><span class="small muted">${esc(l.side)}</span>${l.news_unknown
    ? `<br><span class="tag tag-warn" title="News unknown: our count sits ${gap}+ off Superbet's line, likely news we don't see">⚠ news</span>` : ''}`)}
    ${td(num(l.ours, 1), 1)}${td(`${num(l.line, 1)}<br><span class="small muted">Pame ${l.pame ? num(l.pame.line, 1) : '–'}</span>`, 1)}
    ${td(`${esc(l.lean)}<br>${spct(l.edge)}<br><span class="small muted">gap ${signed(l.gap)}</span>`)}
    ${td(anchorCell(l, anchorReady), 1, true)}</tr>`).join('');
  // the day beside the time: the card holds the next day and a half, and a 01:00 tip-off is the next night's (29 Oct 2026)
  return `<h3 class="sheet-h">${esc(g.match)} <span class="muted small">${esc(ukWhen(g.tip))} · 📄 PAPER</span></h3>
    <div class="tbl-wrap"><table class="tbl"><thead><tr>${th('Line')}${th('Ours', 1)}${th('Superbet', 1)}${th('Lean')}${th('Anchor', 1)}</tr></thead><tbody>${rows}</tbody></table></div>`;
}

function cutTable(title, rows) {
  if (!rows || !rows.length) return '';
  return `<p class="small" style="margin:10px 0 4px"><b>${esc(title)}</b></p><div class="tbl-wrap"><table class="tbl"><thead><tr>${th('Cut')}${th('Picks', 1)}${th('Said', 1)}${th('Landed', 1)}${th('Return', 1)}</tr></thead><tbody>${
    rows.map((r) => `<tr>${td(esc(r.cut))}${td(`${r.picks}<br><span class="muted small">${r.games} games</span>`, 1)}${td(pct(r.said), 1)}${td(pct(r.landed), 1)}${td(`${spct(r.ret)}${isNum(r.luck) ? `<br><span class="small muted">± ${pct(r.luck)}</span>` : ''}`, 1)}</tr>`).join('')
  }</tbody></table></div>`;
}

export function nbaCard(N, now = Date.now()) {
  if (!N) return '';
  const games = (N.games || []).filter((g) => !g.tip_utc || Date.parse(g.tip_utc) > now - 3 * 3600e3);
  const R = N.record || {}, w = R.all, st = N.status || {};
  const body = [
    `<p class="small">Paper only: no NBA team pick, even on paper. The re-test waits for about ${st.retest_at || 200} settled games (${esc(st.retest_when || '')}): ${st.settled_games ?? 0} settled so far.</p>`,
    games.length ? games.map((g) => gameBlock(g, N.anchor_ready, N.news_gap)).join('') : '<p class="muted small">No NBA game in the next day and a half.</p>',
    `<p class="muted small">Gap: our count less Superbet's line. Lean: the side our chance prefers, and how far above Superbet's price it stands. "News unknown": our points count ${N.news_gap}+ off the line, where we lose most (likely news we don't see). Anchored: ours moved most of the way to the market's (ESPN's pre-game total and spread), with its 📄 paper pick where a line stands 10%+ over Superbet's price, ${N.anchor_ready ? 'on paper since the user\'s yes of 29 Oct' : 'from tomorrow\'s 09:00 run'}.</p>`,
    w ? `<p class="small" style="margin-top:12px"><b>The paper record</b>: each settled game's main line where we stood ${pct(N.pick_edge)}+ over Superbet's price, at level stakes: ${w.picks} picks on ${w.games} games, we said ${pct(w.said)}, landed ${pct(w.landed)}, ${spct(w.ret)}${isNum(w.luck) ? ` ± ${pct(w.luck)}` : ''}.</p>` : '<p class="muted small">No settled paper pick yet.</p>',
    cutTable('By overlay', R.edge), cutTable('By price', R.price), cutTable('Over or under', R.side), cutTable('By count', R.stat),
  ].join('');
  return section('NBA on paper', body, { sub: 'Tonight’s and tomorrow’s games: our count against Superbet’s and Pamestoixima’s lines, and how the paper record stands', id: 'nba', fold: 'nba', wide: true });
}
