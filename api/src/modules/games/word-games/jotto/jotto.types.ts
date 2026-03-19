export interface JottoGuess {
  word: string;
  matchCount: number;
  timestamp: number;
}

export interface JottoState {
  player1: string;
  player2: string;
  phase: 'picking' | 'playing' | 'ended';
  secretWords: Record<string, string>;
  pickedCount: number;
  guessHistory: Record<string, JottoGuess[]>;
  currentTurn: string;
  winner: string | null;
}

export interface JottoMoveResult {
  success: boolean;
  error?: string;
  state?: JottoState;
  gameEnded?: boolean;
  winner?: string | null;
  isDraw?: boolean;
}
