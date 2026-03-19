import { Injectable } from "@nestjs/common";
import { DictionaryService } from "../dictionary.service";
import { JottoState, JottoMoveResult, JottoGuess } from "./jotto.types";

@Injectable()
export class JottoService {
  private states = new Map<string, JottoState>();

  constructor(private readonly dictionary: DictionaryService) {}

  setState(gameId: string, state: JottoState) {
    this.states.set(gameId, state);
  }

  getState(gameId: string): JottoState | undefined {
    return this.states.get(gameId);
  }

  initializeState(player1Id: string, player2Id: string): JottoState {
    const state: JottoState = {
      player1: player1Id,
      player2: player2Id,
      phase: 'picking',
      secretWords: {},
      pickedCount: 0,
      guessHistory: { [player1Id]: [], [player2Id]: [] },
      currentTurn: '',
      winner: null,
    };
    return state;
  }

  pickWord(gameId: string, userId: string, word: string): JottoMoveResult {
    const state = this.getState(gameId);
    if (!state) return { success: false, error: "Game not found" };
    if (state.phase !== 'picking') return { success: false, error: "Not in picking phase" };
    if (state.secretWords[userId]) return { success: false, error: "You already picked a word" };

    const normalized = word.toUpperCase().trim();
    if (normalized.length !== 5) return { success: false, error: "Word must be exactly 5 letters" };
    if (!this.dictionary.hasNoRepeatedLetters(normalized)) {
      return { success: false, error: "Word must have no repeated letters" };
    }
    if (!this.dictionary.isValidWord(normalized)) {
      return { success: false, error: "Not a valid dictionary word" };
    }

    state.secretWords[userId] = normalized;
    state.pickedCount++;

    if (state.pickedCount >= 2) {
      state.phase = 'playing';
      state.currentTurn = Math.random() < 0.5 ? state.player1 : state.player2;
    }

    this.setState(gameId, state);
    return { success: true, state };
  }

  submitGuess(gameId: string, userId: string, word: string): JottoMoveResult {
    const state = this.getState(gameId);
    if (!state) return { success: false, error: "Game not found" };
    if (state.phase !== 'playing') return { success: false, error: "Not in playing phase" };
    if (userId !== state.currentTurn) return { success: false, error: "Not your turn" };

    const normalized = word.toUpperCase().trim();
    if (normalized.length !== 5) return { success: false, error: "Guess must be 5 letters" };
    if (!this.dictionary.isValidWord(normalized)) {
      return { success: false, error: "Not a valid dictionary word" };
    }

    if (state.guessHistory[userId].some((g) => g.word === normalized)) {
      return { success: false, error: "You already guessed this word" };
    }

    const opponentId = this.getOpponent(state, userId);
    const opponentSecret = state.secretWords[opponentId];
    const matchCount = this.dictionary.countMatchingLetters(normalized, opponentSecret);

    const guess: JottoGuess = {
      word: normalized,
      matchCount,
      timestamp: Date.now(),
    };
    state.guessHistory[userId].push(guess);

    const maxGuesses = 20;
    if (
      state.guessHistory[state.player1].length >= maxGuesses &&
      state.guessHistory[state.player2].length >= maxGuesses
    ) {
      state.phase = 'ended';
      state.winner = null;
      this.setState(gameId, state);
      return { success: true, state, gameEnded: true, winner: null, isDraw: true };
    }

    if (normalized === opponentSecret) {
      state.phase = 'ended';
      state.winner = userId;
      this.setState(gameId, state);
      return { success: true, state, gameEnded: true, winner: userId };
    }

    state.currentTurn = opponentId;
    this.setState(gameId, state);
    return { success: true, state };
  }

  sanitizeStateForPlayer(
    state: JottoState,
    userId: string,
  ): Partial<JottoState> {
    const opponentId = this.getOpponent(state, userId);
    return {
      ...state,
      secretWords: {
        [userId]: state.secretWords[userId],
        ...(state.phase === 'ended'
          ? { [opponentId]: state.secretWords[opponentId] }
          : {}),
      },
    };
  }

  private getOpponent(state: JottoState, userId: string): string {
    return userId === state.player1 ? state.player2 : state.player1;
  }
}
