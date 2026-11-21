// Results: one set of bets at a time (the paper account first, with first and last shown beside it), its running profit
// and fall from the top, a calendar of days, profit by day / week / month, the sets and the sports side by side, and
// every bet behind the figures.

import { esc, money, pct, spct, odds, int, isNum, num, dayLabel, md, ukDay, ukHM, ukStamp } from '../util.js';
import { tile, recordLine, verdictPill, signClass, section, goAttr, chips, table, cutCols, bookChip, statusTag } from '../ui.js';
import { agg, group, byPeriod, running, byDay, streak, floorFlag } from '../metrics.js';
import * as M from '../metrics.js';
import { SETS, SPORTS, NEVER_SUMMED, isLiveSet, VIEW, viewOf } from '../state.js';
import { compName } from '../data.js';
import * as C from '../charts.js';
import { outlookCard } from './lab.js';
import { outletsBrief } from './lines.js';
import { sportChips, sportsTiles, allSportsView } from './allsports.js';
import { nhlView } from './viewscore.js';
import { bestRows, verdictWord } from '../best.js';
import { provenCard } from '../proven.js';

// method changes and their effect (the user, 30 Oct 2026: "need to see effects of overlay rescoring; if better ok, just need to
// be sure"): Rest's logs/change_effects.csv through fm/change_effects.py (the feed's `change_effects`), folded behind its count;
// each change at its newest checkpoint, old against new on the same settled lines, better or worse only beyond two luck bands
const CE_CLASS = { better: 'v-bet', worse: 'v-stop' };
function ceFig(measure, x) {
  if (!isNum(x)) return '–';
  return measure === 'return' ? spct(x) : measure === 'picks' ? String(Math.round(x)) : num(x, 3);
}
function ceMeasure(c) {
  if (c.measure !== 'overall') return c.measure;
  return !c.metric || /profit|return|staked/i.test(c.metric) ? 'return' : 'accuracy';
}
export function changesCard(CE) {
  const ce = CE || {};
  const list = ce.changes || [];
  const body = list.length ? `<div class="lines">${list.map((c) => {
    const m = ceMeasure(c);
    const rows = (c.rows || []).filter((r) => r.band || r.measure);
    return `<details class="early-line"><summary class="bet-line"><span class="bl-main"><span class="bl-bet"><span class="vchip ${CE_CLASS[c.verdict] || 'v-paper'}">${esc(c.verdict)}</span>${esc(c.change)}</span>
        <span class="bl-match muted">${esc(c.changed_on)} · ${esc([c.sport, c.scope, c.side && c.side !== 'all' ? c.side : ''].filter(Boolean).join(', '))} · ${esc(c.checkpoint)}${c.held ? `, ${esc(c.held)}` : ''}</span></span>
        <span class="bl-side small">${ceFig(m, c.old)} → <b>${ceFig(m, c.new)}</b>${isNum(c.luck) ? ` <span class="muted">±${ceFig(m, c.luck).replace('+', '')}</span>` : ''}</span></summary>
      <p class="small">${esc(c.metric || m)}: ${ceFig(m, c.old)} before, ${ceFig(m, c.new)} after${isNum(c.luck) ? ` (luck ±${ceFig(m, c.luck).replace('+', '')} on the difference)` : ''}${isNum(c.n_new) ? `, ${int(c.n_new)} settled` : ''}${c.lines_from ? `; lines ${esc(c.lines_from)} to ${esc(c.lines_to)}` : ''}.${c.note ? ` ${esc(c.note)}` : ''}</p>
      ${rows.length ? `<ul class="plain small">${rows.map((r) => `<li><b>${esc(r.measure)}</b>${r.band && r.band !== 'all' ? ` ${esc(r.band)}` : ''}${r.side && r.side !== 'all' ? ` (${esc(r.side)})` : ''}: ${ceFig(r.measure, r.old)} → ${ceFig(r.measure, r.new)}${isNum(r.luck) ? ` ±${ceFig(r.measure, r.luck).replace('+', '')}` : ''}${isNum(r.n_new) ? `, ${int(r.n_new)}` : ''}${r.verdict ? ` · ${esc(r.verdict)}` : ''}</li>`).join('')}</ul>` : ''}
    </details>`;
  }).join('')}</div>` : `<p class="empty">Nothing measured yet: ${esc(ce.line || 'first results from Rest on Sat 31 Oct')}.</p>`;
  return section(`Method changes: their effect (${ce.line || 'first results from Rest on Sat 31 Oct'})`, body, {
    fold: 'results.changes', wide: true, id: 'changes',
    sub: 'Every method change since 16 Oct that moved overlays, old against new on the same settled lines, at its newest check (first, 2 weeks, 4 weeks). Better or worse only beyond two luck bands of the difference; under 30 settled is too early.' });
}

// the review tables' cuts, the same in every sport (eband2: the finer overlay bands, worked out from each bet's own overlay)
export const REVIEW_CUTS = [
  { id: 'eband2', label: 'Overlay', head: 'Overlay band' },
  { id: 'pband', label: 'Price', head: 'Price band' },
  { id: 'side', label: 'Over/under', head: 'Over or under' },
  { id: 'stat', label: 'Stat', head: 'Stat or market' },
  { id: 'book', label: 'Book', head: 'Bookmaker' },        // short: the chips fit a phone's width
  { id: 'comp', label: 'League', head: 'League' },         // the extra leagues side by side (30 Oct 2026)
  // the user's "cut by" of 4 Nov 2026: a stat and its side together, whose count, the kick-off slot (UK) and tennis's round group
  { id: 'statSide', label: 'Stat + side', head: 'Stat and side' },
  { id: 'scope', label: 'Whose count', head: 'Home, away or the match' },
  { id: 'hour', label: 'Kick-off', head: 'Kick-off (UK)' },
  { id: 'round', label: 'Round', head: 'Round (Qualifying, Early: rounds 1-2, Middle: 3 to the quarter-finals, Late)', sports: ['tennis'], when: true },
  // where we do best (the user, 18 Nov 2026 07:28; H332): the court, indoor or out ("Surface": the user's word, 21:28)
  { id: 'venue', label: 'Surface', head: 'Surface (hard, hard indoor, clay, grass)', sports: ['tennis'], when: true },
  { id: 'tourney', label: 'Level', head: 'Tournament level (the men’s 500 and 250 are one level)', sports: ['tennis'], when: true },
  // each player, and each player's team, of the player lines (the user, 17 Nov 2026: "cut for players names and their teams"); the
  // same in every sport with player lines (18 Nov 2026), offered where the view holds player lines (M.offered)
  { id: 'player', label: 'Player', head: 'Player (a verdict from 30 settled)', sports: ['football', 'basketball', 'nhl'], when: true },
  { id: 'pteam', label: 'Player’s team', head: 'The player’s team (a verdict from 30 settled)', sports: ['football', 'basketball', 'nhl'], when: true },
  // which teams we do better on (the user, 17 Nov 2026): a team line under its team, a match total under both its teams; tennis's
  // is its Player cut (a player line under its player, a match total under both players: M.cutLabel)
  { id: 'teams', label: 'Team', head: 'Team: its own lines and its matches’ totals, so a total shows under both (a verdict from 30 settled)' },
  // team or match picks v player picks (the user, 18 Nov 2026 21:31), where the view holds both
  { id: 'ptype', label: 'Pick type', head: 'Team or match picks v player picks', sports: ['football', 'basketball', 'nhl'], when: true },
];
const SPORT_FIRST = { tennis: ['round', 'venue', 'tourney', 'teams'] };   // a sport's own cuts at the front of its chips (phone width)
const TENNIS_TEAMS_HEAD = 'Player: his own lines and his matches’ totals, so a total shows under both players (a verdict from 30 settled)';
const PLAYER_SPORTS = new Set(['football', 'basketball', 'nhl']);

// the NHL pilot before its first pick (feed.nhl_status, board.nhl_status): what has settled, and each bookmaker's Brier score,
// ours against its own (lower is better), so the forecast can be judged before any pick is
export function nhlCard(st) {
  if (!st || !st.lines) return '<p class="empty">The NHL pilot: nothing settled yet. Its games settle each morning in the 09:00 run; paper picks from Tue 3 Nov.</p>';
  const rows = (st.books || []).map((b) => `<tr><td>${esc(b.book)}${b.margin_in ? '<div class="muted small">its margin left in</div>' : ''}</td><td class="n">${int(b.lines)}</td>
    <td class="n">${num(b.ours, 3)}</td><td class="n">${num(b.theirs, 3)}</td><td class="n ${b.ours < b.theirs ? 'pos' : 'neg'}">${b.ours < b.theirs ? 'ours' : 'theirs'}</td></tr>`).join('');
  return section('NHL: lines settled, no picks yet', `<p>${int(st.lines)} shots lines settled on ${int(st.games)} games (to ${esc(dayLabel(st.to || '', false))}),
    ${st.final ? `${int(st.final)} final` : 'all provisional: the scorers can still correct a count for 27 hours'}. Paper picks: ${st.picks ? int(st.picks) : `none yet, from ${esc(st.picks_from)}`}.</p>
    <div class="tbl-wrap"><table class="tbl"><thead><tr><th>Bookmaker</th><th class="n">Lines</th><th class="n">Ours</th><th class="n">Theirs</th><th class="n">Nearer</th></tr></thead><tbody>${rows}</tbody></table></div>`,
  { sub: 'Each bookmaker’s lines, our Brier score against its own: how far each chance of the over sat from what happened, lower is better. One night is far too few to judge.' });
}

// the set's own record (basket.md, tennis.md, kept_back.md, placements.json), checked by the feed: shown on the whole set only
const RECORD_OF = { 'basketball|paper': 'Basketball, shown picks', 'tennis|paper': 'Tennis', 'football|kept': 'Kept back', 'football|placeable': 'As placeable' };
function otherCheck(D, S) {
  const name = RECORD_OF[`${S.sport}|${S.set}`];
  if (!name || S.range !== 'all' || Object.keys(S.f).length || Object.keys(S.x || {}).length) return '';
  const c = (D.feed.reconcile || []).find((x) => x.set === name);
  if (!c) return '';
  return `<p class="check ${c.agree ? 'ok' : 'warn'}">${c.agree ? '✓ Matches its record' : '⚠ Differs from its record'}: ${esc(c.record)} says ${int(c.headline.settled)} settled, ${int(c.headline.won)} won${isNum(c.headline.profit) ? `, ${money(c.headline.profit, '£', 2)}` : ''} on ${money(c.headline.staked, '£', 2, false)}.</p>`;
}

// won against said (H110; the user, 1 Nov 2026 about 20:35 UK: "we win more than we are saying"): by overlay band, the share won
// beside our chance (said), the careful chance the stake was set on and what the price needs, with one band of luck on the won
// share (from our own chances); the set and sport in view, its settled bets
const BAND_ORDER = ['up to 19%', '20% to 29%', '30% and over'];      // data.coarseBand: under 20% one band since 9 Nov 2026
export function saidCard(rows) {
  const done = rows.filter((r) => r.settled && isNum(r.ours) && r.ours > 0 && r.ours < 1);
  if (done.length < 10) return '';
  const mean = (xs, f) => (xs.length ? xs.reduce((s, r) => s + f(r), 0) / xs.length : null);
  const line = (key, xs) => {
    const care = xs.filter((r) => isNum(r.ps) && r.ps > 0 && r.ps < 1);
    const won = mean(xs, (r) => r.w), said = mean(xs, (r) => r.ours);
    const luck = Math.sqrt(xs.reduce((s, r) => s + r.ours * (1 - r.ours), 0)) / xs.length;
    return { key, n: xs.length, won, said, careful: care.length >= xs.length / 2 ? mean(care, (r) => r.ps) : null,
      needs: mean(xs.filter((r) => isNum(r.needs)), (r) => r.needs), gap: won - said, luck };
  };
  const bands = [...new Set(done.map((r) => r.eband).filter(Boolean))].sort((a, b) => (BAND_ORDER.indexOf(a) + 99 * (BAND_ORDER.indexOf(a) < 0)) - (BAND_ORDER.indexOf(b) + 99 * (BAND_ORDER.indexOf(b) < 0)));
  const list = [line('all', done), ...bands.map((b) => line(b, done.filter((r) => r.eband === b))).filter((x) => x.n >= 5)];
  const gapFmt = (v, r) => `<span class="${Math.abs(v) > 2 * r.luck ? (v > 0 ? 'pos' : 'neg') : 'muted'}">${spct(v)}</span>`;
  const cols = [{ key: 'key', label: 'Overlay' }, { key: 'n', label: 'Bets', num: true, fmt: (v) => int(v) },
    { key: 'won', label: 'Won', num: true, fmt: (v) => pct(v) }, { key: 'said', label: 'Said', num: true, fmt: (v) => pct(v) },
    { key: 'careful', label: 'Careful', num: true, fmt: (v) => (isNum(v) ? pct(v) : '–') },
    { key: 'needs', label: 'Needed', num: true, fmt: (v) => pct(v) },
    { key: 'gap', label: 'Gap', num: true, fmt: gapFmt }, { key: 'luck', label: '±', num: true, fmt: (v) => pct(v) }];
  const all = list[0];
  const words = Math.abs(all.gap) > 2 * all.luck ? (all.gap > 0 ? 'more than we said, beyond two bands of luck' : 'less than we said, beyond two bands of luck')
    : 'within luck of what we said';
  return section('Won against said', `<p class="small">${int(all.n)} settled: won ${pct(all.won)}, we said ${pct(all.said)}${isNum(all.careful) ? `, staked on ${pct(all.careful)}` : ''}, the prices needed ${pct(all.needs)}: ${words} (one band ±${pct(all.luck)}).</p>
    ${table({ id: 't-said', cols, rows: list, dense: true })}`,
  { fold: 'results.said', wide: true, sub: 'Do we win what we say (H110)? Won, beside our chance (said), the careful chance the stake was set on and what the price needs, by overlay band; the gap is won less said, ± one band of luck, in the set and range in view. Coloured where the gap is beyond two bands of luck; the careful chance only where most bets carry it. Information for the monthly refit, never a stake signal by itself.' });
}

// the early winners (fm/early_winners.py, the Monday review's own rows; the user, 1 Nov 2026: "track all but invest more time and
// energy on early winners"): every lane's, each with its record so far; early means unproven, so the luck band leads the reading
// "How our best bets are doing" (3 Nov 2026), first on Results: best.js's rows, a line each, the verdict in plain words
export function bestCard(EW) {
  const rows = bestRows(EW);
  if (!rows.some((b) => b.row)) return '';
  const tone = (w) => (w.startsWith('ahead, beyond') ? 'pos' : w.startsWith('behind') ? 'neg' : 'muted');
  const item = (b) => {
    const r = b.row, w = verdictWord(r);
    return `<li><b>${esc(b.label)}</b> <span class="${tone(w)}">${esc(w)}</span><br>${r && r.n ? `<span class="small">${spct(r.return)} <span class="muted">±${pct(r.luck)}</span> · won ${pct(r.won)}, we said ${pct(r.said)} · ${int(r.n)} bets${isNum(r.matches) && r.matches !== r.n ? `, ${int(r.matches)} matches` : ''}</span>` : '<span class="muted small">nothing settled yet</span>'}</li>`;
  };
  return section('How our best bets are doing', `<ul class="plain">${rows.map(item).join('')}</ul>`,
    { id: 'best', wide: true, fold: 'results.best', sub: 'Each its own record: the return, its luck band (±), how often it won against what we said. "Beyond luck" means more than twice the band; under 20 bets is too early to say.' });
}
export function earlyCard(EW) {
  const rows = (EW && EW.rows) || [];
  if (!rows.length) return '';
  const beyond = (r) => isNum(r.return) && isNum(r.luck) && r.return > 2 * r.luck;
  // a stacked list, not a table: the names are long and a phone (390 px) showed no numbers beside them
  const item = (r) => `<li><b>${esc(r.name)}</b><br><span class="${beyond(r) ? 'pos' : isNum(r.return) && r.return < 0 ? 'neg' : 'muted'}">${spct(r.return)}</span>
    <span class="muted">±${pct(r.luck)}</span> · won ${pct(r.won)}, said ${pct(r.said)} · ${int(r.n)} bets${isNum(r.matches) && r.matches !== r.n ? ` (${int(r.matches)} matches)` : ''}
    <br><span class="muted small">${esc(r.status || '')}${r.since ? ` · since ${esc(dayLabel(r.since, false))}` : ''}</span></li>`;
  const missing = (EW.missing || []).length ? `<p class="muted small">No rows yet from: ${esc(EW.missing.join(', '))}.</p>` : '';
  return section('Early winners', `<ul class="plain">${rows.map(item).join('')}</ul>${missing}`,
    { fold: 'results.early', wide: true, sub: 'Every lane’s early winners with their record so far, as the Monday review lists them. Early means unproven: a return inside two bands of luck (±) is not an edge yet, and is shown grey; green only beyond two bands. Each its own record, never added together.' });
}
export function render(ctx) {
  const { D, S, scope } = ctx;
  const rows = scope();
  const never = NEVER_SUMMED.has(S.set);       // "every" and "liveall" repeat a selection; no total of any kind for these (29 Oct 2026)
  const setDef = (SETS[S.sport] || []).find((x) => x.id === S.set) || {};
  if (S.allSports) {                                             // every sport side by side, never added together (29 Oct 2026)
    return { html: `<div class="controls">${sportChips(S)}</div>` + sportsTiles(ctx) + allSportsView(ctx, { bySet: true, title: 'Each sport, set by set',
      sub: 'Each sport’s own sets in this range, each its own record: none is added to another, and no sport to another. The filters are off here, since each sport cuts its own way.' }) };
  }
  const controls = `<div class="controls">
    ${sportChips(S)}
    ${chips('set', (SETS[S.sport] || []).map((x) => ({ id: x.id, label: x.label })), S.set, { small: true })}
  </div>`;
  const setNote = `<p class="set-note muted small">${esc(setDef.note || '')}${never ? ' <b>Never added up:</b> one selection counts as often as it was shown or logged, so no total of any kind is shown here; every bet in this view, below, as itself.' : ''}</p>`;
  if (!rows.length) {
    const none = !ctx.scope({ ignoreFilters: true, ignoreRange: true }).length;   // a set with nothing logged at all (the NHL's first days)
    if (none && S.sport === 'nhl') return { html: controls + setNote + nhlCard(D.feed.nhl_status) + nhlView(D.feed.nhl_view) };
    return { html: controls + oneViewCard(D.feed.oneview, S.sport) + setNote + (none ? '<p class="empty">Nothing in this set yet: it fills as its picks are logged and their games settled.</p>'
      : '<p class="empty">Nothing in this set, sport and range: widen the range, take a filter off, or try another set.</p>') + (S.sport === 'nhl' ? nhlView(D.feed.nhl_view) : '') };
  }
  const g = agg(rows);
  const days = byDay(rows);
  const run = running(rows);
  const best = days.filter((d) => d.n).sort((a, b) => b.profit - a.profit)[0];
  const worst = days.filter((d) => d.n).sort((a, b) => a.profit - b.profit)[0];
  const st = streak(days);
  const head = D.feed.headline || {};
  const vw = viewOf(S.one), one = vw !== 'all' && !never;      // the view: one pick per stat and match by default (the user, 9 Nov 2026)
  const viewWord = one ? VIEW[vw].word : 'all picks';
  const isHeadline = S.sport === 'football' && S.set === 'paper' && S.range === 'all' && !Object.keys(S.f).length && !Object.keys(S.x || {}).length;
  const hs = head.sets?.['paper account'];
  const agrees = isHeadline && !one && hs ? Math.abs((hs.profit || 0) - g.profit) < 0.02 && hs.settled === g.n : null;
  // the 300 review's headline, record by overlay band (reports/review_300_20261029.md §2, 29 Oct 2026): the paper
  // account's own view, where the finding was made
  const review300 = isHeadline ? `<p class="small muted">From the 300 review: picks 25%+ above their price returned +52% on 86 (±11%, ahead in both halves); the 20-25% band +8% on 80 (±12%, weak in the first half, strong in the second).</p>` : '';
  // judged against the sharp close, not the soft one (season plan 4.1, 29 Oct 2026): board.py's sharp_close.summary()
  const sharpClose = isHeadline && D.feed.sharp_close ? `<p class="small muted">Against the sharp close: ${esc(D.feed.sharp_close)}</p>` : '';

  // the top third (the user, 30 Oct 2026: "the top 1/3 of the screen must hold the best, visually scannable info; more info can
  // sit lower"): the four numbers that say how the set stands; the rest of the record in words folded under the chart
  const tiles = never ? '' : `<div class="tiles tiles-top">
    ${tile({ label: 'Profit', value: `<span class="${signClass(g.profit)}">${money(g.profit)}</span>`, sub: `on ${money(g.staked, '£', 0, false)} staked · ${viewWord}`, spark: 'sp-profit' })}
    ${tile({ label: 'Return', value: `<span class="${signClass(g.ret)}">${spct(g.ret, 1)}</span>`, sub: `luck alone ±${pct(g.luck, 1)} ${verdictPill(g.verdict, g.more)}` })}
    ${tile({ label: 'Won', value: `${int(g.won)}<span class="muted"> of ${int(g.n)}${g.selections !== g.n ? ' parts' : ''}</span>`, sub: `${pct(g.wonPct)} · needed ${pct(g.needed)} · we said ${pct(g.said)}` })}
    ${tile({ label: 'Open', value: int(g.open), sub: `${money(g.openStake, '£', 0, false)} staked` })}
  </div>`;
  // in one pick a match, every pick's figure beside it, one muted line (the orchestrator's spec: every figure names its view)
  const allG = one ? agg(ctx.scope({ all: true })) : null;
  const allLine = allG && allG.n ? `<p class="small muted view-alt">All picks: ${money(allG.profit)} on ${int(allG.n)} settled (${spct(allG.ret, 1)}, luck ±${pct(allG.luck, 1)}).</p>` : '';
  // the national teams' real tier as staked, £1-£10 by the real overlay, beside the level £1 record that stays the default (the clean
  // measure of the overlay; Next 9, the orchestrator's call 9 Nov 22:3x): board.py's `real` on each row
  const realRows = S.set === 'intl' ? rows.filter((r) => isNum(r.real) && r.real > 0) : [];
  const realG = realRows.length ? agg(realRows.map((r) => ({ ...r, stake: r.real,
    profit: r.status === 'won' ? r.real * (r.price - 1) : r.status === 'lost' ? -r.real : r.status === 'void' ? 0 : r.profit }))) : null;
  const stakedLine = realG ? `<p class="small view-alt">As staked, £ (the real money: £1-£10 by the real overlay to 12 Nov, the leagues' rules and caps since): ${realG.n ? `<b class="${signClass(realG.profit)}">${money(realG.profit)}</b> on ${money(realG.staked, '£', 0, false)} staked (${spct(realG.ret, 1)}), ${int(realG.n)} settled` : 'nothing settled yet'}${realG.open ? ` · ${int(realG.open)} open, ${money(realG.openStake, '£', 0, false)} staked` : ''}. <span class="muted">The record above is level, £1 a bet.</span></p>` : '';
  const viewNote = never ? '' : !one ? ' <b>All picks:</b> every pick of a match counts; the switch above shows one pick per stat and match.'
    : vw === 'stat' ? ` <b>One pick per stat and match:</b> ${isLiveSet(S.set) ? 'in each match, each stat’s first line sent' : 'in each match, each stat’s pre-game pick with the highest overlay (ties: the first shown); a match’s different stats all count'}; the switch above shows one a match, then all picks.`
    : ` <b>One pick a match:</b> ${isLiveSet(S.set) ? 'each match’s first line sent' : 'each match’s pre-game pick with the highest overlay (ties: the first shown)'}, how well we choose; the switch above shows all picks.`;
  const check = isHeadline && !one && hs ? `<p class="check ${agrees ? 'ok' : 'warn'}">${agrees ? '✓ Matches the record' : '⚠ Differs from the record'}: headline.json says ${money(hs.profit)} on ${money(hs.staked, '£', 0, false)}, ${hs.settled} settled (built ${esc((head.built_utc || '').replace('T', ' ').slice(0, 16))} UTC, results to ${esc(head.results_to || '')}).</p>` : '';
  const words = never ? '' : section('The record in words', `${setNote.replace('</p>', `${viewNote}</p>`)}${review300}${sharpClose}<p class="record-line">${recordLine(g)}</p>
    ${g.provisional ? `<p class="small muted">${g.provisional} settled on ESPN's counts until SofaScore is read.</p>` : ''}
    ${g.selections !== g.n ? `<p class="small muted">${g.selections} distinct selections: a split placed at two bookmakers, or in a double, counts once.</p>` : ''}
    <div class="tiles">
    ${tile({ label: 'Fall from the top', value: `<span class="${run.ddNow < 0 ? 'neg' : ''}">${money(run.ddNow, '£', 0, true)}</span>`, sub: `worst ${money(run.maxDD)} · top ${money(run.peak)}` })}
    ${tile({ label: 'Days', value: `${days.filter((d) => d.n).length}`, sub: best ? `best ${dayLabel(best.day, false)} ${money(best.profit)} · worst ${dayLabel(worst.day, false)} ${money(worst.profit)}${st.current > 1 ? ` · ${st.current} ${st.sign > 0 ? 'up' : 'down'} days running` : ''}` : 'none settled', go: best ? { tab: 'results', range: 'custom', from: best.day, to: best.day } : null })}
    </div>${agrees ? check : ''}${otherCheck(D, S)}`,
  { fold: 'results.words', wide: true, sub: 'What this set is, the record in one line, the fall from its top and its best and worst days, and the checks against the record.' });

  const cmp = S.sport === 'football' && S.set === 'paper';
  const chart = never ? '' : section('Running profit', `<div class="chart chart-lg" id="ch-run"></div><div class="chart chart-xs" id="ch-dd"></div>`,
    { wide: true, fold: 'results.run', sub: cmp ? 'The paper account, with the same selections as first shown and as last shown beside it. Below: how far it stands under its own top.' : 'Settled bets in kick-off order. Below: how far it stands under its top.' });

  // where the bank could go from here: a record's own set only (a set that repeats a selection would overstate it)
  const ol = !never && S.set !== 'live' ? outlookCard(ctx, ctx.scope({ ignoreRange: true }), { fold: 'results.outlook' }) : { html: '' };

  const cal = never ? '' : section('Day by day', `<div class="chart" id="ch-cal"></div>`, { fold: 'results.cal', wide: true, sub: 'Profit a match day (Greek dates). Tap a day to open it.' });

  const per = never ? '' : section('By period', `${chips('period', [{ id: 'day', label: 'Day' }, { id: 'week', label: 'Week' }, { id: 'month', label: 'Month' }], S.period, { small: true })}<div class="chart" id="ch-period"></div>`, { fold: 'results.period', wide: true });
  const expo = never ? '' : section('Exposure by match day', `<div class="chart" id="ch-expo"></div>`,
    { fold: 'results.expo', wide: true, sub: S.set === 'placeable' ? 'The real-money plan’s amounts a match day, against the 500 day cap.' : 'Stakes a match day in this set, settled and still open. The line is the real-money day cap, for scale: paper stakes are not capped by it.' });

  // the sets side by side, never added together: every sport's own (30 Oct 2026, the user's "all sports the same")
  const base = ctx.scope({ set: null });
  const setList = (SETS[S.sport] || []).filter((x) => !NEVER_SUMMED.has(x.id)).map((x) => ({ key: x.label, id: x.id, ...agg(base.filter((r) => r.set === x.id)) }));
  const sets = setList.length > 1 ? section('The sets side by side', table({ id: 't-sets', cols: cutCols('Set'), rows: setList, rowGo: (r) => ({ set: r.id }), sort: ctx.sortOf('t-sets') }),
    { fold: 'results.sets', wide: true, sub: (one ? `${VIEW[vw].word.charAt(0).toUpperCase()}${VIEW[vw].word.slice(1)} in each set. ` : 'All picks. ') + (S.sport === 'football' ? 'Each its own record, the same range and filters. As placeable is the real-money plan’s amounts; kept back and live are on paper and never in the headline.'
      : 'Each its own record, the same range and filters, never added together. Tap a set to open it.') }) : '';
  const sports = sportsTiles(ctx, { fold: 'results.sports' });

  const kinds = group(rows, 'kind');
  const kind = !never && kinds.length > 1 ? section('By kind of bet', table({ id: 't-kind', cols: cutCols('Kind'), rows: kinds, rowGo: (r) => ({ tab: 'slices', f: { kind: [r.key] }, rows: 'stat', cols: 'book' }), sort: ctx.sortOf('t-kind') }), { fold: 'results.kind', wide: true }) : '';

  // the same review tables in every sport and set: one cut at a time, each row with its bets and its luck band, and the set's
  // own total beneath (30 Oct 2026, the user's "the same easy analysis for me to review and come up with questions")
  const offeredCuts = M.offered(REVIEW_CUTS, S.sport, rows);
  const first = SPORT_FIRST[S.sport] || [];
  const cuts = [...first.map((id) => offeredCuts.find((c) => c.id === id)).filter(Boolean), ...offeredCuts.filter((c) => !first.includes(c.id))]
    .map((c) => ({ ...c, label: M.cutLabel(c.id, S.sport, c.label), head: c.id === 'teams' && S.sport === 'tennis' ? TENNIS_TEAMS_HEAD : c.head }));
  const cut = cuts.find((c) => c.id === S.resCut) || cuts[0];
  const reviewCols = cutCols(cut.head, { dim: cut.id });
  // a set of team lines offers no Player cut: say where the sport's player lines are (18 Nov 2026, the user: "the Player cut does
  // not work for basketball")
  const pSets = PLAYER_SPORTS.has(S.sport) && !rows.some((r) => r.ptype === 'Player')
    ? setList.filter((x) => base.some((r) => r.set === x.id && r.ptype === 'Player')).map((x) => x.key) : [];
  const playerNote = pSets.length ? `<p class="small muted">This set has no player lines, so no Player cut. The player lines are in: ${pSets.map(esc).join(', ')}.</p>` : '';
  reviewCols.splice(2, 0, { key: 'matches', label: 'Matches', num: true, fmt: (v) => int(v) });   // bets and matches both (the user, 4 Nov 2026)
  const review = never ? '' : section('Review tables', `${chips('resCut', cuts.map((c) => ({ id: c.id, label: c.label })), cut.id, { small: true })}
    ${playerNote}
    ${table({ id: 't-review', cols: reviewCols, rows: floorFlag(group(rows, cut.id), cut.id), foot: { key: 'All', ...agg(rows) },
      rowGo: (r) => ({ f: { [cut.id]: [r.key] }, keep: true }), sort: ctx.sortOf('t-review') })}`,
    { fold: 'results.review', wide: true, sub: 'This set, range and filters, cut one way at a time. A return inside its luck band shows nothing yet. Tap a row to filter to it.' });
  // team picks v player picks, a stat at a time across the sport's sets (the user, 18 Nov 2026 21:31: "basketball rebounds: team
  // counts v player unders"): each set its own row, never added together; tap a row to open its set
  const tRows = PLAYER_SPORTS.has(S.sport) && !never ? M.typeRows(base, (SETS[S.sport] || []).filter((x) => !NEVER_SUMMED.has(x.id))) : [];
  const types = tRows.length ? section('Team v player picks, by stat', table({ id: 't-types', cols: cutCols('Stat · pick type · set', { dim: 'types' }), rows: tRows,
    rowGo: (r) => ({ set: r.set, f: { ptype: [r.ptype] } }), sort: ctx.sortOf('t-types') }),
    { fold: 'results.types', wide: true, sub: 'The same stat as team or match picks and as player picks, each set its own record (never added together), this range and filters. Tap a row to open that set.' }) : '';

  const betCols = [
    { key: 'day', label: 'Day', fmt: (v, r) => `${esc(r.kick ? ukDay(r.kick).slice(5) : (v ? v.slice(5) : '–'))}<span class="muted small"> ${esc(ukHM(r.kick))}</span>` },
    { key: 'bet', label: 'Bet', fmt: (v, r) => `<b>${esc(v)}</b><div class="muted small">${esc(r.match)} · ${esc(compName(r.comp))}</div>` },
    { key: 'book', label: 'At', fmt: (v) => bookChip(v) },
    { key: 'price', label: 'Price', num: true, fmt: (v) => odds(v) },
    { key: 'edge', label: 'Overlay', num: true, fmt: (v) => `<span class="${signClass(v)}">${spct(v)}</span>` },
    { key: 'stake', label: 'Stake', num: true, fmt: (v, r) => `${money(v, '£', 2, false)}${isNum(r.factor) && r.factor < 1 ? ` <span class="muted small" title="already at this share of the rule's stake">×${num(r.factor, 2)}</span>` : ''}` },
    { key: 'actual', label: 'Came to', num: true, fmt: (v) => esc(v ?? '–') },
    { key: 'status', label: 'Result', fmt: (v) => statusTag(v) },
    { key: 'profit', label: 'Profit', num: true, fmt: (v) => `<span class="${signClass(v)}">${isNum(v) ? money(v, '£', 2) : '–'}</span>` },
  ];
  const list = section(`Every bet in this view (${rows.length})`, `<details class="fold" ${rows.length <= 25 ? 'open' : ''}><summary>Show the bets</summary>${table({ id: 't-bets', cols: betCols, rows, rowBet: (r) => r.id, sort: ctx.sortOf('t-bets', { key: 'day', desc: true }) })}</details>`, { fold: 'results.bets', wide: true });

  // the evenings' evaluations (reports/evaluation_<day>.md, written by a Claude chat each evening; the bot's /eval reads the same)
  const evals = D.feed.evaluations || [];
  const evaluations = evals.length ? section('Evening evaluations', evals.map((e, i) => {
    const first = (/^\s*#\s+(.+)$/m.exec(e.md) || [])[1] || dayLabel(e.day);
    return `<details class="fold eval"${i === 0 && evals.length === 1 ? ' open' : ''}><summary>${esc(first)} <span class="muted small">written ${esc(ukStamp(e.made).slice(5))}</span></summary>
      <div class="md">${md(e.md.replace(/^\s*#\s+.+$/m, ''))}</div></details>`;
  }).join(''), { fold: 'results.evals', wide: true, sub: 'How the day went, pick by pick, with the reason each won or lost; basketball, live, the builders and the choices put to you. The newest three.' }) : '';

  const outlets = S.sport === 'football' ? outletsBrief(D.feed.lines?.outlets) : '';   // the bookmakers we do not place at (26 Oct 2026)
  const changes = changesCard(D.feed.change_effects);
  // the top: the set's four numbers (a check that differs from the record stays up there; a never-added set keeps its note), the
  // running profit open; every other card folded below on every screen, nothing removed (30 Oct 2026)
  const nhlTable = S.sport === 'nhl' ? nhlView(D.feed.nhl_view) : '';   // how the NHL view did, folded (1 Nov 2026)
  const html = provenCard(D, section) + bestCard(D.feed.early_winners) + controls + oneViewCard(D.feed.oneview, S.sport) + (never ? setNote : '') + tiles + stakedLine + allLine + (agrees === false ? check : '') + chart + words + (never ? '' : saidCard(rows)) + earlyCard(D.feed.early_winners) + nhlTable + sports + changes + evaluations
    + ol.html + cal + per + expo + sets + kind + review + types + outlets + list;
  const mount = () => {
    const series = [{ name: setDef.label || 'This set', pts: run.pts.map((p) => [p.t, Math.round(p.total * 100) / 100, `${p.r.bet} (${p.r.status}, ${money(p.r.profit, '£', 2)})`]) }];
    if (cmp) {
      const t = C.tokens();
      series[0].color = t.s1;
      for (const [id, label, color] of [['first', 'First shown', t.s3], ['last', 'Last shown', t.muted]]) {
        const rr = running(ctx.scope({ set: id }));
        series.push({ name: label, color, pts: rr.pts.map((p) => [p.t, Math.round(p.total * 100) / 100, `${p.r.bet} (${p.r.status})`]) });
      }
    }
    const el = document.getElementById('ch-run');
    if (el) { el.style.height = '260px'; C.runningChart(el, series.filter((s) => s.pts.length), { area: !cmp }); }
    const dd = document.getElementById('ch-dd');
    if (dd && run.pts.length) { dd.style.height = '90px'; C.drawdownChart(dd, run.pts.map((p) => [p.t, Math.round(p.dd * 100) / 100])); }
    const cal = document.getElementById('ch-cal');
    if (cal) C.calendar(cal, days.filter((d) => d.n).map((d) => [d.day, Math.round(d.profit * 100) / 100, d.n]), { onClick: (day) => ctx.go({ tab: 'results', range: 'custom', from: day, to: day }) });
    const pe = document.getElementById('ch-period');
    if (pe) C.bars(pe, byPeriod(rows, S.period).filter((x) => x.n).map((x) => ({ label: S.period === 'day' ? dayLabel(x.key) : S.period === 'week' ? 'w/c ' + dayLabel(x.key, false) : x.key, value: x.profit,
      sub: `${x.won} of ${x.n} won · ${spct(x.ret)} · luck ±${pct(x.luck)}`, key: x.key })), { fmt: C.FMT.gbp, horizontal: false, height: 220,
      onClick: (r) => S.period === 'day' ? ctx.go({ range: 'custom', from: r.key, to: r.key }) : null });
    const ex = document.getElementById('ch-expo');
    if (ex) {
      const m = new Map();
      for (const r of rows) {
        if (!r.day || !isNum(r.stake)) continue;
        const d = m.get(r.day) || { settled: 0, open: 0 };
        if (r.settled) d.settled += r.stake; else if (r.status === 'open' || r.status === 'in play') d.open += r.stake;
        m.set(r.day, d);
      }
      const days = [...m.keys()].sort().slice(-21).map((k) => ({ label: dayLabel(k), day: k, settled: Math.round(m.get(k).settled), open: Math.round(m.get(k).open) }));
      if (days.length) C.exposure(ex, days, { cap: S.sport === 'football' ? 500 : 0, onClick: (p) => { const d = days[p.dataIndex]; if (d) ctx.go({ range: 'custom', from: d.day, to: d.day }); } });
    }
    const sp = document.getElementById('sp-profit');
    if (sp && run.pts.length > 2) { sp.style.height = '34px'; C.spark(sp, run.pts.slice(-40).map((p) => p.total)); }
    if (ol.mount) ol.mount();
  };
  return { html, mount };
}

// ===== the one-view board (the user's ask 19 Nov 2026 05:55; display only), kept in this view's own file: a new app module would
// need the publish list and the offline shell (board_publish.APP_FILES, sw.js SHELL) =====
// The one-view board (the user's ask, 19 Nov 2026 05:55; display only): every pick of the sport once, team and player picks together,
// by stat, side and competition, one row a team with its players folded under it (a player pick sits under his own team), so the
// key read ("assists unders: team picks v player picks") needs no switching between sets or tabs. The NBA apart from Europe, as in
// every basketball view. From the feed's `oneview` (fm/oneview.py: settled, 20%+ judged whole, each view once); the record at any
// sample, "+21% on 12 (8-4)", "too few" only as a label beside it.

export const OV_MIN = 30;
export const ovState = { region: '', stat: 'all', side: 'all', comp: 'all' };
let last = { OV: null, sport: '' };

const SIDES = { all: 'over and under', over: 'overs', under: 'unders' };

export function ovRec(n, won, profit) {
  if (!n) return '<span class="muted">none</span>';
  const r = Math.round((100 * profit) / n);
  const sign = r > 0 ? '+' : r < 0 ? '−' : '';
  return `<b class="${r > 0 ? 'pos' : r < 0 ? 'neg' : ''}">${sign}${Math.abs(r)}% on ${int(n)}</b> <span class="muted">(${int(won)}-${int(n - won)})${n < OV_MIN ? ' · too few' : ''}</span>`;
}

export function ovRows(OV, sport) {
  const cols = (OV && OV.cols) || [];
  const at = Object.fromEntries(cols.map((c, i) => [c, i]));
  return ((OV && OV.rows) || []).map((r) => Object.fromEntries(cols.map((c) => [c, r[at[c]]]))).filter((r) => r.sport === sport);
}

const add = (a, r) => { a.n += r.n; a.won += r.won; a.profit += r.profit; return a; };
const zero = () => ({ n: 0, won: 0, profit: 0 });

// one row a team: its team picks, its players' picks, both; and its players, each with his own picks (biggest first)
export function ovTeams(rows) {
  const by = new Map();
  for (const r of rows) {
    const t = by.get(r.team) || { team: r.team, teamPicks: zero(), playerPicks: zero(), all: zero(), players: new Map() };
    add(t.all, r);
    if (r.kind === 'player') {
      add(t.playerPicks, r);
      t.players.set(r.player, add(t.players.get(r.player) || zero(), r));
    } else {
      add(t.teamPicks, r);
    }
    by.set(r.team, t);
  }
  return [...by.values()].sort((a, b) => b.all.n - a.all.n || String(a.team).localeCompare(String(b.team)));
}

export function ovPick(rows, st) {
  return rows.filter((r) => (!st.region || r.region === st.region) && (st.stat === 'all' || r.stat === st.stat)
    && (st.side === 'all' || r.side === st.side) && (st.comp === 'all' || r.comp === st.comp));
}

const select = (key, options, value) => `<label class="small">${esc(key)} <select data-ov="${esc(key)}">${options.map(([v, l]) => `<option value="${esc(v)}"${v === value ? ' selected' : ''}>${esc(l)}</option>`).join('')}</select></label>`;

export function ovBody(OV, sport, st = ovState) {
  const all = ovRows(OV, sport);
  if (!all.length) return '<p class="empty">Nothing settled at 20%+ in this sport yet.</p>';
  const regions = [...new Set(all.map((r) => r.region))].sort();
  const region = sport === 'basketball' ? (regions.includes(st.region) ? st.region : (regions.includes('Europe') ? 'Europe' : regions[0])) : '';
  const scope = all.filter((r) => !region || r.region === region);
  const stats = [...new Set(scope.map((r) => r.stat))].sort();
  const comps = [...new Set(scope.map((r) => r.comp))].sort();
  const s = { ...st, region, stat: stats.includes(st.stat) ? st.stat : 'all', comp: comps.includes(st.comp) ? st.comp : 'all' };
  const rows = ovPick(all, s);
  const teams = ovTeams(rows);
  const total = rows.reduce(add, zero());
  const tp = rows.filter((r) => r.kind !== 'player').reduce(add, zero()), pp = rows.filter((r) => r.kind === 'player').reduce(add, zero());
  const controls = `<div class="controls small">
    ${sport === 'basketball' ? select('region', regions.map((x) => [x, x === 'NBA' ? 'the NBA' : x]), region) : ''}
    ${select('stat', [['all', 'every stat'], ...stats.map((x) => [x, x])], s.stat)}
    ${select('side', Object.entries(SIDES), s.side)}
    ${select('comp', [['all', 'every competition'], ...comps.map((x) => [x, x])], s.comp)}
  </div>`;
  const head = `<p class="small">${esc(s.stat === 'all' ? 'Every stat' : s.stat)}, ${esc(SIDES[s.side])}${region ? `, ${esc(region === 'NBA' ? 'the NBA' : region)}` : ''}${s.comp !== 'all' ? `, ${esc(s.comp)}` : ''}: team picks ${ovRec(tp.n, tp.won, tp.profit)} · player picks ${ovRec(pp.n, pp.won, pp.profit)} · both ${ovRec(total.n, total.won, total.profit)}</p>`;
  const line = (t) => {
    const players = [...t.players.entries()].sort((a, b) => b[1].n - a[1].n || String(a[0]).localeCompare(String(b[0])));
    const inner = players.length ? `<ul class="plain small">${players.map(([p, a]) => `<li>${esc(p)}: ${ovRec(a.n, a.won, a.profit)}</li>`).join('')}</ul>` : '<p class="muted small">No player picks.</p>';
    return `<details class="ov-team"><summary><b>${esc(t.team)}</b> · team picks ${ovRec(t.teamPicks.n, t.teamPicks.won, t.teamPicks.profit)} · player picks ${ovRec(t.playerPicks.n, t.playerPicks.won, t.playerPicks.profit)}</summary>${inner}</details>`;
  };
  return `${controls}${head}<div class="ov-teams">${teams.map(line).join('')}</div>`;
}

export function oneViewCard(OV, sport) {
  last = { OV, sport };
  return section('One view: every pick, team and player together', `<div id="oneview-body">${ovBody(OV, sport)}</div>`, {
    id: 'oneview', sub: 'Each pick once (settled, 20%+), whatever its set: a team’s own picks and its players’ picks side by side, its players under it. The NBA apart from Europe.' });
}

// a choice in the card re-draws the card alone
if (typeof document !== 'undefined' && typeof document.addEventListener === 'function') {
  document.addEventListener('change', (e) => {
    const el = e.target;
    const key = el && el.dataset ? el.dataset.ov : null;
    if (!key) return;
    ovState[key] = el.value;
    const body = document.getElementById('oneview-body');
    if (body && last.OV) body.innerHTML = ovBody(last.OV, last.sport);
  });
}
