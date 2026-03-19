import { Card, Suit, Rank } from '../poker/poker.types';

export { Card, Suit, Rank };

export const RANK_ORDER: Rank[] = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];

export const RANK_DISPLAY: Record<Rank, string> = {
  'A': 'Aces', '2': '2s', '3': '3s', '4': '4s', '5': '5s', '6': '6s',
  '7': '7s', '8': '8s', '9': '9s', '10': '10s', 'J': 'Jacks', 'Q': 'Queens', 'K': 'Kings',
};

export type BsPhase = 'playing' | 'callWindow' | 'reveal' | 'ended';
export type BsAction = 'playCards' | 'callBS' | 'pass';

export interface BsPlayerState {
  userId: string;
  hand: Card[];
  handCount: number;
}

export interface BsPlay {
  cards: Card[];
  cardCount: number;
  claimedRank: Rank;
  playerId: string;
  actuallyMatch: boolean;
}

export interface BsActionRecord {
  userId: string;
  action: BsAction;
  detail: string;
  timestamp: number;
}

export interface BsState {
  players: BsPlayerState[];
  discardPile: Card[];
  currentPlayerIndex: number;
  currentRequiredRankIndex: number;
  phase: BsPhase;
  lastPlay: BsPlay | null;
  callWindowEndTime: number | null;
  turnNumber: number;
  winnerId: string | null;
  actionHistory: BsActionRecord[];
  revealedCards: Card[] | null;
  wasBS: boolean | null;
  penaltyPlayerId: string | null;
  startedAt: number;
}

export interface BsClientState {
  myHand: Card[];
  opponentHandCount: number;
  discardPileCount: number;
  currentPlayerIndex: number;
  currentRequiredRank: Rank;
  phase: BsPhase;
  lastPlay: {
    cardCount: number;
    claimedRank: Rank;
    playerId: string;
    cards?: Card[];
  } | null;
  callWindowEndTime: number | null;
  turnNumber: number;
  winnerId: string | null;
  actionHistory: BsActionRecord[];
  revealedCards: Card[] | null;
  wasBS: boolean | null;
  penaltyPlayerId: string | null;
  playerOrder: string[];
  myIndex: number;
}

export interface BsPlayResult {
  success: boolean;
  error?: string;
  state?: BsState;
}

export interface BsCallResult {
  success: boolean;
  error?: string;
  state?: BsState;
  wasBS?: boolean;
  revealedCards?: Card[];
  penaltyTo?: string;
}
