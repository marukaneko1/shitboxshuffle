export interface MemoryCard {
  index: number;    // flat position 0–35
  pairId: number;   // 0–17 — which pair this card belongs to
  symbol: string;   // Unicode symbol shown on face
  faceUp: boolean;  // currently visible to all players
  matched: boolean; // permanently matched/removed from play
}

export interface MemoryState {
  cards: MemoryCard[];
  currentTurn: string;   // userId whose turn it is
  player1: string;       // userId (goes first)
  player2: string;       // userId
  scores: { [userId: string]: number };
  phase: 'waiting' | 'firstFlipped' | 'pendingFlipBack' | 'gameEnd';
  firstFlippedIndex: number | null;   // index of the first flipped card this turn
  secondFlippedIndex: number | null;  // index of the second flipped card this turn
  startedAt: number;
}

export interface MemoryMoveResult {
  success: boolean;
  error?: string;
  state?: MemoryState;
  winner?: string | null;   // userId or null (draw)
  isDraw?: boolean;
  pendingFlipBack?: boolean; // true when gateway should start the 1.5s flip-back timer
}

export interface MemoryFlipBackResult {
  state: MemoryState;
}
