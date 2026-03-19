import { Injectable } from "@nestjs/common";
import { DictionaryService } from "../dictionary.service";
import { SpellingBeeState, SpellingBeeMoveResult } from "./spelling-bee.types";

@Injectable()
export class SpellingBeeService {
  private states = new Map<string, SpellingBeeState>();

  constructor(private readonly dictionary: DictionaryService) {}

  setState(gameId: string, state: SpellingBeeState) {
    this.states.set(gameId, state);
  }

  getState(gameId: string): SpellingBeeState | undefined {
    return this.states.get(gameId);
  }

  initializeState(player1Id: string, player2Id: string): SpellingBeeState {
    const puzzle = this.dictionary.generateSpellingBeeLetters();
    const { letters, centerLetter, validWords } = puzzle;

    const letterSet = new Set(letters.map((l) => l.toUpperCase()));
    const pangrams = validWords.filter((w) => {
      const wordLetters = new Set(w.toUpperCase().split(""));
      return [...letterSet].every((l) => wordLetters.has(l));
    });

    const maxScore = validWords.reduce((total, w) => {
      let score = w.length === 4 ? 1 : w.length;
      const upperWord = w.toUpperCase();
      const isPangram = [...letterSet].every((l) =>
        upperWord.includes(l),
      );
      if (isPangram) score += 7;
      return total + score;
    }, 0);

    const state: SpellingBeeState = {
      letters: letters.map((l) => l.toUpperCase()),
      centerLetter: centerLetter.toUpperCase(),
      validWords: validWords.map((w) => w.toUpperCase()),
      pangrams: pangrams.map((w) => w.toUpperCase()),
      foundWords: { [player1Id]: [], [player2Id]: [] },
      scores: { [player1Id]: 0, [player2Id]: 0 },
      player1: player1Id,
      player2: player2Id,
      maxScore,
      phase: 'playing',
      startedAt: Date.now(),
      timeLimit: 300000,
    };
    return state;
  }

  submitWord(gameId: string, userId: string, word: string): SpellingBeeMoveResult {
    const state = this.getState(gameId);
    if (!state) return { success: false, error: "Game not found" };
    if (state.phase !== 'playing') return { success: false, error: "Game has ended" };

    if (Date.now() - state.startedAt >= state.timeLimit) {
      return this.endGame(gameId);
    }

    const normalized = word.toUpperCase().trim();

    if (normalized.length < 4) {
      return { success: false, error: "Word must be at least 4 letters" };
    }

    if (!normalized.includes(state.centerLetter)) {
      return { success: false, error: "Word must include the center letter" };
    }

    const letterSet = new Set(state.letters);
    for (const ch of normalized) {
      if (!letterSet.has(ch)) {
        return { success: false, error: `Letter '${ch}' is not in the available letters` };
      }
    }

    if (!state.validWords.includes(normalized)) {
      return { success: false, error: "Not a valid word for this puzzle" };
    }

    if (state.foundWords[userId].includes(normalized)) {
      return { success: false, error: "You already found this word" };
    }

    state.foundWords[userId].push(normalized);

    const isPangram = state.pangrams.includes(normalized);
    let wordScore = normalized.length === 4 ? 1 : normalized.length;
    if (isPangram) wordScore += 7;

    state.scores[userId] += wordScore;
    this.setState(gameId, state);

    return { success: true, state, wordScore, isPangram };
  }

  endGame(gameId: string): SpellingBeeMoveResult {
    const state = this.getState(gameId);
    if (!state) return { success: false, error: "Game not found" };

    if (state.phase === 'ended') {
      return { success: false, error: "Game already ended" };
    }

    state.phase = 'ended';

    const s1 = state.scores[state.player1];
    const s2 = state.scores[state.player2];
    const isDraw = s1 === s2;
    const winner = isDraw ? null : s1 > s2 ? state.player1 : state.player2;

    this.setState(gameId, state);
    return { success: true, state, gameEnded: true, winner, isDraw };
  }

  sanitizeStateForPlayer(
    state: SpellingBeeState,
    userId: string,
  ): Partial<SpellingBeeState> & { opponentScore?: number } {
    const opponentId = userId === state.player1 ? state.player2 : state.player1;

    const sanitized: any = {
      ...state,
      foundWords: {
        [userId]: state.foundWords[userId],
      },
      validWords: state.phase === 'ended' ? state.validWords : undefined,
    };

    if (state.phase === 'ended') {
      sanitized.foundWords[opponentId] = state.foundWords[opponentId];
    } else {
      sanitized.opponentScore = state.scores[opponentId];
    }

    return sanitized;
  }
}
