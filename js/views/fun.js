// Fun (20 Oct 2026; the user: "add parlay in dashboard as a fun tab", "explain me why u picked matches"): the day's goals parlays
// (the goals menu, a mid-day and a later pick at each bookmaker, then the day's three; the European cups beside the six leagues),
// every leg with its reasons, the fun parlays and the weekend cover, then their own records. The user's own wagering: never a
// pick, never in the paper account, the bookmakers' margin in every leg.

import { esc, money, pct, spct, odds, isNum } from '../util.js';
import { bookChip, signClass, section } from '../ui.js';

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

function record(parlays, family) {
  const rows = parlays.filter((p) => p.family === family);
  const done = rows.filter((p) => p.settled);
  const staked = done.reduce((s, p) => s + (p.stake || 0), 0);
  const profit = done.reduce((s, p) => s + (p.profit || 0), 0);
  const won = done.filter((p) => p.status === 'won').length;
  if (!rows.length) return `<li><b>${esc(family)}</b>: none yet</li>`;
  return `<li><b>${esc(family)}</b>: ${done.length} settled, ${won} won, <span class="${signClass(profit)}">${money(profit, '£', 2, true)}</span> on ${money(staked, '£', 0, false)} staked`
    + `${staked ? ` (${spct(profit / staked, 1)})` : ''}; ${rows.length - done.length} open</li>`;
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
  const parts = [];
  parts.push(section('The goals menu', menu.length ? `<p class="small muted">${esc(why)}</p><div class="minis">${menu.map((x) => card(x, 'goals')).join('')}</div>`
    : '<p class="empty">No goals menu in the latest run.</p>', { sub: 'Overs and both to score only, a mid-day and a later pick at each bookmaker: 5 each at most, 20 a day in all.' }));
  if (three.length) parts.push(section('The day’s three', `<div class="minis">${three.map((x) => card(x, 'goals')).join('')}</div>`,
    { sub: 'The closest to fair of every market (results too), three, four and five legs.' }));
  if (fun.length) parts.push(section('Fun parlays', `<div class="minis">${fun.map((x) => card(x, 'fun')).join('')}</div>`));
  if (cover.length) parts.push(section('Weekend cover bet', `<ul class="plain">${cover.map((c) => `<li>${bookChip(c.book)} <b>${esc(c.bet)}</b> <span class="muted">${esc(c.match)} · ${esc(c.kick || '')}</span> <b>${odds(c.price)}</b></li>`).join('')}</ul>`));
  parts.push(section('Their record', `<ul class="plain">${record(D.parlays, 'Goals parlays')}${record(D.parlays, 'Fun parlays')}</ul>`,
    { sub: 'Your own wagering, settled apart: never the paper account, never mixed with the picks.' }));
  return { html: parts.join('') };
}
