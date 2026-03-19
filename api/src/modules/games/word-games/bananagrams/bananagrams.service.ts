import { Injectable } from "@nestjs/common";
import { DictionaryService } from "../dictionary.service";
import {
  BananagramsState,
  BananagramsMoveResult,
  BananagramsPlacement,
  BananagramsPlayerState,
} from "./bananagrams.types";

const BANANAGRAMS_DISTRIBUTION: Record<string, number> = {
  A: 13, B: 3, C: 3, D: 6, E: 18, F: 3, G: 4, H: 3, I: 12, J: 2, K: 2,
  L: 5, M: 3, N: 8, O: 11, P: 3, Q: 2, R: 9, S: 6, T: 9, U: 6, V: 3,
  W: 3, X: 2, Y: 3, Z: 2,
};

@Injectable()
export class BananagramsService {
  private states = new Map<string, BananagramsState>();

  constructor(private readonly dictionary: DictionaryService) {}

  setState(gameId: string, state: BananagramsState) {
    this.states.set(gameId, state);
  }

  getState(gameId: string): BananagramsState | undefined {
    return this.states.get(gameId);
  }

  private createPool(): string[] {
    const pool: string[] = [];
    for (const [letter, count] of Object.entries(BANANAGRAMS_DISTRIBUTION)) {
      for (let i = 0; i < count; i++) {
        pool.push(letter);
      }
    }
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    return pool;
  }

  private drawFromPool(pool: string[], count: number): string[] {
    return pool.splice(0, Math.min(count, pool.length));
  }

  initializeState(player1Id: string, player2Id: string): BananagramsState {
    const pool = this.createPool();
    const p1Tiles = this.drawFromPool(pool, 21);
    const p2Tiles = this.drawFromPool(pool, 21);

    const makePlayer = (tiles: string[]): BananagramsPlayerState => ({
      tiles,
      grid: [],
      ready: false,
    });

    return {
      pool,
      players: {
        [player1Id]: makePlayer(p1Tiles),
        [player2Id]: makePlayer(p2Tiles),
      },
      player1: player1Id,
      player2: player2Id,
      phase: "playing",
      startedAt: Date.now(),
      winner: null,
      rottenBanana: null,
    };
  }

  updateGrid(
    gameId: string,
    userId: string,
    placements: BananagramsPlacement[],
  ): BananagramsMoveResult {
    const state = this.getState(gameId);
    if (!state) return { success: false, error: "Game not found" };
    if (state.phase !== "playing")
      return { success: false, error: "Game has ended" };

    const player = state.players[userId];
    if (!player) return { success: false, error: "Player not in this game" };

    player.grid = placements;
    this.setState(gameId, state);
    return { success: true, state };
  }

  peel(gameId: string, userId: string): BananagramsMoveResult {
    const state = this.getState(gameId);
    if (!state) return { success: false, error: "Game not found" };
    if (state.phase !== "playing")
      return { success: false, error: "Game has ended" };

    const player = state.players[userId];
    if (!player) return { success: false, error: "Player not in this game" };

    const placedLetters = player.grid.map((p) => p.letter.toUpperCase());
    if (placedLetters.length < player.tiles.length) {
      return { success: false, error: "All tiles must be placed before peeling" };
    }

    if (!this.tilesMatchGrid(player.tiles, player.grid)) {
      return { success: false, error: "Grid letters do not match your tiles" };
    }

    const validation = this.validateGrid(player.grid);
    if (!validation.valid) {
      return {
        success: false,
        error: `Invalid grid: ${validation.invalidWords.join(", ")} ${validation.invalidWords.length === 1 ? "is" : "are"} not valid`,
      };
    }

    if (state.pool.length < 2) {
      return { success: false, error: "Not enough tiles in the pool to peel" };
    }

    const newTiles: string[] = [];
    for (const playerId of [state.player1, state.player2]) {
      const drawn = this.drawFromPool(state.pool, 1);
      state.players[playerId].tiles.push(...drawn);
      if (playerId === userId) newTiles.push(...drawn);
    }

    this.setState(gameId, state);
    return { success: true, state, newTiles };
  }

  dump(
    gameId: string,
    userId: string,
    letterIndex: number,
  ): BananagramsMoveResult {
    const state = this.getState(gameId);
    if (!state) return { success: false, error: "Game not found" };
    if (state.phase !== "playing")
      return { success: false, error: "Game has ended" };

    const player = state.players[userId];
    if (!player) return { success: false, error: "Player not in this game" };

    if (letterIndex < 0 || letterIndex >= player.tiles.length) {
      return { success: false, error: "Invalid tile index" };
    }

    const [returned] = player.tiles.splice(letterIndex, 1);
    state.pool.push(returned);

    for (let i = state.pool.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [state.pool[i], state.pool[j]] = [state.pool[j], state.pool[i]];
    }

    const drawn = this.drawFromPool(state.pool, 3);
    player.tiles.push(...drawn);

    this.setState(gameId, state);
    return { success: true, state, newTiles: drawn };
  }

  callBananas(gameId: string, userId: string): BananagramsMoveResult {
    const state = this.getState(gameId);
    if (!state) return { success: false, error: "Game not found" };
    if (state.phase !== "playing")
      return { success: false, error: "Game has ended" };

    const player = state.players[userId];
    if (!player) return { success: false, error: "Player not in this game" };

    const playerCount = Object.keys(state.players).length;
    if (state.pool.length >= playerCount) {
      return { success: false, error: "Pool still has tiles — call peel instead" };
    }

    if (!this.tilesMatchGrid(player.tiles, player.grid)) {
      state.phase = "ended";
      state.rottenBanana = userId;
      state.winner = userId === state.player1 ? state.player2 : state.player1;
      this.setState(gameId, state);
      return { success: true, state, gameEnded: true, winner: state.winner };
    }

    const placedLetters = player.grid.map((p) => p.letter.toUpperCase());
    if (placedLetters.length < player.tiles.length) {
      state.phase = "ended";
      state.rottenBanana = userId;
      state.winner =
        userId === state.player1 ? state.player2 : state.player1;
      this.setState(gameId, state);
      return {
        success: true,
        state,
        gameEnded: true,
        winner: state.winner,
      };
    }

    const validation = this.validateGrid(player.grid);
    if (!validation.valid) {
      state.phase = "ended";
      state.rottenBanana = userId;
      state.winner =
        userId === state.player1 ? state.player2 : state.player1;
      this.setState(gameId, state);
      return {
        success: true,
        state,
        gameEnded: true,
        winner: state.winner,
      };
    }

    state.phase = "ended";
    state.winner = userId;
    this.setState(gameId, state);
    return { success: true, state, gameEnded: true, winner: userId };
  }

  private tilesMatchGrid(tiles: string[], grid: BananagramsPlacement[]): boolean {
    const tileCounts = new Map<string, number>();
    for (const t of tiles) {
      const upper = t.toUpperCase();
      tileCounts.set(upper, (tileCounts.get(upper) ?? 0) + 1);
    }
    const gridCounts = new Map<string, number>();
    for (const p of grid) {
      const upper = p.letter.toUpperCase();
      gridCounts.set(upper, (gridCounts.get(upper) ?? 0) + 1);
    }
    if (tileCounts.size !== gridCounts.size) return false;
    for (const [letter, count] of gridCounts) {
      if ((tileCounts.get(letter) ?? 0) !== count) return false;
    }
    return true;
  }

  validateGrid(
    placements: BananagramsPlacement[],
  ): { valid: boolean; invalidWords: string[] } {
    if (placements.length === 0) {
      return { valid: false, invalidWords: [] };
    }

    const grid = new Map<string, string>();
    for (const p of placements) {
      grid.set(`${p.row},${p.col}`, p.letter.toUpperCase());
    }

    const visited = new Set<string>();
    const startKey = `${placements[0].row},${placements[0].col}`;
    const queue = [startKey];
    visited.add(startKey);

    while (queue.length > 0) {
      const key = queue.shift()!;
      const [r, c] = key.split(",").map(Number);
      const neighbors = [
        `${r - 1},${c}`,
        `${r + 1},${c}`,
        `${r},${c - 1}`,
        `${r},${c + 1}`,
      ];
      for (const nk of neighbors) {
        if (grid.has(nk) && !visited.has(nk)) {
          visited.add(nk);
          queue.push(nk);
        }
      }
    }

    if (visited.size !== placements.length) {
      return { valid: false, invalidWords: [] };
    }

    const words: string[] = [];
    const positions = placements.map((p) => ({ row: p.row, col: p.col }));
    const posSet = new Set(positions.map((p) => `${p.row},${p.col}`));

    const rowGroups = new Map<number, number[]>();
    const colGroups = new Map<number, number[]>();

    for (const p of positions) {
      if (!rowGroups.has(p.row)) rowGroups.set(p.row, []);
      rowGroups.get(p.row)!.push(p.col);
      if (!colGroups.has(p.col)) colGroups.set(p.col, []);
      colGroups.get(p.col)!.push(p.row);
    }

    for (const [row, cols] of rowGroups) {
      const sorted = cols.sort((a, b) => a - b);
      let i = 0;
      while (i < sorted.length) {
        let j = i;
        while (j + 1 < sorted.length && sorted[j + 1] === sorted[j] + 1) j++;
        if (j > i) {
          let word = "";
          for (let c = sorted[i]; c <= sorted[j]; c++) {
            word += grid.get(`${row},${c}`) ?? "";
          }
          if (word.length >= 2) words.push(word);
        }
        i = j + 1;
      }
    }

    for (const [col, rows] of colGroups) {
      const sorted = rows.sort((a, b) => a - b);
      let i = 0;
      while (i < sorted.length) {
        let j = i;
        while (j + 1 < sorted.length && sorted[j + 1] === sorted[j] + 1) j++;
        if (j > i) {
          let word = "";
          for (let r = sorted[i]; r <= sorted[j]; r++) {
            word += grid.get(`${r},${col}`) ?? "";
          }
          if (word.length >= 2) words.push(word);
        }
        i = j + 1;
      }
    }

    if (words.length === 0) {
      return { valid: false, invalidWords: [] };
    }

    const invalidWords: string[] = [];
    for (const word of words) {
      if (!this.dictionary.isValidWord(word, 2)) {
        invalidWords.push(word);
      }
    }

    return { valid: invalidWords.length === 0, invalidWords };
  }

  sanitizeStateForPlayer(
    state: BananagramsState,
    userId: string,
  ): Partial<BananagramsState> & { opponentTileCount?: number } {
    const opponentId =
      userId === state.player1 ? state.player2 : state.player1;

    if (state.phase === "ended") return { ...state };

    return {
      pool: [],
      players: {
        [userId]: state.players[userId],
        [opponentId]: {
          tiles: [],
          grid: [],
          ready: state.players[opponentId].ready,
        },
      },
      player1: state.player1,
      player2: state.player2,
      phase: state.phase,
      startedAt: state.startedAt,
      winner: state.winner,
      rottenBanana: state.rottenBanana,
      opponentTileCount: state.players[opponentId].tiles.length,
    };
  }
}
