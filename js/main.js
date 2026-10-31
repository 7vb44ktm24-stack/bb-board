// The board: load the feed, keep it fresh, draw the tab you are on, and route every tap.

import { esc, money, pct, spct, odds, num, isNum, greekDay, addDays, dayLabel, ago, copyText, debounce, load, save, ukHM, ukStamp, ukWhen } from './util.js';
import { S, TABS, SETS, RANGES, FILTERS, FILTER_LABEL, DIM, NEVER_SUMMED, set, go, onChange, readHash, toggleFilter, removeFilter, clearFilters } from './state.js';
import { fetchFeed, fetchVersion, prepare, setKey, compName, lastLoad } from './data.js';
import { agg, group, valueOf, orderKeys } from './metrics.js';
import { openSheet, closeSheet, toast, bookChip, statusTag, signClass, verdictPill, betLine, goAttr, recordLine } from './ui.js';
import * as C from './charts.js';
import * as Live from './live.js';
import * as Tg from './tg.js';
import * as Chat from './chat.js';
import * as Today from './views/today.js';
import * as Results from './views/results.js';
import * as Trends from './views/trends.js';
import * as Slices from './views/slices.js';
import * as Model from './views/model.js';
import * as Lines from './views/lines.js';
import * as Money from './views/money.js';
import * as Ideas from './views/ideas.js';
import * as Fun from './views/fun.js';

const VIEWS = { today: Today, results: Results, trends: Trends, slices: Slices, model: Model, lines: Lines, money: Money, fun: Fun, ideas: Ideas };
let D = null;
let version = null;
let loadedApp = null;                                              // the page build this visit loaded (version.json "app")
const sorts = {};

// ------------------------------------------------------------------------------------------------ the rows in view

function rangeDays() {
  const today = greekDay();
  switch (S.range) {
    case 'today': return [today, today];
    case 'yesterday': return [addDays(today, -1), addDays(today, -1)];
    case '7d': return [addDays(today, -6), today];
    case '30d': return [addDays(today, -29), today];
    case 'month': return [today.slice(0, 8) + '01', today];
    case 'custom': return [S.from || addDays(today, -6), S.to || (S.from && S.from > today ? S.from : today)];
    default: return [null, null];
  }
}
export function inRange(day) {
  const [a, b] = rangeDays();
  if (!a) return true;
  return day && day >= a && day <= b;
}
function scope({ sport = S.sport, set: setId = S.set, ignoreFilters = false, ignoreRange = false } = {}) {
  if (!D) return [];
  return D.bets.filter((r) => {
    if (r.sport !== sport) return false;
    if (setId && r.set !== setId) return false;
    if (!ignoreRange && !inRange(r.day)) return false;
    if (!ignoreFilters) {
      for (const [k, v] of Object.entries(S.f)) if (v.length && !v.includes(String(valueOf(r, k)))) return false;
      for (const [k, v] of Object.entries(S.x || {})) if (v.length && v.includes(String(valueOf(r, k)))) return false;   // left out
    }
    return true;
  });
}

const ctx = {
  get D() { return D; }, get S() { return S; },
  scope, inRange, go,
  sortOf: (id, dflt) => sorts[id] || dflt || null,
  sheet: (t, b, m) => openSheet(t, b, m),
  bet: (id) => openBet(id),
  copy: async (text) => toast((await copyText(text)) ? 'Copied: paste it into the Claude chat' : 'Copy did not work: select the text instead'),
};

// ------------------------------------------------------------------------------------------------ drawing

function renderChrome() {
  document.querySelectorAll('[data-tab]').forEach((b) => { const on = b.dataset.tab === S.tab; b.classList.toggle('on', on); b.setAttribute('aria-current', on ? 'page' : 'false'); });
  const bar = document.getElementById('filterbar');
  const showFilters = S.tab !== 'today' && S.tab !== 'ideas';
  bar.hidden = !showFilters && S.tab !== 'ideas';
  const [a, b] = rangeDays();
  const rangeChips = RANGES.map((r) => `<button type="button" class="chip${S.range === r.id ? ' on' : ''}" data-range="${r.id}">${esc(r.label)}</button>`).join('');
  const custom = S.range === 'custom' ? `<span class="dates"><input type="date" id="from" value="${esc(S.from || a || '')}" aria-label="From"><span>to</span><input type="date" id="to" value="${esc(S.to || b || '')}" aria-label="To"></span>` : '';
  const chipOf = (k, x, out) => `<button type="button" class="chip chip-f${out ? ' chip-xed' : ''}" data-unfilter="${esc(k)}" data-value="${esc(x)}">${out ? 'not ' : ''}${esc(FILTER_LABEL[k] || k)}: ${esc(k === 'comp' ? compName(x) : x)} ✕</button>`;
  const active = [...Object.entries(S.f).flatMap(([k, v]) => v.map((x) => chipOf(k, x, false))), ...Object.entries(S.x || {}).flatMap(([k, v]) => v.map((x) => chipOf(k, x, true)))].join('');
  const nFilters = [...Object.values(S.f), ...Object.values(S.x || {})].reduce((s, v) => s + v.length, 0);
  const betFilters = S.tab !== 'lines';                             // the Lines tab cuts by its own chips; the range applies to it
  bar.innerHTML = `<div class="fb-row">${betFilters ? `<button type="button" class="chip chip-more" data-open-filters="1"><svg viewBox="0 0 24 24" aria-hidden="true" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 6h16M7 12h10M10 18h4"/></svg>Filters${nFilters ? ` (${nFilters})` : ''}</button>` : ''}${rangeChips}${custom}</div>
    ${active && betFilters ? `<div class="fb-row fb-active">${active}<button type="button" class="link small" data-clear="1">Clear all</button></div>` : ''}`;
  renderFresh();
}

function renderFresh() {
  const el = document.getElementById('fresh');
  if (!D) { el.textContent = 'Loading…'; return; }
  const built = Date.parse((version && version.checked_utc) || D.feed.built_utc);
  const age = Date.now() - built;
  const st = D.status || {};
  const tone = st.running ? 'run' : age < 75 * 60e3 ? 'ok' : age < 4 * 3600e3 ? 'old' : 'stale';
  el.className = `fresh fresh-${tone}`;
  el.innerHTML = `<span class="dot" aria-hidden="true"></span>${st.running ? 'Run going · ' : ''}${esc(ago(age))}`;
}

let currentView = null;
let lastTab = null;
function render() {
  if (!D) return;
  renderChrome();
  const root = document.getElementById('view');
  C.disposeIn(root);
  const V = VIEWS[S.tab] || Today;
  let out;
  try { out = V.render(ctx); } catch (e) { console.error(e); out = { html: `<p class="empty">This view could not be drawn: ${esc(e.message)}</p>` }; }
  root.innerHTML = out.html;
  if (lastTab !== S.tab) { window.scrollTo(0, 0); lastTab = S.tab; }
  currentView = out;
  requestAnimationFrame(() => { try { out.mount && out.mount(); } catch (e) { console.error(e); } });
  document.title = `${TABS.find((t) => t.id === S.tab)?.label || 'Board'} · BB Picks Board`;
  Tg.colours();
}

// ------------------------------------------------------------------------------------------------ sheets: a bet, a match, the filters, the status

function openBet(id) {
  const r = D.bets.find((x) => x.id === id);
  if (!r) return;
  const rows = [
    ['Price', odds(r.price)], ['Fair', odds(r.fair)], ['Overlay', `<span class="${signClass(r.edge)}">${spct(r.edge)}</span>`],
    ['Our chance', pct(r.ours)], ['The price needs', pct(r.needs)], ['The bookmaker’s own chance', pct(r.bookp)],
    ['Stake', money(r.stake, '£', 2, false)], ['Result', statusTag(r.status)], ['Came to', esc(r.actual ?? '–')], ['Profit', `<span class="${signClass(r.profit)}">${isNum(r.profit) ? money(r.profit, '£', 2) : '–'}</span>`],
    ['We expected', num(r.expected, 1)], ['They priced', num(r.theirs, 1)], ['By', isNum(r.by) ? num(r.by, 1) : '–'], ['How close', esc(r.margin || '–')],
    ['Where it landed', esc(r.landed || '–')], ['Whose number was nearer', esc(r.nearer || '–')], ['Red cards', esc(r.red || '–')], ['Half-time', esc(r.ht || '–')],
    ['Other bookmaker', r.other ? `${odds(r.other)} · ${esc(r.against || '')}` : esc(r.against || '–')], ['Later price', r.last ? `${odds(r.last)} (${esc(r.moved || '')})` : esc(r.moved || '–')],
    ['Score', esc(r.score && r.score !== 'not scored' ? r.score : 'not scored')],   // confidence retired for the 1-3 score (31 Oct 2026) ['Shown', esc(r.shown || '–')], ['Price read', esc(r.read || '–')], ['Settled on', esc(r.settled_on || '–')],
    ['Model', esc([r.built, r.code].filter(Boolean).join(' · ') || '–')], ['Set', esc(SETS[r.sport]?.find((x) => x.id === r.set)?.label || r.set)],
  ].filter(([, v]) => v && v !== '–' && v !== '<span class="">–</span>');
  const body = `<p class="sheet-lead"><b>${esc(String(r.bet || '').replace(/\s+at\s+\S+$/, ''))}</b> ${bookChip(r.book)}</p>
    <p class="muted">${esc(r.match)} · ${esc(compName(r.comp))} · ${esc(r.kick ? ukStamp(r.kick) : (r.day || ''))}</p>
    <dl class="facts">${rows.map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${v}</dd></div>`).join('')}</dl>
    ${r.why ? `<p class="why-text">${esc(r.why)}</p>` : ''}
    ${pregameBlock(r.match)}
    <div class="sheet-actions">
      <button type="button" class="btn" ${goAttr({ tab: 'slices', sport: r.sport, f: { stat: [r.stat], side: [r.side] }, rows: 'book', cols: 'comp' })}>How ${esc(r.stat)} ${esc(r.side)} has done</button>
      <button type="button" class="btn btn-ghost" data-match="${esc(r.match)}">Everything on this match</button>
      <button type="button" class="btn btn-ghost" ${goAttr({ tab: 'slices', sport: r.sport, f: { book: [r.book] }, rows: 'stat', cols: 'side' })}>All at ${esc(r.book)}</button>
    </div>`;
  openSheet(r.match, body);
}

// a match's pre-game view (lane L, 22 Oct 2026): football's first, then basketball's and tennis's (the R14 task, 23 Oct 2026), by
// the name every card carries; [the sport's view, the match] or null. The bet sheet shows it too (23 Oct: a bet line opened only
// its pick, never the match's expected stats)
function pregameOf(match) {
  const PG = D.feed.pregame || {};
  for (const view of [PG, ...Object.values(PG.sports || {})]) {
    const m = (view.matches || []).find((x) => x.match === match);
    if (m) return [view, m];
  }
  return null;
}
function pregameBlock(match) {
  const found = pregameOf(match);
  if (!found) return '';
  const [view, m] = found;
  return `<h3 class="sheet-h">Pre-game view <span class="muted small">ours / the bookmaker's level · ${esc(ukHM(m.kick))}</span></h3>${Today.pregameTable(m, view.stats)}`;
}

// the match page's notes (the user, 27 Oct 2026, through the orchestrator): the news check on this game's lines: who is out or
// doubtful and where it was read, our number before and after the news, the books' lines and how they moved, and the verdict
function notesBlock(match) {
  const rows = (D.feed.news || []).filter((n) => n.match === match);
  const calls = (D.feed.calls || []).filter((c) => c.match === match);
  if (!rows.length && !calls.length) return '';
  const item = (n) => `<li>${n.bet ? `<b>${esc(n.bet)}</b>` : `<b>${esc(n.what)}</b>`}: ours ${num(n.ours, 1)}${isNum(n.ours_after) ? ` → <b>${num(n.ours_after, 1)}</b> after the news${n.tested ? ` <span class="muted">(${esc(n.tested)})</span>` : ''}` : n.found ? ' <span class="muted">(not yet adjusted for the news)</span>' : ''}
    · books ${esc(n.books || '–')}${n.moved ? ` · moved ${esc(n.moved)}` : ''}
    <br>${n.found ? '🚩 ' : ''}${esc(n.out || n.news || '')}${n.source ? ` <span class="muted">(${esc(n.source)})</span>` : ''}
    ${n.verdict_label ? `<br><b>${esc(n.verdict_label)}</b> ${esc(n.verdict_why || '')}` : ''}</li>`;
  return `<h3 class="sheet-h">Notes</h3><ul class="plain small">${rows.map(item).join('')}
    ${calls.map((c) => `<li><b>${esc(c.verdict === 'PAPER' ? '📄 PAPER' : "⛔ DON'T BET")}</b> ${esc(c.line)}: ${esc(c.reason || '')} <span class="muted">(${esc(c.who || '')}, ${esc(String(c.when || '').slice(5, 16))})</span></li>`).join('')}</ul>`;
}

// how the game went (fm.flow, from the live capture's 2.5-minute readings; the user's ask of 27 Oct 2026): each count's line
function flowBlock(match) {
  const f = (D.feed.flow || {})[match];
  if (!f) return '';
  const order = ['fouls', 'shots', 'sot', 'corners', 'offsides', 'cards'];
  const lines = order.flatMap((k) => ['h', 'a', 't'].map((s) => f.notes?.[`${k}_${s}`]).filter(Boolean));
  return `<h3 class="sheet-h">How the game went <span class="muted small">${esc(f.final || '')}${f.state ? ` · at 75': ${esc(f.state)}` : ''}</span></h3>
    <ul class="plain small">${lines.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>`;
}

function openMatch(match) {
  const rows = D.bets.filter((r) => r.match === match && !NEVER_SUMMED.has(r.set));
  const picks = D.today.filter((p) => p.match === match);
  const sets = group(rows, 'set');
  const live = picks.map((p) => [p, Live.state.get(p.key)]).find(([, l]) => l);
  const pg = pregameOf(match);
  const body = `${live ? `<p class="live-row"><span class="live-dot${live[1].state === 'in' ? ' on' : ''}"></span><b>${esc(live[1].score)}</b> <span class="muted">${esc(live[1].clock)}</span></p>` : ''}
    ${pregameBlock(match)}
    ${notesBlock(match)}
    ${flowBlock(match)}
    ${picks.length ? `<h3 class="sheet-h">Picks for this match</h3><div class="lines">${picks.map((p) => `${Today.verdictBar(p)}<div class="bet-line static"><span class="bl-main"><span class="bl-bet">${Today.scoreBadge(p, D.feed.today)}${esc(p.bet)}</span><span class="bl-match muted">${esc(p.kick ? ukStamp(p.kick) : '')} · overlay ${spct(p.edge)} · ${Today.amountOf(p).v} ${esc(Today.amountOf(p).sub)}</span></span><span class="bl-side">${bookChip(p.book)}<span class="bl-price">${odds(p.price)}</span>${statusTag(p.status)}</span></div>`).join('')}</div>` : ''}
    ${sets.map((s) => `<h3 class="sheet-h">${esc(SETS[s.rows[0].sport]?.find((x) => x.id === s.key)?.label || s.key)} <span class="muted small">${s.n ? `${money(s.profit, '£', 2)} on ${s.n} settled` : ''}${s.open ? ` · ${s.open} open` : ''}</span></h3><div class="lines">${s.rows.map((r) => betLine(r, { showDay: false })).join('')}</div>`).join('')}
    ${!rows.length && !picks.length && !pg ? '<p class="empty">Nothing on this match.</p>' : ''}`;
  openSheet(match, body);
}

function openFilters() {
  const base = scope({ ignoreFilters: true });
  const blocks = FILTERS.map((k) => {
    const counts = {};
    for (const r of base) { const v = String(valueOf(r, k)); counts[v] = (counts[v] || 0) + 1; }
    const keys = orderKeys(k, Object.keys(counts).filter((x) => x !== '(not known)'), Object.fromEntries(Object.entries(counts).map(([x, n]) => [x, { n }])));
    const out = (S.x || {})[k] || [];
    if (keys.length < 2 && !(S.f[k] || []).length && !out.length) return '';
    return `<div class="fblock"><h3>${esc(FILTER_LABEL[k] || k)}</h3><div class="fchips">${keys.map((x) => { const isOut = out.includes(x); return `<button type="button" class="chip${(S.f[k] || []).includes(x) ? ' on' : isOut ? ' chip-xed' : ''}" data-filter="${esc(k)}" data-value="${esc(x)}">${isOut ? '✕ ' : ''}${esc(k === 'comp' ? compName(x) : x)} <span class="muted">${counts[x]}</span></button>`; }).join('')}</div></div>`;
  }).join('');
  openSheet('Filters', `<p class="muted small">Tap once to keep only that, twice to leave it out (✕: every bookmaker but Pame, every stat but offsides), a third time to clear. A bet must match one of the kept picks in every group and none left out. The numbers are bets in the current sport, set and range.</p>${blocks}
    <div class="sheet-actions sticky"><button type="button" class="btn" data-close-sheet="1">Show ${base.length ? 'the result' : ''}</button><button type="button" class="btn btn-ghost" data-clear="1">Clear all</button></div>`);
}

function openStatus() {
  const st = D.status || {};
  const ch = D.feed.check || {};
  const probs = D.feed.problems || [];
  const steps = (st.steps || []).map((s) => `<li class="${s.ok ? 'ok' : s.left ? 'left' : 'bad'}"><span aria-hidden="true">${s.ok ? '✓' : s.left ? '–' : '✕'}</span>${esc(s.step)}</li>`).join('');
  const body = `<dl class="facts">
      <div><dt>Data built</dt><dd>${esc(ukStamp(D.feed.built_utc || D.feed.built_greek))} (${esc(ago(Date.now() - Date.parse(D.feed.built_utc)))})</dd></div>
      ${version?.checked_utc ? `<div><dt>Last checked by the laptop</dt><dd>${esc(ago(Date.now() - Date.parse(version.checked_utc)))}</dd></div>` : ''}
      ${lastLoad.at ? `<div><dt>Last download</dt><dd>${lastLoad.how === 'parts' ? `${lastLoad.fetched} of ${lastLoad.parts} parts new, ${Math.round(lastLoad.bytes / 1024)} KB; the rest from this phone's copy` : `the whole feed, ${Math.round(lastLoad.bytes / 1024)} KB`}</dd></div>` : ''}
      <div><dt>Last run</dt><dd>${esc(st.run || '–')} · ${esc(st.status || '–')}${st.running ? ` · <b>a run is in progress</b> since ${esc(st.running_since || '')}` : ''}</dd></div>
      <div><dt>The record built</dt><dd>${esc(st.ledger_built ? ukStamp(st.ledger_built) : '–')} · results to ${esc(D.feed.headline?.results_to || '–')}</dd></div>
      <div><dt>Fast lane</dt><dd>${esc(st.fast_lane ? ukStamp(st.fast_lane) : '–')}</dd></div><div><dt>Last Telegram</dt><dd>${esc(st.telegram ? ukStamp(st.telegram) : '–')}</dd></div>
      <div><dt>Matches the record</dt><dd>${Object.entries(ch).map(([k, v]) => `${esc(k)} ${v.agree ? '✓' : '⚠'}`).join(' · ') || '–'}</dd></div>
    </dl>
    ${(D.feed.reconcile || []).length ? `<h3 class="sheet-h">Every set against its own record</h3><ul class="steps">${D.feed.reconcile.map((c) => `<li class="${c.agree ? 'ok' : 'bad'}"><span aria-hidden="true">${c.agree ? '✓' : '✕'}</span>${esc(c.set)} <span class="muted">· ${esc(c.record)}: ${Math.round(c.headline.settled)} settled</span></li>`).join('')}</ul>` : ''}
    ${st.failed?.length ? `<p class="warn">Failed: ${esc(st.failed.join('; '))}</p>` : ''}${st.left?.length ? `<p class="muted">Left for later: ${esc(st.left.join('; '))}</p>` : ''}
    ${probs.length ? `<p class="warn">Parts of the board left out this time: ${esc(probs.map((p) => p.part).join('; '))}</p>` : ''}
    <h3 class="sheet-h">The last run, step by step</h3><ul class="steps">${steps}</ul>
    ${(st.machine || []).length ? `<h3 class="sheet-h">By itself today</h3><ul class="plain">${st.machine.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>` : ''}
    <h3 class="sheet-h">The schedule</h3><ul class="plain">${(st.schedule || []).map((s) => `<li><b>${esc(s.what)}</b> <span class="muted">${esc(s.when)}</span></li>`).join('')}</ul>
    <div class="sheet-actions"><button type="button" class="btn" data-refresh="1">Check for new data now</button></div>`;
  openSheet('How fresh is this?', body);
}

function openSearch() {
  const seen = new Map();
  const pgOthers = Object.entries(D.feed.pregame?.sports || {}).flatMap(([sp, s]) => (s.matches || []).map((m) => ({ ...m, sport: sp })));
  for (const r of [...D.today, ...(D.feed.pregame?.matches || []).map((m) => ({ ...m, sport: 'football' })), ...pgOthers, ...D.bets]) {
    if (!r.match || seen.has(r.match)) continue;                  // every match of the pre-game view can be found too (22 Oct 2026)
    seen.set(r.match, { match: r.match, comp: r.comp, sport: r.sport, day: r.day || (r.kick || '').slice(0, 10) });
  }
  const all = [...seen.values()].sort((a, b) => (b.day || '').localeCompare(a.day || ''));
  const item = (m) => `<button type="button" class="bet-line" data-match="${esc(m.match)}"><span class="bl-main"><span class="bl-bet">${esc(m.match)}</span><span class="bl-match muted">${esc(compName(m.comp))} · ${esc(m.day || '')}</span></span><span class="bl-side muted small">${esc(m.sport)}</span></button>`;
  openSheet('Find a team or match', `<input type="search" class="search" id="find" placeholder="Type a team" aria-label="Type a team" autocomplete="off"><div class="lines" id="found">${all.slice(0, 30).map(item).join('')}</div>`, (body) => {
    const input = body.querySelector('#find');
    const list = body.querySelector('#found');
    // a team whose name starts with what was typed first ("Ars": Arsenal before Angers v Marseille), then the newest
    // names compared in Latin letters, accents off: "paok" finds the Greek league's ΠΑΟΚ v ΑΕΚ (23 Oct 2026)
    const GR = { α: 'a', β: 'v', γ: 'g', δ: 'd', ε: 'e', ζ: 'z', η: 'i', θ: 'th', ι: 'i', κ: 'k', λ: 'l', μ: 'm', ν: 'n', ξ: 'x', ο: 'o', π: 'p', ρ: 'r', σ: 's', ς: 's', τ: 't', υ: 'y', φ: 'f', χ: 'ch', ψ: 'ps', ω: 'o' };
    const latin = (s) => [...s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')].map((c) => GR[c] ?? c).join('');
    const rank = (m, q) => { const s = latin(m.match); return s.startsWith(q) ? 0 : s.split(/[\s\-'.]+/).some((w) => w.startsWith(q)) ? 1 : 2; };
    input.addEventListener('input', () => {
      const q = latin(input.value.trim());
      const hits = all.filter((m) => !q || latin(m.match).includes(q));
      if (q) hits.sort((a, b) => rank(a, q) - rank(b, q) || (b.day || '').localeCompare(a.day || ''));
      list.innerHTML = hits.slice(0, 40).map(item).join('') || '<p class="empty">No match with that name.</p>';
    });
    setTimeout(() => input.focus(), 250);
  });
}

function openFamily(name) {
  const fam = (ctx.families || []).find((f) => f.key === name);
  if (!fam) return;
  const body = `<div class="lines">${fam.rows.sort((a, b) => (b.day || '').localeCompare(a.day || '')).map((p) => `<div class="bet-line static"><span class="bl-main"><span class="bl-bet">${esc(p.theme || p.kind || '')}</span><span class="bl-match muted small">${esc(p.day || '')} · ${esc((p.legs || '').slice(0, 220))}</span></span><span class="bl-side">${bookChip(p.book)}<span class="bl-price">${odds(p.price)}</span>${statusTag(p.status)}<span class="bl-profit ${signClass(p.profit)}">${isNum(p.profit) ? money(p.profit, '£', 2) : ''}</span></span></div>`).join('')}</div>`;
  openSheet(name, body);
}

// a claim under test (planning/HYPOTHESES.md), whole, with the request to bring it up to date
function openHyp(id) {
  const h = (D?.feed.hypotheses || []).find((x) => x.id === id);
  if (!h) return;
  openSheet(`${h.id}: ${h.title}`, `${h.note ? `<p class="muted small">${esc(h.note)}</p>` : ''}
    ${h.items.map((i) => `<p class="small">${i.label ? `<b>${esc(i.label)}</b> ` : ''}${Ideas.mdLite(i.text)}</p>`).join('')}
    <div class="sheet-actions"><button type="button" class="btn" data-copy="${esc(Ideas.hypAsk(h))}">Copy request: bring it up to date</button></div>`);
}

// ------------------------------------------------------------------------------------------------ taps

document.addEventListener('click', async (e) => {
  const t = e.target.closest('[data-go],[data-bet],[data-match],[data-copy],[data-set],[data-range],[data-tab],[data-filter],[data-unfilter],[data-toggle-list],[data-clear],[data-open-filters],[data-sort],[data-close-sheet],[data-refresh],[data-family],[data-fresh],[data-theme-toggle],[data-search-open],[data-pick],[data-since],[data-hyp],[data-place],[data-unplace]');
  if (!t) return;
  if (t.matches('[data-place],[data-unplace]')) {                    // Placed: the bot's chat opens with the pick's code (scripts/bot_ask.py board_tap)
    const bot = D?.feed.bot, tap = t.dataset.place || t.dataset.unplace;
    if (!bot || !/^[0-9a-f]{10}$/.test(tap)) return;
    const mine = load('placedLocal', {}) || {};
    if (t.dataset.place) mine[tap] = Date.now(); else delete mine[tap];
    save('placedLocal', mine);
    Tg.openTg(`https://t.me/${bot}?start=${t.dataset.place ? 'pk' : 'pu'}_${tap}`);
    render();
    return;
  }
  if (t.matches('[data-hyp]')) { openHyp(t.dataset.hyp); return; }
  if (t.matches('[data-since]')) {
    const s = sinceLastVisit();
    if (s) openSheet('Since your last visit', `<p class="muted small">Since ${esc(ukWhen(s.at))} UK time, on this phone.</p>
      ${s.settled.length ? `<h3 class="sheet-h">Settled (${s.settled.length}): ${s.won} won, ${money(s.profit, '£', 2)}</h3><div class="lines">${s.settled.sort((a, b) => (b.kickAt || 0) - (a.kickAt || 0)).map((r) => betLine(r)).join('')}</div>` : ''}
      ${s.picks.length ? `<h3 class="sheet-h">New picks (${s.picks.length})</h3><div class="lines">${s.picks.map((p) => `<button type="button" class="bet-line" data-pick="${esc(p.key)}"><span class="bl-main"><span class="bl-bet">${esc(p.bet)}</span><span class="bl-match muted">${esc(ukHM(p.kick))} · ${esc(p.match)}</span></span><span class="bl-side">${bookChip(p.book)}<span class="bl-price">${odds(p.price)}</span><span class="${signClass(p.edge)} small">${spct(p.edge)}</span></span></button>`).join('')}</div>` : ''}`);
    return;
  }
  if (t.matches('[data-pick]')) {
    const p = D.today.find((x) => x.key === t.dataset.pick);
    if (p) openSheet(p.match, `<div class="picks">${Today.pickCard(p, Date.now())}</div>`);
    return;
  }
  if (t.matches('[data-search-open]')) { if (D) openSearch(); return; }
  if (t.matches('[data-copy]')) { e.preventDefault(); ctx.copy(t.dataset.copy); return; }
  if (t.matches('[data-bet]')) { openBet(t.dataset.bet); return; }
  if (t.matches('[data-match]')) { openMatch(t.dataset.match); return; }
  if (t.matches('[data-family]')) { openFamily(t.dataset.family); return; }
  if (t.matches('[data-go]')) {
    e.preventDefault();
    closeSheet();
    const target = JSON.parse(t.dataset.go);
    if (target.f && !target.sport && S.tab === 'today') target.sport = 'football';
    const card = target.card;                                       // a card on the new tab to open and show (26 Oct 2026: the outlets card)
    delete target.card;
    go(target);
    if (card) requestAnimationFrame(() => {
      const el = document.getElementById(card);
      if (!el) return;
      const d = el.querySelector('details[data-fold]');
      if (d && !d.open) d.open = true;
      el.scrollIntoView({ block: 'start' });
    });
    return;
  }
  if (t.matches('[data-tab]')) { closeSheet(); Tg.tick(); go({ tab: t.dataset.tab, keep: true }); return; }
  if (t.matches('[data-set]')) {
    const k = t.dataset.set, v = t.dataset.value;
    set({ [k]: v === 'true' ? true : v === 'false' ? false : /^\d+$/.test(v) && k === 'min' ? +v : v, ...(k === 'sport' ? { allSports: false } : {}) });
    if (k === 'liveOn' && v === 'true') pollLive();
    return;
  }
  if (t.matches('[data-range]')) { set({ range: t.dataset.range }); return; }
  if (t.matches('[data-filter]')) { toggleFilter(t.dataset.filter, t.dataset.value); openFilters(); return; }
  if (t.matches('[data-unfilter]')) { removeFilter(t.dataset.unfilter, t.dataset.value); return; }
  if (t.matches('[data-toggle-list]')) {                             // the Lines tab's "leave out": a value in or out of a list
    const k = t.dataset.toggleList, v = t.dataset.value, cur = new Set(S[k] || []);
    if (cur.has(v)) cur.delete(v); else cur.add(v);
    set({ [k]: [...cur] });
    return;
  }
  if (t.matches('[data-clear]')) { clearFilters(); closeSheet(); return; }
  if (t.matches('[data-open-filters]')) { openFilters(); return; }
  if (t.matches('[data-close-sheet]')) { closeSheet(); return; }
  if (t.matches('[data-refresh]')) { closeSheet(); refresh(true); return; }
  if (t.matches('[data-fresh]')) { openStatus(); return; }
  if (t.matches('[data-theme-toggle]')) { cycleTheme(); return; }
  if (t.matches('[data-sort]')) {
    const [id, key] = t.dataset.sort.split('|');
    const cur = sorts[id];
    sorts[id] = cur && cur.key === key ? { key, desc: !cur.desc } : { key, desc: true };
    render();
  }
});
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') closeSheet();
  if ((e.key === 'Enter' || e.key === ' ') && e.target.matches('[role="button"]')) { e.preventDefault(); e.target.click(); }
});
document.addEventListener('change', (e) => {
  const t = e.target;
  if (t.matches('[data-set-select]')) set({ [t.dataset.setSelect]: t.value });
  if (t.id === 'from' || t.id === 'to') { if (t.validity.valid && t.value) set({ range: 'custom', [t.id]: t.value }); }
});
document.addEventListener('input', debounce((e) => {
  const t = e.target;
  if (!t.matches('[data-search]')) return;
  const q = t.value.trim().toLowerCase();
  const sel = t.dataset.searchItems || 'tbody tr';   // a table's rows by default; data-search-items for any other list of cards
  document.querySelectorAll(`#${t.dataset.search} ${sel}`).forEach((el) => {
    el.hidden = q && !el.textContent.toLowerCase().includes(q);
    if (q && !el.hidden) for (let d = el.closest('details'); d; d = d.parentElement?.closest('details')) d.open = true;   // a match in a fold: shown
  });
}, 150));
window.addEventListener('popstate', () => { readHash(); render(); });
window.addEventListener('resize', debounce(() => C.resizeAll(), 150));
// a card folded on a phone (ui.section's `fold`): its open or closed kept for the next visit, its charts sized once open
document.addEventListener('toggle', (e) => {
  const d = e.target;
  if (!d.dataset || !d.dataset.fold) return;
  const folds = load('folds', {}) || {};
  folds[d.dataset.fold] = d.open;
  save('folds', folds);
  if (d.open) requestAnimationFrame(() => C.resizeAll());
}, true);
document.querySelector('#sheet .sheet-close').addEventListener('click', closeSheet);
document.querySelector('#sheet .sheet-backdrop').addEventListener('click', closeSheet);
Tg.on('back_button_pressed', closeSheet);                         // Telegram's back button, shown while a sheet is open

// ------------------------------------------------------------------------------------------------ theme

function applyTheme() {
  const root = document.documentElement;
  if (S.theme === 'light' || S.theme === 'dark') root.dataset.theme = S.theme; else delete root.dataset.theme;
  const label = { system: 'Theme: follows the phone', light: 'Theme: light', dark: 'Theme: dark' }[S.theme];
  document.querySelector('[data-theme-toggle]').setAttribute('aria-label', label);
  document.querySelector('[data-theme-toggle]').title = label;
  Tg.colours();
}
function cycleTheme() {
  const next = { system: 'dark', dark: 'light', light: 'system' }[S.theme] || 'system';
  set({ theme: next }, { quiet: true });
  applyTheme();
  render();
}
matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => { if (S.theme === 'system') render(); });

// ------------------------------------------------------------------------------------------------ data and freshness

async function start() {
  Tg.ready();
  readHash();
  applyTheme();
  version = await fetchVersion();
  if (!loadedApp) loadedApp = version?.app || null;
  const got = await fetchFeed(version);
  if (got.need === 'key') { showLock(got.error); return; }
  if (got.error) { document.getElementById('view').innerHTML = `<p class="empty">${esc(got.error)}</p>`; return; }
  if (got.version) version = got.version;
  D = prepare(got.feed);
  Live.useNames(D.feed.espn);
  Live.useRule(D.feed.live_rule);
  Chat.setEnv(chatEnv());
  Chat.mount({ go });
  Today.setBot(D.feed.bot);
  if (!visitBase) visitBase = load('seen', null);                 // what this phone had seen before this visit
  document.getElementById('lock').hidden = true;
  render();
  pollLive();
  setTimeout(markSeen, 8000);
  if (timersOn) return;
  timersOn = true;
  setInterval(() => { if (!document.hidden) refresh(false); }, 120e3);
  setInterval(renderFresh, 30e3);
  setInterval(() => { if (!document.hidden && S.liveOn) pollLive(); }, 75e3);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) { refresh(false); pollLive(); } else markSeen(); });
}
let timersOn = false;

// what the chat answers from: the same data, the day as it is when asked, what this phone saw last, the live counts, the view
function chatEnv() {
  return { D, get today() { return greekDay(); }, since: sinceLastVisit, liveState: Live.state, viewRows: () => scope(), S, go };
}

// ------------------------------------------------------------------------------------------------ since the last visit

let visitBase = null;
const settledKey = (r) => `${r.day}|${r.match}|${r.bet}`;
function markSeen() {
  if (!D) return;
  save('seen', { at: new Date().toISOString(), settled: D.bets.filter((r) => r.set === 'paper' && r.sport === 'football' && r.settled).map(settledKey),
    picks: D.today.map((p) => p.key) });
}
// what changed since this phone last looked: football's paper bets settled since, and the picks it had not seen
export function sinceLastVisit() {
  if (!D || !visitBase || !Array.isArray(visitBase.settled)) return null;
  const was = new Set(visitBase.settled), seenPicks = new Set(visitBase.picks || []);
  const settled = D.bets.filter((r) => r.set === 'paper' && r.sport === 'football' && r.settled && !was.has(settledKey(r)));
  const picks = D.today.filter((p) => !seenPicks.has(p.key) && p.kickAt && p.kickAt.getTime() > Date.now());
  return { at: visitBase.at, settled, picks, won: settled.filter((r) => r.w).length, profit: settled.reduce((s, r) => s + (r.profit || 0), 0) };
}
ctx.since = sinceLastVisit;

async function refresh(loud) {
  const v = await fetchVersion();
  if (v && loadedApp && v.app && v.app !== loadedApp && navigator.serviceWorker?.getRegistration) {   // a new page was published: fetch it
    navigator.serviceWorker.getRegistration().then((r) => r && r.update()).catch(() => {});
  }
  if (!v || (version && v.hash === version.hash)) { if (loud) toast(v ? 'Nothing new yet' : 'Could not reach the board'); renderFresh(); return; }
  const got = await fetchFeed(v);
  if (!got.feed) return;
  const before = D ? D.today.length : 0;
  version = got.version || v;
  D = prepare(got.feed);
  Live.useNames(D.feed.espn);
  Live.useRule(D.feed.live_rule);
  Chat.setEnv(chatEnv());
  Today.setBot(D.feed.bot);
  const y = window.scrollY;
  render();
  requestAnimationFrame(() => window.scrollTo(0, y));
  const diff = D.today.length - before;
  toast(diff > 0 ? `Updated: ${diff} new pick${diff > 1 ? 's' : ''}` : 'Updated');
}

async function pollLive() {
  if (!D) return;
  try {
    const changed = await Live.poll(D.today, D.live?.lines || []);
    if (changed && S.tab === 'today' && document.getElementById('sheet').hidden) {
      const y = window.scrollY;
      render();
      requestAnimationFrame(() => window.scrollTo(0, y));
    }
  } catch (e) { console.warn('live', e); }
}

function showLock(error) {
  const lock = document.getElementById('lock');
  lock.hidden = false;
  lock.querySelector('.lock-error').textContent = error || '';
  lock.querySelector('form').onsubmit = (e) => {
    e.preventDefault();
    const v = lock.querySelector('input').value.trim();
    const m = v.match(/k=([A-Za-z0-9_-]{20,})/);
    setKey(m ? m[1] : v);
    start();
  };
}

onChange(render);
start();

// a new version of the page reaches this phone on this visit, not the next (18 Oct 2026: the builders' leg tags were missing
// until a second reload): when the new service worker takes over, reload at once in the first seconds or while hidden,
// otherwise the next time the board is opened
const OPENED = Date.now();
if ('serviceWorker' in navigator && location.protocol === 'https:') {
  const had = !!navigator.serviceWorker.controller;
  let pending = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!had || pending) return;
    pending = true;
    if (document.hidden || Date.now() - OPENED < 15000) { location.reload(); return; }
    toast('The board was updated: it reloads the next time you open it');
    document.addEventListener('visibilitychange', () => { if (!document.hidden) location.reload(); });
  });
  navigator.serviceWorker.register('sw.js').catch(() => {});
}
