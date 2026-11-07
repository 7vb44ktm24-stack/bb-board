// "How close to proven" (6 Nov 2026, the user's yes in the strategy talk, DECISIONS 0f4a4b2; PA's proposal): a line for each focus
// lane in today's order, in the morning digest (digest.js) and first on Results: settled so far, the return with its luck band by
// match, how many bands that is (beyond luck from two bands on 20 settled: best.js's verdictWord, the board's own words), and the
// bar the lane sends at. The digest says the bar short (FOCUS's `bar`); Results' card adds the record's own rule and status from the
// lane's early-winners row. A lane with no record yet says so. Display only: nothing here changes what a lane sends or stakes.
// The lanes and their order are the user's (the orchestrator, after 0f4a4b2): change FOCUS when the focus changes.
import { esc, pct, spct, int, isNum } from './util.js';
import { verdictWord } from './best.js';

export const FOCUS = [
  // Rest's lane row (every book's main line at the lane's rule, the figure the user chose on) first, H105's cell until it exists
  { id: 'basket_ast', label: 'European basketball team assists', unit: 'games', bar: '🧪 10%+ over the price, 1.50-3.00, counts the count check cleared',
    rows: ["Basketball: European team assists at the lane's rule", "Basketball: assists at 10%+ on the books' main lines (H105's cell)"],
    tags: { "Basketball: assists at 10%+ on the books' main lines (H105's cell)": "H105's cell" } },
  { id: 'football_players', label: 'Football player markets', building: "building (Live's player map, Rest's H136): no record yet" },
  { id: 'more_fouls', label: "The new leagues' fouls unders", unit: 'matches', bar: '🧪 15%+ in Turkey, Portugal and the Championship; the rest paper',
    rows: ["The extra leagues' fouls unders (H27)"] },
  { id: 'inplay', label: 'In-play football unders', unit: 'matches', bar: "🧪 20%+ at the main line, 10-80'", parts: [
    { short: 'fouls (H123)', rows: ['Live football: in-play fouls unders (H123), unproven'] },
    { short: 'throw-ins (H127)', rows: ['Live football: in-play throw-ins unders (H127), unproven'] }] },
  // the NHL's player picks held on paper from 6 Nov 2026 (DECISIONS 9590d17): the board's own held set, as live tennis's (PA, 7 Nov 2026)
  { id: 'nhl_players', label: 'NHL player shots', unit: 'games', bar: '📄 held on paper, a unit each', set: { sport: 'nhl', set: 'held' },
    rule: 'every NHL player pick from 6 Nov, held by rule and never sent, a unit each (the team and match shots are H121, apart)', status: 'paper: held by rule' },
  // Live's scripts/tennis_live_alerts.py: SEND 20%, ONE_A_MATCH, DAY_CAP 5, LABEL paper (the user's choice A, 6 Nov)
  { id: 'live_tennis', label: 'Live tennis', unit: 'matches', bar: '📄 20%+ on our number, one a match, five a day', set: { sport: 'tennis', set: 'livesent' },
    rule: 'the in-play suggestions sent to the BB Picks chat since 31 Oct, a unit each', status: 'paper from 6 Nov: tracked to learn, no stake' },
];

// luck by match for a bets set: the wider of the bet-by-bet band and the spread of the matches' own results around the return
// (lines of one match move together; Rest's "luck by game", D:/football_work/_diag/talk1106/basket_euro.py)
export function byMatch(bets) {
  const done = bets.filter((b) => (b.status === 'won' || b.status === 'lost') && isNum(b.stake) && isNum(b.price) && isNum(b.profit));
  const staked = done.reduce((s, b) => s + b.stake, 0);
  if (!done.length || !staked) return { n: 0, matches: 0, return: null, luck: null };
  const profit = done.reduce((s, b) => s + b.profit, 0), R = profit / staked;
  const one = Math.sqrt(done.reduce((s, b) => s + b.stake * b.stake * (b.price - 1), 0)) / staked;
  const m = new Map();
  for (const b of done) { const k = b.match || b.id; const x = m.get(k) || { p: 0, s: 0 }; x.p += b.profit; x.s += b.stake; m.set(k, x); }
  const G = m.size;
  const spread = G > 1 ? Math.sqrt([...m.values()].reduce((s, x) => s + (x.p - R * x.s) ** 2, 0) * G / (G - 1)) / staked : 0;
  return { n: done.length, matches: G, return: R, luck: Math.max(one, spread), by_match: true, won: done.filter((b) => b.status === 'won').length / done.length };
}

// a lane row's band: its own, or the wider of it and its by-match band where the lane writes one (luck_match)
const rowLuck = (r) => (isNum(r.luck_match) ? Math.max(r.luck || 0, r.luck_match) : r.luck);
const pick = (EW, names) => {
  const rows = (EW && EW.rows) || [];
  for (const nm of names) { const r = rows.find((x) => x.name === nm); if (r && r.n) return r; }
  return null;
};

// one record's reading: n, matches, return, luck, bands (return over luck), the board's word, and how far it is from beyond luck
export function reading(r) {
  if (!r || !r.n) return null;
  const luck = rowLuck(r);
  const z = isNum(r.return) && isNum(luck) && luck > 0 ? r.return / luck : null;
  const byMatch = !!r.by_match || isNum(r.luck_match);
  // "beyond luck" only on a band by match (the orchestrator's condition, 6 Nov 07:3x): a row whose band is bet by bet counts the
  // lines of one match as independent, so beyond luck there waits for the lane's luck_match
  const said = verdictWord({ n: r.n, return: r.return, luck, biggest: r.biggest });
  const word = said.endsWith('beyond luck') && !byMatch ? 'too early (band by bet)' : said;
  const gap = isNum(z) ? 2 - z : null;
  const short = r.n < 20 ? `${20 - r.n} more settled before it can say` : word !== said ? 'beyond luck waits for a band by match'
    : isNum(gap) && gap > 0 ? `${gap.toFixed(1)} band${gap >= 1.05 ? 's' : ''} short of beyond luck` : '';
  return { n: r.n, matches: r.matches, return: r.return, luck, z, word, short, won: r.won, said: r.said, name: r.name, rule: r.rule, status: r.status, byMatch };
}

// every focus lane, in order: {no, label, unit, bar, building} and parts [{short, reading, rule, status, name}]
export function focusLanes(D) {
  const EW = D && D.feed && D.feed.early_winners;
  return FOCUS.map((f, i) => {
    const base = { ...f, no: i + 1 };
    if (f.building) return base;
    if (f.set) {
      const bets = ((D && D.bets) || []).filter((b) => b.sport === f.set.sport && b.set === f.set.set);
      return { ...base, parts: [{ short: '', reading: reading(byMatch(bets)), rule: f.rule, status: f.status, name: '' }] };
    }
    const parts = (f.parts || [{ short: '', rows: f.rows }]).map((p) => {
      const r = pick(EW, p.rows);
      return { short: p.short, reading: reading(r), rule: r && r.rule, status: r && r.status, name: r && r.name };
    });
    return { ...base, parts };
  });
}

const minus = (s) => s.replace(/^-/, '−');
const bandsText = (x) => (isNum(x.z) ? `${minus(x.z.toFixed(1))} luck bands${x.byMatch ? '' : ' by bet'}` : '');
const howText = (x) => [bandsText(x), x.short].filter(Boolean).join('; ');
const countText = (x, unit) => `${int(x.n)} settled${isNum(x.matches) && x.matches !== x.n ? ` in ${int(x.matches)} ${unit}` : ''}`;
function readingText(x, unit) {
  if (!x) return 'nothing settled yet';
  return `${countText(x, unit)}, ${spct(x.return)} ±${pct(x.luck)}: ${x.word}${howText(x) ? ` (${howText(x)})` : ''}`;
}

// the digest's lines (Telegram HTML, bold only): "• 1. <lane> (<bar>): <reading>"
export function provenLines(D) {
  return focusLanes(D).map((L) => {
    if (L.building) return `• ${L.no}. ${esc(L.label)}: ${esc(L.building)}`;
    const tag = (p) => (L.tags && p.name && L.tags[p.name] ? `[${L.tags[p.name]}] ` : '');   // a stand-in record, named
    const parts = L.parts.map((p) => `${p.short ? `${esc(p.short)} ` : ''}${esc(tag(p))}${esc(readingText(p.reading, L.unit))}`);
    return `• ${L.no}. ${esc(L.label)}${L.bar ? ` (${esc(L.bar)})` : ''}: ${parts.join('; ')}`;
  });
}

// Results' card, first on the tab: a line each, the reading in the board's words, the bar, and the record's own rule beneath
export function provenCard(D, section) {
  const L = focusLanes(D);
  const tone = (w) => (w && w.startsWith('ahead, beyond') ? 'pos' : w && w.startsWith('behind') ? 'neg' : 'muted');
  const part = (p, unit) => {
    const x = p.reading;
    const head = `${p.short ? `<b>${esc(p.short)}</b> ` : ''}${x ? `<span class="${tone(x.word)}">${esc(x.word)}</span>` : '<span class="muted">nothing settled yet</span>'}`;
    const nums = x ? `<br><span class="small">${spct(x.return)} <span class="muted">±${pct(x.luck)}${x.byMatch ? ' by match' : ''}</span> · ${esc(countText(x, unit))}${isNum(x.won) ? ` · won ${pct(x.won)}${isNum(x.said) ? `, we said ${pct(x.said)}` : ''}` : ''}${howText(x) ? ` · ${esc(howText(x))}` : ''}</span>` : '';
    const rec = [p.name ? `the record: ${p.name}` : '', p.rule || '', p.status || ''].filter(Boolean).join('; ');
    return `${head}${nums}${rec ? `<br><span class="muted small">${esc(rec)}</span>` : ''}`;
  };
  const item = (l) => `<li><b>${l.no}. ${esc(l.label)}</b>${l.bar ? ` <span class="muted small">${esc(l.bar)}</span>` : ''}${l.building ? `<br><span class="muted small">${esc(l.building)}</span>` : l.parts.map((p) => `<br>${part(p, l.unit)}`).join('')}</li>`;
  return section('🎯 The focus lanes: how close to proven', `<ul class="plain">${L.map(item).join('')}</ul>`,
    { id: 'proven', sub: 'Today’s focus lanes in the order you chose, each with the bar it sends at (🧪 unproven: your call; 📄 paper). Each its own record: the return and one band of luck (by match where it says so: lines of one match move together). Beyond luck means two bands or more on 20 settled or more; below that, how far it still is. Information only: nothing here changes a lane.' });
}
