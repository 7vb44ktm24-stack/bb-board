// Ask the board (the user's ask of 18 Oct 2026: the dashboard "more conversational"; their choice: the board answers from
// its own numbers, Claude through a connector for the rest). No AI here: a question is read for what it names (a sport, a
// set of bets, a stat and its direction, a bookmaker, a league, an overlay or price band, a team, a time) and for what it
// asks (how it is doing, by what, best and worst with luck taken out, over time, one thing against another, why a bet went
// as it did, what if the rule were different, where the bank could go ...), typos and all, and answered with the tabs' own
// sums, luck bands included. A follow-up ("and at Superbet?", "last week?") keeps what the last question named. What it
// cannot place goes to Claude with the numbers. Nothing here touches the page: chat.js draws the answers, and the Claude
// connector can run the same answers.

import { esc, money, pct, spct, odds, num, isNum, greekDay, addDays, dayLabel, weekStart, uniq, sum, mean, ukHM, ukStamp } from './util.js';
import { agg, group, running, byDay, streak } from './metrics.js';
import { compName } from './data.js';
import * as T from './trends.js';
import * as W from './whatif.js';
import * as O from './outlook.js';
import { rowsOf as lineRows, byWho, OURS } from './lines.js';
import { guideTopic, guideAnswer } from './guide_terms.js';

// ------------------------------------------------------------------------------------------------ reading words

// the way the user types: short forms read as the words they stand for
const SHORT = [[/\byday\b|\byest\b|\bystday\b/g, 'yesterday'], [/\bwk\b/g, 'week'], [/\bwks\b/g, 'weeks'], [/\btmrw\b|\btmr\b/g, 'tomorrow'], [/\bhw\b/g, 'how'],
  [/\bu\b/g, 'you'], [/\br\b/g, 'are'], [/\bwat\b|\bwht\b/g, 'what'], [/\bdoin\b/g, 'doing'], [/\btonite\b/g, 'tonight'], [/\bpls\b|\bplz\b/g, 'please'],
  [/\bmth\b/g, 'month'], [/\bbtw\b/g, ''], [/\bvs\.?\b/g, 'vs'], [/\bfirst (and|or|vs|versus|against|v) last(?: shown)?\b/g, 'first shown $1 last shown']];
export function norm(s) {
  let t = String(s || '').toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/[’'`´]/g, '')
    .replace(/&/g, ' and ').replace(/[“”"]/g, ' ');
  for (const [re, w] of SHORT) t = t.replace(re, w);
  return t.replace(/\s+/g, ' ').trim();
}
export function tokens(s) { return norm(s).split(/[^a-z0-9%+.]+/).map((t) => t.replace(/^\.+|\.+$/g, '')).filter(Boolean); }

// Damerau-Levenshtein (adjacent swaps count one), given up once past `max`
export function dl(a, b, max = 2) {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  let prev2 = null, prev = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    let low = i;
    for (let j = 1; j <= b.length; j++) {
      let v = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      if (prev2 && i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) v = Math.min(v, prev2[j - 2] + 1);
      cur.push(v);
      if (v < low) low = v;
    }
    if (low > max) return max + 1;
    prev2 = prev; prev = cur;
  }
  return prev[b.length];
}
// a typed word against a known one: the same, or one slip in a word of five letters or more, two in nine or more
export function like(t, w) {
  if (t === w) return true;
  if (Math.min(t.length, w.length) < 5) return false;
  const max = w.length >= 9 ? 2 : 1;
  return dl(t, w, max) <= max;
}

// ------------------------------------------------------------------------------------------------ what the board knows by name

const SPORT_ALIASES = { football: ['football', 'soccer', 'footy'], basketball: ['basketball', 'basket', 'bball', 'hoops'], tennis: ['tennis'] };
const SET_ALIASES = {
  paper: ['paper account', 'paper', 'headline', 'sent picks', 'sent'], first: ['first shown', 'first price', 'first prices', 'first message'],
  last: ['last shown', 'last price', 'last prices', 'closing prices'], placeable: ['as placeable', 'placeable', 'real money plan', 'real plan', 'money plan', 'the plan'],
  kept: ['kept back', 'kept', 'held back'], newteam: ['new team', 'new teams', 'new-team', 'new side', 'promoted'],
  live: ['live tests', 'live test', 'live record', 'live bets', 'half time tests', 'half-time tests', 'live alerts'],
  every: ['every showing', 'all showings', 'every run'],
};
const STAT_ALIASES = {
  'shots on target': ['shots on target', 'shot on target', 'on target', 'sot', 'shots on goal', 'sog'],
  shots: ['shots', 'shot', 'total shots'], fouls: ['fouls', 'foul'], offsides: ['offsides', 'offside', 'offs'],
  'throw-ins': ['throw ins', 'throw-ins', 'throwins', 'throw in', 'throwin', 'throws'], 'goal kicks': ['goal kicks', 'goalkicks', 'goal kick', 'gks'],
  corners: ['corners', 'corner'], cards: ['cards', 'card', 'bookings', 'yellows', 'yellow cards'], goals: ['goals'],
  Aces: ['aces', 'ace'], 'Total games': ['total games', 'games'], 'double faults': ['double faults', 'dfs'],
  rebounds: ['rebounds', 'rebs', 'boards'], 'offensive rebounds': ['offensive rebounds', 'off rebounds', 'orebs'], assists: ['assists', 'ast'],
  turnovers: ['turnovers', 'tos'], 'free throws made': ['free throws', 'free throws made', 'fts'], points: ['points', 'pts'],
};
const BOOK_ALIASES = { Stoiximan: ['stoiximan', 'stoix', 'stx', 'stoiximan.gr'], Superbet: ['superbet', 'super bet', 'sb'], Pamestoixima: ['pamestoixima', 'pame', 'opap'],
  Novibet: ['novibet', 'novi'], bet365: ['bet365', 'b365'] };
const COMP_ALIASES = {
  EPL: ['premier league', 'epl', 'prem', 'premiership', 'england', 'english'], LALIGA: ['la liga', 'laliga', 'spain', 'spanish'],
  SERIEA: ['serie a', 'seria a', 'serie', 'italy', 'italian'], BUNDESLIGA: ['bundesliga', 'germany', 'german', 'buli'],
  LIGUE1: ['ligue 1', 'ligue1', 'ligue', 'france', 'french'], GREEK: ['greek super league', 'super league', 'greek league', 'greece', 'greek'],
  UCL: ['champions league', 'ucl', 'champions'], UEL: ['europa league', 'europa', 'uel'], UECL: ['conference league', 'conference', 'uecl'],
  EuroLeague: ['euroleague', 'euro league'], GBL: ['greek basket league', 'greek basket', 'gbl'], ACB: ['liga acb', 'acb'], NBA: ['nba'], ATP: ['atp'], WTA: ['wta'],
};
const COMP_SPORT = { EuroLeague: 'basketball', GBL: 'basketball', ACB: 'basketball', NBA: 'basketball', ATP: 'tennis', WTA: 'tennis' };
const SIDE_ALIASES = { over: ['over', 'overs'], under: ['under', 'unders'] };
const KIND_ALIASES = { builder: ['bet builders', 'bet builder', 'builders', 'builder', 'bbs', 'bb'], 'stat pick': ['singles', 'single', 'stat picks', 'stat pick'] };
const CONF_ALIASES = { 'Fast lane': ['fast lane', 'fastlane'] };   // High, Medium and Low retired for the 1-3 score (the user, 31 Oct 2026)
const SCORE_ALIASES = { '●●●': ['score 1', 'score one', 'top score', 'three dots'], '●●○': ['score 2', 'score two', 'two dots'],
  '●○○': ['score 3', 'score three', 'one dot', 'weakest score'] };
// a cut asked for by name: "by stat", "which league", "the bands"; plural words count alone, singular ones after a cue
const DIM_ALIASES = {
  statSide: ['stat and direction', 'stats and direction'], stat: ['stats', 'markets', 'stat', 'market'], book: ['bookmakers', 'bookies', 'books', 'bookmaker', 'bookie', 'book'],
  comp: ['leagues', 'competitions', 'league', 'competition', 'comps'], eband2: ['finer bands', 'fine bands', 'finer band'],
  eband: ['overlay bands', 'bands', 'overlays', 'edges', 'band', 'overlay', 'edge'], pband: ['price bands', 'prices', 'odds bands', 'price', 'odds'],
  score: ['confidence levels', 'confidence', 'scores', 'score'], side: ['overs or unders', 'over or under', 'direction', 'sides'], kind: ['kinds', 'types', 'kind', 'type'],
  lead: ['how early', 'timing', 'lead time'], hour: ['kick off times', 'kickoff times', 'time of day'], dow: ['weekdays', 'days of the week', 'weekday'],
  week: ['weeks', 'week by week', 'weekly'], day: ['days', 'day by day', 'daily'],
};
const DIM_WORD = { statSide: 'stat and direction', stat: 'stat', book: 'bookmaker', comp: 'league', eband: 'overlay band', eband2: 'overlay band (finer)', pband: 'price',
  score: 'score', side: 'direction', kind: 'kind of bet', lead: 'how early it was shown', hour: 'kick-off time', dow: 'weekday', week: 'week', day: 'day' };
const SET_WORD = { paper: 'the paper account', first: 'as first shown', last: 'as last shown', placeable: 'the real-money plan (as placeable)', kept: 'kept back, on paper',
  newteam: 'the new-team lines, on paper', live: 'the live tests', every: 'every showing (never added up)', liveall: 'every live source' };
const SET_TITLE = { paper: 'the paper account', first: 'the picks as first shown', last: 'the picks as last shown', placeable: 'the real-money plan (as placeable)',
  kept: 'the lines kept back (on paper)', newteam: 'the new-team lines (on paper, never sent)', live: 'the live tests', every: 'every showing (never added up)', liveall: 'every live source' };
const NEG = new Set(['not', 'no', 'without', 'except', 'excluding', 'exclude', 'minus', 'bar', 'but']);
const STOP = new Set(('the a an and or of in on at for to from by with how is are was were did do does doing done our my me i we you it its this that these those what which why when ' +
  'show tell give me about vs versus v much many so far been be has have had picks pick bets bet over under today yesterday week month day days last this since ' +
  'record return roi profit money made going good bad best worst top far luck lucky price odds line lines all every only just also now please').split(' '));
const COMMON_TEAM_WORDS = new Set(('united city real club fc afc cf ac as sc sv fk sporting athletic atletico olympique inter internazionale borussia bayer rb de la le ' +
  'san saint st hotspur albion wanderers rovers town county young boys stade racing deportivo sport basket bc kk 1 04 05 09 vfb vfl tsg 1899 hellas calcio ' +
  'v and of the').split(' '));

function phraseList(map, dim) {
  const out = [];
  for (const [value, names] of Object.entries(map)) for (const n of names) out.push({ dim, value, words: tokens(n) });
  return out;
}

// the vocabulary of one feed: the fixed names above (kept to those the record holds, for stats) and every team it names
export function vocab(D) {
  const stats = new Set((D.bets || []).map((r) => r.stat).filter(Boolean));
  const statMap = {};
  for (const [k, v] of Object.entries(STAT_ALIASES)) if (stats.has(k)) statMap[k] = v;
  for (const s of stats) if (!statMap[s] && s !== 'bet builder') statMap[s] = [s];
  const list = [
    ...phraseList(SPORT_ALIASES, 'sport'), ...phraseList(SET_ALIASES, 'set'), ...phraseList(statMap, 'stat'), ...phraseList(BOOK_ALIASES, 'book'),
    ...phraseList(COMP_ALIASES, 'comp'), ...phraseList(SIDE_ALIASES, 'side'), ...phraseList(KIND_ALIASES, 'kind'), ...phraseList(CONF_ALIASES, 'conf'), ...phraseList(SCORE_ALIASES, 'score'),
  ].sort((a, b) => b.words.length - a.words.length || b.words.join(' ').length - a.words.join(' ').length);
  const teams = new Map(), acronyms = new Set();                    // team name -> its words; three-letter words a team writes in capitals (AEK)
  const early = (D.feed && D.feed.early) || {};
  for (const r of [...(D.bets || []), ...(D.today || []), ...(early.matches || [])]) {
    for (const t of String(r.match || '').split(' v ')) {
      const name = t.trim();
      if (!name || teams.has(name)) continue;
      teams.set(name, tokens(name));
      for (const w of name.split(/[\s./-]+/)) if (w.length === 3 && /[A-Z]/.test(w) && w === w.toUpperCase()) acronyms.add(w.toLowerCase());
    }
  }
  const earlyDays = new Set((early.matches || []).map((m) => String(m.kick || '').slice(0, 10)).filter(Boolean));
  return { list, teams, acronyms, earlyDays, dims: phraseList(DIM_ALIASES, 'dim').sort((a, b) => b.words.length - a.words.length) };
}

function findPhrases(toks, list, used) {
  const hits = [];
  for (const v of list) {
    const L = v.words.length;
    for (let i = 0; i + L <= toks.length; i++) {
      let ok = true;
      for (let j = 0; j < L && ok; j++) ok = !used[i + j] && like(toks[i + j], v.words[j]);
      if (!ok) continue;
      const before = toks[i - 1] === 'at' || toks[i - 1] === 'in' ? toks[i - 2] : toks[i - 1];
      hits.push({ ...v, at: i, neg: NEG.has(before) });
      for (let j = 0; j < L; j++) used[i + j] = true;
    }
  }
  return hits;
}

// teams named in the words not taken by anything else: a whole name, or a word of it only that team has (Arsenal,
// Brighton, PAOK), a slip allowed in long words; one word several teams share (Real) names them all
function findTeams(toks, used, teams, acronyms = new Set()) {
  const found = new Set();
  const free = toks.map((t, i) => (used[i] || STOP.has(t) ? null : t));
  for (const [name, words] of teams) {
    const L = words.length;
    for (let i = 0; i + L <= free.length && L > 1; i++) {
      if (words.every((w, j) => free[i + j] && like(free[i + j], w))) found.add(name);
    }
  }
  const owners = new Map();                                        // a distinctive word -> the teams with it
  for (const [name, words] of teams) for (const w of words) if (!COMMON_TEAM_WORDS.has(w) && (w.length >= 4 || (w.length === 3 && acronyms.has(w)))) {
    if (!owners.has(w)) owners.set(w, new Set());
    owners.get(w).add(name);
  }
  free.forEach((t, i) => {
    if (!t || t.length < 3 || /^\d/.test(t)) return;
    for (const [w, names] of owners) {
      if (t === w || (t.length >= 5 && like(t, w))) { names.forEach((n) => found.add(n)); used[i] = true; }
    }
  });
  return [...found];
}

// ------------------------------------------------------------------------------------------------ time words

const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
const DOWS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
const MONTH_RE = '(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)';
const DOW_RE = '(mon(?:day)?|tue(?:s(?:day)?)?|wed(?:s|nesday)?|thu(?:r(?:s(?:day)?)?)?|fri(?:day)?|sat(?:urday)?|sun(?:day)?)';
const monthOf = (s) => MONTHS.indexOf(s.slice(0, 3));
function dateOf(today, d, m) {                                      // the latest such date on or before today
  let y = +today.slice(0, 4);
  const iso = (yy) => `${yy}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  if (iso(y) > today) y -= 1;
  return iso(y);
}
function lastDow(today, dow) {
  for (let i = 0; i < 7; i++) { const d = addDays(today, -i); if (new Date(`${d}T12:00:00Z`).getUTCDay() === dow) return d; }
  return today;
}

// the time a question names, as match days [from, to], with its words; `text` loses the words it used
export function readPeriods(text, today) {
  const out = [];
  let t = ` ${text} `;
  const take = (re, fn) => { t = t.replace(re, (...m) => { const p = fn(m); if (p) out.push({ ...p, at: m[m.length - 2] }); return ' '; }); };
  const wk = weekStart(today);
  take(/\b(?:from|between)\s+(\d{1,2})(?:st|nd|rd|th)?\s*(?:to|and|-)\s*(\d{1,2})(?:st|nd|rd|th)?\s+(?:of\s+)?(\w+)\b/g, (m) => {
    const mo = monthOf(m[3]); if (mo < 0) return null;
    const a = dateOf(today, +m[1], mo), b = dateOf(today, +m[2], mo);
    return { from: a, to: b, words: `${dayLabel(a, false)} to ${dayLabel(b, false)}` };
  });
  take(new RegExp(`\\bsince\\s+(?:the\\s+)?(\\d{1,2})(?:st|nd|rd|th)?\\s+(?:of\\s+)?${MONTH_RE}\\b`, 'g'), (m) => { const a = dateOf(today, +m[1], monthOf(m[2])); return { from: a, to: today, words: `since ${dayLabel(a, false)}` }; });
  take(new RegExp(`\\bsince\\s+${MONTH_RE}\\s+(\\d{1,2})(?:st|nd|rd|th)?\\b`, 'g'), (m) => { const a = dateOf(today, +m[2], monthOf(m[1])); return { from: a, to: today, words: `since ${dayLabel(a, false)}` }; });
  take(new RegExp(`\\bsince\\s+(?:last\\s+)?${DOW_RE}\\b`, 'g'), (m) => { const a = lastDow(addDays(today, -1), DOWS.indexOf(m[1].slice(0, 3))); return { from: a, to: today, words: `since ${dayLabel(a)}` }; });
  take(/\b(?:in\s+the\s+|over\s+the\s+|the\s+)?(?:last|past|previous)\s+(\d{1,3})\s+(day|days|week|weeks)\b/g, (m) => { const n = +m[1] * (m[2].startsWith('week') ? 7 : 1); return { from: addDays(today, -(n - 1)), to: today, words: `the last ${n} days` }; });
  take(/\b(\d{1,3})\s*d\b/g, (m) => ({ from: addDays(today, -(+m[1] - 1)), to: today, words: `the last ${m[1]} days` }));
  take(/\b(?:this|current)\s+week\b/g, () => ({ from: wk, to: today, words: `this week (since ${dayLabel(wk)})` }));
  take(/\b(?:last|previous)\s+week\b/g, () => { const a = addDays(wk, -7); return { from: a, to: addDays(wk, -1), words: `last week (${dayLabel(a, false)} to ${dayLabel(addDays(wk, -1), false)})` }; });
  take(/\b(?:this|current)\s+month\b/g, () => ({ from: today.slice(0, 8) + '01', to: today, words: 'this month' }));
  take(/\b(?:last|previous)\s+month\b/g, () => { const a = addDays(today.slice(0, 8) + '01', -1); return { from: a.slice(0, 8) + '01', to: a, words: 'last month' }; });
  take(/\b(?:this\s+|last\s+|the\s+)?weekend\b/g, () => {
    const dow = new Date(`${today}T12:00:00Z`).getUTCDay();
    const sat = dow === 6 ? today : dow === 0 ? addDays(today, -1) : lastDow(today, 6);
    return { from: sat, to: addDays(sat, 1) > today ? today : addDays(sat, 1), words: `the weekend (${dayLabel(sat, false)} and ${dayLabel(addDays(sat, 1), false)})` };
  });
  take(/\b(?:yesterday|last night)\b/g, () => { const y = addDays(today, -1); return { from: y, to: y, words: `yesterday (${dayLabel(y)})` }; });
  take(/\b(?:today|tonight|this evening|this afternoon|this morning)\b/g, () => ({ from: today, to: today, words: 'today' }));
  take(new RegExp(`\\b(?:on\\s+)?(?:the\\s+)?(\\d{1,2})(?:st|nd|rd|th)?\\s+(?:of\\s+)?${MONTH_RE}\\b`, 'g'), (m) => { const a = dateOf(today, +m[1], monthOf(m[2])); return { from: a, to: a, words: `on ${dayLabel(a)}` }; });
  take(new RegExp(`\\b(?:on\\s+)?${MONTH_RE}\\s+(\\d{1,2})(?:st|nd|rd|th)?\\b`, 'g'), (m) => { const a = dateOf(today, +m[2], monthOf(m[1])); return { from: a, to: a, words: `on ${dayLabel(a)}` }; });
  take(/\b(?:on\s+)?(\d{1,2})\/(\d{1,2})\b/g, (m) => { const mo = +m[2] - 1; if (mo < 0 || mo > 11) return null; const a = dateOf(today, +m[1], mo); return { from: a, to: a, words: `on ${dayLabel(a)}` }; });
  take(new RegExp(`\\b(?:on\\s+|last\\s+)?${DOW_RE}\\b`, 'g'), (m) => { const a = lastDow(today, DOWS.indexOf(m[1].slice(0, 3))); return { from: a, to: a, words: `on ${dayLabel(a)}` }; });
  take(/\b(?:all time|ever|overall|so far|in total|the whole record|since the start|from the start)\b/g, () => ({ from: null, to: null, words: 'so far', all: true }));
  out.sort((a, b) => a.at - b.at);
  return { periods: out, rest: t.replace(/\s+/g, ' ').trim() };
}

// ------------------------------------------------------------------------------------------------ bands and prices

const STD_BANDS = [[0, 0.10, 'under 10%'], [0.10, 0.20, '10% to 19%'], [0.20, 0.30, '20% to 29%'], [0.30, Infinity, '30% and over']];
export function bandWords([a, b]) {
  const s = STD_BANDS.find(([x, y]) => Math.abs(x - a) < 1e-9 && (y === b || Math.abs(y - b) < 1e-9));
  if (s) return s[2];
  if (b === Infinity) return `${Math.round(a * 100)}% and over`;
  if (a === 0) return `under ${Math.round(b * 100)}%`;
  return `${Math.round(a * 100)}% to ${Math.round(b * 100) - 1}%`;
}
function readBands(text) {
  const out = { edge: [], price: [] };
  let t = ` ${text} `;
  const take = (re, fn) => { t = t.replace(re, (...m) => { const r = fn(m); if (r) out[r.kind].push(r.range); return r ? ' ' : m[0]; }); };
  take(/\b(?:odds|price|priced|prices)\s+(?:of\s+|at\s+|between\s+)?(\d+(?:\.\d+)?)\s*(?:-|to|and)\s*(\d+(?:\.\d+)?)\b/g, (m) => ({ kind: 'price', range: [+m[1], +m[2] + 1e-9] }));
  take(/\b(?:odds|price|priced|prices)\s+(?:over|above|of more than|more than|at least|>)\s*(\d+(?:\.\d+)?)\b/g, (m) => ({ kind: 'price', range: [+m[1], Infinity] }));
  take(/\b(?:odds|price|priced|prices)\s+(?:under|below|less than|<)\s*(\d+(?:\.\d+)?)\b/g, (m) => ({ kind: 'price', range: [1, +m[1]] }));
  take(/\b(?:long odds|longshots?|long shots?|outsiders?)\b/g, () => ({ kind: 'price', range: [3.5, Infinity] }));
  take(/\b(?:short odds|short prices|favourites|favorites|odds on)\b/g, () => ({ kind: 'price', range: [1, 1.6] }));
  take(/\b(?:at\s+)?evens\b/g, () => ({ kind: 'price', range: [1.9, 2.15] }));
  take(/\b(\d{1,2})\s*(?:%|pc|percent)?\s*(?:-|to|–)\s*(\d{1,2})\s*(?:%|pc|percent)(?:\s*(?:band|overlay|edge))?/g, (m) => ({ kind: 'edge', range: [+m[1] / 100, (+m[2] + (+m[2] % 10 === 9 ? 1 : 0)) / 100] }));
  take(/\b(\d{1,2})\s*(?:-|to|–)\s*(\d{1,2})\s*(?:band|overlay|edge|bands)\b/g, (m) => ({ kind: 'edge', range: [+m[1] / 100, (+m[2] + (+m[2] % 10 === 9 ? 1 : 0)) / 100] }));
  take(/\b(?:the\s+)?(\d{1,2})\s*(?:%|pc|percent)?\s*(?:-|to|–)\s*(\d{1,2})\b(?!\s*(?:\.|\/|oct|nov|sep|dec|jan|feb|mar|apr|may|jun|jul|aug))/g, (m) => (+m[1] < +m[2] && +m[2] <= 100 && +m[1] % 5 === 0 ? { kind: 'edge', range: [+m[1] / 100, (+m[2] + (+m[2] % 10 === 9 ? 1 : 0)) / 100] } : null));
  take(/\b(\d{1,2})\s*(?:%|pc|percent)?\s*(?:\+|plus|and over|and above|or more|or higher|and up)/g, (m) => ({ kind: 'edge', range: [+m[1] / 100, Infinity] }));
  take(/\b(?:over|above|more than|at least|>=?)\s*(\d{1,2})\s*(?:%|pc|percent)/g, (m) => ({ kind: 'edge', range: [+m[1] / 100, Infinity] }));
  take(/\b(?:under|below|less than|<)\s*(\d{1,2})\s*(?:%|pc|percent)/g, (m) => ({ kind: 'edge', range: [0, +m[1] / 100] }));
  take(/\b(?:the\s+)?([1-4]0)s\b/g, (m) => ({ kind: 'edge', range: [+m[1] / 100, (+m[1] + 10) / 100] }));
  take(/\b(?:big|huge|biggest|large|high)\s+(?:overlays?|edges?|value)\b/g, () => ({ kind: 'edge', range: [0.3, Infinity] }));
  return { ...out, rest: t.replace(/\s+/g, ' ').trim() };
}

// ------------------------------------------------------------------------------------------------ what is asked

const RX = {
  help: /\b(help|menu|what can (you|i) (do|ask)|what do you (know|answer)|how does this work|how do i use|examples?|commands?)\b/,
  // the method changes' effect (30 Oct 2026, the user: "need to see effects of overlay rescoring"): before help, which shares "help"
  changes: /\b((did|have|has) (the |our |these |those |my )?(method |model |overlay )?changes? (help|work|worked|pay|paid|make (it|things) better|improve\w*)|method changes?|(overlay )?rescor\w*|effects? of (the |our )?(method |overlay )?changes?|changes? (we|you) made)\b/,
  extremes: /\b(biggest|largest|heaviest) (win|wins|winner|winners|loss|losses|loser|losers|bet|bets|result|results)\b|\b(best|top) (win|wins|winner|winners|result|results)\b|\bworst (bet|bets|loss|losses|loser|losers|result|results)\b/,
  ahead: /\b(tomorrow|upcoming|coming up|next (game|games|match|matches|fixture|fixtures|day)|fixtures?|whats on|what is on|lined up|on the cards)\b/,
  greet: /^(hi|hello|hey|yo|hiya|good (morning|evening|afternoon|night)|morning|evening|gm|sup)\b/,
  thanks: /^(thanks|thank you|thx|cheers|ty|nice|great|cool|ok|okay|perfect|brilliant)\b/,
  whatif: /\b(what if|what would|would (we|i|it) have|if (we|i) (had|raised|lowered|used|bet|only|left|dropped|sent)|if the bar|replay|simulat|instead of|raise the bar|lower the bar|bar (at|to|of)|with (a|the) bar|send bar|kelly|level stakes?)\b/,
  outlook: /\b(outlook|forecast|projection|project|next (\d+ )?(days|weeks|month|months)|in \d+ (days|weeks)|where (will|could|might) (we|it|the bank)|future|risk of ruin|ruin|risk of (losing|a fall|falling|going down|a loss)|how (much|far) could (we|i|it) (lose|fall|drop)|chance (of|to) (lose|fall|drop|go down|losing|falling)|expected (bank|profit)|bank outlook)\b/,
  market: /\b(clv|closing (line|price)s?|beat the (close|closing|market)|market|price (move|moved|movement|moves)|prices? (move|moves|moving|moved|shorten\w*|drift\w*)|line moves?|steam|shorten|drift)\b/,
  lines: /\b(who found|found the line|closer to the (line|count)|line judge|whose (line|number)|who (is|was|got) closer|nearest line|forecast(er)? accuracy|who forecasts)\b|^lines?\b/,
  why: /\b(why|how come|reason|what happened|explain (the|that|this|my) (bet|loss|win|pick|result))\b/,
  empty: /\b(no|empty|none|nothing|missing|zero) (picks?|bets?|30|20|lines?)\b|\bwhy (no|not|nothing|empty)\b/,
  luck: /\b(luck|lucky|unlucky|variance|significan\w*|skill|is (it|this|that) real|real edge|real or|genuine|noise|by chance|sample size|confidence interval)\b|\breal\s*\??$/,
  bank: /\b(drawdown|draw down|bank ?roll|bank|peak|from the (top|high)|fall from|losing (run|streak)|winning (run|streak)|streaks?|down from|biggest (fall|drop|loss))\b/,
  trend: /\b(trend|trends|trending|over time|evolution|evolv\w*|improv\w*|getting (better|worse)|progress\w*|history|momentum|lately|recently|chart|graph|curve)\b/,
  compare: /\b(vs|versus|compare\w*|comparison|against|difference between|better than|or)\b/,
  bestpick: /\b(best|top|strongest|biggest|safest|favourite|favorite) (pick|bet|tip|play|value|selection)s?\b|\bbanker\b|\bbest (one|today)\b/,
  picks: /\b(picks?|tips?|selections?|what (to|should i|do i|can i|shall i) (bet|place|play|back)|to place|bets? (for )?today|todays bets|todays picks|tonight|place now)\b/,
  open: /\b(open|pending|running|unsettled|still (to )?play\w*|waiting)\b/,
  live: /\b(live|in[- ]play|right now|happening now|in progress|currently)\b/,
  results: /\b(results?|how did|did we|did it|won|lost|settled|last night|scores?|outcome)\b/,
  money: /\b(real money|tickets?|my (real )?bets|my accounts?|actual bets|cash|bookie accounts?|accounts?|wallet|balance)\b/,
  // the accounts' heat (19 Oct 2026): how sure each bookmaker can be that the account beats its prices
  heat: /\b(heat|hot (accounts?|bookies?|bookmakers?)|account heat|how sharp|sharp (do )?i look|look sharp|limit(ed|s|ing)?|gubb\w*|restrict\w*|stake (cuts?|limits?|checks?)|max(imum)? stakes?|caps?|capped|spare|rest (an?|the|my|which) (account|bookmaker|bookie)|(account|bookmaker|bookie)s? to (rest|spare|avoid)|risk team|banned|account (health|safety|risk|status)|accounts? (safe|ok|at risk|hot)|(accounts?|bookmakers?|bookies?) (is|are|getting|look|looks) (hot|sharp|safe|limited|at risk))\b/,
  placed: /\b(placed|did i place|i placed|marked? (as )?placed)\b/,
  ideas: /\b(ideas?|hypothes\w*|being tested|under test|experiments?|h\d{1,3}|what (are|is) (we|being) test\w*|testing)\b/,
  fresh: /\b(fresh\w*|last run|when (was|is|did) (it|the board|the data|the run) (updated|built|run|refresh\w*)|updated|stale|data age|next run|next update|last update|when (is|does|will) (the next|it|the board) (update|run|refresh)\w*|schedule|is it up to date)\b/,
  parlays: /\b(parlays?|accas?|accumulators?|doubles|trebles|fun bets?|goals parlays?|covered treble)\b/,
  view: /\b(this view|this page|this tab|what am i looking at|explain (this|the view|the page|the screen))\b/,
  brief: /\b(summary|summari[sz]e|brief|briefing|overview|catch me up|whats new|what is new|anything new|update me|news|how are we doing|how is it going|hows it going|how we doing|how are things)\b/,
  rank: /\b(best|worst|top|bottom|most|least|hot|hottest|cold|coldest|strongest|weakest|leading|which|what|highest|lowest)\b/,
  perf: /\b(how|doing|roi|return|returns|yield|profit|profits|pnl|p and l|performance|record|made|making|going|up|down|win rate|hit rate|strike rate)\b/,
  follow: /^(and|what about|how about|also|same for|and for|now|only|just|but|then|ok and|what of)\b/,
};

function emptyQ() { return { intent: null, sport: null, set: null, f: {}, x: {}, kind: null, teams: [], edge: null, price: null, line: null, from: null, to: null, periodWords: '', all: false, dim: null, cmp: null, periods: [], words: [] }; }

// a question read: what it names and asks; `prev` the last question, for follow-ups
export function parse(text, V, today, prev = null) {
  const raw = String(text || '');
  const t0 = norm(raw);
  const q = emptyQ();
  q.text = raw;
  const { periods, rest: t1 } = readPeriods(t0, today);
  const bands = readBands(t1);
  const toks = tokens(bands.rest.replace(/\b(over time|over the|all over|under test|under way|under the|go over|went over)\b/g, ' '));
  const used = toks.map(() => false);
  // a line, like 23.5: kept for a bet's look-up
  toks.forEach((tk, i) => { if (/^\d{1,3}\.5$/.test(tk)) { q.line = +tk; used[i] = true; } });
  const hits = findPhrases(toks, V.list, used);
  const dimHits = findPhrases(toks, V.dims, toks.map((_, i) => used[i]));
  q.teams = findTeams(toks, used, V.teams, V.acronyms);
  const multi = {};
  for (const h of hits) {
    if (h.dim === 'sport') { q.sport = h.value; continue; }
    if (h.dim === 'set') { (multi.set = multi.set || []).push(h.value); q.set = q.set || h.value; continue; }
    if (h.dim === 'kind') { q.kind = h.value; continue; }
    const into = h.neg ? q.x : q.f;
    into[h.dim] = uniq([...(into[h.dim] || []), h.value]);
    if (!h.neg) (multi[h.dim] = multi[h.dim] || []).push(h.value);
    if (h.dim === 'comp' && COMP_SPORT[h.value] && !q.sport) q.sport = COMP_SPORT[h.value];
  }
  if (bands.edge.length) q.edge = bands.edge[0];
  if (bands.price.length) q.price = bands.price[0];
  if (periods.length) { const p = periods[0]; q.from = p.from; q.to = p.to; q.periodWords = p.words; q.all = !!p.all; }
  q.periods = periods;
  // a cut by name ("by stat", "which league", "the bands"): plural words alone, singular after a cue word
  const cue = /\b(by|per|each|which|what|best|worst|top|bottom|across|split|breakdown|every|all|hot|cold|hottest|coldest|strongest|weakest|most|least|highest|lowest|biggest|smallest)\b/.test(t0);
  const d = dimHits.find((h) => cue || /s$/.test(h.words[h.words.length - 1]) || h.words.length > 1);
  if (d) q.dim = d.value;
  // two of one kind named: a comparison ("Superbet v Stoiximan", "overs or unders", "first or last shown", two bands, two times)
  const two = Object.entries(multi).find(([, v]) => uniq(v).length >= 2);
  if (two) q.cmp = { dim: two[0], values: uniq(two[1]).slice(0, 2) };
  else if (bands.edge.length >= 2) { q.cmp = { dim: 'edge', values: bands.edge.slice(0, 2) }; q.edge = null; }
  else if (periods.length >= 2) { q.cmp = { dim: 'period', values: periods.slice(0, 2) }; q.from = null; q.to = null; q.periodWords = ''; }
  if (two && q.f[two[0]]) delete q.f[two[0]];                    // compared, not filtered
  if (two && two[0] === 'set') q.set = null;
  q.ahead = aheadDays(t0, today);
  q.aheadKnown = q.ahead.some((d) => d === '*' || (V.earlyDays && V.earlyDays.has(d)));
  q.intent = decide(t0, q, prev);
  q.followUp = !!(prev && (RX.follow.test(t0) || ((q.weak || !q.intentSure) && t0.split(' ').length <= 5)));
  if (q.followUp && prev) merge(q, prev);
  q.what = whatNamed(q);
  return q;
}

// days ahead a question names: tomorrow, the next such weekday, or every day the early look reads ("upcoming", "fixtures")
function aheadDays(t, today) {
  const out = [];
  if (/\bday after tomorrow\b/.test(t)) out.push(addDays(today, 2)); else if (/\btomorrow\b/.test(t)) out.push(addDays(today, 1));
  const m = t.match(new RegExp(`\\b${DOW_RE}\\b`));
  if (m && !/\b(last|since|past|previous)\b/.test(t)) {
    const want = DOWS.indexOf(m[1].slice(0, 3));
    for (let i = 1; i <= 7; i++) { const d = addDays(today, i); if (new Date(`${d}T12:00:00Z`).getUTCDay() === want) { out.push(d); break; } }
  }
  if (!out.length && RX.ahead.test(t)) out.push('*');
  return out;
}

function anyNamed(q) { return !!(q.sport || q.set || q.kind || q.teams.length || q.edge || q.price || Object.keys(q.f).length || Object.keys(q.x).length || q.line); }

function decide(t, q, prev) {
  const has = (k) => RX[k].test(t);
  const short = t.split(' ').length <= 3;
  q.intentSure = true;
  if (has('changes')) return 'changes';
  if (has('help')) return 'help';
  const gt = q.teams.length ? null : guideTopic(t);              // how our numbers work (29 Oct 2026): before why and whatif, which share
  if (gt) { q.guide = gt; return 'guide'; }                      // its words ("why ... paper", "the bar"); a named team asks about a pick
  if (has('extremes') && !has('whatif')) return 'extremes';
  if (q.ahead.length && !/\b(did|won|lost|results?|went|go|was|were|how did)\b/.test(t) && (q.aheadKnown || has('ahead'))) return 'ahead';
  if (short && has('greet')) return 'greet';
  if (short && has('thanks') && !anyNamed(q)) return 'thanks';
  if (has('whatif')) return 'whatif';
  if (has('outlook')) return 'outlook';
  if (has('view')) return 'view';
  if (has('heat')) return 'heat';
  if (has('why')) return has('empty') && !q.teams.length && !q.line ? 'whyempty' : 'why';
  if (q.dim && has('rank') && !has('trend') && !q.cmp) return 'rank';
  if (has('lines')) return 'lines';
  if (has('market')) return 'market';
  if (has('luck')) return 'luck';
  if (has('ideas') && !has('parlays')) return 'ideas';
  if (has('fresh')) return 'fresh';
  if (has('parlays')) return 'parlays';
  if (has('placed') && !has('money')) return 'placed';
  if (has('money') && !q.set) return 'money';
  if (has('bestpick')) return 'bestpick';
  if (has('trend')) return 'trend';
  if (has('bank') && !has('picks')) return 'bank';
  if (q.cmp && (has('compare') || q.cmp.values.length === 2)) return 'compare';
  if (q.dim && has('rank')) return 'rank';
  if (q.dim) return 'breakdown';
  if (has('live') && !q.set) return 'live';
  if (has('open')) return 'open';
  if (has('picks') && !has('results') && !/\b(did|were|was|went|go)\b/.test(t)) return 'picks';
  if (has('results')) return 'results';
  if (q.from && !anyNamed(q) && !has('perf')) { q.weak = true; return 'results'; }
  if (has('brief') && !anyNamed(q)) return 'brief';
  if (has('perf')) return 'perf';
  if (anyNamed(q) || q.from) { q.weak = true; return 'perf'; }
  q.intentSure = false;
  if (prev) return prev.intent;
  return 'unknown';
}

// a follow-up keeps what the last question named, unless this one names another of the same kind
function merge(q, prev) {
  for (const k of ['sport', 'set', 'kind', 'edge', 'price', 'line', 'dim']) if (q[k] === null || q[k] === undefined) q[k] = prev[k];
  if (!q.teams.length) q.teams = prev.teams;
  for (const k of Object.keys(prev.f)) if (!q.f[k] && !q.x[k]) q.f[k] = prev.f[k];
  for (const k of Object.keys(prev.x)) if (!q.f[k] && !q.x[k]) q.x[k] = prev.x[k];
  if (!q.from && !q.all) { q.from = prev.from; q.to = prev.to; q.periodWords = prev.periodWords; }
  if (!q.intentSure || q.weak || q.intent === 'perf') q.intent = ['unknown', 'help', 'greet', 'thanks', 'brief'].includes(prev.intent) ? 'perf' : prev.intent;
  if (!q.cmp && prev.cmp && q.intent === 'compare') q.cmp = prev.cmp;
}

function whatNamed(q) {
  const out = [];
  if (q.sport) out.push(q.sport);
  if (q.set) out.push(SET_WORD[q.set] || q.set);
  for (const [k, v] of Object.entries(q.f)) out.push(...v.map((x) => (k === 'comp' ? compName(x) : x)));
  for (const [k, v] of Object.entries(q.x)) out.push(...v.map((x) => `not ${k === 'comp' ? compName(x) : x}`));
  if (q.kind) out.push(q.kind === 'builder' ? 'builders' : 'singles');
  if (q.teams.length) out.push(...q.teams);
  if (q.edge) out.push(`overlay ${bandWords(q.edge)}`);
  if (q.price) out.push(`price ${priceWords(q.price)}`);
  if (q.line) out.push(`line ${q.line}`);
  if (q.periodWords) out.push(q.periodWords);
  if (q.dim) out.push(`by ${DIM_WORD[q.dim] || q.dim}`);
  return out;
}

// ------------------------------------------------------------------------------------------------ the bets a question means

const isBuilder = (r) => /builder/.test(r.kind || '') || r.stat === 'bet builder';
export function matches(r, q) {
  if (q.from && (!r.day || r.day < q.from)) return false;
  if (q.to && (!r.day || r.day > q.to)) return false;
  for (const [k, v] of Object.entries(q.f || {})) if (v.length && !v.includes(r[k])) return false;
  for (const [k, v] of Object.entries(q.x || {})) if (v.length && v.includes(r[k])) return false;
  if (q.kind === 'builder' && !isBuilder(r)) return false;
  if (q.kind === 'stat pick' && isBuilder(r)) return false;
  if (q.teams && q.teams.length && !q.teams.some((t) => String(r.match || '').toLowerCase().includes(t.toLowerCase()))) return false;
  if (q.edge && !(isNum(r.edge) && r.edge >= q.edge[0] - 1e-9 && r.edge < q.edge[1])) return false;
  if (q.price && !(isNum(r.price) && r.price >= q.price[0] && r.price < q.price[1])) return false;
  if (isNum(q.line) && r.line !== q.line) return false;
  return true;
}
export function rowsFor(D, q, over = {}) {
  const sport = over.sport || q.sport || 'football', set = over.set || q.set || 'paper';
  return D.bets.filter((r) => r.sport === sport && r.set === set && matches(r, { ...q, ...over.q }));
}

// ------------------------------------------------------------------------------------------------ words for numbers

const cap = (s) => (s ? s[0].toUpperCase() + s.slice(1) : s);
const lc = (s) => (s ? s[0].toLowerCase() + s.slice(1) : s);          // scope words in mid-sentence
export function priceWords([a, b]) { return b === Infinity ? `${odds(a)} and over` : a <= 1 ? `under ${odds(b)}` : `${odds(a)} to ${odds(b)}`; }
const COMP_IN = (c) => (['EPL', 'GREEK', 'UCL', 'UEL', 'UECL'].includes(c) ? `the ${compName(c)}` : compName(c));

export function scopeWords(q, { set = q.set, sport = q.sport } = {}) {
  const p = [];
  const stat = (q.f.stat || [])[0], side = (q.f.side || [])[0];
  if (stat) p.push(`${stat}${side ? ` ${side}s` : ''}`); else if (side) p.push(`${side}s`);
  if (q.kind === 'builder') p.push('builders'); else if (q.kind === 'stat pick') p.push('singles');
  const named = p.length || (q.f.book || []).length || (q.x.book || []).length || (q.f.comp || []).length || (q.x.comp || []).length || q.teams.length || q.edge || q.price || (q.f.conf || []).length || (q.f.score || []).length || (q.x.stat || []).length || (q.x.side || []).length || isNum(q.line);
  if (!named) return sport && sport !== 'football' ? `${cap(sport)}, ${SET_TITLE[set || 'paper'] || set}` : cap(SET_TITLE[set || 'paper'] || set);
  if (!p.length) p.push(set === 'kept' ? 'lines kept back' : 'picks');
  if ((q.f.book || []).length) p.push(`at ${q.f.book.join(' or ')}`);
  if ((q.x.book || []).length) p.push(`not at ${q.x.book.join(' or ')}`);
  if ((q.f.comp || []).length) p.push(`in ${q.f.comp.map(COMP_IN).join(' or ')}`);
  if ((q.x.comp || []).length) p.push(`outside ${q.x.comp.map(COMP_IN).join(' or ')}`);
  if (q.teams.length) p.push(`in ${q.teams.join(' or ')} matches`);
  if (q.edge) p.push(`shown ${bandWords(q.edge)} above the price`);
  if (q.price) p.push(`priced ${priceWords(q.price)}`);
  if ((q.f.conf || []).length) p.push('from the fast lane');
  if ((q.f.score || []).length) p.push(`scored ${q.f.score[0]}`);
  if ((q.x.stat || []).length) p.push(`without ${q.x.stat.join(' or ')}`);
  if ((q.x.side || []).length) p.push(`without ${q.x.side.join(' or ')}s`);
  if (isNum(q.line)) p.push(`on the line ${q.line}`);
  const sportW = sport && sport !== 'football' ? `${cap(sport)} ` : '';
  const setW = set && set !== 'paper' && set !== 'kept' ? `, ${SET_WORD[set] || set}` : '';
  return `${sportW}${sportW ? p.join(' ') : cap(p.join(' '))}${setW}`;
}
const when = (q) => q.periodWords || 'so far';

const VERDICT_SENTENCE = {
  ahead: 'ahead by more than luck alone would explain', behind: 'behind by more than luck alone would explain',
  'leaning ahead': 'leaning ahead, but not clear of luck yet', 'leaning behind': 'leaning behind, but not clear of luck yet',
  'too early': 'too early to call: luck alone could do this', 'too few': 'too few to say anything',
};
function luckLine(g) {
  if (!g.n) return '';
  const more = isNum(g.more) && g.more > 0 ? ` At this rate about ${g.more} more settled bets would settle it.` : '';
  return `Luck alone moves a return like this by ±${pct(g.luck)}: it is ${VERDICT_SENTENCE[g.verdict] || g.verdict}.${g.verdict === 'ahead' || g.verdict === 'behind' ? '' : more}`;
}
const pill = (v) => `<span class="vp v-${{ ahead: 'ahead', behind: 'behind', 'leaning ahead': 'lean-up', 'leaning behind': 'lean-down', 'too early': 'early' }[v] || 'few'}">${esc(v)}</span>`;
function recordSentence(g, cur = '£') {
  return `<b class="${g.profit >= 0 ? 'pos' : 'neg'}">${money(g.profit, cur)}</b> on ${money(g.staked, cur, 0, false)} staked (<b>${spct(g.ret, 1)}</b>), ${g.won} of ${g.n} won`;
}
function goFilters(q) {
  const f = {};
  for (const [k, v] of Object.entries(q.f)) if (v.length) f[k] = v;
  return f;
}
function goTarget(q, tab, extra = {}) {
  const t = { tab, f: goFilters(q), ...extra };
  if (q.sport) t.sport = q.sport;
  if (q.set) t.set = q.set;
  if (q.from) { t.range = 'custom'; t.from = q.from; t.to = q.to; } else t.range = 'all';
  if (Object.keys(q.x).length) t.x = q.x;
  return t;
}

// what the answer was about, for Claude: the question with the numbers behind it
function forClaude(q, numbers) {
  return `${q.text}\n\n(From my BB Picks Board${numbers ? `: ${numbers}` : ''}. If the BB Board connector is on, read the exact figures from it.)`;
}
function plainOf(html) { return String(html || '').replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&#39;/g, "'").replace(/&quot;/g, '"').replace(/\s+/g, ' ').trim(); }

// ------------------------------------------------------------------------------------------------ the answers

export const EXAMPLES = [
  'Best pick today?', 'How are the overlay bands doing this week?', 'Fouls unders at Stoiximan', 'Which league is hottest, luck taken out?',
  'Superbet vs Stoiximan', 'What if the bar were 25%?', 'Where could the bank be in 30 days?', 'Why did Brighton fouls lose?',
  'How did yesterday go?', 'Did the market follow our 30%+ picks?', 'Is the 20-29% band real or luck?', 'Kept back against sent',
];

function reply(html, extra = {}) { return { html, ...extra }; }

const A = {
  // "did the changes help?": each method change at its newest check, old against new on the same lines (fm/change_effects.py)
  changes(q, env) {
    const CE = env.D.feed.change_effects || {};
    const go = { tab: 'results' };
    const list = CE.changes || [];
    if (!list.length) return reply(`<p>Not measured yet: ${esc(CE.line || 'first results from Rest on Sat 31 Oct')}. Every method change since 16 Oct that moved overlays gets measured old against new on the same settled lines, then again at 2 and 4 weeks.</p>`, { go, goLabel: 'Open Results' });
    const fig = (c) => {
      const m = c.measure !== 'overall' ? c.measure : !c.metric || /profit|return|staked/i.test(c.metric) ? 'return' : 'accuracy';
      const f = (x) => (!isNum(x) ? '–' : m === 'return' ? spct(x) : m === 'picks' ? String(Math.round(x)) : num(x, 3));
      return isNum(c.old) || isNum(c.new) ? ` ${esc(c.metric || m)} ${f(c.old)} → ${f(c.new)}${isNum(c.luck) ? ` (luck ±${f(c.luck).replace('+', '')})` : ''}${isNum(c.n_new) ? `, ${Math.round(c.n_new)} settled` : ''}` : '';
    };
    return reply(`<p><b>${esc(CE.line)}</b>: old against new on the same settled lines; better or worse only beyond two luck bands of the difference.</p>
      <ul class="plain ans-list">${list.map((c) => `<li><b>${esc(c.verdict)}</b>: ${esc(c.change)} <span class="muted">(${esc(c.changed_on)}, ${esc(c.checkpoint)}${c.held ? `, ${esc(c.held)}` : ''})</span>${fig(c)}</li>`).join('')}</ul>`,
    { go, goLabel: 'Open Results' });
  },
  help() {
    return reply(`<p>Ask in your own words, typos are fine. I answer from the board's own numbers, each with its luck band. Some things I know:</p>
      <ul class="plain small"><li><b>How</b> anything is doing: a stat and direction, a bookmaker, a league, a team, an overlay band (“20-30%”), a price (“odds over 2”), any time (“this week”, “since 15 Oct”, “yesterday”).</li>
      <li><b>By what</b>: “by stat”, “which bookmaker”, “the bands”; <b>best and worst</b> with luck taken out.</li>
      <li><b>Over time</b>: “how have the bands moved?”; <b>one against another</b>: “overs vs unders”, “first or last shown”.</li>
      <li><b>Today</b>: picks, the best one, what is open or in play; <b>results</b> of any day; <b>why</b> a bet won or lost.</li>
      <li><b>What if</b> the bar or the stakes were different; <b>where the bank could go</b>; whether <b>the market followed</b> us; <b>who found the line</b>.</li></ul>
      <p class="muted small">Follow-ups keep what you asked before: “and at Superbet?”, “last week?”. Anything I can't answer goes to Claude with the numbers.</p>`,
    { chips: EXAMPLES.slice(0, 6) });
  },
  greet(q, env) { return A.brief(q, env); },
  thanks() { return reply('<p>Any time.</p>', { chips: ['Best pick today?', 'How did yesterday go?', 'How are the bands doing?'] }); },

  brief(q, env) {
    const { D } = env;
    const now = Date.now();
    const paper = D.bets.filter((r) => r.sport === 'football' && r.set === 'paper');
    const g = agg(paper);
    const picks = D.today.filter((p) => p.kickAt && p.kickAt.getTime() > now && (p.stake || 0) > 0 && !p.gone).sort((a, b) => (b.stake || 0) - (a.stake || 0) || (b.edge || 0) - (a.edge || 0));
    const inPlay = D.today.filter((p) => p.kickAt && p.kickAt.getTime() <= now && p.status === 'in play');
    const wk = weekStart(env.today);
    const week = agg(paper.filter((r) => r.day >= wk));
    const yday = agg(paper.filter((r) => r.day === addDays(env.today, -1)));
    const since = env.since ? env.since() : null;
    const best = picks[0];
    const parts = [];
    if (since && (since.settled.length || since.picks.length)) parts.push(`<p>Since you last looked: ${since.settled.length ? `${since.settled.length} bet${since.settled.length === 1 ? '' : 's'} settled, ${since.won} won, <b class="${since.profit >= 0 ? 'pos' : 'neg'}">${money(since.profit, '£', 2)}</b>` : 'nothing settled'}${since.picks.length ? `; ${since.picks.length} new pick${since.picks.length === 1 ? '' : 's'}` : ''}.</p>`);
    parts.push(`<p>${picks.length ? `<b>${picks.length}</b> pick${picks.length === 1 ? '' : 's'} still to play today; the biggest stake: <b>${esc(best.bet)}</b> at ${esc(best.book)} ${odds(best.price)} (${spct(best.edge)} over the price), ${esc(ukHM(best.kick))} UK.` : 'No picks left to play right now.'}${inPlay.length ? ` ${inPlay.length} in play.` : ''}</p>`);
    if (yday.n) parts.push(`<p>Yesterday: ${recordSentence(yday)}.</p>`);
    if (week.n) parts.push(`<p>This week: ${recordSentence(week)}, luck ±${pct(week.luck)} ${pill(week.verdict)}.</p>`);
    parts.push(`<p>The paper account so far: ${recordSentence(g)}, luck ±${pct(g.luck)} ${pill(g.verdict)}.</p>`);
    const h = T.hotCold(paper, ['statSide', 'comp', 'book'], { n: 1, min: 5 });
    if (h.hot[0] && h.hot[0].k > 0.05) parts.push(`<p class="muted small">Hottest with luck taken out: ${esc(h.hot[0].dim === 'comp' ? compName(h.hot[0].key) : h.hot[0].key)} (${spct(h.hot[0].shrunk)}); coldest: ${h.cold[0] ? esc(h.cold[0].dim === 'comp' ? compName(h.cold[0].key) : h.cold[0].key) + ` (${spct(h.cold[0].shrunk)})` : 'none'}.</p>`);
    return reply(parts.join(''), { chips: ['Best pick today?', 'How did yesterday go?', 'How are the bands doing?', 'Where could the bank be in 30 days?'],
      chart: { kind: 'running', series: [{ name: 'Paper account', rows: paper }] }, go: { tab: 'today' }, goLabel: 'Open Today' });
  },

  perf(q, env) {
    const rows = rowsFor(env.D, q);
    const g = agg(rows);
    const head = `${esc(scopeWords(q))}, ${esc(when(q))}`;
    if (!g.n) {
      return reply(`<p>${head}: nothing settled${g.open ? `; ${g.open} still open (${money(g.openStake, '£', 0, false)} staked)` : ''}.</p>${lastWeekNote(q, env)}${q.from ? '<p class="muted small">Try a wider time, or ask without it.</p>' : ''}`,
        { chips: suggestions(q, 'perf'), claude: forClaude(q, `${scopeWords(q)}, ${when(q)}: nothing settled`) });
    }
    const html = `<p>${head}: ${recordSentence(g)}.</p>
      <p>They won ${pct(g.wonPct)} where the prices needed ${pct(g.needed)}${isNum(g.said) ? ` (we said ${pct(g.said)})` : ''}. ${luckLine(g)}</p>
      ${g.open ? `<p class="muted small">${g.open} still open (${money(g.openStake, '£', 0, false)} staked).</p>` : ''}`;
    return reply(html, { chart: { kind: 'running', series: [{ name: scopeWords(q), rows }] }, go: goTarget(q, 'results'), goLabel: 'Open in Results', chips: suggestions(q, 'perf'),
      claude: forClaude(q, `${scopeWords(q)}, ${when(q)}: ${plainOf(recordSentence(g))}, luck ±${pct(g.luck)}, ${g.verdict}`) });
  },

  breakdown(q, env) {
    const dim = q.dim || 'stat';
    const rows = T.cutRows(rowsFor(env.D, q), dim);
    const gs = group(rows, dim).filter((x) => x.n && x.key !== '(not known)');
    if (!gs.length) return reply(`<p>${esc(scopeWords(q))}, ${esc(when(q))}: nothing settled to cut by ${esc(DIM_WORD[dim] || dim)}.</p>`, { chips: suggestions(q, 'perf') });
    const ordered = T.ORDINAL.has(dim) || dim === 'day' || dim === 'week' ? gs : [...gs].sort((a, b) => b.n - a.n);
    const name = (k) => (dim === 'comp' ? compName(k) : dim === 'day' ? dayLabel(k) : dim === 'week' ? `week of ${dayLabel(k, false)}` : k);
    const top = ordered.slice(0, 8);
    const html = `<p>${esc(scopeWords(q))}, ${esc(when(q))}, by ${esc(DIM_WORD[dim] || dim)}:</p>
      <ul class="plain ans-list">${top.map((x) => `<li><b>${esc(name(x.key))}</b> <span class="${x.ret >= 0 ? 'pos' : 'neg'}">${spct(x.ret)}</span> on ${x.n} <span class="muted">(${money(x.profit)}, ±${pct(x.luck)})</span> ${pill(x.verdict)}</li>`).join('')}</ul>
      ${gs.length > top.length ? `<p class="muted small">and ${gs.length - top.length} more.</p>` : ''}
      <p class="muted small">The ± is what luck alone could do at each one's size: a figure inside it is not a result yet.</p>`;
    return reply(html, { chart: { kind: 'luck', rows: top.map((x) => ({ label: name(x.key), value: x.ret, luck: x.luck, n: x.n, verdict: x.verdict })) },
      go: goTarget(q, 'slices', { rows: dim === 'week' || dim === 'day' ? dim : dim, cols: 'none' }), goLabel: 'Open in Slices',
      chips: [`Which ${DIM_WORD[dim] || dim} is best, luck taken out?`, `How have the ${dim === 'eband' ? 'bands' : (DIM_WORD[dim] || dim) + 's'} moved over time?`],
      claude: forClaude(q, top.map((x) => `${name(x.key)} ${spct(x.ret)} on ${x.n} (±${pct(x.luck)})`).join('; ')) });
  },

  rank(q, env) {
    const dim = q.dim || 'statSide';
    const rows = rowsFor(env.D, q);
    const sh = T.shrink(rows, dim, { min: 5 });
    const worst = /\b(worst|bottom|least|cold|coldest|weakest|losing)\b/.test(norm(q.text));
    const gs = [...sh.groups].sort((a, b) => (worst ? a.shrunk - b.shrunk : b.shrunk - a.shrunk));
    const name = (k) => (dim === 'comp' ? compName(k) : k);
    if (!gs.length) return reply(`<p>Too few settled bets to rank by ${esc(DIM_WORD[dim] || dim)} (each needs 5).</p>`, { chips: suggestions(q, 'perf') });
    const stand = sh.tau > 0.02;
    const top = gs.slice(0, 3);
    const raw = [...sh.groups].sort((a, b) => (worst ? a.ret - b.ret : b.ret - a.ret))[0];
    const html = stand
      ? `<p>The ${worst ? 'worst' : 'best'} ${esc(DIM_WORD[dim] || dim)}${worst ? 's' : 's'} with luck taken out (${esc(lc(scopeWords(q)))}, ${esc(when(q))}):</p>
        <ol class="plain ans-list">${top.map((x) => `<li><b>${esc(name(x.key))}</b> ${spct(x.shrunk)} <span class="muted">(its own ${spct(x.ret)} on ${x.n}, ${Math.round(x.k * 100)}% of it kept)</span></li>`).join('')}</ol>
        <p class="muted small">Each is pulled toward the whole (${spct(sh.mu)}) by how much luck its size allows; ${esc(DIM_WORD[dim] || dim)}s do differ by more than luck here.</p>`
      : `<p>No ${esc(DIM_WORD[dim] || dim)} stands apart from the rest by more than luck would make it yet: with luck taken out every one is back at the whole's ${spct(sh.mu)}.</p>
        <p>By its own figure the ${worst ? 'lowest' : 'highest'} is <b>${esc(name(raw.key))}</b> ${spct(raw.ret)} on ${raw.n} (±${pct(raw.luck)}), but that is inside luck.</p>`;
    return reply(html, { chart: { kind: 'dumbbell', mu: sh.mu, rows: (stand ? top : gs.slice(0, 5)).map((x) => ({ label: name(x.key), raw: x.ret, shrunk: x.shrunk, n: x.n, k: x.k, mu: sh.mu })) },
      go: { tab: 'trends', trendBy: ['statSide', 'comp', 'book'].includes(dim) ? 'eband' : dim }, goLabel: 'Open Trends', chips: suggestions(q, 'rank'),
      claude: forClaude(q, gs.slice(0, 5).map((x) => `${name(x.key)} own ${spct(x.ret)} on ${x.n}, luck out ${spct(x.shrunk)}`).join('; ')) });
  },

  trend(q, env) {
    const dim = q.dim || 'eband';
    const rows = rowsFor(env.D, q);
    const sr = T.seriesBy(rows, dim, { measure: 'ret', minN: 8 });
    if (sr.days.length < 2) return reply(`<p>Not enough settled days for a trend (${sr.days.length}).</p>`, { chips: suggestions(q, 'perf') });
    const name = (k) => (dim === 'comp' ? compName(k) : k);
    const lines = sr.series.filter((s) => !s.other).map((s) => {
      const m = T.moveOf(s.pts);
      return m ? `<li><b>${esc(name(s.key))}</b>: ${spct(m.first.value)} on ${dayLabel(m.first.day, false)} → <b class="${m.last.value >= 0 ? 'pos' : 'neg'}">${spct(m.last.value)}</b> now${m.hi.day !== m.last.day && m.hi.day !== m.first.day ? `, high ${spct(m.hi.value)} on ${dayLabel(m.hi.day, false)}` : ''} <span class="muted">(${s.now.n}, ±${pct(s.now.luck)})</span></li>`
        : `<li><b>${esc(name(s.key))}</b>: under 8 settled so far</li>`;
    });
    const html = `<p>How the return (as staked, so far) has moved by ${esc(DIM_WORD[dim] || dim)}, ${esc(lc(scopeWords(q)))}:</p><ul class="plain ans-list">${lines.join('')}</ul>
      <p class="muted small">Each line starts at its 8th settled bet; the ± is its luck band now.</p>`;
    return reply(html, { chart: { kind: 'lines', dim, series: sr }, go: goTarget(q, 'trends', { trendBy: dim }), goLabel: 'Open Trends', chips: suggestions(q, 'trend'),
      claude: forClaude(q, sr.series.map((s) => `${name(s.key)} now ${spct(s.now.ret)} on ${s.now.n}`).join('; ')) });
  },

  compare(q, env) {
    const c = q.cmp;
    if (!c) return A.perf(q, env);
    const side = (v) => {
      if (c.dim === 'set') return { label: SET_WORD[v] || v, rows: rowsFor(env.D, q, { set: v }) };
      if (c.dim === 'sport') return { label: v, rows: rowsFor(env.D, q, { sport: v }) };
      if (c.dim === 'edge') return { label: `shown ${bandWords(v)} above the price`, rows: rowsFor(env.D, { ...q, edge: v }) };
      if (c.dim === 'period') return { label: v.words, rows: rowsFor(env.D, { ...q, from: v.from, to: v.to }) };
      return { label: c.dim === 'comp' ? compName(v) : c.dim === 'book' ? `at ${v}` : v, rows: rowsFor(env.D, { ...q, f: { ...q.f, [c.dim]: [v] } }) };
    };
    let [a, b] = c.values.map(side);
    if (c.dim === 'set' && c.values.includes('kept') && c.values.includes('paper')) {        // the 20% bar's two sides, since it began
      const since = q.from && q.from > '2026-10-17' ? q.from : '2026-10-17';
      const fix = (s, v) => ({ label: v === 'kept' ? 'kept back (10% to 20%)' : 'sent (20% and over)', rows: s.rows.filter((r) => r.day >= since && (v === 'kept' || (isNum(r.edge) && r.edge >= 0.2))) });
      [a, b] = [fix(a, c.values[0]), fix(b, c.values[1])];
    }
    const ga = agg(a.rows), gb = agg(b.rows);
    if (!ga.n || !gb.n) return reply(`<p>${!ga.n ? esc(a.label) : esc(b.label)} has nothing settled ${esc(when(q))}, so there is nothing to compare yet.</p>`, { chips: suggestions(q, 'perf') });
    const gap = ga.ret - gb.ret, band = Math.sqrt(ga.luck ** 2 + gb.luck ** 2);
    const z = band ? gap / band : 0;
    const verdict = Math.abs(z) >= 2 ? 'a gap bigger than luck would make' : Math.abs(z) >= 1 ? 'a gap that leans one way, but luck could still make it' : 'a gap luck alone could easily make';
    const rest = { ...q, f: Object.fromEntries(Object.entries(q.f).filter(([k]) => k !== c.dim)) };
    const head = c.dim === 'set' ? (c.values.includes('kept') && c.values.includes('paper') ? 'Since 17 Oct, when the 20% bar began' : cap(when(q))) : `${scopeWords(rest)}, ${c.dim === 'period' ? 'each time' : when(q)}`;
    const html = `<p>${esc(head)}:</p>
      <ul class="plain ans-list"><li><b>${esc(cap(a.label))}</b>: ${recordSentence(ga)} <span class="muted">(±${pct(ga.luck)})</span></li><li><b>${esc(cap(b.label))}</b>: ${recordSentence(gb)} <span class="muted">(±${pct(gb.luck)})</span></li></ul>
      <p>${esc(cap(gap >= 0 ? a.label : b.label))} is ahead by ${Math.abs(Math.round(gap * 100))} points of return: ${verdict} (the two luck bands together come to ±${pct(band)}).</p>`;
    return reply(html, { chart: { kind: 'running', ret: true, series: [{ name: cap(a.label), rows: a.rows }, { name: cap(b.label), rows: b.rows }] }, go: goTarget(q, 'slices', { rows: c.dim === 'set' || c.dim === 'edge' || c.dim === 'period' || c.dim === 'sport' ? 'stat' : c.dim, cols: 'none' }), goLabel: 'Open in Slices',
      chips: suggestions(q, 'compare'), claude: forClaude(q, `${a.label}: ${plainOf(recordSentence(ga))}; ${b.label}: ${plainOf(recordSentence(gb))}`) });
  },

  picks(q, env) {
    const now = Date.now();
    const list = env.D.today.filter((p) => p.kickAt && p.kickAt.getTime() > now && (p.stake || 0) > 0 && !p.gone && matches({ ...p, day: null }, { ...q, from: null, to: null }) && (!q.sport || p.sport === q.sport))
      .sort((a, b) => (b.sport === 'football') - (a.sport === 'football') || (b.stake || 0) - (a.stake || 0) || (b.edge || 0) - (a.edge || 0));
    if (!list.length) {
      const next = env.D.today.filter((p) => p.kickAt && p.kickAt.getTime() > now).length;
      return reply(`<p>No picks left to play right now${anyNamed(q) ? ` for ${esc(q.what.join(', '))}` : ''}${next ? '' : ': the next run makes the next ones'}.</p>`, { chips: ['Tomorrow?', 'What is open?', 'How did today go?'] });
    }
    const html = `<p>${list.length} pick${list.length === 1 ? '' : 's'} still to play${anyNamed(q) ? ` (${esc(scopeWords(q))})` : ''}, biggest stake first:</p>
      <ol class="plain ans-list">${list.slice(0, 6).map((p) => `<li><button type="button" class="link" data-pick="${esc(p.key)}"><b>${esc(p.bet)}</b></button> · ${esc(p.book)} ${odds(p.price)} · <span class="pos">${spct(p.edge)}</span> · £${num(p.stake, 2)}${p.wait ? ` (place${isNum(p.would_place) ? ` about £${num(p.would_place, 0)}${p.capped_at ? ', its cap' : ''}` : ''} on the match day)` : ''} · ${esc(ukHM(p.kick))} UK${p.sport !== 'football' ? ` · ${esc(p.sport)}` : ''}</li>`).join('')}</ol>
      ${list.length > 6 ? `<p class="muted small">and ${list.length - 6} more on Today.</p>` : ''}`;
    return reply(html, { go: { tab: 'today' }, goLabel: 'Open Today', chips: ['Best pick today?', 'Why this pick?', 'What is open?'],
      claude: forClaude(q, list.slice(0, 6).map((p) => `${p.bet} at ${p.book} ${odds(p.price)} (${spct(p.edge)}, stake ${num(p.stake, 2)})`).join('; ')) });
  },

  bestpick(q, env) {
    const now = Date.now();
    const list = env.D.today.filter((p) => p.kickAt && p.kickAt.getTime() > now && (p.stake || 0) > 0 && !p.gone && Number(p.tier) !== 3 && matches({ ...p, day: null }, { ...q, from: null, to: null }))
      .sort((a, b) => (b.sport === (q.sport || 'football')) - (a.sport === (q.sport || 'football')) || (b.stake || 0) - (a.stake || 0) || (b.edge || 0) - (a.edge || 0));
    const p = list[0];
    if (!p) return A.picks(q, env);
    const rivals = (p.rivals || []).filter((r) => r.book && r.book !== p.book && isNum(r.price));
    const html = `<p>${p.sport !== (q.sport || 'football') ? `No ${esc(q.sport || 'football')} pick left today; the biggest stake in ${esc(p.sport)} (on paper): ` : 'The biggest stake still to play: '}<button type="button" class="link" data-pick="${esc(p.key)}"><b>${esc(p.bet)}</b></button> at <b>${esc(p.book)} ${odds(p.price)}</b>, ${esc(p.match)}, ${esc(ukHM(p.kick))} UK.</p>
      <p>Fair price ${odds(p.fair)}, so ${spct(p.edge)} over it: our chance ${pct(p.ours)} against the ${pct(p.needs)} the price needs${p.one_sided ? ' (the bookmaker’s own: not known, only this side of the line was read)' : isNum(p.bookp) ? ` (the bookmaker's own ${pct(p.bookp)})` : ''}.${isNum(p.expected) ? ` We expect ${num(p.expected, 1)}, they price ${num(p.theirs, 1)}.` : ''} Stake £${num(p.stake, 2)}${p.conf ? `, ${esc(p.conf)} confidence` : ''}${isNum(p.signals) ? `, ${p.signals} signal${p.signals === 1 ? '' : 's'}` : ''}.</p>
      ${rivals.length ? `<p class="muted small">Elsewhere: ${rivals.map((r) => `${esc(r.book)} ${odds(r.price)} (${spct(isNum(p.ours) ? p.ours * r.price - 1 : null)})`).join(' · ')}.</p>` : ''}
      ${p.safer && isNum(p.safer.price) ? `<p class="muted small">Safer, the same view (shown only, not staked): ${esc(p.safer.pick || '')} at ${esc(p.safer.at)} ${odds(p.safer.price)} (${spct(isNum(p.safer.ov) ? p.safer.ov / 100 : null)}).</p>` : ''}
      ${p.why ? `<p class="muted small">Why: ${esc(p.why)}</p>` : ''}`;
    return reply(html, { go: { tab: 'today' }, goLabel: 'Open Today', chips: ['The other picks?', `How have ${p.stat || 'these'} ${p.side || ''}s done?`.replace(/\s+/g, ' '), 'Where could the bank be in 30 days?'],
      claude: forClaude(q, `${p.bet} at ${p.book} ${odds(p.price)}, fair ${odds(p.fair)}, overlay ${spct(p.edge)}, our chance ${pct(p.ours)}, stake ${num(p.stake, 2)}`) });
  },

  open(q, env) {
    const rows = env.D.bets.filter((r) => r.sport === (q.sport || 'football') && r.set === (q.set || 'paper') && (r.status === 'open' || r.status === 'in play') && matches({ ...r }, { ...q, from: null, to: null }));
    if (!rows.length) return reply('<p>Nothing open in that set right now.</p>', { chips: ['Best pick today?', 'How did yesterday go?'] });
    const stake = sum(rows, (r) => r.stake);
    const byMatch = new Map();
    for (const r of rows) { if (!byMatch.has(r.match)) byMatch.set(r.match, []); byMatch.get(r.match).push(r); }
    const html = `<p>${rows.length} open (${money(stake, '£', 0, false)} staked) across ${byMatch.size} match${byMatch.size === 1 ? '' : 'es'}${rows.some((r) => r.status === 'in play') ? `, ${rows.filter((r) => r.status === 'in play').length} in play` : ''}:</p>
      <ul class="plain ans-list">${[...byMatch.entries()].slice(0, 8).map(([m, rs]) => `<li><button type="button" class="link" data-match="${esc(m)}"><b>${esc(m)}</b></button> · ${rs.map((r) => `${esc(String(r.bet || '').replace(/\s+at\s+\S+$/, ''))} ${odds(r.price)}`).join(', ')}</li>`).join('')}</ul>`;
    return reply(html, { go: { tab: 'today' }, goLabel: 'Open Today', chips: ['What is in play?', 'Best pick today?'] });
  },

  live(q, env) {
    const now = Date.now();
    const live = env.liveState ? [...env.liveState.entries()] : [];
    const playing = env.D.today.filter((p) => p.kickAt && p.kickAt.getTime() <= now && p.status === 'in play');
    if (!playing.length) {
      const next = env.D.today.filter((p) => p.kickAt && p.kickAt.getTime() > now).sort((a, b) => a.kickAt - b.kickAt)[0];
      return reply(`<p>Nothing of ours in play right now.${next ? ` Next kick-off: ${esc(next.match)} at ${esc(ukHM(next.kick))} UK.` : ''}</p>`, { chips: ['How are the live tests doing?', 'Best pick today?'] });
    }
    const st = new Map(live);
    const html = `<p>In play now:</p><ul class="plain ans-list">${playing.slice(0, 8).map((p) => {
      const l = st.get(p.key);
      return `<li><b>${esc(p.bet)}</b> (${esc(p.book)} ${odds(p.price)})${l ? ` · ${esc(l.score || '')} ${esc(l.clock || '')}${l.so !== null && l.so !== undefined ? ` · ${num(l.so, 0)} so far, line ${num(p.line)}` : ''}` : ''}</li>`;
    }).join('')}</ul>`;
    return reply(html, { go: { tab: 'today' }, goLabel: 'Open Today', chips: ['What is open?', 'How are the live tests doing?'] });
  },

  results(q, env) {
    const qq = q.from ? q : { ...q, from: addDays(env.today, -1), to: addDays(env.today, -1), periodWords: `yesterday (${dayLabel(addDays(env.today, -1))})` };
    const rows = rowsFor(env.D, qq).filter((r) => r.settled);
    const g = agg(rows);
    const head = `${esc(scopeWords(qq))}, ${esc(qq.periodWords)}`;
    if (!g.n) {
      const other = !q.sport ? ['basketball', 'tennis'].map((s) => [s, agg(rowsFor(env.D, { ...qq, sport: s }))]).filter(([, x]) => x.n) : [];
      return reply(`<p>${head}: nothing settled.${other.length ? ` ${other.map(([s, x]) => `${cap(s)}: ${plainOf(recordSentence(x))}`).join('; ')}.` : ''}</p>${lastWeekNote(qq, env)}`, { chips: ['How did the week go?', 'What is open?'] });
    }
    const won = rows.filter((r) => r.w).sort((a, b) => b.profit - a.profit), lost = rows.filter((r) => !r.w).sort((a, b) => a.profit - b.profit);
    const days = byDay(rows);
    const html = `<p>${head}: ${recordSentence(g)}.</p>
      ${won.length ? `<p class="small"><b>Best:</b> ${won.slice(0, 3).map((r) => `<button type="button" class="link" data-bet="${esc(r.id)}">${esc(String(r.bet || '').replace(/\s+at\s+\S+$/, ''))}</button> ${odds(r.price)} <span class="pos">${money(r.profit, '£', 2)}</span>`).join(' · ')}</p>` : ''}
      ${lost.length ? `<p class="small"><b>Worst:</b> ${lost.slice(0, 3).map((r) => `<button type="button" class="link" data-bet="${esc(r.id)}">${esc(String(r.bet || '').replace(/\s+at\s+\S+$/, ''))}</button> ${odds(r.price)} <span class="neg">${money(r.profit, '£', 2)}</span>${r.actual ? ` (came to ${esc(r.actual)})` : ''}`).join(' · ')}</p>` : ''}
      ${days.length > 1 ? `<p class="muted small">${days.map((d) => `${dayLabel(d.day, false)} ${money(d.profit)}`).join(' · ')}</p>` : ''}`;
    return reply(html, { chart: days.length > 1 ? { kind: 'running', series: [{ name: 'Settled', rows }] } : null, go: goTarget(qq, 'results'), goLabel: 'Open in Results',
      chips: ['Why did the worst one lose?', 'By stat?', 'And the week?'], claude: forClaude(qq, `${scopeWords(qq)}, ${qq.periodWords}: ${plainOf(recordSentence(g))}`) });
  },

  why(q, env) {
    const all = [...env.D.bets.filter((r) => ['paper', 'kept', 'newteam', 'live'].includes(r.set) && r.sport === (q.sport || r.sport)), ...env.D.today.map((p) => ({ ...p, set: 'today', id: null }))];
    const found = all.filter((r) => matches({ ...r, day: r.day || (r.kick || '').slice(0, 10) }, q) && (q.teams.length || Object.keys(q.f).length || isNum(q.line)))
      .sort((a, b) => String(b.kick || b.day || '').localeCompare(String(a.kick || a.day || '')));
    const seen = new Set();
    const list = found.filter((r) => { const k = `${r.match}|${r.bet}|${r.book}`; if (seen.has(k)) return false; seen.add(k); return true; }).slice(0, 3);
    if (!list.length) return reply(`<p>I couldn't find a bet for that${q.what.length ? ` (I read: ${esc(q.what.join(', '))})` : ''}. Name the team and the stat, e.g. “why did Brighton fouls lose?”.</p>`, { claude: forClaude(q, null) });
    const one = (r) => {
      const settled = r.status === 'won' || r.status === 'lost';
      const bits = [];
      if (settled) bits.push(`<b class="${r.status === 'won' ? 'pos' : 'neg'}">${r.status === 'won' ? 'Won' : 'Lost'}</b>${r.actual !== null && r.actual !== undefined ? `: came to ${esc(r.actual)} on the line ${num(r.line)}` : ''}${isNum(r.profit) ? ` (${money(r.profit, '£', 2)})` : ''}.`);
      else bits.push(`${esc(r.status || 'open')}.`);
      if (isNum(r.expected)) bits.push(`We expected ${num(r.expected, 1)}, the bookmakers ${num(r.theirs, 1)}${r.nearer ? `; ${esc(r.nearer)} was nearer` : ''}.`);
      if (r.margin) bits.push(`It finished ${esc(r.margin)} to the line${r.landed ? ` (${esc(r.landed)})` : ''}.`);
      if (r.red) bits.push(`Red card: ${esc(r.red)}.`);
      if (r.ht) bits.push(`Half-time: ${esc(r.ht)}.`);
      bits.push(`Price ${odds(r.price)}, fair ${odds(r.fair)} (${spct(r.edge)} over), our chance ${pct(r.ours)}.`);
      return `<li><b>${esc(String(r.bet || '').replace(/\s+at\s+\S+$/, ''))}</b> at ${esc(r.book || '')} · ${esc(r.match)}${r.day ? ` · ${dayLabel(r.day, false)}` : ''}<br>${bits.join(' ')}${r.why ? `<br><span class="muted small">Why it was picked: ${esc(r.why)}</span>` : ''}${r.conf_why ? `<br><span class="muted small">Confidence: ${esc(r.conf_why)}</span>` : ''}</li>`;
    };
    return reply(`<ul class="plain ans-list">${list.map(one).join('')}</ul>${found.length > list.length ? `<p class="muted small">${found.length - list.length} more match that; name the stat or the day to narrow it.</p>` : ''}`,
      { go: list[0].id ? null : { tab: 'today' }, betId: list[0].id, chips: ['How has this stat done?', 'Who found the line?'], claude: forClaude(q, list.map((r) => `${r.bet} at ${r.book} ${odds(r.price)}: ${r.status}${r.actual ? `, came to ${r.actual}` : ''}`).join('; ')) });
  },

  whyempty(q, env) {
    const paper = env.D.bets.filter((r) => r.sport === 'football' && r.set === 'paper' && r.day === env.today);
    const kept = env.D.bets.filter((r) => r.sport === 'football' && r.set === 'kept' && r.day >= addDays(env.today, -1));
    return reply(`<p>Since 17 Oct only picks 20% or more above their price are sent, two a match at most; the 10% to 20% ones are kept back on paper (${kept.length} in the last two days). A run with nothing at 30% means no line priced that far above our fair price passed the checks. Today so far: ${paper.length} pick${paper.length === 1 ? '' : 's'} on the paper account.</p>
      <p class="muted small">For a run's own reasons, ask the BB Picks bot “why no 30?”: it reads that run's logs.</p>`, { chips: ['Kept back against sent', 'What if the bar were 15%?', 'How are the bands doing?'] });
  },

  luck(q, env) {
    const rows = rowsFor(env.D, q);
    const g = agg(rows);
    if (!g.n) return A.perf(q, env);
    const z = g.z;
    const html = `<p>${esc(scopeWords(q))}, ${esc(when(q))}: ${recordSentence(g)}.</p>
      <p>With ${g.n} bets at these prices, luck alone could put the return anywhere between about −${pct(g.luck)} and +${pct(g.luck)} (one band) with no edge at all, and twice that one time in twenty. This one is ${isNum(z) ? `${Math.abs(z).toFixed(1)} bands ${z >= 0 ? 'above' : 'below'} zero` : 'not measurable'}: ${VERDICT_SENTENCE[g.verdict] || g.verdict}.${isNum(g.more) && g.more > 0 ? ` At this rate about ${g.more} more settled bets would make it clear.` : ''}</p>
      <p class="muted small">Bets on one match move together, so the true band is a little wider than this.</p>`;
    return reply(html, { chart: { kind: 'running', series: [{ name: scopeWords(q), rows }] }, go: goTarget(q, 'trends'), goLabel: 'Open Trends', chips: suggestions(q, 'luck'),
      claude: forClaude(q, `${scopeWords(q)}: ${plainOf(recordSentence(g))}, luck ±${pct(g.luck)}, ${g.verdict}`) });
  },

  bank(q, env) {
    const rows = rowsFor(env.D, q);
    const run = running(rows);
    if (!run.pts.length) return A.perf(q, env);
    const days = byDay(rows);
    const st = streak(days);
    const peak = run.pts.reduce((a, b) => (b.total > a.total ? b : a), run.pts[0]);
    const html = `<p>${esc(scopeWords(q))}: <b class="${run.now >= 0 ? 'pos' : 'neg'}">${money(run.now)}</b> now; its high was ${money(run.peak)}${peak ? ` (${dayLabel(peak.day, false)})` : ''}, so it stands ${run.ddNow < 0 ? `<b class="neg">${money(-run.ddNow, '£', 0, false)}</b> under it` : 'at its high'}.</p>
      <p>The worst fall from a high so far: ${money(run.maxDD)}.${st.current > 1 ? ` ${st.current} ${st.sign > 0 ? 'winning' : 'losing'} days in a row now.` : ''} Best run: ${st.best} winning day${st.best === 1 ? '' : 's'}; worst: ${st.worst} losing.</p>`;
    return reply(html, { chart: { kind: 'running', series: [{ name: scopeWords(q), rows }] }, go: goTarget(q, 'results'), goLabel: 'Open in Results', chips: ['Where could the bank be in 30 days?', 'What if we staked half Kelly?'] });
  },

  whatif(q, env) {
    const t = norm(q.text);
    const rule = { ...W.NOW, outBook: [], outStat: [], outSide: [] };
    const m = t.match(/\b(?:bar|at|of|to|over|above)?\s*(\d{1,2})\s*(?:%|pc|percent)/) || t.match(/\bbar\s*(?:at|to|of|=)?\s*(\d{1,2})\b/);
    if (m) rule.bar = Math.max(0.1, Math.min(0.4, +m[1] / 100));
    else if (q.edge) rule.bar = Math.max(0.1, q.edge[0]);
    if (/\b(half|1\/2|½) kelly\b|\bkelly (half|1\/2|½)\b/.test(t)) rule.style = 'k2';
    else if (/\b(quarter|1\/4|¼) kelly\b|\bkelly (quarter|1\/4|¼)\b/.test(t)) rule.style = 'k4';
    else if (/\b(eighth|1\/8|⅛) kelly\b|\bkelly (eighth|1\/8|⅛)\b/.test(t)) rule.style = 'k8';
    else if (/\blevel\b|\bflat\b|\bsame stake/.test(t)) rule.style = 'level';
    const per = t.match(/\b(one|1|two|2|three|3)\s+(?:picks?\s+)?(?:a|per|each)\s+match\b/);
    if (per) rule.per = { one: '1', 1: '1', two: '2', 2: '2', three: '3', 3: '3' }[per[1]];
    if (/\bno (limit|cap) (a|per) match\b|\bany number\b/.test(t)) rule.per = 'all';
    const ceil = t.match(/\b(?:cap|ceiling|no more than|at most|max(?:imum)?)\s*(?:of\s+)?(\d{2})\s*%/);
    if (ceil) rule.cap = +ceil[1] / 100;
    rule.outBook = q.x.book || [];
    rule.outStat = q.x.stat || [];
    rule.outSide = q.x.side || [];
    if ((q.f.book || []).length && /\bonly\b/.test(t)) rule.outBook = ['Stoiximan', 'Superbet', 'Pamestoixima', 'Novibet', 'bet365'].filter((b) => !q.f.book.includes(b));
    if ((q.f.stat || []).length && /\bonly\b/.test(t)) rule.outStat = uniq(env.D.bets.map((r) => r.stat).filter(Boolean)).filter((s) => !q.f.stat.includes(s));
    const inR = (r) => (!q.from || r.day >= q.from) && (!q.to || r.day <= q.to);
    const cands = W.candidates(env.D.bets).filter(inR);
    const record = env.D.bets.filter((r) => r.sport === 'football' && r.set === 'paper' && !isBuilder(r) && inR(r));
    const rep = W.replay(cands, record, rule);
    const diff = rep.sim.profit - rep.base.profit;
    const html = `<p>Replaying football's picks ${esc(when(q))} with ${esc(W.describe(rule))}:</p>
      <ul class="plain ans-list"><li>This rule: <b class="${rep.sim.profit >= 0 ? 'pos' : 'neg'}">${money(rep.sim.profit)}</b> on ${rep.sim.bets} bets (${spct(rep.sim.ret)}), worst fall ${money(rep.sim.maxDD)}</li>
      <li>The record as it was: ${money(rep.base.profit)} on ${rep.b.n} (${spct(rep.b.ret)}), worst fall ${money(rep.base.maxDD)}</li></ul>
      <p>${Math.abs(diff) < 0.5 ? 'The same money.' : `<b class="${diff >= 0 ? 'pos' : 'neg'}">${money(diff)}</b> against the record`}: it leaves out ${rep.dropped.bets} of the record's picks (they made ${money(rep.dropped.profit)})${rep.added.bets ? ` and adds ${rep.added.bets} kept back (they made ${money(rep.added.profit)})` : ''}.${rule.style === 'staked' ? ` Luck alone ±${pct(rep.a.luck)}: ${VERDICT_SENTENCE[rep.a.verdict] || rep.a.verdict}.` : ''}</p>
      <p class="muted small">A replay of the picks we logged, not a walk-forward test: a rule worth keeping is tested old against new before anything changes.</p>`;
    return reply(html, { chart: { kind: 'bank', series: [{ name: 'The record', pts: rep.base.pts }, { name: 'This rule', pts: rep.sim.pts }] },
      go: { tab: 'ideas', wiBar: String(rule.bar), wiCap: rule.cap === null ? 'none' : String(rule.cap), wiPer: rule.per, wiStyle: rule.style, wiOutBook: rule.outBook, wiOutStat: rule.outStat, wiOutSide: rule.outSide }, goLabel: 'Open the replay',
      chips: ['What if the bar were 15%?', 'What if the bar were 30%?', 'What if we staked level?'],
      claude: forClaude({ text: `Test this rule old against new with scripts/rule_test.py: ${W.describe(rule)}.` }, `the board's replay gave ${money(rep.sim.profit)} on ${rep.sim.bets} bets against the record's ${money(rep.base.profit)}`) });
  },

  outlook(q, env) {
    const t = norm(q.text);
    const dm = t.match(/\b(\d{1,3})\s*(days?|d|weeks?)\b/);
    const days = dm ? Math.max(7, Math.min(90, +dm[1] * (dm[2].startsWith('w') ? 7 : 1))) : /\bmonth/.test(t) ? 30 : 30;
    const edge = /\bno edge|break ?even|zero edge|just luck\b/.test(t) ? 'none' : /\bhalf\b/.test(t) ? 'half' : 'record';
    const rows = rowsFor(env.D, { ...q, from: null, to: null });
    const o = O.outlook(rows, { days, edge });
    if (!o) return reply('<p>Too few settled bets in that set for an outlook (it needs 20).</p>');
    const half = edge === 'record' ? O.outlook(rows, { days, edge: 'half' }) : null;
    const html = `<p>${edge === 'none' ? 'With no edge at all' : `If ${esc(lc(scopeWords(q, { set: q.set || 'paper' })))} keeps${edge === 'half' ? ' half of' : ''} its ${spct(o.ret, 1)} (give or take its luck band, ±${pct(o.luck, 1)})`}, at about ${o.perDay.toFixed(0)} bets a day of £${o.avgStake.toFixed(0)}:</p>
      <ul class="plain ans-list"><li>In ${days} days the middle path is <b class="${o.median >= 0 ? 'pos' : 'neg'}">${money(o.median)}</b>; half the paths ${money(o.p25)} to ${money(o.p75)}, nine in ten ${money(o.p5)} to ${money(o.p95)}.</li>
      <li>${pct(o.chanceDown)} of paths end lower than today.</li>
      <li>A fall from a high on the way: ${o.falls.map((f) => `${money(f.at, '£', 0, false)} ${pct(f.chance)}`).join(', ')}.</li></ul>
      ${half ? `<p>At half the record's return: middle ${money(half.median)}, ${pct(half.chanceDown)} end lower.</p>` : ''}
      <p class="muted small">Paths drawn from the last three weeks' own bets, their stakes and prices. The return is assumed, not known: the record is ${o.n} bets old.</p>`;
    return reply(html, { chart: { kind: 'fan', q: o.q }, go: { ...goTarget({ ...q, from: null }, 'results'), olDays: String([30, 60, 90].includes(days) ? days : 30), olEdge: edge }, goLabel: 'Open in Results',
      chips: ['And at half the return?', 'And with no edge?', 'In 90 days?'], claude: forClaude(q, `middle path ${money(o.median)} in ${days} days, ${pct(o.chanceDown)} end lower, falls ${o.falls.map((f) => `${f.at}: ${pct(f.chance)}`).join(', ')}`) });
  },

  market(q, env) {
    const rows = rowsFor(env.D, q);
    const f = T.follow(rows);
    if (!f.n) return reply(`<p>None of ${esc(scopeWords(q))} had its price read again later.</p>`);
    const groups = T.lineGroups(rows, q.dim || 'eband').map((g) => ({ key: g.key, ...T.follow(g.rows) })).filter((x) => x.n);
    const html = `<p>${esc(scopeWords(q))}, ${esc(when(q))}: of ${f.n} picks whose price was read again before kick-off, <b>${f.beat}</b> (${pct(f.share)}) shortened by 3% or more after we showed them${f.drift ? `, ${f.drift} drifted` : ''}; on average the price moved ${spct(f.avg, 1)} our way.</p>
      ${f.whenBeat.n && f.otherwise.n ? `<p>When the market came our way they returned ${spct(f.whenBeat.ret)} on ${f.whenBeat.n}; otherwise ${spct(f.otherwise.ret)} on ${f.otherwise.n}.</p>` : ''}
      <ul class="plain ans-list">${groups.map((x) => `<li><b>${esc(x.key)}</b>: ${pct(x.share)} of ${x.n} shortened, average ${spct(x.avg, 1)}</li>`).join('')}</ul>
      <p class="muted small">A price that shortens after the pick is the earliest sign of a real edge, long before profit is clear of luck.</p>`;
    return reply(html, { chart: { kind: 'bars', rows: groups.map((x) => ({ label: x.key, value: x.share })) }, go: goTarget(q, 'trends'), goLabel: 'Open Trends', chips: ['How are the bands doing?', 'Is the 30%+ band real or luck?'] });
  },

  lines(q, env) {
    const L = env.D.feed.lines;
    const rows = lineRows(L).filter((r) => r.sport === (q.sport || 'football') && (!(q.f.stat || []).length || q.f.stat.includes(r.stat)) && (!q.from || r.day >= q.from) && (!q.to || r.day <= q.to));
    if (!rows.length) return reply('<p>No judged lines for that yet (the Lines tab reads them after each daily run).</p>');
    const who = byWho(rows, [OURS]).filter((w) => w.n >= 20).sort((a, b) => (b.found ?? 0) - (a.found ?? 0));
    const html = `<p>Who found the line (the count landed on the line's two whole numbers, your 20.5 → 20 or 21 rule), ${esc(q.sport || 'football')}${(q.f.stat || []).length ? `, ${esc(q.f.stat.join(', '))}` : ''}, ${esc(when(q))}:</p>
      <ol class="plain ans-list">${who.slice(0, 6).map((w) => `<li><b>${esc(w.who)}</b> ${pct(w.found)} of ${w.n} lines <span class="muted">(close ${pct(w.close)}, off by ${num(w.miss, 1)} on average)</span></li>`).join('')}</ol>`;
    return reply(html, { go: { tab: 'lines' }, goLabel: 'Open Lines', chips: ['Fouls only?', 'Tennis?'] });
  },

  money(q, env) {
    const tk = env.D.tickets.filter((t) => (!q.from || (t.day && t.day >= q.from)) && (!q.to || (t.day && t.day <= q.to)) && (!(q.f.book || []).length || q.f.book.includes(t.book)));
    const done = tk.filter((t) => t.settled);
    if (!done.length) return reply('<p>No settled real tickets in that view.</p>', { go: { tab: 'money' }, goLabel: 'Open Money' });
    const staked = sum(done, (t) => t.cash ?? t.stake), profit = sum(done, (t) => t.profit), won = done.filter((t) => (t.profit || 0) > 0).length;
    const books = uniq(done.map((t) => t.book)).map((b) => { const x = done.filter((t) => t.book === b); return `${esc(b)} ${money(sum(x, (t) => t.profit), '€')} on ${x.length}`; });
    const html = `<p>Real tickets ${esc(when(q))}: <b class="${profit >= 0 ? 'pos' : 'neg'}">${money(profit, '€')}</b> on ${money(staked, '€', 0, false)} (${spct(staked ? profit / staked : null)}), ${won} of ${done.length} in profit.</p><p class="muted small">${books.join(' · ')}</p>`;
    return reply(html, { go: { tab: 'money' }, goLabel: 'Open Money', chips: ['Placed from the board?', 'Builders on real money?'] });
  },

  placed(q, env) {
    const placed = env.D.feed.placed || [];
    if (!placed.length) return reply('<p>Nothing marked placed yet. Tick a pick with “Placed” on Today (or the ▢ under the slip in Telegram) and it shows here and on Money.</p>', { go: { tab: 'today' }, goLabel: 'Open Today' });
    return reply(`<p>${placed.length} pick${placed.length === 1 ? '' : 's'} marked placed:</p><ul class="plain ans-list">${placed.slice(0, 8).map((p) => `<li>${esc(p.bet || p.key)} ${p.book ? `· ${esc(p.book)}` : ''} ${p.at ? `<span class="muted">${esc(p.at)}</span>` : ''}</li>`).join('')}</ul>`, { go: { tab: 'money' }, goLabel: 'Open Money' });
  },

  // how our numbers work (the board's guide card's own words, guide_terms.js; 29 Oct 2026): a term, worked on today's top pick
  guide(q, env) {
    return reply(guideAnswer(q.guide, env.D.feed.today?.guide || {}), { go: { tab: 'today' }, goLabel: 'Open Today',
      chips: ['What is overlay?', 'What does reliable mean?', 'What are the bars?'] });
  },

  // how sharp the account looks to each bookmaker (the feed's heat: ledger/accounts.md and logs/account_heat.json, 19 Oct 2026)
  heat(q, env) {
    const H = env.D.feed.heat || {};
    const go = { tab: 'money', moneyPart: 'accounts' };
    const books = Object.entries(H.books || {}).filter(([, x]) => x && x.with_price);
    if (!books.length) return reply('<p>No account’s heat yet: it needs the plan’s bets read again before kick-off.</p>', { go, goLabel: 'Open Accounts' });
    books.sort((a, b) => (b[1].t ?? -9) - (a[1].t ?? -9));
    const loud = (H.kinds || []).filter((k) => (k.cut ?? 0) >= 0.4 && k.bets >= 5).sort((a, b) => b.cut - a.cut).slice(0, 3);
    return reply(`<p>How sure each bookmaker can be that you beat its prices (its price cut 3% or more after your bet):</p>
      <ul class="plain ans-list">${books.map(([b, x]) => `<li><b>${esc(b)}</b>: ${esc(x.sure || 'too few bets yet')}${isNum(x.t) && x.sure ? ` (${x.t.toFixed(2)})` : ''}, cut after ${isNum(x.cut) ? pct(x.cut) : '–'} of ${x.with_price} bets, average ${isNum(x.average) ? spct(x.average, 1) : '–'}</li>`).join('')}</ul>
      ${H.spare_book ? `<p class="small"><b>The one to spare:</b> ${esc(H.spare_book)}.</p>` : ''}
      ${loud.length ? `<p class="small">Loudest markets: ${loud.map((k) => `${esc(k.book)} ${esc(k.kind)} (cut after ${pct(k.cut)} of ${k.bets})`).join('; ')}.</p>` : ''}
      ${H.look ? `<p class="small"><b>How sharp we look:</b> ${esc(H.look)}</p>` : ''}
      <p class="muted small">Under 1 it can't tell, 1 a lean, 2 likely, 3 near certain. A bookmaker sees only what you placed; the plan stands in for your tickets.</p>`,
    { go, goLabel: 'Open Accounts', chips: ['Real money?', 'Best pick today?'] });
  },

  parlays(q, env) {
    const ps = env.D.parlays.filter((p) => (!q.from || p.day >= q.from) && (!q.to || p.day <= q.to));
    const fams = uniq(ps.map((p) => p.family));
    const lines = fams.map((f) => { const x = ps.filter((p) => p.family === f && p.settled); const pr = sum(x, (p) => p.profit), st = sum(x, (p) => p.stake); return { f, n: x.length, won: x.filter((p) => p.status === 'won').length, pr, ret: st ? pr / st : null }; }).filter((x) => x.n);
    if (!lines.length) return reply('<p>No settled parlays in that view.</p>');
    return reply(`<p>Parlays ${esc(when(q))}, each family its own record (never added together):</p><ul class="plain ans-list">${lines.map((x) => `<li><b>${esc(x.f)}</b>: ${x.won} of ${x.n} won, ${money(x.pr)} (${spct(x.ret)})</li>`).join('')}</ul>`, { go: { tab: 'money' }, goLabel: 'Open Money' });
  },

  ideas(q, env) {
    const hs = env.D.feed.hypotheses || [];
    const id = (norm(q.text).match(/\bh(\d{1,3})\b/) || [])[1];
    if (id) {
      const h = hs.find((x) => x.id === `H${id}`);
      if (!h) return reply(`<p>No H${esc(id)} on the list.</p>`);
      return reply(`<p><b>${esc(h.id)}: ${esc(h.title)}</b></p>${h.latest ? `<p class="small">${esc(String(h.latest.text || '').replace(/\*\*|`/g, '').slice(0, 600))}</p>` : ''}`, { go: { tab: 'ideas' }, goLabel: 'Open Ideas' });
    }
    return reply(`<p>${hs.length} ideas under test; the newest:</p><ul class="plain ans-list">${hs.filter((h) => h.sport === (q.sport || 'football')).slice(0, 6).map((h) => `<li><b>${esc(h.id)}</b> ${esc(h.title)}</li>`).join('')}</ul>`, { go: { tab: 'ideas' }, goLabel: 'Open Ideas', chips: hs.slice(0, 2).map((h) => `What about ${h.id}?`) });
  },

  fresh(q, env) {
    const st = env.D.status || {};
    const built = ukStamp(env.D.feed.built_utc || env.D.feed.built_greek);
    return reply(`<p>The board's numbers were built ${esc(built)} UK. The last run: ${esc(st.run || '–')}, ${esc(st.status || '–')}${st.running ? ' (a run is going now)' : ''}.${st.failed && st.failed.length ? ` Failed: ${esc(st.failed.join('; '))}.` : ''}</p>
      ${(st.schedule || []).length ? `<p class="muted small">Next: ${(st.schedule || []).slice(0, 3).map((s) => `${esc(s.what)} ${esc(s.when)}`).join(' · ')}</p>` : ''}`, { chips: ['Best pick today?'] });
  },

  view(q, env) {
    const g = agg(env.viewRows ? env.viewRows() : []);
    const S = env.S || {};
    return reply(`<p>You are on <b>${esc(S.tab || '')}</b>: ${esc(S.sport || 'football')}, ${esc(SET_WORD[S.set] || S.set || '')}, ${esc(S.range === 'all' ? 'the whole record' : S.range || '')}${Object.keys(S.f || {}).length ? `, filtered to ${esc(Object.values(S.f).flat().join(', '))}` : ''}.</p>${g.n ? `<p>In it: ${recordSentence(g)}, luck ±${pct(g.luck)} ${pill(g.verdict)}.</p>` : ''}`,
      { claude: forClaude(q, g.n ? plainOf(recordSentence(g)) : null) });
  },

  ahead(q, env) {
    const E = env.D.feed.early || {};
    const all = uniq((E.matches || []).map((m) => String(m.kick || '').slice(0, 10))).filter((d) => d >= env.today).sort();
    const days = q.ahead.includes('*') ? all : q.ahead;
    const ms = (E.matches || []).filter((m) => days.includes(String(m.kick || '').slice(0, 10))).sort((a, b) => String(a.kick).localeCompare(String(b.kick)));
    const rows = (E.rows || []).filter((r) => days.includes(String(r.kick || '').slice(0, 10))).sort((a, b) => (b.edge || 0) - (a.edge || 0));
    const when = days.length === 1 ? dayLabel(days[0]) : days.length ? `${dayLabel(days[0], false)} to ${dayLabel(days[days.length - 1], false)}` : 'the next days';
    if (!E.matches) return reply('<p>The early look is not in the board yet (it is made each night after the results).</p>');
    if (!ms.length) return reply(`<p>${esc(when)}: no match in the model's leagues and cups in the early look (it reads the next ${E.days || 3} days; made ${esc(ukStamp(E.made_greek))} UK).</p>`, { chips: ['Best pick today?', 'What is open?'] });
    const send = rows.filter((r) => r.bar === 'send'), keep = rows.filter((r) => r.bar !== 'send');
    const html = `<p>${esc(when)}: ${ms.length} match${ms.length === 1 ? '' : 'es'} in the model's leagues and cups (the early look of ${esc(ukStamp(E.made_greek))} UK: nothing logged, prices as read then).</p>
      ${send.length ? `<p><b>${send.length} line${send.length === 1 ? '' : 's'} over the 20% bar now:</b></p><ul class="plain ans-list">${send.slice(0, 8).map((r) => `<li><b>${esc(r.bet)}</b> at ${esc(r.book)} ${odds(r.price)} <span class="pos">${spct(r.edge)}</span> · ${esc(r.match)} ${esc(ukHM(r.kick))}</li>`).join('')}</ul>` : '<p>No line over the 20% bar yet.</p>'}
      ${keep.length ? `<p class="muted small">${keep.length} more at 10% to 20% (they would be kept back).</p>` : ''}
      <details class="fold"><summary>Every match</summary><ul class="plain ans-list">${ms.map((m) => `<li>${esc(ukStamp(m.kick).slice(5))} · ${esc(compName(m.comp))} · ${esc(m.match)}${m.picks ? ` · <b>${m.picks} line${m.picks === 1 ? '' : 's'}</b>` : m.note ? ` · <span class="muted">${esc(m.note)}</span>` : ''}</li>`).join('')}</ul></details>
      <p class="muted small">The real picks come with that day's runs (09:00, 13:00 and 17:00 UK; picks go out up to two days ahead); Europe's at half stake.</p>`;
    return reply(html, { go: { tab: 'today' }, goLabel: 'Open Today', chips: ['Best pick today?', 'How did Europe do so far?', 'What is open?'],
      claude: forClaude(q, `${when}: ${ms.length} matches; over the bar: ${send.map((r) => `${r.bet} at ${r.book} ${odds(r.price)} (${spct(r.edge)})`).join('; ') || 'none'}`) });
  },

  extremes(q, env) {
    const rows = rowsFor(env.D, q).filter((r) => r.settled && isNum(r.profit));
    if (!rows.length) return reply(`<p>${esc(scopeWords(q))}, ${esc(when(q))}: nothing settled.</p>`);
    const lossy = /\b(worst|loss|losses|loser|losers|heaviest)\b/.test(norm(q.text));
    const list = [...rows].sort((a, b) => (lossy ? a.profit - b.profit : b.profit - a.profit)).slice(0, 6);
    const html = `<p>The ${lossy ? 'biggest losses' : 'biggest wins'}, ${esc(lc(scopeWords(q)))}, ${esc(when(q))}:</p>
      <ol class="plain ans-list">${list.map((r) => `<li><button type="button" class="link" data-bet="${esc(r.id)}">${esc(String(r.bet || '').replace(/\s+at\s+\S+$/, ''))}</button> · ${esc(r.book || '')} ${odds(r.price)} · <b class="${r.profit >= 0 ? 'pos' : 'neg'}">${money(r.profit, '£', 2)}</b> · ${esc(r.match)} ${dayLabel(r.day, false)}${r.actual !== null && r.actual !== undefined ? ` · came to ${esc(r.actual)}` : ''}</li>`).join('')}</ol>`;
    return reply(html, { go: goTarget(q, 'results'), goLabel: 'Open in Results', chips: [lossy ? 'Biggest wins?' : 'Biggest losses?', 'Why did the worst one lose?'] });
  },

  unknown(q) {
    return reply(`<p>I couldn't place that one${q.what.length ? ` (I read: ${esc(q.what.join(', '))})` : ''}. Try one of these, or ask Claude below: it gets your question and the board's numbers.</p>`,
      { chips: EXAMPLES.slice(0, 5), claude: forClaude(q, null), unknown: true });
  },
};

// a week just begun has nothing settled: last week beside it
function lastWeekNote(q, env) {
  if (!q.periodWords || !q.periodWords.startsWith('this week')) return '';
  const wk = weekStart(env.today);
  const g = agg(rowsFor(env.D, { ...q, from: addDays(wk, -7), to: addDays(wk, -1) }));
  return g.n ? `<p>Last week (${dayLabel(addDays(wk, -7), false)} to ${dayLabel(addDays(wk, -1), false)}): ${recordSentence(g)}, luck ±${pct(g.luck)} ${pill(g.verdict)}.</p>` : '';
}

function suggestions(q, kind) {
  const out = [];
  const book = (q.f.book || [])[0], stat = (q.f.stat || [])[0];
  if (kind === 'perf' || kind === 'luck') {
    if (!q.dim) out.push(stat ? 'By bookmaker?' : 'By stat?');
    out.push(q.from ? 'And so far?' : 'This week?');
    if (book) out.push(`And at ${book === 'Stoiximan' ? 'Superbet' : 'Stoiximan'}?`);
    else if (stat) out.push(`${cap(stat)}: overs vs unders?`);
    out.push('Over time?');
  } else if (kind === 'rank') out.push('By league?', 'By bookmaker?', 'By stat?');
  else if (kind === 'trend') out.push('By price?', 'By bookmaker?', 'Is it luck?');
  else if (kind === 'compare') out.push('Over time?', 'Is the gap luck?');
  return out.slice(0, 4);
}

// a slip pasted from the bookmaker's app (the user's ask of 19 Oct 2026, T7): the BB Picks bot judges it (scripts/slip_check.py:
// the model's numbers and the builders' simulation live on the laptop); here, its answer once it has judged the same slip
// (the feed's slips, matched by the slip's numbers in order, as slip_check.fingerprint), else where to send it
const SLIP_WORDS = ['δυαδα', 'τριαδα', 'τετραδα', 'πενταδα', 'bet builder', 'για επιστροφη', 'δυνητικα κερδη', 'πιθανα κερδη'];
const greekPlain = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/ς/g, 'σ');
export const slipPrint = (text) => (String(text).match(/\d+[.,]\d+/g) || []).map((x) => x.replace(',', '.')).join('|');
function slipAnswer(text, env) {
  const t = greekPlain(text);
  if (t.trim().startsWith('/') || (t.match(/\d{1,3}[.,]\d{2}/g) || []).length < 2 || !SLIP_WORDS.some((w) => t.includes(w))) return null;
  const feed = env.D.feed || {};
  const s = (feed.slips || []).find((x) => x.fp === slipPrint(text));
  if (s) return reply(`<p class="small" style="white-space:pre-wrap">${esc(s.text)}</p><p class="muted small">The BB Picks bot judged this slip at ${esc(ukHM(s.greek))} UK.</p>`, { chips: ['Best pick today?'] });
  return reply(`<p>That looks like a bet slip. The BB Picks bot judges it: each leg, the whole bet, a better swap from our picks and what the plan would stake (a builder needs the model's simulation, on the laptop).</p>
    <p>${feed.bot ? `<a href="https://t.me/${esc(feed.bot)}" target="_blank" rel="noopener">Paste it to @${esc(feed.bot)}</a>` : 'Paste it to the BB Picks bot'}: its answer shows here, and on Today under Your slips, at the board's next update.</p>`, { chips: ['Best pick today?'] });
}

// the answer to one question; env: {D, today, since?, liveState?, viewRows?, S?}; prev: the last parsed question
export function ask(text, env, prev = null, V = null) {
  const slip = slipAnswer(text, env);
  if (slip) return { q: { ...emptyQ(), intent: 'slip' }, reply: slip };
  const q = parse(text, V || vocab(env.D), env.today, prev);
  let r;
  try { r = (A[q.intent] || A.unknown)(q, env); } catch (e) { r = reply(`<p>That one tripped me up (${esc(e.message)}). Ask Claude below.</p>`, { claude: forClaude(q, null), unknown: true }); }
  if (!r.claude) r.claude = forClaude(q, plainOf(r.html).slice(0, 600));
  return { q, reply: r };
}
export function briefing(env) { return A.brief(emptyQ(), env); }
export { A as ANSWERS };
