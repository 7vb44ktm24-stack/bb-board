// How the NHL’s and the extra leagues’ views did (scripts/view_score.py; the user’s ask of 1 Nov 2026 through the orchestrator: “the same
// approach as the basketball view for the NHL and the new football leagues, sending once each has a decent sample”): the pre-game
// view’s scorecard columns (today.js pgScore), our number against each book’s level against the count, and each extra-league cell’s
// way to a decent sample, one line a cell. Folded (the compact rule of 31 Oct 2026); nothing is sent from either.
import { esc, pct, num, isNum } from '../util.js';
import { section } from '../ui.js';
import { compName } from '../data.js';

export const FEW = 10;                 // games under this: “our gap showed” is not shown (its band is wider than the measure)
const showed = (r) => (isNum(r.showed) && r.matches >= FEW ? `${pct(r.showed)}<span class="muted small"> ±${pct(r.showed_se)}</span>` : '<span class="muted small">few games</span>');
const HEAD = '<thead><tr><th>Count</th><th>Against</th><th class="n">n</th><th class="n">Miss ours / theirs</th><th class="n">Bias ours / theirs</th><th class="n">Ours nearer</th><th class="n">Our gap showed</th></tr></thead>';
const NOTE = '<p class="muted small">Miss = how far from the count; bias + = expected too many; ours nearer = how often our number was nearer the count (a tie half); our gap showed: 100% = ours right where the two differed, 0% = theirs (± one band, a game one result; not shown under 10 games). The book’s level is the count its line nearest 50/50 implies.</p>';
function body(rows, name) {
  return `<div class="tbl-wrap"><table class="tbl small">${HEAD}<tbody>${rows.map((r) => `<tr><td>${name(r)}</td>
    <td>${esc(r.book || 'Superbet')}${r.margin_in ? '<div class="muted small">its margin left in</div>' : ''}</td>
    <td class="n">${r.n}<div class="muted small">${r.matches} game${r.matches === 1 ? '' : 's'}</div></td>
    <td class="n">${num(r.our_mae, 2)} / ${num(r.book_mae, 2)}</td><td class="n">${num(r.our_bias, 2)} / ${num(r.book_bias, 2)}</td>
    <td class="n ${r.nearer >= 0.5 ? 'pos' : 'neg'}">${pct(r.nearer)}</td><td class="n">${showed(r)}</td></tr>`).join('')}</tbody></table></div>${NOTE}`;
}

// the NHL pilot: player, team and match shots on goal against bet365, Kambi (BetMGM, LeoVegas) and Superbet, and the sent picks’ record
export function nhlView(V) {
  if (!V || !(V.rows || []).length) return '';
  const s = V.sent;
  const sent = s && s.sent ? `<p class="small">Sent 🧪: ${s.sent} pick${s.sent === 1 ? '' : 's'} at one unit each${s.settled
    ? `: ${s.settled} settled, ${s.won} won, ${num(s.profit, 2)} units` : ', none settled yet (they settle in the 09:00 run)'}.</p>` : '';
  return section('How the NHL view did', sent + body(V.rows, (r) => esc(r.name)), {
    fold: 'results.nhlview', wide: true,
    sub: `Our shots on goal numbers against each book’s line on ${V.games} settled game${V.games === 1 ? '' : 's'} (${esc(V.since)} to ${esc(V.until)}${V.provisional ? `; ${V.provisional} counts still provisional` : ''}).${V.games < 30 ? ' Far too few games to judge yet;' : ''} Nothing is sent from this.`,
  });
}

// one extra-league cell (a league, stat and side): its four steps to a decent sample, done ✓ or still to come ·
const mark = (ok) => (ok ? '<span class="pos">✓</span>' : '<span class="muted">·</span>');
function readyLine(c, V) {
  const s = c.steps || {};
  const view = isNum(c.showed) && c.side_matches >= FEW ? `gap showed ${pct(c.showed)} on ${c.side_matches} games` : `${c.side_matches} game${c.side_matches === 1 ? '' : 's'} leaning ${c.side}`;
  return `<li style="display:block;padding:6px 0;border-top:1px solid var(--grid)"><b>${esc(compName(c.league))} ${esc(c.stat)} ${esc(c.side)}</b>
    <span class="muted small">${c.done} of 4</span>${c.sent ? ' <span class="tag">sent 🧪</span>' : ''}${c.ready ? ' <span class="tag">ready: a proposal</span>' : ''}
    <div class="small">${mark(s.matches)} ${c.matches}/${c.decent} matches · ${mark(s.view)} ${view} (${pct(V.shown_enough)} on ${V.shown_matches} wanted) · ${mark(s.record)} ${c.both} on both tests${c.both ? `, ${num(c.both_profit, 2)} units` : ''} (${V.record_bets}+ in profit wanted) · ${mark(s.checklist)} checklist ${c.boxes}/${c.of}${isNum(c.bar) ? ` · bar ${pct(c.bar)}${c.bar_send ? '' : ', not sent'}` : ''}</div></li>`;
}

// the extra leagues: fouls and shots against Superbet’s lines by league and the way our number leaned, then every cell’s readiness
export function moreView(V) {
  if (!V || !(V.rows || []).length) return '';
  const name = (r) => `${r.league === 'all' ? '<b>All leagues</b>' : esc(compName(r.league))} · ${esc(r.stat)} · ours ${r.way === 'over' ? 'above ▲' : 'below ▼'}`;
  const ready = (V.ready || []).slice().sort((a, b) => b.done - a.done || b.matches - a.matches);
  const got = ready.filter((c) => c.ready).length;
  return section(`Extra leagues: how the view did, and each cell’s way to a decent sample (${got} of ${ready.length} cells ready)`,
    body(V.rows, name) + `<h3 class="sub-h">Each league, stat and side: its way to a decent sample</h3><ul class="plain" style="gap:0">${ready.map((c) => readyLine(c, V)).join('')}</ul>
    <p class="muted small">A cell is ready when it has ${V.decent}+ settled matches, our gap showed up ${pct(V.shown_enough)}+ on ${V.shown_matches}+ games on that side (the six leagues’ own rule for a full stake), its 10%+ lines on both tests are in profit on ${V.record_bets}+ bets, and every box of the parity checklist is ticked. ${got} of ${ready.length} cells tried are ready: with this many tried, some will pass by luck. A ready cell is a proposal to you: once sent, each pick still passes the lane’s own gates (the cell’s bar, the thin side, the doubtful unders, two a match), and real money is a separate yes, looked at around 100 settled matches.</p>`, {
    fold: 'today.moreview', wide: true, id: 'more-view',
    sub: `Our fouls and shots numbers against Superbet’s lines on ${V.matches} settled matches (${esc(V.since)} to ${esc(V.until)}), by league and the way our number leaned from Superbet’s (▲ we expected more, ▼ fewer). Untested leagues: nothing is sent from this.`,
  });
}

// each live tennis event’s aces day by day (Live’s scripts/tennis_events.py, built light at each board build; the user’s “keep very close
// track of each day of the tournament”, 1 Nov 2026): one folded line an event, its days inside. Information only: nothing is picked from it.
const ratio = (v) => (isNum(v) ? `<span class="${v >= 1.1 ? 'pos' : v <= 0.9 ? 'neg' : ''}">${num(v, 2)}</span>` : '–');
export function eventsCard(T) {
  const ev = (T && T.events) || [];
  if (!ev.length) return '';
  const days = (e) => `<div class="tbl-wrap"><table class="tbl small"><thead><tr><th>Day</th><th class="n">Matches</th><th class="n">Aces</th><th class="n">Ours</th><th class="n">Superbet’s</th>
    <th class="n">Of ours</th><th class="n">Of Superbet’s</th><th class="n">So far, of ours / Superbet’s</th></tr></thead><tbody>${e.days.map((d) => `<tr><td>${esc(d.day)}</td><td class="n">${d.matches}</td>
    <td class="n">${num(d.counted, 0)}</td><td class="n">${num(d.ours, 1)}</td><td class="n">${isNum(d.superbet) ? num(d.superbet, 1) : '–'}</td><td class="n">${ratio(d.over_ours)}</td>
    <td class="n">${ratio(d.over_superbet)}${isNum(d.superbet) ? `<div class="muted small">${d.overs_at_superbet} of ${d.matches} over</div>` : ''}</td>
    <td class="n">${ratio(d.so_far_over_ours)} / ${ratio(d.so_far_over_superbet)}</td></tr>`).join('')}</tbody></table></div>`;
  const body = ev.map((e) => `<details class="fold"><summary class="small">${esc(e.line)}</summary>${(e.days || []).length ? days(e) : '<p class="muted small">No match counted yet.</p>'}</details>`).join('');
  return section(`Tennis events, day by day (${ev.length})`, body, {
    fold: 'today.tevents', wide: true, id: 'tennis-events',
    sub: `Each event’s total aces against our pre-match number and Superbet’s line, day by day, and so far (above 1 = more aces than expected). Information only: nothing is picked from it.${T.made ? ` Made ${esc(String(T.made).slice(5))} UK.` : ''}`,
  });
}
