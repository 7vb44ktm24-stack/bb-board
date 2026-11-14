// "Why this pick?" (the user, 4 Nov 2026, on Real Madrid fouls over 9.5: "don't feel it, justify"; "build a justify function to
// give me reasoning per pick, stat etc"): the six parts fm/justify.py writes for each football pick (feed.today.justify, keyed by
// the pick's key), drawn on the pick card's fold (views/today.js) and in the bot's answer to "why Real Madrid fouls" (ask.js).
// The parts are words already; here only the pick's own verdict, the risks that move with the clock or the latest read (the
// line-ups, a stale or gone price, one side read, the sharp book), and **bold**.
import { esc, isNum } from './util.js';
import { agg } from './metrics.js';
import { verdictWord } from './best.js';

export const PARTS = [['number', 'Our number'], ['form', 'Recent form'], ['books', 'The books'], ['record', 'Our record'], ['risks', 'Risks']];
const bold = (s) => esc(s).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>');
const f1 = (x) => (isNum(x) ? x.toFixed(1) : '–');
const pc = (x) => (isNum(x) ? `${Math.round(x * 100)}%` : '–');
const spc = (x) => (isNum(x) ? `${x >= 0 ? '+' : '−'}${Math.round(Math.abs(x) * 100)}%` : '–');

// basketball's picks (5 Nov 2026): the same parts from what the feed already holds, no step of its own: our number and the model's own
// reason, each book's number for the count (the pre-game view, feed.pregame.sports.basketball) and who leans our way, our record on
// the team and stat and on the cell (the feed's bets, the luck in words), the news check and the season's depth. Each team's recent
// games are not on the board for basketball yet.
const B_NAMES = { pts: 'points', reb: 'rebounds', oreb: 'offensive rebounds', dreb: 'defensive rebounds', ast: 'assists', fg3: 'threes made',
  ftm: 'free throws made', tov: 'turnovers', fg2m: 'twos made', stl: 'steals', blk: 'blocks', pf: 'fouls' };
function recordLine(name, rows) {
  const g = agg(rows);
  if (!g.n) return `${name}: no settled picks yet.`;
  const word = verdictWord({ n: g.n, return: g.ret, luck: g.luck, biggest: g.biggest });
  return g.n < 5 ? `${name}: ${g.n} bet${g.n === 1 ? '' : 's'}, ${g.won} won (we said ${pc(g.said)}): **${word}**.`
    : `${name}: ${g.n} bets, won ${pc(g.wonPct)} (we said ${pc(g.said)}), return ${spc(g.ret)}, luck ±${pc(g.luck)}: **${word}**.`;
}
const cap = (s) => `${String(s).charAt(0).toUpperCase()}${String(s).slice(1)}`;
const leanSaid = (lean) => `${lean.filter((x) => x === 'ours').length} of ${lean.length} other book${lean.length > 1 ? 's' : ''} ${lean.length === 1 ? 'leans' : 'lean'} our way`;
// each book's own number for the count from a pre-game view cell, against the book we bet at (or the view's own when ours is not
// read): for an over, a book that sees more leans our way; for an under, fewer
function viewBooks(p, cell) {
  const rivals = (p.rivals || []).filter((r) => isNum(r.price) && r.book !== p.book && (!isNum(r.line) || r.line === p.line));
  const books = isNum(p.price) ? [`Prices for ${p.side} ${p.line}: ${p.book} ${p.price.toFixed(2)} (the pick)${rivals.map((r) => `, ${r.book} ${r.price.toFixed(2)}`).join('')}.`] : [];
  const lean = [];
  let ref = null, level = null;
  if (cell && cell.books && Object.keys(cell.books).length) {
    const lv = cell.books;
    ref = p.book in lv ? p.book : cell.book in lv ? cell.book : Object.keys(lv)[0];
    level = lv[ref];
    const bits = ref !== p.book ? [`${p.book}’s own number is not read, so against ${ref}’s`] : [];
    for (const [b, x] of Object.entries(lv).sort((a, c) => (a[0] !== ref) - (c[0] !== ref) || a[0].localeCompare(c[0]))) {
      if (b === ref) { bits.push(`${b} ${f1(x)}${b === p.book ? ' (the book we bet at)' : ''}`); continue; }
      const d = x - level;
      const l = Math.abs(d) < 0.05 ? 'same' : (d > 0) === (p.side === 'over') ? 'ours' : 'theirs';
      lean.push(l);
      bits.push(`${b} ${f1(x)} (${l === 'same' ? 'the same' : l === 'ours' ? 'leans our way' : 'leans the other way'})`);
    }
    books.push(`The books’ own numbers: ${bits.join('; ')}. Ours **${f1(cell.ours)}**.`);
    if (lean.length) books.push(`${leanSaid(lean)}.`);
  } else books.push('No book’s own number for this count in the pre-game view.');
  return { books, lean, ref, level, ours: cell ? cell.ours : null };
}
// the one-line case: our number against the book's, who leans our way, the cell's luck in words
function caseOf(v, cellName, cellRows) {
  const c = agg(cellRows);
  const bits = [];
  if (isNum(v.ours) && isNum(v.level)) bits.push(`our ${f1(v.ours)} against ${v.ref}’s ${f1(v.level)}`);
  if (v.lean.length) bits.push(leanSaid(v.lean));
  bits.push(`${cellName}: ${c.n ? verdictWord({ n: c.n, return: c.ret, luck: c.luck, biggest: c.biggest }) : 'no settled picks yet'}`);
  return `${bits.join('; ')}.`;
}
function missedOn(rows, whose, word) {
  const t = agg(rows);
  return t.n >= 3 && isNum(t.wonPct) && isNum(t.said) && t.wonPct < t.said - 0.15
    ? [`We have missed on ${whose} ${word} before: won ${pc(t.wonPct)} of ${t.n}, against the ${pc(t.said)} we said.`] : [];
}
const viewOf = (D, sport, match) => (((((D && D.feed) || {}).pregame || {}).sports || {})[sport] || {}).matches?.find((x) => x.match === match);
const settledOf = (D, sport, stat) => ((D && D.bets) || []).filter((r) => r.sport === sport && (r.status === 'won' || r.status === 'lost') && r.stat === stat);

export function basketParts(p, D) {
  const scope = String(p.key || '').split('|')[3] || 'match';             // 'A v B|basketball|reb|match|over'
  const [home, away] = String(p.match).split(' v ');
  const who = scope === 'home' ? home : scope === 'away' ? away : 'the match';
  const word = B_NAMES[p.stat] || p.stat || 'count';
  const number = isNum(p.expected) ? [`Our number: **${f1(p.expected)}** ${word} for ${who}.`] : [];
  const why = String(p.why || '').replace(/^🚩[^.]*\.\s*/, '').trim();
  if (why) number.push(`How it is built: ${why.replace(/\.$/, '')}.`);
  const m = viewOf(D, 'basketball', p.match);
  const row = m && (m.rows || []).find((r) => r.row === (scope === 'home' ? 'h' : scope === 'away' ? 'a' : 't'));
  const v = viewBooks(p, row && row.cells ? row.cells[p.stat] : null);
  const done = settledOf(D, 'basketball', word);
  const teamRows = scope === 'match' ? done.filter((r) => r.scope === 'match total' && String(r.match).split(' v ').some((t) => t === home || t === away))
    : done.filter((r) => r.team === who);
  const cellRows = done.filter((r) => r.side === p.side && r.comp === p.comp);
  const cellName = `${word} ${p.side}s in the ${p.comp}`;
  const record = [recordLine(scope === 'match' ? `${cap(word)} totals in ${home}’s or ${away}’s games` : `${who} ${word}`, teamRows), recordLine(cap(cellName), cellRows)];
  const risks = [];
  const flag = String(p.flag || p.news || '').replace(/^News check\s*/i, '').replace(/\.$/, '').trim();
  if (flag) risks.push(`The news check${flag.startsWith('(') ? ' ' : ': '}${flag}.`);
  const games = /(\d+) games? into the season/.exec(why);
  if (games && +games[1] < 10) risks.push(`Early in the season: ${games[1]} games behind our number.`);
  risks.push(...missedOn(teamRows, scope === 'match' ? 'these teams’' : `${who}’s`, word));
  if (v.lean.length && v.lean.every((x) => x === 'theirs')) risks.push(`Every other book sees ${p.side === 'over' ? 'fewer' : 'more'} than ${v.ref}.`);
  const form = ((((D && D.feed) || {}).today || {}).basket_form || {})[p.key];     // fm/justify.basket_form: each team's last 10 games
  return { number, form: form && form.length ? form : ['Each team’s recent games are not on the board for this game.'], books: v.books, record, risks,
    case: caseOf(v, cellName, cellRows) };
}

// tennis's picks (5 Nov 2026), the same way: the model's note split into its parts (each player's count, by sets, the fair prices to
// the number; the books' and the record's remarks to theirs), each book's number from the tennis pre-game view, the record on these
// players and on the cell (the market, side and tour)
const T_WORD = { aces: 'aces', total: 'games', df: 'double faults', games: 'games' };
const T_RECORD = { aces: 'Aces', total: 'Total games', df: 'Double faults', games: 'Total games' };
const T_CELL = { aces: 'aces', total: 'games', df: 'df', games: 'games' };
export function tennisParts(p, D) {
  const kind = String(p.key || '').split('|')[2] || p.stat || 'aces';     // 'A v B|tennis|aces|under'; a player's count 'aces_a'
  const [base, whose] = kind.split('_');
  const [a, b] = String(p.match).split(' v ');
  const who = whose === 'a' ? a : whose === 'b' ? b : 'the match';
  const word = T_WORD[base] || base;
  const notes = String(p.why || '').split(/;\s*/).map((s) => s.trim()).filter(Boolean);
  const toBooks = notes.filter((s) => /shows only|second opinion|books’? length|books' length|📏/.test(s));
  const toRecord = notes.filter((s) => /picks have \d+ settled/.test(s));
  const built = notes.filter((s) => !toBooks.includes(s) && !toRecord.includes(s));
  const number = isNum(p.expected) ? [`Our number: **${f1(p.expected)}** ${word} for ${who}.`] : [];
  if (built.length) number.push(`How it is built: ${built.join('; ').replace(/\.$/, '')}.`);
  const m = viewOf(D, 'tennis', p.match);
  const row = m && (m.rows || []).find((r) => r.row === (whose === 'a' ? 'a' : whose === 'b' ? 'b' : 't'));
  const v = viewBooks(p, row && row.cells ? row.cells[T_CELL[base] || base] : null);
  v.books.push(...toBooks.map((s) => `${cap(s.replace(/\.$/, ''))}.`));
  const label = T_RECORD[base] || cap(word);
  const done = settledOf(D, 'tennis', label);
  const theirs = done.filter((r) => String(r.match).split(' v ').some((x) => x === a || x === b));
  const cellRows = done.filter((r) => r.side === p.side && r.comp === p.comp);
  const cellName = `${word} ${p.side}s in the ${p.comp}`;
  const record = [recordLine(`${cap(word)} in ${a}’s or ${b}’s matches`, theirs), recordLine(cap(cellName), cellRows), ...toRecord.map((s) => `The model’s own: ${s.replace(/\.$/, '')}.`)];
  const risks = [...missedOn(theirs, 'these players’', word)];
  if (toBooks.some((s) => /shows only/.test(s))) risks.push('One book shows only one side of this line: its prices give no second opinion.');
  if (v.lean.length && v.lean.every((x) => x === 'theirs')) risks.push(`Every other book sees ${p.side === 'over' ? 'fewer' : 'more'} than ${v.ref}.`);
  return { number, form: ['Each player’s recent matches are not on the board yet.'], books: v.books, record, risks, case: caseOf(v, cellName, cellRows) };
}

// the NHL's picks (5 Nov 2026): our shots and each book's own number from Today's NHL games (feed.today.nhl_games, the lane's newest
// judged pass: teams, the match and the players with the biggest gaps), the record on the team or player and on the cell; a game or
// a player the books spell apart is found by any of its spellings (`names`: Kambi's "St Louis Blues", the others' "St. Louis Blues")
export function nhlParts(p, D) {
  const view = ((((D && D.feed) || {}).today || {}).nhl_games || {}).games || [];
  const named = (x, name) => x.match === name || x.team === name || (x.names || []).includes(name);
  const m = view.find((x) => named(x, p.match));
  const scope = p.scope || 'team';                                     // the lane's market: team, match or player
  const row = m && (m.rows || []).find((r) => (scope === 'match' ? r.row === 't' : named(r, p.team)));
  const cell = row && row.cells ? row.cells.shots : null;
  const who = scope === 'match' ? 'the match' : p.team;
  const number = cell && isNum(cell.ours) ? [`Our number: **${f1(cell.ours)}** shots on goal for ${who}.`] : [];
  number.push(`How it is built: the NHL lane’s shots model, judged ${m && m.judged ? 'in its newest pass' : 'before the game'}; its parts are not on the board.`);
  const v = viewBooks(p, cell);
  if (!cell && scope === 'player') v.books[v.books.length - 1] = 'This player is not among the biggest gaps on Today’s NHL table, so each book’s number is not shown here.';
  const done = ((D && D.bets) || []).filter((r) => r.sport === 'nhl' && (r.status === 'won' || r.status === 'lost'));
  const [home, away] = String(p.match).split(' v ');
  const mine = scope === 'match' ? done.filter((r) => r.scope === 'match' && String(r.match).split(' v ').some((t) => t === home || t === away))
    : done.filter((r) => r.team === p.team);
  const cellRows = done.filter((r) => r.stat === p.stat && r.side === p.side);
  const cellName = `${String(p.stat || 'shots')} ${p.side}s`;
  const record = [recordLine(scope === 'match' ? `Match shots in ${home}’s or ${away}’s games` : `${p.team}’s shots`, mine), recordLine(cap(cellName), cellRows)];
  const risks = [...missedOn(mine, scope === 'match' ? 'these teams’' : `${p.team}’s`, 'shots')];
  if (/check on screen/.test(String(p.why || ''))) risks.push('This book’s NHL screen is not checked yet: look that the line shows both sides before placing.');
  if (scope === 'player') risks.push('A player who does not play makes the bet void.');
  if (v.lean.length && v.lean.every((x) => x === 'theirs')) risks.push(`Every other book sees ${p.side === 'over' ? 'fewer' : 'more'} than ${v.ref}.`);
  return { number, form: ['Each team’s recent games are not on the board for the NHL yet.'], books: v.books, record, risks, case: caseOf(v, cellName, cellRows) };
}

// the parts for any pick: football's from the feed (fm/justify.py), basketball's, tennis's and the NHL's from the board's own data
const BUILT = { basketball: basketParts, tennis: tennisParts, nhl: nhlParts };
export function partsFor(p, D) {
  const J = (((D && D.feed) || {}).today || {}).justify || {};
  if (p && J[p.key]) return J[p.key];
  if (!p || !BUILT[p.sport] || !p.match) return null;
  try { return BUILT[p.sport](p, D); } catch (e) { return null; }    // never a broken card: the old fold instead
}

export function justifyOf(p, feedToday) {
  const j = feedToday && feedToday.justify;
  return (p && j && j[p.key]) || null;
}

// what the clock and the latest read add (the board's own fields on the pick)
export function liveRisks(p, now) {
  const out = [];
  const kick = p.kickAt ? p.kickAt.getTime() : null;
  const mins = kick !== null && isFinite(kick) ? (kick - now) / 60000 : null;
  if (p.sport === 'tennis') {
    // no line-ups in tennis: a withdrawal voids the bet
  } else if (p.sport === 'basketball') {
    if (mins !== null && mins > 0) out.push('Who plays is known late in basketball: the news check reads again before tip-off; look before placing.');
  } else if (mins !== null && mins > 75) out.push('The line-ups are not out yet (about an hour before kick-off): a rested regular or a changed shape moves this count.');
  else if (mins !== null && mins > 0) out.push('The line-ups should be out now: look at them before placing.');
  if (p.one_sided) out.push(`Only one side of this line is read at ${p.book}: its prices give no second opinion.`);
  if (p.stale) out.push(`The price may be old: ${p.stale}.`);
  if (p.gone) out.push(typeof p.gone === 'string' ? `${p.gone[0].toUpperCase()}${p.gone.slice(1)}.` : 'The fast lane found this price gone.');
  // fm/tier.py's mark: 'agrees', 'against', 'level', 'no sharp line', 'own'; only 'against' is a risk
  if (p.sharp === 'against') out.push(`The sharp book for this stat leans the other way${p.sharp_why ? `: ${p.sharp_why}` : ''}.`);
  return out;
}

export function verdictLine(p, J) {
  const head = p.verdict_label ? `<b>${esc(p.verdict_label)}</b>${p.verdict_why ? ` <span class="muted">(${esc(p.verdict_why)})</span>` : ''}: ` : '';
  return `${head}${bold(J.case || '')}`;
}

export function justifyHtml(p, J, now) {
  if (!J) return '';
  if (J.error) return `<p class="muted small">The reasons could not be built for this pick (${esc(J.error)}).</p>`;
  const parts = { ...J, risks: [...(J.risks || []), ...liveRisks(p, now)] };
  return `<div class="justify">
      <p class="jverdict">${verdictLine(p, J)}</p>
      ${PARTS.map(([k, title]) => `<div class="jpart"><p class="jh"><b>${title}</b></p>${(parts[k] && parts[k].length ? parts[k] : [k === 'risks' ? 'None that the data shows.' : 'Nothing read.']).map((l) => `<p>${bold(l)}</p>`).join('')}</div>`).join('')}
      ${J.referee ? `<p class="muted small">${bold(J.referee)}</p>` : ''}
    </div>`;
}
