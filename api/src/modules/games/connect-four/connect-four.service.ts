import { Injectable, BadRequestException } from "@nestjs/common";
import { PrismaService } from "../../../prisma/prisma.service";
import { GameStatus } from "@prisma/client";
import {
  ConnectFourState,
  C4Board,
  C4Disc,
  C4Move,
  C4MoveResult,
  C4GameEndResult,
  ROWS,
  COLS
} from "./connect-four.types";

@Injectable()
export class ConnectFourService {
  constructor(private readonly prisma: PrismaService) {}

  initializeState(playerRId: string, playerYId: string): ConnectFourState {
    const board: C4Board = Array.from({ length: ROWS }, () => Array(COLS).fill(null));
    return {
      board,
      currentTurn: 'R',
      playerR: playerRId,
      playerY: playerYId,
      moveHistory: [],
      startedAt: Date.now()
    };
  }

  getPlayerDisc(state: ConnectFourState, userId: string): 'R' | 'Y' | null {
    if (state.playerR === userId) return 'R';
    if (state.playerY === userId) return 'Y';
    return null;
  }

  getCurrentPlayerId(state: ConnectFourState): string {
    return state.currentTurn === 'R' ? state.playerR : state.playerY;
  }

  /** Find the lowest empty row in a column. Returns -1 if column is full. */
  private getDropRow(board: C4Board, col: number): number {
    for (let row = ROWS - 1; row >= 0; row--) {
      if (board[row][col] === null) return row;
    }
    return -1;
  }

  /** Count consecutive same-colored discs from (row, col) in direction (dr, dc). */
  private countInDir(board: C4Board, row: number, col: number, dr: number, dc: number, disc: C4Disc): number {
    let count = 0;
    let r = row + dr;
    let c = col + dc;
    while (r >= 0 && r < ROWS && c >= 0 && c < COLS && board[r][c] === disc) {
      count++;
      r += dr;
      c += dc;
    }
    return count;
  }

  /** Collect winning cells from (row, col) in both directions (dr, dc) and (−dr, −dc). */
  private getWinLine(board: C4Board, row: number, col: number, dr: number, dc: number, disc: C4Disc): [number, number][] {
    const cells: [number, number][] = [[row, col]];
    for (const [dRow, dCol] of [[dr, dc], [-dr, -dc]]) {
      let r = row + dRow;
      let c = col + dCol;
      while (r >= 0 && r < ROWS && c >= 0 && c < COLS && board[r][c] === disc) {
        cells.push([r, c]);
        r += dRow;
        c += dCol;
      }
    }
    return cells;
  }

  checkGameEnd(board: C4Board, lastRow: number, lastCol: number, disc: C4Disc, state: ConnectFourState): C4GameEndResult | null {
    const directions: [number, number][] = [
      [0, 1],   // horizontal
      [1, 0],   // vertical
      [1, 1],   // diagonal ↘
      [1, -1]   // diagonal ↙
    ];

    for (const [dr, dc] of directions) {
      const line = this.getWinLine(board, lastRow, lastCol, dr, dc, disc);
      if (line.length >= 4) {
        const winnerId = disc === 'R' ? state.playerR : state.playerY;
        return { winnerId, isDraw: false, reason: 'win', winningCells: line };
      }
    }

    // Draw: all cells filled
    const isFull = board.every(row => row.every(cell => cell !== null));
    if (isFull) {
      return { winnerId: null, isDraw: true, reason: 'draw' };
    }

    return null;
  }

  async makeMove(gameId: string, userId: string, colIndex: number): Promise<C4MoveResult> {
    const game = await this.prisma.game.findUnique({
      where: { id: gameId },
      include: { players: true }
    });

    if (!game) return { success: false, error: 'Game not found' };
    if (game.status !== GameStatus.ACTIVE) return { success: false, error: 'Game is not active' };

    const state = game.state as unknown as ConnectFourState;
    if (!state) return { success: false, error: 'Invalid game state' };

    const disc = this.getPlayerDisc(state, userId);
    if (!disc) return { success: false, error: 'You are not a player in this game' };
    if (state.currentTurn !== disc) return { success: false, error: "It's not your turn" };

    if (colIndex < 0 || colIndex >= COLS) return { success: false, error: 'Invalid column' };

    const row = this.getDropRow(state.board, colIndex);
    if (row === -1) return { success: false, error: 'Column is full' };

    // Apply the move — deep-clone the board to avoid mutation
    const newBoard: C4Board = state.board.map(r => [...r]);
    newBoard[row][colIndex] = disc;

    const move: C4Move = { col: colIndex, row, player: disc, timestamp: Date.now() };

    const newState: ConnectFourState = {
      ...state,
      board: newBoard,
      currentTurn: disc === 'R' ? 'Y' : 'R',
      moveHistory: [...state.moveHistory, move]
    };

    const gameEnd = this.checkGameEnd(newBoard, row, colIndex, disc, state);

    if (gameEnd) {
      await this.prisma.game.update({
        where: { id: gameId },
        data: {
          state: newState as any,
          status: GameStatus.COMPLETED,
          winnerUserId: gameEnd.winnerId,
          endedAt: new Date()
        }
      });

      if (gameEnd.winnerId) {
        const loserId = gameEnd.winnerId === state.playerR ? state.playerY : state.playerR;
        await this.prisma.gamePlayer.updateMany({ where: { gameId, userId: gameEnd.winnerId }, data: { result: 'win' } });
        await this.prisma.gamePlayer.updateMany({ where: { gameId, userId: loserId }, data: { result: 'loss' } });
      } else {
        await this.prisma.gamePlayer.updateMany({ where: { gameId }, data: { result: 'draw' } });
      }

      return {
        success: true,
        state: newState,
        winner: gameEnd.winnerId,
        isDraw: gameEnd.isDraw,
        winningCells: gameEnd.winningCells
      };
    }

    await this.prisma.game.update({ where: { id: gameId }, data: { state: newState as any } });

    return { success: true, state: newState, winner: null, isDraw: false };
  }

  async forfeitGame(gameId: string, forfeitingUserId: string): Promise<C4GameEndResult> {
    const game = await this.prisma.game.findUnique({ where: { id: gameId } });
    if (!game) throw new BadRequestException('Game not found');
    if (game.status !== GameStatus.ACTIVE) throw new BadRequestException('Game is not active');

    const state = game.state as unknown as ConnectFourState;
    if (!state) throw new BadRequestException('Invalid game state');

    const winnerId = state.playerR === forfeitingUserId ? state.playerY : state.playerR;

    await this.prisma.game.update({
      where: { id: gameId },
      data: { status: GameStatus.COMPLETED, winnerUserId: winnerId, endedAt: new Date() }
    });
    await this.prisma.gamePlayer.updateMany({ where: { gameId, userId: winnerId }, data: { result: 'win' } });
    await this.prisma.gamePlayer.updateMany({ where: { gameId, userId: forfeitingUserId }, data: { result: 'forfeit' } });

    return { winnerId, isDraw: false, reason: 'forfeit' };
  }
}
