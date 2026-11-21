// The national teams' tiers, one source for Today's Internationals card (views/today.js) and the bot's reader (ask.js "intl";
// the orchestrator's ask of 9 Nov 22:3x, brought forward 10 Nov: the bot and the board say the same before Thursday's first send).
// No browser globals here: the bot runs ask.js in plain node (scripts/bot_board.mjs).
// The tiers (Rest's intl_send, the user's steer of 9 Nov 20:4x UK; the orchestrator's ask of 22:14): real (£1-£10 by the real
// overlay: fouls, shots and offsides at 20%+; throw-ins too from 10 Nov, 7646c69a), then the focus stats' £1 learning picks (fouls,
// shots, throw-ins, tackles, offsides), then the lower-confidence ones (on target, corners, goal kicks), then paper (the user's
// holds, "held: <their reason>", and the rest under the bar); the best overlay first in each, everywhere in this order.
export const INTL_SETS = { intl: 'real', intllearn: 'learning', intlpaper: 'paper' };
export const INTL_FOCUS = ['fouls', 'shots', 'throwins', 'tackles', 'offsides'];
export const INTL_LOWER = ['sot', 'corners', 'goalkicks'];
export const INTL_GROUPS = [
  { id: 'real', title: '🧪 Real, £1-£10 by the real overlay', open: true },
  { id: 'focus', title: '🧪 £1 learning: the focus stats', open: true },
  { id: 'lower', title: '🧪 £1 learning: lower confidence (on target, corners, goal kicks)' },
  { id: 'paper', title: '📄 Paper: your holds, and under the bar' },
];
export const INTL_RANK = Object.fromEntries(INTL_GROUPS.map((g, i) => [g.id, i]));
export const isIntl = (r) => r.set in INTL_SETS;
// a stat's focus from its id, else from the pick's words ("on target" before "shots")
export function intlFocus(stat, words) {
  if (INTL_FOCUS.includes(stat)) return true;
  if (INTL_LOWER.includes(stat)) return false;
  const w = String(words || '').toLowerCase();
  return !/on target|corners|goal kicks/.test(w) && /fouls|shots|throw-ins|tackles|offsides/.test(w);
}
export const intlGroup = (tier, focus) => (tier === 'real' ? 'real' : tier === 'learning' ? (focus ? 'focus' : 'lower') : 'paper');
export const intlRowGroup = (r) => intlGroup(INTL_SETS[r.set], intlFocus(r.stat, r.bet));
// the record's open rows, before the view carries picks
export function intlOf(bets, now) {
  return (bets || []).filter((r) => isIntl(r) && r.status === 'open' && (!r.kickAt || r.kickAt > now - 2 * 3600e3))
    .sort((a, b) => INTL_RANK[intlRowGroup(a)] - INTL_RANK[intlRowGroup(b)] || (b.edge || 0) - (a.edge || 0) || (a.kickAt || 0) - (b.kickAt || 0));
}
// a view pick's tier: its own "tier" (Rest's view), else its verdict's words; its focus: its own "focus", else its stat or words
export const intlTier = (p) => (['real', 'learning', 'paper'].includes(p.tier) ? p.tier
  : /learning/i.test(String(p.verdict || '')) ? 'learning' : /sent/i.test(String(p.verdict || '')) ? 'real' : 'paper');
export const intlPickGroup = (p) => intlGroup(intlTier(p), typeof p.focus === 'boolean' ? p.focus : intlFocus(p.stat, p.pick));
// H245's go-live (14 Nov 2026; the user's "ONE overlay, correct"): a national row judged on the careful overlay carries its own rule.
// A view pick (Rest's intl_view): rule "careful" and `shown`, the overlay it was judged on; a Today card (board.careful_fields): ov_rule
// "careful", its `edge` already the careful overlay, `is_key` the board's flag. The page reads these, never a line of its own.
export const intlCareful = (p) => !!p && p.rule === 'careful' && typeof p.shown === 'number';
export const intlShown = (p) => (p && typeof p.shown === 'number' ? p.shown : (p && p.overlay) || 0);
export const isCareful = (p) => !!p && p.ov_rule === 'careful';
export const intlByTier = (a, b) => INTL_RANK[intlPickGroup(a)] - INTL_RANK[intlPickGroup(b)] || intlShown(b) - intlShown(a);
// the matches still to come or under two hours started, by kick-off
export function intlGames(view, now) {
  const at = (m) => Date.parse(m.kick_utc);
  return ((view || {}).matches || []).filter((m) => !Number.isFinite(at(m)) || at(m) > now - 2 * 3600e3)
    .sort((a, b) => (at(a) || Infinity) - (at(b) || Infinity));
}
// every pick in the card's order: the view's own picks once Rest's sender writes them ({g, p, m}), else the record's rows ({g, r})
export function intlItems(view, bets, now) {
  const games = intlGames(view, now);
  const at = (m) => Date.parse(m.kick_utc);
  const vp = games.flatMap((m) => (m.picks || []).map((p) => ({ p, m }))).sort((a, b) => intlByTier(a.p, b.p) || (at(a.m) || 0) - (at(b.m) || 0));
  if (vp.length) return vp.map((x) => ({ g: intlPickGroup(x.p), ...x }));
  return intlOf(bets, now).map((r) => ({ g: intlRowGroup(r), r }));
}
// "2 real, 3 £1 learning, 2 paper"
export function intlCounts(items) {
  const n = (...gs) => items.filter((x) => gs.includes(x.g)).length;
  return [[n('real'), 'real'], [n('focus', 'lower'), '£1 learning'], [n('paper'), 'paper']].filter(([k]) => k).map(([k, w]) => `${k} ${w}`).join(', ');
}
