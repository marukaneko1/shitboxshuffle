export interface LetterBoxedPlayerState {
  words: string[];
  lettersUsed: string[];
  lastLetter: string | null;
  solved: boolean;
}

export interface LetterBoxedState {
  sides: string[][];
  allLetters: string[];
  players: Record<string, LetterBoxedPlayerState>;
  player1: string;
  player2: string;
  phase: 'playing' | 'ended';
  startedAt: number;
  winner: string | null;
  isDraw: boolean;
}

export interface LetterBoxedMoveResult {
  success: boolean;
  error?: string;
  state?: LetterBoxedState;
  gameEnded?: boolean;
  winner?: string | null;
  isDraw?: boolean;
}
