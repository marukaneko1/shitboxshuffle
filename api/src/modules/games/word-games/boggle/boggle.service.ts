import { Injectable } from "@nestjs/common";
import { DictionaryService } from "../dictionary.service";
import { BoggleState, BoggleMoveResult } from "./boggle.types";

@Injectable()
export class BoggleService {
  private states = new Map<string, BoggleState>();

  constructor(private readonly dictionary: DictionaryService) {}

  setState(gameId: string, state: BoggleState) {
    this.states.set(gameId, state);
  }

  getState(gameId: string): BoggleState | undefined {
    return this.states.get(gameId);
  }

  initializeState(player1Id: string, player2Id: string): BoggleState {
    const grid = this.dictionary.generateBoggleGrid();

    return {
      grid,
      player1: player1Id,
      player2: player2Id,
      foundWords: { [player1Id]: [], [player2Id]: [] },
      phase: "playing",
      startedAt: Date.now(),
      timeLimit: 180000,
      scores: { [player1Id]: 0, [player2Id]: 0 },
      uniqueWords: { [player1Id]: [], [player2Id]: [] },
      sharedWords: [],
    };
  }

  private scoreWord(word: string): number {
    const len = word.length;
    if (len <= 4) return 1;
    if (len === 5) return 2;
    if (len === 6) return 3;
    if (len === 7) return 5;
    return 11;
  }

  submitWord(
    gameId: string,
    userId: string,
    word: string,
  ): BoggleMoveResult {
    const state = this.getState(gameId);
    if (!state) return { success: false, error: "Game not found" };
    if (state.phase !== "playing")
      return { success: false, error: "Game is not in playing phase" };

    if (Date.now() - state.startedAt > state.timeLimit) {
      return this.endRound(gameId);
    }

    if (!state.foundWords[userId]) {
      return { success: false, error: "Player not in this game" };
    }

    const normalized = word.toUpperCase().trim();

    if (normalized.length < 3) {
      return { success: false, error: "Word must be at least 3 letters" };
    }

    if (!this.dictionary.isValidWord(normalized, 3)) {
      return { success: false, error: "Not a valid dictionary word" };
    }

    if (!this.dictionary.isValidBogglePath(state.grid, normalized)) {
      return { success: false, error: "Word cannot be traced on the grid" };
    }

    if (state.foundWords[userId].includes(normalized)) {
      return { success: false, error: "You already found this word" };
    }

    state.foundWords[userId].push(normalized);
    this.setState(gameId, state);

    const wordScore = this.scoreWord(normalized);
    return { success: true, state, wordScore };
  }

  endRound(gameId: string): BoggleMoveResult {
    const state = this.getState(gameId);
    if (!state) return { success: false, error: "Game not found" };

    state.phase = "scoring";

    const p1Words = new Set(state.foundWords[state.player1]);
    const p2Words = new Set(state.foundWords[state.player2]);

    const shared: string[] = [];
    for (const w of p1Words) {
      if (p2Words.has(w)) shared.push(w);
    }
    state.sharedWords = shared;

    const sharedSet = new Set(shared);

    const p1Unique = [...p1Words].filter((w) => !sharedSet.has(w));
    const p2Unique = [...p2Words].filter((w) => !sharedSet.has(w));

    state.uniqueWords = {
      [state.player1]: p1Unique,
      [state.player2]: p2Unique,
    };

    state.scores[state.player1] = p1Unique.reduce(
      (sum, w) => sum + this.scoreWord(w),
      0,
    );
    state.scores[state.player2] = p2Unique.reduce(
      (sum, w) => sum + this.scoreWord(w),
      0,
    );

    state.phase = "ended";

    const s1 = state.scores[state.player1];
    const s2 = state.scores[state.player2];
    const isDraw = s1 === s2;
    const winner = isDraw ? null : s1 > s2 ? state.player1 : state.player2;

    state.winner = winner;
    state.isDraw = isDraw;
    this.setState(gameId, state);

    return { success: true, state, gameEnded: true, winner, isDraw };
  }

  sanitizeStateForPlayer(
    state: BoggleState,
    userId: string,
  ): Partial<BoggleState> & { opponentWordCount?: number } {
    if (state.phase !== "playing") return { ...state };

    const opponentId =
      userId === state.player1 ? state.player2 : state.player1;

    return {
      grid: state.grid,
      player1: state.player1,
      player2: state.player2,
      foundWords: { [userId]: state.foundWords[userId] },
      phase: state.phase,
      startedAt: state.startedAt,
      timeLimit: state.timeLimit,
      scores: { [userId]: 0, [opponentId]: 0 },
      uniqueWords: {},
      sharedWords: [],
      opponentWordCount: state.foundWords[opponentId]?.length ?? 0,
    };
  }
}
