import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import {
  BsState,
  BsPlay,
  BsPlayResult,
  BsCallResult,
  BsClientState,
  Card,
  Rank,
  RANK_ORDER,
  RANK_DISPLAY,
} from './bs.types';
import { createDeck, shuffleDeck } from '../poker/poker.utils';

@Injectable()
export class BsService {
  private readonly logger = new Logger(BsService.name);
  private gameStates = new Map<string, BsState>();
  private processingLocks = new Map<string, Promise<void>>();
  private turnTimers = new Map<string, NodeJS.Timeout>();
  private callWindowTimers = new Map<string, NodeJS.Timeout>();

  constructor(private readonly prisma: PrismaService) {}

  readonly TURN_TIMEOUT_MS = 45_000;
  readonly CALL_WINDOW_MS = 8_000;
  private readonly MAX_CARDS_PER_PLAY = 4;

  private cloneState(state: BsState): BsState {
    return structuredClone(state);
  }

  getState(gameId: string): BsState | undefined {
    return this.gameStates.get(gameId);
  }

  setState(gameId: string, state: BsState): void {
    this.gameStates.set(gameId, state);
  }

  private clearTurnTimer(gameId: string): void {
    const timer = this.turnTimers.get(gameId);
    if (timer) {
      clearTimeout(timer);
      this.turnTimers.delete(gameId);
    }
  }

  private clearCallWindowTimer(gameId: string): void {
    const timer = this.callWindowTimers.get(gameId);
    if (timer) {
      clearTimeout(timer);
      this.callWindowTimers.delete(gameId);
    }
  }

  setTurnTimer(gameId: string, callback: () => void): void {
    this.clearTurnTimer(gameId);
    const timer = setTimeout(callback, this.TURN_TIMEOUT_MS);
    this.turnTimers.set(gameId, timer);
  }

  setCallWindowTimer(gameId: string, callback: () => void): void {
    this.clearCallWindowTimer(gameId);
    const timer = setTimeout(callback, this.CALL_WINDOW_MS);
    this.callWindowTimers.set(gameId, timer);
  }

  cleanupGame(gameId: string): void {
    this.clearTurnTimer(gameId);
    this.clearCallWindowTimer(gameId);
    this.gameStates.delete(gameId);
    const resolver = this.lockResolvers.get(gameId);
    if (resolver) resolver();
    this.processingLocks.delete(gameId);
    this.lockResolvers.delete(gameId);
    this.logger.log(`Cleaned up BS game ${gameId}`);
  }

  private lockResolvers = new Map<string, () => void>();

  private async acquireLock(gameId: string): Promise<void> {
    while (this.processingLocks.has(gameId)) {
      await this.processingLocks.get(gameId);
    }
    let resolver: () => void;
    const lockPromise = new Promise<void>((resolve) => {
      resolver = resolve;
    });
    this.processingLocks.set(gameId, lockPromise);
    this.lockResolvers.set(gameId, resolver!);
  }

  private releaseLock(gameId: string): void {
    const resolver = this.lockResolvers.get(gameId);
    this.processingLocks.delete(gameId);
    this.lockResolvers.delete(gameId);
    if (resolver) resolver();
  }

  initializeState(gameId: string, playerIds: string[]): BsState {
    if (playerIds.length !== 2) {
      throw new BadRequestException('BS requires exactly 2 players');
    }

    const deck = shuffleDeck(createDeck());
    const CARDS_PER_PLAYER = 15;
    const hand1 = this.sortHand(deck.slice(0, CARDS_PER_PLAYER));
    const hand2 = this.sortHand(deck.slice(CARDS_PER_PLAYER, CARDS_PER_PLAYER * 2));

    const firstPlayerIndex = Math.random() < 0.5 ? 0 : 1;

    const state: BsState = {
      players: [
        { userId: playerIds[0], hand: hand1, handCount: hand1.length },
        { userId: playerIds[1], hand: hand2, handCount: hand2.length },
      ],
      discardPile: [],
      currentPlayerIndex: firstPlayerIndex,
      currentRequiredRankIndex: 0,
      phase: 'playing',
      lastPlay: null,
      callWindowEndTime: null,
      turnNumber: 1,
      winnerId: null,
      actionHistory: [],
      revealedCards: null,
      wasBS: null,
      penaltyPlayerId: null,
      startedAt: Date.now(),
    };

    this.gameStates.set(gameId, state);
    this.logger.log(`BS game ${gameId} initialized. Player ${playerIds[firstPlayerIndex]} goes first.`);
    return state;
  }

  private sortHand(hand: Card[]): Card[] {
    const rankIdx = (r: Rank) => RANK_ORDER.indexOf(r);
    return hand.sort((a, b) => {
      const ri = rankIdx(a.rank) - rankIdx(b.rank);
      if (ri !== 0) return ri;
      return a.suit.localeCompare(b.suit);
    });
  }

  async processPlayCards(
    gameId: string,
    userId: string,
    cardIndices: number[],
  ): Promise<BsPlayResult> {
    await this.acquireLock(gameId);
    try {
      const state = this.gameStates.get(gameId);
      if (!state) return { success: false, error: 'Game not found' };

      if (state.phase !== 'playing') {
        return { success: false, error: 'Not in playing phase' };
      }

      const playerIndex = state.players.findIndex(p => p.userId === userId);
      if (playerIndex === -1) return { success: false, error: 'Player not in game' };
      if (playerIndex !== state.currentPlayerIndex) {
        return { success: false, error: 'Not your turn' };
      }

      const player = state.players[playerIndex];

      if (!cardIndices.length || cardIndices.length > this.MAX_CARDS_PER_PLAY) {
        return { success: false, error: `Must play 1-${this.MAX_CARDS_PER_PLAY} cards` };
      }

      const uniqueIndices = [...new Set(cardIndices)].sort((a, b) => b - a);
      if (uniqueIndices.some(i => i < 0 || i >= player.hand.length)) {
        return { success: false, error: 'Invalid card index' };
      }

      const requiredRank = RANK_ORDER[state.currentRequiredRankIndex];
      const playedCards: Card[] = uniqueIndices.map(i => player.hand[i]);

      const actuallyMatch = playedCards.every(c => c.rank === requiredRank);

      const lastPlay: BsPlay = {
        cards: playedCards,
        cardCount: playedCards.length,
        claimedRank: requiredRank,
        playerId: userId,
        actuallyMatch,
      };

      for (const idx of uniqueIndices) {
        player.hand.splice(idx, 1);
      }
      player.handCount = player.hand.length;

      state.discardPile.push(...playedCards);
      state.lastPlay = lastPlay;
      state.phase = 'callWindow';
      state.callWindowEndTime = Date.now() + this.CALL_WINDOW_MS;
      state.revealedCards = null;
      state.wasBS = null;
      state.penaltyPlayerId = null;

      const rankName = RANK_DISPLAY[requiredRank];
      state.actionHistory.push({
        userId,
        action: 'playCards',
        detail: `Played ${playedCards.length} card${playedCards.length > 1 ? 's' : ''} as ${rankName}`,
        timestamp: Date.now(),
      });

      this.clearTurnTimer(gameId);
      this.gameStates.set(gameId, state);
      return { success: true, state: this.cloneState(state) };
    } finally {
      this.releaseLock(gameId);
    }
  }

  async processCallBS(gameId: string, callerId: string): Promise<BsCallResult> {
    await this.acquireLock(gameId);
    try {
      const state = this.gameStates.get(gameId);
      if (!state) return { success: false, error: 'Game not found' };

      if (state.phase !== 'callWindow') {
        return { success: false, error: 'Not in call window' };
      }

      const callerIndex = state.players.findIndex(p => p.userId === callerId);
      if (callerIndex === -1) return { success: false, error: 'Player not in game' };

      if (!state.lastPlay) return { success: false, error: 'No play to call BS on' };

      if (state.lastPlay.playerId === callerId) {
        return { success: false, error: 'Cannot call BS on your own play' };
      }

      this.clearCallWindowTimer(gameId);

      const wasBS = !state.lastPlay.actuallyMatch;
      const revealedCards = [...state.lastPlay.cards];
      let penaltyPlayerId: string;

      if (wasBS) {
        penaltyPlayerId = state.lastPlay.playerId;
      } else {
        penaltyPlayerId = callerId;
      }

      const penaltyPlayer = state.players.find(p => p.userId === penaltyPlayerId)!;
      penaltyPlayer.hand.push(...state.discardPile);
      penaltyPlayer.hand = this.sortHand(penaltyPlayer.hand);
      penaltyPlayer.handCount = penaltyPlayer.hand.length;

      state.discardPile = [];
      state.revealedCards = revealedCards;
      state.wasBS = wasBS;
      state.penaltyPlayerId = penaltyPlayerId;
      state.phase = 'reveal';

      state.actionHistory.push({
        userId: callerId,
        action: 'callBS',
        detail: wasBS
          ? `Called BS! — caught the bluff! ${penaltyPlayerId === callerId ? 'You' : 'Opponent'} picks up the pile`
          : `Called BS! — cards were legit. ${penaltyPlayerId === callerId ? 'Caller' : 'Opponent'} picks up the pile`,
        timestamp: Date.now(),
      });

      this.gameStates.set(gameId, state);
      return {
        success: true,
        state: this.cloneState(state),
        wasBS,
        revealedCards,
        penaltyTo: penaltyPlayerId,
      };
    } finally {
      this.releaseLock(gameId);
    }
  }

  async resolveAfterReveal(gameId: string): Promise<BsState | null> {
    await this.acquireLock(gameId);
    try {
      const state = this.gameStates.get(gameId);
      if (!state) return null;
      if (state.phase !== 'reveal') return state;

      const winner = state.players.find(p => p.hand.length === 0);
      if (winner) {
        state.phase = 'ended';
        state.winnerId = winner.userId;
        this.gameStates.set(gameId, state);
        return this.cloneState(state);
      }

      state.currentRequiredRankIndex = (state.currentRequiredRankIndex + 1) % RANK_ORDER.length;

      const penaltyIdx = state.players.findIndex(p => p.userId === state.penaltyPlayerId);
      state.currentPlayerIndex = penaltyIdx !== -1 ? penaltyIdx : (state.currentPlayerIndex + 1) % state.players.length;

      state.phase = 'playing';
      state.lastPlay = null;
      state.callWindowEndTime = null;
      state.revealedCards = null;
      state.wasBS = null;
      state.penaltyPlayerId = null;
      state.turnNumber++;

      this.gameStates.set(gameId, state);
      return this.cloneState(state);
    } finally {
      this.releaseLock(gameId);
    }
  }

  async processPass(gameId: string, userId: string): Promise<BsCallResult> {
    await this.acquireLock(gameId);
    try {
      const state = this.gameStates.get(gameId);
      if (!state) return { success: false, error: 'Game not found' };

      if (state.phase !== 'callWindow') {
        return { success: false, error: 'Not in call window' };
      }

      const callerIndex = state.players.findIndex(p => p.userId === userId);
      if (callerIndex === -1) return { success: false, error: 'Player not in game' };

      if (state.lastPlay && state.lastPlay.playerId === userId) {
        return { success: false, error: 'Cannot pass on your own play' };
      }

      this.clearCallWindowTimer(gameId);

      state.actionHistory.push({
        userId,
        action: 'pass',
        detail: 'Let it slide',
        timestamp: Date.now(),
      });

      const playingPlayer = state.players.find(p => p.userId === state.lastPlay?.playerId);
      if (playingPlayer && playingPlayer.hand.length === 0) {
        state.phase = 'ended';
        state.winnerId = playingPlayer.userId;
        state.lastPlay = null;
        state.callWindowEndTime = null;
        this.gameStates.set(gameId, state);
        return { success: true, state: this.cloneState(state) };
      }

      state.currentRequiredRankIndex = (state.currentRequiredRankIndex + 1) % RANK_ORDER.length;
      state.currentPlayerIndex = (state.currentPlayerIndex + 1) % state.players.length;
      state.phase = 'playing';
      state.lastPlay = null;
      state.callWindowEndTime = null;
      state.revealedCards = null;
      state.wasBS = null;
      state.penaltyPlayerId = null;
      state.turnNumber++;

      this.gameStates.set(gameId, state);
      return { success: true, state: this.cloneState(state) };
    } finally {
      this.releaseLock(gameId);
    }
  }

  async autoPlayForTimeout(gameId: string): Promise<BsPlayResult | null> {
    const state = this.gameStates.get(gameId);
    if (!state || state.phase !== 'playing') return null;

    const player = state.players[state.currentPlayerIndex];
    if (!player || player.hand.length === 0) return null;

    return this.processPlayCards(gameId, player.userId, [0]);
  }

  sanitizeStateForPlayer(state: BsState, userId: string): BsClientState {
    const myIndex = state.players.findIndex(p => p.userId === userId);
    const opponentIndex = myIndex === 0 ? 1 : 0;
    const me = state.players[myIndex];
    const opponent = state.players[opponentIndex];

    let lastPlaySanitized: BsClientState['lastPlay'] = null;
    if (state.lastPlay) {
      lastPlaySanitized = {
        cardCount: state.lastPlay.cardCount,
        claimedRank: state.lastPlay.claimedRank,
        playerId: state.lastPlay.playerId,
      };
      if (state.phase === 'reveal' && state.revealedCards) {
        lastPlaySanitized.cards = state.revealedCards;
      }
    }

    return {
      myHand: me ? [...me.hand] : [],
      opponentHandCount: opponent ? opponent.handCount : 0,
      discardPileCount: state.discardPile.length,
      currentPlayerIndex: state.currentPlayerIndex,
      currentRequiredRank: RANK_ORDER[state.currentRequiredRankIndex],
      phase: state.phase,
      lastPlay: lastPlaySanitized,
      callWindowEndTime: state.callWindowEndTime,
      turnNumber: state.turnNumber,
      winnerId: state.winnerId,
      actionHistory: state.actionHistory.slice(-10),
      revealedCards: state.phase === 'reveal' ? state.revealedCards : null,
      wasBS: state.phase === 'reveal' ? state.wasBS : null,
      penaltyPlayerId: state.penaltyPlayerId,
      playerOrder: state.players.map(p => p.userId),
      myIndex,
    };
  }
}
