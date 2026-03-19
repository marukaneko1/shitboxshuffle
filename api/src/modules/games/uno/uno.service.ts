import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { GameStatus } from '@prisma/client';
import {
  UnoCard,
  UnoColor,
  UnoMoveResult,
  UnoState,
  UnoValue,
  UnoGameEndResult,
} from './uno.types';

const COLORS: UnoColor[] = ['R', 'G', 'B', 'Y'];
const NUMBER_VALUES: UnoValue[] = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'];
const ACTION_VALUES: UnoValue[] = ['S', 'REV', 'D2'];

@Injectable()
export class UnoService {
  constructor(private readonly prisma: PrismaService) {}

  // ─── Deck helpers ────────────────────────────────────────────────────────────

  buildDeck(): UnoCard[] {
    const cards: UnoCard[] = [];
    let id = 0;

    for (const color of COLORS) {
      // One 0 per color
      cards.push({ id: id++, color, value: '0' });
      // Two of 1-9 and action cards per color
      for (const value of [...NUMBER_VALUES.slice(1), ...ACTION_VALUES]) {
        cards.push({ id: id++, color, value });
        cards.push({ id: id++, color, value });
      }
    }

    // Wild cards (4 of each)
    for (let i = 0; i < 4; i++) {
      cards.push({ id: id++, color: 'W', value: 'W' });
      cards.push({ id: id++, color: 'W', value: 'WD4' });
    }

    return cards; // 108 total
  }

  private shuffle<T>(arr: T[]): T[] {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  // ─── Init ─────────────────────────────────────────────────────────────────────

  initializeState(player1Id: string, player2Id: string): UnoState {
    let deck = this.shuffle(this.buildDeck());

    const hands: Record<string, UnoCard[]> = { [player1Id]: [], [player2Id]: [] };

    // Deal 7 cards to each player
    for (let i = 0; i < 7; i++) {
      hands[player1Id].push(deck.pop()!);
      hands[player2Id].push(deck.pop()!);
    }

    // Find a valid starting card (not Wild Draw Four)
    let startCard: UnoCard;
    do {
      startCard = deck.pop()!;
      if (startCard.value === 'WD4') {
        deck.unshift(startCard);
        deck = this.shuffle(deck);
      }
    } while (startCard.value === 'WD4');

    const discardPile: UnoCard[] = [startCard];
    const drawPile: UnoCard[] = deck;

    let currentColor: UnoColor = startCard.color === 'W' ? 'R' : startCard.color;
    let firstPlayer = player1Id;
    let lastAction = 'Game started';

    // Handle special starting cards
    if (startCard.value === 'W') {
      // First player chooses color — default to red until they pick; will be prompted client-side
      currentColor = 'R';
      lastAction = `Starting card is Wild — ${player1Id} chooses color`;
    } else if (startCard.value === 'S') {
      // Skip first player
      firstPlayer = player2Id;
      lastAction = 'Starting card Skip — first player skipped';
    } else if (startCard.value === 'REV') {
      // Reverse in 2-player acts as Skip
      firstPlayer = player2Id;
      lastAction = 'Starting card Reverse — acts as Skip';
    } else if (startCard.value === 'D2') {
      // First player draws 2 and is skipped
      const drawn: UnoCard[] = [];
      for (let i = 0; i < 2; i++) {
        if (drawPile.length === 0) this.replenishDrawPile(drawPile, discardPile);
        drawn.push(drawPile.pop()!);
      }
      hands[player1Id].push(...drawn);
      firstPlayer = player2Id;
      lastAction = 'Starting card Draw Two — first player draws 2 and is skipped';
    }

    return {
      drawPile,
      discardPile,
      hands,
      currentTurn: firstPlayer,
      playerOrder: [player1Id, player2Id],
      currentColor,
      phase: 'play',
      winner: null,
      lastAction,
      drawCount: 0,
    };
  }

  // ─── Replenish draw pile ───────────────────────────────────────────────────

  private replenishDrawPile(drawPile: UnoCard[], discardPile: UnoCard[]): void {
    if (discardPile.length <= 1) return;
    const topCard = discardPile[discardPile.length - 1];
    const reshuffled = this.shuffle(discardPile.slice(0, discardPile.length - 1));
    drawPile.push(...reshuffled);
    discardPile.length = 0;
    discardPile.push(topCard);
  }

  // ─── Card legality ────────────────────────────────────────────────────────────

  canPlay(card: UnoCard, state: UnoState): boolean {
    if (card.value === 'W' || card.value === 'WD4') return true;
    return card.color === state.currentColor || card.value === state.discardPile[state.discardPile.length - 1]?.value;
  }

  /** Wild Draw Four is only legal if the player holds no card matching currentColor */
  canPlayWD4(hand: UnoCard[], state: UnoState): boolean {
    return !hand.some(c => c.color === state.currentColor && c.value !== 'WD4' && c.value !== 'W');
  }

  // ─── Make move ────────────────────────────────────────────────────────────────

  async makeMove(
    gameId: string,
    userId: string,
    move: { type: 'play' | 'draw' | 'pass'; cardId?: number; chosenColor?: UnoColor },
  ): Promise<UnoMoveResult> {
    const game = await this.prisma.game.findUnique({
      where: { id: gameId },
      include: { players: true },
    });

    if (!game) return { success: false, error: 'Game not found' };
    if (game.status !== GameStatus.ACTIVE) return { success: false, error: 'Game is not active' };

    const state = game.state as unknown as UnoState;
    if (!state) return { success: false, error: 'Invalid game state' };
    if (state.phase !== 'play' && state.phase !== 'draw_play_or_pass') return { success: false, error: 'Game is over' };
    if (state.currentTurn !== userId) return { success: false, error: "It's not your turn" };

    const hand = state.hands[userId];
    if (!hand) return { success: false, error: 'Player not found in game' };

    const opponentId = state.playerOrder.find(p => p !== userId)!;

    if (move.type === 'draw') {
      if (state.phase === 'draw_play_or_pass') return { success: false, error: 'You already drew — play the card or pass' };
      return this.handleDraw(gameId, userId, opponentId, state);
    }

    if (move.type === 'pass') {
      if (state.phase !== 'draw_play_or_pass') return { success: false, error: 'You can only pass after drawing' };
      const newState: UnoState = JSON.parse(JSON.stringify(state));
      newState.phase = 'play';
      newState.currentTurn = opponentId;
      newState.lastAction = `${userId} passed after drawing`;
      await this.prisma.game.update({ where: { id: gameId }, data: { state: newState as any } });
      return { success: true, state: newState, winner: null, isDraw: false };
    }

    if (move.type === 'play') {
      if (move.cardId === undefined) return { success: false, error: 'Card ID required' };
      return this.handlePlay(gameId, userId, opponentId, state, move.cardId, move.chosenColor);
    }

    return { success: false, error: 'Unknown move type' };
  }

  private async handleDraw(
    gameId: string,
    userId: string,
    opponentId: string,
    state: UnoState,
  ): Promise<UnoMoveResult> {
    const newState: UnoState = JSON.parse(JSON.stringify(state));
    const hand = newState.hands[userId];

    if (newState.drawPile.length === 0) {
      this.replenishDrawPile(newState.drawPile, newState.discardPile);
    }

    if (newState.drawPile.length === 0) {
      newState.currentTurn = opponentId;
      newState.lastAction = `${userId} could not draw (empty deck) — turn passed`;
    } else {
      const drawn = newState.drawPile.pop()!;
      hand.push(drawn);

      if (this.canPlay(drawn, newState)) {
        newState.phase = 'draw_play_or_pass';
        newState.lastAction = `${userId} drew a playable card — may play it or pass`;
        newState.drawCount = (newState.drawCount || 0) + 1;
      } else {
        newState.currentTurn = opponentId;
        newState.lastAction = `${userId} drew a card`;
      }
    }

    await this.prisma.game.update({ where: { id: gameId }, data: { state: newState as any } });
    return { success: true, state: newState, winner: null, isDraw: false };
  }

  private async handlePlay(
    gameId: string,
    userId: string,
    opponentId: string,
    state: UnoState,
    cardId: number,
    chosenColor?: UnoColor,
  ): Promise<UnoMoveResult> {
    const newState: UnoState = JSON.parse(JSON.stringify(state));
    if (newState.phase === 'draw_play_or_pass') newState.phase = 'play';
    const hand = newState.hands[userId];

    const cardIdx = hand.findIndex(c => c.id === cardId);
    if (cardIdx === -1) return { success: false, error: 'Card not in your hand' };

    const card = hand[cardIdx];

    // Validate legality
    if (!this.canPlay(card, newState)) {
      return { success: false, error: 'Card cannot be played on the current discard' };
    }
    if (card.value === 'WD4' && !this.canPlayWD4(hand, newState)) {
      return { success: false, error: 'Wild Draw Four can only be played when you have no matching color' };
    }

    // For wilds, a color must be chosen
    if ((card.value === 'W' || card.value === 'WD4') && !chosenColor) {
      return { success: false, error: 'Must choose a color when playing a Wild card' };
    }

    // Remove card from hand
    hand.splice(cardIdx, 1);

    // Place on discard
    newState.discardPile.push(card);

    // Apply color
    newState.currentColor = (card.value === 'W' || card.value === 'WD4')
      ? chosenColor!
      : card.color;

    // Build action label
    const colorNames: Record<UnoColor, string> = { R: 'Red', G: 'Green', B: 'Blue', Y: 'Yellow', W: 'Wild' };
    newState.lastAction = `${userId} played ${colorNames[card.color] !== 'Wild' ? colorNames[card.color] + ' ' : ''}${card.value}`;
    if (card.value === 'W' || card.value === 'WD4') {
      newState.lastAction += ` → chose ${colorNames[newState.currentColor]}`;
    }

    // Check win condition (played last card)
    if (hand.length === 0) {
      return this.endGame(gameId, userId, opponentId, newState, 'win');
    }

    // Apply card effects for 2-player
    await this.applyCardEffect(gameId, userId, opponentId, card, newState);

    if (newState.hands[opponentId].length === 0) {
      // Opponent was forced to draw, re-check win
    }

    await this.prisma.game.update({ where: { id: gameId }, data: { state: newState as any } });
    return { success: true, state: newState, winner: null, isDraw: false };
  }

  private async applyCardEffect(
    gameId: string,
    userId: string,
    opponentId: string,
    card: UnoCard,
    state: UnoState,
  ): Promise<void> {
    switch (card.value) {
      case 'S':
        // Skip opponent — current player goes again
        state.currentTurn = userId;
        state.lastAction += ' — opponent skipped';
        break;

      case 'REV':
        // Reverse in 2-player = Skip
        state.currentTurn = userId;
        state.lastAction += ' — Reverse acts as Skip';
        break;

      case 'D2': {
        // Opponent draws 2 and is skipped
        for (let i = 0; i < 2; i++) {
          if (state.drawPile.length === 0) this.replenishDrawPile(state.drawPile, state.discardPile);
          if (state.drawPile.length > 0) state.hands[opponentId].push(state.drawPile.pop()!);
        }
        state.currentTurn = userId;
        state.lastAction += ' — opponent draws 2 and is skipped';
        break;
      }

      case 'WD4': {
        // Opponent draws 4 and is skipped
        for (let i = 0; i < 4; i++) {
          if (state.drawPile.length === 0) this.replenishDrawPile(state.drawPile, state.discardPile);
          if (state.drawPile.length > 0) state.hands[opponentId].push(state.drawPile.pop()!);
        }
        state.currentTurn = userId;
        state.lastAction += ' — opponent draws 4 and is skipped';
        break;
      }

      default:
        // Normal card — pass turn
        state.currentTurn = opponentId;
        break;
    }
  }

  // ─── Game end ─────────────────────────────────────────────────────────────────

  private async endGame(
    gameId: string,
    winnerId: string,
    loserId: string,
    state: UnoState,
    reason: 'win' | 'forfeit',
  ): Promise<UnoMoveResult> {
    state.phase = 'ended';
    state.winner = winnerId;
    state.lastAction = reason === 'forfeit' ? `${winnerId} wins by forfeit` : `${winnerId} wins!`;

    await this.prisma.game.update({
      where: { id: gameId },
      data: {
        state: state as any,
        status: GameStatus.COMPLETED,
        winnerUserId: winnerId,
        endedAt: new Date(),
      },
    });

    await this.prisma.gamePlayer.updateMany({ where: { gameId, userId: winnerId }, data: { result: 'win' } });
    await this.prisma.gamePlayer.updateMany({ where: { gameId, userId: loserId }, data: { result: 'loss' } });

    return { success: true, state, winner: winnerId, isDraw: false };
  }

  async forfeitGame(gameId: string, userId: string): Promise<UnoGameEndResult> {
    const game = await this.prisma.game.findUnique({ where: { id: gameId }, include: { players: true } });
    if (!game) throw new NotFoundException('Game not found');

    const state = game.state as unknown as UnoState;
    const opponentId = state.playerOrder.find(p => p !== userId)!;

    await this.endGame(gameId, opponentId, userId, state, 'forfeit');
    return { winnerId: opponentId, loserId: userId, reason: 'forfeit' };
  }

  // ─── Sanitize state for client ────────────────────────────────────────────────

  sanitizeForPlayer(state: UnoState, viewerId: string) {
    const opponentId = state.playerOrder.find(p => p !== viewerId)!;
    return {
      discardPile: state.discardPile,
      myHand: state.hands[viewerId] || [],
      opponentHandCount: (state.hands[opponentId] || []).length,
      drawPileCount: state.drawPile.length,
      currentTurn: state.currentTurn,
      playerOrder: state.playerOrder,
      currentColor: state.currentColor,
      phase: state.phase,
      winner: state.winner,
      lastAction: state.lastAction,
    };
  }
}
