import { Injectable, NotFoundException, BadRequestException } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { GameStatus, GameType } from "@prisma/client";
import { TicTacToeService } from "./tictactoe/tictactoe.service";
import { ChessService } from "./chess/chess.service";
import { TriviaService } from "./trivia/trivia.service";
import { TruthsAndLieService } from "./truths-and-lie/truths-and-lie.service";
import { BilliardsService } from "./billiards/billiards.service";
import { PokerService } from "./poker/poker.service";
import { TwentyOneQuestionsService } from "./twenty-one-questions/twenty-one-questions.service";
import { ConnectFourService } from "./connect-four/connect-four.service";
import { CheckersService } from "./checkers/checkers.service";
import { MemoryService } from "./memory/memory.service";
import { UnoService } from "./uno/uno.service";
import { GeoGuesserService } from "./geoguesser/geoguesser.service";
import { TanksService } from "./tanks/tanks.service";
import { PenguinKnockoutService } from "./penguin-knockout/penguin-knockout.service";

@Injectable()
export class GamesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ticTacToeService: TicTacToeService,
    private readonly chessService: ChessService,
    private readonly triviaService: TriviaService,
    private readonly truthsAndLieService: TruthsAndLieService,
    private readonly billiardsService: BilliardsService,
    private readonly pokerService: PokerService,
    private readonly twentyOneQuestionsService: TwentyOneQuestionsService,
    private readonly connectFourService: ConnectFourService,
    private readonly checkersService: CheckersService,
    private readonly memoryService: MemoryService,
    private readonly unoService: UnoService,
    private readonly geoGuesserService: GeoGuesserService,
    private readonly tanksService: TanksService,
    private readonly penguinKnockoutService: PenguinKnockoutService
  ) {}

  async createGame(sessionId: string, type: GameType, playerIds: string[]) {
    // Determine side assignment based on game type
    let sideMappings: { userId: string; side: string }[];
    
    if (type === GameType.CHESS) {
      // For chess, randomly assign white/black
      const shuffled = [...playerIds].sort(() => Math.random() - 0.5);
      sideMappings = [
        { userId: shuffled[0], side: "white" },
        { userId: shuffled[1], side: "black" }
      ];
    } else if (type === GameType.TRIVIA) {
      // For trivia, use player1/player2 as sides (order doesn't matter)
      sideMappings = playerIds.map((userId, idx) => ({
        userId,
        side: `player${idx + 1}`
      }));
    } else if (type === GameType.TRUTHS_AND_LIE) {
      // For truths and lie, use chooser/guesser as sides (will be assigned randomly)
      sideMappings = playerIds.map((userId, idx) => ({
        userId,
        side: `player${idx + 1}`
      }));
    } else if (type === GameType.BILLIARDS) {
      // For billiards, use player1/player2 as sides
      sideMappings = playerIds.map((userId, idx) => ({
        userId,
        side: `player${idx + 1}`
      }));
    } else if (type === GameType.POKER) {
      // For poker, use player1/player2 as sides
      sideMappings = playerIds.map((userId, idx) => ({
        userId,
        side: `player${idx + 1}`
      }));
    } else if (type === GameType.TWENTY_ONE_QUESTIONS) {
      // For 21 Questions, use player1/player2 as sides
      sideMappings = playerIds.map((userId, idx) => ({
        userId,
        side: `player${idx + 1}`
      }));
    } else if (type === GameType.CONNECT_FOUR) {
      // Randomly assign R (red, goes first) and Y (yellow)
      const shuffled = [...playerIds].sort(() => Math.random() - 0.5);
      sideMappings = [
        { userId: shuffled[0], side: "R" },
        { userId: shuffled[1], side: "Y" }
      ];
    } else if (type === GameType.CHECKERS) {
      // Randomly assign B (Black, goes first) and R (Red)
      const shuffled = [...playerIds].sort(() => Math.random() - 0.5);
      sideMappings = [
        { userId: shuffled[0], side: "B" },
        { userId: shuffled[1], side: "R" }
      ];
    } else if (type === GameType.MEMORY_CARDS) {
      // Randomly assign player1 (goes first) and player2
      const shuffled = [...playerIds].sort(() => Math.random() - 0.5);
      sideMappings = [
        { userId: shuffled[0], side: "player1" },
        { userId: shuffled[1], side: "player2" }
      ];
    } else if (type === GameType.UNO) {
      const shuffled = [...playerIds].sort(() => Math.random() - 0.5);
      sideMappings = [
        { userId: shuffled[0], side: "player1" },
        { userId: shuffled[1], side: "player2" }
      ];
    } else if (type === GameType.GEO_GUESSER) {
      sideMappings = playerIds.map((userId, idx) => ({
        userId,
        side: `player${idx + 1}`
      }));
    } else if (type === GameType.TANKS) {
      sideMappings = playerIds.map((userId, idx) => ({
        userId,
        side: `player${idx + 1}`
      }));
    } else if (type === GameType.PENGUIN_KNOCKOUT) {
      const shuffled = [...playerIds].sort(() => Math.random() - 0.5);
      sideMappings = [
        { userId: shuffled[0], side: "player1" },
        { userId: shuffled[1], side: "player2" }
      ];
    } else {
      // For TicTacToe or others: X goes first
      sideMappings = playerIds.map((userId, idx) => ({
        userId,
        side: idx === 0 ? "X" : "O"
      }));
    }
    
    // Create the game record
    const game = await this.prisma.game.create({
      data: {
        sessionId,
        type,
        status: GameStatus.PENDING,
        players: {
          create: sideMappings.map(({ userId, side }) => ({
            userId,
            side
          }))
        }
      },
      include: {
        players: true
      }
    });

    return game;
  }

  /**
   * Start a game and initialize its state
   */
  async startGame(gameId: string, category?: string) {
    const game = await this.prisma.game.findUnique({
      where: { id: gameId },
      include: { players: true }
    });

    if (!game) {
      throw new NotFoundException("Game not found");
    }

    if (game.status !== GameStatus.PENDING) {
      throw new BadRequestException("Game already started or completed");
    }

    if (game.players.length !== 2) {
      throw new BadRequestException("Game requires exactly 2 players");
    }

    // Initialize state based on game type
    let state: any = null;
    
    if (game.type === GameType.TICTACTOE) {
      const playerX = game.players.find(p => p.side === "X")?.userId;
      const playerO = game.players.find(p => p.side === "O")?.userId;
      
      if (!playerX || !playerO) {
        throw new BadRequestException("Invalid player configuration");
      }
      
      state = this.ticTacToeService.initializeState(playerX, playerO);
    } else if (game.type === GameType.CHESS) {
      const playerWhite = game.players.find(p => p.side === "white")?.userId;
      const playerBlack = game.players.find(p => p.side === "black")?.userId;
      
      if (!playerWhite || !playerBlack) {
        throw new BadRequestException("Invalid player configuration for chess");
      }
      
      state = this.chessService.initializeState(playerWhite, playerBlack);
    } else if (game.type === GameType.TRIVIA) {
      const playerIds = game.players.map(p => p.userId);
      state = this.triviaService.initializeState(playerIds, { category: category as any });
      // Store state in trivia service (keep in countdown phase initially)
      this.triviaService.setState(gameId, state);
    } else if (game.type === GameType.TRUTHS_AND_LIE) {
      const playerIds = game.players.map(p => p.userId);
      state = this.truthsAndLieService.initializeState(gameId, playerIds);
      // Store state in truths-and-lie service
      this.truthsAndLieService.setState(gameId, state);
    } else if (game.type === GameType.BILLIARDS) {
      const playerIds = game.players.map(p => p.userId);
      state = this.billiardsService.initializeState(gameId, playerIds);
      // Store state in billiards service
      this.billiardsService.setState(gameId, state);
    } else if (game.type === GameType.POKER) {
      const playerIds = game.players.map(p => p.userId);
      state = this.pokerService.initializeState(gameId, playerIds);
      // Store state in poker service
      this.pokerService.setState(gameId, state);
    } else if (game.type === GameType.TWENTY_ONE_QUESTIONS) {
      const playerIds = game.players.map(p => p.userId);
      state = this.twentyOneQuestionsService.initializeState(gameId, playerIds);
      // Store state in twenty-one-questions service
      this.twentyOneQuestionsService.setState(gameId, state);
    } else if (game.type === GameType.CONNECT_FOUR) {
      const playerR = game.players.find(p => p.side === "R")?.userId;
      const playerY = game.players.find(p => p.side === "Y")?.userId;
      if (!playerR || !playerY) throw new BadRequestException("Invalid player configuration for Connect Four");
      state = this.connectFourService.initializeState(playerR, playerY);
    } else if (game.type === GameType.CHECKERS) {
      const playerB = game.players.find(p => p.side === "B")?.userId;
      const playerR = game.players.find(p => p.side === "R")?.userId;
      if (!playerB || !playerR) throw new BadRequestException("Invalid player configuration for Checkers");
      state = this.checkersService.initializeState(playerB, playerR);
    } else if (game.type === GameType.MEMORY_CARDS) {
      const player1 = game.players.find(p => p.side === "player1")?.userId;
      const player2 = game.players.find(p => p.side === "player2")?.userId;
      if (!player1 || !player2) throw new BadRequestException("Invalid player configuration for Memory Cards");
      state = this.memoryService.initializeState(player1, player2);
    } else if (game.type === GameType.UNO) {
      const player1 = game.players.find(p => p.side === "player1")?.userId;
      const player2 = game.players.find(p => p.side === "player2")?.userId;
      if (!player1 || !player2) throw new BadRequestException("Invalid player configuration for UNO");
      state = this.unoService.initializeState(player1, player2);
    } else if (game.type === GameType.GEO_GUESSER) {
      const player1 = game.players.find(p => p.side === "player1");
      const player2 = game.players.find(p => p.side === "player2");
      if (!player1 || !player2) throw new BadRequestException("Invalid player configuration for GeoGuesser");
      state = this.geoGuesserService.initializeState(player1.userId, player2.userId);
      this.geoGuesserService.setState(game.id, state);
    } else if (game.type === GameType.TANKS) {
      const playerIds = game.players.map(p => p.userId);
      state = this.tanksService.initializeState(game.id, playerIds);
      this.tanksService.setState(game.id, state);
    } else if (game.type === GameType.PENGUIN_KNOCKOUT) {
      const player1 = game.players.find(p => p.side === "player1")?.userId;
      const player2 = game.players.find(p => p.side === "player2")?.userId;
      if (!player1 || !player2) throw new BadRequestException("Invalid player configuration for Penguin Knockout");
      state = this.penguinKnockoutService.initializeState(player1, player2);
      this.penguinKnockoutService.setState(game.id, state);
    }

    // Update game to active with initial state
    const updatedGame = await this.prisma.game.update({
      where: { id: gameId },
      data: {
        status: GameStatus.ACTIVE,
        state: state as any,
        startedAt: new Date()
      },
      include: {
        players: {
          include: {
            user: {
              select: {
                id: true,
                displayName: true,
                username: true
              }
            }
          }
        }
      }
    });

    return updatedGame;
  }

  /**
   * Get a game by ID with players
   */
  async getGame(gameId: string) {
    const game = await this.prisma.game.findUnique({
      where: { id: gameId },
      include: {
        players: {
          include: {
            user: {
              select: {
                id: true,
                displayName: true,
                username: true
              }
            }
          }
        },
        session: true
      }
    });

    if (!game) {
      throw new NotFoundException("Game not found");
    }

    return game;
  }

  /**
   * Cancel a game
   */
  async cancelGame(gameId: string) {
    const game = await this.prisma.game.findUnique({
      where: { id: gameId }
    });

    if (!game) {
      throw new NotFoundException("Game not found");
    }

    if (game.status === GameStatus.COMPLETED) {
      throw new BadRequestException("Cannot cancel a completed game");
    }

    return this.prisma.game.update({
      where: { id: gameId },
      data: {
        status: GameStatus.CANCELED,
        endedAt: new Date()
      }
    });
  }

  /**
   * Get active game for a session
   */
  async getActiveGameForSession(sessionId: string) {
    return this.prisma.game.findFirst({
      where: {
        sessionId,
        status: { in: [GameStatus.PENDING, GameStatus.ACTIVE] }
      },
      include: {
        players: {
          include: {
            user: {
              select: {
                id: true,
                displayName: true,
                username: true
              }
            }
          }
        }
      },
      orderBy: { createdAt: "desc" }
    });
  }
}

