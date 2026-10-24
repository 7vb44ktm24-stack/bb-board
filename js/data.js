// Loading the feed: the laptop publishes data/board.enc (the feed, gzipped, locked with AES-GCM) and data/version.json.
// The key never leaves this phone: it comes in the link (#...k=...) once and is kept here. On the laptop's own preview
// the plain data/board.json is read instead.

import { load, save, dowOf, weekStart, fromGreek } from './util.js';
import { keyFromHash } from './state.js';

export const COMP = {
  EPL: 'Premier League', LALIGA: 'La Liga', SERIEA: 'Serie A', BUNDESLIGA: 'Bundesliga', LIGUE1: 'Ligue 1', GREEK: 'Greek Super League',
  UCL: 'Champions League', UEL: 'Europa League', UECL: 'Conference League', EuroLeague: 'EuroLeague', GBL: 'Greek Basket League',
  ACB: 'Liga ACB', ATP: 'ATP', WTA: 'WTA', '?': 'League not known',
};
export const compName = (c) => COMP[c] || c || '–';

function b64urlToBytes(s) {
  const b = atob(s.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((s.length + 3) % 4));
  const out = new Uint8Array(b.length);
  for (let i = 0; i < b.length; i++) out[i] = b.charCodeAt(i);
  return out;
}

export function currentKey() {
  const fromLink = keyFromHash();
  if (fromLink) { save('key', fromLink); return fromLink; }
  return load('key', null);
}
export function setKey(k) { save('key', k.trim()); }

async function gunzip(bytes) {
  if (typeof DecompressionStream === 'undefined') throw new Error('This browser cannot unpack the data (update iOS or the browser).');
  const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'));
  return await new Response(stream).text();
}

async function decrypt(buf, key) {
  const raw = b64urlToBytes(key);
  const k = await crypto.subtle.importKey('raw', raw, { name: 'AES-GCM' }, false, ['decrypt']);
  const bytes = new Uint8Array(buf);
  const iv = bytes.slice(0, 12), body = bytes.slice(12);
  const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, k, body);
  return new Uint8Array(plain);
}

export async function fetchVersion() {
  try {
    const r = await fetch(`data/version.json?t=${Date.now()}`, { cache: 'no-store' });
    if (!r.ok) return null;
    return await r.json();
  } catch { return null; }
}

// returns {feed} or {need: 'key'} or {error}
export async function fetchFeed(version) {
  const stamp = version?.hash || Date.now();
  try {
    const r = await fetch(`data/board.enc?v=${stamp}`, { cache: 'no-store' });
    if (r.ok) {
      const key = currentKey();
      if (!key) return { need: 'key' };
      try {
        const plain = await decrypt(await r.arrayBuffer(), key);
        return { feed: JSON.parse(await gunzip(plain)) };
      } catch (e) {
        return { need: 'key', error: 'That key does not open this board.' };
      }
    }
  } catch { /* no locked file: try the plain one */ }
  try {
    const r = await fetch(`data/board.json?v=${stamp}`, { cache: 'no-store' });
    if (r.ok) return { feed: await r.json() };
    return { error: `The board's data did not load (${r.status}).` };
  } catch (e) {
    return { error: 'The board’s data did not load: no connection?' };
  }
}

function rowsOf(t) {
  if (!t || !t.cols) return [];
  return t.rows.map((r) => Object.fromEntries(t.cols.map((c, i) => [c, r[i]])));
}

function hourBand(kick) {
  const h = kick && kick.length >= 16 ? +kick.slice(11, 13) : null;
  if (h === null) return null;
  return h < 15 ? 'before 15:00' : h < 18 ? '15:00 to 17:59' : h < 21 ? '18:00 to 20:59' : '21:00 and later';
}
function leadBand(m) {
  if (m === null || m === undefined) return null;
  return m < 120 ? 'under 2 hours' : m < 360 ? '2 to 6 hours' : m < 1440 ? '6 to 24 hours' : 'a day or more';
}
// the overlay in finer bands than the record's four (the Trends tab's "finer" split): fives up to 30%, then 30s, then 40%+
export const FINE_EDGES = [[0.10, 'under 10%'], [0.15, '10% to 14%'], [0.20, '15% to 19%'], [0.25, '20% to 24%'], [0.30, '25% to 29%'], [0.40, '30% to 39%'], [Infinity, '40% and over']];
export function fineBand(edge) {
  if (typeof edge !== 'number' || !Number.isFinite(edge)) return null;
  return FINE_EDGES.find(([top]) => edge < top)[1];
}

// the feed as the views use it: objects, with the cuts about time worked out once
export function prepare(feed) {
  const bets = rowsOf(feed.bets).map((r) => {
    r.settled = r.status === 'won' || r.status === 'lost';
    r.w = r.status === 'won' ? 1 : 0;
    r.dow = r.day ? dowOf(r.day) : null;
    r.week = r.day ? weekStart(r.day) : null;
    r.hour = hourBand(r.kick);
    r.lead = leadBand(r.lead);
    r.statSide = r.stat && r.side ? `${r.stat} ${r.side}` : null;
    r.eband2 = fineBand(r.edge);
    r.kickAt = r.kick && r.kick.length >= 16 ? fromGreek(r.kick) : null;
    if (r.kind === 'stat pick' && r.set === 'placeable') r.kind = 'stat pick';
    return r;
  });
  const tickets = rowsOf(feed.tickets).map((t) => {
    t.settled = t.status !== 'open' && t.status !== 'void' && t.back !== null && t.back !== undefined;
    t.day = t.placed ? t.placed.slice(0, 10) : null;
    t.week = t.day ? weekStart(t.day) : null;
    t.legsBand = !t.legs ? 'not known' : t.legs === 1 ? '1 (single)' : t.legs === 2 ? '2' : t.legs === 3 ? '3' : t.legs <= 5 ? '4 to 5' : '6 or more';
    return t;
  });
  const parlays = rowsOf(feed.parlays).map((p) => { p.settled = p.status === 'won' || p.status === 'lost'; return p; });
  const today = rowsOf(feed.today?.picks).map((p) => { p.kickAt = fromGreek(p.kick); p.heat = heatOf(p, feed.heat || {}); return p; });
  return { feed, bets, tickets, parlays, today, live: feed.live || { states: [], lines: [] }, model: feed.model || {}, status: feed.status || {} };
}

// a pick at a bookmaker that can be fairly sure the account beats its prices (2 or more, on enough bets read again; 19 Oct
// 2026, the accounts view): how sure, and how often the pick's market was cut after the bet there; null where it can't tell
export function heatOf(p, H) {
  const b = ((H && H.books) || {})[p.book];
  if (!b || !Number.isFinite(b.t) || b.t < 2 || (b.with_price || 0) < (H.few || 10)) return null;
  const kind = p.stat && p.side ? `${p.stat} ${p.side}` : null;
  const k = kind ? (H.kinds || []).find((x) => x.book === p.book && x.kind === kind) : null;
  return { book: p.book, t: b.t, sure: b.sure, kind, cut: k ? k.cut : null, bets: k ? k.bets : null, spare: H.spare_book === p.book };
}
