// Live: today's open picks followed straight from ESPN's public scoreboard (it allows a browser to read it), so the
// phone sees the score, the clock and each pick's count so far without the laptop. Team names are matched the way the
// record's own results step does (scripts/espn_results.py: its aliases and its comparison). Counts ESPN does not give
// (throw-ins, goal kicks) come from the laptop's live reader when its last reading is in the feed.

const CODES = { EPL: 'eng.1', LALIGA: 'esp.1', SERIEA: 'ita.1', BUNDESLIGA: 'ger.1', LIGUE1: 'fra.1', GREEK: 'gre.1', UCL: 'uefa.champions', UEL: 'uefa.europa', UECL: 'uefa.europa.conf' };
let ALIASES = { 'Ath Bilbao': 'Athletic Club', 'Ath Madrid': 'Atletico Madrid', "M'gladbach": 'Borussia Monchengladbach', Milan: 'AC Milan', Inter: 'Internazionale',
  'FC Koln': 'FC Cologne', 'Paris SG': 'Paris Saint-Germain', "Nott'm Forest": 'Nottingham Forest', Wolves: 'Wolverhampton Wanderers', Betis: 'Real Betis',
  Sociedad: 'Real Sociedad', Vallecano: 'Rayo Vallecano', Espanol: 'Espanyol', Celta: 'Celta Vigo', Santander: 'Racing Santander', 'La Coruna': 'Deportivo' };
let SMALL = new Set(['fc', 'cf', 'ac', 'afc', 'as', 'ss', 'sc', 'ssc', 'rc', 'rcd', 'ud', 'cd', 'club', 'de', 'og', 'ogc', 'sv', 'vfb', 'vfl', 'tsg', 'fsv', 'us', '1']);
// the page's own few, for live matching only, under the record's (scripts/espn_results.py) which win where both name a club
const PAGE_ALIASES = { Brighton: 'Brighton & Hove Albion', 'Ein Frankfurt': 'Eintracht Frankfurt', Olympiakos: 'Olympiacos', 'Asteras Tripolis': 'Asteras Tripoli' };
export function useNames(espn) {
  if (espn && espn.aliases) ALIASES = { ...PAGE_ALIASES, ...espn.aliases };
  if (espn && espn.small) SMALL = new Set(espn.small);
}

// ESPN's counts for our stat names; offsides and cards need the match's own page
const KEYS = { fouls: 'foulsCommitted', shots: 'totalShots', 'shots on target': 'shotsOnTarget', corners: 'wonCorners', offsides: 'offsides', 'yellow cards': 'yellowCards', cards: 'yellowCards' };
const NEEDS_SUMMARY = new Set(['offsides', 'yellow cards', 'cards']);

// Where a count is heading, the way the laptop's live tool reckons it (scripts/live.py, measured on about 1,900 league
// matches on 15 and 16 Oct 2026): our number for the share of the match still to play, times the pace so far against our
// number with only a little of it carried (a straight pace from the first minutes says little about the rest), the rest a
// Poisson number (a negative binomial where a count scatters wider). Kept in step with live.py's FIRST_HALF, BELIEVED,
// BELIEVED_SIDE and SPREAD: board/test_live_rule.mjs checks this against live.py's own answers.
const STAT = { fouls: 'fouls', offsides: 'offsides', corners: 'corners', shots: 'shots', 'shots on target': 'sot', cards: 'cards', 'yellow cards': 'cards' };
const FIRST_HALF = { fouls: 0.476, offsides: 0.485, corners: 0.466, shots: 0.451, sot: 0.45, cards: 0.328 };
const BELIEVED = { fouls: 0.1, offsides: 0.1, corners: 0.0, shots: 0.1, sot: 0.0, cards: 0.0 };
const BELIEVED_SIDE = { offsides: 0.3, corners: 0.1 };
const SPREAD = { 'corners t': 40.4, 'corners s': 6.9, 'offsides t': 70.3, 'offsides s': 8.6, 'shots t': 136.9, 'shots s': 11.9, 'sot s': 30.7, 'cards t': 40.2 };

// the feed carries live.py's current values (board.live_rule, read from its text): they replace the copy above
export function useRule(rule) {
  if (!rule) return;
  for (const [into, from] of [[FIRST_HALF, rule.FIRST_HALF], [BELIEVED, rule.BELIEVED], [BELIEVED_SIDE, rule.BELIEVED_SIDE], [SPREAD, rule.SPREAD]]) {
    if (from && typeof from === 'object') Object.assign(into, from);
  }
}

function played(minute, period, stat) {
  const first = FIRST_HALF[stat] ?? 0.47;
  return period >= 2 ? first + ((1 - first) * Math.min(Math.max(minute - 45, 0), 45)) / 45 : (first * Math.min(minute, 45)) / 45;
}
// what is still to come of a count: our number, the minute, and the pace so far (four counts of prior: early minutes say little)
export function toCome(number, so, minute, period, stat, oneSide) {
  const behind = played(minute, period, stat);
  const carried = oneSide ? (BELIEVED_SIDE[stat] ?? BELIEVED[stat] ?? 0.1) : (BELIEVED[stat] ?? 0.1);
  const pace = ((so + 4) / (number * behind + 4)) ** carried;
  return Math.max(number * (1 - behind) * pace, 0.01);
}
function atMost(k, mean, r) {
  if (k < 0) return 0;
  let p, sum;
  if (r) { const q = r / (r + mean); p = q ** r; sum = p; for (let i = 1; i <= k; i++) { p *= ((i - 1 + r) / i) * (1 - q); sum += p; } }
  else { p = Math.exp(-mean); sum = p; for (let i = 1; i <= k; i++) { p *= mean / i; sum += p; } }
  return Math.min(sum, 1);
}
// the chance a half line ends our way from here
export function chanceNow(so, rest, way, line, stat, oneSide) {
  const under = atMost(Math.floor(line) - so, rest, SPREAD[`${stat} ${oneSide ? 's' : 't'}`]);
  return way === 'under' ? under : 1 - under;
}

function clean(s) {
  return s.normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}
function ratio(a, b) {           // a short stand-in for difflib's ratio: shared characters in order, both ways
  if (!a.length || !b.length) return 0;
  const m = Array.from({ length: a.length + 1 }, () => new Array(b.length + 1).fill(0));
  for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++) m[i][j] = a[i - 1] === b[j - 1] ? m[i - 1][j - 1] + 1 : Math.max(m[i - 1][j], m[i][j - 1]);
  return (2 * m[a.length][b.length]) / (a.length + b.length);
}
export function alike(ours, theirs) {
  const a = clean(ALIASES[ours] || ours), b = clean(theirs);
  if (a === b) return 1;
  const ta = a.split(' ').filter((t) => !SMALL.has(t)), tb = b.split(' ').filter((t) => !SMALL.has(t));
  const hit = ta.filter((x) => tb.some((y) => x === y || (x.length >= 3 && y.startsWith(x)) || (y.length >= 3 && x.startsWith(y)))).length;
  return Math.max(hit / Math.max(ta.length, tb.length, 1), ratio(a, b));
}

const boards = new Map();        // league code -> {at, events}
const summaries = new Map();     // event id -> {at, stats}
export const state = new Map();  // pick key -> live reading

async function getJSON(url) {
  const r = await fetch(url, { cache: 'no-store' });
  if (!r.ok) throw new Error(String(r.status));
  return r.json();
}

function minuteOf(ev) {
  const st = ev.status || {};
  const t = st.type || {};
  if (t.state === 'pre') return { state: 'pre', minute: 0, clock: 'not started' };
  if (t.state === 'post') return { state: 'post', minute: 95, clock: t.shortDetail || 'FT' };
  const m = parseInt(String(st.displayClock || '').replace(/[^0-9+]/g, ''), 10);
  const half = t.name === 'STATUS_HALFTIME' ? 'HT' : null;
  const minute = half ? 45 : Number.isFinite(m) ? m : 0;
  return { state: 'in', minute, period: half ? 1 : st.period || (minute > 45 ? 2 : 1), clock: half || st.displayClock || t.shortDetail || 'live' };
}

function teamStats(comp) {
  const out = {};
  for (const c of comp.competitors || []) {
    const s = {};
    for (const x of c.statistics || []) { const v = parseFloat(x.displayValue); if (Number.isFinite(v)) s[x.name] = v; }
    s.goals = parseFloat(c.score);
    out[c.homeAway] = { name: c.team?.displayName || '', stats: s };
  }
  return out;
}

function findEvent(match, kickAt, events) {
  const [home, away] = match.split(' v ');
  let best = null, bestScore = 0;
  for (const ev of events) {
    const comp = ev.competitions?.[0];
    if (!comp) continue;
    const sides = Object.fromEntries((comp.competitors || []).map((c) => [c.homeAway, c.team?.displayName || '']));
    const near = kickAt ? Math.abs(Date.parse(ev.date) - kickAt.getTime()) <= 2 * 3600e3 : true;
    if (!near) continue;
    const s = Math.min(alike(home, sides.home || ''), alike(away, sides.away || ''));
    if (s > bestScore) { best = ev; bestScore = s; }
  }
  return bestScore >= 0.55 ? best : null;
}

// picks: today's open football picks; laptop: the feed's live lines; returns true when anything changed
export async function poll(picks, laptop = []) {
  const now = Date.now();
  const due = picks.filter((p) => p.sport === 'football' && p.kickAt && now >= p.kickAt.getTime() - 15 * 60e3 && now <= p.kickAt.getTime() + 2.6 * 3600e3);
  if (!due.length) return false;
  const leagues = new Set(due.map((p) => (CODES[p.comp] ? p.comp : null)));
  if (leagues.has(null)) { leagues.delete(null); for (const c of ['EPL', 'LALIGA', 'SERIEA', 'BUNDESLIGA', 'LIGUE1', 'GREEK']) leagues.add(c); }
  await Promise.all([...leagues].map(async (code) => {
    const old = boards.get(code);
    if (old && now - old.at < 55e3) return;
    try {
      const d = await getJSON(`https://site.api.espn.com/apis/site/v2/sports/soccer/${CODES[code]}/scoreboard`);
      boards.set(code, { at: now, events: d.events || [] });
    } catch { /* keep the last reading */ }
  }));
  const events = [...boards.values()].flatMap((b) => b.events);
  let changed = false;
  for (const p of due) {
    const ev = findEvent(p.match, p.kickAt, events);
    if (!ev) continue;
    const comp = ev.competitions[0];
    const when = minuteOf(ev);
    const sides = teamStats(comp);
    let stats = sides;
    const key = KEYS[p.stat] || null;
    if (key && NEEDS_SUMMARY.has(p.stat) && when.state !== 'pre') {
      const s = summaries.get(ev.id);
      if (!s || now - s.at > (when.state === 'post' ? 36e5 : 170e3)) {
        try {
          const d = await getJSON(`https://site.api.espn.com/apis/site/v2/sports/soccer/${CODES[p.comp] || 'eng.1'}/summary?event=${ev.id}`);
          const per = {};
          for (const t of d.boxscore?.teams || []) {
            const ha = t.homeAway || ((comp.competitors || []).find((c) => c.team?.id === t.team?.id)?.homeAway);
            const st = {};
            for (const x of t.statistics || []) { const v = parseFloat(x.displayValue); if (Number.isFinite(v)) st[x.name] = v; }
            per[ha] = { name: t.team?.displayName || '', stats: st };
          }
          summaries.set(ev.id, { at: now, stats: per });
        } catch { /* keep the last */ }
      }
      if (summaries.get(ev.id)) stats = summaries.get(ev.id).stats;
    }
    let so = null;
    if (key) {
      const h = stats.home?.stats?.[key], a = stats.away?.stats?.[key];
      if (p.scope === 'home team') so = h ?? null; else if (p.scope === 'away team') so = a ?? null; else if (Number.isFinite(h) && Number.isFinite(a)) so = h + a;
    }
    let source = 'ESPN';
    if (so === null) {                                     // the laptop's live reader, when it has the stat
      const stem = p.stat === 'throw-ins' ? 'throwins' : p.stat === 'goal kicks' ? 'goalkicks' : null;
      const suffix = p.scope === 'home team' ? '_h' : p.scope === 'away team' ? '_a' : '_t';
      const l = stem ? laptop.find((x) => x.match === p.match && x.key === stem + suffix) : null;
      if (l) { so = l.so_far; source = 'laptop'; }
    }
    const minute = Math.max(when.minute, 1);
    let heading = when.state === 'post' ? so : null, chance = null;
    if (so !== null && when.state === 'in') {
      const stat = STAT[p.stat] || p.stat, oneSide = p.scope === 'home team' || p.scope === 'away team';
      if (Number.isFinite(p.expected) && p.expected > 0) {                  // our number before kick-off: live.py's rule
        const rest = toCome(p.expected, so, minute, when.period, stat, oneSide);
        heading = so + rest;
        if (p.side === 'over' || p.side === 'under') chance = chanceNow(so, rest, p.side, p.line, stat, oneSide);
      } else if (minute >= 12) heading = (so * 94) / minute;               // no number of ours: the straight pace so far
    }
    const score = `${sides.home?.stats?.goals ?? 0}-${sides.away?.stats?.goals ?? 0}`;
    const reading = { state: when.state, clock: when.clock, minute: when.minute, score, so, heading, chance, source, at: now, event: ev.id,
      home: sides.home?.name, away: sides.away?.name, possession: [sides.home?.stats?.possessionPct, sides.away?.stats?.possessionPct] };
    const old = state.get(p.key);
    if (!old || old.so !== reading.so || old.clock !== reading.clock || old.score !== reading.score) changed = true;
    state.set(p.key, reading);
  }
  return changed;
}

// how a live pick stands: 'winning', 'losing', 'level' with the count so far against the line
export function standing(p, r) {
  if (!r || r.so === null || r.so === undefined) return null;
  const over = p.side === 'over';
  const done = r.state === 'post';
  if (over && r.so > p.line) return { word: 'landed', tone: 'good' };
  if (!over && r.so > p.line) return { word: 'gone', tone: 'bad' };
  if (done) return over ? { word: 'short', tone: 'bad' } : { word: 'held', tone: 'good' };
  const need = over ? p.line - r.so + 0.5 : null;
  if (Number.isFinite(r.chance)) {                       // the chance from here, as the laptop's live tool would give it
    return { word: `${Math.round(r.chance * 100)}% to ${over ? 'land' : 'hold'}`, tone: r.chance >= 0.6 ? 'good' : r.chance < 0.4 ? 'bad' : 'note' };
  }
  if (r.heading === null) return { word: over ? `needs ${need}` : `${(p.line - r.so).toFixed(1)} to spare`, tone: 'note' };
  const onTrack = over ? r.heading > p.line : r.heading < p.line;
  return { word: onTrack ? 'on course' : 'behind pace', tone: onTrack ? 'good' : 'bad' };
}
