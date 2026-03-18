export type PKDirection = 'N' | 'NE' | 'E' | 'SE' | 'S' | 'SW' | 'W' | 'NW' | 'STAY';
export type PKPower = 1 | 2 | 3;

export interface PenguinPosition {
  x: number;
  y: number;
}

export interface PenguinState {
  position: PenguinPosition;
  isEliminated: boolean;
}

export interface PKMove {
  direction: PKDirection;
  power: PKPower;
}

export interface PKRoundResolution {
  moves: { [userId: string]: PKMove };
  positions: { [userId: string]: PenguinPosition };
  collision: boolean;
  eliminations: string[];
  platformShrunk: boolean;
  newPlatformRadius: number;
}

export interface PenguinKnockoutState {
  player1: string;
  player2: string;
  penguins: { [userId: string]: PenguinState };
  platformRadius: number;
  round: number;
  phase: 'planning' | 'resolved' | 'ended';
  submittedMoves: { [userId: string]: PKMove | null };
  lastRoundResolution?: PKRoundResolution;
  startedAt: number;
}

export interface PKSubmitResult {
  success: boolean;
  error?: string;
  waitingForOpponent?: boolean;
  state?: PenguinKnockoutState;
  roundResolution?: PKRoundResolution;
  winner?: string | null;
  isDraw?: boolean;
}

export interface PKGameEndResult {
  winnerId: string | null;
  isDraw: boolean;
  reason: 'win' | 'draw' | 'forfeit';
}

export const INITIAL_PLATFORM_RADIUS = 5;
export const SHRINK_EVERY_N_ROUNDS = 2;
export const SHRINK_AMOUNT = 1;
export const MIN_PLATFORM_RADIUS = 2;

export const DIRECTION_VECTORS: Record<PKDirection, PenguinPosition> = {
  N:    { x:  0, y: -1 },
  NE:   { x:  1, y: -1 },
  E:    { x:  1, y:  0 },
  SE:   { x:  1, y:  1 },
  S:    { x:  0, y:  1 },
  SW:   { x: -1, y:  1 },
  W:    { x: -1, y:  0 },
  NW:   { x: -1, y: -1 },
  STAY: { x:  0, y:  0 },
};

export function isOnPlatform(pos: PenguinPosition, radius: number): boolean {
  return Math.sqrt(pos.x * pos.x + pos.y * pos.y) <= radius + 0.5;
}

export function applyMove(pos: PenguinPosition, move: PKMove): PenguinPosition {
  const vec = DIRECTION_VECTORS[move.direction];
  return {
    x: pos.x + vec.x * move.power,
    y: pos.y + vec.y * move.power,
  };
}
