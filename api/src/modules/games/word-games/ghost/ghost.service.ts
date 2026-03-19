import { Injectable } from "@nestjs/common";
import { DictionaryService } from "../dictionary.service";
import { GhostState, GhostMoveResult, GhostRoundResult } from "./ghost.types";

@Injectable()
export class GhostService {
  private states = new Map<string, GhostState>();

  constructor(private readonly dictionary: DictionaryService) {}

  setState(gameId: string, state: GhostState) {
    this.states.set(gameId, state);
  }

  getState(gameId: string): GhostState | undefined {
    return this.states.get(gameId);
  }

  initializeState(player1Id: string, player2Id: string): GhostState {
    const starter = Math.random() < 0.5 ? player1Id : player2Id;
    const state: GhostState = {
      player1: player1Id,
      player2: player2Id,
      currentFragment: "",
      currentTurn: starter,
      phase: 'playing',
      ghostLetters: { [player1Id]: 0, [player2Id]: 0 },
      roundHistory: [],
      minWordLength: 4,
    };
    return state;
  }

  addLetter(gameId: string, userId: string, letter: string): GhostMoveResult {
    const state = this.getState(gameId);
    if (!state) return { success: false, error: "Game not found" };
    if (state.phase !== 'playing') return { success: false, error: "Not in playing phase" };
    if (userId !== state.currentTurn) return { success: false, error: "Not your turn" };

    const normalizedLetter = letter.toUpperCase().trim();
    if (normalizedLetter.length !== 1 || !/^[A-Z]$/.test(normalizedLetter)) {
      return { success: false, error: "Must add a single letter A-Z" };
    }

    const newFragment = state.currentFragment + normalizedLetter;

    state.currentFragment = newFragment;

    if (newFragment.length >= state.minWordLength && this.dictionary.isValidWord(newFragment)) {
      return this.endRound(gameId, state, userId, 'completed_word', newFragment);
    }

    state.currentTurn = this.getOpponent(state, userId);
    this.setState(gameId, state);

    return { success: true, state };
  }

  challenge(gameId: string, userId: string): GhostMoveResult {
    const state = this.getState(gameId);
    if (!state) return { success: false, error: "Game not found" };
    if (state.phase !== 'playing') return { success: false, error: "Not in playing phase" };
    if (userId !== state.currentTurn) return { success: false, error: "Not your turn" };
    if (state.currentFragment.length === 0) {
      return { success: false, error: "Cannot challenge on empty fragment" };
    }

    state.challengerId = userId;
    state.phase = 'responding';
    state.currentTurn = this.getOpponent(state, userId);
    this.setState(gameId, state);

    return { success: true, state };
  }

  respondToChallenge(gameId: string, userId: string, word: string): GhostMoveResult {
    const state = this.getState(gameId);
    if (!state) return { success: false, error: "Game not found" };
    if (state.phase !== 'responding') return { success: false, error: "No pending challenge" };
    if (userId === state.challengerId) return { success: false, error: "You issued the challenge" };

    const normalized = word.toUpperCase().trim();
    const validResponse =
      normalized.startsWith(state.currentFragment) &&
      normalized.length >= state.minWordLength &&
      this.dictionary.isValidWord(normalized);

    if (validResponse) {
      return this.endRound(
        gameId, state, state.challengerId!, 'invalid_challenge',
        state.currentFragment, normalized,
      );
    }

    return this.endRound(
      gameId, state, userId, 'failed_challenge', state.currentFragment,
    );
  }

  private endRound(
    gameId: string,
    state: GhostState,
    loserId: string,
    reason: GhostRoundResult['reason'],
    fragment: string,
    word?: string,
  ): GhostMoveResult {
    state.ghostLetters[loserId]++;
    state.roundHistory.push({ loserId, reason, fragment, word });

    if (state.ghostLetters[loserId] >= 5) {
      state.phase = 'ended';
      this.setState(gameId, state);
      const winner = this.getOpponent(state, loserId);
      return { success: true, state, gameEnded: true, winner };
    }

    state.currentFragment = "";
    state.currentTurn = loserId;
    state.phase = 'playing';
    state.challengerId = undefined;
    this.setState(gameId, state);

    return { success: true, state };
  }

  private getOpponent(state: GhostState, userId: string): string {
    return userId === state.player1 ? state.player2 : state.player1;
  }
}
