import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../../prisma/prisma.service";
import {
  GeoGuesserState,
  GeoGuesserLocation,
  GeoGuesserRound,
  GeoGuesserPlayer,
  GeoGuesserGuess,
  GeoGuesserSubmitResult,
  GeoGuesserRoundResult,
} from "./geoguesser.types";

const TOTAL_ROUNDS = 5;
const ROUND_DURATION_SECONDS = 60;
const EARTH_RADIUS_KM = 6371;
const AUTO_PERFECT_SCORE_M = 25;

// Curated list of locations confirmed to have Street View coverage
const LOCATIONS: GeoGuesserLocation[] = [
  // Europe
  { lat: 48.8566, lng: 2.3522, country: "France", city: "Paris" },
  { lat: 51.5074, lng: -0.1278, country: "United Kingdom", city: "London" },
  { lat: 41.9028, lng: 12.4964, country: "Italy", city: "Rome" },
  { lat: 40.4168, lng: -3.7038, country: "Spain", city: "Madrid" },
  { lat: 52.5200, lng: 13.4050, country: "Germany", city: "Berlin" },
  { lat: 55.7558, lng: 37.6173, country: "Russia", city: "Moscow" },
  { lat: 59.9139, lng: 10.7522, country: "Norway", city: "Oslo" },
  { lat: 57.7089, lng: 11.9746, country: "Sweden", city: "Gothenburg" },
  { lat: 55.6761, lng: 12.5683, country: "Denmark", city: "Copenhagen" },
  { lat: 60.1699, lng: 24.9384, country: "Finland", city: "Helsinki" },
  { lat: 47.3769, lng: 8.5417, country: "Switzerland", city: "Zurich" },
  { lat: 48.2082, lng: 16.3738, country: "Austria", city: "Vienna" },
  { lat: 50.0755, lng: 14.4378, country: "Czech Republic", city: "Prague" },
  { lat: 47.4979, lng: 19.0402, country: "Hungary", city: "Budapest" },
  { lat: 52.2297, lng: 21.0122, country: "Poland", city: "Warsaw" },
  { lat: 44.8176, lng: 20.4633, country: "Serbia", city: "Belgrade" },
  { lat: 37.9838, lng: 23.7275, country: "Greece", city: "Athens" },
  { lat: 41.0082, lng: 28.9784, country: "Turkey", city: "Istanbul" },
  { lat: 53.3498, lng: -6.2603, country: "Ireland", city: "Dublin" },
  { lat: 50.8503, lng: 4.3517, country: "Belgium", city: "Brussels" },
  // North America
  { lat: 40.7128, lng: -74.0060, country: "USA", city: "New York" },
  { lat: 34.0522, lng: -118.2437, country: "USA", city: "Los Angeles" },
  { lat: 41.8781, lng: -87.6298, country: "USA", city: "Chicago" },
  { lat: 29.7604, lng: -95.3698, country: "USA", city: "Houston" },
  { lat: 33.4484, lng: -112.0740, country: "USA", city: "Phoenix" },
  { lat: 47.6062, lng: -122.3321, country: "USA", city: "Seattle" },
  { lat: 37.7749, lng: -122.4194, country: "USA", city: "San Francisco" },
  { lat: 25.7617, lng: -80.1918, country: "USA", city: "Miami" },
  { lat: 43.6532, lng: -79.3832, country: "Canada", city: "Toronto" },
  { lat: 45.5017, lng: -73.5673, country: "Canada", city: "Montreal" },
  { lat: 49.2827, lng: -123.1207, country: "Canada", city: "Vancouver" },
  { lat: 19.4326, lng: -99.1332, country: "Mexico", city: "Mexico City" },
  { lat: 20.9674, lng: -89.6237, country: "Mexico", city: "Merida" },
  // South America
  { lat: -23.5505, lng: -46.6333, country: "Brazil", city: "São Paulo" },
  { lat: -22.9068, lng: -43.1729, country: "Brazil", city: "Rio de Janeiro" },
  { lat: -34.6037, lng: -58.3816, country: "Argentina", city: "Buenos Aires" },
  { lat: -33.4489, lng: -70.6693, country: "Chile", city: "Santiago" },
  { lat: 4.7110, lng: -74.0721, country: "Colombia", city: "Bogotá" },
  { lat: -12.0464, lng: -77.0428, country: "Peru", city: "Lima" },
  { lat: -0.1807, lng: -78.4678, country: "Ecuador", city: "Quito" },
  // Asia
  { lat: 35.6762, lng: 139.6503, country: "Japan", city: "Tokyo" },
  { lat: 34.6937, lng: 135.5022, country: "Japan", city: "Osaka" },
  { lat: 37.5665, lng: 126.9780, country: "South Korea", city: "Seoul" },
  { lat: 39.9042, lng: 116.4074, country: "China", city: "Beijing" },
  { lat: 31.2304, lng: 121.4737, country: "China", city: "Shanghai" },
  { lat: 22.3193, lng: 114.1694, country: "Hong Kong", city: "Hong Kong" },
  { lat: 22.5431, lng: 114.0579, country: "China", city: "Shenzhen" },
  { lat: 1.3521, lng: 103.8198, country: "Singapore", city: "Singapore" },
  { lat: 13.7563, lng: 100.5018, country: "Thailand", city: "Bangkok" },
  { lat: 14.0583, lng: 108.2772, country: "Vietnam", city: "Da Nang" },
  { lat: 3.1390, lng: 101.6869, country: "Malaysia", city: "Kuala Lumpur" },
  { lat: -6.2088, lng: 106.8456, country: "Indonesia", city: "Jakarta" },
  { lat: 28.6139, lng: 77.2090, country: "India", city: "New Delhi" },
  { lat: 19.0760, lng: 72.8777, country: "India", city: "Mumbai" },
  { lat: 12.9716, lng: 77.5946, country: "India", city: "Bangalore" },
  { lat: 33.8869, lng: 9.5375, country: "Tunisia", city: "Tunis" },
  { lat: 25.2048, lng: 55.2708, country: "UAE", city: "Dubai" },
  { lat: 24.6877, lng: 46.7219, country: "Saudi Arabia", city: "Riyadh" },
  { lat: 31.7683, lng: 35.2137, country: "Israel", city: "Jerusalem" },
  // Africa
  { lat: 30.0444, lng: 31.2357, country: "Egypt", city: "Cairo" },
  { lat: -33.9249, lng: 18.4241, country: "South Africa", city: "Cape Town" },
  { lat: -26.2041, lng: 28.0473, country: "South Africa", city: "Johannesburg" },
  { lat: -1.2921, lng: 36.8219, country: "Kenya", city: "Nairobi" },
  { lat: 5.6037, lng: -0.1870, country: "Ghana", city: "Accra" },
  { lat: 6.5244, lng: 3.3792, country: "Nigeria", city: "Lagos" },
  { lat: 33.9716, lng: -6.8498, country: "Morocco", city: "Rabat" },
  { lat: -18.9249, lng: 47.5185, country: "Madagascar", city: "Antananarivo" },
  // Oceania
  { lat: -33.8688, lng: 151.2093, country: "Australia", city: "Sydney" },
  { lat: -37.8136, lng: 144.9631, country: "Australia", city: "Melbourne" },
  { lat: -27.4698, lng: 153.0251, country: "Australia", city: "Brisbane" },
  { lat: -31.9505, lng: 115.8605, country: "Australia", city: "Perth" },
  { lat: -36.8485, lng: 174.7633, country: "New Zealand", city: "Auckland" },
  { lat: -41.2865, lng: 174.7762, country: "New Zealand", city: "Wellington" },
  // Rural/scenic spots with Street View coverage
  { lat: 27.9881, lng: 86.9250, country: "Nepal", city: "Everest Region" },
  { lat: -13.1631, lng: -72.5450, country: "Peru", city: "Machu Picchu" },
  { lat: 64.9631, lng: -19.0208, country: "Iceland", city: "Þingvellir" },
  { lat: 43.7230, lng: 10.3966, country: "Italy", city: "Pisa" },
  { lat: 48.8584, lng: 2.2945, country: "France", city: "Eiffel Tower" },
  { lat: 51.1789, lng: -1.8262, country: "United Kingdom", city: "Stonehenge" },
  { lat: -25.3444, lng: 131.0369, country: "Australia", city: "Uluru" },
  { lat: 36.1069, lng: -112.1129, country: "USA", city: "Grand Canyon" },
  { lat: 44.4280, lng: -110.5885, country: "USA", city: "Yellowstone" },
  { lat: 19.8968, lng: -155.5828, country: "USA", city: "Hawaii" },
  { lat: -33.4563, lng: -70.6643, country: "Chile", city: "Valparaíso" },
  { lat: 50.4501, lng: 30.5234, country: "Ukraine", city: "Kyiv" },
  { lat: 59.3293, lng: 18.0686, country: "Sweden", city: "Stockholm" },
  { lat: 60.3913, lng: 5.3221, country: "Norway", city: "Bergen" },
  { lat: 64.1355, lng: -21.8954, country: "Iceland", city: "Reykjavik" },
  { lat: -15.7801, lng: -47.9292, country: "Brazil", city: "Brasília" },
  { lat: 10.4806, lng: -66.9036, country: "Venezuela", city: "Caracas" },
  { lat: -34.9011, lng: -56.1915, country: "Uruguay", city: "Montevideo" },
  { lat: -16.5000, lng: -68.1500, country: "Bolivia", city: "La Paz" },
  { lat: 18.4655, lng: -66.1057, country: "Puerto Rico", city: "San Juan" },
];

@Injectable()
export class GeoGuesserService {
  private games = new Map<string, GeoGuesserState>();

  constructor(private readonly prisma: PrismaService) {}

  initializeState(player1Id: string, player2Id: string, player1Name = "Player 1", player2Name = "Player 2"): GeoGuesserState {
    const selectedLocations = this.pickRandomLocations(TOTAL_ROUNDS);
    const mapDiagonalKm = this.computeMapDiagonalKm(selectedLocations);

    const rounds: GeoGuesserRound[] = selectedLocations.map((location, i) => ({
      roundNumber: i + 1,
      location,
      panoramaPov: {
        heading: Math.floor(Math.random() * 360),
        pitch: Math.floor(Math.random() * 20) - 10,
      },
      guesses: [],
    }));

    const state: GeoGuesserState = {
      phase: "waiting",
      currentRound: 1,
      totalRounds: TOTAL_ROUNDS,
      rounds,
      players: [
        { userId: player1Id, displayName: player1Name, score: 0 },
        { userId: player2Id, displayName: player2Name, score: 0 },
      ],
      roundStartedAt: 0,
      roundDurationSeconds: ROUND_DURATION_SECONDS,
      mapDiagonalKm,
    };

    return state;
  }

  setState(gameId: string, state: GeoGuesserState): void {
    this.games.set(gameId, state);
  }

  getState(gameId: string): GeoGuesserState | undefined {
    return this.games.get(gameId);
  }

  startRound(gameId: string): GeoGuesserState {
    const state = this.games.get(gameId);
    if (!state) throw new Error("Game not found");

    state.phase = "round";
    state.roundStartedAt = Date.now();

    const currentRoundData = state.rounds[state.currentRound - 1];
    currentRoundData.guesses = [];

    this.games.set(gameId, state);
    return state;
  }

  submitGuess(gameId: string, userId: string, lat: number, lng: number): GeoGuesserSubmitResult {
    const state = this.games.get(gameId);
    if (!state) throw new Error("Game not found");
    if (state.phase !== "round") throw new Error("Not in a round");

    const roundIndex = state.currentRound - 1;
    const round = state.rounds[roundIndex];

    const alreadyGuessed = round.guesses.some(g => g.userId === userId);
    if (alreadyGuessed) throw new Error("Already guessed this round");

    const distanceKm = this.haversineDistanceKm(lat, lng, round.location.lat, round.location.lng);
    const pointsEarned = this.computeScore(distanceKm, state.mapDiagonalKm);

    const guess: GeoGuesserGuess = {
      userId,
      lat,
      lng,
      distanceKm,
      pointsEarned,
      submittedAt: Date.now(),
    };

    round.guesses.push(guess);

    const player = state.players.find(p => p.userId === userId);
    if (player) {
      player.score += pointsEarned;
    }

    const roundComplete = round.guesses.length >= state.players.length;
    this.games.set(gameId, state);

    return { guess, roundComplete, state };
  }

  endRound(gameId: string): GeoGuesserRoundResult {
    const state = this.games.get(gameId);
    if (!state) throw new Error("Game not found");

    const roundIndex = state.currentRound - 1;
    const round = state.rounds[roundIndex];
    round.roundEndedAt = Date.now();

    // Fill in 0-point guesses for players who didn't submit in time
    for (const player of state.players) {
      const hasGuessed = round.guesses.some(g => g.userId === player.userId);
      if (!hasGuessed) {
        round.guesses.push({
          userId: player.userId,
          lat: 0,
          lng: 0,
          distanceKm: -1,
          pointsEarned: 0,
          submittedAt: Date.now(),
        });
      }
    }

    const isGameOver = state.currentRound >= state.totalRounds;
    let winnerId: string | null | undefined = undefined;
    let isDraw = false;

    if (isGameOver) {
      state.phase = "gameEnd";
      const sorted = [...state.players].sort((a, b) => b.score - a.score);
      if (sorted[0].score === sorted[1].score) {
        isDraw = true;
        winnerId = null;
      } else {
        winnerId = sorted[0].userId;
      }
    } else {
      state.phase = "roundResult";
      state.currentRound += 1;
    }

    this.games.set(gameId, state);

    return {
      roundNumber: roundIndex + 1,
      location: round.location,
      guesses: round.guesses,
      scores: [...state.players],
      isGameOver,
      winnerId,
      isDraw,
    };
  }

  removeGame(gameId: string): void {
    this.games.delete(gameId);
  }

  haversineDistanceKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
    const toRad = (deg: number) => (deg * Math.PI) / 180;
    const dLat = toRad(lat2 - lat1);
    const dLng = toRad(lng2 - lng1);
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
    const c = 2 * Math.asin(Math.sqrt(a));
    return EARTH_RADIUS_KM * c;
  }

  computeScore(distanceKm: number, mapDiagonalKm: number): number {
    const distanceM = distanceKm * 1000;
    if (distanceM <= AUTO_PERFECT_SCORE_M) return 5000;
    const score = 5000 * Math.exp((-10 * distanceKm) / mapDiagonalKm);
    return Math.round(Math.max(0, Math.min(5000, score)));
  }

  private pickRandomLocations(count: number): GeoGuesserLocation[] {
    const shuffled = [...LOCATIONS];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled.slice(0, count);
  }

  private computeMapDiagonalKm(locations: GeoGuesserLocation[]): number {
    if (locations.length === 0) return 20015;

    const lats = locations.map(l => l.lat);
    const lngs = locations.map(l => l.lng);

    const minLat = Math.min(...lats);
    const maxLat = Math.max(...lats);
    const minLng = Math.min(...lngs);
    const maxLng = Math.max(...lngs);

    return this.haversineDistanceKm(minLat, minLng, maxLat, maxLng);
  }

  async persistRoundEnd(gameId: string, state: GeoGuesserState): Promise<void> {
    try {
      await this.prisma.game.update({
        where: { id: gameId },
        data: { state: state as any },
      });
    } catch {
      // Non-fatal — in-memory state is authoritative during active game
    }
  }

  async finalizeGame(gameId: string, winnerId: string | null): Promise<void> {
    const state = this.games.get(gameId);
    if (!state) return;

    const statusUpdate: any = {
      status: "COMPLETED",
      endedAt: new Date(),
      state: state as any,
    };

    if (winnerId) {
      statusUpdate.winnerUserId = winnerId;
    }

    await this.prisma.game.update({
      where: { id: gameId },
      data: statusUpdate,
    });

    // Update GamePlayer scores and results
    for (const player of state.players) {
      let result: string;
      if (!winnerId) {
        result = "draw";
      } else if (player.userId === winnerId) {
        result = "win";
      } else {
        result = "loss";
      }

      await this.prisma.gamePlayer.updateMany({
        where: { gameId, userId: player.userId },
        data: { score: player.score, result },
      });
    }

    this.games.delete(gameId);
  }
}
