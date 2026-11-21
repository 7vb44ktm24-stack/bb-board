// Fun (20 Oct 2026; the user: "add parlay in dashboard as a fun tab", "explain me why u picked matches"): the day's goals parlays
// (the goals menu, a mid-day and a later pick at each bookmaker, then the day's three; the European cups beside the six leagues),
// every leg with its reasons, the fun parlays and the weekend cover, then their own records. The user's own wagering: never a
// pick, never in the paper account, the bookmakers' margin in every leg.

import { esc, money, pct, spct, odds, isNum, fromGreek } from '../util.js';
import { bookChip, signClass, section, tile } from '../ui.js';

function legLine(l) {
  const where = [l.match, l.league, l.kick].filter(Boolean).map(esc).join(' · ');
  return `<li class="fun-li"><div class="fun-leg"><span>${esc(l.bet)}</span><b>${odds(l.price)}</b></div>
    <p class="muted small" style="margin:0">${where}</p>
    ${l.why ? `<p class="small" style="margin:2px 0 6px">Why: ${esc(l.why)}</p>` : ''}</li>`;
}

function card(f, kind) {
  const label = f.theme || f.kind || kind;
  return `<article class="mini mini-fun">
    <div class="mini-top">${bookChip(f.book)}<span class="muted small">${esc(label)}${f.band ? ' · ' + esc(f.band) : ''}</span><b class="mini-price">${odds(f.price)}</b></div>
    <ul class="legs">${(f.legs || []).map(legLine).join('')}</ul>
    <div class="mini-foot"><span>chance ${pct(f.chance)}</span>${isNum(f.edge) ? `<span class="${signClass(f.edge)}">expected ${spct(f.edge, 1)}</span>` : ''}${isNum(f.stake) ? `<span>stake ${money(f.stake, '£', 0, false)}</span>` : ''}</div>
  </article>`;
}

// a family's settled record: {n, won, staked, profit, open}
function tally(parlays, family) {
  const rows = parlays.filter((p) => p.family === family), done = rows.filter((p) => p.settled);
  const staked = done.reduce((s, p) => s + (p.stake || 0), 0), profit = done.reduce((s, p) => s + (p.profit || 0), 0);
  return { n: done.length, won: done.filter((p) => p.status === 'won').length, staked, profit, open: rows.length - done.length };
}

function record(parlays, family) {
  const rows = parlays.filter((p) => p.family === family);
  const done = rows.filter((p) => p.settled);
  const staked = done.reduce((s, p) => s + (p.stake || 0), 0);
  const profit = done.reduce((s, p) => s + (p.profit || 0), 0);
  const won = done.filter((p) => p.status === 'won').length;
  if (!rows.length) return `<li><b>${esc(family)}</b>: none yet</li>`;
  const last = done.reduce((d, p) => (p.day > d ? p.day : d), '');
  const day = done.filter((p) => p.day === last);
  const dayProfit = day.reduce((s, p) => s + (p.profit || 0), 0);
  return `<li><b>${esc(family)}</b>: ${done.length} settled, ${won} won, <span class="${signClass(profit)}">${money(profit, '£', 2, true)}</span> on ${money(staked, '£', 0, false)} staked`
    + `${staked ? ` (${spct(profit / staked, 1)})` : ''}; ${rows.length - done.length} open`
    + `${last ? `. Latest settled day, ${esc(last.slice(5))}: ${day.filter((p) => p.status === 'won').length} of ${day.length} won, <span class="${signClass(dayProfit)}">${money(dayProfit, '£', 2, true)}</span>` : ''}</li>`;
}

// a parlay whose first leg has kicked off can no longer be placed (25 Oct 2026, the board review: the Fun tab showed the evening's
// menu after midnight as if still to play, with no results): folded under the ones to come; its result lands in "Their record"
function cards(list, kind, now) {
  const past = (s) => { const t = fromGreek(s); return t && t <= now; };
  const started = (x) => (x.kick ? past(x.kick) : (x.legs || []).some((l) => past(l.kick)));     // a fun parlay carries its first kick-off
  const soon = list.filter((x) => !started(x));
  const gone = list.filter(started);
  return `${soon.length ? `<div class="minis">${soon.map((x) => card(x, kind)).join('')}</div>` : ''}`
    + `${gone.length ? `<details class="fun-gone"><summary>${soon.length ? 'Already started' : 'All started'} (${gone.length}): results in Their record after the night's settle</summary>`
      + `<div class="minis">${gone.map((x) => card(x, kind)).join('')}</div></details>` : ''}`;
}

export function render(ctx) {
  const { D } = ctx;
  const T = D.feed.today || {};
  const goals = T.goals || [];
  const menu = goals.filter((g) => g.kind === 'menu');
  const three = goals.filter((g) => g.kind === 'three');
  const fun = T.fun || [];
  const cover = T.cover || [];
  const why = 'Why these: at each bookmaker the parlay with the best expected return on our careful chance (three quarters ours from the '
    + 'sharp prices, a quarter the bookmaker’s own), its parlay bonus counted, legs of about 2 or more, one a match, kick-offs together '
    + 'unless that costs 3 points. Each leg says the goals the sharp prices expect, our chance, the bookmaker’s own and what the price needs.';
  const now = new Date();
  const parts = [];
  const menuHtml = cards(menu, 'goals', now);
  parts.push(section('The goals menu', menu.length ? `${menuHtml.startsWith('<details') ? '' : `<p class="small muted">${esc(why)}</p>`}${menuHtml}`
    : '<p class="empty">No goals menu in the latest run.</p>', { id: 'menu', sub: 'Overs and both to score only, a mid-day and a later pick at each bookmaker: 5 each at most, 20 a day in all.' }));
  if (three.length) parts.push(section('The day’s three', cards(three, 'goals', now),
    { fold: 'fun.three', wide: true, sub: 'The closest to fair of every market (results too), three, four and five legs.' }));
  if (fun.length) parts.push(section('Fun parlays', cards(fun, 'fun', now), { fold: 'fun.fun', wide: true }));
  if (cover.length) parts.push(section('Weekend cover bet', `<ul class="plain">${cover.map((c) => `<li>${bookChip(c.book)} <b>${esc(c.bet)}</b> <span class="muted">${esc(c.match)} · ${esc(c.kick || '')}</span> <b>${odds(c.price)}</b></li>`).join('')}</ul>`, { fold: 'fun.cover', wide: true }));
  parts.push(section('Their record', `<ul class="book-lines">${record(D.parlays, 'Goals parlays')}${record(D.parlays, 'Fun parlays')}</ul>`,
    { fold: 'fun.record', wide: true, sub: 'Your own wagering, settled apart: never the paper account, never mixed with the picks.' }));
  // the top third (the user, 30 Oct 2026: "the top 1/3 of the screen must hold the best, visually scannable info"): the best goals
  // parlay still to play and each family's record; the menu open below, every other card folded on every screen, nothing removed
  const started = (x) => { const k = x.kick || (x.legs || [])[0]?.kick; const t = k ? fromGreek(k) : null; return t && t <= now; };
  const best = menu.filter((x) => !started(x) && isNum(x.edge)).sort((a, b) => b.edge - a.edge)[0];
  const fam = (name, label) => { const x = tally(D.parlays, name); return tile({ label, value: `<span class="${signClass(x.profit)}">${x.n ? money(x.profit, '£', 2, true) : '–'}</span>`,
    sub: x.n ? `${x.won} of ${x.n} won${x.staked ? ` · ${spct(x.profit / x.staked, 1)}` : ''} · ${x.open} open` : `none settled yet · ${x.open} open` }); };
  const tiles = `<div class="tiles tiles-top">
    ${best ? tile({ label: `Best goals parlay to play: ${best.book}`, value: odds(best.price), sub: `expected ${spct(best.edge, 1)} · chance ${pct(best.chance)} · ${(best.legs || []).length} legs` }) : ''}
    ${fam('Goals parlays', 'Goals parlays so far')}
    ${fam('Fun parlays', 'Fun parlays so far')}
  </div>`;
  return { html: tiles + parts.join('') };
}
