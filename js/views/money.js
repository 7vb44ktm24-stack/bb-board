// Money: the real tickets (euros, only what was pasted from the bookmakers' own histories, never mixed with paper), the
// real-money plan as placeable beside paper, the parlay families' own records and the bookmakers' caps. Its Accounts part:
// how sharp each bookmaker can see the account is (the heat), what its own pages say (profit and loss, cash in and out, the
// feed's account_books) and the runs of the same ticket placed again (19 Oct 2026).

import { esc, money, pct, spct, odds, int, isNum, dayLabel, fromGreek, ukDay, ukHM, ukStamp } from '../util.js';
import { tile, section, table, chips, goAttr, signClass, bookChip, statusTag, verdictPill } from '../ui.js';
import { agg, group } from '../metrics.js';
import { realInsights, realSum, ticketStacks, ownBook, shortTicket, spanLabel } from '../insights.js';
import { distinctParlays } from '../lines.js';
import { insightCard } from './today.js';
import * as C from '../charts.js';

const VIEWS = [
  { id: 'groups', label: 'Group', key: 'group' }, { id: 'source', label: 'Source', key: 'source' }, { id: 'book', label: 'Bookmaker', key: 'book' },
  { id: 'sport', label: 'Sport', key: 'sport' }, { id: 'kind', label: 'Kind', key: 'kind' }, { id: 'legs', label: 'Legs', key: 'legsBand' },
  { id: 'size', label: 'Stake', key: 'sizeBand' }, { id: 'price', label: 'Price', key: 'priceBand' }, { id: 'week', label: 'Week', key: 'week' },
];
// groups say what the bet is in every sport since 19 Oct 2026 (the user's choice; "Other sports" is gone), the sport its own cut
const ORDER = { group: ['Model', 'Stats', 'Builders', 'Fun', 'Live'], legsBand: ['1 (single)', '2', '3', '4 to 5', '6 or more', 'not known'], kind: ['single', 'parlay', 'builder'],
  source: ['model', 'part model', 'paper pick', 'part paper pick', 'own'], sport: ['football', 'tennis', 'basketball'],
  sizeBand: ['free bet', 'under €10', '€10 to €24', '€25 to €49', '€50 to €99', '€100 and more'],
  priceBand: ['under 2.00', '2.00 to 2.99', '3.00 to 4.99', '5.00 to 9.99', '10.00 and more', 'not known'] };
const SOURCE_WORD = { model: 'every leg a real-money pick', 'part model': 'some legs real-money picks', 'paper pick': 'paper-only picks: not approved for real money',
  'part paper pick': 'some legs paper-only picks: not approved for real money', own: 'your own reading' };
const PAPER = new Set(['paper pick', 'part paper pick']);

const sizeBand = (t) => (t.free || !(t.cash > 0) ? 'free bet' : t.cash < 10 ? 'under €10' : t.cash < 25 ? '€10 to €24' : t.cash < 50 ? '€25 to €49' : t.cash < 100 ? '€50 to €99' : '€100 and more');
const priceBand = (t) => (!isNum(t.price) ? 'not known' : t.price < 2 ? 'under 2.00' : t.price < 3 ? '2.00 to 2.99' : t.price < 5 ? '3.00 to 4.99' : t.price < 10 ? '5.00 to 9.99' : '10.00 and more');
const eurSigned = (v) => `${v < 0 ? '−' : v > 0 ? '+' : ''}€${Math.abs(Math.round(v)).toLocaleString('en-GB')}`;

function realAgg(ts) {
  const done = ts.filter((t) => t.settled);
  const staked = done.reduce((s, t) => s + (t.cash || 0), 0), back = done.reduce((s, t) => s + (t.back || 0), 0);
  const open = ts.filter((t) => t.status === 'open');
  const r = realSum(ts);
  return { n: done.length, won: done.filter((t) => t.status === 'won').length, staked, back, profit: back - staked, ret: staked ? (back - staked) / staked : null,
    luck: r.luck, verdict: r.verdict, more: r.more, open: open.length, openStake: open.reduce((s, t) => s + (t.cash || 0), 0), tickets: ts.length };
}

export function render(ctx) {
  const { D, S } = ctx;
  const inRange = (day) => ctx.inRange(day);
  const tickets = D.tickets.filter((t) => !t.day || inRange(t.day)).map((t) => ({ ...t, sizeBand: sizeBand(t), priceBand: priceBand(t), sport: t.sport || 'football' }));
  const g = realAgg(tickets);
  const view = VIEWS.find((v) => v.id === S.moneyView) || VIEWS[0];
  const groups = (() => {
    const m = new Map();
    for (const t of tickets) { const k = t[view.key] || 'not known'; if (!m.has(k)) m.set(k, []); m.get(k).push(t); }
    const keys = [...m.keys()];
    const ord = ORDER[view.key];
    keys.sort(ord ? (a, b) => (ord.indexOf(a) + 1 || 99) - (ord.indexOf(b) + 1 || 99) : view.key === 'week' ? undefined : (a, b) => m.get(b).length - m.get(a).length);
    return keys.map((k) => ({ key: k, ...realAgg(m.get(k)) }));
  })();
  const dates = tickets.map((t) => t.day).filter(Boolean).sort();
  const AB = D.feed.account_books || {};

  const note = `<p class="note">Real money, in euros, as the bookmakers’ own bet histories show it. Only what was pasted is here${dates.length ? ` (${dayLabel(dates[0], false)} to ${dayLabel(dates[dates.length - 1], false)})` : ''}; never added to the paper account.</p>`;
  // the top third (the user, 30 Oct 2026: "the top 1/3 of the screen must hold the best, visually scannable info"): the four numbers
  // first, a ticket waiting on the user and the curve open, the rest below folded on every screen, nothing removed
  const tiles = `<div class="tiles tiles-top">
    ${tile({ label: 'Profit', value: `<span class="${signClass(g.profit)}">${money(g.profit, '€')}</span>`, sub: `on ${money(g.staked, '€', 0, false)} staked`, spark: 'sp-real' })}
    ${tile({ label: 'Return', value: `<span class="${signClass(g.ret)}">${spct(g.ret, 1)}</span>`, sub: `${isNum(g.luck) ? `luck ±${pct(g.luck)} ` : ''}${g.n ? verdictPill(g.verdict, g.more) : ''}` })}
    ${tile({ label: 'Tickets won', value: `${int(g.won)}<span class="muted"> of ${int(g.n)}</span>`, sub: g.n ? `${pct(g.won / g.n)} of settled tickets` : '' })}
    ${tile({ label: 'Open', value: int(g.open), sub: `${money(g.openStake, '€', 0, false)} staked` })}
  </div>
  ${(() => {
    const c = (D.feed.reconcile || []).find((x) => x.set === 'Real money (euros)');
    if (!c || S.range !== 'all') return '';
    return `<p class="check ${c.agree ? 'ok' : 'warn'}">${c.agree ? '✓ Matches its record' : '⚠ Differs from its record'}: ${esc(c.record)} says ${int(c.headline.settled)} tickets settled, ${int(c.headline.won)} won, ${money(c.headline.profit, '€', 2)} on ${money(c.headline.staked, '€', 2, false)}.</p>`;
  })()}`;

  const curve = section('Real money over time', `<div class="chart" id="ch-real"></div>`, { sub: 'Settled tickets in the order they were placed. A few large tickets carry real money: read it with its count of tickets and wins.' });
  const cuts = section('Cut by', `${chips('moneyView', VIEWS, view.id, { small: true })}<div class="chart" id="ch-realcut"></div>
    ${table({ id: 't-real', sort: ctx.sortOf('t-real'), rows: groups, cols: [
      { key: 'key', label: view.label, fmt: (v) => (view.key === 'book' ? bookChip(v) : view.key === 'week' ? 'w/c ' + esc(dayLabel(v, false)) : view.key === 'source' ? `${esc(v)} <span class="muted small">${esc(SOURCE_WORD[v] || '')}</span>` : esc(v)) },
      { key: 'n', label: 'Settled', num: true, fmt: int }, { key: 'won', label: 'Won', num: true, fmt: int },
      { key: 'staked', label: 'Staked', num: true, fmt: (v) => money(v, '€', 0, false) }, { key: 'back', label: 'Back', num: true, fmt: (v) => money(v, '€', 0, false) },
      { key: 'profit', label: 'Profit', num: true, fmt: (v) => `<span class="${signClass(v)}">${money(v, '€')}</span>` },
      { key: 'ret', label: 'Return', num: true, fmt: (v, r) => `<b class="${signClass(v)}">${spct(v)}</b>${isNum(r.luck) ? ` <span class="muted small">±${pct(r.luck)}</span>` : ''}` },
      { key: 'verdict', label: 'Luck says', fmt: (v, r) => (r.n ? verdictPill(v, r.more) : '') }, { key: 'open', label: 'Open', num: true, fmt: int }] })}`,
  { fold: 'money.cuts', wide: true, sub: 'Groups follow the record’s rule (ledger/TRACKING.md): the first that fits of model, builders, fun and stats, in every sport; a tag can make one live. Source: real-money picks, paper-only picks (tennis, basketball, lines kept back: not approved for real money), or your own reading. ± is what luck alone would do to the return at that size.' });

  const ins = realInsights(tickets, { full: true, books: AB });
  const insCard = ins.length ? section('What the tickets say', `<div class="insights">${ins.map(insightCard).join('')}</div>`, { fold: 'money.insights', wide: true }) : '';

  // tickets whose record waits on the user (a payout to confirm, a "to ask" in the tags)
  const asks = tickets.filter((t) => t.confirm || /to ask/i.test(t.note || ''));
  const askCard = asks.length ? section(`Waiting on you (${asks.length})`, `<div class="lines">${asks.map((t) => `<div class="bet-line static"><span class="bl-main"><span class="bl-bet">${esc(shortTicket(t.selections, 110))}</span>
      <span class="bl-match muted">${esc(t.placed ? ukStamp(t.placed.slice(0, 16)) : '?')} · ${money(t.cash, '€', 2, false)} · ${esc(t.confirm || t.note || '')}</span></span>
      <span class="bl-side">${bookChip(t.book)}${statusTag(t.status)}</span></div>`).join('')}</div>`,
  { sub: 'Tell Claude in the chat: the record keeps them as the page showed them until you say.' }) : '';

  // folded: 136 tickets made the tab 17,000 px long on a phone (18 Oct 2026)
  const list = section(`Every ticket (${tickets.length})`, `<details class="fold"><summary>Open the list, newest first</summary><input type="search" class="search" placeholder="Search a team, a market, a bookmaker" data-search="t-tix" aria-label="Search the tickets">
    ${table({ id: 't-tix', sort: ctx.sortOf('t-tix', { key: 'placed', desc: true }), max: 500, dense: true, rows: tickets, cols: [
      { key: 'placed', label: 'Placed', fmt: (v) => esc(v ? ukStamp(v.slice(0, 16)) : '?') }, { key: 'book', label: 'At', fmt: (v) => bookChip(v) },
      { key: 'group', label: 'Group', fmt: (v, r) => `${esc(v || '')}${r.sport && r.sport !== 'football' ? ` <span class="muted small">${esc(r.sport)}</span>` : ''}${r.source && r.source !== 'own' ? ` <span class="tag">${esc(r.source)}</span>` : ''}${PAPER.has(r.source) ? ' <span class="tag tag-warn">not approved for real money</span>' : ''}` },
      { key: 'legs', label: 'Legs', num: true, fmt: int }, { key: 'price', label: 'Price', num: true, fmt: odds },
      { key: 'cash', label: 'Stake', num: true, fmt: (v, r) => money(v, '€', 2, false) + (r.free ? ' <span class="tag">free</span>' : '') },
      { key: 'status', label: 'Result', fmt: (v) => statusTag(v) }, { key: 'profit', label: 'Profit', num: true, fmt: (v) => `<span class="${signClass(v)}">${isNum(v) ? money(v, '€', 2) : ''}</span>` },
      { key: 'selections', label: 'Selections', cls: 'wrap', fmt: (v) => `<span class="small">${esc((v || '').slice(0, 160))}</span>` }] })}</details>`, { fold: 'money.tickets', wide: true });

  // the real-money plan as placeable, beside the same selections at paper stakes
  const place = ctx.scope({ sport: 'football', set: 'placeable', ignoreFilters: true });
  const gp = agg(place);
  const paperSide = agg(place.filter((r) => r.part === 'main').map((r) => ({ ...r, stake: r.paper, profit: r.paper_profit })));
  const parts = group(place, 'part');
  const placeCard = place.length ? section('As placeable: the plan after the caps', `<div class="tiles tiles-3">
      ${tile({ label: 'As placeable', value: `<span class="${signClass(gp.profit)}">${money(gp.profit)}</span>`, sub: `${spct(gp.ret)} on ${money(gp.staked, '£', 0, false)}, ${gp.n} settled parts`, go: { tab: 'results', sport: 'football', set: 'placeable' } })}
      ${tile({ label: 'Same picks at paper stakes', value: `<span class="${signClass(paperSide.profit)}">${money(paperSide.profit)}</span>`, sub: `${spct(paperSide.ret)} on ${money(paperSide.staked, '£', 0, false)}` })}
      ${tile({ label: 'Open parts', value: int(gp.open), sub: `${money(gp.openStake, '£', 0, false)} to place` })}
    </div>
    ${table({ id: 't-parts', rows: parts, sort: ctx.sortOf('t-parts'), cols: [{ key: 'key', label: 'Part' }, { key: 'n', label: 'Settled', num: true, fmt: int }, { key: 'won', label: 'Won', num: true, fmt: int }, { key: 'staked', label: 'Placed', num: true, fmt: (v) => money(v, '£', 0, false) }, { key: 'profit', label: 'Profit', num: true, fmt: (v) => `<span class="${signClass(v)}">${money(v)}</span>` }, { key: 'ret', label: 'Return', num: true, fmt: (v) => spct(v) }, { key: 'open', label: 'Open', num: true, fmt: int }] })}`,
  { fold: 'money.placeable', wide: true, sub: 'Pounds on the plan’s amounts: the part at the pick’s own bookmaker after the 500 day cap and its cap, the parts moved to another bookmaker’s line, and a blocked part in a double.' }) : '';

  // the parlay families, each its own record
  const fams = (() => {
    const m = new Map();
    for (const p of D.parlays.filter((x) => !x.day || inRange(x.day))) { const k = p.family; if (!m.has(k)) m.set(k, []); m.get(k).push(p); }
    return [...m].map(([k, all]) => {
      const ps = distinctParlays(all);                              // a parlay two of the family's rules both picked counts once
      const done = ps.filter((p) => p.settled);
      const staked = done.reduce((s, p) => s + (p.stake || 0), 0), profit = done.reduce((s, p) => s + (p.profit || 0), 0);
      return { key: k, tickets: ps.length, n: done.length, won: done.filter((p) => p.status === 'won').length, staked, profit, ret: staked ? profit / staked : null, open: ps.filter((p) => p.status === 'open').length, rows: ps };
    });
  })();
  const famCard = fams.length ? section('Parlays and doubles, each its own record', table({ id: 't-fam', rows: fams, sort: ctx.sortOf('t-fam'), rowGo: null, cols: [
    { key: 'key', label: 'Family', fmt: (v) => `<button type="button" class="link" data-family="${esc(v)}">${esc(v)}</button>` }, { key: 'n', label: 'Settled', num: true, fmt: int }, { key: 'won', label: 'Won', num: true, fmt: int },
    { key: 'staked', label: 'Staked', num: true, fmt: (v) => money(v, '£', 0, false) }, { key: 'profit', label: 'Profit', num: true, fmt: (v) => `<span class="${signClass(v)}">${money(v)}</span>` },
    { key: 'ret', label: 'Return', num: true, fmt: (v) => `<b class="${signClass(v)}">${spct(v)}</b>` }, { key: 'open', label: 'Open', num: true, fmt: int }] }),
  { fold: 'money.families', wide: true, sub: 'On paper at their own stakes: the sent doubles and parlays by rule, the covered trebles, and the fun and goals parlays (your own wagering, never picks). A parlay two rules of one family both picked counts once here; each rule’s own record keeps it.' }) : '';
  ctx.families = fams;

  // the weekly stake checks: how much each bookmaker lets you stake now, against the first reading (logs/stake_checks.csv)
  const checks = (D.feed.accounts || []).filter((c) => c.bookmaker && c.kind);
  let accountsCard = '';
  if (checks.length) {
    const m = new Map();
    for (const c of checks) {
      const k = `${c.bookmaker}|${c.kind}`;
      if (!m.has(k)) m.set(k, []);
      m.get(k).push(c);
    }
    const rows = [...m.values()].map((g) => {
      g.sort((a, b) => String(a.checked).localeCompare(String(b.checked)));
      const first = g[0], last = g[g.length - 1];
      const change = isNum(+first.most) && +first.most ? (+last.most - +first.most) / +first.most : null;
      return { book: last.bookmaker, kind: last.kind, most: +last.most, first: +first.most, change, checked: last.checked, n: g.length, note: last.note };
    }).sort((a, b) => a.book.localeCompare(b.book) || a.kind.localeCompare(b.kind));
    accountsCard = section('Your accounts: the most you can stake', table({ id: 't-acc', rows, sort: ctx.sortOf('t-acc'), cols: [
      { key: 'book', label: 'Bookmaker', fmt: (v) => bookChip(v) }, { key: 'kind', label: 'Market', fmt: (v) => esc(v === 'result' ? 'result (home win)' : v) },
      { key: 'most', label: 'Now', num: true, fmt: (v) => int(v) }, { key: 'first', label: 'First check', num: true, fmt: (v) => int(v) },
      { key: 'change', label: 'Change', num: true, fmt: (v) => `<span class="${signClass(v)}">${isNum(v) ? spct(v) : '–'}</span>` },
      { key: 'checked', label: 'Checked', fmt: (v) => esc(String(v || '').slice(0, 16)) }, { key: 'n', label: 'Checks', num: true, fmt: int }] }),
    { fold: 'acc.checks', wide: true, sub: 'From the weekly stake checks (logs/stake_checks.csv; the full verdicts in ledger/accounts.md). A falling maximum is the first sign a bookmaker is limiting the account: the reason masking matters.' });
  }

  const caps = (D.model.caps || []);
  const capsCard = caps.length ? section('Bookmakers’ caps', `<ul class="plain">${caps.map((c) => `<li>${bookChip(c.bookmaker || c.book)} <b>${esc(c.stat || '')}</b> at most <b>${int(+c.most || +c.max || 0)}</b> <span class="muted">${esc(c.when || c.day || '')} ${esc(c.noted || c.since || '')}</span></li>`).join('')}</ul>`, { fold: 'acc.caps', wide: true, sub: 'From logs/book_caps.csv: the plan places up to each cap and moves the rest.' }) : '';

  // the account's heat (ledger/accounts.md, the football chat's of 18 Oct 2026): what each bookmaker can read from the account
  const H = D.feed.heat || {};
  const heatTone = (s) => (/near certain/.test(s) ? 'bad' : /likely/.test(s) ? 'warn' : /lean/.test(s) ? 'note' : 'quiet');
  const heatCard = (H.heat || []).length ? section('How sharp you look to each bookmaker', `
    <div class="heat">${H.heat.map((h) => `<div class="heat-row heat-${heatTone(h['How sure it can be'] || '')}">
      <div class="heat-top">${bookChip(h.Bookmaker)}<span class="heat-word">${esc(h['How sure it can be'] || '-')}</span></div>
      <div class="heat-facts"><span><b>${esc(h['Cut 3%+ after'] || '-')}</b> of ${esc(h['With a later price'] || '0')} bets cut after</span><span>average move <b>${esc(h['Average move'] || '-')}</b></span><span>paid you <b>${esc(h['Real money paid out, 28 days'] || '-')}</b> in 28 days</span></div>
    </div>`).join('')}</div>
    ${H.spare ? `<p class="note"><b>${esc(H.spare.split(':')[0])}:</b>${esc(H.spare.slice(H.spare.indexOf(':') + 1))}</p>` : ''}
    ${H.paid ? `<p class="muted small">${esc(H.paid)}</p>` : ''}
    ${H.look ? `<p class="note"><b>How sharp we look:</b> ${esc(H.look)}</p>` : ''}
    ${(H.sources || []).length ? `<details class="fold"><summary>Where the trail comes from</summary>${table({ id: 't-trail', rows: H.sources.map((s) => ({ ...s, key: s.Bookmaker })), cols: [
      { key: 'Bookmaker', label: 'Bookmaker', fmt: (v) => bookChip(v) }, { key: 'Kind', label: 'Kind' }, { key: 'Bets', label: 'Bets', num: true },
      { key: 'Cut 3%+ after', label: 'Cut after', num: true }, { key: 'Average move', label: 'Average move', num: true }] })}</details>` : ''}
    <div class="sheet-actions"><button type="button" class="btn-copy" data-copy="${esc(`From ledger/accounts.md, the account's heat: ${(H.heat || []).map((h) => `${h.Bookmaker} ${h['How sure it can be']} (cut after ${h['Cut 3%+ after']} of ${h['With a later price']} bets, average ${h['Average move']}, paid out ${h['Real money paid out, 28 days']} in 28 days)`).join('; ')}. ${H.spare || ''} ${H.look ? `How sharp we look: ${H.look} ` : ''}Propose how to cool the hottest account within my rules (the best-value line never swapped for a weaker one, placed on the match day only, the stake rules as they are) and the 4% masking budget (the loud kinds placed later, popular-market cover bets near the sharp fair price; reports/camouflage_20261023.md has the last replay) and test it on paper first, old against new. Keep the paper account as the headline and give each figure its luck band.`)}">Copy request: cool the hottest account</button></div>`,
  { fold: 'acc.heat', wide: true, sub: 'From the record (ledger/accounts.md): for the bets the plan placed, how often the price was cut after you bet, the thing a risk team scores. How sure it can be that you beat its prices: under 1 can’t tell yet, 1 a lean, 2 likely, 3 near certain.' }) : '';

  // the tab in two parts (19 Oct 2026, the user's "accounts view"): the money, and the accounts as each bookmaker sees them
  const part = S.moneyPart === 'accounts' ? 'accounts' : 'money';
  const partBar = `<div class="part-switch">${chips('moneyPart', [{ id: 'money', label: 'Money' }, { id: 'accounts', label: 'Accounts' }], part)}</div>`;
  if (part === 'accounts') {
    const A = accountsPart(ctx);
    const B = booksPart(ctx, AB, H);
    const stacks = stacksCard(ctx);
    // the top third (30 Oct 2026): each bookmaker's heat as a tile, how sure it can be that you beat its prices; the cards below folded
    const heatTiles = Object.entries(H.books || {}).filter(([, x]) => x && x.with_price).sort((a, b) => (b[1].t ?? -9) - (a[1].t ?? -9));
    const top = heatTiles.length ? `<div class="tiles tiles-top">${heatTiles.map(([b, x]) => tile({ label: b, value: esc(x.sure || 'too few yet'),
      sub: `${isNum(x.t) && x.sure ? `${x.t.toFixed(2)} · ` : ''}${int(x.with_price)} bets read again after` })).join('')}</div>` : '';
    return { html: partBar + top + A.intro + B.html + heatCard + stacks + A.html + accountsCard + capsCard, mount: () => { A.mount(); B.mount(); } };
  }
  const placedCard = placedSection(ctx);
  const html = partBar + tiles + askCard + curve + heatLine(H) + booksLine(AB) + note + cuts + insCard + placedCard + placeCard + famCard + list;
  const mount = () => {
    const done = tickets.filter((t) => t.settled && t.placed).sort((a, b) => a.placed.localeCompare(b.placed));
    let total = 0;
    const pts = done.map((t) => { total += t.profit || 0; return [fromGreek(t.placed.slice(0, 16)).getTime(), Math.round(total * 100) / 100, `${t.book} ${t.kind} ${odds(t.price)}: ${t.status} ${money(t.profit, '€', 2)}`]; });
    const el = document.getElementById('ch-real');
    if (el && pts.length) { el.style.height = '230px'; C.runningChart(el, [{ name: 'Real money (€)', pts }], { fmt: eurSigned }); }
    const sp = document.getElementById('sp-real');
    if (sp && pts.length > 2) { sp.style.height = '34px'; C.spark(sp, pts.slice(-40).map((p) => p[1])); }
    const e2 = document.getElementById('ch-realcut');
    if (e2) C.bars(e2, groups.filter((x) => x.n).map((x) => ({ label: view.key === 'week' ? 'w/c ' + dayLabel(x.key, false) : String(x.key), value: x.profit, sub: `${x.won} of ${x.n} won · ${spct(x.ret)}` })),
      { fmt: eurSigned });
  };
  return { html, mount };
}

// one line above the money: how sure each bookmaker can be that the account beats its prices, a tap away from the Accounts part
function heatLine(H) {
  const books = Object.entries((H && H.books) || {}).filter(([, x]) => x && x.with_price);
  if (!books.length) return '';
  return `<p class="heat-line"><button type="button" class="link" data-set="moneyPart" data-value="accounts">How sharp you look:</button> ${books
    .sort((a, b) => (b[1].t ?? -9) - (a[1].t ?? -9)).map(([b, x]) => `${bookChip(b)} <b>${esc(x.sure || 'too few yet')}</b>${isNum(x.t) && x.sure ? ` <span class="muted">(${x.t.toFixed(2)})</span>` : ''}`).join(' · ')}</p>`;
}

// and one line on each bookmaker's own books (its profit and loss page, or the cash in and out): the account as it counts it
function booksLine(AB) {
  const books = Object.entries((AB && AB.books) || {});
  const bits = books.map(([b, x]) => {
    const year = (x.pnl || []).filter((p) => p.kind === 'sports').sort((p, q) => q.days - p.days)[0];
    if (year) return `${bookChip(b)} <b class="${signClass(year.net)}">${money(year.net, '€')}</b> <span class="muted">over ${spanLabel(year.from, year.to)}</span>`;
    if (x.cash) return `${bookChip(b)} <b class="${signClass(x.cash.net)}">${money(x.cash.net, '€')}</b> <span class="muted">cash since ${esc(dayLabel(x.cash.first, false))}</span>`;
    return '';
  }).filter(Boolean);
  if (!bits.length) return '';
  return `<p class="heat-line"><button type="button" class="link" data-set="moneyPart" data-value="accounts">On their own books:</button> ${bits.join(' · ')}</p>`;
}

const HEAT_SURE = (t) => (!isNum(t) ? 'too few yet' : t >= 3 ? 'near certain' : t >= 2 ? 'likely' : t >= 1 ? 'a lean' : "can't tell yet");

// each bookmaker's own pages (19 Oct 2026: the user pasted Stoiximan's profit and loss and Superbet's payments, "so we have
// fat to burn"): what it has made from the account or paid it, the cash in and out over time, and the plain reading
function booksPart(ctx, AB, H) {
  const { D } = ctx;
  const books = Object.entries((AB && AB.books) || {});
  if (!books.length) return { html: '', mount: () => {} };
  const stacks = ticketStacks(D.tickets);
  const pays = AB.payments || [];
  const reads = books.map(([b, x]) => ownBook(b, x, { heat: H.books || {}, stacks, payments: pays }));
  const card = section('On each bookmaker’s own books', `<div class="heat">${reads.map((r) => `<div class="heat-row heat-${r.tone}">
      <div class="heat-top">${bookChip(r.book)}<span class="heat-word">${esc(r.head)}</span></div>
      <ul class="book-lines">${r.lines.map((l) => `<li>${l}</li>`).join('')}</ul>
    </div>`).join('')}</div>
    ${pays.length ? `<div class="chart" id="ch-cash"></div>` : ''}
    ${pays.length ? `<details class="fold"><summary>Every payment pasted (${pays.length})</summary>${table({ id: 't-pay', rows: pays.map((p, i) => ({ ...p, key: `${p.book}|${p.at}|${i}` })), sort: ctx.sortOf('t-pay', { key: 'at', desc: true }), rowGo: null, dense: true, cols: [
      { key: 'at', label: 'When', fmt: (v) => esc(v) }, { key: 'book', label: 'At', fmt: (v) => bookChip(v) }, { key: 'kind', label: 'What', fmt: (v) => esc(v) },
      { key: 'amount', label: 'Amount', num: true, fmt: (v, r) => `<span class="${r.kind === 'withdrawal' ? 'pos' : ''}">${money(r.kind === 'withdrawal' ? v : -v, '€', 2)}</span>` },
      { key: 'status', label: 'Status', fmt: (v) => esc(v) }] })}</details>` : ''}
    <div class="sheet-actions"><button type="button" class="btn-copy" data-copy="${esc(`From the board's Accounts part (the bookmakers' own pages as pasted): ${reads.map((r) => `${r.book}: ${r.head}. ${r.lines.map((l) => l.replace(/<[^>]+>/g, '')).join(' ')}`).join(' ')} How much room does each account have before a limit, and what should change in where and how I place (best value first, within the plan's limits)? Test any change on paper first.`)}">Copy request: how much room is left</button></div>`,
  { fold: 'acc.books', wide: true, sub: `What each bookmaker counts for the whole account, not only the tickets pasted: its profit and loss page, or the deposits and withdrawals with the balance you told. Up means it is paying you; a risk team reads that with the trail below.${AB.made_greek ? ` Read ${esc(dayLabel(ukDay(AB.made_greek), false))} ${esc(ukHM(AB.made_greek))}.` : ''}` });
  const mount = () => {
    const el = document.getElementById('ch-cash');
    if (!el || !pays.length) return;
    const series = [...new Set(pays.map((p) => p.book))].map((b) => {
      let net = 0;
      const pts = pays.filter((p) => p.book === b && (p.status === 'paid' || p.status === 'approved')).map((p) => {
        net += p.kind === 'withdrawal' ? p.amount : -p.amount;
        return [fromGreek(p.at).getTime(), Math.round(net * 100) / 100, `${p.kind === 'withdrawal' ? 'took out' : 'put in'} €${p.amount.toLocaleString('en-GB')} (${ukStamp(p.at)})`];
      });
      return { name: `${b}: taken out less put in`, color: C.bookColor(b), pts };
    }).filter((s) => s.pts.length);
    if (!series.length) return;
    el.style.height = '220px';
    C.runningChart(el, series, { fmt: eurSigned });
  };
  return { html: card, mount };
}

// the same ticket placed again within minutes (insights.ticketStacks): what a review notices, with how each run went
function stacksCard(ctx) {
  const stacks = ticketStacks(ctx.D.tickets);
  if (!stacks.length) return '';
  const copies = stacks.reduce((s, x) => s + x.copies, 0), staked = stacks.reduce((s, x) => s + x.staked, 0), profit = stacks.reduce((s, x) => s + x.profit, 0);
  const byBook = [...new Set(stacks.map((s) => s.book))].map((b) => { const xs = stacks.filter((s) => s.book === b); return `${bookChip(b)} ${xs.length} runs, ${xs.reduce((s, x) => s + x.copies, 0)} tickets`; }).join(' · ');
  // a line a run (a wide table wrapped the tickets' Greek into tall rows on a phone, 19 Oct 2026)
  const line = (s) => `<div class="bet-line static"><span class="bl-main"><span class="bl-bet">${esc(shortTicket(s.selections, 110))}</span>
      <span class="bl-match muted">${esc(s.placed ? ukStamp(s.placed.slice(0, 16)).slice(5) : '?')} · <b>${int(s.copies)} times</b>${s.free ? ` (${s.free} free)` : ''} · ${money(s.staked, '€', 0, false)} at ${isNum(s.lo) && isNum(s.hi) && s.hi - s.lo > 0.004 ? `${odds(s.lo)}–${odds(s.hi)}` : odds(s.lo)}</span></span>
      <span class="bl-side">${bookChip(s.book)}${statusTag(s.status)}<span class="bl-profit ${signClass(s.profit)}">${money(s.profit, '€')}</span></span></div>`;
  return section(`The same ticket placed again (${stacks.length})`, `<p class="heat-line">${byBook}</p>
    <div class="lines">${stacks.slice(0, 8).map(line).join('')}</div>
    ${stacks.length > 8 ? `<details class="fold"><summary>The other ${stacks.length - 8}, older</summary><div class="lines">${stacks.slice(8).map(line).join('')}</div></details>` : ''}`,
  { fold: 'acc.stacks', wide: true, sub: `${copies} tickets in ${stacks.length} runs, ${money(staked, '€', 0, false)} staked, ${money(profit, '€')}: one bookmaker, the same legs whatever the price, each within 15 minutes of the one before. Bookmakers’ reviews look for this; the plan places once up to the cap and moves the rest to another bookmaker’s line. Superbet’s list sometimes shows the time a ticket settled, not when it was placed.` });
}

// the accounts (19 Oct 2026, the user's "accounts view"): how sharp each bookmaker can see the account is, a match day at a
// time, and the markets that feed it; the numbers are logs/account_heat.json's (fm/accounts.py, written in each daily run), the
// card above them and its words ledger/accounts.md's. The caps and the weekly stake checks follow (the render function's cards).
function accountsPart(ctx) {
  const { D } = ctx;
  const H = D.feed.heat || {};
  const series = H.series || {};
  const few = H.few || 10;
  const moved = H.moved || 0.03;
  const days = [...new Set(Object.values(series).flat().map((r) => r.day))].sort();
  const drawn = Object.keys(series).filter((b) => (series[b] || []).some((r) => (r.with_price || 0) >= few && isNum(r.t)));
  const intro = `<p class="note">Bookmakers limit the accounts that beat their prices, and the first sign they read is the price falling after you bet.
    For the bets the plan asked you to place, this is how often that happened at each bookmaker, and how sure it can be by now that you beat it:
    under 1 it can't tell, 1 a lean, 2 likely, 3 near certain.${H.made_greek ? ` <span class="muted small">Worked out ${esc(dayLabel(ukDay(H.made_greek), false))} ${esc(ukHM(H.made_greek))}.</span>` : ''}</p>`;
  const chart = drawn.length ? section('Getting hotter or cooler', `<div class="chart" id="ch-heat"></div>`,
    { fold: 'acc.chart', wide: true, sub: `From every bet up to each match day (shown once a bookmaker has ${few} bets read again after the bet). A rising line: each new bet tells it more; flat or falling: the new bets look less sharp.` }) : '';
  const dayRows = Object.entries(series).flatMap(([b, rows]) => rows.map((r) => ({ key: `${b}|${r.day}`, book: b, day: r.day, bets: r.bets, read: r.read, cut: r.cut, average: r.average,
    sure: (r.with_price || 0) >= few ? r.t : null }))).sort((a, b) => b.day.localeCompare(a.day) || a.book.localeCompare(b.book));
  const dayCard = dayRows.length ? section('Match day by match day', table({ id: 't-heatday', rows: dayRows, sort: ctx.sortOf('t-heatday'), rowGo: null, cols: [
    { key: 'day', label: 'Day', fmt: (v) => esc(dayLabel(v, false)) }, { key: 'book', label: 'Bookmaker', fmt: (v) => bookChip(v) },
    { key: 'bets', label: 'Bets', num: true, fmt: int }, { key: 'read', label: 'Read again', num: true, fmt: int },
    { key: 'cut', label: `Cut ${Math.round(moved * 100)}%+ after`, num: true, fmt: (v) => (isNum(v) ? pct(v) : '–') },
    { key: 'average', label: 'Average move', num: true, fmt: (v) => (isNum(v) ? spct(v, 1) : '–') },
    { key: 'sure', label: 'How sure, so far', num: true, fmt: (v) => (isNum(v) ? `${v.toFixed(2)} <span class="muted small">${esc(HEAT_SURE(v))}</span>` : '<span class="muted small">too few yet</span>') }] }),
    { fold: 'acc.days', wide: true, sub: 'That day’s bets, how many had a later price before kick-off, how often it was cut after the bet and by how much on average; the last column counts every bet up to that day.' }) : '';
  const kinds = (H.kinds || []).filter((k) => k.bets >= 3).map((k) => ({ ...k, key: `${k.book}|${k.kind}` })).sort((a, b) => (b.cut ?? 0) - (a.cut ?? 0) || b.bets - a.bets);
  const kindCard = kinds.length ? section('What feeds it: the markets', table({ id: 't-heatkind', rows: kinds, sort: ctx.sortOf('t-heatkind'), rowGo: null, cols: [
    { key: 'book', label: 'Bookmaker', fmt: (v) => bookChip(v) }, { key: 'kind', label: 'Market', fmt: (v, r) => `${esc(v)}${(r.cut ?? 0) >= 0.4 && r.bets >= 5 ? ' <span class="tag tag-warn">loud</span>' : ''}` },
    { key: 'bets', label: 'Bets', num: true, fmt: int }, { key: 'cut', label: 'Cut after', num: true, fmt: (v) => (isNum(v) ? pct(v) : '–') },
    { key: 'average', label: 'Average move', num: true, fmt: (v) => (isNum(v) ? spct(v, 1) : '–') }] }),
    { fold: 'acc.kinds', wide: true, sub: 'Bets with a later price, 3 or more a market. A market cut after 40% or more of 5 bets or more is the loudest to bet at that bookmaker. Best value first still holds: another bookmaker is as good a home for a pick only where its price is as good.' }) : '';
  const html = chart + dayCard + kindCard;
  const mount = () => {
    const el = document.getElementById('ch-heat');
    if (!el || !drawn.length) return;
    el.style.height = '240px';
    const lines = drawn.map((b) => ({ name: b, color: C.bookColor(b), pts: days.map((d) => {
      const r = (series[b] || []).find((x) => x.day === d);
      return r && (r.with_price || 0) >= few && isNum(r.t) ? { value: r.t, words: r.sure || HEAT_SURE(r.t), read: r.read, cut: r.cut, bets: r.bets } : null;
    }) }));
    // the chart starts at the first match day with a point and each line ends at its last: an empty first or last day left
    // the end labels nowhere (19 Oct 2026, seen in the browser)
    const from = Math.max(0, Math.min(...lines.map((s) => s.pts.findIndex((p) => p !== null)).filter((i) => i >= 0)));
    for (const s of lines) {
      s.pts = s.pts.slice(from);
      while (s.pts.length && s.pts[s.pts.length - 1] === null) s.pts.pop();
    }
    C.heatChart(el, days.slice(from).map((d) => dayLabel(d, false)), lines);
  };
  return { intro, html, mount };
}

// what the user marked placed (the slip's buttons and the board's, logs/placed_taps.csv), each with how it went, and the
// picks marked placed against those shown on the same days and not: does the choosing add anything?
function placedSection(ctx) {
  const { D } = ctx;
  const placed = (D.feed.placed || []).filter((p) => !p.day || ctx.inRange(p.day));
  if (!placed.length) {
    return section('Placed from the slip and the board', `<p class="muted small">Nothing marked placed yet. Tap “Mark placed” on a pick in Today, or the ▢ under the slip in Telegram: each placed pick shows here with how it went, against the picks shown and not placed.</p>`, { fold: 'money.placed', wide: true });
  }
  const key = (r) => `${r.day}|${r.match}|${String(r.bet || '').replace(/\s+at\s+\S+$/, '')}|${r.book}`;
  const mine = new Set(placed.map((p) => `${p.day}|${p.match}|${p.bet}|${p.book}`));
  const days = new Set(placed.map((p) => p.day));
  const shown = D.bets.filter((r) => r.sport === 'football' && r.set === 'paper' && days.has(r.day));
  const yes = shown.filter((r) => mine.has(key(r))), no = shown.filter((r) => !mine.has(key(r)));
  const a = agg(yes), b = agg(no);
  const line = (p) => {
    const r = shown.find((x) => key(x) === `${p.day}|${p.match}|${p.bet}|${p.book}`);
    return `<div class="bet-line static"><span class="bl-main"><span class="bl-bet">${esc(p.bet)}</span><span class="bl-match muted">${esc(p.match)} · ${esc(p.day || '')}${p.at ? ` · placed ${esc(p.at.slice(5))}` : ''} · ${p.via === 'board' ? 'from the board' : 'from the slip'}</span></span>
      <span class="bl-side">${bookChip(p.book)}${r ? `<span class="bl-price">${odds(r.price)}</span>${statusTag(r.status)}<span class="bl-profit ${signClass(r.profit)}">${isNum(r.profit) ? money(r.profit, '£', 2) : ''}</span>` : '<span class="muted small">not in the paper account</span>'}</span></div>`;
  };
  return section(`Placed from the slip and the board (${placed.length})`, `<div class="tiles tiles-2">
      <div class="tile"><div class="tile-label">Marked placed</div><div class="tile-value ${signClass(a.ret)}">${a.n ? spct(a.ret) : '–'}</div><div class="tile-sub">${a.won} of ${a.n} won · ${money(a.profit)} at paper stakes ${a.n ? verdictPill(a.verdict, a.more) : ''}</div></div>
      <div class="tile"><div class="tile-label">Shown the same days, not placed</div><div class="tile-value ${signClass(b.ret)}">${b.n ? spct(b.ret) : '–'}</div><div class="tile-sub">${b.won} of ${b.n} won · ${money(b.profit)} ${b.n ? verdictPill(b.verdict, b.more) : ''}</div></div>
    </div>
    <div class="lines">${placed.slice().sort((x, y) => String(y.at || '').localeCompare(String(x.at || ''))).slice(0, 30).map(line).join('')}</div>`,
  { fold: 'money.placed', wide: true, sub: 'Both at the paper account’s stakes, so the choosing is compared and not the amounts. The real amounts are in the tickets you paste.' });
}
