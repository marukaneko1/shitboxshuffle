import { Injectable, BadRequestException } from "@nestjs/common";
import { PrismaService } from "../../../prisma/prisma.service";
import { GameStatus } from "@prisma/client";
import {
  MemoryCard,
  MemoryState,
  MemoryMoveResult,
  MemoryFlipBackResult
} from "./memory.types";

// 16 distinct symbols — one per pair → 32 cards in an 8×4 grid
const SYMBOLS = [
  '♠', '♥', '♦', '♣', '★', '☽', '♛', '◉',
  '◆', '♟', '♞', '♜', '❖', '⚑', '✦', '⬡'
];

@Injectable()
export class MemoryService {
  private gameLocks = new Map<string, Promise<void>>();

  constructor(private readonly prisma: PrismaService) {}

  private async withLock<T>(gameId: string, fn: () => Promise<T>): Promise<T> {
    while (this.gameLocks.has(gameId)) {
      await this.gameLocks.get(gameId);
    }
    let resolve: () => void;
    const lock = new Promise<void>(r => { resolve = r; });
    this.gameLocks.set(gameId, lock);
    try {
      return await fn();
    } finally {
      this.gameLocks.delete(gameId);
      resolve!();
    }
  }

  // ── Initialisation ──────────────────────────────────────────────────────────

  initializeState(player1Id: string, player2Id: string): MemoryState {
    // Build 32 cards: 2 copies of each of 16 symbols
    const cards: MemoryCard[] = [];
    for (let pairId = 0; pairId < SYMBOLS.length; pairId++) {
      for (let copy = 0; copy < 2; copy++) {
        cards.push({
          index: cards.length,
          pairId,
          symbol: SYMBOLS[pairId],
          faceUp: false,
          matched: false
        });
      }
    }
    // Fisher-Yates shuffle
    for (let i = cards.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [cards[i], cards[j]] = [cards[j], cards[i]];
    }
    // Re-assign flat indices after shuffle
    cards.forEach((c, i) => { c.index = i; });

    return {
      cards,
      currentTurn: player1Id,
      player1: player1Id,
      player2: player2Id,
      scores: { [player1Id]: 0, [player2Id]: 0 },
      phase: 'waiting',
      firstFlippedIndex: null,
      secondFlippedIndex: null,
      startedAt: Date.now()
    };
  }

  // ── makeMove ─────────────────────────────────────────────────────────────────

  async makeMove(
    gameId: string,
    userId: string,
    cardIndex: number
  ): Promise<MemoryMoveResult> {
    return this.withLock(gameId, () => this.makeMoveInternal(gameId, userId, cardIndex));
  }

  private async makeMoveInternal(
    gameId: string,
    userId: string,
    cardIndex: number
  ): Promise<MemoryMoveResult> {
    const game = await this.prisma.game.findUnique({ where: { id: gameId } });
    if (!game) return { success: false, error: 'Game not found' };
    if (game.status !== GameStatus.ACTIVE) return { success: false, error: 'Game is not active' };

    const state = game.state as unknown as MemoryState;
    if (!state) return { success: false, error: 'Invalid game state' };

    if (state.currentTurn !== userId) return { success: false, error: "It's not your turn" };

    if (state.phase === 'pendingFlipBack' || state.phase === 'gameEnd') {
      return { success: false, error: 'Not a valid time to flip a card' };
    }

    if (cardIndex < 0 || cardIndex >= state.cards.length) {
      return { success: false, error: 'Invalid card index' };
    }

    const card = state.cards[cardIndex];
    if (card.faceUp || card.matched) {
      return { success: false, error: 'Card is already revealed or matched' };
    }

    // Clone cards array
    const newCards = state.cards.map(c => ({ ...c }));
    newCards[cardIndex].faceUp = true;

    // ── Phase: waiting → firstFlipped ─────────────────────────────────────────
    if (state.phase === 'waiting') {
      const newState: MemoryState = {
        ...state,
        cards: newCards,
        phase: 'firstFlipped',
        firstFlippedIndex: cardIndex
      };
      await this.prisma.game.update({ where: { id: gameId }, data: { state: newState as any } });
      return { success: true, state: newState };
    }

    // ── Phase: firstFlipped → check match ─────────────────────────────────────
    if (cardIndex === state.firstFlippedIndex) {
      return { success: false, error: 'You already flipped this card' };
    }

    const firstCard = newCards[state.firstFlippedIndex!];
    const secondCard = newCards[cardIndex];
    const isMatch = firstCard.pairId === secondCard.pairId;

    if (isMatch) {
      // Mark both matched
      newCards[state.firstFlippedIndex!].matched = true;
      newCards[cardIndex].matched = true;
      newCards[state.firstFlippedIndex!].faceUp = true;
      newCards[cardIndex].faceUp = true;

      const newScores = { ...state.scores, [userId]: (state.scores[userId] || 0) + 2 };
      const allMatched = newCards.every(c => c.matched);

      if (allMatched) {
        // Determine winner
        const scores = newScores;
        const p1Score = scores[state.player1] || 0;
        const p2Score = scores[state.player2] || 0;
        const isDraw = p1Score === p2Score;
        const winnerId = isDraw ? null : (p1Score > p2Score ? state.player1 : state.player2);
        const loserId = winnerId ? (winnerId === state.player1 ? state.player2 : state.player1) : null;

        const endState: MemoryState = {
          ...state,
          cards: newCards,
          scores: newScores,
          phase: 'gameEnd',
          firstFlippedIndex: null,
          secondFlippedIndex: null
        };

        await this.prisma.game.update({
          where: { id: gameId },
          data: {
            state: endState as any,
            status: GameStatus.COMPLETED,
            winnerUserId: winnerId,
            endedAt: new Date()
          }
        });

        if (winnerId && loserId) {
          await this.prisma.gamePlayer.updateMany({ where: { gameId, userId: winnerId }, data: { result: 'win' } });
          await this.prisma.gamePlayer.updateMany({ where: { gameId, userId: loserId }, data: { result: 'loss' } });
        } else {
          await this.prisma.gamePlayer.updateMany({ where: { gameId }, data: { result: 'draw' } });
        }

        return { success: true, state: endState, winner: winnerId, isDraw };
      }

      // Not all matched yet — same player goes again
      const newState: MemoryState = {
        ...state,
        cards: newCards,
        scores: newScores,
        phase: 'waiting',
        firstFlippedIndex: null,
        secondFlippedIndex: null
        // currentTurn stays the same
      };
      await this.prisma.game.update({ where: { id: gameId }, data: { state: newState as any } });
      return { success: true, state: newState };
    }

    // No match — enter pendingFlipBack
    const newState: MemoryState = {
      ...state,
      cards: newCards,
      phase: 'pendingFlipBack',
      firstFlippedIndex: state.firstFlippedIndex,
      secondFlippedIndex: cardIndex
    };
    await this.prisma.game.update({ where: { id: gameId }, data: { state: newState as any } });
    return { success: true, state: newState, pendingFlipBack: true };
  }

  // ── flipBack ─────────────────────────────────────────────────────────────────

  async flipBack(gameId: string): Promise<MemoryFlipBackResult | null> {
    return this.withLock(gameId, () => this.flipBackInternal(gameId));
  }

  private async flipBackInternal(gameId: string): Promise<MemoryFlipBackResult | null> {
    const game = await this.prisma.game.findUnique({ where: { id: gameId } });
    if (!game) return null;

    const state = game.state as unknown as MemoryState;
    if (!state || state.phase !== 'pendingFlipBack') return null;

    const newCards = state.cards.map(c => ({ ...c }));
    if (state.firstFlippedIndex !== null) newCards[state.firstFlippedIndex].faceUp = false;
    if (state.secondFlippedIndex !== null) newCards[state.secondFlippedIndex].faceUp = false;

    const nextPlayer = state.currentTurn === state.player1 ? state.player2 : state.player1;

    const newState: MemoryState = {
      ...state,
      cards: newCards,
      currentTurn: nextPlayer,
      phase: 'waiting',
      firstFlippedIndex: null,
      secondFlippedIndex: null
    };

    await this.prisma.game.update({ where: { id: gameId }, data: { state: newState as any } });
    return { state: newState };
  }

  // ── forfeit ──────────────────────────────────────────────────────────────────

  async forfeitGame(gameId: string, forfeitingUserId: string): Promise<{ winnerId: string }> {
    const game = await this.prisma.game.findUnique({ where: { id: gameId } });
    if (!game) throw new BadRequestException('Game not found');

    const state = game.state as unknown as MemoryState;
    const winnerId = state.player1 === forfeitingUserId ? state.player2 : state.player1;

    await this.prisma.game.update({
      where: { id: gameId },
      data: { status: GameStatus.COMPLETED, winnerUserId: winnerId, endedAt: new Date() }
    });
    await this.prisma.gamePlayer.updateMany({ where: { gameId, userId: winnerId }, data: { result: 'win' } });
    await this.prisma.gamePlayer.updateMany({ where: { gameId, userId: forfeitingUserId }, data: { result: 'forfeit' } });

    return { winnerId };
  }
}
