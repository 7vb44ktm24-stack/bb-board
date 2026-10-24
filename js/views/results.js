// Results: one set of bets at a time (the paper account first, with first and last shown beside it), its running profit
// and fall from the top, a calendar of days, profit by day / week / month, the sets and the sports side by side, and
// every bet behind the figures.

import { esc, money, pct, spct, odds, int, isNum, dayLabel, md } from '../util.js';
import { tile, recordLine, verdictPill, signClass, section, goAttr, chips, table, cutCols, bookChip, statusTag } from '../ui.js';
import { agg, group, byPeriod, running, byDay, streak } from '../metrics.js';
import { SETS, SPORTS, NEVER_SUMMED } from '../state.js';
import { compName } from '../data.js';
import * as C from '../charts.js';
import { outlookCard } from './lab.js';

// the set's own record (basket.md, tennis.md, kept_back.md, placements.json), checked by the feed: shown on the whole set only
const RECORD_OF = { 'basketball|paper': 'Basketball, shown picks', 'tennis|paper': 'Tennis', 'football|kept': 'Kept back', 'football|placeable': 'As placeable' };
function otherCheck(D, S) {
  const name = RECORD_OF[`${S.sport}|${S.set}`];
  if (!name || S.range !== 'all' || Object.keys(S.f).length || Object.keys(S.x || {}).length) return '';
  const c = (D.feed.reconcile || []).find((x) => x.set === name);
  if (!c) return '';
  return `<p class="check ${c.agree ? 'ok' : 'warn'}">${c.agree ? '✓ Matches its record' : '⚠ Differs from its record'}: ${esc(c.record)} says ${int(c.headline.settled)} settled, ${int(c.headline.won)} won${isNum(c.headline.profit) ? `, ${money(c.headline.profit, '£', 2)}` : ''} on ${money(c.headline.staked, '£', 2, false)}.</p>`;
}

export function render(ctx) {
  const { D, S, scope } = ctx;
  const rows = scope();
  const g = agg(rows);
  const days = byDay(rows);
  const run = running(rows);
  const best = days.filter((d) => d.n).sort((a, b) => b.profit - a.profit)[0];
  const worst = days.filter((d) => d.n).sort((a, b) => a.profit - b.profit)[0];
  const st = streak(days);
  const setDef = (SETS[S.sport] || []).find((x) => x.id === S.set) || {};
  const head = D.feed.headline || {};
  const isHeadline = S.sport === 'football' && S.set === 'paper' && S.range === 'all' && !Object.keys(S.f).length && !Object.keys(S.x || {}).length;
  const hs = head.sets?.['paper account'];
  const agrees = isHeadline && hs ? Math.abs((hs.profit || 0) - g.profit) < 0.02 && hs.settled === g.n : null;

  const controls = `<div class="controls">
    ${chips('sport', SPORTS, S.sport, { small: true })}
    ${chips('set', (SETS[S.sport] || []).map((x) => ({ id: x.id, label: x.label })), S.set, { small: true })}
  </div>
  <p class="set-note muted small">${esc(setDef.note || '')}${NEVER_SUMMED.has(S.set) ? ' <b>Never added up:</b> the sums below count one selection as often as it was shown or logged.' : ''}</p>`;

  const tiles = `<div class="tiles">
    ${tile({ label: 'Profit', value: `<span class="${signClass(g.profit)}">${money(g.profit)}</span>`, sub: `on ${money(g.staked, '£', 0, false)} staked`, spark: 'sp-profit' })}
    ${tile({ label: 'Return', value: `<span class="${signClass(g.ret)}">${spct(g.ret, 1)}</span>`, sub: `luck alone ±${pct(g.luck, 1)} ${verdictPill(g.verdict, g.more)}` })}
    ${tile({ label: 'Won', value: `${int(g.won)}<span class="muted"> of ${int(g.n)}</span>`, sub: `${pct(g.wonPct)} · needed ${pct(g.needed)} · we said ${pct(g.said)}${g.provisional ? `<br><span class="muted">${g.provisional} on ESPN's counts until SofaScore is read</span>` : ''}` })}
    ${tile({ label: 'Open', value: int(g.open), sub: `${money(g.openStake, '£', 0, false)} staked` })}
    ${tile({ label: 'Fall from the top', value: `<span class="${run.ddNow < 0 ? 'neg' : ''}">${money(run.ddNow, '£', 0, true)}</span>`, sub: `worst ${money(run.maxDD)} · top ${money(run.peak)}` })}
    ${tile({ label: 'Days', value: `${days.filter((d) => d.n).length}`, sub: best ? `best ${dayLabel(best.day, false)} ${money(best.profit)} · worst ${dayLabel(worst.day, false)} ${money(worst.profit)}${st.current > 1 ? ` · ${st.current} ${st.sign > 0 ? 'up' : 'down'} days running` : ''}` : 'none settled', go: best ? { tab: 'results', range: 'custom', from: best.day, to: best.day } : null })}
  </div>
  <p class="record-line">${recordLine(g)}</p>
  ${isHeadline && hs ? `<p class="check ${agrees ? 'ok' : 'warn'}">${agrees ? '✓ Matches the record' : '⚠ Differs from the record'}: headline.json says ${money(hs.profit)} on ${money(hs.staked, '£', 0, false)}, ${hs.settled} settled (built ${esc((head.built_utc || '').replace('T', ' ').slice(0, 16))} UTC, results to ${esc(head.results_to || '')}).</p>` : ''}
  ${otherCheck(D, S)}`;

  const cmp = S.sport === 'football' && S.set === 'paper';
  const chart = section('Running profit', `<div class="chart chart-lg" id="ch-run"></div><div class="chart chart-xs" id="ch-dd"></div>`,
    { sub: cmp ? 'The paper account, with the same selections as first shown and as last shown beside it. Below: how far it stands under its own top.' : 'Settled bets in kick-off order. Below: how far it stands under its top.' });

  // where the bank could go from here: a record's own set only (a set that repeats a selection would overstate it)
  const ol = !NEVER_SUMMED.has(S.set) && S.set !== 'live' ? outlookCard(ctx, ctx.scope({ ignoreRange: true })) : { html: '' };

  const cal = section('Day by day', `<div class="chart" id="ch-cal"></div>`, { sub: 'Profit a match day (Greek dates). Tap a day to open it.' });

  const per = section('By period', `${chips('period', [{ id: 'day', label: 'Day' }, { id: 'week', label: 'Week' }, { id: 'month', label: 'Month' }], S.period, { small: true })}<div class="chart" id="ch-period"></div>`);
  const expo = section('Exposure by match day', `<div class="chart" id="ch-expo"></div>`,
    { sub: S.set === 'placeable' ? 'The real-money plan’s amounts a match day, against the 500 day cap.' : 'Stakes a match day in this set, settled and still open. The line is the real-money day cap, for scale: paper stakes are not capped by it.' });

  // the sets side by side, never added together
  let sets = '';
  if (S.sport === 'football') {
    const base = ctx.scope({ set: null });
    const list = SETS.football.filter((x) => !NEVER_SUMMED.has(x.id)).map((x) => ({ key: x.label, id: x.id, ...agg(base.filter((r) => r.set === x.id)) }));
    sets = section('The sets side by side', table({ id: 't-sets', cols: cutCols('Set'), rows: list, rowGo: (r) => ({ set: r.id }), sort: ctx.sortOf('t-sets') }),
      { sub: 'Each its own record, the same range and filters. As placeable is the real-money plan’s amounts; kept back and live are on paper and never in the headline.' });
  }
  const sports = section('The sports side by side', `<div class="tiles tiles-3">${SPORTS.map((sp) => {
    const r = ctx.scope({ sport: sp.id, set: 'paper' });
    const x = agg(r);
    return tile({ label: sp.label, value: `<span class="${signClass(x.profit)}">${x.n ? money(x.profit) : '–'}</span>`, sub: x.n ? `${spct(x.ret)} on ${x.n} · ±${pct(x.luck)} ${verdictPill(x.verdict)}` : 'none settled', go: { sport: sp.id, set: 'paper' } });
  }).join('')}</div>`, { sub: 'Each sport keeps its own bank: never added together.' });

  const kinds = group(rows, 'kind');
  const kind = kinds.length > 1 ? section('By kind of bet', table({ id: 't-kind', cols: cutCols('Kind'), rows: kinds, rowGo: (r) => ({ tab: 'slices', f: { kind: [r.key] }, rows: 'stat', cols: 'book' }), sort: ctx.sortOf('t-kind') })) : '';

  const betCols = [
    { key: 'day', label: 'Day', fmt: (v, r) => `${esc(v ? v.slice(5) : '–')}<span class="muted small"> ${esc(r.kick ? r.kick.slice(11) : '')}</span>` },
    { key: 'bet', label: 'Bet', fmt: (v, r) => `<b>${esc(v)}</b><div class="muted small">${esc(r.match)} · ${esc(compName(r.comp))}</div>` },
    { key: 'book', label: 'At', fmt: (v) => bookChip(v) },
    { key: 'price', label: 'Price', num: true, fmt: (v) => odds(v) },
    { key: 'edge', label: 'Overlay', num: true, fmt: (v) => `<span class="${signClass(v)}">${spct(v)}</span>` },
    { key: 'stake', label: 'Stake', num: true, fmt: (v) => money(v, '£', 2, false) },
    { key: 'actual', label: 'Came to', num: true, fmt: (v) => esc(v ?? '–') },
    { key: 'status', label: 'Result', fmt: (v) => statusTag(v) },
    { key: 'profit', label: 'Profit', num: true, fmt: (v) => `<span class="${signClass(v)}">${isNum(v) ? money(v, '£', 2) : '–'}</span>` },
  ];
  const list = section(`Every bet in this view (${rows.length})`, `<details class="fold" ${rows.length <= 25 ? 'open' : ''}><summary>Show the bets</summary>${table({ id: 't-bets', cols: betCols, rows, rowBet: (r) => r.id, sort: ctx.sortOf('t-bets', { key: 'day', desc: true }) })}</details>`);

  // the evenings' evaluations (reports/evaluation_<day>.md, written by a Claude chat each evening; the bot's /eval reads the same)
  const evals = D.feed.evaluations || [];
  const evaluations = evals.length ? section('Evening evaluations', evals.map((e, i) => {
    const first = (/^\s*#\s+(.+)$/m.exec(e.md) || [])[1] || dayLabel(e.day);
    return `<details class="fold eval"${i === 0 && evals.length === 1 ? ' open' : ''}><summary>${esc(first)} <span class="muted small">written ${esc((e.made || '').slice(5))} GR</span></summary>
      <div class="md">${md(e.md.replace(/^\s*#\s+.+$/m, ''))}</div></details>`;
  }).join(''), { sub: 'How the day went, pick by pick, with the reason each won or lost; basketball, live, the builders and the choices put to you. The newest three.' }) : '';

  const html = controls + tiles + evaluations + chart + ol.html + cal + per + expo + sets + sports + kind + list;
  const mount = () => {
    const series = [{ name: setDef.label || 'This set', pts: run.pts.map((p) => [p.t, Math.round(p.total * 100) / 100, `${p.r.bet} (${p.r.status}, ${money(p.r.profit, '£', 2)})`]) }];
    if (cmp) {
      const t = C.tokens();
      series[0].color = t.s1;
      for (const [id, label, color] of [['first', 'First shown', t.s3], ['last', 'Last shown', t.muted]]) {
        const rr = running(ctx.scope({ set: id }));
        series.push({ name: label, color, pts: rr.pts.map((p) => [p.t, Math.round(p.total * 100) / 100, `${p.r.bet} (${p.r.status})`]) });
      }
    }
    const el = document.getElementById('ch-run');
    if (el) { el.style.height = '260px'; C.runningChart(el, series.filter((s) => s.pts.length), { area: !cmp }); }
    const dd = document.getElementById('ch-dd');
    if (dd && run.pts.length) { dd.style.height = '90px'; C.drawdownChart(dd, run.pts.map((p) => [p.t, Math.round(p.dd * 100) / 100])); }
    const cal = document.getElementById('ch-cal');
    if (cal) C.calendar(cal, days.filter((d) => d.n).map((d) => [d.day, Math.round(d.profit * 100) / 100, d.n]), { onClick: (day) => ctx.go({ tab: 'results', range: 'custom', from: day, to: day }) });
    const pe = document.getElementById('ch-period');
    if (pe) C.bars(pe, byPeriod(rows, S.period).filter((x) => x.n).map((x) => ({ label: S.period === 'day' ? dayLabel(x.key) : S.period === 'week' ? 'w/c ' + dayLabel(x.key, false) : x.key, value: x.profit,
      sub: `${x.won} of ${x.n} won · ${spct(x.ret)} · luck ±${pct(x.luck)}`, key: x.key })), { fmt: C.FMT.gbp, horizontal: false, height: 220,
      onClick: (r) => S.period === 'day' ? ctx.go({ range: 'custom', from: r.key, to: r.key }) : null });
    const ex = document.getElementById('ch-expo');
    if (ex) {
      const m = new Map();
      for (const r of rows) {
        if (!r.day || !isNum(r.stake)) continue;
        const d = m.get(r.day) || { settled: 0, open: 0 };
        if (r.settled) d.settled += r.stake; else if (r.status === 'open' || r.status === 'in play') d.open += r.stake;
        m.set(r.day, d);
      }
      const days = [...m.keys()].sort().slice(-21).map((k) => ({ label: dayLabel(k), day: k, settled: Math.round(m.get(k).settled), open: Math.round(m.get(k).open) }));
      if (days.length) C.exposure(ex, days, { cap: S.sport === 'football' ? 500 : 0, onClick: (p) => { const d = days[p.dataIndex]; if (d) ctx.go({ range: 'custom', from: d.day, to: d.day }); } });
    }
    const sp = document.getElementById('sp-profit');
    if (sp && run.pts.length > 2) { sp.style.height = '34px'; C.spark(sp, run.pts.slice(-40).map((p) => p.total)); }
    if (ol.mount) ol.mount();
  };
  return { html, mount };
}
