import {
  DiceRoll,
  MonopolyState,
  MonopolyProperty,
  ColorGroup,
} from './monopoly.types';
import {
  BOARD_SPACES,
  COLOR_GROUP_MEMBERS,
  RAILROAD_INDICES,
  UTILITY_INDICES,
  MAX_HOUSES,
  HOTEL_VALUE,
} from './monopoly.constants';

export function rollTwoDice(): DiceRoll {
  const die1 = Math.floor(Math.random() * 6) + 1;
  const die2 = Math.floor(Math.random() * 6) + 1;
  return { die1, die2, total: die1 + die2, isDoubles: die1 === die2 };
}

export function shuffleArray<T>(arr: T[]): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

export function getPropertyByIndex(
  state: MonopolyState,
  spaceIndex: number,
): MonopolyProperty | undefined {
  return state.properties.find((p) => p.spaceIndex === spaceIndex);
}

export function getColorGroup(spaceIndex: number): ColorGroup | undefined {
  return BOARD_SPACES[spaceIndex]?.colorGroup;
}

export function getGroupMembers(group: ColorGroup): number[] {
  return COLOR_GROUP_MEMBERS[group] || [];
}

export function ownsFullGroup(
  state: MonopolyState,
  playerId: string,
  group: ColorGroup,
): boolean {
  const members = getGroupMembers(group);
  return members.every((idx) => {
    const prop = getPropertyByIndex(state, idx);
    return prop?.ownerId === playerId;
  });
}

export function countOwnedRailroads(
  state: MonopolyState,
  playerId: string,
): number {
  return RAILROAD_INDICES.filter((idx) => {
    const prop = getPropertyByIndex(state, idx);
    return prop?.ownerId === playerId && !prop.isMortgaged;
  }).length;
}

export function countOwnedUtilities(
  state: MonopolyState,
  playerId: string,
): number {
  return UTILITY_INDICES.filter((idx) => {
    const prop = getPropertyByIndex(state, idx);
    return prop?.ownerId === playerId && !prop.isMortgaged;
  }).length;
}

export function canBuildHouse(
  state: MonopolyState,
  playerId: string,
  spaceIndex: number,
): { allowed: boolean; error?: string } {
  const space = BOARD_SPACES[spaceIndex];
  if (!space || space.type !== 'property' || !space.colorGroup) {
    return { allowed: false, error: 'Not a buildable property' };
  }

  const prop = getPropertyByIndex(state, spaceIndex);
  if (!prop || prop.ownerId !== playerId) {
    return { allowed: false, error: 'You do not own this property' };
  }
  if (prop.isMortgaged) {
    return { allowed: false, error: 'Property is mortgaged' };
  }
  if (prop.houses >= HOTEL_VALUE) {
    return { allowed: false, error: 'Property already has a hotel' };
  }

  if (!ownsFullGroup(state, playerId, space.colorGroup)) {
    return { allowed: false, error: 'You must own all properties in this color group' };
  }

  const groupMembers = getGroupMembers(space.colorGroup);
  const anyMortgaged = groupMembers.some((idx) => {
    const gp = getPropertyByIndex(state, idx);
    return gp?.isMortgaged;
  });
  if (anyMortgaged) {
    return { allowed: false, error: 'Cannot build while any property in the group is mortgaged' };
  }

  const currentHouses = prop.houses;
  const minInGroup = Math.min(
    ...groupMembers.map((idx) => getPropertyByIndex(state, idx)?.houses ?? 0),
  );
  if (currentHouses > minInGroup) {
    return { allowed: false, error: 'Must build evenly across the color group' };
  }

  const player = state.players.find((p) => p.userId === playerId);
  if (!player || player.cash < (space.houseCost ?? 0)) {
    return { allowed: false, error: 'Not enough cash' };
  }

  return { allowed: true };
}

export function canSellHouse(
  state: MonopolyState,
  playerId: string,
  spaceIndex: number,
): { allowed: boolean; error?: string } {
  const space = BOARD_SPACES[spaceIndex];
  if (!space || space.type !== 'property' || !space.colorGroup) {
    return { allowed: false, error: 'Not a buildable property' };
  }

  const prop = getPropertyByIndex(state, spaceIndex);
  if (!prop || prop.ownerId !== playerId) {
    return { allowed: false, error: 'You do not own this property' };
  }
  if (prop.houses <= 0) {
    return { allowed: false, error: 'No houses to sell' };
  }

  const groupMembers = getGroupMembers(space.colorGroup);
  const currentHouses = prop.houses;
  const maxInGroup = Math.max(
    ...groupMembers.map((idx) => getPropertyByIndex(state, idx)?.houses ?? 0),
  );
  if (currentHouses < maxInGroup) {
    return { allowed: false, error: 'Must sell evenly across the color group' };
  }

  return { allowed: true };
}

export function canMortgage(
  state: MonopolyState,
  playerId: string,
  spaceIndex: number,
): { allowed: boolean; error?: string } {
  const space = BOARD_SPACES[spaceIndex];
  if (!space) return { allowed: false, error: 'Invalid space' };

  const prop = getPropertyByIndex(state, spaceIndex);
  if (!prop || prop.ownerId !== playerId) {
    return { allowed: false, error: 'You do not own this property' };
  }
  if (prop.isMortgaged) {
    return { allowed: false, error: 'Already mortgaged' };
  }

  if (space.colorGroup) {
    const groupMembers = getGroupMembers(space.colorGroup);
    const anyHouses = groupMembers.some((idx) => {
      const gp = getPropertyByIndex(state, idx);
      return gp && gp.houses > 0;
    });
    if (anyHouses) {
      return { allowed: false, error: 'Must sell all houses in color group before mortgaging' };
    }
  }

  return { allowed: true };
}

export function calculateNetWorth(
  state: MonopolyState,
  playerId: string,
): number {
  const player = state.players.find((p) => p.userId === playerId);
  if (!player) return 0;

  let worth = player.cash;

  for (const prop of state.properties) {
    if (prop.ownerId !== playerId) continue;
    const space = BOARD_SPACES[prop.spaceIndex];
    if (!space) continue;

    if (prop.isMortgaged) {
      worth += space.mortgageValue ?? 0;
    } else {
      worth += space.price ?? 0;
    }

    if (prop.houses > 0 && space.houseCost) {
      const housesToCount = prop.houses >= HOTEL_VALUE ? MAX_HOUSES + 1 : prop.houses;
      worth += housesToCount * Math.floor(space.houseCost / 2);
    }
  }

  return worth;
}

export function findNearestRailroad(position: number): number {
  for (const rr of RAILROAD_INDICES) {
    if (rr > position) return rr;
  }
  return RAILROAD_INDICES[0];
}

export function findNearestUtility(position: number): number {
  for (const u of UTILITY_INDICES) {
    if (u > position) return u;
  }
  return UTILITY_INDICES[0];
}

export function totalBuildingCost(
  state: MonopolyState,
  playerId: string,
  perHouse: number,
  perHotel: number,
): number {
  let total = 0;
  for (const prop of state.properties) {
    if (prop.ownerId !== playerId) continue;
    if (prop.houses >= HOTEL_VALUE) {
      total += perHotel;
    } else {
      total += prop.houses * perHouse;
    }
  }
  return total;
}
