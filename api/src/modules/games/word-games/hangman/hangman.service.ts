import { Injectable } from "@nestjs/common";
import { DictionaryService } from "../dictionary.service";
import { HangmanState, HangmanMoveResult, HangmanRound } from "./hangman.types";

@Injectable()
export class HangmanService {
  private states = new Map<string, HangmanState>();

  constructor(private readonly dictionary: DictionaryService) {}

  setState(gameId: string, state: HangmanState) {
    this.states.set(gameId, state);
  }

  getState(gameId: string): HangmanState | undefined {
    return this.states.get(gameId);
  }

  initializeState(player1Id: string, player2Id: string): HangmanState {
    const state: HangmanState = {
      player1: player1Id,
      player2: player2Id,
      phase: 'picking',
      currentRound: 1,
      rounds: [],
      scores: { [player1Id]: 0, [player2Id]: 0 },
      currentHostId: player1Id,
      currentGuesserId: player2Id,
      secretWord: null,
      guessedLetters: [],
      wrongLetters: [],
      maxWrong: 6,
      revealedWord: [],
    };
    return state;
  }

  pickWord(gameId: string, userId: string, word: string): HangmanMoveResult {
    const state = this.getState(gameId);
    if (!state) return { success: false, error: "Game not found" };
    if (state.phase !== 'picking') return { success: false, error: "Not in picking phase" };
    if (userId !== state.currentHostId) return { success: false, error: "Only the host can pick a word" };

    const normalized = word.toUpperCase().trim();
    if (normalized.length < 4 || normalized.length > 12) {
      return { success: false, error: "Word must be 4-12 letters" };
    }
    if (!this.dictionary.isValidWord(normalized)) {
      return { success: false, error: "Not a valid dictionary word" };
    }

    state.secretWord = normalized;
    state.guessedLetters = [];
    state.wrongLetters = [];
    state.revealedWord = normalized.split("").map(() => "_");
    state.phase = 'guessing';
    this.setState(gameId, state);

    return { success: true, state };
  }

  guessLetter(gameId: string, userId: string, letter: string): HangmanMoveResult {
    const state = this.getState(gameId);
    if (!state) return { success: false, error: "Game not found" };
    if (state.phase !== 'guessing') return { success: false, error: "Not in guessing phase" };
    if (userId !== state.currentGuesserId) return { success: false, error: "Not your turn to guess" };

    const normalizedLetter = letter.toUpperCase().trim();
    if (normalizedLetter.length !== 1 || !/^[A-Z]$/.test(normalizedLetter)) {
      return { success: false, error: "Must guess a single letter A-Z" };
    }
    if (state.guessedLetters.includes(normalizedLetter)) {
      return { success: false, error: "Letter already guessed" };
    }

    state.guessedLetters.push(normalizedLetter);

    if (state.secretWord!.includes(normalizedLetter)) {
      for (let i = 0; i < state.secretWord!.length; i++) {
        if (state.secretWord![i] === normalizedLetter) {
          state.revealedWord[i] = normalizedLetter;
        }
      }
    } else {
      state.wrongLetters.push(normalizedLetter);
    }

    return this.checkRoundEnd(gameId, state);
  }

  guessWord(gameId: string, userId: string, word: string): HangmanMoveResult {
    const state = this.getState(gameId);
    if (!state) return { success: false, error: "Game not found" };
    if (state.phase !== 'guessing') return { success: false, error: "Not in guessing phase" };
    if (userId !== state.currentGuesserId) return { success: false, error: "Not your turn to guess" };

    const normalized = word.toUpperCase().trim();

    if (!/^[A-Z]+$/.test(normalized)) {
      return { success: false, error: "Word must only contain letters A-Z" };
    }
    if (normalized.length !== state.secretWord!.length) {
      return { success: false, error: `Word must be ${state.secretWord!.length} letters long` };
    }

    if (normalized === state.secretWord) {
      state.revealedWord = state.secretWord!.split("");
      return this.finishRound(gameId, state, true);
    }

    state.wrongLetters.push(`[${normalized}]`);
    return this.checkRoundEnd(gameId, state);
  }

  sanitizeStateForPlayer(state: HangmanState, userId: string): Partial<HangmanState> {
    if (state.phase === 'guessing' && userId === state.currentGuesserId) {
      return {
        ...state,
        secretWord: null,
      };
    }
    return { ...state };
  }

  private checkRoundEnd(gameId: string, state: HangmanState): HangmanMoveResult {
    const solved = !state.revealedWord.includes("_");
    const failed = state.wrongLetters.length >= state.maxWrong;

    if (solved || failed) {
      return this.finishRound(gameId, state, solved);
    }

    this.setState(gameId, state);
    return { success: true, state };
  }

  private finishRound(gameId: string, state: HangmanState, solved: boolean): HangmanMoveResult {
    const round: HangmanRound = {
      hostId: state.currentHostId,
      guesserId: state.currentGuesserId,
      secretWord: state.secretWord!,
      guessedLetters: [...state.guessedLetters],
      wrongLetters: [...state.wrongLetters],
      maxWrong: state.maxWrong,
      solved,
      failed: !solved,
    };
    state.rounds.push(round);

    if (solved) {
      const points = state.maxWrong - state.wrongLetters.length;
      state.scores[state.currentGuesserId] += points;
    }

    if (state.currentRound >= 2) {
      state.phase = 'ended';
      this.setState(gameId, state);

      const s1 = state.scores[state.player1];
      const s2 = state.scores[state.player2];
      const isDraw = s1 === s2;
      const winner = isDraw ? null : s1 > s2 ? state.player1 : state.player2;

      return { success: true, state, gameEnded: true, winner, isDraw };
    }

    state.currentRound = 2;
    const prevHost = state.currentHostId;
    state.currentHostId = state.currentGuesserId;
    state.currentGuesserId = prevHost;
    state.secretWord = null;
    state.guessedLetters = [];
    state.wrongLetters = [];
    state.revealedWord = [];
    state.phase = 'picking';
    this.setState(gameId, state);

    return { success: true, state };
  }
}
