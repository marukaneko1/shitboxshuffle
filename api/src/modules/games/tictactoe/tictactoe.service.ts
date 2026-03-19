import { Injectable, BadRequestException } from "@nestjs/common";
import { PrismaService } from "../../../prisma/prisma.service";
import { GameStatus } from "@prisma/client";
import {
  TicTacToeState,
  TicTacToeMove,
  MoveResult,
  GameEndResult,
  PlayerSymbol,
  CellValue,
  WINNING_COMBINATIONS
} from "./tictactoe.types";

@Injectable()
export class TicTacToeService {
  private gameLocks = new Map<string, Promise<void>>();

  constructor(private readonly prisma: PrismaService) {}

  private async withLock<T>(gameId: string, fn: () => Promise<T>): Promise<T> {
    while (this.gameLocks.has(gameId)) {
      await this.gameLocks.get(gameId);
    }
    let resolve: () => void;
    const lock = new Promise<void>(r => { resolve = r; });
    this.gameLocks.set(gameId, lock);
    try {
      return await fn();
    } finally {
      this.gameLocks.delete(gameId);
      resolve!();
    }
  }

  /**
   * Initialize a new Tic Tac Toe game state
   */
  initializeState(playerXId: string, playerOId: string): TicTacToeState {
    return {
      board: Array(9).fill(null),
      currentTurn: "X",
      moveHistory: [],
      playerX: playerXId,
      playerO: playerOId,
      startedAt: Date.now()
    };
  }

  /**
   * Get player's symbol (X or O) from the game state
   */
  getPlayerSymbol(state: TicTacToeState, userId: string): PlayerSymbol | null {
    if (state.playerX === userId) return "X";
    if (state.playerO === userId) return "O";
    return null;
  }

  /**
   * Get the userId for the current turn
   */
  getCurrentPlayerId(state: TicTacToeState): string {
    return state.currentTurn === "X" ? state.playerX : state.playerO;
  }

  /**
   * Make a move on the board
   */
  async makeMove(gameId: string, userId: string, cellIndex: number): Promise<MoveResult> {
    return this.withLock(gameId, () => this.makeMoveInternal(gameId, userId, cellIndex));
  }

  private async makeMoveInternal(gameId: string, userId: string, cellIndex: number): Promise<MoveResult> {
    const game = await this.prisma.game.findUnique({
      where: { id: gameId },
      include: { players: true }
    });

    if (!game) {
      return { success: false, error: "Game not found" };
    }

    if (game.status !== GameStatus.ACTIVE) {
      return { success: false, error: "Game is not active" };
    }

    const state = game.state as unknown as TicTacToeState;
    if (!state) {
      return { success: false, error: "Invalid game state" };
    }

    // Validate player is part of the game
    const playerSymbol = this.getPlayerSymbol(state, userId);
    if (!playerSymbol) {
      return { success: false, error: "You are not a player in this game" };
    }

    // Validate it's this player's turn
    if (state.currentTurn !== playerSymbol) {
      return { success: false, error: "It's not your turn" };
    }

    // Validate cell index
    if (cellIndex < 0 || cellIndex > 8) {
      return { success: false, error: "Invalid cell index" };
    }

    // Validate cell is empty
    if (state.board[cellIndex] !== null) {
      return { success: false, error: "Cell is already occupied" };
    }

    // Make the move
    const newBoard = [...state.board];
    newBoard[cellIndex] = playerSymbol;

    const move: TicTacToeMove = {
      cell: cellIndex,
      player: playerSymbol,
      timestamp: Date.now()
    };

    const newState: TicTacToeState = {
      ...state,
      board: newBoard,
      currentTurn: playerSymbol === "X" ? "O" : "X",
      moveHistory: [...state.moveHistory, move]
    };

    // Check for winner or draw
    const gameEnd = this.checkGameEnd(newBoard, state);

    if (gameEnd) {
      // Game is over - update database
      await this.prisma.game.update({
        where: { id: gameId },
        data: {
          state: newState as any,
          status: GameStatus.COMPLETED,
          winnerUserId: gameEnd.winnerId,
          endedAt: new Date()
        }
      });

      // Update player results
      if (gameEnd.winnerId) {
        const loserId = gameEnd.winnerId === state.playerX ? state.playerO : state.playerX;
        await this.prisma.gamePlayer.updateMany({
          where: { gameId, userId: gameEnd.winnerId },
          data: { result: "win" }
        });
        await this.prisma.gamePlayer.updateMany({
          where: { gameId, userId: loserId },
          data: { result: "loss" }
        });
      } else {
        // Draw
        await this.prisma.gamePlayer.updateMany({
          where: { gameId },
          data: { result: "draw" }
        });
      }

      return {
        success: true,
        state: newState,
        winner: gameEnd.winnerId,
        isDraw: gameEnd.isDraw,
        winningLine: gameEnd.winningLine
      };
    }

    // Game continues - update state
    await this.prisma.game.update({
      where: { id: gameId },
      data: { state: newState as any }
    });

    return {
      success: true,
      state: newState,
      winner: null,
      isDraw: false
    };
  }

  /**
   * Check if the game has ended (win or draw)
   */
  checkGameEnd(board: CellValue[], state: TicTacToeState): GameEndResult | null {
    // Check for winner
    for (const combo of WINNING_COMBINATIONS) {
      const [a, b, c] = combo;
      if (board[a] && board[a] === board[b] && board[a] === board[c]) {
        const winnerSymbol = board[a] as PlayerSymbol;
        const winnerId = winnerSymbol === "X" ? state.playerX : state.playerO;
        return {
          winnerId,
          winnerSymbol,
          isDraw: false,
          reason: "win",
          winningLine: combo
        };
      }
    }

    // Check for draw (all cells filled)
    const isDraw = board.every(cell => cell !== null);
    if (isDraw) {
      return {
        winnerId: null,
        winnerSymbol: null,
        isDraw: true,
        reason: "draw"
      };
    }

    return null;
  }

  /**
   * Handle player forfeit
   */
  async forfeitGame(gameId: string, forfeitingUserId: string): Promise<GameEndResult> {
    const game = await this.prisma.game.findUnique({
      where: { id: gameId },
      include: { players: true }
    });

    if (!game) {
      throw new BadRequestException("Game not found");
    }

    if (game.status !== GameStatus.ACTIVE) {
      throw new BadRequestException("Game is not active");
    }

    const state = game.state as unknown as TicTacToeState;
    if (!state) {
      throw new BadRequestException("Invalid game state");
    }

    // Determine winner (the other player)
    let winnerId: string;
    if (state.playerX === forfeitingUserId) {
      winnerId = state.playerO;
    } else if (state.playerO === forfeitingUserId) {
      winnerId = state.playerX;
    } else {
      throw new BadRequestException("User is not a player in this game");
    }

    // Update game status
    await this.prisma.game.update({
      where: { id: gameId },
      data: {
        status: GameStatus.COMPLETED,
        winnerUserId: winnerId,
        endedAt: new Date()
      }
    });

    // Update player results
    await this.prisma.gamePlayer.updateMany({
      where: { gameId, userId: winnerId },
      data: { result: "win" }
    });
    await this.prisma.gamePlayer.updateMany({
      where: { gameId, userId: forfeitingUserId },
      data: { result: "forfeit" }
    });

    return {
      winnerId,
      winnerSymbol: winnerId === state.playerX ? "X" : "O",
      isDraw: false,
      reason: "forfeit"
    };
  }

  /**
   * Get valid moves (empty cells)
   */
  getValidMoves(board: CellValue[]): number[] {
    return board
      .map((cell, index) => (cell === null ? index : -1))
      .filter(index => index !== -1);
  }
}

