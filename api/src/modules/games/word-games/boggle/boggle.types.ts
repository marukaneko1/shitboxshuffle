export interface BoggleState {
  grid: string[][];
  player1: string;
  player2: string;
  foundWords: Record<string, string[]>;
  phase: 'playing' | 'scoring' | 'ended';
  startedAt: number;
  timeLimit: number;
  scores: Record<string, number>;
  uniqueWords: Record<string, string[]>;
  sharedWords: string[];
  winner?: string | null;
  isDraw?: boolean;
}

export interface BoggleMoveResult {
  success: boolean;
  error?: string;
  state?: BoggleState;
  wordScore?: number;
  gameEnded?: boolean;
  winner?: string | null;
  isDraw?: boolean;
}
