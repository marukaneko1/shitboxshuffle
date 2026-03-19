import { Injectable } from "@nestjs/common";
import { DictionaryService } from "../dictionary.service";
import {
  LetterBoxedState,
  LetterBoxedMoveResult,
  LetterBoxedPlayerState,
} from "./letter-boxed.types";

@Injectable()
export class LetterBoxedService {
  private states = new Map<string, LetterBoxedState>();

  constructor(private readonly dictionary: DictionaryService) {}

  setState(gameId: string, state: LetterBoxedState) {
    this.states.set(gameId, state);
  }

  getState(gameId: string): LetterBoxedState | undefined {
    return this.states.get(gameId);
  }

  initializeState(player1Id: string, player2Id: string): LetterBoxedState {
    const sides = this.dictionary.generateLetterBoxedSides();
    const allLetters = sides.flat().map((l) => l.toUpperCase());

    const makePlayer = (): LetterBoxedPlayerState => ({
      words: [],
      lettersUsed: [],
      lastLetter: null,
      solved: false,
    });

    return {
      sides: sides.map((s) => s.map((l) => l.toUpperCase())),
      allLetters,
      players: {
        [player1Id]: makePlayer(),
        [player2Id]: makePlayer(),
      },
      player1: player1Id,
      player2: player2Id,
      phase: "playing",
      startedAt: Date.now(),
      winner: null,
      isDraw: false,
    };
  }

  getSideForLetter(
    sides: string[][],
    letter: string,
  ): number {
    const upper = letter.toUpperCase();
    for (let i = 0; i < sides.length; i++) {
      if (sides[i].includes(upper)) return i;
    }
    return -1;
  }

  submitWord(
    gameId: string,
    userId: string,
    word: string,
  ): LetterBoxedMoveResult {
    const state = this.getState(gameId);
    if (!state) return { success: false, error: "Game not found" };
    if (state.phase !== "playing")
      return { success: false, error: "Game has ended" };

    const player = state.players[userId];
    if (!player) return { success: false, error: "Player not in this game" };
    if (player.solved) return { success: false, error: "You already solved the puzzle" };

    const normalized = word.toUpperCase().trim();

    if (player.words.includes(normalized)) {
      return { success: false, error: "You already used this word" };
    }

    if (normalized.length < 3) {
      return { success: false, error: "Word must be at least 3 letters" };
    }

    if (!this.dictionary.isValidWord(normalized, 3)) {
      return { success: false, error: "Not a valid dictionary word" };
    }

    const letterSet = new Set(state.allLetters);
    for (const ch of normalized) {
      if (!letterSet.has(ch)) {
        return {
          success: false,
          error: `Letter '${ch}' is not available on any side`,
        };
      }
    }

    for (let i = 0; i < normalized.length - 1; i++) {
      const currentSide = this.getSideForLetter(state.sides, normalized[i]);
      const nextSide = this.getSideForLetter(state.sides, normalized[i + 1]);
      if (currentSide === nextSide) {
        return {
          success: false,
          error: `Consecutive letters '${normalized[i]}' and '${normalized[i + 1]}' are on the same side`,
        };
      }
    }

    if (player.lastLetter) {
      if (normalized[0] !== player.lastLetter) {
        return {
          success: false,
          error: `Word must start with '${player.lastLetter}' (last letter of your previous word)`,
        };
      }
    }

    player.words.push(normalized);
    player.lastLetter = normalized[normalized.length - 1];

    for (const ch of normalized) {
      if (!player.lettersUsed.includes(ch)) {
        player.lettersUsed.push(ch);
      }
    }

    if (state.allLetters.every((l) => player.lettersUsed.includes(l))) {
      player.solved = true;
    }

    this.setState(gameId, state);

    const p1 = state.players[state.player1];
    const p2 = state.players[state.player2];

    if (p1.solved && p2.solved) {
      state.phase = "ended";
      if (p1.words.length < p2.words.length) {
        state.winner = state.player1;
      } else if (p2.words.length < p1.words.length) {
        state.winner = state.player2;
      } else {
        state.isDraw = true;
        state.winner = null;
      }
      this.setState(gameId, state);
      return {
        success: true,
        state,
        gameEnded: true,
        winner: state.winner,
        isDraw: state.isDraw,
      };
    }

    if (player.solved) {
      return { success: true, state };
    }

    return { success: true, state };
  }

  sanitizeStateForPlayer(state: LetterBoxedState, _userId: string): LetterBoxedState {
    return { ...state };
  }

  endGame(gameId: string): LetterBoxedMoveResult {
    const state = this.getState(gameId);
    if (!state) return { success: false, error: "Game not found" };

    state.phase = "ended";

    const p1 = state.players[state.player1];
    const p2 = state.players[state.player2];

    if (p1.solved && !p2.solved) {
      state.winner = state.player1;
    } else if (p2.solved && !p1.solved) {
      state.winner = state.player2;
    } else if (p1.solved && p2.solved) {
      if (p1.words.length < p2.words.length) {
        state.winner = state.player1;
      } else if (p2.words.length < p1.words.length) {
        state.winner = state.player2;
      } else {
        state.isDraw = true;
      }
    } else {
      if (p1.lettersUsed.length > p2.lettersUsed.length) {
        state.winner = state.player1;
      } else if (p2.lettersUsed.length > p1.lettersUsed.length) {
        state.winner = state.player2;
      } else {
        state.isDraw = true;
      }
    }

    this.setState(gameId, state);
    return {
      success: true,
      state,
      gameEnded: true,
      winner: state.winner,
      isDraw: state.isDraw,
    };
  }
}
