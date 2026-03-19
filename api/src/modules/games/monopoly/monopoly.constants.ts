import { BoardSpace, CardEffect } from './monopoly.types';

export const STARTING_CASH = 1500;
export const GO_SALARY = 200;
export const JAIL_POSITION = 10;
export const GO_TO_JAIL_POSITION = 30;
export const JAIL_FINE = 50;
export const MAX_JAIL_TURNS = 3;
export const MAX_HOUSES = 4;
export const HOTEL_VALUE = 5;

export const BOARD_SPACES: BoardSpace[] = [
  { index: 0, name: 'GO', type: 'go' },
  { index: 1, name: 'Mediterranean Avenue', type: 'property', colorGroup: 'brown', price: 60, rent: [2, 10, 30, 90, 160, 250], houseCost: 50, mortgageValue: 30 },
  { index: 2, name: 'Community Chest', type: 'community_chest' },
  { index: 3, name: 'Baltic Avenue', type: 'property', colorGroup: 'brown', price: 60, rent: [4, 20, 60, 180, 320, 450], houseCost: 50, mortgageValue: 30 },
  { index: 4, name: 'Income Tax', type: 'tax', taxAmount: 200 },
  { index: 5, name: 'Reading Railroad', type: 'railroad', price: 200, mortgageValue: 100 },
  { index: 6, name: 'Oriental Avenue', type: 'property', colorGroup: 'lightBlue', price: 100, rent: [6, 30, 90, 270, 400, 550], houseCost: 50, mortgageValue: 50 },
  { index: 7, name: 'Chance', type: 'chance' },
  { index: 8, name: 'Vermont Avenue', type: 'property', colorGroup: 'lightBlue', price: 100, rent: [6, 30, 90, 270, 400, 550], houseCost: 50, mortgageValue: 50 },
  { index: 9, name: 'Connecticut Avenue', type: 'property', colorGroup: 'lightBlue', price: 120, rent: [8, 40, 100, 300, 450, 600], houseCost: 50, mortgageValue: 60 },
  { index: 10, name: 'Jail / Just Visiting', type: 'jail' },
  { index: 11, name: 'St. Charles Place', type: 'property', colorGroup: 'pink', price: 140, rent: [10, 50, 150, 450, 625, 750], houseCost: 100, mortgageValue: 70 },
  { index: 12, name: 'Electric Company', type: 'utility', price: 150, mortgageValue: 75 },
  { index: 13, name: 'States Avenue', type: 'property', colorGroup: 'pink', price: 140, rent: [10, 50, 150, 450, 625, 750], houseCost: 100, mortgageValue: 70 },
  { index: 14, name: 'Virginia Avenue', type: 'property', colorGroup: 'pink', price: 160, rent: [12, 60, 180, 500, 700, 900], houseCost: 100, mortgageValue: 80 },
  { index: 15, name: 'Pennsylvania Railroad', type: 'railroad', price: 200, mortgageValue: 100 },
  { index: 16, name: 'St. James Place', type: 'property', colorGroup: 'orange', price: 180, rent: [14, 70, 200, 550, 750, 950], houseCost: 100, mortgageValue: 90 },
  { index: 17, name: 'Community Chest', type: 'community_chest' },
  { index: 18, name: 'Tennessee Avenue', type: 'property', colorGroup: 'orange', price: 180, rent: [14, 70, 200, 550, 750, 950], houseCost: 100, mortgageValue: 90 },
  { index: 19, name: 'New York Avenue', type: 'property', colorGroup: 'orange', price: 200, rent: [16, 80, 220, 600, 800, 1000], houseCost: 100, mortgageValue: 100 },
  { index: 20, name: 'Free Parking', type: 'free_parking' },
  { index: 21, name: 'Kentucky Avenue', type: 'property', colorGroup: 'red', price: 220, rent: [18, 90, 250, 700, 875, 1050], houseCost: 150, mortgageValue: 110 },
  { index: 22, name: 'Chance', type: 'chance' },
  { index: 23, name: 'Indiana Avenue', type: 'property', colorGroup: 'red', price: 220, rent: [18, 90, 250, 700, 875, 1050], houseCost: 150, mortgageValue: 110 },
  { index: 24, name: 'Illinois Avenue', type: 'property', colorGroup: 'red', price: 240, rent: [20, 100, 300, 750, 925, 1100], houseCost: 150, mortgageValue: 120 },
  { index: 25, name: 'B&O Railroad', type: 'railroad', price: 200, mortgageValue: 100 },
  { index: 26, name: 'Atlantic Avenue', type: 'property', colorGroup: 'yellow', price: 260, rent: [22, 110, 330, 800, 975, 1150], houseCost: 150, mortgageValue: 130 },
  { index: 27, name: 'Ventnor Avenue', type: 'property', colorGroup: 'yellow', price: 260, rent: [22, 110, 330, 800, 975, 1150], houseCost: 150, mortgageValue: 130 },
  { index: 28, name: 'Water Works', type: 'utility', price: 150, mortgageValue: 75 },
  { index: 29, name: 'Marvin Gardens', type: 'property', colorGroup: 'yellow', price: 280, rent: [24, 120, 360, 850, 1025, 1200], houseCost: 150, mortgageValue: 140 },
  { index: 30, name: 'Go To Jail', type: 'go_to_jail' },
  { index: 31, name: 'Pacific Avenue', type: 'property', colorGroup: 'green', price: 300, rent: [26, 130, 390, 900, 1100, 1275], houseCost: 200, mortgageValue: 150 },
  { index: 32, name: 'North Carolina Avenue', type: 'property', colorGroup: 'green', price: 300, rent: [26, 130, 390, 900, 1100, 1275], houseCost: 200, mortgageValue: 150 },
  { index: 33, name: 'Community Chest', type: 'community_chest' },
  { index: 34, name: 'Pennsylvania Avenue', type: 'property', colorGroup: 'green', price: 320, rent: [28, 150, 450, 1000, 1200, 1400], houseCost: 200, mortgageValue: 160 },
  { index: 35, name: 'Short Line Railroad', type: 'railroad', price: 200, mortgageValue: 100 },
  { index: 36, name: 'Chance', type: 'chance' },
  { index: 37, name: 'Park Place', type: 'property', colorGroup: 'darkBlue', price: 350, rent: [35, 175, 500, 1100, 1300, 1500], houseCost: 200, mortgageValue: 175 },
  { index: 38, name: 'Luxury Tax', type: 'tax', taxAmount: 100 },
  { index: 39, name: 'Boardwalk', type: 'property', colorGroup: 'darkBlue', price: 400, rent: [50, 200, 600, 1400, 1700, 2000], houseCost: 200, mortgageValue: 200 },
];

export const COLOR_GROUP_MEMBERS: Record<string, number[]> = {
  brown: [1, 3],
  lightBlue: [6, 8, 9],
  pink: [11, 13, 14],
  orange: [16, 18, 19],
  red: [21, 23, 24],
  yellow: [26, 27, 29],
  green: [31, 32, 34],
  darkBlue: [37, 39],
};

export const RAILROAD_INDICES = [5, 15, 25, 35];
export const UTILITY_INDICES = [12, 28];

export const RAILROAD_RENT = [25, 50, 100, 200];

export const CHANCE_CARDS: CardEffect[] = [
  { type: 'advance_to', text: 'Advance to Boardwalk.', destination: 39 },
  { type: 'advance_to', text: 'Advance to Go. Collect $200.', destination: 0, value: 200 },
  { type: 'advance_to', text: 'Advance to Illinois Avenue. If you pass Go, collect $200.', destination: 24 },
  { type: 'advance_to', text: 'Advance to St. Charles Place. If you pass Go, collect $200.', destination: 11 },
  { type: 'advance_nearest', text: 'Advance to the nearest Railroad. Pay owner twice the rental.', nearestType: 'railroad' },
  { type: 'advance_nearest', text: 'Advance to the nearest Railroad. Pay owner twice the rental.', nearestType: 'railroad' },
  { type: 'advance_nearest', text: 'Advance to the nearest Utility. If unowned, you may buy it. If owned, throw dice and pay owner 10 times the amount thrown.', nearestType: 'utility' },
  { type: 'collect', text: 'Bank pays you dividend of $50.', value: 50 },
  { type: 'get_out_of_jail', text: 'Get Out of Jail Free.' },
  { type: 'go_back', text: 'Go Back 3 Spaces.', value: 3 },
  { type: 'go_to_jail', text: 'Go to Jail. Go directly to Jail, do not pass Go, do not collect $200.' },
  { type: 'repairs', text: 'Make general repairs on all your property. For each house pay $25. For each hotel pay $100.', perHouse: 25, perHotel: 100 },
  { type: 'pay', text: 'Speeding fine $15.', value: 15 },
  { type: 'advance_to', text: 'Take a trip to Reading Railroad. If you pass Go, collect $200.', destination: 5 },
  { type: 'pay_each_player', text: 'You have been elected Chairman of the Board. Pay each player $50.', value: 50 },
  { type: 'collect', text: 'Your building loan matures. Collect $150.', value: 150 },
];

export const COMMUNITY_CHEST_CARDS: CardEffect[] = [
  { type: 'advance_to', text: 'Advance to Go. Collect $200.', destination: 0, value: 200 },
  { type: 'collect', text: 'Bank error in your favor. Collect $200.', value: 200 },
  { type: 'pay', text: "Doctor's fee. Pay $50.", value: 50 },
  { type: 'collect', text: 'From sale of stock you get $50.', value: 50 },
  { type: 'get_out_of_jail', text: 'Get Out of Jail Free.' },
  { type: 'go_to_jail', text: 'Go to Jail. Go directly to Jail, do not pass Go, do not collect $200.' },
  { type: 'collect', text: 'Holiday fund matures. Receive $100.', value: 100 },
  { type: 'collect', text: 'Income tax refund. Collect $20.', value: 20 },
  { type: 'collect_each_player', text: 'It is your birthday. Collect $10 from every player.', value: 10 },
  { type: 'collect', text: 'Life insurance matures. Collect $100.', value: 100 },
  { type: 'pay', text: 'Pay hospital fees of $100.', value: 100 },
  { type: 'pay', text: 'Pay school fees of $50.', value: 50 },
  { type: 'collect', text: 'Receive $25 consultancy fee.', value: 25 },
  { type: 'repairs', text: 'You are assessed for street repair. $40 per house. $115 per hotel.', perHouse: 40, perHotel: 115 },
  { type: 'collect', text: 'You have won second prize in a beauty contest. Collect $10.', value: 10 },
  { type: 'collect', text: 'You inherit $100.', value: 100 },
];
