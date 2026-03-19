import { Injectable } from "@nestjs/common";
import { DictionaryService } from "../dictionary.service";
import {
  ScrabbleState,
  ScrabbleMoveResult,
  ScrabbleTile,
  TilePlacement,
  PremiumType,
} from "./scrabble.types";

const TW_POSITIONS = [
  [0, 0], [0, 7], [0, 14], [7, 0], [7, 14], [14, 0], [14, 7], [14, 14],
];

const DW_POSITIONS = [
  [1, 1], [2, 2], [3, 3], [4, 4],
  [10, 10], [11, 11], [12, 12], [13, 13],
  [1, 13], [2, 12], [3, 11], [4, 10],
  [10, 4], [11, 3], [12, 2], [13, 1],
  [7, 7],
];

const TL_POSITIONS = [
  [1, 5], [1, 9], [5, 1], [5, 5], [5, 9], [5, 13],
  [9, 1], [9, 5], [9, 9], [9, 13], [13, 5], [13, 9],
];

const DL_POSITIONS = [
  [0, 3], [0, 11], [2, 6], [2, 8], [3, 0], [3, 7], [3, 14],
  [6, 2], [6, 6], [6, 8], [6, 12],
  [7, 3], [7, 11],
  [8, 2], [8, 6], [8, 8], [8, 12],
  [11, 0], [11, 7], [11, 14], [12, 6], [12, 8], [14, 3], [14, 11],
];

@Injectable()
export class ScrabbleService {
  private states = new Map<string, ScrabbleState>();

  constructor(private readonly dictionary: DictionaryService) {}

  setState(gameId: string, state: ScrabbleState) {
    this.states.set(gameId, state);
  }

  getState(gameId: string): ScrabbleState | undefined {
    return this.states.get(gameId);
  }

  private buildPremiumMap(): PremiumType[][] {
    const map: PremiumType[][] = Array.from({ length: 15 }, () =>
      Array(15).fill(null),
    );
    for (const [r, c] of TW_POSITIONS) map[r][c] = "TW";
    for (const [r, c] of DW_POSITIONS) map[r][c] = "DW";
    for (const [r, c] of TL_POSITIONS) map[r][c] = "TL";
    for (const [r, c] of DL_POSITIONS) map[r][c] = "DL";
    return map;
  }

  private createTileBag(): ScrabbleTile[] {
    const dist = this.dictionary.getScrabbleTileDistribution();
    const scores = this.dictionary.getScrabbleLetterScores();
    const bag: ScrabbleTile[] = [];

    for (const [letter, count] of Object.entries(dist)) {
      for (let i = 0; i < count; i++) {
        if (letter === "_") {
          bag.push({ letter: "", score: 0, isBlank: true });
        } else {
          bag.push({ letter, score: scores[letter] ?? 0, isBlank: false });
        }
      }
    }

    for (let i = bag.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [bag[i], bag[j]] = [bag[j], bag[i]];
    }

    return bag;
  }

  private drawTiles(bag: ScrabbleTile[], count: number): ScrabbleTile[] {
    return bag.splice(0, Math.min(count, bag.length));
  }

  initializeState(player1Id: string, player2Id: string): ScrabbleState {
    const board: (ScrabbleTile | null)[][] = Array.from({ length: 15 }, () =>
      Array(15).fill(null),
    );
    const tileBag = this.createTileBag();
    const p1Tiles = this.drawTiles(tileBag, 7);
    const p2Tiles = this.drawTiles(tileBag, 7);

    return {
      board,
      premiumMap: this.buildPremiumMap(),
      tileBag,
      playerTiles: { [player1Id]: p1Tiles, [player2Id]: p2Tiles },
      scores: { [player1Id]: 0, [player2Id]: 0 },
      player1: player1Id,
      player2: player2Id,
      currentTurn: player1Id,
      moveHistory: [],
      consecutivePasses: 0,
      phase: "playing",
      firstMove: true,
      winner: null,
      isDraw: false,
    };
  }

  placeTiles(
    gameId: string,
    userId: string,
    placements: { row: number; col: number; letter: string; isBlank: boolean }[],
  ): ScrabbleMoveResult {
    const state = this.getState(gameId);
    if (!state) return { success: false, error: "Game not found" };
    if (state.phase !== "playing")
      return { success: false, error: "Game has ended" };
    if (state.currentTurn !== userId)
      return { success: false, error: "Not your turn" };
    if (placements.length === 0)
      return { success: false, error: "Must place at least one tile" };

    const rack = [...state.playerTiles[userId]];

    const tilePlacements: TilePlacement[] = [];
    const usedRackIndices: number[] = [];

    for (const p of placements) {
      if (p.row < 0 || p.row > 14 || p.col < 0 || p.col > 14) {
        return { success: false, error: `Position (${p.row},${p.col}) is out of bounds` };
      }
      if (state.board[p.row][p.col] !== null) {
        return { success: false, error: `Position (${p.row},${p.col}) is already occupied` };
      }

      const letter = p.letter.toUpperCase();
      let foundIdx = -1;

      if (p.isBlank) {
        foundIdx = rack.findIndex(
          (t, i) => t.isBlank && !usedRackIndices.includes(i),
        );
      } else {
        foundIdx = rack.findIndex(
          (t, i) => !t.isBlank && t.letter === letter && !usedRackIndices.includes(i),
        );
      }

      if (foundIdx === -1) {
        return { success: false, error: `Tile '${letter}' not in your rack` };
      }

      usedRackIndices.push(foundIdx);
      const tile: ScrabbleTile = p.isBlank
        ? { letter, score: 0, isBlank: true }
        : rack[foundIdx];

      tilePlacements.push({ row: p.row, col: p.col, tile });
    }

    const rows = new Set(placements.map((p) => p.row));
    const cols = new Set(placements.map((p) => p.col));

    const isHorizontal = rows.size === 1;
    const isVertical = cols.size === 1;

    if (!isHorizontal && !isVertical) {
      return { success: false, error: "All tiles must be placed in a single row or column" };
    }

    if (state.firstMove) {
      const crossesCenter = placements.some(
        (p) => p.row === 7 && p.col === 7,
      );
      if (!crossesCenter) {
        return { success: false, error: "First move must cross the center square (7,7)" };
      }
    }

    const tempBoard = state.board.map((row) => [...row]);
    for (const tp of tilePlacements) {
      tempBoard[tp.row][tp.col] = tp.tile;
    }

    if (!state.firstMove) {
      let connectsToExisting = false;
      for (const tp of tilePlacements) {
        const neighbors = [
          [tp.row - 1, tp.col],
          [tp.row + 1, tp.col],
          [tp.row, tp.col - 1],
          [tp.row, tp.col + 1],
        ];
        for (const [nr, nc] of neighbors) {
          if (nr >= 0 && nr < 15 && nc >= 0 && nc < 15) {
            if (
              state.board[nr][nc] !== null &&
              !tilePlacements.some((p) => p.row === nr && p.col === nc)
            ) {
              connectsToExisting = true;
              break;
            }
          }
        }
        if (connectsToExisting) break;
      }
      if (!connectsToExisting) {
        return { success: false, error: "Tiles must connect to existing tiles on the board" };
      }
    }

    const newTilePositions = new Set(
      tilePlacements.map((p) => `${p.row},${p.col}`),
    );
    const wordsFormed = this.findAllWords(
      tempBoard,
      tilePlacements,
      state.premiumMap,
      newTilePositions,
    );

    for (const wf of wordsFormed) {
      if (!this.dictionary.isValidWord(wf.word, 2)) {
        return { success: false, error: `'${wf.word}' is not a valid word` };
      }
    }

    if (wordsFormed.length === 0) {
      return { success: false, error: "No valid words formed" };
    }

    for (const tp of tilePlacements) {
      state.board[tp.row][tp.col] = tp.tile;
    }

    let totalScore = wordsFormed.reduce((s, w) => s + w.score, 0);

    if (placements.length === 7) {
      totalScore += 50;
    }

    state.scores[userId] += totalScore;

    const previousRack = rack;
    const previousBagLength = state.tileBag.length;

    const remaining = rack.filter((_, i) => !usedRackIndices.includes(i));
    const drawn = this.drawTiles(state.tileBag, placements.length);
    state.playerTiles[userId] = [...remaining, ...drawn];

    state.moveHistory.push({
      userId,
      word: wordsFormed[0].word,
      score: totalScore,
      placements: tilePlacements,
      wordsFormed,
      previousRack,
      previousBagLength,
    });

    state.consecutivePasses = 0;
    state.firstMove = false;

    const ended = this.checkGameEnd(state);

    state.currentTurn =
      userId === state.player1 ? state.player2 : state.player1;

    this.setState(gameId, state);
    return {
      success: true,
      state,
      wordScore: totalScore,
      wordsFormed,
      gameEnded: ended,
      winner: ended ? state.winner : undefined,
      isDraw: ended ? state.isDraw : undefined,
    };
  }

  private findAllWords(
    board: (ScrabbleTile | null)[][],
    placements: TilePlacement[],
    premiumMap: PremiumType[][],
    newTilePositions: Set<string>,
  ): { word: string; score: number }[] {
    const words: { word: string; score: number }[] = [];
    const processed = new Set<string>();

    const rows = new Set(placements.map((p) => p.row));
    const isHorizontal = rows.size === 1;

    const mainWord = this.extractWord(
      board,
      placements[0].row,
      placements[0].col,
      isHorizontal,
      premiumMap,
      newTilePositions,
    );
    if (mainWord && mainWord.word.length >= 2) {
      const key = `${mainWord.word}-${isHorizontal ? "h" : "v"}-${mainWord.startRow}-${mainWord.startCol}`;
      if (!processed.has(key)) {
        processed.add(key);
        words.push(mainWord);
      }
    }

    for (const tp of placements) {
      const crossWord = this.extractWord(
        board,
        tp.row,
        tp.col,
        !isHorizontal,
        premiumMap,
        newTilePositions,
      );
      if (crossWord && crossWord.word.length >= 2) {
        const key = `${crossWord.word}-${!isHorizontal ? "h" : "v"}-${crossWord.startRow}-${crossWord.startCol}`;
        if (!processed.has(key)) {
          processed.add(key);
          words.push(crossWord);
        }
      }
    }

    return words;
  }

  private extractWord(
    board: (ScrabbleTile | null)[][],
    row: number,
    col: number,
    horizontal: boolean,
    premiumMap: PremiumType[][],
    newTilePositions: Set<string>,
  ): { word: string; score: number; startRow: number; startCol: number } | null {
    let r = row;
    let c = col;

    if (horizontal) {
      while (c > 0 && board[r][c - 1] !== null) c--;
    } else {
      while (r > 0 && board[r - 1][c] !== null) r--;
    }

    const startRow = r;
    const startCol = c;
    let word = "";
    let wordScore = 0;
    let wordMultiplier = 1;

    while (r < 15 && c < 15 && board[r][c] !== null) {
      const tile = board[r][c]!;
      let letterScore = tile.score;
      const posKey = `${r},${c}`;

      if (newTilePositions.has(posKey)) {
        const premium = premiumMap[r][c];
        if (premium === "DL") letterScore *= 2;
        else if (premium === "TL") letterScore *= 3;
        else if (premium === "DW") wordMultiplier *= 2;
        else if (premium === "TW") wordMultiplier *= 3;
      }

      word += tile.letter;
      wordScore += letterScore;

      if (horizontal) c++;
      else r++;
    }

    if (word.length < 2) return null;
    return { word, score: wordScore * wordMultiplier, startRow, startCol };
  }

  exchangeTiles(
    gameId: string,
    userId: string,
    tileIndices: number[],
  ): ScrabbleMoveResult {
    const state = this.getState(gameId);
    if (!state) return { success: false, error: "Game not found" };
    if (state.phase !== "playing")
      return { success: false, error: "Game has ended" };
    if (state.currentTurn !== userId)
      return { success: false, error: "Not your turn" };

    if (state.tileBag.length < 7) {
      return { success: false, error: "Not enough tiles in bag to exchange (need 7+)" };
    }

    const rack = state.playerTiles[userId];
    if (new Set(tileIndices).size !== tileIndices.length) {
      return { success: false, error: "Duplicate tile indices are not allowed" };
    }

    const sortedIndices = [...tileIndices].sort((a, b) => b - a);

    for (const idx of sortedIndices) {
      if (idx < 0 || idx >= rack.length) {
        return { success: false, error: `Invalid tile index: ${idx}` };
      }
    }

    const returned: ScrabbleTile[] = [];
    for (const idx of sortedIndices) {
      returned.push(...rack.splice(idx, 1));
    }

    const drawn = this.drawTiles(state.tileBag, returned.length);
    state.playerTiles[userId] = [...rack, ...drawn];

    state.tileBag.push(...returned);
    for (let i = state.tileBag.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [state.tileBag[i], state.tileBag[j]] = [state.tileBag[j], state.tileBag[i]];
    }

    state.consecutivePasses = 0;
    state.currentTurn =
      userId === state.player1 ? state.player2 : state.player1;

    const ended = state.consecutivePasses >= 4;
    if (ended) this.finalizeGame(state);

    this.setState(gameId, state);
    return {
      success: true,
      state,
      gameEnded: ended,
      winner: ended ? state.winner : undefined,
      isDraw: ended ? state.isDraw : undefined,
    };
  }

  passTurn(gameId: string, userId: string): ScrabbleMoveResult {
    const state = this.getState(gameId);
    if (!state) return { success: false, error: "Game not found" };
    if (state.phase !== "playing")
      return { success: false, error: "Game has ended" };
    if (state.currentTurn !== userId)
      return { success: false, error: "Not your turn" };

    state.consecutivePasses++;
    state.currentTurn =
      userId === state.player1 ? state.player2 : state.player1;

    const ended = state.consecutivePasses >= 4;
    if (ended) this.finalizeGame(state);

    this.setState(gameId, state);
    return {
      success: true,
      state,
      gameEnded: ended,
      winner: ended ? state.winner : undefined,
      isDraw: ended ? state.isDraw : undefined,
    };
  }

  private checkGameEnd(state: ScrabbleState): boolean {
    if (state.tileBag.length === 0) {
      const currentPlayerTiles = state.playerTiles[state.currentTurn];
      if (!currentPlayerTiles || currentPlayerTiles.length === 0) {
        this.finalizeGame(state);
        return true;
      }
    }
    return false;
  }

  sanitizeStateForPlayer(
    state: ScrabbleState | undefined,
    userId: string,
  ): Partial<ScrabbleState> | undefined {
    if (!state) return undefined;
    const opponentId = userId === state.player1 ? state.player2 : state.player1;
    return {
      ...state,
      tileBag: [],
      playerTiles: {
        [userId]: state.playerTiles[userId] ?? [],
        [opponentId]: (state.playerTiles[opponentId] ?? []).map(() => ({
          letter: "?",
          score: 0,
          isBlank: false,
        })),
      },
    };
  }

  challenge(
    gameId: string,
    userId: string,
  ): ScrabbleMoveResult {
    const state = this.getState(gameId);
    if (!state) return { success: false, error: "Game not found" };
    if (state.phase !== "playing")
      return { success: false, error: "Game has ended" };

    const lastMove = state.moveHistory[state.moveHistory.length - 1];
    if (!lastMove) return { success: false, error: "No previous move to challenge" };

    const hasInvalid = lastMove.wordsFormed.some(
      (wf) => !this.dictionary.isValidWord(wf.word, 2),
    );

    if (!hasInvalid) {
      state.currentTurn =
        userId === state.player1 ? state.player2 : state.player1;
      this.setState(gameId, state);
      return { success: true, state, error: "Challenge failed - all words are valid" };
    }

    for (const tp of lastMove.placements) {
      state.board[tp.row][tp.col] = null;
    }
    state.scores[lastMove.userId] -= lastMove.score;

    const tilesDrawn = lastMove.previousBagLength - state.tileBag.length;
    if (tilesDrawn > 0) {
      const currentRack = state.playerTiles[lastMove.userId];
      const drawnTiles = currentRack.slice(-tilesDrawn);
      state.tileBag.unshift(...drawnTiles);
    }
    state.playerTiles[lastMove.userId] = [...lastMove.previousRack];

    state.currentTurn = lastMove.userId;
    state.moveHistory.pop();

    if (state.moveHistory.length === 0) {
      state.firstMove = true;
    }

    this.setState(gameId, state);
    return { success: true, state };
  }

  private finalizeGame(state: ScrabbleState) {
    state.phase = "ended";

    for (const playerId of [state.player1, state.player2]) {
      const remaining = state.playerTiles[playerId];
      const penalty = remaining.reduce((sum, t) => sum + t.score, 0);
      state.scores[playerId] -= penalty;
    }

    const s1 = state.scores[state.player1];
    const s2 = state.scores[state.player2];
    state.isDraw = s1 === s2;
    state.winner = state.isDraw
      ? null
      : s1 > s2
        ? state.player1
        : state.player2;
  }
}
