// Key Picks (H324, frozen b3a7e257: scripts/experiments/h324/SPEC.md; the user's KEY board item, 17 Nov 2026): the day's best legs for
// 2-4 leg parlays, one a match, every sport, to 06:00 UK next morning, at the top of Today (fm/key_picks.py, the feed's
// today.key_picks). Each line: its start (UK), the bet, the book and price, the stake, our honest chance, the cell's record to date in
// brackets "(+21% on 178)" with its tier, the team line's group and the stat. Display only: no stake, bar or send changes.
// Amendment 6 (the user's yes 18 Nov 2026, DECISIONS d5615ce6): a club leg in a listed derby shows its label on a line of its own
// (fm/key_picks.derby_label: "⚔️ North West derby", with H185's finding beside a fouls or cards leg); a label only.
// Amendment 8 (H346 (a); the user's yes 19 Nov 2026 11:27-11:29): from Sat 21 a club fouls under leads the list, its label on a line of
// its own (fm/key_picks.anchor_of: "⚓ anchor: club fouls unders, expect about +23%"); the order is fm/key_picks.build's.
import { esc, money, odds, recordParts, recHtml, spct, ovWhole, isNum, TIER_WORDS } from './util.js';
import { bookChip, section, signClass } from './ui.js';

export const KP_GROUP = { AGREE: '✅ team line agrees', NEUTRAL: '➖ team line neutral', MILD: '◐ team line mildly against',
  'no check': '○ no team-line check', 'not known': '? team line not known', 'no team line': '? no team line' };
export const KP_TIER = TIER_WORDS;                                 // the one tier word set (util.js; the standard, DECISIONS dc0cdece)

// ⭐ and the decision overlay on the Parlay card (the standard, DECISIONS dc0cdece): the card's own key flag, else 30%+ (whole %), never an
// experimental cell's; the overlay is the card's own `edge` (fm/key_picks.py carries it beside the honest chance's `ov`)
export const kpKey = (x) => !!x && !x.experimental && (typeof x.is_key === 'boolean' ? x.is_key : isNum(x.edge) && ovWhole(x.edge) >= 30);
export function keyPicksLine(x) {
  const chance = Number.isFinite(x.ours) ? `${Math.round(100 * x.ours)}%` : '–';
  const derby = x.derby ? `
      <span class="small">${esc(x.derby)}</span>` : '';
  const anchor = x.anchor ? `
      <span class="small"><b>${esc(x.anchor)}</b></span>` : '';
  // the leg's track record from the ONE source (fm/track_record.py; the user, 23 Nov 2026 11:21-11:40: level stakes, the same numbers as
  // Results and Slices), on a line of its own; 7b's player records only where no track was built. The tier word stays the stake test's.
  const prec = recordParts(x).map((s) => `
      <span class="small muted">${recHtml(s)}</span>`).join('<br>');   // the one wording, as the Today card (25 Nov 2026)
  return `<button type="button" class="bet-line" data-pick="${esc(x.key)}">
    <span class="bl-main"><span class="bl-bet">${esc(x.rank)}. ${kpKey(x) ? '<span class="key-star" title="A key pick: 30%+ over the price">⭐</span> ' : ''}${esc(x.bet)}${x.experimental ? ` <span class="tier" title="${esc(x.experimental)}">🧪 experimental</span>` : ''}</span>
      <span class="bl-match muted">${esc(x.uk)} UK · ${esc(x.sport)} · ${esc(x.match)}</span>
      <span class="small"><span title="The stake test: 20%+ picks of this sport, stat and side">${esc(KP_TIER[x.tier] || x.tier)}</span> · ${esc(KP_GROUP[x.group] || x.group)} · ${esc(x.stat)}</span>${prec}${anchor}${derby}</span>
    <span class="bl-side">${bookChip(x.book)}<span class="bl-price">${odds(x.price)}</span>${isNum(x.edge) ? `<span class="${signClass(x.edge)} small">${spct(x.edge)}</span>` : ''}
      <span class="small">${esc(money(x.place, '£', 0, false))} · ${chance}</span></span></button>`;
}

export function keyPicksCard(KP) {
  if (!KP) return '';
  const P = KP.picks || [];
  const sub = `The day’s best legs for your 2-4 leg parlays, one a match, to ${esc(KP.until || '')} UK. In brackets, the track record at level stakes: this league, stat and side · every league · the team(s) or player, won/settled. Made ${esc(KP.made || '')} UK.`;
  if (!P.length) return section('🧩 Parlay picks (none yet)', `<p class="muted small">No Bet card qualifies before ${esc(KP.until || '')} UK.</p>`, { id: 'keypicks', sub });
  return section(`🧩 Parlay picks (${P.length})`, `<div class="lines">${P.map(keyPicksLine).join('')}</div>`, { id: 'keypicks', sub });
}
