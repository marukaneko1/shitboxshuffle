export type LetterFeedback = 'green' | 'yellow' | 'gray';

export interface WordleGuess {
  word: string;
  feedback: LetterFeedback[];
}

export interface WordlePlayerState {
  guesses: WordleGuess[];
  solved: boolean;
  solvedAtGuess: number | null;
}

export interface WordleState {
  secretWord: string;
  players: Record<string, WordlePlayerState>;
  maxGuesses: number;
  startedAt: number;
  phase: 'playing' | 'ended';
  winner: string | null;
  isDraw: boolean;
}

export interface WordleMoveResult {
  success: boolean;
  error?: string;
  state?: WordleState;
  playerState?: WordlePlayerState;
  gameEnded?: boolean;
  winner?: string | null;
  isDraw?: boolean;
}
