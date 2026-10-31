// Loading the feed: the laptop publishes the feed in parts (data/p/<id>.enc, each gzipped and locked with AES-GCM; their
// index named in data/version.json "parts"; scripts/board_parts.py) and, for a while, the whole of it as data/board.enc.
// A part's name comes from its content, so a part never changes under its name: this phone keeps each one it fetched and
// fetches only the parts it does not have (25 Oct 2026; the whole feed went again on every change and every opening).
// The key never leaves this phone: it comes in the link (#...k=...) once and is kept here. On the laptop's own preview
// the plain data/board.json is read when nothing locked is there.

import { load, save, dowOf, weekStart, fromGreek, ukHM } from './util.js';
import { keyFromHash } from './state.js';

export const COMP = {
  EPL: 'Premier League', LALIGA: 'La Liga', SERIEA: 'Serie A', BUNDESLIGA: 'Bundesliga', LIGUE1: 'Ligue 1', GREEK: 'Greek Super League',
  UCL: 'Champions League', UEL: 'Europa League', UECL: 'Conference League', EuroLeague: 'EuroLeague', GBL: 'Greek Basket League',
  ACB: 'Liga ACB', ATP: 'ATP', WTA: 'WTA', '?': 'League not known',
  // the extra leagues (Rest's H27 work, 30 Oct 2026): untested, on paper
  TURKEY: 'Turkey', PORTUGAL: 'Portugal', NETHERLANDS: 'Eredivisie', CHAMPIONSHIP: 'Championship', BELGIUM: 'Belgium', SCOTLAND: 'Scotland',
  MLS: 'MLS', ARGENTINA: 'Argentina', BRAZIL: 'Brazil',
};
export const compName = (c) => COMP[c] || c || '–';
const SCORE_OF = { 1: '●●●', 2: '●●○', 3: '●○○' };              // a bet's 1-3 score as Slices, Trends and the filters cut it (31 Oct 2026)

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

// ------------------------------------------------------------------------------------------------ the feed in parts

const PARTS = 'bbparts-v1';           // not "bb-board-...": the service worker clears those on every new page
const parsed = new Map();             // part id -> its content, for this page's life
export const lastLoad = { parts: 0, fetched: 0, bytes: 0, at: null, how: null };

async function partsCache() {
  try { return typeof caches !== 'undefined' ? await caches.open(PARTS) : null; } catch { return null; }
}

async function partBytes(id, cache) {
  const url = `data/p/${id}.enc`;
  if (cache) { try { const hit = await cache.match(url); if (hit) return { buf: await hit.arrayBuffer(), net: 0 }; } catch { /* fetch it */ } }
  const r = await fetch(url);
  if (!r.ok) throw Object.assign(new Error(`part ${id}: ${r.status}`), { status: r.status });
  const buf = await r.arrayBuffer();
  if (cache) { try { await cache.put(url, new Response(buf.slice(0))); } catch { /* full or refused: it is fetched again next time */ } }
  return { buf, net: buf.byteLength };
}

// the feed back from its index and parts, as board.json has it (scripts/board_parts.py split; the rows in the same order)
export function assemble(index, get) {
  const feed = { ...get(index.rest) };
  for (const [k, id] of Object.entries(index.keys || {})) feed[k] = get(id);
  const b = index.bets;
  if (b) {
    const at = {}, rows = [];
    for (const [d, n] of b.runs) {
      const chunk = get(b.days[d]);
      const i = at[d] || 0;
      for (let j = i; j < i + n; j++) rows.push(chunk[j]);
      at[d] = i + n;
    }
    feed.bets = { cols: b.cols, rows };
  }
  return feed;
}

async function fetchParts(version, key) {
  const cache = await partsCache();
  let fetched = 0, bytes = 0;
  const open = async (buf) => JSON.parse(await gunzip(await decrypt(buf, key)));
  const part = async (id) => {
    if (parsed.has(id)) return parsed.get(id);
    let { buf, net } = await partBytes(id, cache);
    let value;
    try {
      value = await open(buf);
    } catch (e) {
      if (net || !cache) throw e;                                   // this phone's copy would not open: drop it, fetch it once
      await cache.delete(`data/p/${id}.enc`).catch(() => {});
      ({ buf, net } = await partBytes(id, cache));
      value = await open(buf);
    }
    if (net) { fetched += 1; bytes += net; }
    parsed.set(id, value);
    return value;
  };
  const index = await part(version.parts);
  const ids = [index.rest, ...Object.values(index.keys || {}), ...Object.values(index.bets?.days || {})];
  await Promise.all(ids.map(part));
  const feed = assemble(index, (id) => parsed.get(id));
  const keep = new Set([version.parts, ...ids]);
  for (const id of [...parsed.keys()]) if (!keep.has(id)) parsed.delete(id);
  if (cache) {                                                      // this phone keeps only what the newest index names
    cache.keys().then((reqs) => Promise.all(reqs.filter((q) => !keep.has(q.url.split('/').pop().replace(/\.enc$/, ''))).map((q) => cache.delete(q)))).catch(() => {});
  }
  Object.assign(lastLoad, { parts: keep.size, fetched, bytes, at: new Date(), how: 'parts' });
  return feed;
}

// returns {feed} or {feed, version} (a newer version was read on the way) or {need: 'key'} or {error}
export async function fetchFeed(version) {
  const key = currentKey();
  if (version?.parts) {
    if (!key) return { need: 'key' };
    try {
      return { feed: await fetchParts(version, key) };
    } catch (e) {
      if (e && e.name === 'OperationError') return { need: 'key', error: 'That key does not open this board.' };
      if (e && e.status === 404) {                                  // a part gone with a publish in between: read the newest index once
        const v2 = await fetchVersion();
        if (v2?.parts && v2.parts !== version.parts) {
          try { return { feed: await fetchParts(v2, key), version: v2 }; } catch { /* the whole file below */ }
        }
      }
    }
  }
  const stamp = version?.hash || Date.now();
  try {
    const r = await fetch(`data/board.enc?v=${stamp}`, { cache: 'no-store' });
    if (r.ok) {
      if (!key) return { need: 'key' };
      try {
        const buf = await r.arrayBuffer();
        const plain = await decrypt(buf, key);
        const feed = JSON.parse(await gunzip(plain));
        Object.assign(lastLoad, { parts: 1, fetched: 1, bytes: buf.byteLength, at: new Date(), how: 'whole' });
        return { feed };
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

function hourBand(at) {                    // the kick-off's hour in the UK (all times UK, 30 Oct 2026)
  const hm = ukHM(at);
  if (!hm) return null;
  const h = +hm.slice(0, 2);
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
// the paper stake in bands (pounds on the 1,000 bank): the last of the filters the user asked for on 19 Oct 2026 (CAPABILITIES,
// the board's five ideas, (3)); ordered by metrics.orderKeys the way the overlay bands are
export const STAKE_BANDS = [[10, 'under £10'], [25, '£10 to £24'], [50, '£25 to £49'], [Infinity, '£50 and over']];
export function stakeBand(stake) {
  if (typeof stake !== 'number' || !Number.isFinite(stake) || stake <= 0) return null;
  return STAKE_BANDS.find(([top]) => stake < top)[1];
}

// the feed as the views use it: objects, with the cuts about time worked out once
export function prepare(feed) {
  const bets = rowsOf(feed.bets).map((r) => {
    r.settled = r.status === 'won' || r.status === 'lost';
    r.w = r.status === 'won' ? 1 : 0;
    r.dow = r.day ? dowOf(r.day) : null;
    r.week = r.day ? weekStart(r.day) : null;
    r.lead = leadBand(r.lead);
    r.statSide = r.stat && r.side ? `${r.stat} ${r.side}` : null;
    r.score = SCORE_OF[Number(r.tier)] || 'not scored';              // the 1-3 score, the one confidence measure (the user, 31 Oct 2026)
    r.eband2 = fineBand(r.edge);
    r.sband = stakeBand(r.stake);
    r.kickAt = r.kick && r.kick.length >= 16 ? fromGreek(r.kick) : null;
    r.hour = hourBand(r.kickAt);
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
  const today = rowsOf(feed.today?.picks).map((p) => { p.kickAt = fromGreek(p.kick); p.heat = heatOf(p, feed.heat || {}); p.score = SCORE_OF[Number(p.tier)] || 'not scored'; return p; });
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
