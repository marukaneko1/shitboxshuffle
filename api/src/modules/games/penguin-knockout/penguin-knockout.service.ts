import { Injectable, BadRequestException } from "@nestjs/common";
import { PrismaService } from "../../../prisma/prisma.service";
import { GameStatus } from "@prisma/client";
import {
  PenguinKnockoutState,
  PenguinState,
  PKMove,
  PKSubmitResult,
  PKGameEndResult,
  PKRoundResolution,
  INITIAL_PLATFORM_RADIUS,
  SHRINK_EVERY_N_ROUNDS,
  SHRINK_AMOUNT,
  MIN_PLATFORM_RADIUS,
  applyMove,
  isOnPlatform,
} from "./penguin-knockout.types";

@Injectable()
export class PenguinKnockoutService {
  private states = new Map<string, PenguinKnockoutState>();

  constructor(private readonly prisma: PrismaService) {}

  // ─── State accessors ──────────────────────────────────────────────────────

  getState(gameId: string): PenguinKnockoutState | undefined {
    return this.states.get(gameId);
  }

  setState(gameId: string, state: PenguinKnockoutState): void {
    this.states.set(gameId, state);
  }

  deleteState(gameId: string): void {
    this.states.delete(gameId);
  }

  // ─── Initialize ───────────────────────────────────────────────────────────

  initializeState(player1Id: string, player2Id: string): PenguinKnockoutState {
    const penguins: { [userId: string]: PenguinState } = {
      [player1Id]: { position: { x: -3, y: 0 }, isEliminated: false },
      [player2Id]: { position: { x: 3, y: 0 }, isEliminated: false },
    };

    const state: PenguinKnockoutState = {
      player1: player1Id,
      player2: player2Id,
      penguins,
      platformRadius: INITIAL_PLATFORM_RADIUS,
      round: 1,
      phase: 'planning',
      submittedMoves: { [player1Id]: null, [player2Id]: null },
      startedAt: Date.now(),
    };

    return state;
  }

  // ─── Submit a move ────────────────────────────────────────────────────────

  async submitMove(
    gameId: string,
    userId: string,
    move: PKMove,
  ): Promise<PKSubmitResult> {
    const game = await this.prisma.game.findUnique({
      where: { id: gameId },
      include: { players: true },
    });

    if (!game) return { success: false, error: 'Game not found' };
    if (game.status !== GameStatus.ACTIVE) return { success: false, error: 'Game is not active' };

    let state = this.states.get(gameId);
    if (!state) {
      state = game.state as unknown as PenguinKnockoutState;
      if (!state) return { success: false, error: 'Invalid game state' };
      this.states.set(gameId, state);
    }

    if (state.phase !== 'planning') {
      return { success: false, error: 'Not in planning phase' };
    }

    const playerIds = [state.player1, state.player2];
    if (!playerIds.includes(userId)) {
      return { success: false, error: 'You are not a player in this game' };
    }

    if (state.penguins[userId]?.isEliminated) {
      return { success: false, error: 'Your penguin has already been eliminated' };
    }

    if (state.submittedMoves[userId] !== null) {
      return { success: false, error: 'You have already submitted a move this round' };
    }

    // Record this player's move
    state.submittedMoves[userId] = move;

    const otherPlayerId = userId === state.player1 ? state.player2 : state.player1;
    const otherEliminated = state.penguins[otherPlayerId]?.isEliminated;

    // If other player is eliminated, auto-resolve with their "STAY" move
    if (otherEliminated && state.submittedMoves[otherPlayerId] === null) {
      state.submittedMoves[otherPlayerId] = { direction: 'STAY', power: 1 };
    }

    // Check if both have submitted (or only one active player left)
    const bothSubmitted =
      state.submittedMoves[state.player1] !== null &&
      state.submittedMoves[state.player2] !== null;

    if (!bothSubmitted) {
      // Persist partial state (so opponent can see "waiting" indicator)
      await this.prisma.game.update({ where: { id: gameId }, data: { state: state as any } });
      this.states.set(gameId, state);
      return { success: true, waitingForOpponent: true, state };
    }

    // ── Both submitted: resolve round ────────────────────────────────────────
    const resolution = this.resolveRound(state);
    state = this.applyResolution(state, resolution);

    // Persist updated state
    const gameEnd = this.checkGameEnd(state);

    if (gameEnd) {
      await this.prisma.game.update({
        where: { id: gameId },
        data: {
          state: state as any,
          status: GameStatus.COMPLETED,
          winnerUserId: gameEnd.winnerId,
          endedAt: new Date(),
        },
      });

      if (gameEnd.winnerId && !gameEnd.isDraw) {
        const loserId = gameEnd.winnerId === state.player1 ? state.player2 : state.player1;
        await this.prisma.gamePlayer.updateMany({ where: { gameId, userId: gameEnd.winnerId }, data: { result: 'win' } });
        await this.prisma.gamePlayer.updateMany({ where: { gameId, userId: loserId }, data: { result: 'loss' } });
      } else if (gameEnd.isDraw) {
        await this.prisma.gamePlayer.updateMany({ where: { gameId }, data: { result: 'draw' } });
      }

      this.states.set(gameId, state);
      return {
        success: true,
        state,
        roundResolution: resolution,
        winner: gameEnd.winnerId,
        isDraw: gameEnd.isDraw,
      };
    }

    await this.prisma.game.update({ where: { id: gameId }, data: { state: state as any } });
    this.states.set(gameId, state);

    return {
      success: true,
      state,
      roundResolution: resolution,
      winner: null,
      isDraw: false,
    };
  }

  // ─── Round resolution logic ───────────────────────────────────────────────

  private resolveRound(state: PenguinKnockoutState): PKRoundResolution {
    const { player1, player2, penguins, submittedMoves, platformRadius, round } = state;

    const moves = {
      [player1]: submittedMoves[player1]!,
      [player2]: submittedMoves[player2]!,
    };

    // Compute raw destination for each non-eliminated penguin
    const rawPositions: { [userId: string]: { x: number; y: number } } = {};

    for (const userId of [player1, player2]) {
      if (penguins[userId].isEliminated) {
        rawPositions[userId] = { ...penguins[userId].position };
        continue;
      }
      rawPositions[userId] = applyMove(penguins[userId].position, moves[userId]);
    }

    // Collision detection
    let collision = false;
    const p1raw = rawPositions[player1];
    const p2raw = rawPositions[player2];
    const p1orig = penguins[player1].position;
    const p2orig = penguins[player2].position;

    // Same-cell collision
    const sameTile = !penguins[player1].isEliminated &&
      !penguins[player2].isEliminated &&
      p1raw.x === p2raw.x && p1raw.y === p2raw.y;

    // Crossover collision: penguins swap positions (pass through each other)
    const crossover = !penguins[player1].isEliminated &&
      !penguins[player2].isEliminated &&
      p1raw.x === p2orig.x && p1raw.y === p2orig.y &&
      p2raw.x === p1orig.x && p2raw.y === p1orig.y;

    if (sameTile || crossover) {
      collision = true;
      const p1power = moves[player1].power;
      const p2power = moves[player2].power;

      if (p1power > p2power) {
        // Player 1 wins collision — player 2 pushed back further from origin
        const pushVec = PUSH_AWAY_VECTOR(p2orig, p1orig);
        rawPositions[player2] = {
          x: p2orig.x + pushVec.x * (p2power + 1),
          y: p2orig.y + pushVec.y * (p2power + 1),
        };
        rawPositions[player1] = { ...p1raw };
      } else if (p2power > p1power) {
        // Player 2 wins collision — player 1 pushed back further
        const pushVec = PUSH_AWAY_VECTOR(p1orig, p2orig);
        rawPositions[player1] = {
          x: p1orig.x + pushVec.x * (p1power + 1),
          y: p1orig.y + pushVec.y * (p1power + 1),
        };
        rawPositions[player2] = { ...p2raw };
      } else {
        // Equal power: both pushed back to opposite sides
        rawPositions[player1] = {
          x: p1orig.x - DIRECTION_SIGN(p1raw.x - p1orig.x),
          y: p1orig.y - DIRECTION_SIGN(p1raw.y - p1orig.y),
        };
        rawPositions[player2] = {
          x: p2orig.x - DIRECTION_SIGN(p2raw.x - p2orig.x),
          y: p2orig.y - DIRECTION_SIGN(p2raw.y - p2orig.y),
        };
      }
    }

    // Edge check — determine eliminations
    const eliminations: string[] = [];
    for (const userId of [player1, player2]) {
      if (penguins[userId].isEliminated) continue;
      if (!isOnPlatform(rawPositions[userId], platformRadius)) {
        eliminations.push(userId);
      }
    }

    // Platform shrink check — shrink after every N rounds
    const shouldShrink = round % SHRINK_EVERY_N_ROUNDS === 0;
    const newPlatformRadius = shouldShrink
      ? Math.max(MIN_PLATFORM_RADIUS, platformRadius - SHRINK_AMOUNT)
      : platformRadius;

    // After shrink: check if any non-eliminated penguins are now off the new radius
    if (shouldShrink && newPlatformRadius < platformRadius) {
      for (const userId of [player1, player2]) {
        if (penguins[userId].isEliminated || eliminations.includes(userId)) continue;
        if (!isOnPlatform(rawPositions[userId], newPlatformRadius)) {
          eliminations.push(userId);
        }
      }
    }

    return {
      moves,
      positions: rawPositions,
      collision,
      eliminations,
      platformShrunk: shouldShrink && newPlatformRadius < platformRadius,
      newPlatformRadius,
    };
  }

  private applyResolution(
    state: PenguinKnockoutState,
    resolution: PKRoundResolution,
  ): PenguinKnockoutState {
    const newPenguins = { ...state.penguins };

    for (const userId of [state.player1, state.player2]) {
      newPenguins[userId] = {
        position: resolution.positions[userId],
        isEliminated:
          state.penguins[userId].isEliminated ||
          resolution.eliminations.includes(userId),
      };
    }

    return {
      ...state,
      penguins: newPenguins,
      platformRadius: resolution.newPlatformRadius,
      round: state.round + 1,
      phase: 'planning',
      submittedMoves: {
        [state.player1]: null,
        [state.player2]: null,
      },
      lastRoundResolution: resolution,
    };
  }

  // ─── Win condition ────────────────────────────────────────────────────────

  private readonly MAX_ROUNDS = 50;

  checkGameEnd(state: PenguinKnockoutState): PKGameEndResult | null {
    const p1elim = state.penguins[state.player1].isEliminated;
    const p2elim = state.penguins[state.player2].isEliminated;

    if (p1elim && p2elim) {
      return { winnerId: null, isDraw: true, reason: 'draw' };
    }
    if (p1elim) {
      return { winnerId: state.player2, isDraw: false, reason: 'win' };
    }
    if (p2elim) {
      return { winnerId: state.player1, isDraw: false, reason: 'win' };
    }

    if (state.round > this.MAX_ROUNDS) {
      return { winnerId: null, isDraw: true, reason: 'draw' };
    }

    return null;
  }

  // ─── Forfeit ──────────────────────────────────────────────────────────────

  async forfeitGame(gameId: string, forfeitingUserId: string): Promise<PKGameEndResult> {
    const game = await this.prisma.game.findUnique({ where: { id: gameId } });
    if (!game) throw new BadRequestException('Game not found');
    if (game.status !== GameStatus.ACTIVE) throw new BadRequestException('Game is not active');

    const state = this.states.get(gameId) ?? (game.state as unknown as PenguinKnockoutState);
    if (!state) throw new BadRequestException('Invalid game state');

    const winnerId = state.player1 === forfeitingUserId ? state.player2 : state.player1;

    await this.prisma.game.update({
      where: { id: gameId },
      data: { status: GameStatus.COMPLETED, winnerUserId: winnerId, endedAt: new Date() },
    });
    await this.prisma.gamePlayer.updateMany({ where: { gameId, userId: winnerId }, data: { result: 'win' } });
    await this.prisma.gamePlayer.updateMany({ where: { gameId, userId: forfeitingUserId }, data: { result: 'forfeit' } });

    this.deleteState(gameId);

    return { winnerId, isDraw: false, reason: 'forfeit' };
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function DIRECTION_SIGN(n: number): number {
  if (n > 0) return 1;
  if (n < 0) return -1;
  return 0;
}

/** Returns a unit-ish push direction pointing away from `toward` and away from `origin`. */
function PUSH_AWAY_VECTOR(
  origin: { x: number; y: number },
  toward: { x: number; y: number },
): { x: number; y: number } {
  const dx = DIRECTION_SIGN(origin.x - toward.x);
  const dy = DIRECTION_SIGN(origin.y - toward.y);
  // Fallback if same position
  if (dx === 0 && dy === 0) return { x: 1, y: 0 };
  return { x: dx, y: dy };
}
