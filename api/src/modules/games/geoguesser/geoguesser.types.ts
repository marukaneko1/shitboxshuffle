export interface GeoGuesserLocation {
  lat: number;
  lng: number;
  country: string;
  city?: string;
}

export interface GeoGuesserGuess {
  userId: string;
  lat: number;
  lng: number;
  distanceKm: number;
  pointsEarned: number;
  submittedAt: number;
}

export interface GeoGuesserRound {
  roundNumber: number;
  location: GeoGuesserLocation;
  panoramaPov: { heading: number; pitch: number };
  guesses: GeoGuesserGuess[];
  roundEndedAt?: number;
}

export interface GeoGuesserPlayer {
  userId: string;
  displayName: string;
  score: number;
}

export interface GeoGuesserState {
  phase: 'waiting' | 'round' | 'roundResult' | 'gameEnd';
  currentRound: number;
  totalRounds: number;
  rounds: GeoGuesserRound[];
  players: GeoGuesserPlayer[];
  roundStartedAt: number;
  roundDurationSeconds: number;
  mapDiagonalKm: number;
}

export interface GeoGuesserSubmitResult {
  guess: GeoGuesserGuess;
  roundComplete: boolean;
  state: GeoGuesserState;
}

export interface GeoGuesserRoundResult {
  roundNumber: number;
  location: GeoGuesserLocation;
  guesses: GeoGuesserGuess[];
  scores: GeoGuesserPlayer[];
  isGameOver: boolean;
  winnerId?: string | null;
  isDraw?: boolean;
}
