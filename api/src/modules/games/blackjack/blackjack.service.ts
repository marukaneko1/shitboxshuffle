import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import {
  BlackjackState,
  BlackjackPlayerState,
  BlackjackAction,
  BlackjackActionResult,
  BlackjackActionRecord,
  Card,
} from './blackjack.types';
import {
  createDeck,
  shuffleDeck,
  dealCards,
  calculateHandValue,
  isBust,
  isBlackjack,
  compareHands,
} from './blackjack.utils';

@Injectable()
export class BlackjackService {
  private readonly logger = new Logger(BlackjackService.name);
  private gameStates = new Map<string, BlackjackState>();
  private processingLocks = new Map<string, Promise<void>>();
  private turnTimers = new Map<string, NodeJS.Timeout>();

  constructor(private readonly prisma: PrismaService) {}

  private readonly INITIAL_CHIPS = 1000;
  private readonly MIN_BET = 10;
  private readonly DEFAULT_BET = 20;
  readonly TURN_TIMEOUT_MS = 45_000;

  private cloneState(state: BlackjackState): BlackjackState {
    return structuredClone(state);
  }

  /**
   * "Skin in the Game" payout formula:
   * The winner claims the same fraction of the loser's total wealth as they wagered of their own.
   * e.g. bet 50% of your stack → take 50% of opponent's stack if you win.
   */
  private computeTransfer(
    winner: BlackjackPlayerState,
    loser: BlackjackPlayerState,
    multiplier = 1,
  ): number {
    const winnerWealth = winner.chips + winner.bet;
    const loserWealth = loser.chips + loser.bet;
    if (winnerWealth === 0 || loserWealth === 0) return 0;
    const betPct = winner.bet / winnerWealth;
    return Math.min(Math.floor(betPct * loserWealth * multiplier), loserWealth);
  }

  private applyWin(
    winner: BlackjackPlayerState,
    loser: BlackjackPlayerState,
    multiplier = 1,
  ): { winnerDelta: number; loserDelta: number } {
    const transfer = this.computeTransfer(winner, loser, multiplier);
    winner.chips += winner.bet + transfer;
    loser.chips = Math.max(0, loser.chips + loser.bet - transfer);
    return { winnerDelta: transfer, loserDelta: -transfer };
  }

  sanitizeStateForPlayer(state: BlackjackState, userId: string): BlackjackState {
    const cloned = this.cloneState(state);
    delete (cloned as any).deck;
    if (!state.isHandComplete) {
      for (const player of cloned.players) {
        if (player.userId !== userId) {
          // Show only the first card; hide the rest (like a traditional hole card)
          player.hand = player.hand.map((card, i) =>
            i === 0 ? card : ({ suit: 'hidden', rank: 'hidden' } as any),
          );
          // Hide opponent's total until the hand is over
          player.handValue = 0;
          player.isSoft = false;
        }
      }
    }
    return cloned;
  }

  getState(gameId: string): BlackjackState | undefined {
    return this.gameStates.get(gameId);
  }

  setState(gameId: string, state: BlackjackState): void {
    this.gameStates.set(gameId, state);
  }

  clearTurnTimer(gameId: string): void {
    const timer = this.turnTimers.get(gameId);
    if (timer) {
      clearTimeout(timer);
      this.turnTimers.delete(gameId);
    }
  }

  setTurnTimer(gameId: string, callback: () => void): void {
    this.clearTurnTimer(gameId);
    const timer = setTimeout(callback, this.TURN_TIMEOUT_MS);
    this.turnTimers.set(gameId, timer);
  }

  /**
   * Auto-act for the timed-out player:
   * - In betting phase: auto-bet minimum
   * - In playing phase: auto-stand
   */
  async autoActForTimeout(gameId: string): Promise<BlackjackActionResult | null> {
    const state = this.gameStates.get(gameId);
    if (!state || state.isHandComplete) return null;

    if (state.phase === 'betting') {
      const waitingPlayer = state.players.find((p) => p.status === 'betting');
      if (!waitingPlayer) return null;
      return this.processAction(gameId, waitingPlayer.userId, 'bet', this.MIN_BET);
    } else if (state.phase === 'playing') {
      const currentPlayer = state.players[state.currentPlayerIndex];
      if (!currentPlayer || currentPlayer.status !== 'playing') return null;
      return this.processAction(gameId, currentPlayer.userId, 'stand');
    }

    return null;
  }

  cleanupGame(gameId: string): void {
    this.clearTurnTimer(gameId);
    this.gameStates.delete(gameId);
    const resolver = this.lockResolvers.get(gameId);
    this.processingLocks.delete(gameId);
    this.lockResolvers.delete(gameId);
    if (resolver) resolver();
  }

  private lockResolvers = new Map<string, () => void>();

  private async acquireLock(gameId: string): Promise<void> {
    while (this.processingLocks.has(gameId)) {
      await this.processingLocks.get(gameId);
    }
    let releaseLock!: () => void;
    const lockPromise = new Promise<void>((resolve) => {
      releaseLock = resolve;
    });
    this.processingLocks.set(gameId, lockPromise);
    this.lockResolvers.set(gameId, releaseLock);
  }

  private releaseLock(gameId: string): void {
    const resolver = this.lockResolvers.get(gameId);
    this.processingLocks.delete(gameId);
    this.lockResolvers.delete(gameId);
    if (resolver) resolver();
  }

  initializeState(gameId: string, playerIds: string[]): BlackjackState {
    if (playerIds.length !== 2) {
      throw new BadRequestException('Blackjack requires exactly 2 players');
    }

    const deck = shuffleDeck(createDeck());
    const dealerIndex = Math.floor(Math.random() * 2);

    const players: BlackjackPlayerState[] = playerIds.map((userId) => ({
      userId,
      chips: this.INITIAL_CHIPS,
      hand: [],
      handValue: 0,
      isSoft: false,
      bet: 0,
      status: 'betting' as const,
      lastAction: undefined,
    }));

    const state: BlackjackState = {
      players,
      deck,
      pot: 0,
      currentPlayerIndex: dealerIndex,
      phase: 'betting',
      handNumber: 1,
      dealerIndex,
      actionHistory: [],
      isHandComplete: false,
      winnerIds: undefined,
      lastWinnings: undefined,
      startedAt: Date.now(),
    };

    this.gameStates.set(gameId, state);
    return this.cloneState(state);
  }

  async processAction(
    gameId: string,
    userId: string,
    action: BlackjackAction,
    amount?: number,
  ): Promise<BlackjackActionResult> {
    await this.acquireLock(gameId);

    try {
      const state = this.gameStates.get(gameId);
      if (!state) {
        return { success: false, error: 'Game not found' };
      }

      const playerIndex = state.players.findIndex((p) => p.userId === userId);
      if (playerIndex === -1) {
        return { success: false, error: 'Player not in this game' };
      }

      const player = state.players[playerIndex];

      if (action === 'bet') {
        return this.processBet(state, gameId, player, playerIndex, amount);
      } else if (action === 'hit') {
        return this.processHit(state, gameId, player, playerIndex);
      } else if (action === 'stand') {
        return this.processStand(state, gameId, player, playerIndex);
      } else if (action === 'double') {
        return this.processDoubleDown(state, gameId, player, playerIndex);
      }

      return { success: false, error: 'Invalid action' };
    } finally {
      this.releaseLock(gameId);
    }
  }

  private processBet(
    state: BlackjackState,
    gameId: string,
    player: BlackjackPlayerState,
    playerIndex: number,
    amount?: number,
  ): BlackjackActionResult {
    if (state.phase !== 'betting') {
      return { success: false, error: 'Not in betting phase' };
    }
    if (player.status !== 'betting') {
      return { success: false, error: 'You have already placed your bet' };
    }

    const betAmount = amount ?? this.DEFAULT_BET;
    if (betAmount < this.MIN_BET) {
      return { success: false, error: `Minimum bet is ${this.MIN_BET}` };
    }
    if (betAmount > player.chips) {
      return { success: false, error: 'Not enough chips' };
    }

    player.bet = betAmount;
    player.chips -= betAmount;
    player.status = 'playing';
    player.lastAction = 'bet';
    state.pot += betAmount;

    state.actionHistory.push({
      userId: player.userId,
      action: 'bet',
      amount: betAmount,
      timestamp: Date.now(),
    });

    // Check if both players have bet
    const allBet = state.players.every((p) => p.status !== 'betting');
    if (allBet) {
      this.dealInitialCards(state);
      state.phase = 'playing';
      // First to act is the dealer-index player (alternates each round)
      state.currentPlayerIndex = state.dealerIndex;

      // Check for immediate naturals
      const result = this.checkNaturals(state, gameId);
      if (result) return result;
    }

    this.gameStates.set(gameId, state);
    return { success: true, state: this.cloneState(state) };
  }

  private dealInitialCards(state: BlackjackState): void {
    for (let round = 0; round < 2; round++) {
      for (const player of state.players) {
        const dealt = dealCards(state.deck, 1);
        player.hand.push(dealt.cards[0]);
        state.deck = dealt.remainingDeck;
      }
    }

    // Update hand values
    for (const player of state.players) {
      const hv = calculateHandValue(player.hand);
      player.handValue = hv.value;
      player.isSoft = hv.isSoft;
    }
  }

  private checkNaturals(
    state: BlackjackState,
    gameId: string,
  ): BlackjackActionResult | null {
    const p0Natural = isBlackjack(state.players[0].hand);
    const p1Natural = isBlackjack(state.players[1].hand);

    if (!p0Natural && !p1Natural) return null;

    // At least one natural — resolve immediately
    state.phase = 'resolution';
    state.isHandComplete = true;

    if (p0Natural && p1Natural) {
      // Push — return bets
      state.players[0].chips += state.players[0].bet;
      state.players[1].chips += state.players[1].bet;
      state.winnerIds = [];
      state.lastWinnings = {
        [state.players[0].userId]: 0,
        [state.players[1].userId]: 0,
      };
    } else {
      const winnerIdx = p0Natural ? 0 : 1;
      const loserIdx = 1 - winnerIdx;
      const winner = state.players[winnerIdx];
      const loser = state.players[loserIdx];
      // Natural pays 1.5× the proportional transfer
      const { winnerDelta, loserDelta } = this.applyWin(winner, loser, 1.5);
      state.winnerIds = [winner.userId];
      state.lastWinnings = {
        [winner.userId]: winnerDelta,
        [loser.userId]: loserDelta,
      };
    }

    state.pot = 0;
    this.gameStates.set(gameId, state);
    return {
      success: true,
      state: this.cloneState(state),
      handComplete: true,
      winners: state.winnerIds?.length
        ? state.winnerIds.map((id) => {
            const p = state.players.find((pl) => pl.userId === id)!;
            return { userId: id, amount: state.lastWinnings?.[id] ?? 0, handValue: p.handValue };
          })
        : [],
    };
  }

  private processHit(
    state: BlackjackState,
    gameId: string,
    player: BlackjackPlayerState,
    playerIndex: number,
  ): BlackjackActionResult {
    if (state.phase !== 'playing') {
      return { success: false, error: 'Not in playing phase' };
    }
    if (state.currentPlayerIndex !== playerIndex) {
      return { success: false, error: 'Not your turn' };
    }
    if (player.status !== 'playing') {
      return { success: false, error: 'Cannot hit — you already stood or busted' };
    }

    // Deal one card
    if (state.deck.length < 1) {
      const newDeck = shuffleDeck(createDeck());
      state.deck = newDeck;
    }
    const dealt = dealCards(state.deck, 1);
    const drawnCard = dealt.cards[0];
    player.hand.push(drawnCard);
    state.deck = dealt.remainingDeck;

    const hv = calculateHandValue(player.hand);
    player.handValue = hv.value;
    player.isSoft = hv.isSoft;
    player.lastAction = 'hit';

    state.actionHistory.push({
      userId: player.userId,
      action: 'hit',
      card: drawnCard,
      handValue: hv.value,
      timestamp: Date.now(),
    });

    if (isBust(player.hand)) {
      player.status = 'busted';
      return this.advanceAfterAction(state, gameId, playerIndex);
    }

    // If player hit to exactly 21, auto-stand
    if (player.handValue === 21) {
      player.status = 'stood';
      player.lastAction = 'stand';
      return this.advanceAfterAction(state, gameId, playerIndex);
    }

    // Player can continue hitting
    this.gameStates.set(gameId, state);
    return { success: true, state: this.cloneState(state) };
  }

  private processStand(
    state: BlackjackState,
    gameId: string,
    player: BlackjackPlayerState,
    playerIndex: number,
  ): BlackjackActionResult {
    if (state.phase !== 'playing') {
      return { success: false, error: 'Not in playing phase' };
    }
    if (state.currentPlayerIndex !== playerIndex) {
      return { success: false, error: 'Not your turn' };
    }
    if (player.status !== 'playing') {
      return { success: false, error: 'Cannot stand — already stood or busted' };
    }

    player.status = 'stood';
    player.lastAction = 'stand';

    state.actionHistory.push({
      userId: player.userId,
      action: 'stand',
      handValue: player.handValue,
      timestamp: Date.now(),
    });

    return this.advanceAfterAction(state, gameId, playerIndex);
  }

  private processDoubleDown(
    state: BlackjackState,
    gameId: string,
    player: BlackjackPlayerState,
    playerIndex: number,
  ): BlackjackActionResult {
    if (state.phase !== 'playing') {
      return { success: false, error: 'Not in playing phase' };
    }
    if (state.currentPlayerIndex !== playerIndex) {
      return { success: false, error: 'Not your turn' };
    }
    if (player.status !== 'playing') {
      return { success: false, error: 'Cannot double — you already stood or busted' };
    }
    if (player.hand.length !== 2) {
      return { success: false, error: 'Can only double down on the first two cards' };
    }
    if (player.chips <= 0) {
      return { success: false, error: 'Not enough chips to double down' };
    }

    // Add up to the original bet; if short on chips, add whatever remains
    const doubleAmount = Math.min(player.bet, player.chips);
    player.chips -= doubleAmount;
    player.bet += doubleAmount;
    state.pot += doubleAmount;

    // Deal exactly one card
    if (state.deck.length < 1) {
      state.deck = shuffleDeck(createDeck());
    }
    const dealt = dealCards(state.deck, 1);
    const drawnCard = dealt.cards[0];
    player.hand.push(drawnCard);
    state.deck = dealt.remainingDeck;

    const hv = calculateHandValue(player.hand);
    player.handValue = hv.value;
    player.isSoft = hv.isSoft;
    player.lastAction = 'double';

    state.actionHistory.push({
      userId: player.userId,
      action: 'double',
      amount: doubleAmount,
      card: drawnCard,
      handValue: hv.value,
      timestamp: Date.now(),
    });

    // Auto-stand regardless of card value (busted or not)
    if (isBust(player.hand)) {
      player.status = 'busted';
    } else {
      player.status = 'stood';
    }

    return this.advanceAfterAction(state, gameId, playerIndex);
  }

  private advanceAfterAction(
    state: BlackjackState,
    gameId: string,
    currentIdx: number,
  ): BlackjackActionResult {
    const otherIdx = currentIdx === 0 ? 1 : 0;
    const otherPlayer = state.players[otherIdx];

    // If the other player still needs to play
    if (otherPlayer.status === 'playing') {
      state.currentPlayerIndex = otherIdx;
      this.gameStates.set(gameId, state);
      return { success: true, state: this.cloneState(state) };
    }

    // Both players done — resolve the hand
    return this.resolveHand(state, gameId);
  }

  private resolveHand(
    state: BlackjackState,
    gameId: string,
  ): BlackjackActionResult {
    state.phase = 'resolution';
    state.isHandComplete = true;

    const p0 = state.players[0];
    const p1 = state.players[1];
    const p0Bust = p0.status === 'busted';
    const p1Bust = p1.status === 'busted';

    let winnerIds: string[] = [];
    let lastWinnings: Record<string, number> = {};

    if (p0Bust && p1Bust) {
      // Both bust — push, return bets
      p0.chips += p0.bet;
      p1.chips += p1.bet;
      winnerIds = [];
      lastWinnings = { [p0.userId]: 0, [p1.userId]: 0 };
    } else if (p0Bust) {
      const { winnerDelta, loserDelta } = this.applyWin(p1, p0);
      winnerIds = [p1.userId];
      lastWinnings = { [p0.userId]: loserDelta, [p1.userId]: winnerDelta };
    } else if (p1Bust) {
      const { winnerDelta, loserDelta } = this.applyWin(p0, p1);
      winnerIds = [p0.userId];
      lastWinnings = { [p0.userId]: winnerDelta, [p1.userId]: loserDelta };
    } else {
      // Neither busted — compare hand values
      const cmp = compareHands(p0.hand, p1.hand);
      if (cmp > 0) {
        const { winnerDelta, loserDelta } = this.applyWin(p0, p1);
        winnerIds = [p0.userId];
        lastWinnings = { [p0.userId]: winnerDelta, [p1.userId]: loserDelta };
      } else if (cmp < 0) {
        const { winnerDelta, loserDelta } = this.applyWin(p1, p0);
        winnerIds = [p1.userId];
        lastWinnings = { [p0.userId]: loserDelta, [p1.userId]: winnerDelta };
      } else {
        // Tie — push
        p0.chips += p0.bet;
        p1.chips += p1.bet;
        winnerIds = [];
        lastWinnings = { [p0.userId]: 0, [p1.userId]: 0 };
      }
    }

    state.pot = 0;
    state.winnerIds = winnerIds;
    state.lastWinnings = lastWinnings;

    this.gameStates.set(gameId, state);

    return {
      success: true,
      state: this.cloneState(state),
      handComplete: true,
      winners: winnerIds.length
        ? winnerIds.map((id) => {
            const p = state.players.find((pl) => pl.userId === id)!;
            return { userId: id, amount: lastWinnings[id] ?? 0, handValue: p.handValue };
          })
        : [],
    };
  }

  startNewHand(gameId: string): BlackjackState | null {
    const state = this.gameStates.get(gameId);
    if (!state) return null;

    // Check if either player is out of chips
    const broke = state.players.find((p) => p.chips <= 0);
    if (broke) {
      const winner = state.players.find((p) => p.chips > 0);
      if (winner) {
        state.winnerIds = [winner.userId];
      }
      return null; // signals game over
    }

    // Reset for new hand
    state.deck = shuffleDeck(createDeck());
    state.pot = 0;
    state.handNumber++;
    state.dealerIndex = (state.dealerIndex + 1) % 2;
    state.currentPlayerIndex = state.dealerIndex;
    state.phase = 'betting';
    state.isHandComplete = false;
    state.winnerIds = undefined;
    state.lastWinnings = undefined;
    state.actionHistory = [];

    for (const player of state.players) {
      player.hand = [];
      player.handValue = 0;
      player.isSoft = false;
      player.bet = 0;
      player.status = 'betting';
      player.lastAction = undefined;
    }

    this.gameStates.set(gameId, state);
    return this.cloneState(state);
  }
}
