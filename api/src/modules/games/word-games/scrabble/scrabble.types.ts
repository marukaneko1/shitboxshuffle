export type PremiumType = 'DL' | 'TL' | 'DW' | 'TW' | null;

export interface ScrabbleTile {
  letter: string;
  score: number;
  isBlank: boolean;
}

export interface TilePlacement {
  row: number;
  col: number;
  tile: ScrabbleTile;
}

export interface ScrabbleState {
  board: (ScrabbleTile | null)[][];
  premiumMap: PremiumType[][];
  tileBag: ScrabbleTile[];
  playerTiles: Record<string, ScrabbleTile[]>;
  scores: Record<string, number>;
  player1: string;
  player2: string;
  currentTurn: string;
  moveHistory: {
    userId: string;
    word: string;
    score: number;
    placements: TilePlacement[];
    wordsFormed: { word: string; score: number }[];
    previousRack: ScrabbleTile[];
    previousBagLength: number;
  }[];
  consecutivePasses: number;
  phase: 'playing' | 'ended';
  firstMove: boolean;
  winner: string | null;
  isDraw: boolean;
}

export interface ScrabbleMoveResult {
  success: boolean;
  error?: string;
  state?: ScrabbleState;
  wordScore?: number;
  wordsFormed?: { word: string; score: number }[];
  gameEnded?: boolean;
  winner?: string | null;
  isDraw?: boolean;
}
