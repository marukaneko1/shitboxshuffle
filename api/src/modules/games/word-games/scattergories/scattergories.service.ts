import { Injectable } from "@nestjs/common";
import { DictionaryService } from "../dictionary.service";
import {
  ScattergoriesState,
  ScattergoriesMoveResult,
  ScattergoriesRound,
} from "./scattergories.types";

@Injectable()
export class ScattergoriesService {
  private states = new Map<string, ScattergoriesState>();

  constructor(private readonly dictionary: DictionaryService) {}

  setState(gameId: string, state: ScattergoriesState) {
    this.states.set(gameId, state);
  }

  getState(gameId: string): ScattergoriesState | undefined {
    return this.states.get(gameId);
  }

  private createRound(): ScattergoriesRound {
    return {
      categories: this.dictionary.getRandomCategories(12),
      letter: this.dictionary.getRandomLetter(),
      answers: {},
      submitted: [],
      scores: {},
    };
  }

  initializeState(
    player1Id: string,
    player2Id: string,
  ): ScattergoriesState {
    const firstRound = this.createRound();

    return {
      player1: player1Id,
      player2: player2Id,
      currentRound: 0,
      totalRounds: 3,
      rounds: [firstRound],
      totalScores: { [player1Id]: 0, [player2Id]: 0 },
      phase: "playing",
      startedAt: Date.now(),
      timeLimit: 180000,
      winner: null,
      isDraw: false,
    };
  }

  submitAnswers(
    gameId: string,
    userId: string,
    answers: Record<string, string>,
  ): ScattergoriesMoveResult {
    const state = this.getState(gameId);
    if (!state) return { success: false, error: "Game not found" };
    if (state.phase !== "playing")
      return { success: false, error: "Not in playing phase" };

    if (userId !== state.player1 && userId !== state.player2) {
      return { success: false, error: "Player not in this game" };
    }

    const round = state.rounds[state.currentRound];
    if (!round) return { success: false, error: "Invalid round" };

    if (Date.now() - state.startedAt >= state.timeLimit) {
      for (const pid of [state.player1, state.player2]) {
        if (!round.submitted.includes(pid)) {
          round.answers[pid] = {};
          for (const category of round.categories) {
            round.answers[pid][category] = "";
          }
          round.submitted.push(pid);
        }
      }
      state.phase = "reviewing";
      this.setState(gameId, state);
      return { success: true, state };
    }

    if (round.submitted.includes(userId)) {
      return { success: false, error: "You already submitted answers this round" };
    }

    round.answers[userId] = {};
    for (const category of round.categories) {
      const answer = answers[category]?.trim() ?? "";
      round.answers[userId][category] = answer;
    }

    round.submitted.push(userId);

    if (
      round.submitted.includes(state.player1) &&
      round.submitted.includes(state.player2)
    ) {
      state.phase = "reviewing";
    }

    this.setState(gameId, state);
    return { success: true, state };
  }

  scoreRound(gameId: string): ScattergoriesMoveResult {
    const state = this.getState(gameId);
    if (!state) return { success: false, error: "Game not found" };
    if (state.phase !== "reviewing")
      return { success: false, error: "Not in reviewing phase" };

    const round = state.rounds[state.currentRound];
    const letter = round.letter.toUpperCase();

    round.scores[state.player1] = 0;
    round.scores[state.player2] = 0;

    for (const category of round.categories) {
      const a1 = (round.answers[state.player1]?.[category] ?? "").trim();
      const a2 = (round.answers[state.player2]?.[category] ?? "").trim();

      const a1Upper = a1.toUpperCase();
      const a2Upper = a2.toUpperCase();

      if (a1Upper && a2Upper && a1Upper === a2Upper) {
        continue;
      }

      if (a1Upper && a1Upper[0] === letter) {
        let score = 1;
        const words = a1.split(/\s+/);
        const alliterative = words.filter(
          (w) => w.length > 0 && w[0].toUpperCase() === letter,
        );
        if (alliterative.length > 1) {
          score = alliterative.length;
        }
        round.scores[state.player1] += score;
      }

      if (a2Upper && a2Upper[0] === letter) {
        let score = 1;
        const words = a2.split(/\s+/);
        const alliterative = words.filter(
          (w) => w.length > 0 && w[0].toUpperCase() === letter,
        );
        if (alliterative.length > 1) {
          score = alliterative.length;
        }
        round.scores[state.player2] += score;
      }
    }

    state.totalScores[state.player1] += round.scores[state.player1];
    state.totalScores[state.player2] += round.scores[state.player2];
    state.phase = "scoring";

    this.setState(gameId, state);
    return { success: true, state };
  }

  nextRound(gameId: string): ScattergoriesMoveResult {
    const state = this.getState(gameId);
    if (!state) return { success: false, error: "Game not found" };
    if (state.phase !== "scoring")
      return { success: false, error: "Not in scoring phase" };

    if (state.currentRound >= state.totalRounds - 1) {
      state.phase = "ended";

      const s1 = state.totalScores[state.player1];
      const s2 = state.totalScores[state.player2];
      state.isDraw = s1 === s2;
      state.winner = state.isDraw
        ? null
        : s1 > s2
          ? state.player1
          : state.player2;

      this.setState(gameId, state);
      return {
        success: true,
        state,
        gameEnded: true,
        winner: state.winner,
        isDraw: state.isDraw,
      };
    }

    state.currentRound++;
    state.rounds.push(this.createRound());
    state.phase = "playing";

    this.setState(gameId, state);
    return { success: true, state };
  }

  sanitizeStateForPlayer(
    state: ScattergoriesState,
    userId: string,
  ): Partial<ScattergoriesState> {
    if (state.phase !== "playing") return { ...state };

    const opponentId =
      userId === state.player1 ? state.player2 : state.player1;

    const sanitizedRounds = state.rounds.map((round, idx) => {
      if (idx !== state.currentRound) return round;

      const sanitizedAnswers: Record<string, Record<string, string>> = {};
      if (round.answers[userId]) {
        sanitizedAnswers[userId] = round.answers[userId];
      }
      if (round.answers[opponentId]) {
        sanitizedAnswers[opponentId] = {};
      }

      return { ...round, answers: sanitizedAnswers };
    });

    return { ...state, rounds: sanitizedRounds };
  }
}
