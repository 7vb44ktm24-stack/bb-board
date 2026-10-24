// The pieces every view is built from. Every value that names a person, a match or a line comes from the data and is
// escaped. Anything tappable carries data-go (open a view), data-bet / data-match (open a sheet) or data-copy.

import { esc, money, pct, spct, odds, int, isNum, load } from './util.js';
import { compName } from './data.js';
import { backButton } from './tg.js';

export const BOOK_SHORT = { Stoiximan: 'Stoiximan', Superbet: 'Superbet', Pamestoixima: 'Pame', Novibet: 'Novibet', bet365: 'bet365' };
const BOOK_CLASS = { Stoiximan: 'stx', Superbet: 'sb', Pamestoixima: 'pame', Novibet: 'novi', bet365: 'b365' };

export function goAttr(target) { return `data-go="${esc(JSON.stringify(target))}"`; }

export function bookChip(book, { go } = {}) {
  if (!book) return '';
  const cls = BOOK_CLASS[book] || 'other';
  return `<span class="bk bk-${cls}"${go ? ' ' + goAttr(go) + ' role="button" tabindex="0"' : ''}><i aria-hidden="true"></i>${esc(BOOK_SHORT[book] || book)}</span>`;
}

const STATUS = { won: ['Won', 'won', '✓'], lost: ['Lost', 'lost', '✕'], open: ['Open', 'open', '●'], 'in play': ['In play', 'play', '◔'], void: ['Void', 'void', '○'] };
export function statusTag(s) {
  const [label, cls, icon] = STATUS[s] || [s || '–', 'open', '●'];
  return `<span class="st st-${cls}"><span aria-hidden="true">${icon}</span>${esc(label)}</span>`;
}

const VERDICT_CLASS = { ahead: 'v-ahead', 'leaning ahead': 'v-lean-up', 'too early': 'v-early', 'leaning behind': 'v-lean-down', behind: 'v-behind', 'too few': 'v-few' };
export function verdictPill(v, more) {
  if (!v) return '';
  const tip = isNum(more) && more > 0 ? ` title="About ${more} more settled bets at this rate to know"` : '';
  return `<span class="vp ${VERDICT_CLASS[v] || 'v-few'}"${tip}>${esc(v)}</span>`;
}

export function confPill(c) {
  if (!c || c === 'not recorded' || c === 'bet builder') return '';
  const n = c === 'High' ? 3 : c === 'Medium' ? 2 : c === 'Low' ? 1 : 0;
  const bars = [1, 2, 3].map((i) => `<i class="${i <= n ? 'on' : ''}"></i>`).join('');
  return `<span class="cf" title="Confidence: how much data stands behind the number"><span class="cf-bars" aria-hidden="true">${bars}</span>${esc(c)}</span>`;
}

export function signClass(v) { return !isNum(v) ? '' : v > 0 ? 'pos' : v < 0 ? 'neg' : ''; }

export function tile({ label, value, sub, cls = '', go, id, spark }) {
  return `<div class="tile ${cls}"${go ? ' ' + goAttr(go) + ' role="button" tabindex="0"' : ''}${id ? ` id="${id}"` : ''}>
    <div class="tile-label">${esc(label)}</div>
    <div class="tile-value">${value}</div>
    ${sub ? `<div class="tile-sub">${sub}</div>` : ''}
    ${spark ? `<div class="tile-spark" id="${spark}"></div>` : ''}
  </div>`;
}

// a record's headline line: "+£682 on £3,819 (+17.9%), luck ±9.9%: leaning ahead"
export function recordLine(g, cur = '£') {
  if (!g || !g.n) return '<span class="muted">Nothing settled in this view yet.</span>';
  return `<b class="${signClass(g.profit)}">${money(g.profit, cur)}</b> on ${money(g.staked, cur, 0, false)} staked
    (<b class="${signClass(g.ret)}">${spct(g.ret, 1)}</b>, luck alone ±${pct(g.luck)}) ${verdictPill(g.verdict, g.more)}
    <span class="muted">· ${g.n} settled, ${g.won} won (${pct(g.wonPct)} where the prices needed ${pct(g.needed)}, we said ${pct(g.said)})</span>`;
}

// a sortable table; cols: [{key, label, fmt(v,row) -> html, num: true, cls}], rows: objects; rowGo(row) -> target or null;
// foot: one more row under them, never sorted in (the totals, the user's ask of 19 Oct 2026)
export function table({ id, cols, rows, rowGo, rowBet, sort, empty = 'Nothing here for these filters.', max = 400, dense = false, foot = null }) {
  if (!rows.length) return `<p class="empty">${esc(empty)}</p>`;
  let list = rows;
  if (sort && sort.key) {
    const c = cols.find((x) => x.key === sort.key);
    const get = c && c.sortVal ? c.sortVal : (r) => r[sort.key];
    list = [...rows].sort((a, b) => { const x = get(a), y = get(b); const r = (x === null || x === undefined) - (y === null || y === undefined) || (x < y ? -1 : x > y ? 1 : 0); return sort.desc ? -r : r; });
  }
  const head = cols.map((c) => `<th class="${c.num ? 'n' : ''} ${c.cls || ''}" data-sort="${esc(id)}|${esc(c.key)}" aria-sort="${sort && sort.key === c.key ? (sort.desc ? 'descending' : 'ascending') : 'none'}"><button type="button">${esc(c.label)}${sort && sort.key === c.key ? (sort.desc ? ' ↓' : ' ↑') : ''}</button></th>`).join('');
  const body = list.slice(0, max).map((r) => {
    const g = rowGo ? rowGo(r) : null;
    const attrs = g ? ` ${goAttr(g)} class="tap"` : rowBet ? ` data-bet="${esc(rowBet(r))}" class="tap"` : '';
    return `<tr${attrs}>${cols.map((c) => `<td class="${c.num ? 'n' : ''} ${c.cls || ''}">${c.fmt ? c.fmt(r[c.key], r) : esc(r[c.key] ?? '–')}</td>`).join('')}</tr>`;
  }).join('');
  const more = list.length > max ? `<p class="muted small">Showing the first ${max} of ${list.length}.</p>` : '';
  const tfoot = foot ? `<tfoot><tr class="total">${cols.map((c) => `<td class="${c.num ? 'n' : ''} ${c.cls || ''}">${c.fmt ? c.fmt(foot[c.key], foot) : esc(foot[c.key] ?? '–')}</td>`).join('')}</tr></tfoot>` : '';
  return `<div class="tbl-wrap"><table class="tbl${dense ? ' dense' : ''}" id="${esc(id)}"><thead><tr>${head}</tr></thead><tbody>${body}</tbody>${tfoot}</table></div>${more}`;
}

// the standard columns of a cut: label, bets, won, won %, needed, said, staked, profit, return, luck, verdict
export function cutCols(label, { cur = '£', dim } = {}) {
  return [
    { key: 'key', label, fmt: (v) => `<span class="cut-key">${esc(dim === 'comp' ? compName(v) : v)}</span>` },
    { key: 'n', label: 'Settled', num: true, fmt: (v) => int(v) },
    { key: 'won', label: 'Won', num: true, fmt: (v) => int(v) },
    { key: 'wonPct', label: 'Won %', num: true, fmt: (v) => pct(v) },
    { key: 'needed', label: 'Needed', num: true, fmt: (v) => pct(v) },
    { key: 'said', label: 'We said', num: true, fmt: (v) => pct(v) },
    { key: 'staked', label: 'Staked', num: true, fmt: (v) => money(v, cur, 0, false) },
    { key: 'profit', label: 'Profit', num: true, fmt: (v) => `<span class="${signClass(v)}">${money(v, cur)}</span>` },
    { key: 'ret', label: 'Return', num: true, fmt: (v) => `<b class="${signClass(v)}">${spct(v)}</b>` },
    { key: 'luck', label: 'Luck ±', num: true, fmt: (v) => (isNum(v) ? '±' + pct(v) : '–') },
    { key: 'verdict', label: 'Reading', fmt: (v, r) => verdictPill(v, r.more), sortVal: (r) => r.z ?? -99 },
    { key: 'open', label: 'Open', num: true, fmt: (v) => int(v) },
  ];
}

// a bet as one line of a list
export function betLine(r, { showDay = true } = {}) {
  return `<button type="button" class="bet-line" data-bet="${esc(r.id)}">
    <span class="bl-main"><span class="bl-bet">${esc(String(r.bet || '–').replace(/\s+at\s+\S+$/, ''))}</span><span class="bl-match muted">${esc(r.match || '')}${showDay && r.day ? ' · ' + esc(r.day.slice(5)) : ''}</span></span>
    <span class="bl-side">${bookChip(r.book)}<span class="bl-price">${odds(r.price)}</span>${statusTag(r.status)}<span class="${signClass(r.profit)} bl-profit">${isNum(r.profit) ? money(r.profit, '£', 2) : ''}</span></span>
  </button>`;
}

// ------------------------------------------------------------------------------------------------ the sheet and the toast

let sheetCleanup = null;
export function openSheet(title, body, onMount) {
  const root = document.getElementById('sheet');
  root.querySelector('.sheet-title').textContent = title;
  root.querySelector('.sheet-body').innerHTML = body;
  root.hidden = false;
  document.body.classList.add('sheet-open');
  backButton(true);
  requestAnimationFrame(() => root.classList.add('open'));
  if (sheetCleanup) sheetCleanup();
  sheetCleanup = onMount ? onMount(root.querySelector('.sheet-body')) || null : null;
  root.querySelector('.sheet-close').focus({ preventScroll: true });
}
export function closeSheet() {
  const root = document.getElementById('sheet');
  if (root.hidden) return;
  backButton(false);
  root.classList.remove('open');
  document.body.classList.remove('sheet-open');
  if (sheetCleanup) { sheetCleanup(); sheetCleanup = null; }
  setTimeout(() => { root.hidden = true; root.querySelector('.sheet-body').innerHTML = ''; }, 200);
}

let toastTimer;
export function toast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.hidden = false;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { t.classList.remove('show'); setTimeout(() => { t.hidden = true; }, 250); }, 2600);
}

// `fold`: on a phone the card is a fold, closed until opened and then remembered (main.js's toggle listener keeps 'folds'); a long
// page reads as its headings (23 Oct 2026: Today ran about 10,000 px on a phone). On a wider screen, a plain card
const isPhone = () => { try { return window.matchMedia('(max-width: 600px)').matches; } catch { return false; } };
export function section(title, body, { sub, id, actions = '', fold = null } = {}) {
  const head = `<div><h2>${esc(title)}</h2>${sub ? `<p class="card-sub">${sub}</p>` : ''}</div>${actions}`;
  if (fold && isPhone()) {
    const open = (load('folds', {}) || {})[fold] === true;
    return `<section class="card card-fold"${id ? ` id="${id}"` : ''}><details data-fold="${esc(fold)}"${open ? ' open' : ''}>
      <summary class="card-head">${head}</summary>
      ${body}
    </details></section>`;
  }
  return `<section class="card"${id ? ` id="${id}"` : ''}>
    <header class="card-head">${head}</header>
    ${body}
  </section>`;
}

export function chips(name, options, value, { small = false } = {}) {
  return `<div class="seg${small ? ' seg-sm' : ''}" role="group">${options.map((o) => `<button type="button" class="${o.id === value ? 'on' : ''}" data-set="${esc(name)}" data-value="${esc(o.id)}" aria-pressed="${o.id === value}">${esc(o.label)}</button>`).join('')}</div>`;
}

export function select(name, options, value, label) {
  return `<label class="sel"><span>${esc(label)}</span><select data-set-select="${esc(name)}">${options.map((o) => `<option value="${esc(o.id)}"${o.id === value ? ' selected' : ''}>${esc(o.label)}</option>`).join('')}</select></label>`;
}
