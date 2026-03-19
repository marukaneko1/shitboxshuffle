export type UnoColor = 'R' | 'G' | 'B' | 'Y' | 'W';
export type UnoValue = '0' | '1' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | 'S' | 'REV' | 'D2' | 'W' | 'WD4';

export interface UnoCard {
  id: number;
  color: UnoColor;
  value: UnoValue;
}

export interface UnoState {
  drawPile: UnoCard[];
  discardPile: UnoCard[];
  /** Full hands — only sent to respective owner; opponent sees hand counts */
  hands: Record<string, UnoCard[]>;
  currentTurn: string;        // userId
  playerOrder: [string, string];
  currentColor: UnoColor;     // active color (matters for wilds)
  phase: 'play' | 'draw_play_or_pass' | 'ended';
  winner: string | null;
  lastAction: string;
  drawCount: number;          // how many cards current player must draw (pending penalty)
}

/** Sanitized for a specific viewer — opponent hand replaced with count */
export interface UnoClientState {
  discardPile: UnoCard[];
  myHand: UnoCard[];
  opponentHandCount: number;
  drawPileCount: number;
  currentTurn: string;
  playerOrder: [string, string];
  currentColor: UnoColor;
  phase: 'play' | 'draw_play_or_pass' | 'ended';
  winner: string | null;
  lastAction: string;
}

export interface UnoMoveResult {
  success: boolean;
  error?: string;
  state?: UnoState;
  winner?: string | null;
  isDraw?: boolean;
}

export interface UnoGameEndResult {
  winnerId: string;
  loserId: string;
  reason: 'win' | 'forfeit';
}
