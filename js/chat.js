// The chat (the user's ask of 18 Oct 2026: the board "more conversational"). A button on every tab opens it; the board
// speaks first (what changed since this phone last looked, today, the week, the record), then answers what is typed or
// tapped (ask.js), each answer with its chart, a button to the view behind it and the next questions to tap. What it cannot
// answer goes to Claude with the numbers: copied, and Claude opened with the question filled in. The thread is kept on this
// phone (the last 40 messages, without their charts).

import { esc, load, save, copyText } from './util.js';
import * as Ask from './ask.js';
import * as C from './charts.js';
import * as Tg from './tg.js';
import { running } from './metrics.js';
import { dailyPoints, daysOf, ORDINAL } from './trends.js';
import { toast } from './ui.js';
import { compName } from './data.js';

const KEEP = 40;                       // messages kept on this phone
const BRIEF_AFTER = 3 * 3600e3;        // a new opening note when the last is this old, or the data changed since
let env = null, V = null, vocabOf = null, prevQ = null, root = null, specs = new Map(), seq = 0;

export function setEnv(e) {
  env = e;
  if (vocabOf !== e.D.feed) { V = Ask.vocab(e.D); vocabOf = e.D.feed; }
}
export const isOpen = () => !!root && !root.hidden;

function thread() { const t = load('chat', []); return Array.isArray(t) ? t : []; }
function keep(msgs) { save('chat', msgs.slice(-KEEP)); }
function uid() { return `m${Date.now().toString(36)}${(seq++).toString(36)}`; }

// ------------------------------------------------------------------------------------------------ drawing

function bubble(m) {
  if (m.who === 'me') return `<div class="msg me"><p>${esc(m.text)}</p></div>`;
  const chart = specs.has(m.id) ? `<div class="chat-chart" id="cc-${m.id}"></div>` : '';
  const acts = [m.go ? `<button type="button" class="btn-soft" data-chat-go="${esc(JSON.stringify(m.go))}">${esc(m.goLabel || 'Open')}</button>` : '',
    m.betId ? `<button type="button" class="btn-soft" data-bet="${esc(m.betId)}">The bet</button>` : '',
    m.claude ? `<button type="button" class="btn-soft${m.unknown ? ' btn-strong' : ''}" data-chat-claude="${esc(m.id)}">Ask Claude</button>` : ''].join('');
  return `<div class="msg board">${m.html}${chart}${acts ? `<div class="msg-actions">${acts}</div>` : ''}</div>`;
}

function render(scrollEnd = true) {
  const msgs = thread();
  const box = root.querySelector('.chat-thread');
  C.disposeIn(box);
  box.innerHTML = msgs.map(bubble).join('') || '';
  const last = [...msgs].reverse().find((m) => m.who === 'board');
  const chips = (last && last.chips && last.chips.length ? last.chips : Ask.EXAMPLES.slice(0, 6));
  root.querySelector('.chat-chips').innerHTML = chips.map((c) => `<button type="button" class="chip" data-chat-ask="${esc(c)}">${esc(c)}</button>`).join('');
  requestAnimationFrame(() => {
    for (const [id, spec] of specs) { const el = document.getElementById(`cc-${id}`); if (el) try { drawChart(el, spec); } catch (e) { console.warn('chat chart', e); } }
    if (scrollEnd) box.scrollTop = box.scrollHeight;
  });
}

const atDay = (d) => Date.parse(`${d}T00:00:00Z`);
function drawChart(el, spec) {
  const t = C.tokens();
  el.style.height = spec.kind === 'luck' || spec.kind === 'dumbbell' || spec.kind === 'bars' ? '' : '180px';
  const cols = [t.s1, t.s2, t.s3, t.s4];
  if (spec.kind === 'running') {
    const series = spec.series.map((s, i) => {
      if (spec.ret) {
        const days = daysOf(s.rows);
        return { name: s.name, color: cols[i], pts: dailyPoints(s.rows, days, { measure: 'ret', minN: 3 }).filter((p) => p.value !== null).map((p) => [atDay(p.day), Math.round(p.value * 1e4) / 1e4]) };
      }
      return { name: s.name, color: cols[i], pts: running(s.rows).pts.map((p) => [p.t, Math.round(p.total * 100) / 100]) };
    }).filter((s) => s.pts.length > 1);
    if (series.length) C.runningChart(el, series, { fmt: spec.ret ? C.FMT.pct : C.FMT.gbp, area: series.length === 1, daily: !!spec.ret });
    else el.remove();
  } else if (spec.kind === 'luck') C.luckBars(el, spec.rows);
  else if (spec.kind === 'dumbbell') C.dumbbell(el, spec.rows, { mu: spec.mu });
  else if (spec.kind === 'bars') C.bars(el, spec.rows, { fmt: C.FMT.pct, signed: false });
  else if (spec.kind === 'fan') C.fanChart(el, spec.q);
  else if (spec.kind === 'bank') C.runningChart(el, spec.series.map((s, i) => ({ name: s.name, color: i ? t.s1 : t.muted, pts: s.pts.map((p) => [atDay(p.day), Math.round((p.bank - 1000) * 100) / 100]) })).filter((s) => s.pts.length), { fmt: C.FMT.gbp, area: false, daily: true });
  else if (spec.kind === 'lines') {
    const keys = spec.series.series.map((s) => s.key);
    const ramp = ORDINAL.has(spec.dim) ? C.ordinalColors(keys.length) : C.nominalColors(keys);
    C.runningChart(el, spec.series.series.map((s, i) => ({ name: spec.dim === 'comp' ? compName(s.key) : s.key, color: ramp[i],
      pts: s.pts.filter((p) => p.value !== null).map((p) => [atDay(p.day), Math.round(p.value * 1e4) / 1e4]) })).filter((s) => s.pts.length), { fmt: C.FMT.pct, area: false, daily: true });
  }
}

// ------------------------------------------------------------------------------------------------ talking

function add(m) {
  const msgs = thread();
  msgs.push(m);
  keep(msgs);
}
function boardSays(r, { brief = false } = {}) {
  const id = uid();
  if (r.chart) specs.set(id, r.chart);
  if (specs.size > 6) specs.delete(specs.keys().next().value);       // charts for the last few answers only
  add({ who: 'board', id, html: r.html, go: r.go || null, goLabel: r.goLabel || null, claude: r.claude || null, unknown: !!r.unknown, chips: r.chips || null,
    betId: r.betId || null, at: Date.now(), brief, feed: env?.D?.feed?.built_utc || null });
}

export function ask(text) {
  const q = String(text || '').trim();
  if (!q || !env) return;
  add({ who: 'me', text: q, at: Date.now() });
  const { q: parsed, reply } = Ask.ask(q, env, prevQ, V);
  prevQ = parsed.intent === 'unknown' ? prevQ : parsed;
  boardSays(reply);
  render();
}

function maybeBrief() {
  const msgs = thread();
  const lastBrief = [...msgs].reverse().find((m) => m.brief);
  const built = env?.D?.feed?.built_utc || null;
  if (!lastBrief || Date.now() - lastBrief.at > BRIEF_AFTER || (built && lastBrief.feed !== built && Date.now() - lastBrief.at > 20 * 60e3)) boardSays(Ask.briefing(env), { brief: true });
}

// ------------------------------------------------------------------------------------------------ opening and closing

export function openChat(question) {
  if (!root || !env) return;
  root.hidden = false;
  document.body.classList.add('chat-open');
  Tg.backButton(true);
  fitViewport();
  if (question) ask(question); else { maybeBrief(); render(); }
  requestAnimationFrame(() => root.classList.add('open'));
  if (matchMedia('(pointer: fine)').matches) root.querySelector('textarea').focus({ preventScroll: true });
}
export function closeChat() {
  if (!root || root.hidden) return;
  root.classList.remove('open');
  document.body.classList.remove('chat-open');
  if (document.getElementById('sheet').hidden) Tg.backButton(false);
  C.disposeIn(root);
  setTimeout(() => { root.hidden = true; }, 180);
}

// the panel keeps above the phone's keyboard (iOS shrinks the visual viewport, not the layout one)
function fitViewport() {
  const vv = window.visualViewport;
  if (!root || !vv) return;
  const panel = root.querySelector('.chat-panel');
  panel.style.height = `${vv.height}px`;
  panel.style.transform = `translateY(${vv.offsetTop}px)`;
}

async function toClaude(id) {
  const m = thread().find((x) => x.id === id);
  if (!m || !m.claude) return;
  const ok = await copyText(m.claude);
  const url = `https://claude.ai/new?q=${encodeURIComponent(m.claude.slice(0, 1800))}`;
  if (Tg.inTelegram) Tg.openLink(url); else window.open(url, '_blank', 'noopener');
  toast(ok ? 'Copied for Claude, and Claude is opening: paste it if the box is empty' : 'Claude is opening');
}

export function mount({ go }) {
  if (root) return;
  const fab = document.createElement('button');
  fab.type = 'button';
  fab.className = 'chat-fab';
  fab.setAttribute('aria-label', 'Ask the board');
  fab.dataset.chatOpen = '1';
  fab.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 5.5h14a1.5 1.5 0 0 1 1.5 1.5v8a1.5 1.5 0 0 1-1.5 1.5H10l-4.5 3.5V16.5H5A1.5 1.5 0 0 1 3.5 15V7A1.5 1.5 0 0 1 5 5.5Z"/><path d="M8 9.5h8M8 12.5h5"/></svg>';
  document.body.appendChild(fab);
  root = document.createElement('div');
  root.id = 'chat';
  root.className = 'chat';
  root.hidden = true;
  root.innerHTML = `<div class="chat-panel" role="dialog" aria-modal="true" aria-labelledby="chat-title">
    <header class="chat-head"><h2 id="chat-title">Ask the board</h2><button type="button" class="link small" data-chat-clear="1">Clear</button>
      <button type="button" class="sheet-close" data-chat-close="1" aria-label="Close">✕</button></header>
    <div class="chat-thread" role="log" aria-live="polite"></div>
    <div class="chat-chips" aria-label="Questions to tap"></div>
    <form class="chat-form"><textarea rows="1" placeholder="Ask about the picks…" aria-label="Your question" enterkeyhint="send" autocomplete="off"></textarea>
      <button type="submit" class="chat-send" aria-label="Send"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4.5 12h14M13 6.5l5.5 5.5-5.5 5.5"/></svg></button></form>
  </div>`;
  document.body.appendChild(root);
  const box = root.querySelector('textarea');
  const send = () => { const v = box.value; box.value = ''; box.style.height = ''; ask(v); };
  root.querySelector('form').addEventListener('submit', (e) => { e.preventDefault(); send(); });
  box.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } });
  box.addEventListener('input', () => { box.style.height = ''; box.style.height = `${Math.min(120, box.scrollHeight)}px`; });
  document.addEventListener('click', (e) => {
    const t = e.target.closest('[data-chat-open],[data-chat-ask],[data-chat-close],[data-chat-go],[data-chat-claude],[data-chat-clear]');
    if (!t) return;
    e.preventDefault();
    if (t.matches('[data-chat-open]')) openChat();
    else if (t.matches('[data-chat-ask]')) { if (isOpen()) ask(t.dataset.chatAsk); else openChat(t.dataset.chatAsk); }
    else if (t.matches('[data-chat-close]')) closeChat();
    else if (t.matches('[data-chat-go]')) { closeChat(); go(JSON.parse(t.dataset.chatGo)); }
    else if (t.matches('[data-chat-claude]')) toClaude(t.dataset.chatClaude);
    else if (t.matches('[data-chat-clear]')) { save('chat', []); specs = new Map(); prevQ = null; maybeBrief(); render(); }
  });
  Tg.on('back_button_pressed', () => { if (isOpen() && document.getElementById('sheet').hidden) closeChat(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && isOpen() && document.getElementById('sheet').hidden) closeChat(); });
  if (window.visualViewport) { window.visualViewport.addEventListener('resize', fitViewport); window.visualViewport.addEventListener('scroll', fitViewport); }
  // the charts take the page's colours when drawn: drawn again when the phone or the switch changes light and dark
  const redraw = () => { if (isOpen()) render(false); };
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change', redraw);
  new MutationObserver(redraw).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
}
