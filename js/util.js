// Small helpers shared by every view: escaping, number and time formats, storage, clipboard.

export const TZ = 'Europe/Athens';

export function esc(v) {
  if (v === null || v === undefined) return '';
  return String(v).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

export const isNum = (v) => typeof v === 'number' && Number.isFinite(v);

// money on paper is pounds, real tickets are euros: the caller names the currency
export function money(v, cur = '£', dp = 0, sign = true) {
  if (!isNum(v)) return '–';
  const a = Math.abs(v).toLocaleString('en-GB', { minimumFractionDigits: dp, maximumFractionDigits: dp });
  const s = v < 0 ? '−' : sign && v > 0 ? '+' : '';
  return `${s}${cur}${a}`;
}
export const plainMoney = (v, cur = '£', dp = 0) => money(v, cur, dp, false);

export function pct(v, dp = 0, sign = false) {
  if (!isNum(v)) return '–';
  const x = v * 100;
  const s = x < 0 ? '−' : sign && x > 0 ? '+' : '';
  return `${s}${Math.abs(x).toFixed(dp)}%`;
}
export const spct = (v, dp = 0) => pct(v, dp, true);
export function pp(v, dp = 0) {          // percentage points, signed
  if (!isNum(v)) return '–';
  const x = v * 100;
  return `${x < 0 ? '−' : x > 0 ? '+' : ''}${Math.abs(x).toFixed(dp)} pts`;
}
export const odds = (v) => (isNum(v) ? v.toFixed(2) : '–');
export const int = (v) => (isNum(v) ? Math.round(v).toLocaleString('en-GB') : '–');
export function num(v, dp = 1) {
  if (!isNum(v)) return '–';
  return Number.isInteger(v) && dp <= 1 ? String(v) : v.toFixed(dp);
}

// ---------------------------------------------------------------- time: the record keeps Greek wall time, "YYYY-MM-DD HH:MM"

const partsFmt = new Intl.DateTimeFormat('en-GB', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
function athensParts(d) {
  const p = Object.fromEntries(partsFmt.formatToParts(d).map((x) => [x.type, x.value]));
  return { y: +p.year, m: +p.month, d: +p.day, h: +p.hour, mi: +p.minute };
}
// a Greek wall time as an instant
export function fromGreek(s) {
  if (!s || typeof s !== 'string') return null;
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2}))?/);
  if (!m) return null;
  const want = Date.UTC(+m[1], +m[2] - 1, +m[3], +(m[4] || 0), +(m[5] || 0));
  let t = want - 3 * 3600e3;
  for (let i = 0; i < 3; i++) {
    const p = athensParts(new Date(t));
    const got = Date.UTC(p.y, p.m - 1, p.d, p.h, p.mi);
    t += want - got;
  }
  return new Date(t);
}
export function greekDay(d = new Date()) {
  const p = athensParts(d);
  return `${p.y}-${String(p.m).padStart(2, '0')}-${String(p.d).padStart(2, '0')}`;
}
export function greekHM(d) {
  const p = athensParts(d);
  return `${String(p.h).padStart(2, '0')}:${String(p.mi).padStart(2, '0')}`;
}
// ---------------------------------------------------------------- what the user sees: UK time (the user, 30 Oct 2026: "all UK time -
// I am in the UK"). The record keeps Greek wall time and Greek days (the staking day, the day cap); only the display turns to the
// UK, Europe/London's own rules taking care of BST and GMT. Label it once ("All times UK"), not beside each time.
export const TZ_SHOW = 'Europe/London';
const ukFmt = new Intl.DateTimeFormat('en-GB', { timeZone: TZ_SHOW, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
function ukParts(d) {
  const p = Object.fromEntries(ukFmt.formatToParts(d).map((x) => [x.type, x.value]));
  return { y: p.year, m: p.month, d: p.day, h: p.hour, mi: p.minute };
}
// a moment from what the views hold: a Date, milliseconds, a stamp with its zone ("...Z", "+01:00"), or the record's Greek wall
// time ("YYYY-MM-DD HH:MM", no zone). A day alone ("YYYY-MM-DD") is a date, not a moment: null.
export function instant(x) {
  if (x instanceof Date) return Number.isNaN(x.getTime()) ? null : x;
  if (typeof x === 'number') return Number.isFinite(x) ? new Date(x) : null;
  if (typeof x !== 'string' || !/^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}/.test(x.trim())) return null;
  const s = x.trim();
  if (/(?:[zZ]|[+-]\d{2}:?\d{2})$/.test(s)) { const t = Date.parse(s.replace(' ', 'T')); return Number.isNaN(t) ? null : new Date(t); }
  return fromGreek(s);
}
export function ukDay(x) {                  // "YYYY-MM-DD", the UK date of a moment; a day alone comes back as it is
  const d = instant(x);
  if (!d) return typeof x === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(x) ? x : null;
  const p = ukParts(d);
  return `${p.y}-${p.m}-${p.d}`;
}
export function ukHM(x) {                   // "HH:MM" in the UK, '' when there is no time
  const d = instant(x);
  if (!d) return '';
  const p = ukParts(d);
  return `${p.h}:${p.mi}`;
}
export function ukStamp(x) {                // "YYYY-MM-DD HH:MM" in the UK (a stamp the record keeps in Greek time, shown)
  const d = instant(x);
  return d ? `${ukDay(d)} ${ukHM(d)}` : (x ? String(x) : '');
}
export function ukWhen(x, withDow = true) { // "Fri 30 Oct 14:00" in the UK
  const d = instant(x);
  return d ? `${dayLabel(ukDay(d), withDow)} ${ukHM(d)}` : '–';
}
// where a kick-off's UK date and its Greek staking day differ (from 22:00 UK in winter, 21:00 in summer): the note to show
export function stakeDayNote(x) {
  const d = instant(x);
  if (!d) return '';
  const g = greekDay(d);
  return g !== ukDay(d) ? `the staking day is ${dayLabel(g)} (Greek)` : '';
}
export function addDays(day, n) {
  const [y, m, d] = day.split('-').map(Number);
  const t = new Date(Date.UTC(y, m - 1, d + n));
  return t.toISOString().slice(0, 10);
}
const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
export function dowOf(day) {
  const [y, m, d] = day.split('-').map(Number);
  return DOW[new Date(Date.UTC(y, m - 1, d)).getUTCDay()];
}
export function dayLabel(day, withDow = true) {
  if (!day) return '–';
  const [y, m, d] = day.split('-').map(Number);
  return `${withDow ? dowOf(day) + ' ' : ''}${d} ${MON[m - 1]}`;
}
export function weekStart(day) {           // Monday of the day's week
  const [y, m, d] = day.split('-').map(Number);
  const t = new Date(Date.UTC(y, m - 1, d));
  const back = (t.getUTCDay() + 6) % 7;
  t.setUTCDate(t.getUTCDate() - back);
  return t.toISOString().slice(0, 10);
}
export function ago(ms) {
  const m = Math.round(ms / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m} min ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} h ${m % 60 ? (m % 60) + ' min ' : ''}ago`;
  const d = Math.floor(h / 24);
  return `${d} day${d > 1 ? 's' : ''} ago`;
}
export function until(ms) {
  if (ms <= 0) return 'started';
  const m = Math.round(ms / 60000);
  if (m < 60) return `in ${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `in ${h}h${m % 60 ? ' ' + String(m % 60).padStart(2, '0') + 'm' : ''}`;
  return `in ${Math.floor(h / 24)}d ${h % 24}h`;
}

// ---------------------------------------------------------------- storage and clipboard: conveniences only, never required

export function load(key, fallback) {
  try {
    const v = localStorage.getItem('bb.' + key);
    return v === null ? fallback : JSON.parse(v);
  } catch { return fallback; }
}
export function save(key, value) {
  try { localStorage.setItem('bb.' + key, JSON.stringify(value)); } catch { /* storage off: fine */ }
}

export async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    try {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.setAttribute('readonly', '');
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand('copy');
      ta.remove();
      return ok;
    } catch { return false; }
  }
}

export function debounce(fn, ms) {
  let t;
  return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); };
}

export function uniq(a) { return [...new Set(a)]; }
export function sum(a, f = (x) => x) { let s = 0; for (const x of a) { const v = f(x); if (isNum(v)) s += v; } return s; }
export function mean(a, f = (x) => x) { let s = 0, n = 0; for (const x of a) { const v = f(x); if (isNum(v)) { s += v; n++; } } return n ? s / n : null; }
export function by(f, desc = false) { return (a, b) => { const x = f(a), y = f(b); const r = x < y ? -1 : x > y ? 1 : 0; return desc ? -r : r; }; }
export const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

// a report written in markdown (the evenings' evaluations, reports/evaluation_<day>.md) as safe HTML: everything escaped
// first, then headings, paragraphs, lists, tables (the board's .tbl), **bold** and `code`
export function md(text) {
  const inline = (s) => esc(s).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>').replace(/`([^`]+)`/g, '<code>$1</code>');
  const out = [];
  let para = [], list = null, tbl = null;
  const flush = () => {
    if (para.length) { out.push(`<p>${inline(para.join(' '))}</p>`); para = []; }
    if (list) { out.push(`<${list.tag}>${list.items.map((x) => `<li>${inline(x)}</li>`).join('')}</${list.tag}>`); list = null; }
    if (tbl) {
      const [head, ...body] = tbl;
      out.push(`<div class="tbl-wrap"><table class="tbl dense md-tbl"><thead><tr>${head.map((c) => `<th><span>${inline(c)}</span></th>`).join('')}</tr></thead>`
        + `<tbody>${body.map((r) => `<tr>${r.map((c) => `<td class="wrap">${inline(c)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`);
      tbl = null;
    }
  };
  for (const raw of String(text || '').split(/\r?\n/)) {
    const line = raw.trimEnd();
    const h = /^(#{1,4})\s+(.*)$/.exec(line);
    const li = /^\s*(?:[-*]|(\d+)\.)\s+(.*)$/.exec(line);
    if (!line.trim()) { flush(); continue; }
    if (h) { flush(); out.push(`<h${Math.min(h[1].length + 2, 5)} class="md-h">${inline(h[2])}</h${Math.min(h[1].length + 2, 5)}>`); continue; }
    if (line.startsWith('|')) {
      if (!tbl) { flush(); tbl = []; }
      const cells = line.replace(/^\||\|$/g, '').split('|').map((c) => c.trim());
      if (!cells.every((c) => /^:?-{2,}:?$/.test(c))) tbl.push(cells);
      continue;
    }
    if (li) {
      const tag = li[1] ? 'ol' : 'ul';
      if (para.length || tbl || (list && list.tag !== tag)) flush();
      if (!list) list = { tag, items: [] };
      list.items.push(li[2]);
      continue;
    }
    if (list && /^\s{2,}\S/.test(raw)) { list.items[list.items.length - 1] += ' ' + line.trim(); continue; }   // a wrapped list item
    if (tbl) flush();
    if (list) flush();
    para.push(line.trim());
  }
  flush();
  return out.join('');
}
