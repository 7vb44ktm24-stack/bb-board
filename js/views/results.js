// Results: one set of bets at a time (the paper account first, with first and last shown beside it), its running profit
// and fall from the top, a calendar of days, profit by day / week / month, the sets and the sports side by side, and
// every bet behind the figures.

import { esc, money, pct, spct, odds, int, isNum, num, dayLabel, md, ukDay, ukHM, ukStamp } from '../util.js';
import { tile, recordLine, verdictPill, signClass, section, goAttr, chips, table, cutCols, bookChip, statusTag } from '../ui.js';
import { agg, group, byPeriod, running, byDay, streak } from '../metrics.js';
import { SETS, SPORTS, NEVER_SUMMED } from '../state.js';
import { compName } from '../data.js';
import * as C from '../charts.js';
import { outlookCard } from './lab.js';
import { outletsBrief } from './lines.js';
import { sportChips, sportsTiles, allSportsView } from './allsports.js';

// method changes and their effect (the user, 30 Oct 2026: "need to see effects of overlay rescoring; if better ok, just need to
// be sure"): Rest's logs/change_effects.csv through fm/change_effects.py (the feed's `change_effects`), folded behind its count;
// each change at its newest checkpoint, old against new on the same settled lines, better or worse only beyond two luck bands
const CE_CLASS = { better: 'v-bet', worse: 'v-stop' };
function ceFig(measure, x) {
  if (!isNum(x)) return '–';
  return measure === 'return' ? spct(x) : measure === 'picks' ? String(Math.round(x)) : num(x, 3);
}
function ceMeasure(c) {
  if (c.measure !== 'overall') return c.measure;
  return !c.metric || /profit|return|staked/i.test(c.metric) ? 'return' : 'accuracy';
}
export function changesCard(CE) {
  const ce = CE || {};
  const list = ce.changes || [];
  const body = list.length ? `<div class="lines">${list.map((c) => {
    const m = ceMeasure(c);
    const rows = (c.rows || []).filter((r) => r.band || r.measure);
    return `<details class="early-line"><summary class="bet-line"><span class="bl-main"><span class="bl-bet"><span class="vchip ${CE_CLASS[c.verdict] || 'v-paper'}">${esc(c.verdict)}</span>${esc(c.change)}</span>
        <span class="bl-match muted">${esc(c.changed_on)} · ${esc([c.sport, c.scope, c.side && c.side !== 'all' ? c.side : ''].filter(Boolean).join(', '))} · ${esc(c.checkpoint)}${c.held ? `, ${esc(c.held)}` : ''}</span></span>
        <span class="bl-side small">${ceFig(m, c.old)} → <b>${ceFig(m, c.new)}</b>${isNum(c.luck) ? ` <span class="muted">±${ceFig(m, c.luck).replace('+', '')}</span>` : ''}</span></summary>
      <p class="small">${esc(c.metric || m)}: ${ceFig(m, c.old)} before, ${ceFig(m, c.new)} after${isNum(c.luck) ? ` (luck ±${ceFig(m, c.luck).replace('+', '')} on the difference)` : ''}${isNum(c.n_new) ? `, ${int(c.n_new)} settled` : ''}${c.lines_from ? `; lines ${esc(c.lines_from)} to ${esc(c.lines_to)}` : ''}.${c.note ? ` ${esc(c.note)}` : ''}</p>
      ${rows.length ? `<ul class="plain small">${rows.map((r) => `<li><b>${esc(r.measure)}</b>${r.band && r.band !== 'all' ? ` ${esc(r.band)}` : ''}${r.side && r.side !== 'all' ? ` (${esc(r.side)})` : ''}: ${ceFig(r.measure, r.old)} → ${ceFig(r.measure, r.new)}${isNum(r.luck) ? ` ±${ceFig(r.measure, r.luck).replace('+', '')}` : ''}${isNum(r.n_new) ? `, ${int(r.n_new)}` : ''}${r.verdict ? ` · ${esc(r.verdict)}` : ''}</li>`).join('')}</ul>` : ''}
    </details>`;
  }).join('')}</div>` : `<p class="empty">Nothing measured yet: ${esc(ce.line || 'first results from Rest on Sat 31 Oct')}.</p>`;
  return section(`Method changes: their effect (${ce.line || 'first results from Rest on Sat 31 Oct'})`, body, {
    fold: 'results.changes', wide: true, id: 'changes',
    sub: 'Every method change since 16 Oct that moved overlays, old against new on the same settled lines, at its newest check (first, 2 weeks, 4 weeks). Better or worse only beyond two luck bands of the difference; under 30 settled is too early.' });
}

// the review tables' cuts, the same in every sport (eband2: the finer overlay bands, worked out from each bet's own overlay)
export const REVIEW_CUTS = [
  { id: 'eband2', label: 'Overlay', head: 'Overlay band' },
  { id: 'pband', label: 'Price', head: 'Price band' },
  { id: 'side', label: 'Over/under', head: 'Over or under' },
  { id: 'stat', label: 'Stat', head: 'Stat or market' },
  { id: 'book', label: 'Book', head: 'Bookmaker' },        // short: the chips fit a phone's width
  { id: 'comp', label: 'League', head: 'League' },         // the extra leagues side by side (30 Oct 2026)
];

// the NHL pilot before its first pick (feed.nhl_status, board.nhl_status): what has settled, and each bookmaker's Brier score,
// ours against its own (lower is better), so the forecast can be judged before any pick is
export function nhlCard(st) {
  if (!st || !st.lines) return '<p class="empty">The NHL pilot: nothing settled yet. Its games settle each morning in the 09:00 run; paper picks from Tue 3 Nov.</p>';
  const rows = (st.books || []).map((b) => `<tr><td>${esc(b.book)}${b.margin_in ? '<div class="muted small">its margin left in</div>' : ''}</td><td class="n">${int(b.lines)}</td>
    <td class="n">${num(b.ours, 3)}</td><td class="n">${num(b.theirs, 3)}</td><td class="n ${b.ours < b.theirs ? 'pos' : 'neg'}">${b.ours < b.theirs ? 'ours' : 'theirs'}</td></tr>`).join('');
  return section('NHL: lines settled, no picks yet', `<p>${int(st.lines)} shots lines settled on ${int(st.games)} games (to ${esc(dayLabel(st.to || '', false))}),
    ${st.final ? `${int(st.final)} final` : 'all provisional: the scorers can still correct a count for 27 hours'}. Paper picks: ${st.picks ? int(st.picks) : `none yet, from ${esc(st.picks_from)}`}.</p>
    <div class="tbl-wrap"><table class="tbl"><thead><tr><th>Bookmaker</th><th class="n">Lines</th><th class="n">Ours</th><th class="n">Theirs</th><th class="n">Nearer</th></tr></thead><tbody>${rows}</tbody></table></div>`,
  { sub: 'Each bookmaker’s lines, our Brier score against its own: how far each chance of the over sat from what happened, lower is better. One night is far too few to judge.' });
}

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
  const never = NEVER_SUMMED.has(S.set);       // "every" and "liveall" repeat a selection; no total of any kind for these (29 Oct 2026)
  const setDef = (SETS[S.sport] || []).find((x) => x.id === S.set) || {};
  if (S.allSports) {                                             // every sport side by side, never added together (29 Oct 2026)
    return { html: `<div class="controls">${sportChips(S)}</div>` + sportsTiles(ctx) + allSportsView(ctx, { bySet: true, title: 'Each sport, set by set',
      sub: 'Each sport’s own sets in this range, each its own record: none is added to another, and no sport to another. The filters are off here, since each sport cuts its own way.' }) };
  }
  const controls = `<div class="controls">
    ${sportChips(S)}
    ${chips('set', (SETS[S.sport] || []).map((x) => ({ id: x.id, label: x.label })), S.set, { small: true })}
  </div>`;
  const setNote = `<p class="set-note muted small">${esc(setDef.note || '')}${never ? ' <b>Never added up:</b> one selection counts as often as it was shown or logged, so no total of any kind is shown here; every bet in this view, below, as itself.' : ''}</p>`;
  if (!rows.length) {
    const none = !ctx.scope({ ignoreFilters: true, ignoreRange: true }).length;   // a set with nothing logged at all (the NHL's first days)
    if (none && S.sport === 'nhl') return { html: controls + setNote + nhlCard(D.feed.nhl_status) };
    return { html: controls + setNote + (none ? '<p class="empty">Nothing in this set yet: it fills as its picks are logged and their games settled.</p>'
      : '<p class="empty">Nothing in this set, sport and range: widen the range, take a filter off, or try another set.</p>') };
  }
  const g = agg(rows);
  const days = byDay(rows);
  const run = running(rows);
  const best = days.filter((d) => d.n).sort((a, b) => b.profit - a.profit)[0];
  const worst = days.filter((d) => d.n).sort((a, b) => a.profit - b.profit)[0];
  const st = streak(days);
  const head = D.feed.headline || {};
  const isHeadline = S.sport === 'football' && S.set === 'paper' && S.range === 'all' && !Object.keys(S.f).length && !Object.keys(S.x || {}).length;
  const hs = head.sets?.['paper account'];
  const agrees = isHeadline && hs ? Math.abs((hs.profit || 0) - g.profit) < 0.02 && hs.settled === g.n : null;
  // the 300 review's headline, record by overlay band (reports/review_300_20261029.md §2, 29 Oct 2026): the paper
  // account's own view, where the finding was made
  const review300 = isHeadline ? `<p class="small muted">From the 300 review: picks 25%+ above their price returned +52% on 86 (±11%, ahead in both halves); the 20-25% band +8% on 80 (±12%, weak in the first half, strong in the second).</p>` : '';
  // judged against the sharp close, not the soft one (season plan 4.1, 29 Oct 2026): board.py's sharp_close.summary()
  const sharpClose = isHeadline && D.feed.sharp_close ? `<p class="small muted">Against the sharp close: ${esc(D.feed.sharp_close)}</p>` : '';

  // the top third (the user, 30 Oct 2026: "the top 1/3 of the screen must hold the best, visually scannable info; more info can
  // sit lower"): the four numbers that say how the set stands; the rest of the record in words folded under the chart
  const tiles = never ? '' : `<div class="tiles tiles-top">
    ${tile({ label: 'Profit', value: `<span class="${signClass(g.profit)}">${money(g.profit)}</span>`, sub: `on ${money(g.staked, '£', 0, false)} staked`, spark: 'sp-profit' })}
    ${tile({ label: 'Return', value: `<span class="${signClass(g.ret)}">${spct(g.ret, 1)}</span>`, sub: `luck alone ±${pct(g.luck, 1)} ${verdictPill(g.verdict, g.more)}` })}
    ${tile({ label: 'Won', value: `${int(g.won)}<span class="muted"> of ${int(g.n)}${g.selections !== g.n ? ' parts' : ''}</span>`, sub: `${pct(g.wonPct)} · needed ${pct(g.needed)} · we said ${pct(g.said)}` })}
    ${tile({ label: 'Open', value: int(g.open), sub: `${money(g.openStake, '£', 0, false)} staked` })}
  </div>`;
  const check = isHeadline && hs ? `<p class="check ${agrees ? 'ok' : 'warn'}">${agrees ? '✓ Matches the record' : '⚠ Differs from the record'}: headline.json says ${money(hs.profit)} on ${money(hs.staked, '£', 0, false)}, ${hs.settled} settled (built ${esc((head.built_utc || '').replace('T', ' ').slice(0, 16))} UTC, results to ${esc(head.results_to || '')}).</p>` : '';
  const words = never ? '' : section('The record in words', `${setNote}${review300}${sharpClose}<p class="record-line">${recordLine(g)}</p>
    ${g.provisional ? `<p class="small muted">${g.provisional} settled on ESPN's counts until SofaScore is read.</p>` : ''}
    ${g.selections !== g.n ? `<p class="small muted">${g.selections} distinct selections: a split placed at two bookmakers, or in a double, counts once.</p>` : ''}
    <div class="tiles">
    ${tile({ label: 'Fall from the top', value: `<span class="${run.ddNow < 0 ? 'neg' : ''}">${money(run.ddNow, '£', 0, true)}</span>`, sub: `worst ${money(run.maxDD)} · top ${money(run.peak)}` })}
    ${tile({ label: 'Days', value: `${days.filter((d) => d.n).length}`, sub: best ? `best ${dayLabel(best.day, false)} ${money(best.profit)} · worst ${dayLabel(worst.day, false)} ${money(worst.profit)}${st.current > 1 ? ` · ${st.current} ${st.sign > 0 ? 'up' : 'down'} days running` : ''}` : 'none settled', go: best ? { tab: 'results', range: 'custom', from: best.day, to: best.day } : null })}
    </div>${agrees ? check : ''}${otherCheck(D, S)}`,
  { fold: 'results.words', wide: true, sub: 'What this set is, the record in one line, the fall from its top and its best and worst days, and the checks against the record.' });

  const cmp = S.sport === 'football' && S.set === 'paper';
  const chart = never ? '' : section('Running profit', `<div class="chart chart-lg" id="ch-run"></div><div class="chart chart-xs" id="ch-dd"></div>`,
    { sub: cmp ? 'The paper account, with the same selections as first shown and as last shown beside it. Below: how far it stands under its own top.' : 'Settled bets in kick-off order. Below: how far it stands under its top.' });

  // where the bank could go from here: a record's own set only (a set that repeats a selection would overstate it)
  const ol = !never && S.set !== 'live' ? outlookCard(ctx, ctx.scope({ ignoreRange: true }), { fold: 'results.outlook' }) : { html: '' };

  const cal = never ? '' : section('Day by day', `<div class="chart" id="ch-cal"></div>`, { fold: 'results.cal', wide: true, sub: 'Profit a match day (Greek dates). Tap a day to open it.' });

  const per = never ? '' : section('By period', `${chips('period', [{ id: 'day', label: 'Day' }, { id: 'week', label: 'Week' }, { id: 'month', label: 'Month' }], S.period, { small: true })}<div class="chart" id="ch-period"></div>`, { fold: 'results.period', wide: true });
  const expo = never ? '' : section('Exposure by match day', `<div class="chart" id="ch-expo"></div>`,
    { fold: 'results.expo', wide: true, sub: S.set === 'placeable' ? 'The real-money plan’s amounts a match day, against the 500 day cap.' : 'Stakes a match day in this set, settled and still open. The line is the real-money day cap, for scale: paper stakes are not capped by it.' });

  // the sets side by side, never added together: every sport's own (30 Oct 2026, the user's "all sports the same")
  const base = ctx.scope({ set: null });
  const setList = (SETS[S.sport] || []).filter((x) => !NEVER_SUMMED.has(x.id)).map((x) => ({ key: x.label, id: x.id, ...agg(base.filter((r) => r.set === x.id)) }));
  const sets = setList.length > 1 ? section('The sets side by side', table({ id: 't-sets', cols: cutCols('Set'), rows: setList, rowGo: (r) => ({ set: r.id }), sort: ctx.sortOf('t-sets') }),
    { fold: 'results.sets', wide: true, sub: S.sport === 'football' ? 'Each its own record, the same range and filters. As placeable is the real-money plan’s amounts; kept back and live are on paper and never in the headline.'
      : 'Each its own record, the same range and filters, never added together. Tap a set to open it.' }) : '';
  const sports = sportsTiles(ctx, { fold: 'results.sports' });

  const kinds = group(rows, 'kind');
  const kind = !never && kinds.length > 1 ? section('By kind of bet', table({ id: 't-kind', cols: cutCols('Kind'), rows: kinds, rowGo: (r) => ({ tab: 'slices', f: { kind: [r.key] }, rows: 'stat', cols: 'book' }), sort: ctx.sortOf('t-kind') }), { fold: 'results.kind', wide: true }) : '';

  // the same review tables in every sport and set: one cut at a time, each row with its bets and its luck band, and the set's
  // own total beneath (30 Oct 2026, the user's "the same easy analysis for me to review and come up with questions")
  const cut = REVIEW_CUTS.find((c) => c.id === S.resCut) || REVIEW_CUTS[0];
  const review = never ? '' : section('Review tables', `${chips('resCut', REVIEW_CUTS.map((c) => ({ id: c.id, label: c.label })), cut.id, { small: true })}
    ${table({ id: 't-review', cols: cutCols(cut.head, { dim: cut.id }), rows: group(rows, cut.id), foot: { key: 'All', ...agg(rows) },
      rowGo: (r) => ({ f: { [cut.id]: [r.key] }, keep: true }), sort: ctx.sortOf('t-review') })}`,
    { fold: 'results.review', wide: true, sub: 'This set, range and filters, cut one way at a time. A return inside its luck band shows nothing yet. Tap a row to filter to it.' });

  const betCols = [
    { key: 'day', label: 'Day', fmt: (v, r) => `${esc(r.kick ? ukDay(r.kick).slice(5) : (v ? v.slice(5) : '–'))}<span class="muted small"> ${esc(ukHM(r.kick))}</span>` },
    { key: 'bet', label: 'Bet', fmt: (v, r) => `<b>${esc(v)}</b><div class="muted small">${esc(r.match)} · ${esc(compName(r.comp))}</div>` },
    { key: 'book', label: 'At', fmt: (v) => bookChip(v) },
    { key: 'price', label: 'Price', num: true, fmt: (v) => odds(v) },
    { key: 'edge', label: 'Overlay', num: true, fmt: (v) => `<span class="${signClass(v)}">${spct(v)}</span>` },
    { key: 'stake', label: 'Stake', num: true, fmt: (v, r) => `${money(v, '£', 2, false)}${isNum(r.factor) && r.factor < 1 ? ` <span class="muted small" title="already at this share of the rule's stake">×${num(r.factor, 2)}</span>` : ''}` },
    { key: 'actual', label: 'Came to', num: true, fmt: (v) => esc(v ?? '–') },
    { key: 'status', label: 'Result', fmt: (v) => statusTag(v) },
    { key: 'profit', label: 'Profit', num: true, fmt: (v) => `<span class="${signClass(v)}">${isNum(v) ? money(v, '£', 2) : '–'}</span>` },
  ];
  const list = section(`Every bet in this view (${rows.length})`, `<details class="fold" ${rows.length <= 25 ? 'open' : ''}><summary>Show the bets</summary>${table({ id: 't-bets', cols: betCols, rows, rowBet: (r) => r.id, sort: ctx.sortOf('t-bets', { key: 'day', desc: true }) })}</details>`, { fold: 'results.bets', wide: true });

  // the evenings' evaluations (reports/evaluation_<day>.md, written by a Claude chat each evening; the bot's /eval reads the same)
  const evals = D.feed.evaluations || [];
  const evaluations = evals.length ? section('Evening evaluations', evals.map((e, i) => {
    const first = (/^\s*#\s+(.+)$/m.exec(e.md) || [])[1] || dayLabel(e.day);
    return `<details class="fold eval"${i === 0 && evals.length === 1 ? ' open' : ''}><summary>${esc(first)} <span class="muted small">written ${esc(ukStamp(e.made).slice(5))}</span></summary>
      <div class="md">${md(e.md.replace(/^\s*#\s+.+$/m, ''))}</div></details>`;
  }).join(''), { fold: 'results.evals', wide: true, sub: 'How the day went, pick by pick, with the reason each won or lost; basketball, live, the builders and the choices put to you. The newest three.' }) : '';

  const outlets = S.sport === 'football' ? outletsBrief(D.feed.lines?.outlets) : '';   // the bookmakers we do not place at (26 Oct 2026)
  const changes = changesCard(D.feed.change_effects);
  // the top: the set's four numbers (a check that differs from the record stays up there; a never-added set keeps its note), the
  // running profit open; every other card folded below on every screen, nothing removed (30 Oct 2026)
  const html = controls + (never ? setNote : '') + tiles + (agrees === false ? check : '') + chart + words + sports + changes + evaluations
    + ol.html + cal + per + expo + sets + kind + review + outlets + list;
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
