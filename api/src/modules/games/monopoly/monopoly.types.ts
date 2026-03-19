export type MonopolyTurnPhase =
  | 'pre_roll'
  | 'post_roll'
  | 'buying_decision'
  | 'auction'
  | 'paying_rent'
  | 'card_action'
  | 'jail_decision'
  | 'trade_pending'
  | 'bankrupt_resolution'
  | 'game_over';

export type SpaceType =
  | 'property'
  | 'railroad'
  | 'utility'
  | 'tax'
  | 'chance'
  | 'community_chest'
  | 'go'
  | 'jail'
  | 'free_parking'
  | 'go_to_jail';

export type ColorGroup =
  | 'brown'
  | 'lightBlue'
  | 'pink'
  | 'orange'
  | 'red'
  | 'yellow'
  | 'green'
  | 'darkBlue';

export interface BoardSpace {
  index: number;
  name: string;
  type: SpaceType;
  colorGroup?: ColorGroup;
  price?: number;
  rent?: number[];
  houseCost?: number;
  mortgageValue?: number;
  taxAmount?: number;
}

export interface MonopolyPlayer {
  userId: string;
  displayName: string;
  cash: number;
  position: number;
  properties: number[];
  jailTurns: number;
  inJail: boolean;
  getOutOfJailCards: number;
  isBankrupt: boolean;
  doublesCount: number;
  hasRolled: boolean;
}

export interface MonopolyProperty {
  spaceIndex: number;
  ownerId: string | null;
  houses: number;
  isMortgaged: boolean;
}

export interface DiceRoll {
  die1: number;
  die2: number;
  total: number;
  isDoubles: boolean;
}

export interface TradeOffer {
  fromUserId: string;
  toUserId: string;
  offeredProperties: number[];
  requestedProperties: number[];
  offeredCash: number;
  requestedCash: number;
}

export interface AuctionState {
  propertyIndex: number;
  currentBid: number;
  currentBidderId: string | null;
  currentTurnId: string;
  passed: string[];
}

export interface CardEffect {
  type: 'advance' | 'advance_nearest' | 'pay' | 'collect' | 'pay_each_player'
    | 'collect_each_player' | 'go_to_jail' | 'get_out_of_jail'
    | 'go_back' | 'repairs' | 'advance_to';
  text: string;
  value?: number;
  destination?: number;
  nearestType?: 'railroad' | 'utility';
  perHouse?: number;
  perHotel?: number;
}

export interface GameEvent {
  type: string;
  playerId?: string;
  message: string;
  data?: any;
}

export interface MonopolyState {
  players: MonopolyPlayer[];
  properties: MonopolyProperty[];
  currentPlayerIndex: number;
  turnPhase: MonopolyTurnPhase;
  lastDice: DiceRoll | null;
  chanceDeck: number[];
  communityChestDeck: number[];
  chanceDiscardPile: number[];
  communityChestDiscardPile: number[];
  auction: AuctionState | null;
  pendingTrade: TradeOffer | null;
  pendingCard: CardEffect | null;
  rentOwed: { amount: number; toPlayerId: string | null } | null;
  eventLog: GameEvent[];
  turnNumber: number;
  gameOver: boolean;
  winnerId: string | null;
  startedAt: number;
}

export interface MonopolyActionResult {
  success: boolean;
  error?: string;
  state?: MonopolyState;
  events?: GameEvent[];
  gameOver?: boolean;
  winnerId?: string | null;
}
