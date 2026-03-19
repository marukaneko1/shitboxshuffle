export interface ScattergoriesRound {
  categories: string[];
  letter: string;
  answers: Record<string, Record<string, string>>;
  submitted: string[];
  scores: Record<string, number>;
}

export interface ScattergoriesState {
  player1: string;
  player2: string;
  currentRound: number;
  totalRounds: number;
  rounds: ScattergoriesRound[];
  totalScores: Record<string, number>;
  phase: 'playing' | 'reviewing' | 'scoring' | 'ended';
  startedAt: number;
  timeLimit: number;
  winner: string | null;
  isDraw: boolean;
}

export interface ScattergoriesMoveResult {
  success: boolean;
  error?: string;
  state?: ScattergoriesState;
  gameEnded?: boolean;
  winner?: string | null;
  isDraw?: boolean;
  allSubmitted?: boolean;
}
