import { Injectable, BadRequestException } from "@nestjs/common";
import { PrismaService } from "../../../prisma/prisma.service";
import { GameStatus } from "@prisma/client";
import {
  CheckersPiece,
  CheckersBoard,
  CheckersColor,
  CheckersSquare,
  CheckersMove,
  CheckersState,
  CheckersMoveResult,
  CheckersGameEndResult
} from "./checkers.types";

@Injectable()
export class CheckersService {
  constructor(private readonly prisma: PrismaService) {}

  // ── Board initialisation ────────────────────────────────────────────────────

  initializeState(playerBId: string, playerRId: string): CheckersState {
    const board = this.buildInitialBoard();
    return {
      board,
      currentTurn: 'B',
      playerB: playerBId,
      playerR: playerRId,
      moveHistory: [],
      capturedB: 0,
      capturedR: 0,
      mustContinueCapture: null,
      chainCaptured: [],
      noCaptureCount: 0,
      positionHistory: [],
      startedAt: Date.now()
    };
  }

  private buildInitialBoard(): CheckersBoard {
    const board: CheckersBoard = Array.from({ length: 8 }, () => Array(8).fill(null));
    for (let row = 0; row < 8; row++) {
      for (let col = 0; col < 8; col++) {
        if (!this.isDark(row, col)) continue;
        if (row < 3) board[row][col] = 'B';
        else if (row > 4) board[row][col] = 'R';
      }
    }
    return board;
  }

  // ── Helpers ──────────────────────────────────────────────────────────────────

  private isDark(row: number, col: number): boolean {
    return (row + col) % 2 === 1;
  }

  private colorOf(piece: CheckersPiece): CheckersColor | null {
    if (piece === 'B' || piece === 'BK') return 'B';
    if (piece === 'R' || piece === 'RK') return 'R';
    return null;
  }

  private isKing(piece: CheckersPiece): boolean {
    return piece === 'BK' || piece === 'RK';
  }

  private opponent(color: CheckersColor): CheckersColor {
    return color === 'B' ? 'R' : 'B';
  }

  private inBounds(r: number, c: number): boolean {
    return r >= 0 && r < 8 && c >= 0 && c < 8;
  }

  private sqEq(a: CheckersSquare, b: CheckersSquare): boolean {
    return a.row === b.row && a.col === b.col;
  }

  /** All diagonal directions a piece can move towards (forward for men, all for kings). */
  private getMoveDirs(piece: CheckersPiece): [number, number][] {
    if (piece === 'BK' || piece === 'RK') return [[-1,-1],[-1,1],[1,-1],[1,1]];
    if (piece === 'B') return [[1,-1],[1,1]];   // Black advances toward row 7
    if (piece === 'R') return [[-1,-1],[-1,1]]; // Red advances toward row 0
    return [];
  }

  private cloneBoard(board: CheckersBoard): CheckersBoard {
    return board.map(row => [...row]);
  }

  private serialisePosition(board: CheckersBoard, turn: CheckersColor): string {
    return board.map(r => r.map(c => c ?? '.').join('')).join('|') + ':' + turn;
  }

  // ── Move calculators ─────────────────────────────────────────────────────────

  /**
   * Valid single-hop non-capture destinations for the piece at (r, c).
   */
  getNonCaptureMoves(board: CheckersBoard, r: number, c: number): CheckersSquare[] {
    const piece = board[r][c];
    if (!piece) return [];
    const result: CheckersSquare[] = [];
    for (const [dr, dc] of this.getMoveDirs(piece)) {
      const nr = r + dr;
      const nc = c + dc;
      if (this.inBounds(nr, nc) && board[nr][nc] === null) {
        result.push({ row: nr, col: nc });
      }
    }
    return result;
  }

  /**
   * Valid capture destinations for the piece at (r, c), excluding already-jumped squares.
   * Men can only capture in their forward direction.
   * Kings can capture in any diagonal direction.
   */
  getCaptureMoves(
    board: CheckersBoard,
    r: number,
    c: number,
    excluded: CheckersSquare[]
  ): CheckersSquare[] {
    const piece = board[r][c];
    if (!piece) return [];
    const color = this.colorOf(piece)!;
    const opp = this.opponent(color);
    const result: CheckersSquare[] = [];

    for (const [dr, dc] of this.getMoveDirs(piece)) {
      const mr = r + dr;      // middle square (the piece being jumped)
      const mc = c + dc;
      const lr = r + 2 * dr;  // landing square
      const lc = c + 2 * dc;
      if (!this.inBounds(lr, lc)) continue;
      const midPiece = board[mr][mc];
      if (this.colorOf(midPiece) !== opp) continue;
      // The middle square must not already be in the exclusion list
      if (excluded.some(e => e.row === mr && e.col === mc)) continue;
      if (board[lr][lc] !== null) continue;
      result.push({ row: lr, col: lc });
    }
    return result;
  }

  /**
   * Returns true if the given color has any capture available on the board.
   */
  hasMandatoryCapture(board: CheckersBoard, color: CheckersColor, excluded: CheckersSquare[]): boolean {
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        if (this.colorOf(board[r][c]) !== color) continue;
        if (this.getCaptureMoves(board, r, c, excluded).length > 0) return true;
      }
    }
    return false;
  }

  /**
   * Returns true if the given color has ANY legal move (capture or non-capture).
   */
  hasAnyLegalMove(board: CheckersBoard, color: CheckersColor): boolean {
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        if (this.colorOf(board[r][c]) !== color) continue;
        if (this.getCaptureMoves(board, r, c, []).length > 0) return true;
        if (this.getNonCaptureMoves(board, r, c).length > 0) return true;
      }
    }
    return false;
  }

  /** Apply a jump: move piece from → to, remove captured piece, return board + captured square. */
  private applyJump(
    board: CheckersBoard,
    from: CheckersSquare,
    to: CheckersSquare
  ): { newBoard: CheckersBoard; capturedSq: CheckersSquare } {
    const newBoard = this.cloneBoard(board);
    const piece = newBoard[from.row][from.col];
    const midRow = (from.row + to.row) / 2;
    const midCol = (from.col + to.col) / 2;
    newBoard[to.row][to.col] = piece;
    newBoard[from.row][from.col] = null;
    newBoard[midRow][midCol] = null;
    return { newBoard, capturedSq: { row: midRow, col: midCol } };
  }

  /** Apply a quiet (non-capture) move. */
  private applyQuietMove(
    board: CheckersBoard,
    from: CheckersSquare,
    to: CheckersSquare
  ): CheckersBoard {
    const newBoard = this.cloneBoard(board);
    newBoard[to.row][to.col] = newBoard[from.row][from.col];
    newBoard[from.row][from.col] = null;
    return newBoard;
  }

  /**
   * Check if the piece at (r, c) should be promoted. Promotes in place, returns true if promoted.
   */
  private checkKinging(board: CheckersBoard, r: number, c: number): boolean {
    const piece = board[r][c];
    if (piece === 'B' && r === 7) { board[r][c] = 'BK'; return true; }
    if (piece === 'R' && r === 0) { board[r][c] = 'RK'; return true; }
    return false;
  }

  private countPieces(board: CheckersBoard, color: CheckersColor): number {
    let count = 0;
    for (const row of board) for (const cell of row) if (this.colorOf(cell) === color) count++;
    return count;
  }

  // ── makeMove ─────────────────────────────────────────────────────────────────

  async makeMove(
    gameId: string,
    userId: string,
    from: CheckersSquare,
    to: CheckersSquare
  ): Promise<CheckersMoveResult> {
    const game = await this.prisma.game.findUnique({
      where: { id: gameId },
      include: { players: true }
    });

    if (!game) return { success: false, error: 'Game not found' };
    if (game.status !== GameStatus.ACTIVE) return { success: false, error: 'Game is not active' };

    const state = game.state as unknown as CheckersState;
    if (!state) return { success: false, error: 'Invalid game state' };

    // Identify color of moving player
    const myColor: CheckersColor | null =
      state.playerB === userId ? 'B' : state.playerR === userId ? 'R' : null;
    if (!myColor) return { success: false, error: 'You are not a player in this game' };
    if (state.currentTurn !== myColor) return { success: false, error: "It's not your turn" };

    const board = state.board;
    const piece = board[from.row]?.[from.col];

    // ── Mid-chain: only the locked piece may move ──────────────────────────────
    if (state.mustContinueCapture) {
      if (!this.sqEq(from, state.mustContinueCapture)) {
        return { success: false, error: 'You must continue capturing with the same piece' };
      }
      const captureTargets = this.getCaptureMoves(board, from.row, from.col, state.chainCaptured);
      if (!captureTargets.some(t => this.sqEq(t, to))) {
        return { success: false, error: 'Invalid capture destination' };
      }
    } else {
      // ── Normal turn ─────────────────────────────────────────────────────────
      if (!piece || this.colorOf(piece) !== myColor) {
        return { success: false, error: 'No valid piece at source square' };
      }
      const mustCapture = this.hasMandatoryCapture(board, myColor, []);
      const isCapture = Math.abs(to.row - from.row) === 2;

      if (mustCapture && !isCapture) {
        return { success: false, error: 'A capture is available — you must capture' };
      }

      if (isCapture) {
        const captureTargets = this.getCaptureMoves(board, from.row, from.col, []);
        if (!captureTargets.some(t => this.sqEq(t, to))) {
          return { success: false, error: 'Invalid capture move' };
        }
      } else {
        const quietTargets = this.getNonCaptureMoves(board, from.row, from.col);
        if (!quietTargets.some(t => this.sqEq(t, to))) {
          return { success: false, error: 'Invalid move' };
        }
      }
    }

    // ── Apply the move ────────────────────────────────────────────────────────
    const isCapture = Math.abs(to.row - from.row) === 2;
    let newBoard: CheckersBoard;
    let capturedSq: CheckersSquare | null = null;

    if (isCapture) {
      const result = this.applyJump(board, from, to);
      newBoard = result.newBoard;
      capturedSq = result.capturedSq;
    } else {
      newBoard = this.applyQuietMove(board, from, to);
    }

    // ── Check kinging ─────────────────────────────────────────────────────────
    const promoted = this.checkKinging(newBoard, to.row, to.col);

    // ── Record the move ───────────────────────────────────────────────────────
    const newChainCaptured: CheckersSquare[] = capturedSq
      ? [...state.chainCaptured, capturedSq]
      : [];

    const moveRecord: CheckersMove = {
      from,
      to,
      captured: capturedSq ? [capturedSq] : [],
      promoted,
      timestamp: Date.now()
    };

    // ── Determine continuation or turn switch ─────────────────────────────────
    let mustContinue: CheckersSquare | null = null;
    let turnSwitches = true;

    if (isCapture && !promoted) {
      // Check if this piece can capture again
      const chainCaps = this.getCaptureMoves(newBoard, to.row, to.col, newChainCaptured);
      if (chainCaps.length > 0) {
        mustContinue = { row: to.row, col: to.col };
        turnSwitches = false;
      }
    }

    // ── Build new state ───────────────────────────────────────────────────────
    const newCapturedB = state.capturedB + (capturedSq && myColor === 'B' ? 0 : capturedSq ? 1 : 0);
    const newCapturedR = state.capturedR + (capturedSq && myColor === 'R' ? 0 : capturedSq ? 1 : 0);

    // More precisely: if myColor is 'B', they capture Red pieces; if 'R', they capture Black
    const newCapturedBFinal = myColor === 'R' && capturedSq ? state.capturedB + 1 : state.capturedB;
    const newCapturedRFinal = myColor === 'B' && capturedSq ? state.capturedR + 1 : state.capturedR;

    const newNoCaptureCount = isCapture ? 0 : state.noCaptureCount + 1;
    const newPositionHistory = turnSwitches
      ? [...state.positionHistory, this.serialisePosition(newBoard, myColor === 'B' ? 'R' : 'B')]
      : state.positionHistory;

    const newState: CheckersState = {
      board: newBoard,
      currentTurn: turnSwitches ? this.opponent(myColor) : myColor,
      playerB: state.playerB,
      playerR: state.playerR,
      moveHistory: [...state.moveHistory, moveRecord],
      capturedB: newCapturedBFinal,
      capturedR: newCapturedRFinal,
      mustContinueCapture: mustContinue,
      chainCaptured: mustContinue ? newChainCaptured : [],
      noCaptureCount: turnSwitches ? newNoCaptureCount : state.noCaptureCount,
      positionHistory: newPositionHistory,
      startedAt: state.startedAt
    };

    // ── Check game end (only when turn actually switches) ─────────────────────
    if (turnSwitches) {
      const nextColor = this.opponent(myColor);
      const oppPieces = this.countPieces(newBoard, nextColor);
      const oppHasMoves = this.hasAnyLegalMove(newBoard, nextColor);

      if (oppPieces === 0 || !oppHasMoves) {
        return await this.endGame(gameId, state, newState, userId, 'win');
      }

      // Draw: 40-move no-progress rule
      if (newNoCaptureCount >= 40) {
        return await this.endGame(gameId, state, newState, null, 'draw');
      }

      // Draw: 3-fold repetition
      const currentSer = this.serialisePosition(newBoard, nextColor);
      const repeatCount = newPositionHistory.filter(p => p === currentSer).length;
      if (repeatCount >= 3) {
        return await this.endGame(gameId, state, newState, null, 'draw');
      }
    }

    await this.prisma.game.update({ where: { id: gameId }, data: { state: newState as any } });
    return { success: true, state: newState, winner: null, isDraw: false };
  }

  private async endGame(
    gameId: string,
    _oldState: CheckersState,
    newState: CheckersState,
    winnerId: string | null,
    reason: 'win' | 'draw'
  ): Promise<CheckersMoveResult> {
    await this.prisma.game.update({
      where: { id: gameId },
      data: {
        state: newState as any,
        status: GameStatus.COMPLETED,
        winnerUserId: winnerId,
        endedAt: new Date()
      }
    });

    if (winnerId) {
      const loserId = winnerId === newState.playerB ? newState.playerR : newState.playerB;
      await this.prisma.gamePlayer.updateMany({ where: { gameId, userId: winnerId }, data: { result: 'win' } });
      await this.prisma.gamePlayer.updateMany({ where: { gameId, userId: loserId }, data: { result: 'loss' } });
    } else {
      await this.prisma.gamePlayer.updateMany({ where: { gameId }, data: { result: 'draw' } });
    }

    return {
      success: true,
      state: newState,
      winner: winnerId,
      isDraw: reason === 'draw'
    };
  }

  // ── forfeitGame ───────────────────────────────────────────────────────────────

  async forfeitGame(gameId: string, forfeitingUserId: string): Promise<CheckersGameEndResult> {
    const game = await this.prisma.game.findUnique({ where: { id: gameId } });
    if (!game) throw new BadRequestException('Game not found');
    if (game.status !== GameStatus.ACTIVE) throw new BadRequestException('Game is not active');

    const state = game.state as unknown as CheckersState;
    if (!state) throw new BadRequestException('Invalid game state');

    const winnerId = state.playerB === forfeitingUserId ? state.playerR : state.playerB;

    await this.prisma.game.update({
      where: { id: gameId },
      data: { status: GameStatus.COMPLETED, winnerUserId: winnerId, endedAt: new Date() }
    });
    await this.prisma.gamePlayer.updateMany({ where: { gameId, userId: winnerId }, data: { result: 'win' } });
    await this.prisma.gamePlayer.updateMany({ where: { gameId, userId: forfeitingUserId }, data: { result: 'forfeit' } });

    return { winnerId, isDraw: false, reason: 'forfeit' };
  }
}
