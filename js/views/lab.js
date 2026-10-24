// Two cards that try things on the record (the user's choices of 18 Oct 2026): the what-if replay (Ideas tab) and where
// the bank could go from here (Results tab). Both say plainly what they are: a replay of the bets we logged, and paths
// drawn from the record's own recent bets at a return assumed, not known.

import { esc, money, pct, spct, isNum, dayLabel, fromGreek, uniq } from '../util.js';
import { section, chips, verdictPill, signClass, betLine } from '../ui.js';
import { agg } from '../metrics.js';
import { STYLES } from '../lines.js';
import * as W from '../whatif.js';
import * as O from '../outlook.js';
import * as C from '../charts.js';
import { ASK_TAIL } from '../insights.js';

const at = (day) => fromGreek(`${day} 00:00`).getTime();

// ------------------------------------------------------------------------------------------------ what if

export function ruleOf(S) {
  return { bar: +S.wiBar || 0.2, cap: S.wiCap === 'none' ? null : +S.wiCap, per: S.wiPer || '2', style: S.wiStyle || 'staked',
    outBook: S.wiOutBook || [], outStat: S.wiOutStat || [], outSide: S.wiOutSide || [] };
}

function toggles(name, values, out) {
  return `<div class="fchips">${values.map((v) => `<button type="button" class="chip${out.includes(v) ? ' chip-xed' : ''}" data-toggle-list="${esc(name)}" data-value="${esc(v)}">${out.includes(v) ? '✕ ' : ''}${esc(v)}</button>`).join('')}</div>`;
}

export function whatIfCard(ctx) {
  const { D, S } = ctx;
  const inRange = (r) => ctx.inRange(r.day);
  const cands = W.candidates(D.bets).filter(inRange);
  const record = D.bets.filter((r) => r.sport === 'football' && r.set === 'paper' && !/builder/.test(r.kind || '') && r.stat !== 'bet builder' && inRange(r));
  if (!cands.length) return { html: '' };
  const rule = ruleOf(S);
  const rep = W.replay(cands, record, rule);
  const books = uniq(cands.map((r) => r.book).filter(Boolean)).sort(), stats = uniq(cands.map((r) => r.stat).filter(Boolean)).sort();
  const a = rep.a, b = rep.b, sim = rep.sim, base = rep.base;
  const diff = sim.profit - base.profit;
  const styleLabel = (STYLES.find((s) => s.id === rule.style) || STYLES[0]).label;
  const isNow = rule.bar === W.NOW.bar && rule.cap === null && rule.per === W.NOW.per && !rule.outBook.length && !rule.outStat.length && !rule.outSide.length;
  const request = `Test this rule old against new with scripts/rule_test.py, walk-forward on the record with picks included: ${W.describe(rule)}. The board's replay of the logged picks gave ${money(sim.profit)} on ${money(sim.staked, '£', 0, false)} (${spct(sim.ret)}, ${sim.bets} bets) against the record's stat picks ${money(base.profit)} on ${money(base.staked, '£', 0, false)}, over ${S.range === 'all' ? 'the whole record' : 'the board’s range'}. Say whether it holds out of sample, its luck band and worst fall, and what it would have placed in real money under the day cap and the bookmakers' caps.${ASK_TAIL}`;

  const html = section('What if: the record replayed under another rule', `
    <div class="wi-controls">
      <div class="sel"><span>Send picks at least this far above their price</span>${chips('wiBar', W.BARS.map((x) => ({ id: String(x), label: `${Math.round(x * 100)}%` })), String(rule.bar), { small: true })}</div>
      <div class="sel"><span>Ceiling on the overlay</span>${chips('wiCap', W.CAPS.map((c) => ({ id: c.id, label: c.label })), rule.cap === null ? 'none' : String(rule.cap), { small: true })}</div>
      <div class="sel"><span>Picks a match at most</span>${chips('wiPer', W.PER, rule.per, { small: true })}</div>
      <div class="sel"><span>Stakes</span>${chips('wiStyle', STYLES.map((s) => ({ id: s.id, label: s.label })), rule.style, { small: true })}</div>
      <details class="fold"><summary>Leave out bookmakers, stats or sides${rule.outBook.length + rule.outStat.length + rule.outSide.length ? ` (${rule.outBook.length + rule.outStat.length + rule.outSide.length})` : ''}</summary>
        ${toggles('wiOutBook', books, rule.outBook)}${toggles('wiOutStat', stats, rule.outStat)}${toggles('wiOutSide', ['over', 'under'], rule.outSide)}</details>
    </div>
    <div class="tiles tiles-2">
      <div class="tile"><div class="tile-label">The record as it was</div><div class="tile-value ${signClass(base.profit)}">${money(base.profit)}</div>
        <div class="tile-sub">${b.n} bets · ${spct(b.ret)} · ±${pct(b.luck)} ${verdictPill(b.verdict, b.more)}<br><span class="muted">worst fall ${money(base.maxDD)}</span></div></div>
      <div class="tile"><div class="tile-label">${isNow ? 'Today’s rule on every day' : 'This rule'}</div><div class="tile-value ${signClass(sim.profit)}">${money(sim.profit)}</div>
        <div class="tile-sub">${sim.bets} bets · ${spct(sim.ret)}${rule.style === 'staked' ? ` · ±${pct(a.luck)} ${verdictPill(a.verdict, a.more)}` : ` · ${esc(styleLabel)}`}<br><span class="muted">worst fall ${money(sim.maxDD)}</span></div></div>
    </div>
    <p class="reading">${Math.abs(diff) < 0.5 ? 'The same money as the record.' : `<b class="${signClass(diff)}">${money(diff)}</b> against the record`}: it ${rep.dropped.bets ? `leaves out ${rep.dropped.bets} of the record’s picks (they made ${money(rep.dropped.profit)})` : 'keeps every pick of the record'}${rep.added.bets ? ` and adds ${rep.added.bets} kept back (they made ${money(rep.added.profit)})` : ''}. ${rule.style === 'staked' ? '' : 'Stakes from a £1,000 bank a match day at a time: a tenth a bet, a quarter a match, half a day. '}</p>
    <div class="chart" id="ch-wi"></div>
    <p class="muted small">A replay of the picks we logged (the paper account's stat picks and the lines kept back since 17 Oct; builders left out), in the board's range. Not a walk-forward test: the picks are as they were shown, only the rule that keeps them changes. A rule worth keeping is tested properly before anything changes.</p>
    ${rep.droppedRows.length || rep.addedRows.length ? `<details class="fold"><summary>The picks that change (${rep.droppedRows.length} out, ${rep.addedRows.length} in)</summary>
      ${rep.addedRows.length ? `<h3 class="sheet-h">In (kept back by the record)</h3><div class="lines">${rep.addedRows.slice(0, 40).map((r) => betLine(r)).join('')}</div>` : ''}
      ${rep.droppedRows.length ? `<h3 class="sheet-h">Out</h3><div class="lines">${rep.droppedRows.slice(0, 40).map((r) => betLine(r)).join('')}</div>` : ''}</details>` : ''}
    <div class="sheet-actions"><button type="button" class="btn-copy" data-copy="${esc(request)}">Copy request: test it properly</button>
      <button type="button" class="btn-soft" data-chat-ask="${esc(`what if the bar were ${Math.round(rule.bar * 100)}%`)}">Ask the board</button></div>`,
  { id: 'whatif', sub: 'Move the bar, the ceiling, the picks a match or the stakes, or leave a bookmaker, stat or side out: football’s picks replayed against what really happened.' });

  const mount = () => {
    const el = document.getElementById('ch-wi');
    if (!el) return;
    el.style.height = '230px';
    const t = C.tokens();
    const line = (s, name, color) => ({ name, color, pts: s.pts.map((p) => [at(p.day), Math.round((p.bank - 1000) * 100) / 100]) });
    C.runningChart(el, [line(base, 'The record', t.muted), line(sim, isNow ? 'Today’s rule' : 'This rule', t.s1)].filter((s) => s.pts.length), { fmt: C.FMT.gbp, area: false, daily: true });
  };
  return { html, mount, rep };
}

// ------------------------------------------------------------------------------------------------ the bank's next days

export function outlookCard(ctx, rows, { title = 'Where the bank could go from here' } = {}) {
  const { S } = ctx;
  const edge = O.EDGES.some((e) => e.id === S.olEdge) ? S.olEdge : 'record';
  const days = [30, 60, 90].includes(+S.olDays) ? +S.olDays : 30;
  const o = O.outlook(rows, { edge, days });
  if (!o) return { html: '' };
  const falls = o.falls.map((f) => `<div class="tile"><div class="tile-label">A fall of ${pct(f.share)} (${money(f.at, '£', 0, false)})</div><div class="tile-value">${pct(f.chance)}</div><div class="tile-sub">chance at some point</div></div>`).join('');
  const html = section(title, `
    <div class="controls">${chips('olEdge', O.EDGES, edge, { small: true })}${chips('olDays', [30, 60, 90].map((d) => ({ id: String(d), label: `${d} days` })), String(days), { small: true })}</div>
    <div class="tiles tiles-2">
      <div class="tile" style="grid-column: 1 / -1"><div class="tile-label">The middle path, ${days} days</div><div class="tile-value ${signClass(o.median)}">${money(o.median)}</div><div class="tile-sub">half of paths ${money(o.p25)} to ${money(o.p75)}</div></div>
      <div class="tile"><div class="tile-label">Ending lower than today</div><div class="tile-value">${pct(o.chanceDown)}</div><div class="tile-sub">nine in ten end ${money(o.p5)} to ${money(o.p95)}</div></div>
      ${falls}
    </div>
    <div class="chart" id="ch-ol"></div>
    <p class="muted small">${o.paths.toLocaleString('en-GB')} paths, each ${days} days of about ${o.perDay.toFixed(0)} bets a day at £${o.avgStake.toFixed(0)} on average (this set's ${o.n} settled bets from ${dayLabel(o.from, false)} to ${dayLabel(o.to, false)}, drawn again with their stakes and prices).
      ${edge === 'none' ? 'With no edge: every bet a fair coin at its price.' : `Each path's return is drawn around ${spct(o.base, 1)} (${edge === 'half' ? 'half the record’s' : 'the record’s'}) give or take its luck band (±${pct(o.unc, 1)}), so the fan holds the doubt about the edge itself.`}
      A fall is measured from the highest point so far; the typical path's worst fall is ${money(o.worstMedian)}. The stakes are the record's own, not the real-money plan's (unless this is the As placeable set).</p>`,
  { id: 'outlook', sub: `Likely paths for the profit from today at this set's stakes, and how deep a fall from a high could go on the way.` });
  const mount = () => {
    const el = document.getElementById('ch-ol');
    if (el) C.fanChart(el, o.q);
  };
  return { html, mount, o };
}
