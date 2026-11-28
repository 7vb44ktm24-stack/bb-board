// "All sports" on the record tabs (the user's yes of 29 Oct 2026, through the orchestrator): every sport side by side, each with
// its own totals, never added together. A sport's sets are its own records (the board's rule), so nothing here ever sums two
// sports: each table is one sport's, cut one way, and its total row is that sport's alone. The date range applies; the filters
// don't, since each sport cuts its own way (a football stat filter would empty basketball).
import { esc, money, pct, spct } from '../util.js';
import { section, table, cutCols, tile, signClass, verdictPill } from '../ui.js';
import { agg, group } from '../metrics.js';
import { SETS, SPORTS, DIM, NEVER_SUMMED } from '../state.js';

const btn = (k, v, label, on) => `<button type="button" class="${on ? 'on' : ''}" data-set="${k}" data-value="${v}" aria-pressed="${on}">${esc(label)}</button>`;

// the sport switch with "All sports" beside the sports (choosing a sport switches All off: main.js's chip handler)
export function sportChips(S) {
  return `<div class="seg seg-sm" role="group">${SPORTS.map((o) => btn('sport', o.id, o.label, !S.allSports && o.id === S.sport)).join('')}${
    btn('allSports', 'true', 'All sports', !!S.allSports)}</div>`;
}

// each sport's paper picks in this range as a tile, side by side (moved here from Results, 29 Oct 2026)
export function sportsTiles(ctx, { fold = null } = {}) {                    // fold: folded on every screen (Results, 30 Oct 2026)
  return section('The sports side by side', `<div class="tiles tiles-3">${SPORTS.map((sp) => {
    const x = agg(ctx.scope({ sport: sp.id, set: 'paper', ignoreFilters: !!ctx.S.allSports }));
    return tile({ label: sp.label, value: `<span class="${signClass(x.profit)}">${x.n ? money(x.profit) : '–'}</span>`, sub: x.n ? `${spct(x.ret)} on ${x.n} · ${x.won} won (${pct(x.wonPct)}, needed ${pct(x.needed)}) · ±${pct(x.luck)} ${verdictPill(x.verdict)}` : 'none settled', go: { sport: sp.id, set: 'paper', allSports: false } });
  }).join('')}</div>`, { fold, wide: !!fold, sub: 'Each sport’s paper picks in this range, side by side to compare: each keeps its own bank, never added together.' });
}

// per sport one table: cut by `dim` in the sport's headline set, with that sport's own total row; or (bySet) each of the sport's
// sets as a row with no total at all, since a sport's sets hold the same selections more than once
export function allSportsView(ctx, { dim = 'stat', title, sub, bySet = false }) {
  const blocks = SPORTS.map((sp) => {
    const sets = SETS[sp.id] || [];
    const head = (what) => `<h3 class="sheet-h">${esc(sp.label)}${what ? ` <span class="muted small">${esc(what)}</span>` : ''}</h3>`;
    if (bySet) {
      const rows = sets.filter((s) => !NEVER_SUMMED.has(s.id))
        .map((s) => ({ key: s.label, ...agg(ctx.scope({ sport: sp.id, set: s.id, ignoreFilters: true })) })).filter((r) => r.bets);
      return `<div class="sport-block">${head('each set its own record, none added to another')}${rows.length
        ? table({ id: `t-all-${sp.id}`, cols: cutCols('Set'), rows }) : '<p class="muted small">Nothing in this range.</p>'}</div>`;
    }
    const set = sets[0];
    const rows = ctx.scope({ sport: sp.id, set: set?.id, ignoreFilters: true });
    if (!rows.length) return `<div class="sport-block">${head(set?.label)}<p class="muted small">Nothing in this range.</p></div>`;
    return `<div class="sport-block">${head(set?.label)}${table({ id: `t-all-${sp.id}`, cols: cutCols(DIM[dim]?.label || 'Cut', { dim }),
      rows: group(rows, dim), foot: { key: `All ${sp.label.toLowerCase()}`, ...agg(rows) } })}</div>`;
  });
  return section(title, blocks.join(''), { sub });
}
