import { Injectable } from '@nestjs/common';
import {
  MonopolyState,
  MonopolyPlayer,
  MonopolyProperty,
  MonopolyActionResult,
  TradeOffer,
  CardEffect,
  DiceRoll,
} from './monopoly.types';
import {
  BOARD_SPACES,
  STARTING_CASH,
  GO_SALARY,
  JAIL_POSITION,
  JAIL_FINE,
  MAX_JAIL_TURNS,
  HOTEL_VALUE,
  RAILROAD_RENT,
  CHANCE_CARDS,
  COMMUNITY_CHEST_CARDS,
} from './monopoly.constants';
import {
  rollTwoDice,
  shuffleArray,
  getPropertyByIndex,
  ownsFullGroup,
  countOwnedRailroads,
  countOwnedUtilities,
  canBuildHouse,
  canSellHouse,
  canMortgage,
  findNearestRailroad,
  findNearestUtility,
  totalBuildingCost,
} from './monopoly.utils';

@Injectable()
export class MonopolyService {
  private gameStates = new Map<string, MonopolyState>();

  getState(gameId: string): MonopolyState | undefined {
    return this.gameStates.get(gameId);
  }

  setState(gameId: string, state: MonopolyState): void {
    this.gameStates.set(gameId, state);
  }

  cleanupGame(gameId: string): void {
    this.gameStates.delete(gameId);
  }

  initializeState(gameId: string, playerIds: string[]): MonopolyState {
    const players: MonopolyPlayer[] = playerIds.map((id) => ({
      userId: id,
      displayName: '',
      cash: STARTING_CASH,
      position: 0,
      properties: [],
      jailTurns: 0,
      inJail: false,
      getOutOfJailCards: 0,
      isBankrupt: false,
      doublesCount: 0,
      hasRolled: false,
    }));

    const purchasableIndices = BOARD_SPACES
      .filter((s) => s.type === 'property' || s.type === 'railroad' || s.type === 'utility')
      .map((s) => s.index);

    const properties: MonopolyProperty[] = purchasableIndices.map((idx) => ({
      spaceIndex: idx,
      ownerId: null,
      houses: 0,
      isMortgaged: false,
    }));

    const chanceDeck = shuffleArray(CHANCE_CARDS.map((_, i) => i));
    const communityChestDeck = shuffleArray(COMMUNITY_CHEST_CARDS.map((_, i) => i));

    const state: MonopolyState = {
      players,
      properties,
      currentPlayerIndex: 0,
      turnPhase: 'pre_roll',
      lastDice: null,
      chanceDeck,
      communityChestDeck,
      chanceDiscardPile: [],
      communityChestDiscardPile: [],
      auction: null,
      pendingTrade: null,
      pendingCard: null,
      rentOwed: null,
      eventLog: [],
      turnNumber: 1,
      gameOver: false,
      winnerId: null,
      startedAt: Date.now(),
    };

    this.gameStates.set(gameId, state);
    return this.cloneState(state);
  }

  // ==================== DICE & MOVEMENT ====================

  rollDice(gameId: string, userId: string): MonopolyActionResult {
    const state = this.gameStates.get(gameId);
    if (!state) return { success: false, error: 'Game not found' };

    const player = this.getCurrentPlayer(state);
    if (!player || player.userId !== userId) {
      return { success: false, error: 'Not your turn' };
    }

    if (player.inJail) {
      return this.rollForJail(gameId, userId);
    }

    if (state.turnPhase !== 'pre_roll') {
      return { success: false, error: 'Cannot roll right now' };
    }

    const dice = rollTwoDice();
    state.lastDice = dice;
    player.hasRolled = true;

    if (dice.isDoubles) {
      player.doublesCount++;
      if (player.doublesCount >= 3) {
        this.addEvent(state, 'jail', player.userId,
          `${player.displayName || 'Player'} rolled doubles 3 times — sent to Jail!`);
        this.sendToJail(state, player);
        state.turnPhase = 'post_roll';
        this.gameStates.set(gameId, state);
        return { success: true, state: this.cloneState(state), events: state.eventLog.slice(-3) };
      }
    } else {
      player.doublesCount = 0;
    }

    this.addEvent(state, 'dice', player.userId,
      `${player.displayName || 'Player'} rolled ${dice.die1} + ${dice.die2} = ${dice.total}`,
      { dice });

    const oldPos = player.position;
    player.position = (player.position + dice.total) % 40;

    if (player.position < oldPos) {
      player.cash += GO_SALARY;
      this.addEvent(state, 'go', player.userId,
        `${player.displayName || 'Player'} passed Go — collected $${GO_SALARY}`);
    }

    this.resolveSpace(state, player, gameId, dice);

    this.gameStates.set(gameId, state);
    return { success: true, state: this.cloneState(state), events: state.eventLog.slice(-5) };
  }

  // ==================== JAIL ====================

  rollForJail(gameId: string, userId: string): MonopolyActionResult {
    const state = this.gameStates.get(gameId);
    if (!state) return { success: false, error: 'Game not found' };

    const player = this.getCurrentPlayer(state);
    if (!player || player.userId !== userId) {
      return { success: false, error: 'Not your turn' };
    }
    if (!player.inJail) {
      return { success: false, error: 'You are not in jail' };
    }

    const dice = rollTwoDice();
    state.lastDice = dice;
    player.jailTurns++;

    if (dice.isDoubles) {
      player.inJail = false;
      player.jailTurns = 0;
      player.doublesCount = 0;
      this.addEvent(state, 'jail_escape', player.userId,
        `${player.displayName || 'Player'} rolled doubles and escaped Jail!`);

      const oldPos = player.position;
      player.position = (JAIL_POSITION + dice.total) % 40;
      if (player.position < oldPos) {
        player.cash += GO_SALARY;
      }

      this.resolveSpace(state, player, gameId, dice);
    } else if (player.jailTurns >= MAX_JAIL_TURNS) {
      player.cash -= JAIL_FINE;
      player.inJail = false;
      player.jailTurns = 0;
      player.doublesCount = 0;
      this.addEvent(state, 'jail_forced', player.userId,
        `${player.displayName || 'Player'} failed 3 jail rolls — paid $${JAIL_FINE} fine`);

      if (player.cash < 0) {
        return this.handleBankruptcy(state, player, JAIL_FINE, null, gameId);
      }

      const oldPos = player.position;
      player.position = (JAIL_POSITION + dice.total) % 40;
      if (player.position < oldPos) {
        player.cash += GO_SALARY;
      }

      this.resolveSpace(state, player, gameId, dice);
    } else {
      this.addEvent(state, 'jail_stay', player.userId,
        `${player.displayName || 'Player'} didn't roll doubles — still in Jail (${player.jailTurns}/${MAX_JAIL_TURNS})`);
      state.turnPhase = 'post_roll';
    }

    this.gameStates.set(gameId, state);
    return { success: true, state: this.cloneState(state), events: state.eventLog.slice(-3) };
  }

  payJailFine(gameId: string, userId: string): MonopolyActionResult {
    const state = this.gameStates.get(gameId);
    if (!state) return { success: false, error: 'Game not found' };

    const player = this.getCurrentPlayer(state);
    if (!player || player.userId !== userId) {
      return { success: false, error: 'Not your turn' };
    }
    if (!player.inJail) {
      return { success: false, error: 'You are not in jail' };
    }
    if (player.cash < JAIL_FINE) {
      return { success: false, error: 'Not enough cash to pay the fine' };
    }

    player.cash -= JAIL_FINE;
    player.inJail = false;
    player.jailTurns = 0;
    state.turnPhase = 'pre_roll';

    this.addEvent(state, 'jail_fine', player.userId,
      `${player.displayName || 'Player'} paid $${JAIL_FINE} to get out of Jail`);

    this.gameStates.set(gameId, state);
    return { success: true, state: this.cloneState(state), events: state.eventLog.slice(-2) };
  }

  useJailCard(gameId: string, userId: string): MonopolyActionResult {
    const state = this.gameStates.get(gameId);
    if (!state) return { success: false, error: 'Game not found' };

    const player = this.getCurrentPlayer(state);
    if (!player || player.userId !== userId) {
      return { success: false, error: 'Not your turn' };
    }
    if (!player.inJail) {
      return { success: false, error: 'You are not in jail' };
    }
    if (player.getOutOfJailCards <= 0) {
      return { success: false, error: 'No Get Out of Jail Free cards' };
    }

    player.getOutOfJailCards--;
    player.inJail = false;
    player.jailTurns = 0;
    state.turnPhase = 'pre_roll';

    if (state.chanceDiscardPile.length < CHANCE_CARDS.length) {
      const goojfIdx = CHANCE_CARDS.findIndex((c) => c.type === 'get_out_of_jail');
      if (goojfIdx >= 0 && !state.chanceDeck.includes(goojfIdx) && !state.chanceDiscardPile.includes(goojfIdx)) {
        state.chanceDiscardPile.push(goojfIdx);
      }
    }
    if (state.communityChestDiscardPile.length < COMMUNITY_CHEST_CARDS.length) {
      const goojfIdx = COMMUNITY_CHEST_CARDS.findIndex((c) => c.type === 'get_out_of_jail');
      if (goojfIdx >= 0 && !state.communityChestDeck.includes(goojfIdx) && !state.communityChestDiscardPile.includes(goojfIdx)) {
        state.communityChestDiscardPile.push(goojfIdx);
      }
    }

    this.addEvent(state, 'jail_card', player.userId,
      `${player.displayName || 'Player'} used a Get Out of Jail Free card`);

    this.gameStates.set(gameId, state);
    return { success: true, state: this.cloneState(state), events: state.eventLog.slice(-2) };
  }

  // ==================== PROPERTY ACTIONS ====================

  buyProperty(gameId: string, userId: string): MonopolyActionResult {
    const state = this.gameStates.get(gameId);
    if (!state) return { success: false, error: 'Game not found' };

    const player = this.getCurrentPlayer(state);
    if (!player || player.userId !== userId) {
      return { success: false, error: 'Not your turn' };
    }
    if (state.turnPhase !== 'buying_decision') {
      return { success: false, error: 'No property to buy right now' };
    }

    const space = BOARD_SPACES[player.position];
    const prop = getPropertyByIndex(state, player.position);
    if (!space || !prop || prop.ownerId !== null) {
      return { success: false, error: 'Property not available' };
    }

    const price = space.price ?? 0;
    if (player.cash < price) {
      return { success: false, error: 'Not enough cash' };
    }

    player.cash -= price;
    prop.ownerId = player.userId;
    player.properties.push(player.position);

    this.addEvent(state, 'buy', player.userId,
      `${player.displayName || 'Player'} bought ${space.name} for $${price}`);

    state.turnPhase = 'post_roll';
    this.gameStates.set(gameId, state);
    return { success: true, state: this.cloneState(state), events: state.eventLog.slice(-2) };
  }

  declineProperty(gameId: string, userId: string): MonopolyActionResult {
    const state = this.gameStates.get(gameId);
    if (!state) return { success: false, error: 'Game not found' };

    const player = this.getCurrentPlayer(state);
    if (!player || player.userId !== userId) {
      return { success: false, error: 'Not your turn' };
    }
    if (state.turnPhase !== 'buying_decision') {
      return { success: false, error: 'No property decision pending' };
    }

    const space = BOARD_SPACES[player.position];
    this.addEvent(state, 'decline', player.userId,
      `${player.displayName || 'Player'} declined to buy ${space.name} — Auction starts!`);

    state.auction = {
      propertyIndex: player.position,
      currentBid: 0,
      currentBidderId: null,
      currentTurnId: this.getOtherPlayer(state, userId).userId,
      passed: [],
    };
    state.turnPhase = 'auction';

    this.gameStates.set(gameId, state);
    return { success: true, state: this.cloneState(state), events: state.eventLog.slice(-2) };
  }

  placeBid(gameId: string, userId: string, amount: number): MonopolyActionResult {
    const state = this.gameStates.get(gameId);
    if (!state) return { success: false, error: 'Game not found' };

    if (state.turnPhase !== 'auction' || !state.auction) {
      return { success: false, error: 'No auction in progress' };
    }
    if (state.auction.currentTurnId !== userId) {
      return { success: false, error: 'Not your turn to bid' };
    }

    const player = state.players.find((p) => p.userId === userId);
    if (!player) return { success: false, error: 'Player not found' };

    if (amount <= state.auction.currentBid) {
      return { success: false, error: 'Bid must be higher than current bid' };
    }
    if (amount > player.cash) {
      return { success: false, error: 'Not enough cash for this bid' };
    }

    state.auction.currentBid = amount;
    state.auction.currentBidderId = userId;

    const otherPlayer = this.getOtherPlayer(state, userId);
    if (state.auction.passed.includes(otherPlayer.userId)) {
      return this.resolveAuction(state, gameId);
    }

    state.auction.currentTurnId = otherPlayer.userId;

    this.addEvent(state, 'bid', userId,
      `${player.displayName || 'Player'} bid $${amount}`);

    this.gameStates.set(gameId, state);
    return { success: true, state: this.cloneState(state), events: state.eventLog.slice(-2) };
  }

  passBid(gameId: string, userId: string): MonopolyActionResult {
    const state = this.gameStates.get(gameId);
    if (!state) return { success: false, error: 'Game not found' };

    if (state.turnPhase !== 'auction' || !state.auction) {
      return { success: false, error: 'No auction in progress' };
    }
    if (state.auction.currentTurnId !== userId) {
      return { success: false, error: 'Not your turn to bid' };
    }

    state.auction.passed.push(userId);

    if (state.auction.currentBidderId) {
      return this.resolveAuction(state, gameId);
    }

    const otherPlayer = this.getOtherPlayer(state, userId);
    if (state.auction.passed.includes(otherPlayer.userId)) {
      state.auction = null;
      state.turnPhase = 'post_roll';
      this.addEvent(state, 'auction_end', undefined,
        'Both players passed — property remains unsold');
      this.gameStates.set(gameId, state);
      return { success: true, state: this.cloneState(state), events: state.eventLog.slice(-2) };
    }

    state.auction.currentTurnId = otherPlayer.userId;
    this.addEvent(state, 'pass_bid', userId,
      `${state.players.find(p => p.userId === userId)?.displayName || 'Player'} passed`);

    this.gameStates.set(gameId, state);
    return { success: true, state: this.cloneState(state), events: state.eventLog.slice(-2) };
  }

  // ==================== BUILDING ====================

  buildHouse(gameId: string, userId: string, propertyIndex: number): MonopolyActionResult {
    const state = this.gameStates.get(gameId);
    if (!state) return { success: false, error: 'Game not found' };

    const currentPlayer = this.getCurrentPlayer(state);
    if (!currentPlayer || currentPlayer.userId !== userId) {
      return { success: false, error: 'Not your turn' };
    }
    if (state.turnPhase !== 'post_roll') {
      return { success: false, error: 'Can only build after rolling' };
    }

    const check = canBuildHouse(state, userId, propertyIndex);
    if (!check.allowed) {
      return { success: false, error: check.error };
    }

    const space = BOARD_SPACES[propertyIndex];
    const prop = getPropertyByIndex(state, propertyIndex)!;
    const cost = space.houseCost ?? 0;

    currentPlayer.cash -= cost;
    prop.houses++;

    const buildingType = prop.houses >= HOTEL_VALUE ? 'hotel' : 'house';
    this.addEvent(state, 'build', userId,
      `${currentPlayer.displayName || 'Player'} built a ${buildingType} on ${space.name} ($${cost})`);

    this.gameStates.set(gameId, state);
    return { success: true, state: this.cloneState(state), events: state.eventLog.slice(-2) };
  }

  sellHouse(gameId: string, userId: string, propertyIndex: number): MonopolyActionResult {
    const state = this.gameStates.get(gameId);
    if (!state) return { success: false, error: 'Game not found' };

    const currentPlayer = this.getCurrentPlayer(state);
    if (!currentPlayer || currentPlayer.userId !== userId) {
      return { success: false, error: 'Not your turn' };
    }

    const check = canSellHouse(state, userId, propertyIndex);
    if (!check.allowed) {
      return { success: false, error: check.error };
    }

    const space = BOARD_SPACES[propertyIndex];
    const prop = getPropertyByIndex(state, propertyIndex)!;
    const refund = Math.floor((space.houseCost ?? 0) / 2);

    prop.houses--;
    currentPlayer.cash += refund;

    this.addEvent(state, 'sell_house', userId,
      `${currentPlayer.displayName || 'Player'} sold a house on ${space.name} (+$${refund})`);

    this.gameStates.set(gameId, state);
    return { success: true, state: this.cloneState(state), events: state.eventLog.slice(-2) };
  }

  // ==================== MORTGAGE ====================

  mortgageProperty(gameId: string, userId: string, propertyIndex: number): MonopolyActionResult {
    const state = this.gameStates.get(gameId);
    if (!state) return { success: false, error: 'Game not found' };

    const currentPlayer = this.getCurrentPlayer(state);
    if (!currentPlayer || currentPlayer.userId !== userId) {
      return { success: false, error: 'Not your turn' };
    }

    const check = canMortgage(state, userId, propertyIndex);
    if (!check.allowed) {
      return { success: false, error: check.error };
    }

    const space = BOARD_SPACES[propertyIndex];
    const prop = getPropertyByIndex(state, propertyIndex)!;
    const mortgageAmount = space.mortgageValue ?? 0;

    prop.isMortgaged = true;
    currentPlayer.cash += mortgageAmount;

    this.addEvent(state, 'mortgage', userId,
      `${currentPlayer.displayName || 'Player'} mortgaged ${space.name} (+$${mortgageAmount})`);

    this.gameStates.set(gameId, state);
    return { success: true, state: this.cloneState(state), events: state.eventLog.slice(-2) };
  }

  unmortgageProperty(gameId: string, userId: string, propertyIndex: number): MonopolyActionResult {
    const state = this.gameStates.get(gameId);
    if (!state) return { success: false, error: 'Game not found' };

    const currentPlayer = this.getCurrentPlayer(state);
    if (!currentPlayer || currentPlayer.userId !== userId) {
      return { success: false, error: 'Not your turn' };
    }

    const prop = getPropertyByIndex(state, propertyIndex);
    if (!prop || prop.ownerId !== userId) {
      return { success: false, error: 'You do not own this property' };
    }
    if (!prop.isMortgaged) {
      return { success: false, error: 'Property is not mortgaged' };
    }

    const space = BOARD_SPACES[propertyIndex];
    const mortgageValue = space.mortgageValue ?? 0;
    const interest = Math.ceil(mortgageValue * 0.1);
    const totalCost = mortgageValue + interest;

    if (currentPlayer.cash < totalCost) {
      return { success: false, error: `Need $${totalCost} to unmortgage (includes 10% interest)` };
    }

    currentPlayer.cash -= totalCost;
    prop.isMortgaged = false;

    this.addEvent(state, 'unmortgage', userId,
      `${currentPlayer.displayName || 'Player'} unmortgaged ${space.name} (-$${totalCost})`);

    this.gameStates.set(gameId, state);
    return { success: true, state: this.cloneState(state), events: state.eventLog.slice(-2) };
  }

  // ==================== TRADING ====================

  proposeTrade(gameId: string, userId: string, offer: TradeOffer): MonopolyActionResult {
    const state = this.gameStates.get(gameId);
    if (!state) return { success: false, error: 'Game not found' };

    const currentPlayer = this.getCurrentPlayer(state);
    if (!currentPlayer || currentPlayer.userId !== userId) {
      return { success: false, error: 'Not your turn' };
    }
    if (state.turnPhase !== 'post_roll') {
      return { success: false, error: 'Can only trade after rolling' };
    }
    if (state.pendingTrade) {
      return { success: false, error: 'A trade is already pending' };
    }

    for (const idx of offer.offeredProperties) {
      const prop = getPropertyByIndex(state, idx);
      if (!prop || prop.ownerId !== userId) {
        return { success: false, error: `You don't own property at index ${idx}` };
      }
      if (prop.houses > 0) {
        return { success: false, error: 'Must sell all houses before trading a property' };
      }
    }

    const otherPlayer = this.getOtherPlayer(state, userId);
    for (const idx of offer.requestedProperties) {
      const prop = getPropertyByIndex(state, idx);
      if (!prop || prop.ownerId !== otherPlayer.userId) {
        return { success: false, error: `Opponent doesn't own property at index ${idx}` };
      }
      if (prop.houses > 0) {
        return { success: false, error: 'Opponent must sell houses on that property first' };
      }
    }

    if (offer.offeredCash > currentPlayer.cash) {
      return { success: false, error: 'Not enough cash for this offer' };
    }

    state.pendingTrade = { ...offer, fromUserId: userId, toUserId: otherPlayer.userId };
    state.turnPhase = 'trade_pending';

    this.addEvent(state, 'trade_propose', userId,
      `${currentPlayer.displayName || 'Player'} proposed a trade`);

    this.gameStates.set(gameId, state);
    return { success: true, state: this.cloneState(state), events: state.eventLog.slice(-2) };
  }

  respondTrade(gameId: string, userId: string, accept: boolean): MonopolyActionResult {
    const state = this.gameStates.get(gameId);
    if (!state) return { success: false, error: 'Game not found' };

    if (state.turnPhase !== 'trade_pending' || !state.pendingTrade) {
      return { success: false, error: 'No trade pending' };
    }
    if (state.pendingTrade.toUserId !== userId) {
      return { success: false, error: 'This trade is not for you' };
    }

    const trade = state.pendingTrade;
    const fromPlayer = state.players.find((p) => p.userId === trade.fromUserId)!;
    const toPlayer = state.players.find((p) => p.userId === trade.toUserId)!;

    if (accept) {
      if (trade.requestedCash > toPlayer.cash) {
        state.pendingTrade = null;
        state.turnPhase = 'post_roll';
        return { success: false, error: 'Not enough cash to accept this trade' };
      }

      for (const idx of trade.offeredProperties) {
        const prop = getPropertyByIndex(state, idx)!;
        prop.ownerId = toPlayer.userId;
        fromPlayer.properties = fromPlayer.properties.filter((p) => p !== idx);
        toPlayer.properties.push(idx);
      }
      for (const idx of trade.requestedProperties) {
        const prop = getPropertyByIndex(state, idx)!;
        prop.ownerId = fromPlayer.userId;
        toPlayer.properties = toPlayer.properties.filter((p) => p !== idx);
        fromPlayer.properties.push(idx);
      }

      fromPlayer.cash -= trade.offeredCash;
      fromPlayer.cash += trade.requestedCash;
      toPlayer.cash += trade.offeredCash;
      toPlayer.cash -= trade.requestedCash;

      this.addEvent(state, 'trade_accept', userId, 'Trade accepted!');
    } else {
      this.addEvent(state, 'trade_reject', userId, 'Trade rejected.');
    }

    state.pendingTrade = null;
    state.turnPhase = 'post_roll';

    this.gameStates.set(gameId, state);
    return { success: true, state: this.cloneState(state), events: state.eventLog.slice(-2) };
  }

  // ==================== END TURN ====================

  endTurn(gameId: string, userId: string): MonopolyActionResult {
    const state = this.gameStates.get(gameId);
    if (!state) return { success: false, error: 'Game not found' };

    const player = this.getCurrentPlayer(state);
    if (!player || player.userId !== userId) {
      return { success: false, error: 'Not your turn' };
    }
    if (state.turnPhase !== 'post_roll') {
      return { success: false, error: 'Cannot end turn right now' };
    }

    if (state.lastDice?.isDoubles && !player.inJail && player.doublesCount > 0) {
      state.turnPhase = 'pre_roll';
      player.hasRolled = false;
      this.addEvent(state, 'doubles', player.userId,
        `${player.displayName || 'Player'} rolled doubles — rolling again!`);
    } else {
      player.doublesCount = 0;
      player.hasRolled = false;
      state.currentPlayerIndex = (state.currentPlayerIndex + 1) % state.players.length;

      let safety = 0;
      while (state.players[state.currentPlayerIndex].isBankrupt && safety < state.players.length) {
        state.currentPlayerIndex = (state.currentPlayerIndex + 1) % state.players.length;
        safety++;
      }

      state.turnPhase = state.players[state.currentPlayerIndex].inJail ? 'jail_decision' : 'pre_roll';
      state.turnNumber++;

      const nextPlayer = this.getCurrentPlayer(state);
      this.addEvent(state, 'turn', nextPlayer?.userId,
        `${nextPlayer?.displayName || 'Player'}'s turn`);
    }

    this.gameStates.set(gameId, state);
    return { success: true, state: this.cloneState(state), events: state.eventLog.slice(-2) };
  }

  // ==================== BANKRUPTCY ====================

  declareBankruptcy(gameId: string, userId: string): MonopolyActionResult {
    const state = this.gameStates.get(gameId);
    if (!state) return { success: false, error: 'Game not found' };

    const player = state.players.find((p) => p.userId === userId);
    if (!player) return { success: false, error: 'Player not found' };

    player.isBankrupt = true;
    player.cash = 0;

    for (const prop of state.properties) {
      if (prop.ownerId === userId) {
        prop.ownerId = null;
        prop.houses = 0;
        prop.isMortgaged = false;
      }
    }
    player.properties = [];

    this.addEvent(state, 'bankrupt', userId,
      `${player.displayName || 'Player'} declared bankruptcy!`);

    const remaining = state.players.filter((p) => !p.isBankrupt);
    if (remaining.length <= 1) {
      state.gameOver = true;
      state.winnerId = remaining[0]?.userId ?? null;
      state.turnPhase = 'game_over';
      this.addEvent(state, 'game_over', state.winnerId ?? undefined,
        `${remaining[0]?.displayName || 'Player'} wins!`);
    } else {
      const cp = this.getCurrentPlayer(state);
      if (cp && cp.userId === userId) {
        cp.doublesCount = 0;
        cp.hasRolled = false;
        let safety = 0;
        do {
          state.currentPlayerIndex = (state.currentPlayerIndex + 1) % state.players.length;
          safety++;
        } while (state.players[state.currentPlayerIndex].isBankrupt && safety < state.players.length);
        state.turnPhase = state.players[state.currentPlayerIndex].inJail ? 'jail_decision' : 'pre_roll';
        state.turnNumber++;
      }
    }

    this.gameStates.set(gameId, state);
    return {
      success: true,
      state: this.cloneState(state),
      events: state.eventLog.slice(-3),
      gameOver: state.gameOver,
      winnerId: state.winnerId,
    };
  }

  // ==================== PRIVATE HELPERS ====================

  private getCurrentPlayer(state: MonopolyState): MonopolyPlayer | undefined {
    return state.players[state.currentPlayerIndex];
  }

  private getOtherPlayer(state: MonopolyState, userId: string): MonopolyPlayer {
    return state.players.find((p) => p.userId !== userId && !p.isBankrupt)!;
  }

  private sendToJail(state: MonopolyState, player: MonopolyPlayer): void {
    player.position = JAIL_POSITION;
    player.inJail = true;
    player.jailTurns = 0;
    player.doublesCount = 0;
  }

  private resolveSpace(
    state: MonopolyState,
    player: MonopolyPlayer,
    gameId: string,
    dice: DiceRoll,
  ): void {
    const space = BOARD_SPACES[player.position];
    if (!space) return;

    switch (space.type) {
      case 'property':
      case 'railroad':
      case 'utility': {
        const prop = getPropertyByIndex(state, player.position);
        if (!prop) break;

        if (prop.ownerId === null) {
          if (player.cash >= (space.price ?? 0)) {
            state.turnPhase = 'buying_decision';
            this.addEvent(state, 'land_unowned', player.userId,
              `${player.displayName || 'Player'} landed on ${space.name} ($${space.price}) — Buy or Auction?`);
          } else {
            state.auction = {
              propertyIndex: player.position,
              currentBid: 0,
              currentBidderId: null,
              currentTurnId: this.getOtherPlayer(state, player.userId).userId,
              passed: [],
            };
            state.turnPhase = 'auction';
            this.addEvent(state, 'forced_auction', player.userId,
              `${player.displayName || 'Player'} can't afford ${space.name} — Auction starts!`);
          }
        } else if (prop.ownerId === player.userId) {
          state.turnPhase = 'post_roll';
          this.addEvent(state, 'land_own', player.userId,
            `${player.displayName || 'Player'} landed on their own ${space.name}`);
        } else if (prop.isMortgaged) {
          state.turnPhase = 'post_roll';
          this.addEvent(state, 'land_mortgaged', player.userId,
            `${player.displayName || 'Player'} landed on ${space.name} (mortgaged — no rent)`);
        } else {
          const rent = this.calculateRent(state, player.position, dice);
          this.collectRent(state, player, prop.ownerId, rent, space.name, gameId);
        }
        break;
      }

      case 'tax': {
        const amount = space.taxAmount ?? 0;
        player.cash -= amount;
        this.addEvent(state, 'tax', player.userId,
          `${player.displayName || 'Player'} paid ${space.name}: $${amount}`);

        if (player.cash < 0) {
          this.handleBankruptcy(state, player, amount, null, gameId);
        } else {
          state.turnPhase = 'post_roll';
        }
        break;
      }

      case 'chance': {
        this.drawCard(state, player, 'chance', gameId);
        break;
      }

      case 'community_chest': {
        this.drawCard(state, player, 'community_chest', gameId);
        break;
      }

      case 'go_to_jail': {
        this.addEvent(state, 'go_to_jail', player.userId,
          `${player.displayName || 'Player'} landed on Go To Jail!`);
        this.sendToJail(state, player);
        state.turnPhase = 'post_roll';
        break;
      }

      case 'jail':
      case 'free_parking':
      case 'go':
      default:
        state.turnPhase = 'post_roll';
        if (space.type === 'free_parking') {
          this.addEvent(state, 'free_parking', player.userId,
            `${player.displayName || 'Player'} is relaxing on Free Parking`);
        } else if (space.type === 'jail') {
          this.addEvent(state, 'visiting', player.userId,
            `${player.displayName || 'Player'} is just visiting Jail`);
        }
        break;
    }
  }

  private calculateRent(state: MonopolyState, spaceIndex: number, dice: DiceRoll): number {
    const space = BOARD_SPACES[spaceIndex];
    const prop = getPropertyByIndex(state, spaceIndex);
    if (!space || !prop || !prop.ownerId || prop.isMortgaged) return 0;

    if (space.type === 'railroad') {
      const count = countOwnedRailroads(state, prop.ownerId);
      return RAILROAD_RENT[count - 1] ?? 0;
    }

    if (space.type === 'utility') {
      const count = countOwnedUtilities(state, prop.ownerId);
      const multiplier = count >= 2 ? 10 : 4;
      return dice.total * multiplier;
    }

    if (space.type === 'property' && space.rent) {
      if (prop.houses > 0) {
        return space.rent[prop.houses] ?? space.rent[0];
      }
      const baseRent = space.rent[0];
      if (space.colorGroup && ownsFullGroup(state, prop.ownerId, space.colorGroup)) {
        return baseRent * 2;
      }
      return baseRent;
    }

    return 0;
  }

  private collectRent(
    state: MonopolyState,
    payer: MonopolyPlayer,
    ownerId: string,
    rent: number,
    spaceName: string,
    gameId: string,
  ): void {
    const owner = state.players.find((p) => p.userId === ownerId);
    if (!owner) return;

    payer.cash -= rent;
    owner.cash += rent;

    this.addEvent(state, 'rent', payer.userId,
      `${payer.displayName || 'Player'} paid $${rent} rent to ${owner.displayName || 'opponent'} for ${spaceName}`);

    if (payer.cash < 0) {
      this.handleBankruptcy(state, payer, rent, ownerId, gameId);
    } else {
      state.turnPhase = 'post_roll';
    }
  }

  private drawCard(
    state: MonopolyState,
    player: MonopolyPlayer,
    deckType: 'chance' | 'community_chest',
    gameId: string,
  ): void {
    const cards = deckType === 'chance' ? CHANCE_CARDS : COMMUNITY_CHEST_CARDS;
    const deck = deckType === 'chance' ? state.chanceDeck : state.communityChestDeck;
    const discard = deckType === 'chance' ? state.chanceDiscardPile : state.communityChestDiscardPile;

    if (deck.length === 0) {
      const reshuffled = shuffleArray([...discard]);
      if (deckType === 'chance') {
        state.chanceDeck = reshuffled;
        state.chanceDiscardPile = [];
      } else {
        state.communityChestDeck = reshuffled;
        state.communityChestDiscardPile = [];
      }
    }

    const activeDeck = deckType === 'chance' ? state.chanceDeck : state.communityChestDeck;
    const cardIndex = activeDeck.shift()!;
    const card = cards[cardIndex];

    if (card.type !== 'get_out_of_jail') {
      if (deckType === 'chance') {
        state.chanceDiscardPile.push(cardIndex);
      } else {
        state.communityChestDiscardPile.push(cardIndex);
      }
    }

    const deckLabel = deckType === 'chance' ? 'Chance' : 'Community Chest';
    this.addEvent(state, 'card', player.userId,
      `${player.displayName || 'Player'} drew ${deckLabel}: "${card.text}"`, { card });
    state.pendingCard = card;

    this.applyCardEffect(state, player, card, gameId);
  }

  private applyCardEffect(
    state: MonopolyState,
    player: MonopolyPlayer,
    card: CardEffect,
    gameId: string,
  ): void {
    switch (card.type) {
      case 'advance_to': {
        const dest = card.destination!;
        const oldPos = player.position;
        player.position = dest;
        if (dest < oldPos && dest !== JAIL_POSITION) {
          player.cash += GO_SALARY;
          this.addEvent(state, 'go', player.userId,
            `${player.displayName || 'Player'} passed Go — collected $${GO_SALARY}`);
        }
        if (card.value && card.destination === 0) {
          // "Advance to Go" already collects from passing
        }
        this.resolveSpace(state, player, gameId, state.lastDice ?? { die1: 0, die2: 0, total: 0, isDoubles: false });
        break;
      }

      case 'advance_nearest': {
        const nearest = card.nearestType === 'railroad'
          ? findNearestRailroad(player.position)
          : findNearestUtility(player.position);
        const oldPos = player.position;
        player.position = nearest;
        if (nearest < oldPos) {
          player.cash += GO_SALARY;
        }
        const prop = getPropertyByIndex(state, nearest);
        if (prop && prop.ownerId && prop.ownerId !== player.userId && !prop.isMortgaged) {
          let rent: number;
          if (card.nearestType === 'railroad') {
            const count = countOwnedRailroads(state, prop.ownerId);
            rent = (RAILROAD_RENT[count - 1] ?? 25) * 2;
          } else {
            const diceRoll = rollTwoDice();
            state.lastDice = diceRoll;
            rent = diceRoll.total * 10;
          }
          this.collectRent(state, player, prop.ownerId, rent, BOARD_SPACES[nearest].name, gameId);
        } else if (prop && prop.ownerId === null) {
          state.turnPhase = 'buying_decision';
        } else {
          state.turnPhase = 'post_roll';
        }
        break;
      }

      case 'collect': {
        player.cash += card.value ?? 0;
        state.turnPhase = 'post_roll';
        break;
      }

      case 'pay': {
        player.cash -= card.value ?? 0;
        if (player.cash < 0) {
          this.handleBankruptcy(state, player, card.value ?? 0, null, gameId);
        } else {
          state.turnPhase = 'post_roll';
        }
        break;
      }

      case 'pay_each_player': {
        const amount = card.value ?? 0;
        const others = state.players.filter((p) => p.userId !== player.userId && !p.isBankrupt);
        const totalPay = amount * others.length;
        player.cash -= totalPay;
        for (const other of others) {
          other.cash += amount;
        }
        if (player.cash < 0) {
          this.handleBankruptcy(state, player, totalPay, null, gameId);
        } else {
          state.turnPhase = 'post_roll';
        }
        break;
      }

      case 'collect_each_player': {
        const amount = card.value ?? 0;
        const others = state.players.filter((p) => p.userId !== player.userId && !p.isBankrupt);
        for (const other of others) {
          const canPay = Math.min(amount, Math.max(other.cash, 0));
          other.cash -= amount;
          player.cash += canPay;
          if (other.cash < 0) {
            this.handleBankruptcy(state, other, amount, player.userId, gameId);
          }
        }
        if (!state.gameOver) {
          state.turnPhase = 'post_roll';
        }
        break;
      }

      case 'go_to_jail': {
        this.sendToJail(state, player);
        state.turnPhase = 'post_roll';
        break;
      }

      case 'get_out_of_jail': {
        player.getOutOfJailCards++;
        state.turnPhase = 'post_roll';
        break;
      }

      case 'go_back': {
        player.position = (player.position - (card.value ?? 0) + 40) % 40;
        this.resolveSpace(state, player, gameId, state.lastDice ?? { die1: 0, die2: 0, total: 0, isDoubles: false });
        break;
      }

      case 'repairs': {
        const cost = totalBuildingCost(state, player.userId, card.perHouse ?? 0, card.perHotel ?? 0);
        player.cash -= cost;
        this.addEvent(state, 'repairs', player.userId,
          `${player.displayName || 'Player'} paid $${cost} in repairs`);
        if (player.cash < 0) {
          this.handleBankruptcy(state, player, cost, null, gameId);
        } else {
          state.turnPhase = 'post_roll';
        }
        break;
      }

      default:
        state.turnPhase = 'post_roll';
        break;
    }

    state.pendingCard = null;
  }

  private resolveAuction(state: MonopolyState, gameId: string): MonopolyActionResult {
    const auction = state.auction!;
    const winner = state.players.find((p) => p.userId === auction.currentBidderId);

    if (winner && auction.currentBid > 0) {
      winner.cash -= auction.currentBid;
      const prop = getPropertyByIndex(state, auction.propertyIndex)!;
      prop.ownerId = winner.userId;
      winner.properties.push(auction.propertyIndex);

      const spaceName = BOARD_SPACES[auction.propertyIndex].name;
      this.addEvent(state, 'auction_win', winner.userId,
        `${winner.displayName || 'Player'} won ${spaceName} at auction for $${auction.currentBid}`);
    } else {
      this.addEvent(state, 'auction_end', undefined,
        'No bids — property remains unsold');
    }

    state.auction = null;
    state.turnPhase = 'post_roll';

    this.gameStates.set(gameId, state);
    return { success: true, state: this.cloneState(state), events: state.eventLog.slice(-2) };
  }

  private handleBankruptcy(
    state: MonopolyState,
    player: MonopolyPlayer,
    _amountOwed: number,
    creditorId: string | null,
    gameId: string,
  ): MonopolyActionResult {
    player.isBankrupt = true;

    if (creditorId) {
      const creditor = state.players.find((p) => p.userId === creditorId);
      if (creditor) {
        creditor.cash += Math.max(player.cash, 0);
        for (const prop of state.properties) {
          if (prop.ownerId === player.userId) {
            prop.ownerId = creditor.userId;
            creditor.properties.push(prop.spaceIndex);
          }
        }
        creditor.getOutOfJailCards += player.getOutOfJailCards;
      }
    } else {
      for (const prop of state.properties) {
        if (prop.ownerId === player.userId) {
          prop.ownerId = null;
          prop.houses = 0;
          prop.isMortgaged = false;
        }
      }
    }

    player.cash = 0;
    player.properties = [];
    player.getOutOfJailCards = 0;

    this.addEvent(state, 'bankrupt', player.userId,
      `${player.displayName || 'Player'} went bankrupt!`);

    const remaining = state.players.filter((p) => !p.isBankrupt);
    if (remaining.length <= 1) {
      state.gameOver = true;
      state.winnerId = remaining[0]?.userId ?? null;
      state.turnPhase = 'game_over';
      this.addEvent(state, 'game_over', state.winnerId ?? undefined,
        `${remaining[0]?.displayName || 'Player'} wins!`);
    } else {
      const cp = this.getCurrentPlayer(state);
      if (cp && cp.userId === player.userId) {
        let safety = 0;
        do {
          state.currentPlayerIndex = (state.currentPlayerIndex + 1) % state.players.length;
          safety++;
        } while (state.players[state.currentPlayerIndex].isBankrupt && safety < state.players.length);
        state.turnPhase = state.players[state.currentPlayerIndex].inJail ? 'jail_decision' : 'pre_roll';
        state.turnNumber++;
      } else {
        state.turnPhase = 'post_roll';
      }
    }

    this.gameStates.set(gameId, state);
    return {
      success: true,
      state: this.cloneState(state),
      events: state.eventLog.slice(-3),
      gameOver: state.gameOver,
      winnerId: state.winnerId,
    };
  }

  private addEvent(
    state: MonopolyState,
    type: string,
    playerId: string | undefined,
    message: string,
    data?: any,
  ): void {
    state.eventLog.push({ type, playerId, message, data });
    if (state.eventLog.length > 100) {
      state.eventLog = state.eventLog.slice(-80);
    }
  }

  private cloneState(state: MonopolyState): MonopolyState {
    return JSON.parse(JSON.stringify(state));
  }
}
