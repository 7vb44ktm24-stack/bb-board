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
    { id: 'live', label: 'Live tests', note: 'Live alerts and half-time tests, on paper, at their own stakes (tests at one unit): each line once, as first logged.' },
    { id: 'liveall', label: 'Every live source', note: 'Each live source on its own (sent alerts, half-time tests, held lines): one line can show two or three times. For comparing the sources: never added up as a record.' },
    { id: 'every', label: 'Every showing', note: 'Every pick as every run showed it. For cuts and price moves only: never added up as a record.' },
  ],
  basketball: [
    { id: 'paper', label: 'Shown picks', note: 'EuroLeague picks shown (10% or more, not against this season), each once as first shown.' },
    { id: 'kept', label: 'Kept back', note: 'Picks under the 10% bar or against this season’s trend, staked on paper.' },
  ],
  tennis: [{ id: 'paper', label: 'Paper picks', note: 'ATP and WTA picks, each selection once as first shown.' }],
};

// sets that hold the same selection more than once by design: shown for cuts, never added up as a record
export const NEVER_SUMMED = new Set(['every', 'liveall']);

export const SPORTS = [
  { id: 'football', label: 'Football' },
  { id: 'basketball', label: 'Basketball' },
  { id: 'tennis', label: 'Tennis' },
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
  { id: 'conf', label: 'Confidence' },
  { id: 'pband', label: 'Price' },
  { id: 'eband', label: 'Overlay shown' },
  { id: 'eband2', label: 'Overlay shown, finer' },
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
export const FILTERS = ['comp', 'stat', 'side', 'book', 'scope', 'kind', 'conf', 'pband', 'eband', 'eband2', 'lead', 'hour', 'dow', 'against', 'moved', 'margin', 'landed', 'status'];
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
  tab: 'today', sport: 'football', todaySport: 'all', todaySort: 'best', set: 'paper', range: 'all', from: null, to: null, f: {},
  rows: 'stat', cols: 'side', metric: 'ret', min: 5, period: 'day', moneyView: 'groups', theme: 'system', liveOn: true,
  lineSport: 'football', lineMeasure: 'found', lineStat: 'all', lineComp: 'all', lineRef: 'Ours', stakeSet: 'paper', stakeStyle: 'k4', stakeCap: '0.1',
  x: {}, lineOutWho: [], lineOutStat: [],                         // left out: the filters' (e.g. every bookmaker but Pame), the Lines tab's
  trendBy: 'eband', trendMeasure: 'ret', trendPeriod: 'day',     // the Trends tab: the split, the line, day or week cells
  wiBar: '0.2', wiCap: 'none', wiStyle: 'staked', wiPer: '2', wiFrom: 'all', wiOutBook: [], wiOutStat: [], wiOutSide: [],   // the what-if replay
  olSet: 'paper', olEdge: 'record', olDays: '30',                // the bank outlook
  moneyPart: 'money',                                            // the Money tab: the tickets, or the accounts' heat (19 Oct 2026)
};

export const S = { ...DEFAULTS, ...pick(load('state', {}), ['sport', 'todaySport', 'todaySort', 'set', 'range', 'rows', 'cols', 'metric', 'min', 'period', 'theme', 'liveOn', 'moneyView', 'moneyPart',
  'lineSport', 'lineMeasure', 'lineStat', 'lineComp', 'lineRef', 'stakeSet', 'stakeStyle', 'stakeCap', 'lineOutWho', 'lineOutStat',
  'trendBy', 'trendMeasure', 'trendPeriod', 'wiBar', 'wiCap', 'wiStyle', 'wiPer', 'wiFrom', 'wiOutBook', 'wiOutStat', 'wiOutSide', 'olSet', 'olEdge', 'olDays']) };

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
