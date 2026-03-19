import { Injectable } from "@nestjs/common";
import { DictionaryService } from "../dictionary.service";
import {
  WordleState,
  WordleMoveResult,
  WordlePlayerState,
  LetterFeedback,
  WordleGuess,
} from "./wordle.types";

@Injectable()
export class WordleService {
  private states = new Map<string, WordleState>();

  constructor(private readonly dictionary: DictionaryService) {}

  setState(gameId: string, state: WordleState) {
    this.states.set(gameId, state);
  }

  getState(gameId: string): WordleState | undefined {
    return this.states.get(gameId);
  }

  initializeState(player1Id: string, player2Id: string): WordleState {
    const secretWord = this.dictionary.getRandomFiveLetterWord().toUpperCase();
    const state: WordleState = {
      secretWord,
      players: {
        [player1Id]: { guesses: [], solved: false, solvedAtGuess: null },
        [player2Id]: { guesses: [], solved: false, solvedAtGuess: null },
      },
      maxGuesses: 6,
      startedAt: Date.now(),
      phase: 'playing',
      winner: null,
      isDraw: false,
    };
    return state;
  }

  submitGuess(gameId: string, userId: string, word: string): WordleMoveResult {
    const state = this.getState(gameId);
    if (!state) return { success: false, error: "Game not found" };
    if (state.phase !== 'playing') return { success: false, error: "Game has ended" };

    const playerState = state.players[userId];
    if (!playerState) return { success: false, error: "Player not in this game" };
    if (playerState.solved) return { success: false, error: "You already solved it" };
    if (playerState.guesses.length >= state.maxGuesses) {
      return { success: false, error: "No guesses remaining" };
    }

    const normalized = word.toUpperCase().trim();
    if (normalized.length !== 5) return { success: false, error: "Guess must be 5 letters" };
    if (!/^[A-Z]+$/.test(normalized)) return { success: false, error: "Letters only" };
    if (!this.dictionary.isValidWord(normalized)) {
      return { success: false, error: "Not a valid word" };
    }
    if (playerState.guesses.some(g => g.word === normalized)) {
      return { success: false, error: "You already guessed this word" };
    }

    const feedback = this.computeFeedback(state.secretWord, normalized);
    const guess: WordleGuess = { word: normalized, feedback };
    playerState.guesses.push(guess);

    if (normalized === state.secretWord) {
      playerState.solved = true;
      playerState.solvedAtGuess = playerState.guesses.length;
    }

    const result = this.checkGameEnd(state);
    this.setState(gameId, state);

    return {
      success: true,
      state,
      playerState,
      gameEnded: result.gameEnded,
      winner: result.winner,
      isDraw: result.isDraw,
    };
  }

  private computeFeedback(secret: string, guess: string): LetterFeedback[] {
    const feedback: LetterFeedback[] = new Array(5).fill('gray');
    const available: Record<string, number> = {};

    for (const ch of secret) {
      available[ch] = (available[ch] || 0) + 1;
    }

    for (let i = 0; i < 5; i++) {
      if (guess[i] === secret[i]) {
        feedback[i] = 'green';
        available[guess[i]]--;
      }
    }

    for (let i = 0; i < 5; i++) {
      if (feedback[i] === 'green') continue;
      if (available[guess[i]] && available[guess[i]] > 0) {
        feedback[i] = 'yellow';
        available[guess[i]]--;
      }
    }

    return feedback;
  }

  private checkGameEnd(state: WordleState): {
    gameEnded: boolean;
    winner: string | null;
    isDraw: boolean;
  } {
    const playerIds = Object.keys(state.players);
    const allFinished = playerIds.every(
      (id) =>
        state.players[id].solved ||
        state.players[id].guesses.length >= state.maxGuesses,
    );

    if (!allFinished) return { gameEnded: false, winner: null, isDraw: false };

    state.phase = 'ended';
    const [p1, p2] = playerIds;
    const s1 = state.players[p1];
    const s2 = state.players[p2];

    if (s1.solved && !s2.solved) {
      state.winner = p1;
      return { gameEnded: true, winner: p1, isDraw: false };
    }
    if (s2.solved && !s1.solved) {
      state.winner = p2;
      return { gameEnded: true, winner: p2, isDraw: false };
    }
    if (!s1.solved && !s2.solved) {
      state.isDraw = true;
      return { gameEnded: true, winner: null, isDraw: true };
    }

    if (s1.solvedAtGuess! < s2.solvedAtGuess!) {
      state.winner = p1;
      return { gameEnded: true, winner: p1, isDraw: false };
    }
    if (s2.solvedAtGuess! < s1.solvedAtGuess!) {
      state.winner = p2;
      return { gameEnded: true, winner: p2, isDraw: false };
    }

    state.isDraw = true;
    return { gameEnded: true, winner: null, isDraw: true };
  }

  sanitizeStateForPlayer(
    state: WordleState,
    userId: string,
  ): Partial<WordleState> & { opponentGuessCount?: number } {
    const playerIds = Object.keys(state.players);
    const opponentId = playerIds.find((id) => id !== userId)!;

    const sanitized: any = {
      ...state,
      secretWord: state.phase === 'ended' ? state.secretWord : undefined,
      players: {
        [userId]: state.players[userId],
      },
    };

    if (state.phase === 'ended') {
      sanitized.players[opponentId] = state.players[opponentId];
    } else {
      sanitized.opponentGuessCount = state.players[opponentId]?.guesses.length ?? 0;
    }

    return sanitized;
  }
}
