// Lines: who found the line (the user's ask of 18 Oct 2026). Our number against every bookmaker's on every settled count
// line read (scripts/line_judge.py): found it on their rule (20.5 finds 20 or 21) at each one's 50/50 line, close, the
// miss and which way each leans; ours against each bookmaker on the same counts; by stat, week by week and how far off.
// Then the stakes: the bets by kind as staked, at level stakes and at Kelly on our chance, and a bank played each way.

import { esc, money, pct, spct, num, isNum, int, uniq, dayLabel } from '../util.js';
import { section, table, chips, select, signClass } from '../ui.js';
import { SETS, SPORTS, NEVER_SUMMED } from '../state.js';
import { compName } from '../data.js';
import { rowsOf, byWho, headToHead, grid, weekly, missSpread, MEASURES, STYLES, simulate, distinctParlays, OURS } from '../lines.js';
import * as C from '../charts.js';

const pts = (v, dp = 1) => (isNum(v) ? `${v > 0 ? '+' : v < 0 ? '−' : ''}${Math.abs(v * 100).toFixed(dp)} pts` : '–');
const signed = (v, dp = 2) => (isNum(v) ? `${v > 0 ? '+' : v < 0 ? '−' : ''}${Math.abs(v).toFixed(dp)}` : '–');
const FMT = { found: (v) => pct(v), close: (v) => pct(v), miss: (v) => num(v, 2), lean: (v) => signed(v) };
const CHART_FMT = { found: (v) => `${Math.round(v * 100)}%`, close: (v) => `${Math.round(v * 100)}%`, miss: (v) => v.toFixed(1), lean: (v) => `${v > 0 ? '+' : ''}${v.toFixed(1)}` };
const SHORT = { Pamestoixima: 'Pame', Stoiximan: 'Stoix', Novibet: 'Novi', Pinnacle: 'Pinn' };          // the grid's columns on a phone
const ALL_STATS = 'All stats';   // the grid's totals row (the user's ask of 19 Oct 2026): each forecaster on every count it priced here
const short = (w) => SHORT[w] || w;

// the bets of a set as the stakes card plays them: the bets' own rows, the paper parlays, or the real tickets
function stakeRows(ctx, sport, setId) {
  const { D } = ctx;
  if (setId === 'real') {
    return D.tickets.filter((t) => (t.sport || 'football') === sport && ctx.inRange(t.day)).map((t) => ({
      kind: `real money, ${t.legsBand === '1 (single)' ? 'singles' : t.legsBand === '2' ? 'doubles' : `${t.legsBand} legs`}`, day: t.day, match: t.key,
      price: t.price, stake: t.stake, ours: null, settled: t.status === 'won' || t.status === 'lost', w: t.status === 'won' ? 1 : 0, profit: t.profit,
    }));
  }
  return ctx.scope({ sport, set: setId, ignoreFilters: true }).map((r) => ({ ...r, kind: r.kind || 'not known' }));
}

// the paper parlays (their own record, ledger/parlays.md: never added to the paper account)
function parlayRows(ctx) {
  return ctx.D.parlays.filter((p) => ctx.inRange(p.day)).map((p) => ({ kind: p.kind || p.family || 'other', day: p.day, match: p.id, price: p.price, stake: p.stake,
    ours: p.chance, settled: p.settled, w: p.status === 'won' ? 1 : 0, profit: p.profit, book: p.book, legs: p.legs }));
}

// each kind of bet played every way, with a first row for all of them together
function styleRows(bets, cap, totalLabel, { distinct } = {}) {
  const play = (xs) => Object.fromEntries(STYLES.map((s) => [s.id, simulate(xs, { style: s.id, cap })]));
  const kinds = uniq(bets.map((r) => r.kind)).map((k) => { const xs = bets.filter((r) => r.kind === k); return { kind: k, n: xs.filter((r) => r.settled).length, ...play(xs) }; })
    .filter((x) => x.n).sort((a, b) => b.n - a.n);
  const all = distinct ? distinctParlays(bets) : bets;               // the total: a parlay two rules both picked once
  const total = { kind: totalLabel, total: true, n: all.filter((r) => r.settled).length, ...play(all) };
  return kinds.length > 1 ? [total, ...kinds] : kinds.length ? [{ ...kinds[0], total: true }] : [];
}

export function render(ctx) {
  const { D, S } = ctx;
  const L = D.feed.lines || {};
  const every = rowsOf(D.feed.lines);
  if (!every.length) return { html: section('Who found the line', '<p class="empty">No settled lines yet: scripts/line_judge.py writes them after each daily run.</p>') };
  const order = L.who || [OURS];
  const inView = every.filter((r) => (S.lineSport === 'all' || r.sport === S.lineSport) && ctx.inRange(r.day));
  // left out (the user's ask of 18 Oct 2026: "an option to exclude, e.g. Pame, or have all except offsides")
  const outWho = new Set(S.lineOutWho || []), outStat = new Set(S.lineOutStat || []);
  const inSport = inView.filter((r) => !outWho.has(r.who) && !outStat.has(r.stat));
  const leaveOut = (() => {
    const whoAll = byWho(inView, order).map((x) => x.who), statAll = uniq(inView.map((r) => r.stat)).sort();
    const chip = (list, v, on) => `<button type="button" class="chip${on ? ' chip-xed' : ''}" data-toggle-list="${list}" data-value="${esc(v)}">${on ? '✕ ' : ''}${esc(v)}</button>`;
    const n = outWho.size + outStat.size;
    return `<details class="fold leave-out"${n ? ' open' : ''}><summary>Leave out${n ? ` (${n})` : ''}</summary>
      <p class="muted small">Tap to leave a forecaster or a stat out of every card below (offsides leaves out the match's and each team's); tap again to bring it back.</p>
      <div class="fchips">${whoAll.map((w) => chip('lineOutWho', w, outWho.has(w))).join('')}</div>
      <div class="fchips">${statAll.map((s) => chip('lineOutStat', s, outStat.has(s))).join('')}</div></details>`;
  })();
  const comps = uniq(inSport.map((r) => r.comp)).sort();
  const comp = comps.includes(S.lineComp) ? S.lineComp : 'all';
  const inComp = comp === 'all' ? inSport : inSport.filter((r) => r.comp === comp);
  const statSizes = new Map();
  for (const r of inComp) statSizes.set(r.statKey, (statSizes.get(r.statKey) || 0) + 1);
  const stats = [...statSizes.keys()].sort((a, b) => statSizes.get(b) - statSizes.get(a));
  const stat = stats.includes(S.lineStat) ? S.lineStat : 'all';
  const rows = stat === 'all' ? inComp : inComp.filter((r) => r.statKey === stat);
  const measure = MEASURES[S.lineMeasure] ? S.lineMeasure : 'found';
  const M = MEASURES[measure];

  const controls = `<div class="controls">
    ${chips('lineSport', [{ id: 'all', label: 'All sports' }, ...SPORTS], S.lineSport, { small: true })}
    ${chips('lineMeasure', Object.entries(MEASURES).map(([id, m]) => ({ id, label: m.label })), measure, { small: true })}
    ${select('lineStat', [{ id: 'all', label: 'Every stat' }, ...stats.map((s) => ({ id: s, label: `${s} (${statSizes.get(s)})` }))], stat, 'Stat')}
    ${comps.length > 1 ? select('lineComp', [{ id: 'all', label: 'Every league' }, ...comps.map((c) => ({ id: c, label: compName(c) }))], comp, 'League') : ''}
  </div>${leaveOut}`;

  // 1. each forecaster on the counts it priced
  const board = byWho(rows, order);
  const ranked = [...board].sort((a, b) => (M.better === 'lower' ? a.miss - b.miss : M.better === 'zero' ? Math.abs(a.lean) - Math.abs(b.lean) : (M.get(b) ?? -1) - (M.get(a) ?? -1)));
  const days = uniq(rows.map((r) => r.day)).sort();
  const lead = ranked.filter((x) => x.n >= 30);
  const words = lead.length ? `${lead.map((x, i) => `${i === 0 ? '<b>' : ''}${esc(x.who)} ${FMT[measure](M.get(x))}${i === 0 ? '</b>' : ''}`).join(', ')}` : 'Too few counts in this view yet.';
  const check = outWho.size || outStat.size ? `<p class="muted small">Leaving out ${esc([...outWho, ...outStat].join(', '))}.</p>` : checkLine(L, S, stat, comp, board);
  const leaderCard = section('Who found the line', `<p class="record-line">${int(uniq(rows.map((r) => r.g)).length)} settled counts in ${int(uniq(rows.map((r) => r.mid)).length)} matches${days.length ? `, ${esc(dayLabel(days[0], false))} to ${esc(dayLabel(days[days.length - 1], false))}` : ''}. ${esc(M.label)}: ${words}.</p>
    <div class="chart" id="ln-board"></div>
    ${table({ id: 't-ln-board', rows: board, sort: ctx.sortOf('t-ln-board', { key: 'found', desc: true }), cols: [
      { key: 'who', label: 'Forecaster', fmt: (v) => `<b>${esc(v)}</b>` }, { key: 'n', label: 'Counts', num: true, fmt: int }, { key: 'matches', label: 'Matches', num: true, fmt: int },
      { key: 'found', label: 'Found it', num: true, fmt: (v) => pct(v) }, { key: 'close', label: 'Close', num: true, fmt: (v) => pct(v) },
      { key: 'miss', label: 'Avg miss', num: true, fmt: (v) => num(v, 2) }, { key: 'lean', label: 'Lean', num: true, fmt: (v) => signed(v) }] })}
    ${check}
    <details class="fold"><summary>How it is measured</summary><p class="small muted">Found it: the count landed on one of the two whole numbers either side of the forecaster’s 50/50 line (20.5 finds 20 or 21), the margin taken out. Close: within half the stat’s usual miss (at least 1.5). Lean: the count less the line on average; a little above zero is usual for counts. Each on the counts it priced: the fair test is the next card.</p></details>`,
  { sub: 'How often each forecaster’s line found the count; how it is measured is under the table.' });   // the chart first (23 Oct 2026)

  // 2. one forecaster (ours unless another is picked) against each other on the same counts
  const refs = board.filter((x) => x.n >= 10).map((x) => x.who);
  const ref = refs.includes(S.lineRef) ? S.lineRef : refs.includes(OURS) ? OURS : refs[0];
  const h2h = ref ? headToHead(rows, ref).filter((x) => x.n >= 10) : [];
  const refName = ref === OURS ? 'Ours' : ref;
  const verdictOf = (x) => (!isNum(x.gapSe) || !x.gapSe ? 'too few' : x.gap - 1.96 * x.gapSe > 0 ? `${refName} better, beyond luck` : x.gap + 1.96 * x.gapSe < 0 ? `${x.who} better, beyond luck` : 'level so far');
  const refPick = refs.length > 1 ? `<div class="controls">${select('lineRef', refs.map((w) => ({ id: w, label: w })), ref, 'Against')}</div>` : '';
  const pairCard = h2h.length || refPick ? section(ref === OURS ? 'Ours against each bookmaker, on the same counts' : `Each against ${ref}, on the same counts`, `${refPick}
    ${h2h.length ? `<div class="chart" id="ln-h2h"></div>
    ${table({ id: 't-ln-h2h', rows: h2h.map((x) => ({ ...x, reading: verdictOf(x) })), sort: ctx.sortOf('t-ln-h2h', { key: 'n', desc: true }), cols: [
      { key: 'who', label: 'Against', fmt: (v) => `<b>${esc(v)}</b>` }, { key: 'n', label: 'Same counts', num: true, fmt: int },
      { key: 'oursFound', label: `${refName} found`, num: true, fmt: (v) => pct(v) }, { key: 'theirFound', label: 'Theirs', num: true, fmt: (v) => pct(v) },
      { key: 'gap', label: 'Gap', num: true, fmt: (v) => `<span class="${signClass(v)}">${pts(v)}</span>` },
      { key: 'nearer', label: `${refName} nearer`, num: true, fmt: (v, r) => `${pct(v)}<span class="muted small"> ±${pct(1.96 * (r.nearerSe || 0))}</span>` },
      { key: 'reading', label: 'Reading' }] })}` : `<p class="empty">${esc(ref)} shares no counts with the others in this view.</p>`}`,
  { sub: `Only the counts both priced. Right of zero: ${esc(refName.toLowerCase() === 'ours' ? 'ours' : refName)} found it more often; the whisker is the 95% range, a match’s counts taken together. Nearer: how often its line was the closer one to the count (a tie counts half): 50% is level. Pick another forecaster to set the bookmakers against each other (tennis aces: bet365, 1xBet, Betsson and BetRivers since June, from OddsPapi).` }) : '';

  // 3. by stat
  const gr = grid(inComp, order);
  const cellOf = (c, y) => ({ x: c.who, y, value: M.get(c), n: c.n, sub: `found ${pct(c.found)} · close ${pct(c.close)} · miss ${num(c.miss, 2)} · lean ${signed(c.lean)}` });
  const cells = [...gr.cells.map((c) => cellOf(c, c.stat)), ...byWho(inComp, gr.who).map((c) => cellOf(c, ALL_STATS))];
  const gridCard = gr.stats.length > 1 ? section(`${M.label}, by stat`, `<div class="chart" id="ln-grid"></div>`,
    { sub: `Each cell: ${M.label.toLowerCase()} on that stat’s counts (the small number). Coloured against the others in the same stat: green is ${M.better === 'lower' ? 'a smaller miss' : M.better === 'zero' ? 'a lean nearer zero' : 'more often'} than the stat’s average. Tap a cell for its counts.` }) : '';

  // 4. week by week
  const weeks = weekly(rows, order, 15);
  const weekKeys = uniq(weeks.flatMap((s) => s.pts.map((p) => p.week))).sort().slice(-8);
  const weekCard = weekKeys.length >= 2 ? section(`${M.label}, week by week`, `<div class="chart" id="ln-weeks"></div>`, { sub: 'The last eight weeks from Monday; a forecaster’s week shows with 15 counts or more.' }) : '';

  // 5. how far off
  const spreadWho = board.filter((x) => x.n >= 30).slice(0, 4);
  const spreadCard = spreadWho.length ? section('How far off, and which way', `<div class="chart" id="ln-spread"></div>`,
    { sub: 'The share of counts by how far they landed from each forecaster’s line, in whole counts (the count less the line; the ends gather everything beyond 6). A tall middle is a sharp forecaster; a lean to one side is a line set too low or too high.' }) : '';

  // 6. the stakes
  const sp = S.lineSport === 'all' ? 'football' : S.lineSport;
  const setOpts = [...(SETS[sp] || []).filter((x) => !NEVER_SUMMED.has(x.id)).map((x) => ({ id: x.id, label: x.label })), ...(sp === 'football' ? [{ id: 'real', label: 'Real money' }] : [])];
  const setId = setOpts.some((x) => x.id === S.stakeSet) ? S.stakeSet : 'paper';
  const bets = stakeRows(ctx, sp, setId);
  const cap = +S.stakeCap || 0.1;
  const setName = setOpts.find((x) => x.id === setId)?.label || setId;
  const own = styleRows(bets, cap, `All of ${setName.toLowerCase()}`);
  const parl = sp === 'football' && setId === 'paper' ? styleRows(parlayRows(ctx), cap, 'All the paper parlays, each once', { distinct: true }) : [];
  const style = STYLES.some((s) => s.id === S.stakeStyle) ? S.stakeStyle : 'k4';
  const run = own.length ? own[0][style] : simulate([], { style });
  const total = own[0] || {};
  // a list rather than a table: a kind's name on its own line, then one small cell a style (a phone has no room for seven columns)
  const cell = (v) => (v && v.bets ? `<span><b class="${signClass(v.profit)}">${money(v.profit, '£', Math.abs(v.profit) < 10 ? 2 : 0)}</b><small class="muted">${spct(v.ret)}</small></span>` : '<span class="muted">–</span>');
  const list = (xs) => xs.map((k) => `<div class="stk-row${k.total ? ' stk-total' : ''}"><div class="stk-kind">${k.total ? `<b>${esc(k.kind)}</b>` : esc(k.kind)} <span class="muted small">${int(k.n)} settled</span></div>
      <div class="stk-cells">${STYLES.map((s) => cell(k[s.id])).join('')}</div></div>`).join('');
  const stakeTable = `<div class="stk"><div class="stk-cells stk-head">${STYLES.map((s) => `<span>${esc(s.label)}</span>`).join('')}</div>${list(own)}
    ${parl.length ? `<p class="muted small">The paper parlays: their own record (ledger/parlays.md), never added to the paper account.</p>${list(parl)}` : ''}</div>`;
  const stakeCard = section('Stakes: fixed or varying', `<div class="controls">${chips('stakeSet', setOpts, setId, { small: true })}</div>
    ${own.length ? stakeTable : '<p class="empty">No settled bets in this set and range.</p>'}
    <h3 class="sheet-h">Play a bank of £1,000</h3>
    <div class="controls">${chips('stakeStyle', STYLES, style, { small: true })}${chips('stakeCap', [{ id: '0.1', label: 'Cap 10%' }, { id: '0.05', label: '5%' }, { id: '0.02', label: '2%' }], String(cap), { small: true })}</div>
    <div class="tiles tiles-2">
      <div class="tile"><div class="tile-label">Bank now</div><div class="tile-value">${money(run.end, '£', 0, false)}</div><div class="tile-sub">${int(run.bets)} bets${run.skipped ? ` · ${int(run.skipped)} with no stake` : ''}</div></div>
      <div class="tile"><div class="tile-label">Profit</div><div class="tile-value"><span class="${signClass(run.profit)}">${money(run.profit, '£')}</span></div><div class="tile-sub">on ${money(run.staked, '£', 0, false)} staked</div></div>
      <div class="tile"><div class="tile-label">Return on staked</div><div class="tile-value"><span class="${signClass(run.ret)}">${spct(run.ret, 1)}</span></div><div class="tile-sub">${esc(run.label)}</div></div>
      <div class="tile"><div class="tile-label">Biggest drop</div><div class="tile-value"><span class="neg">${money(run.maxDD, '£')}</span></div><div class="tile-sub">from the top so far</div></div>
    </div>
    <div class="chart" id="ln-bank"></div>`,
  { sub: `Each kind of bet played from its own £1,000: as staked (the stakes shown), £10 a bet, and Kelly on our chance at an eighth, a quarter (the stakes’ rule) and a half, each day’s stakes from that morning’s bank, at most ${Math.round(cap * 100)}% of it on a bet, a quarter on a match and half on a day (the real-money day cap). Kelly puts nothing on a bet our chance gives no edge, and needs our chance: real tickets and some builders have none (–).` });

  const html = controls + leaderCard + pairCard + gridCard + weekCard + spreadCard + stakeCard;
  const mount = () => {
    const t = C.tokens();
    const spare = [t.s2, t.s4, t.s5, t.s3];                         // the bookmakers with no colour of their own (OddsPapi's)
    const colour = (w) => (w === OURS ? t.s1 : t.book[w] || spare[Math.max(0, order.indexOf(w)) % spare.length]);
    const e1 = document.getElementById('ln-board');
    if (e1 && board.length) C.bars(e1, ranked.map((x) => ({ label: x.who, value: M.get(x) ?? 0, color: colour(x.who), sub: `${int(x.n)} counts · found ${pct(x.found)} · close ${pct(x.close)} · miss ${num(x.miss, 2)} · lean ${signed(x.lean)}` })),
      { fmt: CHART_FMT[measure], signed: measure === 'lean', height: Math.max(120, ranked.length * 34 + 30) });
    const e2 = document.getElementById('ln-h2h');
    if (e2) C.dotWhisker(e2, h2h.map((x) => ({ label: `${refName} v ${x.who}`, value: x.gap, lo: x.gap - 1.96 * (x.gapSe || 0), hi: x.gap + 1.96 * (x.gapSe || 0), sub: `${int(x.n)} same counts · ${refName} ${pct(x.oursFound)}, ${x.who} ${pct(x.theirFound)} · ${refName} nearer ${pct(x.nearer)}` })),
      { better: 'higher', fmt: (v) => pts(v), axisFmt: (v) => (v === 0 ? '0' : pts(v, 0)), unit: ` found it, ${refName} less the other` });
    const e3 = document.getElementById('ln-grid');
    if (e3) C.scoreGrid(e3, gr.who.map(short), [...gr.stats, ALL_STATS], cells.map((c) => ({ ...c, who: c.x, x: short(c.x) })), { fmt: CHART_FMT[measure], better: M.better, min: 10, onClick: (c) => openCell(ctx, inComp, c.y, c.who) });
    const e4 = document.getElementById('ln-weeks');
    if (e4) C.groupedBars(e4, weekKeys.map((k) => `w/c ${dayLabel(k, false)}`), weeks.map((s) => {
      const by = new Map(s.pts.map((p) => [p.week, p]));
      return { name: short(s.who), color: colour(s.who), data: weekKeys.map((k) => (by.has(k) ? M.get(by.get(k)) : null)) };
    }), { fmt: CHART_FMT[measure], height: 230 });
    const e5 = document.getElementById('ln-spread');
    if (e5 && spreadWho.length) {
      const cats = Array.from({ length: 13 }, (_, i) => i - 6);
      const label = (k) => (k === -6 ? '≤−6' : k === 6 ? '≥+6' : k > 0 ? `+${k}` : String(k));
      C.groupedBars(e5, cats.map(label), spreadWho.map((x) => {
        const m = new Map(missSpread(x.rows));
        return { name: x.who, color: colour(x.who), data: cats.map((k) => (m.get(k) || 0) / x.n) };
      }), { fmt: (v) => `${Math.round(v * 100)}%`, height: 240 });
    }
    const e6 = document.getElementById('ln-bank');
    if (e6 && run.pts.length) {
      const series = [run, style === 'level' ? null : total.level, style === 'staked' || setId === 'real' ? null : total.staked].filter(Boolean)
        .map((r, i) => ({ name: r.label, color: i === 0 ? t.s1 : i === 1 ? t.muted : t.s3, pts: r.pts.map((p) => [Date.parse(p.day), p.bank - 1000, dayLabel(p.day)]) }));
      e6.style.height = '230px';
      C.runningChart(e6, series, { area: series.length === 1 });
    }
  };
  return { html, mount };
}

// the page's own sums against line_judge.py's, on the whole of a sport (or all): the board must count as the script does
function checkLine(L, S, stat, comp, board) {
  if (S.range !== 'all' || stat !== 'all' || comp !== 'all') return '';
  const s = L.summary?.[S.lineSport === 'all' ? 'all' : S.lineSport];
  if (!s) return '';
  const bad = board.filter((x) => { const p = s.each?.[x.who]; return !p || p.n !== x.n || Math.abs(p.found - x.found) > 1e-9; });
  return `<p class="check ${bad.length ? 'warn' : 'ok'}">${bad.length ? `⚠ Differs from line_judge.py for ${esc(bad.map((x) => x.who).join(', '))}` : '✓ Matches line_judge.py’s own sums'} (${esc(L.made || '')} UK)${(L.left || []).length ? ` · left out: ${esc(L.left.join('; '))}` : ''}</p>`;
}

// one stat and forecaster: its numbers, how far off it was, and its last counts
function openCell(ctx, rows, statKey, who) {
  const inStat = (r) => statKey === ALL_STATS || r.statKey === statKey;
  const xs = rows.filter((r) => inStat(r) && r.who === who).sort((a, b) => (b.day || '').localeCompare(a.day || ''));
  if (!xs.length) return;
  const ours = new Map(rows.filter((r) => inStat(r) && r.who === OURS).map((r) => [r.g, r]));
  const s = byWho(xs)[0];
  const list = xs.slice(0, 40).map((r) => {
    const o = who !== OURS ? ours.get(r.g) : null;
    return `<div class="bet-line static"><span class="bl-main"><span class="bl-bet">${esc(r.match)}</span><span class="bl-match muted">${esc(dayLabel(r.day))} · ${esc(compName(r.comp))}${o ? ` · ours ${num(o.line, 1)}` : ''}</span></span>
      <span class="bl-side"><span class="muted small">line</span> <b>${num(r.line, 1)}</b> <span class="muted small">came</span> <b>${num(r.count, 0)}</b> <span class="st ${r.found ? 'st-won' : r.close ? 'st-open' : 'st-lost'}">${r.found ? 'found' : r.close ? 'close' : 'off'}</span></span></div>`;
  }).join('');
  ctx.sheet(`${statKey} · ${who}`, `<dl class="facts">
      <div><dt>Counts</dt><dd>${int(s.n)} in ${int(s.matches)} matches</dd></div><div><dt>Found it</dt><dd>${pct(s.found)}</dd></div>
      <div><dt>Close</dt><dd>${pct(s.close)} <span class="muted small">(within ${statKey === ALL_STATS ? 'each stat’s own band' : num(xs[0].half, 2)})</span></dd></div>
      <div><dt>Average miss</dt><dd>${num(s.miss, 2)}</dd></div><div><dt>Lean</dt><dd>${signed(s.lean)} <span class="muted small">${s.lean > 0.3 ? 'counts came above the line' : s.lean < -0.3 ? 'counts came below the line' : 'about level'}</span></dd></div>
    </dl><h3 class="sheet-h">Newest first</h3><div class="lines">${list}</div>${xs.length > 40 ? `<p class="muted small">The newest 40 of ${xs.length}.</p>` : ''}`);
}
