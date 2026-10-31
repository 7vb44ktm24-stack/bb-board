// Ideas: what to ask next. Questions the record raises, every insight with the test it suggests, a menu of jobs for
// Claude filled with your own numbers, and a box to ask about the view you are looking at. Each request copies ready
// to paste into the Claude chat (the "Football model" session); nothing is sent from here.

import { esc, md, ukStamp } from '../util.js';
import { section, goAttr, tile } from '../ui.js';
import { agg } from '../metrics.js';
import { insights, ideaMenu, questions, describeView, realInsights, ASK_TAIL } from '../insights.js';
import { insightCard } from './today.js';
import { whatIfCard } from './lab.js';

// left on the table (the user's no. 1 priority of 31 Oct 2026: "no money or picks left on the table by a wrong rule"): every
// gate's cut lines against its passed lines, Rest's and Live's audit; a gate costs money where its cut lines won beyond two luck
// bands (Rest's own "test a loosening", which then goes old against new before the user's call)
const LEFT_ORDER = { 'test a loosening': 0, keep: 1, 'too few': 2 };
const retBand = (r, b) => (r === null || r === undefined ? '–' : `${r > 0 ? '+' : ''}${(100 * r).toFixed(1)}%${b ? ` <span class="muted small">±${(100 * b).toFixed(1)}%</span>` : ''}`);
export function leftCard(L) {
  const rows = ((L && L.rows) || []).slice().sort((a, b) => (LEFT_ORDER[a.verdict] ?? 3) - (LEFT_ORDER[b.verdict] ?? 3) || (b.cut_ret ?? -9) - (a.cut_ret ?? -9));
  if (!rows.length) return '';
  const costly = rows.filter((r) => r.verdict === 'test a loosening').length;
  const inside = rows.filter((r) => r.verdict === 'keep' && (r.cut_ret ?? 0) > 0).length;
  const few = rows.filter((r) => r.verdict === 'too few').length;
  const cells = (L && L.cells) || {};
  const where = (r) => [r.league, r.stat].filter((x) => x && x !== 'all').join(' ');
  const row = (r) => `<tr><td>${esc(r.lane || '')}<br><span class="muted small">${esc(r.by || '')}</span></td>
    <td>${esc(r.gate || '')}${where(r) ? ` <span class="muted small">· ${esc(where(r))}</span>` : ''}${r.note ? `<br><span class="muted small">${esc(r.note)}</span>` : ''}</td>
    <td class="n">${r.cut_n ?? '–'}</td><td class="n ${(r.cut_ret ?? 0) > 0 ? 'pos' : (r.cut_ret ?? 0) < 0 ? 'neg' : ''}">${retBand(r.cut_ret, r.cut_band)}</td>
    <td class="n">${retBand(r.passed_ret, r.passed_band)} <span class="muted small">on ${r.passed_n ?? 0}</span></td>
    <td>${r.verdict === 'test a loosening' ? '<b class="pos">testing a loosening</b>' : r.verdict === 'keep' ? 'keep' : '<span class="muted">too few</span>'}</td></tr>`;
  const marks = Object.entries(cells).filter(([k]) => k).map(([k, n]) => `${n} ${esc(k)}`).join(', ');
  return section('Left on the table', `<p class="small">Each gate’s cut lines (what the rule kept out) against the lines it let through, settled as logged, at one unit. A gate costs money where its cut lines won beyond two luck bands: that loosening is then tested old against new before it reaches you. Return ± one luck band.</p>
    <div class="tbl-wrap"><table class="tbl"><thead><tr><th>Lane</th><th>Gate</th><th class="n">Cut lines</th><th class="n">Their return</th><th class="n">Passed lines</th><th>Verdict</th></tr></thead>
    <tbody>${rows.map(row).join('')}</tbody></table></div>
    ${marks ? `<p class="muted small">The overlay, cell by cell (does the return rise with it?): ${marks}.</p>` : ''}`,
  { fold: 'ideas.left', wide: true, sub: `${costly} gate${costly === 1 ? '' : 's'} cost us money, ${costly} under test <span class="muted">(cut lines won beyond luck; ${inside} more ahead inside luck, ${few} too few to say${L.made ? `; audited ${esc(String(L.made).slice(5, 16))}` : ''})</span>` });
}

// the hypotheses' text keeps the file's **bold** and `code`: shown as such, everything else escaped
export function mdLite(s) {
  return esc(s || '').replace(/\*\*(.+?)\*\*/g, '<b>$1</b>').replace(/`([^`]+)`/g, '<code>$1</code>');
}
const plain = (s, n = 400) => { const t = String(s || '').replace(/\*\*|`/g, ''); return t.length > n ? `${t.slice(0, n - 1)}…` : t; };

export function hypAsk(h) {
  return `Bring ${h.id} up to date ("${h.title}", planning/HYPOTHESES.md): run what decides it${h.decides ? ` (${plain(h.decides)})` : ''} on the record so far, old against new where it would change a rule, with luck bands, and tell me in plain words whether it holds and what to do about it.${ASK_TAIL}`;
}
function hypCard(h) {
  const latest = h.latest ? `${h.latest.label ? `<b>${esc(h.latest.label)}</b> ` : ''}${mdLite(h.latest.text)}` : '';
  return `<article class="job hyp">
    <button type="button" class="hyp-main" data-hyp="${esc(h.id)}"><span class="hyp-id">${esc(h.id)}${h.note ? ` · ${esc(h.note)}` : ''}</span><h3>${esc(h.title)}</h3></button>
    ${latest ? `<p class="muted small hyp-latest">${latest}</p>` : ''}
    <button type="button" class="btn-copy" data-copy="${esc(hypAsk(h))}">Copy request</button>
  </article>`;
}

// where every part stands, its score and what is next (planning/CAPABILITIES.md, the feed's `scorecard`, 19 Oct 2026): the short
// verdict and the questions waiting for the user open, each other part folded
export function standCard(sc) {
  if (!sc || !sc.md) return '';
  const parts = sc.md.split(/\n(?=## )/);
  const head = parts[0].replace(/^\s*#\s+.*\n/, '');
  const secs = parts.slice(1).map((p) => { const [first, ...rest] = p.split('\n'); return { title: first.replace(/^##\s*/, ''), body: rest.join('\n') }; });
  const waiting = (s) => /^waiting/i.test(s.title);
  // now first (23 Oct 2026: the tab opened on the 19 Oct preface): the "In short" verdict, the three newest lines under "Changes",
  // the questions waiting; the whole file folded under them
  const short = (head.match(/\*\*In short[\s\S]*?(?=\n\s*\n|$)/) || [''])[0];
  const changes = secs.find((s) => /^changes/i.test(s.title));
  const newest = changes ? changes.body.split(/\n(?=- )/).filter((x) => x.startsWith('- ')).slice(-3).reverse() : [];
  // the setup scored again (30 Oct 2026: "## The whole setup scored again, <date>: 6.1 out of 10" sat folded under the 19 Oct
  // verdict): the first such part open above it
  const scored = secs.find((s) => /scored again/i.test(s.title));
  return section('Where we stand now', `${scored ? `<div class="md stand-score"><h3 class="md-h">${esc(scored.title)}</h3>${md(scored.body)}</div>` : ''}
    ${short ? `<div class="md">${md(short)}</div>` : ''}
    ${newest.length ? `<h3 class="sub-h">What moved last</h3><div class="md">${md(newest.join('\n'))}</div>` : ''}
    ${secs.filter(waiting).map((s) => `<div class="md stand-wait"><h3 class="md-h">${esc(s.title)}</h3>${md(s.body)}</div>`).join('')}
    <details class="fold"><summary>The whole file: every part with its score (${secs.length} parts)</summary>
      <div class="md">${md(head.replace(short, ''))}</div>
      ${secs.filter((s) => !waiting(s) && s !== scored).map((s) => `<details class="fold"><summary>${esc(s.title)}</summary><div class="md">${md(s.body)}</div></details>`).join('')}
    </details>`,
  { fold: 'ideas.stand', wide: true, sub: `Every part with its score and what is next (planning/CAPABILITIES.md, kept by the chats${sc.made ? `; updated ${esc(ukStamp(sc.made).slice(5))}` : ''}).` });
}

const QUICK = [
  'What should I change first, and why?',
  'Which of today’s picks would you place, and how much at each bookmaker?',
  'Explain this view to me in plain words.',
  'What is luck here and what is skill?',
  'Suggest three tests to run next week.',
];

export function render(ctx) {
  const { D, S } = ctx;
  const paper = ctx.scope({ sport: 'football', set: 'paper' });
  const all = ctx.scope({ sport: 'football', set: null });
  const view = ctx.scope();
  const g = agg(view);
  const ins = [...insights(D, paper, all), ...realInsights(D.tickets)];
  const qs = questions(D, paper, all);
  const menu = ideaMenu(D, paper, all);

  const wi = whatIfCard(ctx);
  const ask = section('Ask about this view', `<p class="muted small">The board answers questions itself in its chat (the button at the bottom right, on every tab). For anything it cannot answer, write the question here and copy it with a summary of what the board is showing (the sport, set, range, filters and their numbers), then paste it into a Claude chat.</p>
    <textarea id="ask-q" rows="3" placeholder="For example: should I raise the stake on fouls unders at Stoiximan?"></textarea>
    <div class="quick">${QUICK.map((q) => `<button type="button" class="chip" data-quick="${esc(q)}">${esc(q)}</button>`).join('')}</div>
    <div class="sheet-actions"><button type="button" class="btn" data-ask-copy="1">Copy question with the view</button>
    <button type="button" class="btn btn-ghost" data-copy="${esc(describeView(S, g))}">Copy the view only</button></div>`, { id: 'ask', fold: 'ideas.ask', wide: true });

  const qCard = qs.length ? section('Questions worth asking', `<div class="qs">${qs.map((q) => `<div class="q"><button type="button" class="q-main" ${goAttr(q.go)}>${esc(q.q)}</button><button type="button" class="btn-copy" data-copy="${esc(q.ask)}">Copy request</button></div>`).join('')}</div>`,
    { fold: 'ideas.questions', wide: true, sub: 'From what the record shows today.' }) : '';
  const INS_FIRST = 6;                                              // the rest folded: the card ran about 3,000 px on a phone
  const insCard = ins.length ? section('Insights and the test each suggests', `<div class="insights">${ins.slice(0, INS_FIRST).map(insightCard).join('')}</div>
    ${ins.length > INS_FIRST ? `<details class="fold"><summary>${ins.length - INS_FIRST} more</summary><div class="insights">${ins.slice(INS_FIRST).map(insightCard).join('')}</div></details>` : ''}`,
  { fold: 'ideas.insights', wide: true, sub: 'Football’s paper account (all of it), the other sets beside it, and the real tickets. Each opens the view behind it.' }) : '';
  const jobs = section('Jobs to ask Claude', `<div class="jobs">${menu.map((m) => `<article class="job"><h3>${esc(m.title)}</h3><p class="muted small">${esc(m.why)}</p><button type="button" class="btn-copy" data-copy="${esc(m.ask)}">Copy request</button></article>`).join('')}</div>`,
    { fold: 'ideas.jobs', wide: true, sub: 'Each worded as your rule wants it: tested old against new on the record before anything changes, the paper account as the headline, luck bands beside every figure.' });

  const bq = (D.feed.bot_questions || []).slice().reverse();
  const botCard = bq.length ? section('Your questions to the BB Picks bot', `<div class="qs">${bq.slice(0, 12).map((q) => `<div class="q"><div class="q-main" style="cursor:default">${esc(q.text || '')}
      <div class="muted small">${esc(String(q.asked || '').slice(0, 16))} · ${q.status === 'answered' ? 'answered' : 'waiting for a Claude chat'}${q.why ? ' · ' + esc(q.why) : ''}</div>
      ${q.answer ? `<p class="small" style="margin:6px 0 0">${esc(q.answer)}</p>` : ''}</div>
      ${q.status !== 'answered' ? `<button type="button" class="btn-copy" data-copy="${esc(`The BB Picks bot could not answer this, asked ${String(q.asked || '').slice(0, 16)}: "${q.text}". Answer it with the numbers from the record.${ASK_TAIL}`)}">Copy request</button>` : ''}</div>`).join('')}</div>`,
  { fold: 'ideas.bot', wide: true, sub: 'Questions the bot could not answer itself wait here for a Claude chat (logs/bot_questions.csv).' }) : '';
  const hyps = (D.feed.hypotheses || []).filter((h) => h.sport === S.sport);
  const FIRST = 6;
  const hypSection = hyps.length ? section(`What is being tested (${hyps.length})`, `<div class="jobs">${hyps.slice(0, FIRST).map(hypCard).join('')}</div>${hyps.length > FIRST
    ? `<details class="fold"><summary>The other ${hyps.length - FIRST}, newest first</summary><div class="jobs">${hyps.slice(FIRST).map(hypCard).join('')}</div></details>` : ''}`,
  { fold: 'ideas.tests', wide: true, sub: `The project’s own claims about where the value is (planning/HYPOTHESES.md), ${esc(S.sport)}, newest first: each one’s latest reading. Tap one for the whole entry and what decides it.` }) : '';
  const notes = botCard + qCard + jobs + hypSection + insCard;
  const search = notes ? `<input type="search" class="search" data-search="ideas-notes" data-search-items=".job,.q,article.insight"
    placeholder="Search ideas, jobs, hypotheses and questions" aria-label="Search ideas, jobs, hypotheses and questions">` : '';
  // the top third (the user, 30 Oct 2026: "the top 1/3 of the screen must hold the best, visually scannable info"): the setup's latest
  // score, what is being tested, the bot's questions waiting, the insights; every card below folded on every screen, nothing removed
  const scoreM = /## The whole setup scored again.*?([0-9]+(?:\.[0-9]+)?) out of 10/.exec((D.feed.scorecard || {}).md || '');
  const waiting = bq.filter((q) => q.status !== 'answered').length;
  const tiles = `<div class="tiles tiles-top">
    ${scoreM ? tile({ label: 'The whole setup now', value: `${esc(scoreM[1])}<span class="muted"> / 10</span>`, sub: 'planning/CAPABILITIES.md: open “Where we stand now” for each part' }) : ''}
    ${tile({ label: `Being tested (${esc(S.sport)})`, value: String(hyps.length), sub: 'claims about where the value is, each with its latest reading' })}
    ${tile({ label: 'Bot questions waiting', value: String(waiting), sub: waiting ? 'for a Claude chat to answer' : 'none: the bot answered them all' })}
    ${tile({ label: 'Insights', value: String(ins.length), sub: `${qs.length} questions worth asking · ${menu.length} jobs to ask Claude` })}
  </div>`;
  const html = tiles + leftCard(D.feed.left_table) + standCard(D.feed.scorecard) + wi.html + ask + search + `<div id="ideas-notes">${notes}</div>`;
  const mount = () => {
    if (wi.mount) wi.mount();
    const box = document.getElementById('ask-q');
    document.querySelectorAll('[data-quick]').forEach((b) => b.addEventListener('click', () => { box.value = b.dataset.quick; box.focus(); }));
    const copy = document.querySelector('[data-ask-copy]');
    copy.addEventListener('click', () => {
      const q = box.value.trim() || 'Explain this view to me in plain words.';
      ctx.copy(`${q}\n\n${describeView(S, g)}${ASK_TAIL}`);
    });
  };
  return { html, mount };
}
