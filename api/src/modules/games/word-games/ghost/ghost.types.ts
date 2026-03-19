export interface GhostRoundResult {
  loserId: string;
  reason: 'completed_word' | 'invalid_challenge' | 'failed_challenge';
  fragment: string;
  word?: string;
}

export interface GhostState {
  player1: string;
  player2: string;
  currentFragment: string;
  currentTurn: string;
  phase: 'playing' | 'responding' | 'ended';
  challengerId?: string;
  ghostLetters: Record<string, number>;
  roundHistory: GhostRoundResult[];
  minWordLength: number;
}

export interface GhostMoveResult {
  success: boolean;
  error?: string;
  state?: GhostState;
  gameEnded?: boolean;
  winner?: string | null;
  isDraw?: boolean;
}
