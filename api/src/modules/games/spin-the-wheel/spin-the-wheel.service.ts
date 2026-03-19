import { Injectable } from '@nestjs/common';
import {
  WheelState,
  WheelPlayerState,
  WheelActionResult,
  WheelSpinResult,
} from './spin-the-wheel.types';

@Injectable()
export class SpinTheWheelService {
  private gameStates = new Map<string, WheelState>();

  private readonly INITIAL_CHIPS = 1000;
  private readonly MIN_BET = 10;
  private readonly SPIN_ROTATIONS = 6;

  initializeState(player1Id: string, player2Id: string): WheelState {
    return {
      players: [
        { userId: player1Id, chips: this.INITIAL_CHIPS, bet: 0, hasBet: false },
        { userId: player2Id, chips: this.INITIAL_CHIPS, bet: 0, hasBet: false },
      ],
      phase: 'betting',
      roundNumber: 1,
      startedAt: Date.now(),
    };
  }

  getState(gameId: string): WheelState | undefined {
    return this.gameStates.get(gameId);
  }

  setState(gameId: string, state: WheelState): void {
    this.gameStates.set(gameId, state);
  }

  cleanupGame(gameId: string): void {
    this.gameStates.delete(gameId);
  }

  placeBet(gameId: string, userId: string, amount: number): WheelActionResult {
    const state = this.gameStates.get(gameId);
    if (!state) return { success: false, error: 'Game not found' };
    if (state.phase !== 'betting') return { success: false, error: 'Not in betting phase' };

    const player = state.players.find((p) => p.userId === userId);
    if (!player) return { success: false, error: 'Player not in this game' };
    if (player.hasBet) return { success: false, error: 'Already bet this round' };

    if (amount < this.MIN_BET) {
      return { success: false, error: `Minimum bet is ${this.MIN_BET}` };
    }

    // Cap bet at current chip count; if chips are 0 or negative, allow MIN_BET
    const maxBet = Math.max(player.chips, this.MIN_BET);
    const effectiveBet = Math.min(amount, maxBet);

    player.bet = effectiveBet;
    player.hasBet = true;

    const allBet = state.players.every((p) => p.hasBet);
    if (!allBet) {
      this.gameStates.set(gameId, state);
      return { success: true, state: this.cloneState(state) };
    }

    // Both bets in — spin and resolve
    const spinResult = this.resolveRound(state);
    state.phase = 'result';
    state.lastSpin = spinResult;
    this.gameStates.set(gameId, state);

    return { success: true, state: this.cloneState(state), spinResult };
  }

  startNewRound(gameId: string): WheelState | null {
    const state = this.gameStates.get(gameId);
    if (!state) return null;

    state.phase = 'betting';
    state.roundNumber++;
    state.lastSpin = undefined;
    state.winnerIds = undefined;
    state.lastWinnings = undefined;
    for (const p of state.players) {
      p.bet = 0;
      p.hasBet = false;
    }

    this.gameStates.set(gameId, state);
    return this.cloneState(state);
  }

  private resolveRound(state: WheelState): WheelSpinResult {
    const winnerIndex = Math.random() < 0.5 ? 0 : 1;
    const loserIndex = 1 - winnerIndex;
    const winner = state.players[winnerIndex];
    const loser = state.players[loserIndex];

    // Proportional payout: winner's bet % of their wealth → claims that % from loser
    const winnerWealth = winner.chips;
    const betPct = winnerWealth > 0 ? winner.bet / winnerWealth : 1;
    // No floor — loser CAN go into negatives
    const transfer = Math.floor(Math.min(betPct, 1) * loser.chips);

    winner.chips += transfer;
    loser.chips -= transfer;

    state.lastWinnings = {
      [winner.userId]: transfer,
      [loser.userId]: -transfer,
    };
    state.winnerIds = [winner.userId];

    // Build proportional slice angles based on each player's bet size
    const totalBets = state.players.reduce((sum, p) => sum + p.bet, 0);
    const playerAngles =
      totalBets > 0
        ? state.players.map((p) => (p.bet / totalBets) * 360)
        : state.players.map(() => 360 / state.players.length);

    // Cumulative start angle for each player's slice
    const playerStarts: number[] = [];
    let cumulative = 0;
    for (const angle of playerAngles) {
      playerStarts.push(cumulative);
      cumulative += angle;
    }

    // Random landing within the winner's proportional slice (pad 10% from edges)
    const winnerStart = playerStarts[winnerIndex];
    const winnerAngle = playerAngles[winnerIndex];
    const pad = Math.max(5, winnerAngle * 0.1);
    const baseLanding =
      winnerStart + pad + Math.random() * Math.max(0, winnerAngle - 2 * pad);
    const totalDegrees = this.SPIN_ROTATIONS * 360 + baseLanding;

    return { winnerIndex, finalAngle: baseLanding, totalDegrees, playerAngles };
  }

  private cloneState(state: WheelState): WheelState {
    return structuredClone(state);
  }
}
