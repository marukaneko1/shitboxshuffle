export interface BananagramsPlacement {
  row: number;
  col: number;
  letter: string;
}

export interface BananagramsPlayerState {
  tiles: string[];
  grid: BananagramsPlacement[];
  ready: boolean;
}

export interface BananagramsState {
  pool: string[];
  players: Record<string, BananagramsPlayerState>;
  player1: string;
  player2: string;
  phase: 'playing' | 'validating' | 'ended';
  startedAt: number;
  winner: string | null;
  rottenBanana: string | null;
}

export interface BananagramsMoveResult {
  success: boolean;
  error?: string;
  state?: BananagramsState;
  gameEnded?: boolean;
  winner?: string | null;
  newTiles?: string[];
  isDraw?: boolean;
}
