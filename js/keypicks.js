// Key Picks (H324, frozen b3a7e257: scripts/experiments/h324/SPEC.md; the user's KEY board item, 17 Nov 2026): the day's best legs for
// 2-4 leg parlays, one a match, every sport, to 06:00 UK next morning, at the top of Today (fm/key_picks.py, the feed's
// today.key_picks). Each line: its start (UK), the bet, the book and price, the stake, our honest chance, the cell's record to date in
// brackets "(+21% on 178)" with its tier, the team line's group and the stat. Display only: no stake, bar or send changes.
// Amendment 6 (the user's yes 18 Nov 2026, DECISIONS d5615ce6): a club leg in a listed derby shows its label on a line of its own
// (fm/key_picks.derby_label: "⚔️ North West derby", with H185's finding beside a fouls or cards leg); a label only.
// Amendment 8 (H346 (a); the user's yes 19 Nov 2026 11:27-11:29): from Sat 21 a club fouls under leads the list, its label on a line of
// its own (fm/key_picks.anchor_of: "⚓ anchor: club fouls unders, expect about +23%"); the order is fm/key_picks.build's.
import { esc, money, odds } from './util.js';
import { bookChip, section } from './ui.js';

export const KP_GROUP = { AGREE: '✅ team line agrees', NEUTRAL: '➖ team line neutral', MILD: '◐ team line mildly against',
  'no check': '○ no team-line check', 'not known': '? team line not known', 'no team line': '? no team line' };
export const KP_TIER = { PROVEN: '🏅 proven', unproven: 'unproven', behind: '⚠️ behind its promise' };

export function keyPicksLine(x) {
  const chance = Number.isFinite(x.ours) ? `${Math.round(100 * x.ours)}%` : '–';
  const derby = x.derby ? `
      <span class="small">${esc(x.derby)}</span>` : '';
  const anchor = x.anchor ? `
      <span class="small"><b>${esc(x.anchor)}</b></span>` : '';
  // 7b (the user's add 19 Nov 2026 11:38): a player leg's own records, the league's player lines and the player's, on a line of its own
  const prec = x.prec ? `
      <span class="small muted">${esc(x.prec)}</span>` : '';
  return `<button type="button" class="bet-line" data-pick="${esc(x.key)}">
    <span class="bl-main"><span class="bl-bet">${esc(x.rank)}. ${esc(x.bet)}</span>
      <span class="bl-match muted">${esc(x.uk)} UK · ${esc(x.sport)} · ${esc(x.match)}</span>
      <span class="small">${esc(KP_TIER[x.tier] || x.tier)} ${esc(x.bracket)} · ${esc(KP_GROUP[x.group] || x.group)} · ${esc(x.stat)}</span>${prec}${anchor}${derby}</span>
    <span class="bl-side">${bookChip(x.book)}<span class="bl-price">${odds(x.price)}</span>
      <span class="small">${esc(money(x.place, '£', 0, false))} · ${chance}</span></span></button>`;
}

export function keyPicksCard(KP) {
  if (!KP) return '';
  const P = KP.picks || [];
  const sub = `The day’s best legs for your 2-4 leg parlays, one a match, to ${esc(KP.until || '')} UK. In brackets, that kind of pick’s record to date. Made ${esc(KP.made || '')} UK.`;
  if (!P.length) return section('🧩 Parlay picks (none yet)', `<p class="muted small">No Bet card qualifies before ${esc(KP.until || '')} UK.</p>`, { id: 'keypicks', sub });
  return section(`🧩 Parlay picks (${P.length})`, `<div class="lines">${P.map(keyPicksLine).join('')}</div>`, { id: 'keypicks', sub });
}
