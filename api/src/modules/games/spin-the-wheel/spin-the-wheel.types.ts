export type WheelPhase = 'betting' | 'result';

export interface WheelPlayerState {
  userId: string;
  chips: number;
  bet: number;
  hasBet: boolean;
}

export interface WheelSpinResult {
  winnerIndex: number;
  finalAngle: number;
  totalDegrees: number;
  /** Degrees each player's slice occupies, proportional to their bet */
  playerAngles: number[];
}

export interface WheelState {
  players: WheelPlayerState[];
  phase: WheelPhase;
  roundNumber: number;
  lastSpin?: WheelSpinResult;
  lastWinnings?: Record<string, number>;
  winnerIds?: string[];
  startedAt: number;
}

export interface WheelActionResult {
  success: boolean;
  error?: string;
  state?: WheelState;
  spinResult?: WheelSpinResult;
}
