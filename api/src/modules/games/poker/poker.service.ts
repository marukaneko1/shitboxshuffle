import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { GameStatus } from '@prisma/client';
import {
  PokerState,
  PlayerState,
  Card,
  PokerAction,
  PokerActionResult,
  BettingRound,
  HandRank,
  SidePot,
  PokerActionRecord,
} from './poker.types';
import {
  createDeck,
  shuffleDeck,
  dealCards,
  evaluateHand,
  compareHands,
} from './poker.utils';

@Injectable()
export class PokerService {
  private readonly logger = new Logger(PokerService.name);
  private gameStates = new Map<string, PokerState>();
  // Mutex locks to prevent race conditions when processing actions
  private processingLocks = new Map<string, Promise<void>>();

  constructor(private readonly prisma: PrismaService) {}

  // Configuration
  private readonly INITIAL_CHIPS = 500;
  private readonly SMALL_BLIND = 10;
  private readonly BIG_BLIND = 20;
  private readonly MIN_BUY_IN = 100;
  private readonly MAX_BUY_IN = 5000;

  private cloneState(state: PokerState): PokerState {
    return structuredClone(state);
  }

  sanitizeStateForPlayer(state: PokerState, userId: string): PokerState {
    const cloned = this.cloneState(state);
    delete (cloned as any).deck;
    for (const player of cloned.players) {
      if (player.userId !== userId && !state.showdownRevealed) {
        player.holeCards = [];
      }
    }
    return cloned;
  }

  /**
   * Safely get max bet from players (returns 0 if empty)
   */
  private getMaxBet(players: PlayerState[]): number {
    if (players.length === 0) return 0;
    return Math.max(...players.map((p) => p.betThisRound), 0);
  }

  /**
   * Safely deal cards with validation
   */
  private safeDealCards(deck: Card[], count: number): { cards: Card[]; remainingDeck: Card[] } | null {
    if (deck.length < count) {
      this.logger.error(`[safeDealCards] Not enough cards in deck: need ${count}, have ${deck.length}`);
      return null;
    }
    return dealCards(deck, count);
  }

  /**
   * Initialize a new poker game state for a heads-up (2-player) Texas Hold'em match.
   *
   * Flow:
   *  1. Create and Fisher-Yates shuffle a standard 52-card deck.
   *  2. Randomly assign the dealer (also the small blind in heads-up play).
   *  3. Deal 2 hole cards to each player from the top of the deck.
   *  4. Post blinds: small blind = 10, big blind = 20.  Players that run out
   *     of chips posting are immediately marked 'all-in'.
   *  5. Set `currentPlayerIndex` to the dealer (small blind) — they act first
   *     pre-flop in heads-up poker.
   *  6. Store the state in-memory under `gameId` and return it.
   *
   * @param gameId   Unique game identifier used as the in-memory map key.
   * @param playerIds Array of exactly 2 user IDs; throws if length !== 2.
   */
  initializeState(gameId: string, playerIds: string[]): PokerState {
    if (playerIds.length !== 2) {
      throw new BadRequestException('Poker requires exactly 2 players');
    }

    // Create and shuffle deck
    const deck = shuffleDeck(createDeck());

    // Randomly assign dealer (player 0 or 1)
    const dealerIndex = Math.floor(Math.random() * 2);
    const smallBlindIndex = dealerIndex;
    const bigBlindIndex = (dealerIndex + 1) % 2;

    // Initialize players
    const players: PlayerState[] = playerIds.map((userId, index) => ({
      userId,
      chips: this.INITIAL_CHIPS,
      betThisRound: 0,
      totalBetThisHand: 0,
      status: 'active' as const,
      holeCards: [],
      isDealer: index === dealerIndex,
      isSmallBlind: index === smallBlindIndex,
      isBigBlind: index === bigBlindIndex,
    }));

    // Deal hole cards
    let remainingDeck = deck;
    for (const player of players) {
      const result = this.safeDealCards(remainingDeck, 2);
      if (!result) {
        throw new BadRequestException('Failed to deal cards');
      }
      player.holeCards = result.cards;
      remainingDeck = result.remainingDeck;
    }

    // Post blinds
    const smallBlindAmount = Math.min(this.SMALL_BLIND, players[smallBlindIndex].chips);
    players[smallBlindIndex].betThisRound = smallBlindAmount;
    players[smallBlindIndex].totalBetThisHand = smallBlindAmount;
    players[smallBlindIndex].chips -= smallBlindAmount;
    if (players[smallBlindIndex].chips === 0) {
      players[smallBlindIndex].status = 'all-in';
    }

    const bigBlindAmount = Math.min(this.BIG_BLIND, players[bigBlindIndex].chips);
    players[bigBlindIndex].betThisRound = bigBlindAmount;
    players[bigBlindIndex].totalBetThisHand = bigBlindAmount;
    players[bigBlindIndex].chips -= bigBlindAmount;
    if (players[bigBlindIndex].chips === 0) {
      players[bigBlindIndex].status = 'all-in';
    }

    const pot = smallBlindAmount + bigBlindAmount;
    const minimumBet = this.BIG_BLIND;

    // First action is dealer (small blind) in heads-up
    // But if dealer is all-in, find next active player
    let currentPlayerIndex = dealerIndex;
    if (players[dealerIndex].status !== 'active') {
      currentPlayerIndex = bigBlindIndex;
    }

    const state: PokerState = {
      players,
      communityCards: [],
      deck: remainingDeck,
      currentBettingRound: 'pre-flop',
      pot,
      sidePots: [],
      currentPlayerIndex,
      dealerIndex,
      smallBlind: this.SMALL_BLIND,
      bigBlind: this.BIG_BLIND,
      minimumBet,
      lastRaiseAmount: this.BIG_BLIND, // Track the last raise amount for min-raise calculations
      handNumber: 1,
      startedAt: Date.now(),
      actionHistory: [],
      isHandComplete: false,
    };

    this.logger.log(`[initializeState] Game ${gameId}: dealer=${dealerIndex}, pot=${pot}`);

    this.gameStates.set(gameId, state);
    return state;
  }

  /**
   * Get game state
   */
  getState(gameId: string): PokerState | null {
    return this.gameStates.get(gameId) || null;
  }

  /**
   * Set game state (for persistence)
   */
  setState(gameId: string, state: PokerState): void {
    this.gameStates.set(gameId, state);
  }

  /**
   * Acquire a lock for a game to prevent race conditions
   */
  private async acquireLock(gameId: string): Promise<void> {
    // Wait for any existing lock to be released
    while (this.processingLocks.has(gameId)) {
      await this.processingLocks.get(gameId);
    }
  }

  /**
   * Process a player's poker action — the primary public entry point for gameplay.
   *
   * Uses a per-game mutex (promise-chain lock) to guarantee sequential processing
   * even if two WebSocket messages arrive for the same game simultaneously.
   *
   * Internal pipeline (executed inside the lock):
   *  1. Load state from memory (or DB fallback if evicted).
   *  2. Reject if hand is already complete.
   *  3. Reject if it is not `userId`'s turn.
   *  4. `validateAction` — rule-check without mutating state.
   *  5. `executeAction` — mutate chips, pot, player status.
   *  6. Append to `actionHistory`.
   *  7. Fold-win shortcut: if only one non-folded player remains, award pot.
   *  8. `advanceToNextPlayer` — skip folded/all-in players.
   *  9. All-in fast-forward: if ≤1 active player can still bet, deal remaining
   *     community cards and go straight to showdown.
   * 10. `isBettingRoundComplete` check → `advanceBettingRound` if true.
   *
   * @param gameId  Target game.
   * @param userId  Acting player's ID — must match `currentPlayerIndex`.
   * @param action  One of: fold | check | call | bet | raise | all-in.
   * @param amount  Required for bet/raise; ignored for fold/check/call/all-in.
   */
  async processAction(
    gameId: string,
    userId: string,
    action: PokerAction,
    amount?: number,
  ): Promise<PokerActionResult> {
    // Acquire lock to prevent race conditions
    await this.acquireLock(gameId);
    
    // Create a new lock promise
    let releaseLock: () => void;
    const lockPromise = new Promise<void>((resolve) => {
      releaseLock = resolve;
    });
    this.processingLocks.set(gameId, lockPromise);
    
    try {
      return await this.processActionInternal(gameId, userId, action, amount);
    } finally {
      // Release the lock
      this.processingLocks.delete(gameId);
      releaseLock!();
    }
  }

  /**
   * Internal action processing (called with lock held)
   */
  private async processActionInternal(
    gameId: string,
    userId: string,
    action: PokerAction,
    amount?: number,
  ): Promise<PokerActionResult> {
    let state = this.gameStates.get(gameId);
    if (!state) {
      this.logger.warn(`[processAction] State not found for game ${gameId}, loading from database`);
      const game = await this.prisma.game.findUnique({ where: { id: gameId } });
      if (game?.state) {
        state = game.state as unknown as PokerState;
        this.gameStates.set(gameId, state);
      } else {
        return { success: false, error: 'Game not found' };
      }
    }
    
    this.logger.debug(`[processAction] ${action} by ${userId.slice(-6)}, amount=${amount}, round=${state.currentBettingRound}, pot=${state.pot}`);

    // Check if hand is already complete
    if (state.isHandComplete) {
      return { success: false, error: 'Hand is already complete' };
    }

    // Validate it's the player's turn
    const playerAtTurn = state.players[state.currentPlayerIndex];
    if (!playerAtTurn || playerAtTurn.userId !== userId) {
      return { success: false, error: 'Not your turn' };
    }

    // Validate action
    const validation = this.validateAction(state, action, amount);
    if (!validation.valid) {
      return { success: false, error: validation.error };
    }

    // Execute action and get the amount actually bet
    const executionResult = this.executeAction(state, action, amount || 0);
    if (!executionResult.success) {
      return { success: false, error: executionResult.error };
    }

    // Record action
    const actionRecord: PokerActionRecord = {
      userId,
      action,
      timestamp: Date.now(),
      bettingRound: state.currentBettingRound,
    };
    if (executionResult.amountBet !== undefined && executionResult.amountBet > 0) {
      actionRecord.amount = executionResult.amountBet;
    }
    state.actionHistory.push(actionRecord);

    // Check for hand completion by fold
    if (action === 'fold') {
      const activePlayers = state.players.filter((p) => p.status === 'active' || p.status === 'all-in');
      
      if (activePlayers.length === 1) {
        const winner = activePlayers[0];
        const potAmount = state.pot;
        
        state.isHandComplete = true;
        state.winnerIds = [winner.userId];
        state.showdownRevealed = false;
        state.lastWinnings = { [winner.userId]: potAmount };
        winner.chips += potAmount;
        state.pot = 0;
        
        this.gameStates.set(gameId, state);
        this.logger.debug(`[processAction] Fold win: ${winner.userId.slice(-6)}, pot=${potAmount}`);
        
        return {
          success: true,
          state: this.cloneState(state),
          handComplete: true,
          winners: [
            {
              userId: winner.userId,
              amount: potAmount,
              handRank: { name: 'Win by Fold', rank: 0, cards: [] },
            },
          ],
        };
      }
    }

    // Advance to next player FIRST (before checking if round is complete)
    this.advanceToNextPlayer(state);
    
    // Check for all-in showdown (all active players are all-in or only one can act)
    const activePlayers = state.players.filter((p) => p.status === 'active' || p.status === 'all-in');
    const actablePlayers = activePlayers.filter((p) => p.status === 'active');
    
    // If all-in scenario with multiple players
    if (activePlayers.length > 1 && actablePlayers.length <= 1) {
      // Check if bets are matched or only all-in players remain
      const maxBet = this.getMaxBet(state.players);
      const allBetsMatched = activePlayers.every(
        (p) => p.betThisRound === maxBet || p.status === 'all-in'
      );
      
      if (allBetsMatched || actablePlayers.length === 0) {
        this.logger.debug(`[processAction] All-in fast-forward to showdown`);
        const showdownResult = this.fastForwardToShowdown(state);
        this.gameStates.set(gameId, state);
        return {
          success: true,
          state: this.cloneState(state),
          handComplete: showdownResult.handComplete,
          winners: showdownResult.winners,
        };
      }
    }
    
    const bettingComplete = this.isBettingRoundComplete(state);
    
    if (bettingComplete) {
      const nextRoundResult = this.advanceBettingRound(state);
      
      if (nextRoundResult.handComplete) {
        this.gameStates.set(gameId, state);
        return {
          success: true,
          state: this.cloneState(state),
          handComplete: true,
          winners: nextRoundResult.winners,
        };
      }
    }

    // Ensure state is saved before cloning
    this.gameStates.set(gameId, state);
    
    const currentPlayer = state.players[state.currentPlayerIndex];
    if (!currentPlayer) {
      this.logger.error(`[processAction] No player at index ${state.currentPlayerIndex}`);
      this.logger.error(`[processAction] Available players: ${state.players.map((p, i) => `${i}:${p.userId}(${p.status})`).join(', ')}`);
      return { success: false, error: 'Invalid game state' };
    }
    
    // Clone state for return (to prevent mutations)
    const clonedState = this.cloneState(state);
    
    
    return {
      success: true,
      state: clonedState,
      nextAction: {
        currentPlayerId: currentPlayer.userId,
        bettingRound: state.currentBettingRound,
        minimumBet: state.minimumBet,
      },
    };
  }

  /**
   * Validate a proposed action against the current game rules without mutating state.
   *
   * Rules enforced per action:
   *  - fold:   Always valid for an active player.
   *  - check:  Only valid when `toCall === 0` (no outstanding bet).
   *  - call:   Only valid when `toCall > 0`; partial call (all-in) is allowed.
   *  - bet:    Only valid when `toCall === 0`; `amount` must be ≥ `minimumBet`
   *            unless the player is going all-in for less.
   *  - raise:  Only valid when `toCall > 0`; the raise increment must be ≥
   *            `lastRaiseAmount` (or `bigBlind` if no prior raise this round)
   *            unless going all-in for less; `toCall + amount` must not exceed
   *            the player's remaining chips (use all-in for that case).
   *  - all-in: Always valid as long as the player has chips remaining.
   */
  private validateAction(
    state: PokerState,
    action: PokerAction,
    amount?: number,
  ): { valid: boolean; error?: string } {
    const player = state.players[state.currentPlayerIndex];

    if (!player) {
      return { valid: false, error: 'Invalid player index' };
    }

    if (player.status !== 'active') {
      return { valid: false, error: 'Player is not active' };
    }

    const currentBet = this.getMaxBet(state.players);
    const toCall = currentBet - player.betThisRound;

    switch (action) {
      case 'fold':
        return { valid: true };

      case 'check':
        if (toCall > 0) {
          return { valid: false, error: 'Cannot check, must call or fold' };
        }
        return { valid: true };

      case 'call':
        if (toCall === 0) {
          return { valid: false, error: 'Nothing to call, use check instead' };
        }
        // Allow call even if not enough chips (will go all-in)
        return { valid: true };

      case 'bet':
        if (toCall > 0) {
          return { valid: false, error: 'Cannot bet, must call or raise' };
        }
        if (!amount) {
          return { valid: false, error: 'Bet amount required' };
        }
        // Allow smaller bet if going all-in
        const isBetAllIn = amount >= player.chips;
        if (amount < state.minimumBet && !isBetAllIn) {
          return {
            valid: false,
            error: `Bet must be at least ${state.minimumBet}`,
          };
        }
        if (amount > player.chips) {
          return { valid: false, error: 'Not enough chips. Use all-in instead.' };
        }
        return { valid: true };

      case 'raise':
        if (toCall === 0) {
          return { valid: false, error: 'Nothing to raise, use bet instead' };
        }
        if (!amount) {
          return { valid: false, error: 'Raise amount required' };
        }
        // Minimum raise is the last raise amount (or big blind if no previous raise)
        const minRaise = state.lastRaiseAmount || state.bigBlind;
        const totalNeeded = toCall + amount;
        const isGoingAllIn = totalNeeded >= player.chips;
        
        // Allow smaller raise ONLY if going all-in (player doesn't have enough for min raise)
        if (amount < minRaise && !isGoingAllIn) {
          return {
            valid: false,
            error: `Raise must be at least ${minRaise}`,
          };
        }
        
        if (totalNeeded > player.chips) {
          // If they're trying to raise more than they have, they should use all-in instead
          return { valid: false, error: 'Not enough chips to raise that amount. Use all-in instead.' };
        }
        return { valid: true };

      case 'all-in':
        if (player.chips <= 0) {
          return { valid: false, error: 'No chips to go all-in with' };
        }
        return { valid: true };

      default:
        return { valid: false, error: 'Invalid action' };
    }
  }

  /**
   * Apply a validated action to the game state, mutating it in-place.
   *
   * Chip accounting per action:
   *  - fold:   Sets `player.status = 'folded'`.  No chip movement.
   *  - check:  No-op on chips.
   *  - call:   Deducts `min(toCall, player.chips)` from player, adds to pot.
   *            If chips reach 0, status → 'all-in'.
   *  - bet:    Deducts `amount`, updates `state.minimumBet` and
   *            `state.lastRaiseAmount` to `amount`.
   *  - raise:  Deducts `toCall + amount` (paying both the call and the raise
   *            increment); updates `minimumBet` / `lastRaiseAmount` to
   *            the raise increment only.
   *  - all-in: Pushes all remaining chips into the pot; if this exceeds the
   *            current max bet it is treated as a raise and updates
   *            `lastRaiseAmount` only when the increment ≥ the previous
   *            minimum raise (incomplete all-ins do not reopen full raises).
   *
   * @returns `{ success, amountBet }` — `amountBet` is recorded in action history.
   */
  private executeAction(
    state: PokerState,
    action: PokerAction,
    amount: number,
  ): { success: boolean; error?: string; amountBet?: number } {
    const player = state.players[state.currentPlayerIndex];
    const currentBet = this.getMaxBet(state.players);
    const toCall = currentBet - player.betThisRound;

    switch (action) {
      case 'fold':
        player.status = 'folded';
        player.lastAction = 'fold';
        return { success: true, amountBet: 0 };

      case 'check':
        player.lastAction = 'check';
        return { success: true, amountBet: 0 };

      case 'call': {
        const callAmount = Math.min(toCall, player.chips);
        player.chips -= callAmount;
        player.betThisRound += callAmount;
        player.totalBetThisHand += callAmount;
        state.pot += callAmount;
        
        if (player.chips === 0) {
          player.status = 'all-in';
          player.lastAction = 'all-in';
        } else {
          player.lastAction = 'call';
        }
        return { success: true, amountBet: callAmount };
      }

      case 'bet': {
        player.chips -= amount;
        player.betThisRound += amount;
        player.totalBetThisHand += amount;
        state.pot += amount;
        state.minimumBet = amount;
        state.lastRaiseAmount = amount;
        player.lastAction = 'bet';
        
        if (player.chips === 0) {
          player.status = 'all-in';
        }
        return { success: true, amountBet: amount };
      }

      case 'raise': {
        const totalAmount = toCall + amount;
        player.chips -= totalAmount;
        player.betThisRound += totalAmount;
        player.totalBetThisHand += totalAmount;
        state.pot += totalAmount;
        state.minimumBet = amount;
        state.lastRaiseAmount = amount;
        player.lastAction = 'raise';
        
        if (player.chips === 0) {
          player.status = 'all-in';
        }
        return { success: true, amountBet: totalAmount };
      }

      case 'all-in': {
        const allInAmount = player.chips;
        const previousBet = player.betThisRound;
        
        player.chips = 0;
        player.betThisRound += allInAmount;
        player.totalBetThisHand += allInAmount;
        state.pot += allInAmount;
        player.status = 'all-in';
        player.lastAction = 'all-in';
        
        // Only update min raise if this is actually a raise
        const newTotal = previousBet + allInAmount;
        if (newTotal > currentBet) {
          const raiseAmount = newTotal - currentBet;
          // Only set as min raise if it's at least the previous min raise
          // (incomplete all-in raises don't reopen betting for full raises)
          if (raiseAmount >= (state.lastRaiseAmount || state.bigBlind)) {
            state.lastRaiseAmount = raiseAmount;
            state.minimumBet = raiseAmount;
          }
        }
        return { success: true, amountBet: allInAmount };
      }

      default:
        return { success: false, error: 'Unknown action' };
    }
  }

  /**
   * Determine whether the current betting round is over.
   *
   * Called AFTER `advanceToNextPlayer`, so `currentPlayerIndex` already points
   * at the next player to act.
   *
   * A round is complete when ANY of the following are true:
   *  A) Only one non-folded player remains.
   *  B) All remaining players are all-in (no one can act).
   *  C) All active (non-all-in) players have matched the highest bet AND every
   *     active player has taken at least one action since the last aggressive
   *     action (bet, raise, or effective all-in raise) in this round.
   *
   * Pre-flop special case — the big blind option:
   *  Before condition C is met, the big blind player must have had a chance to
   *  act even if no one raised, because the BB's forced blind is not considered
   *  a voluntary action.  We verify `bigBlindPlayer` appears in `actionHistory`
   *  for this round before declaring it complete.
   *
   * Aggressor tracking:
   *  We scan `actionHistory` backwards to find the most recent bet/raise/all-in.
   *  All OTHER active players must appear in `actionHistory` AFTER that index.
   *  If no aggressor exists this round (all checks/calls so far), every active
   *  player simply needs to appear at least once.
   */
  private isBettingRoundComplete(state: PokerState): boolean {
    const activePlayers = state.players.filter(
      (p) => p.status === 'active' || p.status === 'all-in',
    );

    if (activePlayers.length <= 1) return true;

    const actablePlayers = activePlayers.filter(p => p.status === 'active');
    if (actablePlayers.length === 0) return true;

    const maxBet = this.getMaxBet(state.players);
    const allBetsMatched = actablePlayers.every(
      (p) => p.betThisRound === maxBet
    );
    if (!allBetsMatched) return false;

    const actionsThisRound = state.actionHistory.filter(
      a => a.bettingRound === state.currentBettingRound
    );
    
    // Find the last aggressive action (bet, raise, or blind posts count as well for pre-flop)
    let lastAggressorIndex = -1;
    for (let i = actionsThisRound.length - 1; i >= 0; i--) {
      const action = actionsThisRound[i];
      if (action.action === 'bet' || action.action === 'raise' || action.action === 'all-in') {
        // Check if this all-in was actually a raise (increased the max bet)
        if (action.action === 'all-in' && action.amount) {
          const playerBetBefore = state.players.find(p => p.userId === action.userId)?.betThisRound || 0;
          // All-in counts as aggressive if it increased the max bet
          if (playerBetBefore > maxBet - (action.amount || 0)) {
            lastAggressorIndex = i;
            break;
          }
        } else {
          lastAggressorIndex = i;
          break;
        }
      }
    }
    
    // If no aggressive action this round (only checks/calls), check if everyone has acted
    if (lastAggressorIndex === -1) {
      // For pre-flop, the big blind posting counts as the "aggressive" action
      if (state.currentBettingRound === 'pre-flop') {
        const bigBlindPlayer = state.players.find(p => p.isBigBlind);
        if (bigBlindPlayer && bigBlindPlayer.status === 'active') {
          const bigBlindActed = actionsThisRound.some(a => a.userId === bigBlindPlayer.userId);
          if (!bigBlindActed) return false;
        }
      }
      
      // Every actable player must have acted at least once
      const actablePlayerIds = new Set(actablePlayers.map(p => p.userId));
      const playersWhoActed = new Set(actionsThisRound.map(a => a.userId).filter(id => actablePlayerIds.has(id)));
      return actablePlayers.every(p => playersWhoActed.has(p.userId));
    }
    
    // There was an aggressive action - everyone after the aggressor must have acted
    const aggressorUserId = actionsThisRound[lastAggressorIndex].userId;
    const actionsAfterAggressor = actionsThisRound.slice(lastAggressorIndex + 1);
    const playersWhoActedAfter = new Set(actionsAfterAggressor.map(a => a.userId));
    
    // All actable players except the aggressor must have acted after the aggressive action
    const otherActablePlayers = actablePlayers.filter(p => p.userId !== aggressorUserId);
    return otherActablePlayers.every(p => playersWhoActedAfter.has(p.userId));
  }

  /**
   * Advance to next player (skip folded and all-in players)
   * NOTE: This is called AFTER a player has acted, so we need to advance to the NEXT player
   */
  private advanceToNextPlayer(state: PokerState): void {
    const actablePlayerIndices = state.players
      .map((p, idx) => ({ player: p, idx }))
      .filter(({ player }) => player.status === 'active')
      .map(({ idx }) => idx);
    
    if (actablePlayerIndices.length === 0) return;

    const startIndex = state.currentPlayerIndex;

    if (actablePlayerIndices.length === 1) {
      if (actablePlayerIndices[0] === startIndex) return;
      state.currentPlayerIndex = actablePlayerIndices[0];
      return;
    }
    
    for (let i = 1; i <= state.players.length; i++) {
      const nextIndex = (startIndex + i) % state.players.length;
      if (actablePlayerIndices.includes(nextIndex)) {
        state.currentPlayerIndex = nextIndex;
        return;
      }
    }
    
    state.currentPlayerIndex = actablePlayerIndices[0];
  }

  /**
   * Transition the game to the next betting round, dealing community cards.
   *
   * Community card dealing schedule:
   *  - pre-flop → flop:  Deal 3 cards (burn step omitted for simplicity).
   *  - flop     → turn:  Deal 1 card.
   *  - turn     → river: Deal 1 card.
   *  - river    → showdown: Trigger `evaluateShowdown`.
   *
   * Between rounds:
   *  - Reset every player's `betThisRound` to 0.
   *  - Reset `minimumBet` and `lastRaiseAmount` to `bigBlind`.
   *  - Set `currentPlayerIndex` to the first active player after the dealer
   *    (standard post-flop order, not heads-up pre-flop order).
   *
   * Fast-forward shortcut: if after dealing there is ≤1 active (non-all-in)
   * player but more than one player still in the hand, skip straight to
   * `fastForwardToShowdown` rather than waiting for action.
   */
  private advanceBettingRound(state: PokerState): {
    handComplete: boolean;
    winners?: { userId: string; amount: number; handRank: HandRank }[];
  } {
    // Reset betting round state
    state.players.forEach((player) => {
      player.betThisRound = 0;
    });
    state.minimumBet = state.bigBlind;
    state.lastRaiseAmount = state.bigBlind;

    // Check if we need to fast-forward
    const activePlayers = state.players.filter(p => p.status === 'active' || p.status === 'all-in');
    const actablePlayers = activePlayers.filter(p => p.status === 'active');
    
    if (actablePlayers.length <= 1 && activePlayers.length > 1) {
      return this.fastForwardToShowdown(state);
    }

    // Deal community cards based on round
    if (state.currentBettingRound === 'pre-flop') {
      const result = this.safeDealCards(state.deck, 3);
      if (!result) {
        this.logger.error('[advanceBettingRound] Failed to deal flop');
        return this.evaluateShowdown(state);
      }
      state.communityCards = result.cards;
      state.deck = result.remainingDeck;
      state.currentBettingRound = 'flop';
    } else if (state.currentBettingRound === 'flop') {
      const result = this.safeDealCards(state.deck, 1);
      if (!result) {
        this.logger.error('[advanceBettingRound] Failed to deal turn');
        return this.evaluateShowdown(state);
      }
      state.communityCards.push(result.cards[0]);
      state.deck = result.remainingDeck;
      state.currentBettingRound = 'turn';
    } else if (state.currentBettingRound === 'turn') {
      const result = this.safeDealCards(state.deck, 1);
      if (!result) {
        this.logger.error('[advanceBettingRound] Failed to deal river');
        return this.evaluateShowdown(state);
      }
      state.communityCards.push(result.cards[0]);
      state.deck = result.remainingDeck;
      state.currentBettingRound = 'river';
    } else if (state.currentBettingRound === 'river') {
      return this.evaluateShowdown(state);
    }

    // Set first player for new round (first active after dealer)
    state.currentPlayerIndex = this.getFirstActivePlayerIndex(state);

    // Check again if we need to fast-forward
    const remainingActable = state.players.filter(p => p.status === 'active');
    if (remainingActable.length <= 1 && activePlayers.length > 1) {
      return this.fastForwardToShowdown(state);
    }

    return { handComplete: false };
  }

  /**
   * Fast-forward to showdown when no further betting is possible.
   *
   * Triggered when all remaining players are all-in (or only one player can
   * still act and the bets are already matched).  Fills the community card
   * board to exactly 5 cards, sets the round to 'showdown', and immediately
   * calls `evaluateShowdown`.
   *
   * The number of cards dealt is `5 - communityCards.length`, covering all
   * partial board states (e.g. all-in on the flop still needs the turn and
   * river dealt face-up before comparing hands).
   */
  private fastForwardToShowdown(state: PokerState): {
    handComplete: boolean;
    winners?: { userId: string; amount: number; handRank: HandRank }[];
  } {
    // Calculate exactly how many cards we need
    const cardsNeeded = 5 - state.communityCards.length;
    
    if (cardsNeeded > 0) {
      const result = this.safeDealCards(state.deck, cardsNeeded);
      if (result) {
        state.communityCards.push(...result.cards);
        state.deck = result.remainingDeck;
      }
    }
    
    state.currentBettingRound = 'showdown';
    return this.evaluateShowdown(state);
  }

  /**
   * Get first active player index (first player after dealer who can act)
   */
  private getFirstActivePlayerIndex(state: PokerState): number {
    // Post-flop, first active player after dealer acts first
    for (let i = 0; i < state.players.length; i++) {
      const index = (state.dealerIndex + 1 + i) % state.players.length;
      const player = state.players[index];
      if (player.status === 'active') {
        return index;
      }
    }
    // If no active players, return first all-in player
    for (let i = 0; i < state.players.length; i++) {
      const index = (state.dealerIndex + 1 + i) % state.players.length;
      const player = state.players[index];
      if (player.status === 'all-in') {
        return index;
      }
    }
    return 0;
  }

  /**
   * Calculate side pots when one or more players are all-in for different amounts.
   *
   * Algorithm (standard poker side-pot construction):
   *  1. Collect each all-in player's `totalBetThisHand` and sort ascending.
   *  2. For each unique all-in threshold `t`:
   *     - Contribution layer = `t − previousThreshold`.
   *     - Eligible players = everyone whose `totalBetThisHand ≥ t`.
   *     - Pot slice = sum of each player's actual contribution to this layer
   *       (capped at `contribution` for players who bet ≥ t, pro-rated for those
   *       who bet less than the full layer).
   *  3. A final "main pot" layer covers any amount above the highest all-in.
   *
   * Returns an empty array if no player is all-in (no side pots needed).
   */
  private calculateSidePots(state: PokerState): SidePot[] {
    const activePlayers = state.players.filter(
      (p) => p.status === 'active' || p.status === 'all-in'
    );

    if (activePlayers.length <= 1) {
      return [];
    }

    // Get all unique bet amounts and sort them
    const allInAmounts = activePlayers
      .filter(p => p.status === 'all-in')
      .map(p => p.totalBetThisHand)
      .sort((a, b) => a - b);

    if (allInAmounts.length === 0) {
      // No side pots needed - everyone can win the main pot
      return [];
    }

    const uniqueAmounts = [...new Set(allInAmounts)];
    const sidePots: SidePot[] = [];
    let previousAmount = 0;

    for (const amount of uniqueAmounts) {
      const contribution = amount - previousAmount;
      if (contribution <= 0) continue;

      // Players eligible for this pot are those who bet at least this much
      const eligiblePlayers = activePlayers.filter(
        p => p.totalBetThisHand >= amount
      );

      // Calculate pot amount: contribution * number of players who contributed at least this much
      const contributingPlayers = state.players.filter(
        p => p.totalBetThisHand >= previousAmount && p.totalBetThisHand > 0
      );
      
      const potAmount = contributingPlayers.reduce((sum, p) => {
        const playerContribution = Math.min(p.totalBetThisHand - previousAmount, contribution);
        return sum + Math.max(0, playerContribution);
      }, 0);

      if (potAmount > 0 && eligiblePlayers.length > 0) {
        sidePots.push({
          amount: potAmount,
          eligiblePlayerIds: eligiblePlayers.map(p => p.userId),
        });
      }

      previousAmount = amount;
    }

    // Main pot for remaining amounts
    const maxBet = Math.max(...activePlayers.map(p => p.totalBetThisHand));
    if (maxBet > previousAmount) {
      const mainPotPlayers = activePlayers.filter(p => p.totalBetThisHand === maxBet);
      const remainingContribution = maxBet - previousAmount;
      
      const mainPotAmount = state.players.reduce((sum, p) => {
        if (p.totalBetThisHand > previousAmount) {
          return sum + Math.min(p.totalBetThisHand - previousAmount, remainingContribution);
        }
        return sum;
      }, 0);

      if (mainPotAmount > 0) {
        sidePots.push({
          amount: mainPotAmount,
          eligiblePlayerIds: mainPotPlayers.map(p => p.userId),
        });
      }
    }

    return sidePots;
  }

  /**
   * Evaluate all remaining players' hands and distribute the pot(s) to winner(s).
   *
   * Steps:
   *  1. Evaluate every active/all-in player's 7-card hand (2 hole + up to 5 board)
   *     using the `pokersolver` library via `evaluateHand`.  Hands with < 3
   *     community cards fall back to a High Card placeholder.
   *  2. Sort hands best-first using `compareHands` (which also uses pokersolver
   *     to break ties within the same rank category).
   *  3. If any player is all-in for different amounts, call `calculateSidePots`
   *     and award each side pot to the best eligible hand independently.
   *  4. If no side pots, split the main pot evenly among all tied winners
   *     (odd chip goes to the first winner in sort order).
   *  5. Set `state.isHandComplete = true`, `showdownRevealed = true`, clear `pot`.
   *  6. Populate `state.lastWinnings` (userId → chips gained) for the frontend
   *     to display win/loss deltas.
   */
  private evaluateShowdown(state: PokerState): {
    handComplete: boolean;
    winners: { userId: string; amount: number; handRank: HandRank }[];
  } {
    const activePlayers = state.players.filter(
      (p) => p.status === 'active' || p.status === 'all-in',
    );

    if (activePlayers.length === 0) {
      state.isHandComplete = true;
      return { handComplete: true, winners: [] };
    }

    // Evaluate all hands (only if we have community cards)
    const hands: Array<{ player: PlayerState; handRank: HandRank }> = [];
    
    if (state.communityCards.length >= 3) {
      for (const player of activePlayers) {
        try {
          const handRank = evaluateHand(player.holeCards, state.communityCards);
          player.handRank = handRank;
          hands.push({ player, handRank });
        } catch (error) {
          this.logger.error(`Error evaluating hand for ${player.userId}:`, error);
          // Give a default hand rank for error cases
          const defaultRank: HandRank = { name: 'High Card', rank: 1, cards: player.holeCards };
          player.handRank = defaultRank;
          hands.push({ player, handRank: defaultRank });
        }
      }
    } else {
      // No community cards - just use hole cards for ranking
      for (const player of activePlayers) {
        const defaultRank: HandRank = { name: 'High Card', rank: 1, cards: player.holeCards };
        player.handRank = defaultRank;
        hands.push({ player, handRank: defaultRank });
      }
    }

    if (hands.length === 0) {
      state.isHandComplete = true;
      return { handComplete: true, winners: [] };
    }

    // Calculate side pots
    const sidePots = this.calculateSidePots(state);
    state.sidePots = sidePots;

    // Sort hands by rank (best first)
    hands.sort((a, b) => -compareHands(a.handRank, b.handRank));

    const winnerResults: { userId: string; amount: number; handRank: HandRank }[] = [];
    state.lastWinnings = {};
    let totalDistributed = 0;

    if (sidePots.length > 0) {
      // Distribute side pots
      for (const sidePot of sidePots) {
        // Find the best hand among eligible players
        const eligibleHands = hands.filter(h => 
          sidePot.eligiblePlayerIds.includes(h.player.userId)
        );

        if (eligibleHands.length === 0) continue;

        const bestHand = eligibleHands[0].handRank;
        const potWinners = eligibleHands.filter(
          h => compareHands(h.handRank, bestHand) === 0
        );

        const sharePerWinner = Math.floor(sidePot.amount / potWinners.length);
        const remainder = sidePot.amount % potWinners.length;

        potWinners.forEach((winner, index) => {
          const amount = sharePerWinner + (index < remainder ? 1 : 0);
          const player = state.players.find(p => p.userId === winner.player.userId);
          if (player) {
            player.chips += amount;
            state.lastWinnings![winner.player.userId] = 
              (state.lastWinnings![winner.player.userId] || 0) + amount;
            totalDistributed += amount;

            // Add or update winner result
            const existing = winnerResults.find(w => w.userId === winner.player.userId);
            if (existing) {
              existing.amount += amount;
            } else {
              winnerResults.push({
                userId: winner.player.userId,
                amount,
                handRank: winner.handRank,
              });
            }
          }
        });
      }
    } else {
      // Simple pot distribution (no side pots)
      const bestHand = hands[0].handRank;
      const winners = hands.filter(h => compareHands(h.handRank, bestHand) === 0);

      const potAmount = state.pot;
      const sharePerWinner = Math.floor(potAmount / winners.length);
      const remainder = potAmount % winners.length;

      winners.forEach((winner, index) => {
        const amount = sharePerWinner + (index < remainder ? 1 : 0);
        const player = state.players.find(p => p.userId === winner.player.userId);
        if (player) {
          player.chips += amount;
          state.lastWinnings![winner.player.userId] = amount;
          totalDistributed += amount;
          
          winnerResults.push({
            userId: winner.player.userId,
            amount,
            handRank: winner.handRank,
          });
        }
      });
    }

    state.isHandComplete = true;
    state.winnerIds = winnerResults.map(w => w.userId);
    state.showdownRevealed = true;
    state.pot = 0;

    return { handComplete: true, winners: winnerResults };
  }

  /**
   * Start a new hand after the previous one has completed.
   *
   * Pre-conditions: `state.isHandComplete` should be `true`.
   *
   * Game-over check:
   *  If fewer than 2 players still have chips, the game is over.  The method
   *  sets `winnerIds` to the surviving player and returns the current state
   *  without starting a new hand (caller should emit `poker.gameOver`).
   *
   * Setup sequence:
   *  1. Rotate dealer clockwise (skip players with 0 chips).
   *  2. In heads-up: new dealer = small blind, other player = big blind.
   *  3. Reset per-player hand state: betThisRound, totalBetThisHand, holeCards,
   *     handRank, lastAction.  Players with 0 chips become 'out'.
   *  4. Create and shuffle a fresh 52-card deck.
   *  5. Deal 2 hole cards to each active player.
   *  6. Post blinds (partial/all-in blinds handled gracefully).
   *  7. Set first actor to the dealer (heads-up pre-flop rule).
   *  8. Reset round-level state: communityCards, actionHistory, pot, round name.
   *  9. Increment `handNumber`.
   */
  startNewHand(gameId: string): PokerState | null {
    const currentState = this.gameStates.get(gameId);
    if (!currentState) {
      return null;
    }

    // Idempotency guard: if both clients auto-trigger this simultaneously, the
    // second request arrives when the hand is already active.  Return null so
    // the gateway silently ignores the duplicate instead of dealing twice.
    if (!currentState.isHandComplete) {
      this.logger.warn(`[startNewHand] Hand still in progress for ${gameId} — ignoring duplicate request`);
      return null;
    }

    // Check if we have at least 2 players with chips
    const playersWithChips = currentState.players.filter(p => p.chips > 0);
    if (playersWithChips.length < 2) {
      this.logger.log(`[startNewHand] Game over - only ${playersWithChips.length} player(s) with chips`);
      const winner = playersWithChips[0];
      if (winner) {
        currentState.isHandComplete = true;
        currentState.winnerIds = [winner.userId];
      }
      return currentState;
    }

    // Rotate dealer
    let newDealerIndex = (currentState.dealerIndex + 1) % currentState.players.length;
    // Skip players who are out
    while (currentState.players[newDealerIndex].chips <= 0) {
      newDealerIndex = (newDealerIndex + 1) % currentState.players.length;
    }
    currentState.dealerIndex = newDealerIndex;
    
    // For heads-up, dealer is small blind
    const smallBlindIndex = newDealerIndex;
    let bigBlindIndex = (newDealerIndex + 1) % currentState.players.length;
    while (currentState.players[bigBlindIndex].chips <= 0) {
      bigBlindIndex = (bigBlindIndex + 1) % currentState.players.length;
    }

    // Reset player states
    currentState.players.forEach((player, index) => {
      player.isDealer = index === newDealerIndex;
      player.isSmallBlind = index === smallBlindIndex;
      player.isBigBlind = index === bigBlindIndex;
      player.betThisRound = 0;
      player.totalBetThisHand = 0;
      player.status = player.chips > 0 ? 'active' : 'out';
      player.holeCards = [];
      player.handRank = undefined;
      player.lastAction = undefined;
    });

    // Create and shuffle new deck
    const deck = shuffleDeck(createDeck());

    // Deal hole cards
    let remainingDeck = deck;
    for (const player of currentState.players) {
      if (player.status === 'active') {
        const result = this.safeDealCards(remainingDeck, 2);
        if (result) {
          player.holeCards = result.cards;
          remainingDeck = result.remainingDeck;
        }
      }
    }

    // Post blinds
    const smallBlindPlayer = currentState.players[smallBlindIndex];
    const bigBlindPlayer = currentState.players[bigBlindIndex];

    if (smallBlindPlayer.status === 'active') {
      const smallBlindAmount = Math.min(this.SMALL_BLIND, smallBlindPlayer.chips);
      smallBlindPlayer.chips -= smallBlindAmount;
      smallBlindPlayer.betThisRound = smallBlindAmount;
      smallBlindPlayer.totalBetThisHand = smallBlindAmount;
      if (smallBlindPlayer.chips === 0) {
        smallBlindPlayer.status = 'all-in';
      }
    }

    if (bigBlindPlayer.status === 'active') {
      const bigBlindAmount = Math.min(this.BIG_BLIND, bigBlindPlayer.chips);
      bigBlindPlayer.chips -= bigBlindAmount;
      bigBlindPlayer.betThisRound = bigBlindAmount;
      bigBlindPlayer.totalBetThisHand = bigBlindAmount;
      if (bigBlindPlayer.chips === 0) {
        bigBlindPlayer.status = 'all-in';
      }
    }

    // Set current player (dealer/small blind acts first in heads-up pre-flop)
    // If dealer is all-in, find next active player
    let currentPlayerIndex = newDealerIndex;
    if (currentState.players[currentPlayerIndex].status !== 'active') {
      currentPlayerIndex = bigBlindIndex;
      if (currentState.players[currentPlayerIndex].status !== 'active') {
        // Both players all-in from blinds - fast forward to showdown will happen
        currentPlayerIndex = newDealerIndex;
      }
    }

    // Reset game state
    currentState.communityCards = [];
    currentState.deck = remainingDeck;
    currentState.currentBettingRound = 'pre-flop';
    currentState.pot = currentState.players.reduce((sum, p) => sum + p.betThisRound, 0);
    currentState.sidePots = [];
    currentState.currentPlayerIndex = currentPlayerIndex;
    currentState.minimumBet = this.BIG_BLIND;
    currentState.lastRaiseAmount = this.BIG_BLIND;
    currentState.handNumber += 1;
    currentState.actionHistory = [];
    currentState.isHandComplete = false;
    currentState.winnerIds = undefined;
    currentState.showdownRevealed = false;
    currentState.lastWinnings = undefined; // Clear previous winnings

    this.gameStates.set(gameId, currentState);
    return currentState;
  }

  /**
   * Clean up game state from memory
   */
  cleanupGame(gameId: string): void {
    this.gameStates.delete(gameId);
    this.logger.log(`[cleanupGame] Cleaned up game ${gameId}`);
  }

  /**
   * Get all active game IDs (for debugging/admin)
   */
  getActiveGameIds(): string[] {
    return Array.from(this.gameStates.keys());
  }
}
