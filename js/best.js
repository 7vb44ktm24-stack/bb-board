// "How our best bets are doing" (the user keeps asking "how are aces / unders / throw-ins doing"; the orchestrator's ask of 3 Nov
// 2026): a fixed list of the early-winners rows (fm/early_winners.py and the lanes' logs/early_winners/*.json, in the feed's
// early_winners), each with bets, matches, won against what we said, the return and its luck band in plain words. Results' card and
// the bot's answer read the same rows from here.
const has = (re) => (s) => re.test(s);
const not = (re) => (s) => !re.test(s);
const all = (...fs) => (s) => fs.every((f) => f(s));
const ACES = /\baces?\b/;
export const BEST = [
  // a stat named ("how are fouls unders doing") wants that stat's own record, the general answer's (5 Nov 2026: the bot's test)
  { id: 'unders', name: 'Football: unders', label: 'Football unders', words: all(has(/unders?\b/), not(/throw|tennis|aces|double|\bdf\b|nhl|extra|goal|europe|in.?play|\blive\b|middles?|fouls?|shots?|corners?|offsides?|cards?|target|\bsot\b/)) },
  { id: 'throwins', name: 'Football: throw-ins', label: 'Throw-ins', words: all(has(/throw-?ins?/), not(/under|in.?play|\blive\b/)) },
  { id: 'throwins_u', name: 'Football: throw-ins unders', label: 'Throw-ins unders', words: all(has(/throw-?ins?/), has(/under/), not(/in.?play|\blive\b/)) },
  { id: 'eu_throwins', name: 'Europe: throw-ins unders, real money', label: 'Europe throw-ins unders (real money)', words: all(has(/europe|champions|uefa/), has(/throw-?ins?/)) },
  { id: 'eu_goalkicks', name: 'Europe: goal kicks unders, real money', label: 'Europe goal kicks unders (real money)', words: has(/goal.?kicks?/) },
  { id: 'band25', name: 'Football: picks 25%+ over the price', label: 'Football 25%+ over the price', words: has(/25%|25 ?per|big overlay|best band/) },
  { id: 'aces', name: 'Tennis: the aces test, all', label: 'Tennis aces (real money)', words: all(has(ACES), not(/20|30|40/)) },
  { id: 'aces20', name: 'Tennis: aces at 20-29% over the price', label: 'Aces at 20-29%', words: all(has(ACES), has(/20/)) },
  { id: 'aces30', name: 'Tennis: aces at 30-39% over the price', label: 'Aces at 30-39%', words: all(has(ACES), has(/30/)) },
  { id: 'aces40', name: 'Tennis: aces at 40%+ over the price', label: 'Aces at 40%+', words: all(has(ACES), has(/40/)) },
  { id: 'df', name: "Tennis: the double-fault unders' test", label: 'Tennis double faults (real money)', words: has(/double.?faults?|\bdf\b/) },
  { id: 'nhl', sport: 'nhl', name: 'NHL team and match shots at 10%+ (H121)', label: 'NHL team and match shots', words: has(/nhl|hockey/) },
  { id: 'more_shots', name: "The extra leagues' shots overs", label: 'Extra leagues: shots overs', words: has(/extra leagues?|new leagues?|shots overs?/) },
  // basketball's own rows (logs/early_winners/basket.json, Rest's; Today's basketball section, 5 Nov 2026)
  { id: 'basket', sport: 'basketball', name: 'Basketball: the team counts sent unproven', label: 'Basketball team counts (unproven)',
    words: all(has(/basket|euroleague|eurocup|\bnba\b|\bgbl\b|\bacb\b/), not(/assist/)) },
  { id: 'basket_ast', sport: 'basketball', name: "Basketball: assists at 10%+ on the books' main lines (H105's cell)", label: 'Basketball assists at 10%+ (paper)',
    words: has(/assists?/) },
  // Live's new sets (the user's yes of 5 Nov 2026 ~12:00 UK; logs/early_winners/live.json, the names fixed by Live): the sure middles
  // with real money, and the in-play unders sent unproven
  { id: 'mid_tennis', sport: 'tennis', name: 'Tennis: sure middles, real money', label: 'Tennis sure middles (real money)', words: all(has(/middles?/), not(/football/)) },
  { id: 'mid_football', name: 'Football: sure middles, real money', label: 'Football sure middles (real money)', words: all(has(/middles?/), has(/football/)) },
  { id: 'live_fouls', name: 'Live football: in-play fouls unders (H123), unproven', label: 'In-play fouls unders (unproven)', words: all(has(/in.?play|\blive\b/), has(/fouls?/)) },
  { id: 'live_throwins', name: 'Live football: in-play throw-ins unders (H127), unproven', label: 'In-play throw-ins unders (unproven)', words: all(has(/in.?play|\blive\b/), has(/throw/)) },
];
for (const b of BEST) b.sport = b.sport || (/^(aces|df)/.test(b.id) ? 'tennis' : 'football');

// the luck band in plain words: too few to say, inside luck, ahead or behind but not proven, beyond luck
export function verdictWord(r) {
  if (!r || !r.n) return 'nothing settled yet';
  if (r.n < 20 || r.return === null || r.return === undefined || !r.luck) return 'too early to say';
  const z = r.return / r.luck;
  // beyond luck only while no match holds a third of the profit (6 Nov 2026, PA's proposal 2, 9590d17: the one-event share)
  const one = typeof r.biggest === 'number' && r.biggest >= 1 / 3;
  return z >= 2 ? (one ? `ahead, but one match holds ${Math.round(r.biggest * 100)}%` : 'ahead, beyond luck') : z >= 1 ? 'ahead, not proven yet' : z > -1 ? 'inside luck' : z > -2 ? 'behind, not proven yet' : 'behind, beyond luck';
}

export function bestRows(EW) {
  const rows = (EW && EW.rows) || [];
  return BEST.map((b) => ({ ...b, row: rows.find((r) => r.name === b.name) || null }));
}

// the bot: the rows a question names ("how are aces doing", "throw-ins unders?")
export function bestFor(q, EW) {
  const s = String(q || '').toLowerCase();
  return bestRows(EW).filter((b) => b.words(s));
}
