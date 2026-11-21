// 👤 Player lines (6 Nov 2026, the user's yes in the strategy talk, DECISIONS 0f4a4b2; PA): one folded card under each sport's own
// part of Today, the same shape everywhere: (1) the coming player lines, our number against each book's, the biggest gaps first,
// ranked on two-sided books only (a book hanging the over alone is marked "over only" and never ranks or reads as agreement: the
// orchestrator's rule); (2) the forecast check, how each book's chances did against ours on the settled lines; (3) the count check
// before a first send (logs/player_count_checks.json, written by the lanes' owners; none cleared yet, H31); (4) the record, the
// early-winners rows with "scope": "player", in proven.js's words (beyond luck only on a band by match). Display only: no player
// line is sent from here. The feed: today.player_lines (scripts/board.py player_lines).
import { esc, pct, num, isNum, int, odds, ukHM, ukDay, ukWhen, dayLabel } from './util.js';
import { section } from './ui.js';
import { reading } from './proven.js';

export const PLAYER_SPORT = {
  football: { title: 'Football', now: 'paper: building (H136, Live’s player map)',
    none: 'No book we read hangs both sides of a football player line: Superbet, Betsson and Kambi the over only, Stoiximan 1+/2+ ladders, bet365 both sides on its screen in the big matches only. Nothing to rank until one does.' },
  basketball: { title: 'Basketball', now: 'paper: no player line is sent (H31)', none: 'No coming player line judged yet.' },
  nhl: { title: 'NHL', now: 'paper: the 20%+ player sends held (9590d17)', none: 'No coming player shots line judged yet: the lane judges at 16:15 and 22:30 UK.' },
  tennis: { title: 'Tennis', now: 'each player’s aces, sent 🧪 unproven', none: 'No player aces line sent for a coming match.' },
};
const STAT = { ast: 'assists', pts: 'points', reb: 'rebounds', fg3: 'threes', stl: 'steals', blk: 'blocks', pa: 'points + assists',
  pr: 'points + rebounds', ra: 'rebounds + assists', pra: 'points + rebounds + assists', shots: 'shots on goal', aces: 'aces' };
export const statName = (s) => STAT[s] || String(s || '');
const OVERALL = /^(all|all all|every competition and count)$/;
const VERDICT_SHOW = 5;
// a judge's stamp "20261106_1023" as "6 Nov 10:23" (the laptop's clock, UK); anything else as it is
export function madeSaid(m) {
  const x = String(m || '').match(/^(\d{4})(\d{2})(\d{2})_(\d{2})(\d{2})$/);
  return x ? `${+x[3]} ${['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][+x[2] - 1]} ${x[4]}:${x[5]} UK` : String(m || '');
}
const minus = (s) => String(s).replace(/^-/, '−');
const pts = (x) => `${x > 0 ? '▲' : '▼'}${Math.abs(x * 100).toFixed(0)}`;   // chance points, our over's chance above or below the book's

// one book's price beside ours: its own chance where both sides are hung, else "over only @ price" (never a chance, never a gap)
export function bookSaid(b) {
  if (b.two && isNum(b.theirs)) return `${esc(b.book)} ${pct(b.theirs)}`;
  if (isNum(b.over)) return `${esc(b.book)} <span class="muted">over only @ ${odds(b.over)}</span>`;
  return `${esc(b.book)} <span class="muted">under only @ ${odds(b.under)}</span>`;
}

// H169's corrected chance (the user's yes, DECISIONS ab36cc1e; Rest's formula, frozen b22fd736): our chance shrunk toward the book's,
// q = (1/price)/(1 + margin), corrected = σ(logit q + w·(logit ours − logit q)); w and margin from logs/basket_corr.json (Rest's
// nightly refit, feed.basket_corr). Superbet's price only; null (shown "–") without w, or a chance or price out of range. Display
// only: the picks do not change.
export function corrected(ours, price, C) {
  if (!C || !isNum(C.w) || !isNum(ours) || !isNum(price) || price <= 1 || ours <= 0 || ours >= 1) return null;
  const q = (1 / price) / (1 + (isNum(C.margin) ? C.margin : 0.08));
  if (q <= 0 || q >= 1) return null;
  const lg = (p) => Math.log(p / (1 - p));
  return 1 / (1 + Math.exp(-(lg(q) + C.w * (lg(ours) - lg(q)))));
}
export const corrWord = (C) => (C && isNum(C.w) ? `corrected (H169, w ${C.w})` : 'corrected');

// `C`: basketball's feed.basket_corr ({} when the file is missing); left out for the other sports, which show no corrected chance
export function lineItem(g, now = Date.now(), C = undefined) {
  const t = Date.parse(g.start);
  const when = !Number.isFinite(t) ? '' : ukDay(g.start) === ukDay(new Date(now)) ? `${ukHM(g.start)} UK` : `${dayLabel(ukDay(g.start) || '').slice(0, 3)} ${ukHM(g.start)} UK`;
  const sb = (g.books || []).find((b) => b.book === 'Superbet' && isNum(b.over));
  const c = C === undefined ? undefined : corrected(g.ours, sb && sb.over, C);
  const corr = C === undefined ? '' : ` · ${corrWord(C)} ${c === null ? '–' : pct(c)}`;
  return `<li><b>${esc(g.player)} ${esc(statName(g.stat))} ${num(g.line, 1)}</b> <span class="muted">${esc(g.match || '')}${when ? ` · ${esc(when)}` : ''}</span><br>
    ours ${pct(g.ours)} over${corr} · ${(g.books || []).map(bookSaid).join(' · ')}${isNum(g.gap) ? ` · <b>${pts(g.gap)}</b> on the two-sided` : ''}</li>`;
}

// a forecast-check row: below nought ours (or the anchored number) was the closer; inside two bands level. Against a book that
// hangs the over only its chances keep the margin, so it is no fair test and never reads as ours being closer.
export function verdictItem(v, oneSided) {
  if (!isNum(v.value)) return '';
  const vsBook = !/minus ours$/.test(v.metric || '');
  const who = /anchored/i.test(v.metric || '') ? 'the anchored number (H136)' : 'ours';
  const against = vsBook ? `${esc(v.book)}’s` : 'ours alone';
  const band = isNum(v.band) && v.band > 0 ? v.band : null;
  const level = band !== null && Math.abs(v.value) < 2 * band;
  const word = vsBook && oneSided ? 'not a fair test: an over-only price keeps the margin in its chance'
    : level ? 'level, inside luck' : v.value < 0 ? `${who} closer` : `${vsBook ? `${esc(v.book)}` : 'ours alone'} closer`;
  return `<li>${esc(OVERALL.test(v.stat || '') ? 'All' : v.stat)}: ${who} against ${against} chances ${minus(v.value.toFixed(4))}${band !== null ? ` ±${band.toFixed(4)}` : ''}
    <span class="muted">(Brier, ${int(v.lines)} lines${isNum(v.matches) ? `, ${int(v.matches)} matches` : ''})</span>: ${word}</li>`;
}

export function recordItem(r) {
  const x = reading(r);
  if (!x) return `<li><b>${esc(r.name)}</b>: nothing settled yet</li>`;
  const luck = isNum(x.luck) ? ` ±${pct(x.luck)}` : '';
  return `<li><b>${esc(r.name)}</b>: ${int(x.n)} settled${isNum(x.matches) ? ` in ${int(x.matches)} matches` : ''}, ${minus(pct(x.return, 0, true))}${luck}${x.byMatch ? ' by match' : ' by bet'}: ${esc(x.word)}${x.short ? ` <span class="muted">(${esc(x.short)})</span>` : ''}</li>`;
}

export const playerRows = (EW, sp) => ((EW && EW.rows) || []).filter((r) => r.scope === 'player' && (r.sport || (r.lane === 'tennis' ? 'tennis' : null)) === sp);

// our estimate against what he did (Live, 15 Nov 2026; the user: "the per player estimate pregame and comparison after ... where we
// are close or far, e.g. less minutes, did not play so news needed"): scripts/basket_player_review.py's board part, read by
// scripts/board.py basket_review into player_lines.basketball.review. Each latest game's misses with their cause (ours / his,
// ▼ ▲ outside our 80% range), the news list (a coming game first), the share of each cause by competition. Read-only: never a pick.
const revCell = (v) => (Array.isArray(v) ? `${num(v[0], 1)} / ${isNum(v[1]) ? num(v[1], 0) : '–'}${v[2] === 'below' ? ' ▼' : v[2] === 'above' ? ' ▲' : ''}` : '');
export function reviewPart(R) {
  if (!R || !((R.latest || []).length || (R.watch || []).length)) return '';
  const games = (R.latest || []).map((g) => {
    const M = g.misses || [];
    const head = `<p class="small" style="margin:8px 0 4px"><b>${esc(g.match)}</b> <span class="muted">${esc(g.comp || '')} · ${esc(ukWhen(g.tip_utc))}</span>: ${int(g.players)} players, ${int(g.close)} close${M.length ? '' : '.'}</p>`;
    if (!M.length) return head;
    const rows = M.map((m) => `<tr><td>${esc(m.player)}${m.team ? ` <span class="muted">${esc(m.team)}</span>` : ''}</td><td>${esc(m.cause)}</td><td class="num">${num((m.min || [])[0], 0)} / ${num((m.min || [])[1], 0)}</td><td class="num">${revCell(m.pts)}</td><td class="num">${revCell(m.reb)}</td><td class="num">${revCell(m.ast)}</td></tr>`).join('');
    return `${head}<div class="tbl-wrap"><table class="tbl"><thead><tr><th>Player</th><th>Why</th><th class="num">Min</th><th class="num">Pts</th><th class="num">Reb</th><th class="num">Ast</th></tr></thead><tbody>${rows}</tbody></table></div>`;
  }).join('');
  const W = R.watch || [];
  const watch = W.length ? `<p class="small" style="margin:8px 0 4px"><b>Check the news before their lines</b></p><ul class="plain small">${W.map((w) => `<li>${esc(w.player)}${w.team ? ` (${esc(w.team)})` : ''} <span class="muted">${esc(w.comp || '')}</span>: ${esc(w.what)}${w.next ? ` · <b>plays ${esc(ukWhen(w.next))}</b>` : ''}</li>`).join('')}</ul>` : '';
  const C = (R.comps || []).map((c) => `${esc(c.comp)} ${pct(c.close)} close, ${pct(c.minutes)} minutes, ${pct(c.dnp)} did not play (${int(c.n)})`).join(' · ');
  return `<h3 class="sub-h">Our estimate against what he did</h3>${games}${watch}<p class="muted small">${C ? `Since ${esc(R.since || '')}, player-games: ${C}. ` : ''}Ours / his; ▼ ▲ outside the range our spread gives 80%. Minutes: off by 8+. Did not play: news we did not have. A forecast check, never a pick (reports/basket_player_review.md).</p>`;
}

export function playerCard(PL, sp, EW, now = Date.now(), corr = undefined) {
  const C = PLAYER_SPORT[sp];
  const P = (PL && PL[sp]) || {};
  if (!C) return '';
  const top = (P.top || []).filter((g) => { const t = Date.parse(g.start); return !Number.isFinite(t) || t > now; });
  const oneSided = sp === 'football';                               // Live's map (6 Nov): no two-sided football player line at any book we read
  const CORR = sp === 'basketball' ? (corr || {}) : undefined;       // H169's corrected chance beside ours, basketball only (8 Nov 2026)
  const vs = top.length ? `<ul class="plain small lines-text">${top.map((g) => lineItem(g, now, CORR)).join('')}</ul>
      <p class="muted small">${int(P.lines)} coming lines judged, ${int(P.two_sided)} at a two-sided book; the ${top.length} biggest gaps on those. A big gap is often our miss (minutes, a late absence): paper until the record says otherwise.</p>`
    : `<p class="empty">${esc(C.none)}</p>`;
  // the overall rows first (football's "all", basketball's "every competition and count"), then each competition's "<comp>,
  // every count", then the counts; at most VERDICT_SHOW on the phone
  const allness = (v) => (OVERALL.test(v.stat || '') ? 0 : /every count$/.test(v.stat || '') ? 1 : 2);
  const V = (P.verdicts || []).filter((v) => isNum(v.value)).sort((a, b) => allness(a) - allness(b));
  const made = V.length ? String(V[0].made || '') : '';
  const check = V.length ? `<ul class="plain small">${V.slice(0, VERDICT_SHOW).map((v) => verdictItem(v, oneSided)).join('')}</ul><p class="muted small">${V.length > VERDICT_SHOW ? `${V.length - VERDICT_SHOW} more counts in the verdict file. ` : ''}${made ? `Judged ${esc(madeSaid(made))}.` : ''}</p>`
    : '<p class="muted small">No forecast check written yet.</p>';
  const K = Object.entries(P.checks || {});
  const counts = K.length ? `<ul class="plain small">${K.map(([stat, c]) => `<li>${c.status === 'cleared' ? '✅' : '⏸️'} ${esc(statName(stat))}: ${esc(c.status || '')}${c.note ? ` · ${esc(c.note)}` : ''}${c.at ? ` <span class="muted">(${esc(String(c.at).slice(0, 10))})</span>` : ''}</li>`).join('')}</ul>`
    : '<p class="muted small">Not done yet for any player market: before a first send the book must settle on our count (its box score against ours).</p>';
  const R = playerRows(EW, sp);
  const record = R.length ? `<ul class="plain small">${R.map(recordItem).join('')}</ul>` : '<p class="muted small">No record yet.</p>';
  return section(`👤 ${C.title} player lines (${int(P.lines || 0)} coming · ${esc(C.now)})`,
    `<h3 class="sub-h">Ours against each book’s</h3>${vs}<h3 class="sub-h">Who forecast better</h3>${check}${sp === 'basketball' ? reviewPart(P.review) : ''}<h3 class="sub-h">The count check before a first send</h3>${counts}<h3 class="sub-h">Its own record</h3>${record}`,
    { sub: 'Our over’s chance against each book’s own (its margin out where both sides are hung; “over only” never ranks), the forecast check, the count check, the record with its luck band.',
      id: `players-${sp}`, wide: true, fold: `today.players.${sp}` });
}
