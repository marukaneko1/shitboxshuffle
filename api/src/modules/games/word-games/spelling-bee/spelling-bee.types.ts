export interface SpellingBeeState {
  letters: string[];
  centerLetter: string;
  validWords: string[];
  pangrams: string[];
  foundWords: Record<string, string[]>;
  scores: Record<string, number>;
  player1: string;
  player2: string;
  maxScore: number;
  phase: 'playing' | 'ended';
  startedAt: number;
  timeLimit: number;
}

export interface SpellingBeeMoveResult {
  success: boolean;
  error?: string;
  state?: SpellingBeeState;
  wordScore?: number;
  isPangram?: boolean;
  gameEnded?: boolean;
  winner?: string | null;
  isDraw?: boolean;
}
