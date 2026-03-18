export type C4Disc = 'R' | 'Y' | null;
export type C4Board = C4Disc[][];  // [6 rows][7 cols] — row 0 is top, row 5 is bottom

export interface C4Move {
  col: number;
  row: number;
  player: 'R' | 'Y';
  timestamp: number;
}

export interface ConnectFourState {
  board: C4Board;
  currentTurn: 'R' | 'Y';
  playerR: string;  // userId for Red  (goes first)
  playerY: string;  // userId for Yellow
  moveHistory: C4Move[];
  startedAt: number;
}

export interface C4MoveResult {
  success: boolean;
  error?: string;
  state?: ConnectFourState;
  winner?: string | null;   // userId or null
  isDraw?: boolean;
  winningCells?: [number, number][];  // array of [row, col] pairs
}

export interface C4GameEndResult {
  winnerId: string | null;
  isDraw: boolean;
  reason: 'win' | 'draw' | 'forfeit';
  winningCells?: [number, number][];
}

export const ROWS = 6;
export const COLS = 7;
