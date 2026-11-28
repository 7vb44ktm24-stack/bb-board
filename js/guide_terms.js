// "How our numbers work" in one place (29 Oct 2026): the card on Today (views/guide.js) and the bot's answers (ask.js: "what is
// overlay?", "what does reliable mean?", "why is this NBA line paper?") read the same words, each worked on today's top pick with
// the feed's own numbers (board.py's guide_feed: the example E, the rules as the code holds them b, the overlay bands B). No DOM
// here, so the bot loads it in node.
import { esc, pct, spct, odds, money, num, isNum } from './util.js';

const two = (x) => (isNum(x) ? x.toFixed(2) : '–');
const sigsOf = (E) => (E && isNum(E.signals) ? `${E.signals} signal${E.signals === 1 ? '' : 's'}` : '');
const foulsOver = (E, b) => !!(b.fouls_over_on && E && /foul/i.test(E.stat || '') && E.side === 'over');
// whether the pick clears the send bar as the code holds it (fouls over: its own bar by either route, while it is on)
export function clears(E, b) {
  if (!E || !isNum(b.send)) return null;
  if (foulsOver(E, b)) return E.edge >= b.fouls_over_edge;
  return E.edge >= b.send || (isNum(b.two_signal) && E.edge >= b.two_signal && E.signals >= 2);
}

// the card's terms, in its order: words(b) the plain words, mine(E, b) the pick's own numbers ('' or null when it has none)
export const TERMS = [
  { id: 'overlay', title: 'Overlay',
    words: () => 'Overlay = our chance × the price − 1. It is the value at that price <i>if our chance is right</i>, not how often the bet wins.',
    mine: (E) => E && `Price ${odds(E.price)}, our chance ${pct(E.ours)}: ${two(E.ours)} × ${two(E.price)} − 1 = <b>${spct(E.ours * E.price - 1)}</b>. The price needs ${pct(1 / E.price)} (1 ÷ ${two(E.price)}); we say ${pct(E.ours)}.` },
  { id: 'chance', title: 'Our chance, and theirs',
    words: () => 'Our chance is the lower of two tests: the model\'s own count, and the same with our usual gap from the bookmaker taken out (where we disagree, we are the likelier one to be wrong). "Theirs" is the bookmaker\'s own chance with its margin taken out.',
    mine: (E) => E && `Ours ${pct(E.ours)}, theirs ${pct(E.bookp)}.${isNum(E.expected) ? ` We expect ${num(E.expected, 1)}; they price ${num(E.theirs, 1)}.` : ''}` },
  { id: 'careful', title: 'The careful chance (the stake)',
    words: (b) => `The stake doesn't use the overlay as it stands. It uses a chance moved from the bookmakers' toward ours by how much of our gap has shown up in past results: further where another bookmaker agrees, less where confidence is Low. Then a quarter of Kelly${b.bank ? ` on a bank of ${esc(b.bank)}` : ''}.`,
    mine: (E) => E && (isNum(E.ps) ? `${pct(E.ps)}, between theirs ${pct(E.bookp)} and ours ${pct(E.ours)}: a paper stake of ${money(E.stake, '£', 2, false)}.` : `A paper stake of ${money(E.stake, '£', 2, false)}.`) },
  { id: 'signals', title: 'Signals',
    words: () => '"2 signals" means another bookmaker\'s own chance (its margin out) leans our way by 3 points or more: a second, independent price agrees with us.',
    mine: (E) => E && sigsOf(E) && `This pick: ${sigsOf(E)}.` },
  // the one confidence measure since 31 Oct 2026 (the user, about 07:40 UK): High, Medium and Low retired for it
  { id: 'score', title: 'The score: ●●● ●●○ ●○○',
    words: () => 'One simple score on every football pick, unproven: ●●● all in (another bookmaker leans our way and it is 20%+ over its price, its stat and direction not behind), ●○○ the weakest sent, ●●○ the rest. It replaced confidence (High, Medium, Low) on 31 Oct 2026.',
    mine: (E) => E && [1, 2, 3].includes(Number(E.tier)) && `This pick: ${['●●●', '●●○', '●○○'][Number(E.tier) - 1]}.` },
  { id: 'bars', title: 'The bars',
    words: (b) => (isNum(b.send) ? `Sent from ${pct(b.send)} overlay, or from ${pct(b.two_signal)} with 2 signals; at most two picks a match. ${b.bar25_on ? 'The 25% bar is on, by your yes.' : 'The 25% bar is off, by your word of 30 Oct: from 20% again.'}${b.fouls_over_on ? ` Fouls over only from ${pct(b.fouls_over_edge)}, by either route.` : ''}` : 'The send bars are being read from the code.'),
    mine: (E, b) => E && isNum(b.send) && `This pick: ${spct(E.edge)}${sigsOf(E) ? ` with ${sigsOf(E)}` : ''}, so ${clears(E, b) ? 'over the bar: sent' : 'under the bar: kept back on paper'}.` },
  { id: 'kept', title: 'Kept back',
    words: (b) => `Lines ${isNum(b.keep) ? `from ${pct(b.keep)} ` : ''}that miss the bar, and a third pick in a match, are kept back: logged and staked on paper, never sent. The record keeps them apart, so the bar itself can be tested.`,
    mine: () => '' },
  { id: 'verdict', title: 'The verdict chips',
    words: () => 'Every pick carries one verdict: ✅ BET (place it), 📄 PAPER (tracked on paper, not placed), ⛔ DON\'T BET.',
    mine: (E) => E && E.verdict_label && `This pick: ${esc(E.verdict_label)}${E.verdict_why ? `, ${esc(E.verdict_why)}` : ''}.` },
  { id: 'topcheck', title: 'The top-pick check',
    words: (b) => `Picks ${isNum(b.top) ? `${pct(b.top)}+` : 'far'} above their price get a checklist before they are placed: "Top pick: checked ✓", or ✗ and why.`,
    mine: (E, b) => E && (E.top_check ? `This pick: ${esc(E.top_check)}.` : isNum(b.top) && E.edge < b.top ? `This pick is under ${pct(b.top)}: no check needed.` : '') },
  { id: 'side', title: 'Our side of the line',
    words: () => 'How often our side has landed on every judged league line of the same stat and side, at the same chance. "Reliable" means that stat\'s side lands 60%+ at our 55%+ lines even two bands of luck down. It is not the pick\'s own chance: picks are chosen where we stand furthest from the price, so they land a little below the lines.',
    mine: (E) => E && E.side_conf && esc(E.side_conf) },
];
export const TERM = Object.fromEntries(TERMS.map((t) => [t.id, t]));

// the bot's own topics beyond the card's terms (the orchestrator's ask of 29 Oct 2026)
const bandLine = (B, names) => ((B && B.bands) || []).filter((r) => names.includes(r.band))
  .map((r) => `${esc(r.band)}: said ${pct(r.said)}, landed ${pct(r.landed)}, ${spct(r.ret)}${isNum(r.luck) ? ` ±${pct(r.luck)}` : ''} on ${r.picks}`).join('; ');
const EXTRA = {
  bar25: (b, B) => `<p><b>The 25% bar</b>: ${b.bar25_on ? `since your yes of 29 Oct a pick is sent only from ${pct(b.send)} overlay, or from ${pct(b.two_signal)} where a second bookmaker agrees (2 signals)` : 'off since your word of 30 Oct (about 22:40 UK), "send from 20% again": a pick is sent from 20% overlay again, or from 10% with 2 signals'}. Lines${isNum(b.keep) ? ` from ${pct(b.keep)}` : ''} that miss it are kept back on paper, never lost from the record.</p>${
    bandLine(B, ['20-25%', '25-30%', '30%+']) ? `<p class="small">Our picks by overlay (${esc(B.from || '')} to ${esc(B.to || '')}, level stakes, luck clustered by match): ${bandLine(B, ['20-25%', '25-30%', '30%+'])}.</p>` : ''}`,
  fouls: (b) => `<p><b>Fouls over</b>: ${b.fouls_over_on ? `since your yes of 29 Oct it is sent only from ${pct(b.fouls_over_edge)} overlay, by either route (the 2-signal one too); under that it goes to paper` : 'it goes by the same bars as every line; a 25% bar for it alone is built but off, waiting for your yes'}. It is the one stat side not reliably right at our 55%+ lines, and the fouls-over lines under 25% made a loss on the record, so they wait on paper until they show otherwise.</p>`,
  nba: () => '<p><b>Why an NBA line is paper</b>: the NBA is on paper only, nothing sent. On its first games our NBA points chance lost to Superbet\'s, and a big gap from Superbet\'s line usually means news we don\'t see (an injury, a rest night), so the card says "news unknown" there rather than calling it value. Since your yes of 29 Oct an anchored number (ours moved most of the way to the market\'s, from ESPN\'s pre-game total and spread) is tracked on paper beside it. Both are judged at about 200 games (around 20 Nov) before anything is sent.</p>',
};

// a question's topic ("what is overlay", "why did fouls over go to paper"), or null when it isn't one about how the numbers work
const TOPIC = [
  ['nba', /\bnba\b.*\bpaper\b|\bpaper\b.*\bnba\b/, 'why'],
  ['fouls', /\bfouls? over\b.*\b(paper|25|kept)\b/, 'why'],
  ['kept', /\bkept back\b/, 'why'],
  ['bar25', /\b25 ?(%|per ?cent)? (send )?bar\b|\bbar (of|at) 25\b/, 'define'],
  ['bars', /\b(send )?bars?\b/, 'define'],
  ['careful', /\bcareful (chance|number)\b|\bhow (is|are) (the )?stakes? (sized|set|worked out|chosen)\b/, 'define'],
  ['chance', /\bour chance\b|\btheirs\b|\btheir chance\b|\btwo tests\b/, 'define'],
  ['signals', /\bsignals?\b/, 'define'],
  ['score', /\bconfidence\b|\bscores?\b|\btiers?\b|\bdots\b/, 'define'],
  ['verdict', /\bverdicts?\b/, 'define'],
  ['topcheck', /\btop[- ]?pick check\b|\bchecklist\b/, 'define'],
  ['side', /\breliable\b|\bside of the line\b|\bside line\b|\ball judged lines\b/, 'define'],
  ['overlay', /\boverlay\b/, 'define'],
  ['numbers', /\b(our|the) numbers\b/, 'define'],
];
const DEFINE = /\b(what (is|are|does|do)|whats|how (does|do|is|are)|explain|meaning|mean|means|define|definition|tell me about|stand for)\b/;
const RESULT = /\b(did|doing|done|perform\w*|returns?|returned|profit\w*|made|won|lost|record|roi|results?)\b|\bdo (this|last|so far|lately|recently|today|yesterday)\b|\bdo\s*\??$/;
export function guideTopic(t) {
  const why = /\bwhy\b/.test(t);
  for (const [id, rx, cue] of TOPIC) {
    if (!rx.test(t)) continue;
    if (cue === 'why' ? why || DEFINE.test(t) : DEFINE.test(t) && (!RESULT.test(t) || /\bmean(s|ing)?\b/.test(t))) return id;
  }
  return null;
}

// the bot's answer on a topic, worked on today's top pick where the card would be (G: feed.today.guide)
export function guideAnswer(topic, G = {}) {
  const E = G.example, b = G.bars || {}, B = G.bands || {};
  const which = E ? ` (${esc(E.bet)} at ${esc(E.book)})` : '';
  if (EXTRA[topic]) return EXTRA[topic](b, B);
  if (topic === 'numbers' || !TERM[topic]) {
    return `<p>Our numbers, a line each (the board's "How our numbers work" card on Today has them all, worked on today's top pick):</p><ul class="plain ans-list">${
      TERMS.map((t) => `<li><b>${esc(t.title)}</b>: ${t.words(b).replace(/<\/?i>/g, '').split('. ')[0]}.</li>`).join('')}</ul>${
      E ? `<p class="small">For example, today's top pick${which}: ${TERM.overlay.mine(E, b)}</p>` : ''}`;
  }
  const t = TERM[topic], mine = t.mine(E, b);
  return `<p><b>${esc(t.title)}</b>: ${t.words(b)}</p>${mine ? `<p class="small">On today's top pick${which}: ${mine}</p>` : ''}`;
}
