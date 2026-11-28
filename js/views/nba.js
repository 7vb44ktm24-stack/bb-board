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
    + (p ? `<br><span class="small">📄 ${esc(p.pick)} ${num(p.line, 1)} at ${num(p.price, 2)}, <span class="muted" title="overlay held back: it over-promises here (H406)">overlay held back</span></span>` : '');
}

// The paper set's own record beside an overlay that would join it (the user, 17 Nov 2026 22:43, DECISIONS 25a6452c: "Show the record
// beside"; H328 85b311ac: the set shows +14% even capped and came back −10% on 371): "(−10% on 371)", the same record.all as the card's
// "The paper record" line (nba_board.build: paper_picks through live_review.measure), on the lines at the set's bar (pick_edge) only
export function recordNote(l, rec, bar) {
  if (!rec || !isNum(rec.ret) || !(rec.picks > 0) || !isNum(l.edge) || !isNum(bar) || l.edge < bar) return '';
  return ` <span class="small muted" title="This paper set's record so far: each settled game's main line ${pct(bar)}+ over Superbet's price, at level stakes">(${spct(rec.ret)} on ${rec.picks})</span>`;
}

function gameBlock(g, anchorReady, gap, rec, bar) {
  const rows = g.lines.map((l) => `<tr>${td(`${esc(STAT[l.stat] || l.stat)}<br><span class="small muted">${esc(l.side)}</span>${l.news_unknown
    ? `<br><span class="tag tag-warn" title="News unknown: our count sits ${gap}+ off Superbet's line, likely news we don't see">⚠ news</span>` : ''}`)}
    ${td(num(l.ours, 1), 1)}${td(`${num(l.line, 1)}<br><span class="small muted">Pame ${l.pame ? num(l.pame.line, 1) : '–'}</span>`, 1)}
    ${td(`${esc(l.lean)}<br><span class="muted small" title="overlay held back: it over-promises here (H406)">overlay held back</span>${recordNote(l, rec, bar)}<br><span class="small muted">gap ${signed(l.gap)}</span>`)}
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

// The basketball player split (Live, 15 Nov 2026; the user's "players stats split for basketball games? Validated"): each coming
// game's players with their expected minutes, points, rebounds and assists, and the team totals (scripts/board.py basket_split).
// H255 (7c0813ed) validated it walk-forward: in every competition and count it beats each player's own season average; against
// Superbet's player lines level in Europe (EuroLeague assists ahead), behind on NBA points and rebounds. A forecast, never a pick (H31).
function splitTeam(t) {
  const T = t.total || {};
  const rows = (t.players || []).map((p) => `<tr>${td(esc(p.player), 0, true)}${td(num(p.min, 0), 1)}${td(num(p.pts, 1), 1)}${td(num(p.reb, 1), 1)}${td(num(p.ast, 1), 1)}</tr>`).join('');
  return `<p class="small" style="margin:8px 0 4px"><b>${esc(t.team)}</b></p><div class="tbl-wrap"><table class="tbl"><thead><tr>${th('Player')}${th('Min', 1)}${th('Pts', 1)}${th('Reb', 1)}${th('Ast', 1)}</tr></thead><tbody>${rows}`
    + `<tr>${td('<b>Team</b>')}${td('', 1)}${td(`<b>${num(T.pts, 1)}</b>`, 1)}${td(`<b>${num(T.reb, 1)}</b>`, 1)}${td(`<b>${num(T.ast, 1)}</b>`, 1)}</tr></tbody></table></div>`;
}

export function splitCard(S, now = Date.now()) {
  if (!S) return '';
  const games = (S.games || []).filter((g) => !g.tip_utc || Date.parse(g.tip_utc) > now - 3 * 3600e3);
  if (!games.length) return '';
  const body = [
    '<p class="small">Validated (H255): in every competition each player’s numbers beat his own season average, every game forecast from earlier games only. Against Superbet’s own player lines: level in Europe (EuroLeague assists ahead), behind on NBA points and rebounds. A forecast for reading the game, not a bet: no player line is sent (H31).</p>',
    games.map((g) => `<h3 class="sheet-h">${esc(g.match)} <span class="muted small">${esc(g.comp || '')} · ${esc(ukWhen(g.tip_utc))}</span></h3>${(g.teams || []).map(splitTeam).join('')}`).join(''),
    '<p class="muted small">Points and assists add up to the team forecast. Rebounds: the players’ own numbers in the EuroLeague, Greek league and ACB (team rebounds go to no player), the team forecast in the NBA. Who plays is the expected squad: the Greek league and the ACB have no injury feed, so a late absence is not in these numbers.</p>',
  ].join('');
  return section('Player splits', body, { sub: 'Each coming game: every player’s expected minutes, points, rebounds and assists', id: 'bsplit', fold: 'bsplit', wide: true });
}

export function nbaCard(N, now = Date.now()) {
  if (!N) return '';
  const games = (N.games || []).filter((g) => !g.tip_utc || Date.parse(g.tip_utc) > now - 3 * 3600e3);
  const R = N.record || {}, w = R.all, st = N.status || {};
  const body = [
    `<p class="small">Paper only: no NBA team pick, even on paper. The re-test waits for about ${st.retest_at || 200} settled games (${esc(st.retest_when || '')}): ${st.settled_games ?? 0} settled so far.</p>`,
    // H401 (the user's yes, 26 Nov 2026): the NBA paper main lines ran -11.8% against +18.0% promised on 452, so their leans are off the
    // lists the user reads, folded here as lines, not picks; the logging and the record below go on (judged forward at 100 new picks)
    `<p class="small">Not picks: the NBA main lines ran <b>−11.8%</b> on 452 paper picks against +18.0% promised (H401), so they are off the lists; still logged and judged at 100 new picks.</p>`,
    games.length ? `<details class="fold"><summary class="small">Tonight's NBA lines, not picks (${games.length})</summary>${games.map((g) => gameBlock(g, N.anchor_ready, N.news_gap, w, N.pick_edge)).join('')}</details>` : '<p class="muted small">No NBA game in the next day and a half.</p>',
    `<p class="muted small">Gap: our count less Superbet's line. Lean: the side our chance prefers, and how far above Superbet's price it stands. "News unknown": our points count ${N.news_gap}+ off the line, where we lose most (likely news we don't see). Anchored: ours moved most of the way to the market's (ESPN's pre-game total and spread), with its 📄 paper pick where a line stands 10%+ over Superbet's price, ${N.anchor_ready ? 'on paper since the user\'s yes of 29 Oct' : 'from tomorrow\'s 09:00 run'}.</p>`,
    w ? `<p class="small" style="margin-top:12px"><b>The paper record</b>: each settled game's main line where we stood ${pct(N.pick_edge)}+ over Superbet's price, at level stakes: ${w.picks} picks on ${w.games} games, we said ${pct(w.said)}, landed ${pct(w.landed)}, ${spct(w.ret)}${isNum(w.luck) ? ` ± ${pct(w.luck)}` : ''}.</p>` : '<p class="muted small">No settled paper pick yet.</p>',
    cutTable('By overlay', R.edge), cutTable('By price', R.price), cutTable('Over or under', R.side), cutTable('By count', R.stat),
  ].join('');
  return section('NBA on paper', body, { sub: 'Tonight’s and tomorrow’s games: our count against Superbet’s and Pamestoixima’s lines, and how the paper record stands', id: 'nba', fold: 'nba', wide: true });
}
