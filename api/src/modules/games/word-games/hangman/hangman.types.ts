export interface HangmanRound {
  hostId: string;
  guesserId: string;
  secretWord: string;
  guessedLetters: string[];
  wrongLetters: string[];
  maxWrong: number;
  solved: boolean;
  failed: boolean;
}

export interface HangmanState {
  player1: string;
  player2: string;
  phase: 'picking' | 'guessing' | 'ended';
  currentRound: number;
  rounds: HangmanRound[];
  scores: Record<string, number>;
  currentHostId: string;
  currentGuesserId: string;
  secretWord: string | null;
  guessedLetters: string[];
  wrongLetters: string[];
  maxWrong: number;
  revealedWord: string[];
}

export interface HangmanMoveResult {
  success: boolean;
  error?: string;
  state?: HangmanState;
  gameEnded?: boolean;
  winner?: string | null;
  isDraw?: boolean;
}
