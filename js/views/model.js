// Model: are our chances right (said against won), is our number nearer than the bookmakers' (every line read), where
// did the counts land against the line and our number, and did the price move our way after we took it.

import { esc, money, pct, spct, num, isNum, int } from '../util.js';
import { section, table, goAttr, verdictPill, signClass, chips } from '../ui.js';
import { agg, group, calibration, shownUp, afterPoints, verdict } from '../metrics.js';
import { compName } from '../data.js';
import * as C from '../charts.js';

export function render(ctx) {
  const { D, S, scope } = ctx;
  const rows = scope();
  const g = agg(rows);
  const cal = calibration(rows);
  const share = shownUp(rows);
  const stats = group(rows, 'stat').filter((x) => x.n >= 3 && x.key !== '(not known)');
  const M = D.model || {};

  const head = `<div class="controls">${chips('sport', [{ id: 'football', label: 'Football' }, { id: 'basketball', label: 'Basketball' }, { id: 'tennis', label: 'Tennis' }], S.sport, { small: true })}</div>
  <p class="record-line">In this view: ${g.n} settled. We said <b>${pct(g.said)}</b>, <b>${pct(g.wonPct)}</b> won, the prices needed <b>${pct(g.needed)}</b>.
  ${isNum(g.said) && isNum(g.wonPct) ? (g.wonPct >= g.needed ? 'They landed more often than the prices needed.' : 'They landed less often than the prices needed.') : ''}</p>`;

  const calCard = section('Did we say the right chances?', `<div class="chart" id="ch-cal2"></div>`, { sub: 'Bets grouped by the chance we gave them. On the grey line our chance was right; the diamonds are what the prices needed. A dot under the line: we said too much.' });
  const byStat = section('Said, needed and won, by stat', `<div class="chart" id="ch-said"></div>`, { sub: 'Tap a stat to open its slice.' });

  let shareCard = '';
  if (share.n >= 5) {
    shareCard = section('How much of our gap showed up', `<div class="big-line"><b>${pct(share.share)}</b> <span class="muted">± ${pct(share.se)} on ${share.n} settled stat picks</span></div>
      <p>Of the distance between the bookmaker's number and ours, this much showed up in the counts. 100% means our number was right on average, 0% the bookmaker's; the stakes assume 50%. ${share.share > 0.5 + share.se ? 'More than the stakes assume.' : share.share < 0.5 - share.se ? 'Less than the stakes assume: a reason to pull our chances toward the bookmakers’.' : 'Within reach of what the stakes assume.'}</p>`);
  }

  const after = afterPoints(rows);
  const afterCard = after.length >= 5 ? section('Where the counts landed', `<div class="chart" id="ch-after"></div>
    <p class="muted small">Each settled stat pick. Across: how far past the line we put our number; up: how far past the line the count finished (both in the stat's usual swings). Above zero won. Far to the right and still below zero is where our number was wrong.</p>
    ${table({ id: 't-margin', cols: marginCols(), rows: group(rows.filter((r) => r.settled && r.margin && !['bet builder', 'void'].includes(r.margin)), 'margin'), rowGo: (r) => ({ tab: 'slices', rows: 'margin', cols: 'landed', f: {} }), sort: ctx.sortOf('t-margin') })}`, { sub: 'A very close result says little about who was right; far ones say whose number was nearer.' }) : '';

  // the price afterwards, on first showings: the nearest thing to beating the closing price
  const fs = ctx.scope({ set: S.sport === 'football' ? 'first' : S.set }).filter((r) => isNum(r.beat));
  let clvCard = '';
  if (fs.length >= 8) {
    const bandOf = (b) => (b > 0.03 ? 'shortened 3% or more' : b < -0.03 ? 'drifted 3% or more' : 'about the same');
    const gs = ['shortened 3% or more', 'about the same', 'drifted 3% or more'].map((k) => ({ key: k, ...agg(fs.filter((r) => bandOf(r.beat) === k)) }));
    clvCard = section('The price after we took it', `<div class="chart" id="ch-clv"></div>
      ${table({ id: 't-clv', cols: [{ key: 'key', label: 'Later price' }, { key: 'bets', label: 'Picks', num: true, fmt: int }, { key: 'n', label: 'Settled', num: true, fmt: int }, { key: 'wonPct', label: 'Won %', num: true, fmt: (v) => pct(v) }, { key: 'needed', label: 'Needed', num: true, fmt: (v) => pct(v) }, { key: 'ret', label: 'Return', num: true, fmt: (v) => `<span class="${signClass(v)}">${spct(v)}</span>` }], rows: gs })}`,
    { sub: 'First showings against the last price read before kick-off at the same bookmaker. A price that shortens after we take it is the earliest sign a pick was right; it is the last price we happened to read, not a true closing price.' });
    ctx.clvRows = gs;
  }

  // our number against each bookmaker's on every line read (logs/who_forecasts.json)
  const brier = M.who_forecasts?.brier || {};
  // ours against each bookmaker's (the "X against Y" rows compare two bookmakers with each other: not this chart)
  const shortLabel = (k) => k.replace('Pamestoixima', 'Pame').replace('Stoiximan', 'Stoix').replace(' / ', ' · ');   // fits a phone's label column
  const who = Object.entries(brier).filter(([k, v]) => v && isNum(v.gap) && !k.includes(' against ')).map(([k, v]) => ({ label: shortLabel(k), value: v.gap, lo: v.low, hi: v.high, sub: `${esc(k)}: ${int(v.lines)} lines, ${int(v.matches)} matches · ours ${num(v.ours, 4)} against theirs ${num(v.theirs, 4)}` }));
  const whoCard = who.length ? section('Our number against the bookmakers’', `<div class="chart" id="ch-who"></div>`,
    { sub: `Every line read and settled (${int(M.who_forecasts?.lines)} lines, ${int(M.who_forecasts?.matches)} matches): our Brier score minus the bookmaker's. Left of zero (green) our chance was nearer what happened; the whisker is its 95% range.` }) : '';

  // the bookmakers' own lines backed blind (ledger/lines_summary.csv)
  const lines = (M.lines || []).filter((x) => x.by === 'bookmaker+stat');
  const linesCard = lines.length ? section('The bookmakers’ own lines, backed blind', table({ id: 't-lines', rows: lines.map((x) => ({ ...x, key: `${x.bookmaker} · ${x.stat}`, v: verdict(x.ret, x.luck, x.n) })), sort: ctx.sortOf('t-lines', { key: 'ret', desc: true }), cols: [
    { key: 'key', label: 'Bookmaker · stat' }, { key: 'n', label: 'Lines', num: true, fmt: int }, { key: 'landed', label: 'Landed', num: true, fmt: (v) => pct(v) },
    { key: 'said', label: 'They said', num: true, fmt: (v) => pct(v) }, { key: 'ours', label: 'We said', num: true, fmt: (v) => pct(v) },
    { key: 'ret', label: 'Return, level', num: true, fmt: (v) => `<span class="${signClass(v)}">${spct(v)}</span>` }, { key: 'luck', label: 'Luck ±', num: true, fmt: (v) => '±' + pct(v) },
    { key: 'v', label: 'Reading', fmt: (v) => verdictPill(v.word), sortVal: (r) => r.v.z ?? -99 }] }),
  { sub: 'Every stat line read at 1.30 to 3.49, at its last price, backed at level stakes: where a bookmaker’s price runs long. The lines of one match win and lose together, so luck is wide.' }) : '';

  // live lines (logs/live_record.json)
  const lr = M.live_record;
  const liveCard = lr ? section('Live lines on paper', `<div class="tiles tiles-3">${['flagged', 'bar', 'tests'].filter((k) => lr[k]).map((k) => `<div class="tile"><div class="tile-label">${k === 'flagged' ? 'Every line flagged' : k === 'bar' ? 'Over the live bar' : 'Half-time tests'}</div><div class="tile-value"><span class="${signClass(lr[k].return)}">${spct(lr[k].return)}</span></div><div class="tile-sub">${int(lr[k].n)} lines · landed ${pct(lr[k].landed)} · we said ${pct(lr[k].said)}</div></div>`).join('')}</div>`,
    { sub: `As the night’s live review counted them (${esc(lr.made || '')}). Live suggestions are sent only at 50% and over, in calm games.` }) : '';

  // tennis's real-money gate (logs/tennis_record.json)
  const tr = M.tennis_record?.gate;
  const tennisCard = S.sport === 'tennis' && tr ? section('Tennis: the real-money gate', `<p>Our chance nearer than Superbet's on ${int(tr.ours_nearer)} of ${int(tr.matches)} matches; Brier gap ${num(tr.brier_gap, 4)} (±${num(2 * (tr.se || 0), 4)}). Gate: ${tr.passed ? '<b class="pos">passed</b>' : '<b>not yet</b>'} (the user's bar: 300 matches, beyond luck, picks in profit).</p>`) : '';

  const html = head + calCard + byStat + shareCard + clvCard + afterCard + whoCard + linesCard + liveCard + tennisCard;
  const mount = () => {
    const t = C.tokens();
    const e1 = document.getElementById('ch-cal2');
    if (e1) C.calibrationChart(e1, cal);
    const e2 = document.getElementById('ch-said');
    if (e2 && stats.length) C.groupedBars(e2, stats.map((x) => x.key), [
      { name: 'We said', color: t.s1, data: stats.map((x) => x.said) },
      { name: 'Prices needed', color: t.muted, data: stats.map((x) => x.needed) },
      { name: 'Won', color: t.s3, data: stats.map((x) => x.wonPct) },
    ], { onClick: (p) => ctx.go({ tab: 'slices', f: { stat: [p.name] }, rows: 'side', cols: 'book' }) });
    const e3 = document.getElementById('ch-after');
    if (e3) C.scatter(e3, after.map((p) => ({ x: p.x, y: p.y, color: p.r.w ? t.good : t.bad, r: p.r,
      tip: `<b>${esc(p.r.bet)}</b><div style="color:${t.muted};font-size:11px">${esc(p.r.match)} · we expected ${num(p.r.expected, 1)}, they priced ${num(p.r.theirs, 1)}, it came to ${esc(p.r.actual)} · ${esc(p.r.status)}</div>` })),
    { xName: 'our number past the line (swings)', yName: 'the count past the line', onClick: (p) => ctx.bet(p.r.id) });
    const e4 = document.getElementById('ch-who');
    if (e4) C.dotWhisker(e4, who.sort((a, b) => a.value - b.value));
    const e5 = document.getElementById('ch-clv');
    if (e5 && ctx.clvRows) C.bars(e5, ctx.clvRows.map((x) => ({ label: x.key, value: x.bets, color: x.key.startsWith('short') ? t.good : x.key.startsWith('drift') ? t.bad : t.muted, sub: `${x.n} settled · return ${spct(x.ret)}` })), { fmt: C.FMT.n, signed: false, height: 150 });
  };
  return { html, mount };
}

function marginCols() {
  return [
    { key: 'key', label: 'How close' }, { key: 'n', label: 'Settled', num: true, fmt: int }, { key: 'wonPct', label: 'Won %', num: true, fmt: (v) => pct(v) },
    { key: 'needed', label: 'Needed', num: true, fmt: (v) => pct(v) }, { key: 'said', label: 'We said', num: true, fmt: (v) => pct(v) },
    { key: 'ret', label: 'Return', num: true, fmt: (v) => `<span class="${signClass(v)}">${spct(v)}</span>` },
  ];
}
