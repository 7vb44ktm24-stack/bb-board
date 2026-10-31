// The page's state: which tab, sport, set of bets, time range, filters and slice. Kept in the link (so a view can be
// shared or bookmarked) and remembered on this phone. Every tap that opens another view goes through go().

import { load, save } from './util.js';

export const TABS = [
  { id: 'today', label: 'Today' },
  { id: 'results', label: 'Results' },
  { id: 'trends', label: 'Trends' },
  { id: 'slices', label: 'Slices' },
  { id: 'model', label: 'Model' },
  { id: 'lines', label: 'Lines' },
  { id: 'money', label: 'Money' },
  { id: 'fun', label: 'Fun' },             // the goals and fun parlays, each leg with its reasons (20 Oct 2026, the user's ask)
  { id: 'ideas', label: 'Ideas' },
];

// the sets of bets (ledger/TRACKING.md); each is its own record, never added to another
export const SETS = {
  football: [
    { id: 'paper', label: 'Paper account', note: 'The headline: each selection once a match day, at its largest stake shown.' },
    { id: 'first', label: 'First shown', note: 'The same selections as the first run showed them: what acting on the first message got.' },
    { id: 'last', label: 'Last shown', note: 'As the last run before kick-off had them: what waiting got.' },
    { id: 'placeable', label: 'As placeable', note: 'The real-money plan after the day cap and the bookmakers’ caps, part by part, at the amounts it would place.' },
    { id: 'kept', label: 'Kept back', note: 'Lines the rule passes but does not send (10% to 20% above the price, or a third pick in a match), staked on paper.' },
    { id: 'newteam', label: 'New team', note: 'Lines in a match where a side has under 20 matches in the data: no pick is sent there, so these go through the same bars and are staked on paper, settled apart (H77). Never sent, never in the headline or the real-money plan.' },
    { id: 'live', label: 'Live tests', note: 'Live alerts and half-time tests, on paper, at their own stakes (tests at one unit): each line once, as first logged.' },
    { id: 'liveall', label: 'Every live source', note: 'Each live source on its own (sent alerts, half-time tests, held lines): one line can show two or three times. For comparing the sources: never added up as a record.' },
    { id: 'liveblend', label: 'Live: the blend 🧪', note: '🧪 unproven: your call. The in-play lines judged on the blend’s chance (Live’s fm/live_blend.py, from 31 Oct 2026) instead of our model’s: each line once, as first logged, at one unit. Half-time lines stay on our model and are not here.' },
    // Rest’s level picks (scripts/level_send.py, the user’s choices of 31 Oct 2026): sent and paper apart, at level stakes of 1
    { id: 'level', label: 'Level picks: sent 🧪', note: '🧪 unproven: your call. Rest’s level picks (our chance without the relative test, from 31 Oct 2026) sent to the BB Picks chat, Serie A fouls unders so far: at level stakes of 1, never in the real-money plan.' },
    { id: 'levelpaper', label: 'Level picks: paper', note: 'The level picks kept on paper (La Liga fouls unders, the EPL’s fouls, on target, corners and offsides cells): at level stakes of 1, beside the sent ones, never added to them.' },
    { id: 'sharpagrees', label: '🎯 Sharp agrees', note: 'The paper account’s picks the stat’s sharp bookmaker agrees with (it hangs its main line a whole line our way or prices our side higher; Rest’s columns from 31 Oct 2026, the user’s choice): unproven, out of the 1-3 score, its own record beside the paper account, never added to it.' },
    { id: 'priceband', label: 'Priced 3.00-3.50 (paper)', note: 'Rest’s lines priced 3.00 to 3.50 that clear the day’s bars (from 31 Oct 2026): never sent, logged each run and settled on paper at one unit; re-judged at the 14 Nov re-measure.' },
    { id: 'every', label: 'Every showing', note: 'Every pick as every run showed it. For cuts and price moves only: never added up as a record.' },
    // the extra leagues on paper (30 Oct 2026, the user's "add all of them to the dashboard"): untested leagues, never in the headline
    { id: 'more', label: 'Extra leagues (paper)', note: 'Rest’s picks in leagues our model has not been tested in, as sent (a line sent then withdrawn left out): level stakes of 1, each line once as first shown. Untested leagues, paper: never in the headline, never added to another set.' },
    { id: 'moreall', label: 'Extra leagues, every line', note: 'Every line on the extra leagues’ 10%+ list, sent or not, at level stakes of 1: beside the sent record, never added to it.' },
  ],
  // every sport's own sets, from what its logs hold (30 Oct 2026, the user's "all sports the same, ready for the NHL")
  basketball: [
    { id: 'paper', label: 'Shown picks', note: 'EuroLeague picks shown (10% or more, not against this season), each once as first shown.' },
    { id: 'kept', label: 'Kept back', note: 'Picks under the 10% bar or against this season’s trend, staked on paper.' },
    { id: 'nba', label: 'NBA paper', note: 'The NBA’s main lines where we stood 10% or more over Superbet’s price, each game’s last reading before tip-off, at level stakes of £10: the NBA card’s paper record. Never sent; re-tested at about 200 games.' },
    { id: 'sent', label: 'Sent 🧪', note: '🧪 unproven: your call. The team counts sent to the BB Picks chat since 31 Oct (scripts/basket_send.py: the Greek league and the ACB, 10%+ on our careful chance at 1.50 to 3.00, two a game, points never, twos made held), at one unit each, settled on the leagues’ box scores. Its own record, never added to another.' },
    { id: 'nbaanchor', label: 'NBA anchored', note: 'The anchored number’s paper picks (our points moved most of the way to the betting market’s, from 29 Oct), at level stakes of £10. Never sent.' },
  ],
  tennis: [
    { id: 'paper', label: 'Paper picks', note: 'ATP and WTA picks, each selection once as first shown.' },
    { id: 'aces', label: 'Aces test', note: 'The aces real-money test (from 20 Oct: 10 a pick, 50 a day, paused at −150), at its own stakes.' },
    { id: 'dftest', label: 'DF unders test', note: 'The double-fault unders real-money test at Superbet (from 30 Oct: 10%+ on our chance, 10 a pick, 50 a day, paused at −100), at its own stakes; a pick joins on our chance, paper stake or not.' },
    { id: 'lengthagrees', label: '📏 Length agrees', note: 'The paper picks on aces and double faults where the books’ games length moved our chance further to the pick’s side (Rest’s column from 31 Oct 2026): its own record beside the paper picks, never added to them; re-measured about 14 Nov.' },
    { id: 'livesent', label: 'Live sent 🧪', note: '🧪 Live tennis, unproven: your call. The in-play suggestions sent to the BB Picks chat since 31 Oct (Live’s scripts/tennis_live_alerts.py, 20%+ on our number), at one unit each: games settle on the final sets, aces and double faults once a count is read. Its own record, never added to another.' },
    { id: 'kept', label: 'Held apart', note: 'Picks held apart, never sent (men’s indoor aces unders, the user’s choice of 19 Oct), staked on paper.' },
  ],
  nhl: [
    { id: 'paper', label: 'Paper picks', note: 'The NHL pilot (from 29 Oct), on paper only: nothing is sent or placed.' },
    { id: 'unproven', label: 'Sent 🧪', note: '🧪 unproven: your call. The NHL picks sent to the BB Picks chat since 31 Oct (scripts/nhl_picks.py: shots on goal 20%+ above the price where our chance was right on unseen games), at one unit each: their own record, never added to another.' },
  ],
};

// sets that hold the same selection more than once by design: shown for cuts, never added up as a record
export const NEVER_SUMMED = new Set(['every', 'liveall']);

export const SPORTS = [
  { id: 'football', label: 'Football' },
  { id: 'basketball', label: 'Basketball' },
  { id: 'tennis', label: 'Tennis' },
  { id: 'nhl', label: 'NHL', lines: false },       // the NHL pilot, on paper (29 Oct 2026); no Lines view of its own yet
];

export const RANGES = [
  { id: 'today', label: 'Today' },
  { id: 'yesterday', label: 'Yesterday' },
  { id: '7d', label: '7 days' },
  { id: '30d', label: '30 days' },
  { id: 'month', label: 'This month' },
  { id: 'all', label: 'All' },
  { id: 'custom', label: 'Dates' },
];

// what a bet can be cut by: the record's own cuts (scripts/ledger.py CUTS) and a few more about time
export const DIMS = [
  { id: 'comp', label: 'League' },
  { id: 'stat', label: 'Stat' },
  { id: 'side', label: 'Over or under' },
  { id: 'statSide', label: 'Stat and direction' },
  { id: 'book', label: 'Bookmaker' },
  { id: 'scope', label: 'Team or match' },
  { id: 'kind', label: 'Kind of bet' },
  { id: 'score', label: 'Score' },                                 // the 1-3 score: confidence retired for it (the user, 31 Oct 2026)
  { id: 'pband', label: 'Price' },
  { id: 'eband', label: 'Overlay shown' },
  { id: 'eband2', label: 'Overlay shown, finer' },
  { id: 'sband', label: 'Stake' },
  { id: 'lead', label: 'Shown before kick-off' },
  { id: 'hour', label: 'Kick-off time (Greek)' },
  { id: 'dow', label: 'Day of the week' },
  { id: 'week', label: 'Week' },
  { id: 'day', label: 'Match day' },
  { id: 'against', label: 'What the other bookmaker says' },
  { id: 'moved', label: 'The price afterwards' },
  { id: 'margin', label: 'How close to the line' },
  { id: 'landed', label: 'Where the count landed' },
  { id: 'nearer', label: 'Whose number was nearer' },
  { id: 'red', label: 'Red cards' },
  { id: 'ht', label: 'Score at half-time' },
  { id: 'settled_on', label: 'Where the result came from' },
  { id: 'part', label: 'Plan part' },
  { id: 'capped', label: 'At a cap' },
  { id: 'match', label: 'Match' },
];
export const DIM = Object.fromEntries(DIMS.map((d) => [d.id, d]));

// the filters offered in the filter sheet, most used first
export const FILTERS = ['comp', 'stat', 'side', 'book', 'scope', 'kind', 'score', 'pband', 'eband', 'eband2', 'sband', 'lead', 'hour', 'dow', 'against', 'moved', 'margin', 'landed', 'status'];
export const FILTER_LABEL = { ...Object.fromEntries(DIMS.map((d) => [d.id, d.label])), status: 'Result' };

export const METRICS = [
  { id: 'ret', label: 'Return, as staked', short: 'Return' },
  { id: 'level', label: 'Return at level stakes', short: 'Level' },
  { id: 'profit', label: 'Profit', short: 'Profit' },
  { id: 'edge', label: 'Won % minus needed %', short: 'Won − needed' },
  { id: 'calib', label: 'Won % minus we said %', short: 'Won − said' },
  { id: 'z', label: 'Return in luck bands', short: 'Luck bands' },
  { id: 'n', label: 'Bets settled', short: 'Bets' },
];

const DEFAULTS = {
  tab: 'today', sport: 'football', allSports: false, todaySport: 'all',   // allSports: the record tabs' sports side by side (29 Oct 2026)
  // on their own line (30 Oct 2026: written after the comment above, they were commented out from 6b11cd8: the board's plain
  // address, with no "#today?..." to fill them, stopped on "Loading the board..." and a link's range and set were ignored)
  todaySort: 'best', set: 'paper', range: 'all', from: null, to: null, f: {},
  rows: 'stat', cols: 'side', metric: 'ret', min: 5, period: 'day', resCut: 'eband2', moreCut: 'all', moreLeague: '', moneyView: 'groups', theme: 'system', liveOn: true,
  lineSport: 'football', lineMeasure: 'found', lineStat: 'all', lineComp: 'all', lineRef: 'Ours', stakeSet: 'paper', stakeStyle: 'k4', stakeCap: '0.1',
  x: {}, lineOutWho: [], lineOutStat: [],                         // left out: the filters' (e.g. every bookmaker but Pame), the Lines tab's
  trendBy: 'eband', trendMeasure: 'ret', trendPeriod: 'day',     // the Trends tab: the split, the line, day or week cells
  wiBar: '0.2', wiCap: 'none', wiStyle: 'staked', wiPer: '2', wiFrom: 'all', wiOutBook: [], wiOutStat: [], wiOutSide: [],   // the what-if replay
  olSet: 'paper', olEdge: 'record', olDays: '30',                // the bank outlook
  moneyPart: 'money',                                            // the Money tab: the tickets, or the accounts' heat (19 Oct 2026)
};

export const S = { ...DEFAULTS, ...pick(load('state', {}), ['sport', 'todaySport', 'todaySort', 'set', 'range', 'rows', 'cols', 'metric', 'min', 'period', 'resCut', 'moreCut', 'moreLeague', 'theme', 'liveOn', 'moneyView', 'moneyPart',
  'lineSport', 'lineMeasure', 'lineStat', 'lineComp', 'lineRef', 'stakeSet', 'stakeStyle', 'stakeCap', 'lineOutWho', 'lineOutStat',
  'trendBy', 'trendMeasure', 'trendPeriod', 'wiBar', 'wiCap', 'wiStyle', 'wiPer', 'wiFrom', 'wiOutBook', 'wiOutStat', 'wiOutSide', 'olSet', 'olEdge', 'olDays']) };

// confidence retired for the 1-3 score (the user, 31 Oct 2026): a view saved on it opens on the score
for (const k of ['rows', 'cols', 'trendBy', 'resCut']) if (S[k] === 'conf') S[k] = 'score';

function pick(o, keys) {
  const out = {};
  for (const k of keys) if (o && o[k] !== undefined) out[k] = o[k];
  return out;
}

const listeners = new Set();
export function onChange(fn) { listeners.add(fn); }

export function set(patch, { push = false, quiet = false } = {}) {
  Object.assign(S, patch);
  if (S.set && !(SETS[S.sport] || []).some((x) => x.id === S.set)) S.set = 'paper';
  save('state', S);
  writeHash(push);
  if (!quiet) for (const fn of listeners) fn();
}

// go({tab, sport, set, range, f: {stat: ['fouls']}, rows, cols, keep}) : open a view. Filters replace the current ones
// unless keep is true (then they are added).
export function go(target = {}) {
  const patch = { ...target };
  delete patch.keep;
  if (target.f) patch.f = target.keep ? mergeF(S.f, target.f) : clean(target.f);
  if (target.f && !target.keep && !target.x) patch.x = {};         // a fresh view starts with nothing left out
  set(patch, { push: !!target.tab && target.tab !== S.tab });
  window.scrollTo({ top: 0, behavior: 'instant' in window ? 'instant' : 'auto' });
}

function clean(f) {
  const out = {};
  for (const [k, v] of Object.entries(f || {})) if (v !== null && v !== undefined && (!Array.isArray(v) || v.length)) out[k] = Array.isArray(v) ? v : [v];
  return out;
}
function mergeF(a, b) {
  const out = { ...a };
  for (const [k, v] of Object.entries(clean(b))) out[k] = [...new Set([...(out[k] || []), ...v])];
  return out;
}

// a filter chip cycles: kept only, then left out, then neither (the user's ask of 18 Oct 2026: "every bookmaker but Pame",
// "every stat but offsides")
export function toggleFilter(key, value) {
  const inc = new Set(S.f[key] || []), exc = new Set((S.x || {})[key] || []);
  if (inc.has(value)) { inc.delete(value); exc.add(value); } else if (exc.has(value)) exc.delete(value); else inc.add(value);
  set({ f: withKey(S.f, key, inc), x: withKey(S.x || {}, key, exc) });
}
export function removeFilter(key, value) {
  const inc = new Set(S.f[key] || []), exc = new Set((S.x || {})[key] || []);
  inc.delete(value); exc.delete(value);
  set({ f: withKey(S.f, key, inc), x: withKey(S.x || {}, key, exc) });
}
function withKey(o, key, values) {
  const out = { ...o, [key]: [...values] };
  if (!out[key].length) delete out[key];
  return out;
}
export function clearFilters() { set({ f: {}, x: {} }); }

// ---------------------------------------------------------------- the link: #tab/key=value&f.stat=a,b

function writeHash(push) {
  const q = new URLSearchParams();
  for (const k of ['sport', 'set', 'range', 'from', 'to', 'rows', 'cols', 'metric', 'todaySport', 'lineSport', 'lineStat', 'moneyPart']) if (S[k] !== null && S[k] !== undefined && S[k] !== DEFAULTS[k]) q.set(k, S[k]);
  for (const [k, v] of Object.entries(S.f)) q.set('f.' + k, v.join('|'));
  for (const [k, v] of Object.entries(S.x || {})) q.set('x.' + k, v.join('|'));
  const keyPart = keyFromHash();                                   // the key stays in the link, so a home-screen icon keeps it
  if (keyPart) q.set('k', keyPart);
  const h = `#${S.tab}${q.toString() ? '?' + q.toString() : ''}`;
  if (location.hash !== h) history[push ? 'pushState' : 'replaceState'](null, '', h);
}

// the key comes in the link: after the # (never sent to a server), or in the query for Telegram's Board button
export function keyFromHash() {
  const raw = `${location.hash.slice(1)}&${location.search.slice(1)}`;
  const m = raw.match(/(?:^|[?&#])k=([A-Za-z0-9_-]{20,})/);
  return m ? m[1] : null;
}

export function readHash() {
  const raw = location.hash.slice(1);
  if (!raw) return;
  const [tab, query] = raw.split('?');
  const patch = {};
  if (TABS.some((t) => t.id === tab)) patch.tab = tab;
  const q = new URLSearchParams(query || '');
  const f = {}, x = {};
  for (const [k, v] of q.entries()) {
    if (k.startsWith('f.')) f[k.slice(2)] = v.split('|').filter(Boolean);
    else if (k.startsWith('x.')) x[k.slice(2)] = v.split('|').filter(Boolean);
    else if (k === 'min') patch.min = +v;
    else if (k !== 'k' && k in DEFAULTS && k !== 'x') patch[k] = v;
  }
  if (Object.keys(f).length || patch.tab) patch.f = f;
  if (Object.keys(x).length || patch.tab) patch.x = x;
  Object.assign(S, patch);
}
