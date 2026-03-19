import { Card } from './blackjack.types';
export { createDeck, shuffleDeck, dealCards } from '../poker/poker.utils';

/**
 * Calculate the best hand value for a blackjack hand.
 * Aces count as 11 unless that would bust, then count as 1.
 * Returns { value, isSoft } where isSoft means an ace is counted as 11.
 */
export function calculateHandValue(hand: Card[]): { value: number; isSoft: boolean } {
  let value = 0;
  let aces = 0;

  for (const card of hand) {
    if (card.rank === 'A') {
      aces++;
      value += 11;
    } else if (['K', 'Q', 'J'].includes(card.rank)) {
      value += 10;
    } else {
      value += parseInt(card.rank, 10);
    }
  }

  // Downgrade aces from 11 to 1 as needed to avoid busting
  while (value > 21 && aces > 0) {
    value -= 10;
    aces--;
  }

  return { value, isSoft: aces > 0 };
}

export function isBust(hand: Card[]): boolean {
  return calculateHandValue(hand).value > 21;
}

export function isBlackjack(hand: Card[]): boolean {
  return hand.length === 2 && calculateHandValue(hand).value === 21;
}

/**
 * Compare two non-busted hand values.
 * Returns 1 if hand1 wins, -1 if hand2 wins, 0 if tie.
 * Natural blackjack (21 on 2 cards) beats a non-natural 21.
 */
export function compareHands(
  hand1: Card[],
  hand2: Card[],
): number {
  const v1 = calculateHandValue(hand1).value;
  const v2 = calculateHandValue(hand2).value;
  const bj1 = isBlackjack(hand1);
  const bj2 = isBlackjack(hand2);

  // Both busted — shouldn't happen in normal flow, but handle it
  if (v1 > 21 && v2 > 21) return 0;
  if (v1 > 21) return -1;
  if (v2 > 21) return 1;

  // Natural blackjack beats regular 21
  if (bj1 && !bj2) return 1;
  if (!bj1 && bj2) return -1;

  if (v1 > v2) return 1;
  if (v1 < v2) return -1;
  return 0;
}
