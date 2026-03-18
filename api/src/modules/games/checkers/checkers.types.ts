// 'B' = Black man, 'BK' = Black king, 'R' = Red man, 'RK' = Red king, null = empty
export type CheckersPiece = 'B' | 'BK' | 'R' | 'RK' | null;
export type CheckersBoard = CheckersPiece[][];  // [8 rows][8 cols]
export type CheckersColor = 'B' | 'R';

export interface CheckersSquare {
  row: number;
  col: number;
}

export interface CheckersMove {
  from: CheckersSquare;
  to: CheckersSquare;
  captured: CheckersSquare[];  // squares of pieces removed this turn
  promoted: boolean;           // a king was created on this move
  timestamp: number;
}

export interface CheckersState {
  board: CheckersBoard;
  currentTurn: CheckersColor;
  playerB: string;   // userId — Black, goes first
  playerR: string;   // userId — Red
  moveHistory: CheckersMove[];
  capturedB: number;   // count of Black pieces captured so far
  capturedR: number;   // count of Red pieces captured so far
  // When non-null, only this piece may move (mid-chain capture)
  mustContinueCapture: CheckersSquare | null;
  // Squares already jumped over in the current chain (cannot be re-jumped)
  chainCaptured: CheckersSquare[];
  noCaptureCount: number;    // increments each half-turn with no capture; draw at 40
  positionHistory: string[]; // serialised board+turn strings for 3-fold repetition
  startedAt: number;
}

export interface CheckersMoveResult {
  success: boolean;
  error?: string;
  state?: CheckersState;
  winner?: string | null;   // userId or null
  isDraw?: boolean;
}

export interface CheckersGameEndResult {
  winnerId: string | null;
  isDraw: boolean;
  reason: 'win' | 'draw' | 'forfeit';
}
