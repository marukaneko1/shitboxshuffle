import { Card, Suit, Rank } from '../poker/poker.types';

export { Card, Suit, Rank };

export type BlackjackAction = 'hit' | 'stand' | 'bet' | 'double';
export type BlackjackPhase = 'betting' | 'playing' | 'resolution';
export type BlackjackPlayerStatus = 'betting' | 'playing' | 'stood' | 'busted';

export interface BlackjackPlayerState {
  userId: string;
  chips: number;
  hand: Card[];
  handValue: number;
  isSoft: boolean; // whether the hand value includes an ace counted as 11
  bet: number;
  status: BlackjackPlayerStatus;
  lastAction?: BlackjackAction;
}

export interface BlackjackActionRecord {
  userId: string;
  action: BlackjackAction;
  amount?: number;
  card?: Card;
  handValue?: number;
  timestamp: number;
}

export interface BlackjackState {
  players: BlackjackPlayerState[];
  deck: Card[];
  pot: number;
  currentPlayerIndex: number;
  phase: BlackjackPhase;
  handNumber: number;
  dealerIndex: number;
  actionHistory: BlackjackActionRecord[];
  isHandComplete: boolean;
  winnerIds?: string[];
  lastWinnings?: Record<string, number>;
  startedAt: number;
}

export interface BlackjackActionRequest {
  gameId: string;
  userId: string;
  action: BlackjackAction;
  amount?: number;
}

export interface BlackjackActionResult {
  success: boolean;
  error?: string;
  state?: BlackjackState;
  handComplete?: boolean;
  winners?: { userId: string; amount: number; handValue: number }[];
}

export interface BlackjackGameEndResult {
  winnerId: string;
  finalChips: number;
  reason: 'opponent-broke' | 'opponent-quit';
}
