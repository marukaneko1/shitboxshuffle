import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer
} from "@nestjs/websockets";
import { UseGuards, OnModuleDestroy, Logger, Inject, UsePipes, ValidationPipe } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { WsException } from "@nestjs/websockets";
import { Server, Socket } from "socket.io";
import { WsJwtGuard } from "../../common/guards/ws-jwt.guard";
import { MatchmakingService } from "../matchmaking/matchmaking.service";
import { SessionsService } from "../sessions/sessions.service";
import { GamesService } from "../games/games.service";
import { TicTacToeService } from "../games/tictactoe/tictactoe.service";
import { ChessService } from "../games/chess/chess.service";
import { TriviaService } from "../games/trivia/trivia.service";
import { TruthsAndLieService } from "../games/truths-and-lie/truths-and-lie.service";
import { BilliardsService } from "../games/billiards/billiards.service";
import { PokerService } from "../games/poker/poker.service";
import { TwentyOneQuestionsService } from "../games/twenty-one-questions/twenty-one-questions.service";
import { ConnectFourService } from "../games/connect-four/connect-four.service";
import { CheckersService } from "../games/checkers/checkers.service";
import { MemoryService } from "../games/memory/memory.service";
import { UnoService } from "../games/uno/uno.service";
import { GeoGuesserService } from "../games/geoguesser/geoguesser.service";
import { TanksService } from "../games/tanks/tanks.service";
import { PenguinKnockoutService } from "../games/penguin-knockout/penguin-knockout.service";
import { VideoService } from "../video/video.service";
import { WalletService } from "../wallet/wallet.service";
import { ReportsService } from "../reports/reports.service";
import { RoomsService } from "../rooms/rooms.service";
import { PrismaService } from "../../prisma/prisma.service";
import { v4 as uuidv4 } from "uuid";
import { GameType, RoundStatus } from "@prisma/client";
import { Position, PieceType } from "../games/chess/chess.types";
import { 
  MatchJoinDto, 
  SendGiftDto, 
  GameMoveDto, 
  RoomJoinDto, 
  RoomVoteDto,
  PokerActionDto,
  PokerNewHandDto,
  BilliardsShotDto,
  BilliardsPlaceCueBallDto,
  BilliardsEventDto,
  TriviaSelectThemeDto,
  TriviaAnswerDto,
  TruthsAndLieSubmitStatementsDto,
  TruthsAndLieSubmitGuessDto,
  TwentyOneQuestionsNextDto,
  TanksInputDto,
  PenguinMoveDto
} from "./dto";

// SECURITY: Dynamic CORS based on environment - DO NOT use origin: "*" in production
@WebSocketGateway({
  namespace: "/ws",
  cors: {
    origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
      // Allow requests with no origin in development only (for testing tools)
      if (!origin) {
        const isDev = process.env.NODE_ENV === "development";
        return callback(null, isDev);
      }
      
      // Get allowed origins from environment
      const allowedOrigins = process.env.ALLOWED_ORIGINS
        ? process.env.ALLOWED_ORIGINS.split(",").map(o => o.trim())
        : [process.env.WEB_BASE_URL || "http://localhost:3000"];
      
      // In development, allow localhost variations
      const isDev = process.env.NODE_ENV === "development";
      if (isDev && (origin.includes("localhost") || origin.includes("127.0.0.1"))) {
        return callback(null, true);
      }
      
      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      }
      
      callback(new Error("Not allowed by CORS"));
    },
    credentials: true
  },
  maxHttpBufferSize: 1e6 // SECURITY: Limit WebSocket message size to 1MB
})
export class AppGateway implements OnGatewayConnection, OnGatewayDisconnect, OnModuleDestroy {
  @WebSocketServer()
  server!: Server;
  
  private readonly logger = new Logger(AppGateway.name);
  private matchingIntervals = new Map<string, NodeJS.Timeout>();

  // Track voting timers for rooms
  private votingTimers = new Map<string, NodeJS.Timeout>();

  // Track tanks game loop intervals
  private tanksGameLoops = new Map<string, NodeJS.Timeout>();

  constructor(
    private readonly matchmakingService: MatchmakingService,
    private readonly sessionsService: SessionsService,
    private readonly gamesService: GamesService,
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
    private readonly penguinKnockoutService: PenguinKnockoutService,
    private readonly videoService: VideoService,
    private readonly walletService: WalletService,
    private readonly reportsService: ReportsService,
    private readonly roomsService: RoomsService,
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService
  ) {}

  handleConnection(client: Socket) {
    // WsJwtGuard will attach user payload to client in message handlers.
    client.emit("connected", { ok: true });
  }

  /**
   * SECURITY: Helper to verify user is a player in the game
   * Throws an error if user is not authorized
   */
  private assertPlayerInGame(game: any, userId: string): void {
    const isPlayer = game.players.some((p: any) => p.userId === userId);
    if (!isPlayer) {
      throw new Error("You are not a player in this game");
    }
  }

  handleDisconnect(client: Socket) {
    const userId = (client as any).user?.sub;
    if (userId) {
      // Clear any running matching interval
      const interval = this.matchingIntervals.get(userId);
      if (interval) {
        clearInterval(interval);
        this.matchingIntervals.delete(userId);
      }

      // Notify any active session rooms that this peer left
      const rooms = Array.from(client.rooms) as string[];
      rooms.forEach(room => {
        if (room.startsWith('session:')) {
          // Emit to everyone else in the session room (not this disconnecting client)
          client.to(room).emit('session.peerLeft', { userId, sessionId: room.replace('session:', '') });
        }
      });

      setTimeout(() => {
        if (!this.matchingIntervals.has(userId)) {
          this.matchmakingService.leaveQueue(userId);
        }
      }, 1000);
    }
  }

  onModuleDestroy() {
    // Cleanup all matching intervals
    for (const [userId, interval] of this.matchingIntervals.entries()) {
      clearInterval(interval);
    }
    this.matchingIntervals.clear();

    // Cleanup all voting timers
    for (const [roundId, timer] of this.votingTimers.entries()) {
      clearTimeout(timer);
    }
    this.votingTimers.clear();

    // Cleanup trivia timers
    for (const [gameId, timer] of this.triviaQuestionTimers.entries()) {
      clearTimeout(timer);
    }
    this.triviaQuestionTimers.clear();

    // Cleanup GeoGuesser round timers
    for (const [gameId, timer] of this.geoGuesserRoundTimers.entries()) {
      clearTimeout(timer);
    }
    this.geoGuesserRoundTimers.clear();

    // Cleanup tanks game loops
    for (const [gameId, interval] of this.tanksGameLoops.entries()) {
      clearInterval(interval);
    }
    this.tanksGameLoops.clear();
  }

  @UseGuards(WsJwtGuard)
  @UsePipes(new ValidationPipe({ 
    whitelist: true, 
    forbidNonWhitelisted: true,
    transform: true,
    exceptionFactory: (errors) => new WsException(errors)
  }))
  @SubscribeMessage("match.join")
  async handleMatchJoin(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: MatchJoinDto
  ) {
    const user = (client as any).user;
    client.join(this.getUserRoom(user.sub));
    
    try {
      const pair = await this.matchmakingService.joinQueue(
        user.sub,
        body.region,
        body.language,
        body.latitude,
        body.longitude
      );
      client.emit("match.queued", { queued: true });
      
      if (pair) {
        // Immediate match found
        this.logger.log(`Immediate match found for user ${user.sub} with ${pair[0].userId === user.sub ? pair[1].userId : pair[0].userId}`);
        await this.handleMatch(pair);
      } else {
        // No immediate match, start periodic checking
        this.logger.log(`No immediate match for user ${user.sub}, starting periodic matching`);
        this.startPeriodicMatching(client, user.sub, body.region, body.language, body.latitude, body.longitude);
      }
    } catch (error: any) {
      this.logger.error("Matchmaking error:", error);
      client.emit("error", { message: error.message || "Matchmaking failed. Please check your subscription and verification status." });
    }
  }

  private async handleMatch(pair: [any, any]) {
    const [a, b] = pair;
    
    // Safety check: ensure users are different
    if (a.userId === b.userId) {
      this.logger.warn(`[MATCHMAKING] Attempted to match user ${a.userId} with themselves - rejecting match`);
      return; // Don't create a session if users are the same
    }
    
    // Clear any matching intervals for both users
    const intervalA = this.matchingIntervals.get(a.userId);
    if (intervalA) {
      clearInterval(intervalA);
      this.matchingIntervals.delete(a.userId);
    }
    const intervalB = this.matchingIntervals.get(b.userId);
    if (intervalB) {
      clearInterval(intervalB);
      this.matchingIntervals.delete(b.userId);
    }
    
    const channelName = `session-${uuidv4()}`;
    const session = await this.sessionsService.createSession(a.userId, b.userId, channelName);
    this.logger.log(`Created session ${session.id} for users ${a.userId} and ${b.userId}`);
    
    // Try to generate video tokens, but don't fail if Agora is not configured
    const tokens: Array<{ userId: string; token: { token: string; channelName: string; expiresAt: string } | null }> = [];
    try {
      tokens.push({ userId: a.userId, token: this.videoService.buildToken(channelName, a.userId) });
      tokens.push({ userId: b.userId, token: this.videoService.buildToken(channelName, b.userId) });
    } catch (error: any) {
      // If Agora is not configured, continue without video tokens
      if (error.message?.includes("Agora") || error.message?.includes("AGORA")) {
        this.logger.warn("⚠️ Agora credentials not configured - session will continue without video features");
        tokens.push({ userId: a.userId, token: null });
        tokens.push({ userId: b.userId, token: null });
      } else {
        // For other errors, re-throw
        throw error;
      }
    }
    
    const payloadFor = (recipientId: string) => {
      const peerId = recipientId === a.userId ? b.userId : a.userId;
      const tokenData = tokens.find((t) => t.userId === recipientId)?.token;
      return {
        sessionId: session.id,
        peer: { id: peerId },
        video: tokenData ? { channelName, token: tokenData.token, expiresAt: tokenData.expiresAt } : null
      };
    };
    
    // Emit to both users
    const roomA = this.getUserRoom(a.userId);
    const roomB = this.getUserRoom(b.userId);
    this.logger.debug(`Emitting match.matched to rooms ${roomA} and ${roomB}`);
    
    this.server.to(roomA).emit("match.matched", payloadFor(a.userId));
    this.server.to(roomB).emit("match.matched", payloadFor(b.userId));
    this.server.in(roomA).socketsJoin(`session:${session.id}`);
    this.server.in(roomB).socketsJoin(`session:${session.id}`);
  }

  private startPeriodicMatching(client: Socket, userId: string, region: string, language: string, latitude?: number, longitude?: number) {
      // Clear any existing interval for this user
      const existingInterval = this.matchingIntervals.get(userId);
      if (existingInterval) {
        clearInterval(existingInterval);
        this.matchingIntervals.delete(userId);
      }
    
    const checkInterval = setInterval(async () => {
      try {
        // Check if client is still connected
        if (!client.connected) {
          clearInterval(checkInterval);
          this.matchingIntervals.delete(userId);
          return;
        }
        
        // Add small random delay (0-500ms) to avoid all users checking at exactly the same time
        // This reduces race conditions when multiple users join simultaneously
        const randomDelay = Math.floor(Math.random() * 500);
        await new Promise(resolve => setTimeout(resolve, randomDelay));
        
        // Try to find a match by checking queue again (with distance-based matching)
        const pair = await this.matchmakingService.findMatch(userId, region, language, latitude, longitude);
        if (pair) {
          clearInterval(checkInterval);
          this.matchingIntervals.delete(userId);
          this.logger.log(`Periodic match found for user ${userId} with ${pair[0].userId === userId ? pair[1].userId : pair[0].userId}`);
          await this.handleMatch(pair);
        } else {
          // Log periodic check (but not too frequently)
          const queueKey = `match_queue:${region}:${language}`;
          // This is just for debugging - we can remove the console.log later
        }
      } catch (error) {
        this.logger.error("Periodic matching error:", error);
        clearInterval(checkInterval);
        this.matchingIntervals.delete(userId);
        client.emit("error", { message: "Matchmaking error occurred" });
      }
    }, this.configService.get<number>("intervals.matchmakingCheck") || 2000);
    
    this.matchingIntervals.set(userId, checkInterval);

    // Clean up interval when client disconnects
    // Use a delay to allow for reconnection - if user reconnects quickly, they stay in queue
    client.once("disconnect", () => {
      clearInterval(checkInterval);
      this.matchingIntervals.delete(userId);
      
      // Delay removing from queue to allow for quick reconnection
      // If user reconnects within 2 seconds, they'll rejoin queue and this removal will be harmless
      setTimeout(() => {
        // Double-check user hasn't rejoined (check if new interval exists)
        if (!this.matchingIntervals.has(userId)) {
          this.matchmakingService.leaveQueue(userId);
          this.logger.debug(`Removed user ${userId} from queue after disconnect (no reconnection)`);
        } else {
          this.logger.debug(`User ${userId} reconnected, keeping in queue`);
        }
      }, 2000); // 2 second grace period for reconnection
    });
  }

  @UseGuards(WsJwtGuard)
  @SubscribeMessage("match.leave")
  async handleMatchLeave(@ConnectedSocket() client: Socket) {
    const user = (client as any).user;
    await this.matchmakingService.leaveQueue(user.sub);
    client.emit("match.left", { ok: true });
  }

  @UseGuards(WsJwtGuard)
  @SubscribeMessage("session.join")
  async handleSessionJoin(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: { sessionId: string }
  ) {
    let session: any = null;
    try {
      const user = (client as any).user;
      if (!user || !user.sub) {
        client.emit("error", { message: "Authentication required" });
        return;
      }
      session = await this.sessionsService.getSession(body.sessionId);
      if (!session) {
        client.emit("error", { message: "Session not found" });
        return;
      }
      if (session.userAId !== user.sub && session.userBId !== user.sub) {
        client.emit("error", { message: "Not authorized for this session" });
        return;
      }
      client.join(`session:${body.sessionId}`);
      const peerId = session.userAId === user.sub ? session.userBId : session.userAId;
      const channelName = session.videoChannelName;
      
      // Try to generate video token, but don't fail if Agora is not configured
      let videoToken = null;
      try {
        const token = this.videoService.buildToken(channelName, user.sub);
        videoToken = { channelName, token: token.token, expiresAt: token.expiresAt };
      } catch (error: any) {
        // If Agora is not configured, continue without video token
        if (error.message?.includes("Agora") || error.message?.includes("AGORA")) {
          this.logger.warn("⚠️ Agora credentials not configured - session ready without video token");
        } else {
          // For other errors, re-throw to be caught by outer catch
          throw error;
        }
      }
      
      // Fetch both users' display info for the session UI
      const [myProfile, peerProfile] = await Promise.all([
        this.prisma.user.findUnique({
          where: { id: user.sub },
          select: { id: true, displayName: true, username: true, wallet: { select: { balanceTokens: true } } }
        }),
        this.prisma.user.findUnique({
          where: { id: peerId },
          select: { id: true, displayName: true, username: true, wallet: { select: { balanceTokens: true } } }
        })
      ]);

      // Emit session.ready to the joining client
      client.emit("session.ready", {
        sessionId: session.id,
        peer: {
          id: peerId,
          displayName: peerProfile?.displayName || peerProfile?.username || 'Opponent',
          username: peerProfile?.username || null,
          tokens: peerProfile?.wallet?.balanceTokens ?? 0
        },
        me: {
          id: user.sub,
          displayName: myProfile?.displayName || myProfile?.username || 'You',
          username: myProfile?.username || null,
          tokens: myProfile?.wallet?.balanceTokens ?? 0
        },
        video: videoToken
      });
      
      // Notify the peer that this user has joined the session
      // This ensures both users know when the other is ready
      this.server.to(`session:${body.sessionId}`).emit("session.peerJoined", {
        sessionId: session.id,
        userId: user.sub,
        peerId: peerId
      });
      
      this.logger.log(`User ${user.sub} joined session ${body.sessionId}, peer: ${peerId}`);
    } catch (error: any) {
      this.logger.error("Error in session.join:", error);
      // Don't send Agora-related errors to client - they're non-critical
      if (error.message?.includes("Agora") || error.message?.includes("AGORA")) {
        this.logger.warn("⚠️ Agora error in session.join - sending session.ready without video");
        // Still send session.ready, just without video token (only if we have session data)
        if (session) {
          const user = (client as any).user;
          if (user && user.sub) {
            const peerId = session.userAId === user.sub ? session.userBId : session.userAId;
            const [myP, peerP] = await Promise.all([
              this.prisma.user.findUnique({ where: { id: user.sub }, select: { displayName: true, username: true, wallet: { select: { balanceTokens: true } } } }),
              this.prisma.user.findUnique({ where: { id: peerId }, select: { displayName: true, username: true, wallet: { select: { balanceTokens: true } } } })
            ]);
            client.emit("session.ready", {
              sessionId: session.id,
              peer: { id: peerId, displayName: peerP?.displayName || peerP?.username || 'Opponent', username: peerP?.username || null, tokens: peerP?.wallet?.balanceTokens ?? 0 },
              me: { id: user.sub, displayName: myP?.displayName || myP?.username || 'You', username: myP?.username || null, tokens: myP?.wallet?.balanceTokens ?? 0 },
              video: null
            });
            return;
          }
        }
      }
      client.emit("error", { message: error.message || "Failed to join session" });
    }
  }

  @UseGuards(WsJwtGuard)
  @SubscribeMessage("session.startGame")
  async handleStartGame(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: { sessionId: string; gameType: string }
  ) {
    const user = (client as any).user;
    const session = await this.sessionsService.getSession(body.sessionId);
    if (!session || (session.userAId !== user.sub && session.userBId !== user.sub)) {
      client.emit("error", { message: "Session not found or unauthorized" });
      return;
    }
    
    try {
      // Create the game
      const game = await this.gamesService.createGame(
        body.sessionId,
        body.gameType as GameType,
        [session.userAId, session.userBId]
      );
      
      // Start the game (initialize state)
      const startedGame = await this.gamesService.startGame(game.id);
      
      // Join both users to the game room
      this.server.in(`session:${body.sessionId}`).socketsJoin(`game:${game.id}`);
      
      // For trivia games, update player display names in state
      let finalState = startedGame.state;
      if (startedGame.type === GameType.TRIVIA && finalState) {
        const triviaState = this.triviaService.getState(startedGame.id);
        if (triviaState) {
          // Update player display names
          const playersWithNames = triviaState.players.map(p => {
            const gamePlayer = startedGame.players.find(gp => gp.userId === p.odUserId);
            return {
              ...p,
              displayName: gamePlayer?.user.displayName || p.displayName
            };
          });
          const updatedTriviaState = {
            ...triviaState,
            players: playersWithNames
          };
          this.triviaService.setState(startedGame.id, updatedTriviaState);
          finalState = updatedTriviaState as any;
        }
      } else if (startedGame.type === GameType.TRUTHS_AND_LIE && finalState) {
        // Ensure truths and lie state is properly set
        const truthsAndLieState = this.truthsAndLieService.getState(startedGame.id);
        if (truthsAndLieState) {
          finalState = truthsAndLieState as any;
        }
      } else if (startedGame.type === GameType.BILLIARDS && finalState) {
        // Ensure billiards state is properly set
        const billiardsState = this.billiardsService.getState(startedGame.id);
        if (billiardsState) {
          finalState = billiardsState as any;
        }
      } else if (startedGame.type === GameType.POKER && finalState) {
        // Ensure poker state is properly set
        const pokerState = this.pokerService.getState(startedGame.id);
        if (pokerState) {
          finalState = pokerState as any;
        }
      } else if (startedGame.type === GameType.TWENTY_ONE_QUESTIONS && finalState) {
        // Ensure twenty-one-questions state is properly set
        const questionsState = this.twentyOneQuestionsService.getState(startedGame.id);
        if (questionsState) {
          finalState = questionsState as any;
        }
      } else if (startedGame.type === GameType.TANKS && finalState) {
        const tanksState = this.tanksService.getState(startedGame.id);
        if (tanksState) {
          finalState = tanksState as any;
        }
      } else if (startedGame.type === GameType.GEO_GUESSER && finalState) {
        // Update GeoGuesser player display names in state
        const ggState = this.geoGuesserService.getState(startedGame.id);
        if (ggState) {
          for (const player of ggState.players) {
            const gp = startedGame.players.find(p => p.userId === player.userId);
            if (gp) player.displayName = gp.user.displayName || player.displayName;
          }
          this.geoGuesserService.setState(startedGame.id, ggState);
          finalState = ggState as any;
        }
      }
      
      // For UNO, send each player their own sanitized state (hides opponent's hand)
      if (startedGame.type === GameType.UNO && finalState) {
        const sessionSockets = await this.server.in(`session:${body.sessionId}`).fetchSockets();
        for (const s of sessionSockets) {
          const su = (s as any).user;
          if (su) {
            const sanitized = this.unoService.sanitizeForPlayer(finalState as any, su.sub);
            s.emit("game.started", {
              gameId: startedGame.id,
              gameType: startedGame.type,
              state: sanitized,
              players: startedGame.players.map(p => ({
                odUserId: p.userId,
                side: p.side,
                displayName: p.user.displayName
              }))
            });
          }
        }
      } else {
        // Emit game started event with full game data
        this.server.to(`session:${body.sessionId}`).emit("game.started", {
          gameId: startedGame.id,
          gameType: startedGame.type,
          state: finalState,
          players: startedGame.players.map(p => ({
            odUserId: p.userId,
            side: p.side,
            displayName: p.user.displayName
          }))
        });
      }
      
      // For trivia, game starts in themeSelection phase - no need to start questions yet
      // Questions will start after both players select themes

      // For GeoGuesser, start round 1 immediately after a short delay
      if (startedGame.type === GameType.GEO_GUESSER) {
        setTimeout(() => {
          this.startGeoGuesserRound(startedGame.id, `session:${body.sessionId}`);
        }, 3000);
      }

      // For Tanks, start the real-time game loop
      if (startedGame.type === GameType.TANKS) {
        this.startTanksGameLoop(startedGame.id, `session:${body.sessionId}`);
      }
      
      this.logger.log(`Game ${startedGame.id} (${startedGame.type}) started for session ${body.sessionId}`);
    } catch (error: any) {
      this.logger.error("Failed to start game:", error);
      client.emit("error", { message: error.message || "Failed to start game" });
    }
  }

  @UseGuards(WsJwtGuard)
  @SubscribeMessage("session.cancelGame")
  async handleCancelGame(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: { sessionId: string }
  ) {
    const user = (client as any).user;
    const session = await this.sessionsService.getSession(body.sessionId);
    if (!session || (session.userAId !== user.sub && session.userBId !== user.sub)) {
      client.emit("error", { message: "Session not found or unauthorized" });
      return;
    }

    // Notify both users that the game was cancelled
    this.server.to(`session:${body.sessionId}`).emit("game.cancelled", {
      sessionId: body.sessionId,
      cancelledBy: user.sub
    });

    this.logger.log(`Game cancelled for session ${body.sessionId} by user ${user.sub}`);
  }

  // ==================== GAME EVENTS ====================

  @UseGuards(WsJwtGuard)
  @SubscribeMessage("game.join")
  async handleGameJoin(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: { gameId: string }
  ) {
    const user = (client as any).user;
    
    try {
      const game = await this.gamesService.getGame(body.gameId);
      
      // Verify user is a player in this game
      const isPlayer = game.players.some(p => p.userId === user.sub);
      if (!isPlayer) {
        client.emit("error", { message: "You are not a player in this game" });
        return;
      }
      
      // Join game room
      client.join(`game:${body.gameId}`);
      
      // Send current game state
      client.emit("game.state", {
        gameId: game.id,
        gameType: game.type,
        status: game.status,
        state: game.state,
        players: game.players.map(p => ({
          odUserId: p.userId,
          side: p.side,
          displayName: p.user.displayName
        }))
      });
    } catch (error: any) {
      client.emit("error", { message: error.message || "Failed to join game" });
    }
  }

  @UseGuards(WsJwtGuard)
  @UsePipes(new ValidationPipe({ 
    whitelist: true, 
    forbidNonWhitelisted: true,
    transform: true,
    exceptionFactory: (errors) => new WsException(errors)
  }))
  @SubscribeMessage("game.move")
  async handleGameMove(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: GameMoveDto
  ) {
    const user = (client as any).user;
    
    try {
      const game = await this.gamesService.getGame(body.gameId);
      
      // SECURITY: Verify user is a player in this game
      this.assertPlayerInGame(game, user.sub);
      
      // Handle different game types
      if (game.type === GameType.TICTACTOE) {
        if (body.cellIndex === undefined) {
          client.emit("game.error", { message: "Cell index required for TicTacToe" });
          return;
        }
        
        const result = await this.ticTacToeService.makeMove(body.gameId, user.sub, body.cellIndex);
        
        if (!result.success) {
          client.emit("game.error", { message: result.error });
          return;
        }
        
        // Broadcast state update to all players in the game
        this.server.to(`game:${body.gameId}`).emit("game.stateUpdate", {
          gameId: body.gameId,
          state: result.state,
          lastMove: {
            cell: body.cellIndex,
            player: result.state?.currentTurn === "X" ? "O" : "X" // The player who just moved
          }
        });
        
        // Check if game ended (winner is set OR it's a draw)
        if (result.winner !== null || result.isDraw) {
          const winnerPlayer = result.winner 
            ? game.players.find(p => p.userId === result.winner)
            : null;
          
          this.server.to(`game:${body.gameId}`).emit("game.end", {
            gameId: body.gameId,
            winnerId: result.winner,
            winnerName: winnerPlayer?.user.displayName || null,
            isDraw: result.isDraw,
            reason: result.isDraw ? "draw" : "win",
            winningLine: result.winningLine
          });
          
          this.logger.log(`Game ${body.gameId} ended - Winner: ${result.winner || "Draw"}`);
        }
      } else if (game.type === GameType.CHESS) {
        if (!body.from || !body.to) {
          client.emit("game.error", { message: "From and to positions required for Chess" });
          return;
        }
        
        // Get current game state
        const currentState = game.state as any;
        if (!currentState) {
          client.emit("game.error", { message: "Game state not found" });
          return;
        }
        
        // Make the chess move
        const result = this.chessService.makeMove(
          currentState,
          user.sub,
          body.from,
          body.to,
          body.promotionPiece
        );
        
        if (!result.success) {
          client.emit("game.error", { message: result.error });
          return;
        }
        
        // Update game state in database
        await this.prisma.game.update({
          where: { id: body.gameId },
          data: {
            state: result.state as any,
            ...(result.gameEnded ? {
              status: "COMPLETED",
              endedAt: new Date(),
              winnerUserId: result.winner || null
            } : {})
          }
        });
        
        // Broadcast state update
        this.server.to(`game:${body.gameId}`).emit("game.stateUpdate", {
          gameId: body.gameId,
          state: result.state,
          lastMove: result.move ? {
            from: body.from,
            to: body.to,
            notation: result.move.notation,
            piece: result.move.piece
          } : undefined
        });
        
        // Check if game ended
        if (result.gameEnded) {
          const winnerPlayer = result.winner 
            ? game.players.find(p => p.userId === result.winner)
            : null;
          
          this.server.to(`game:${body.gameId}`).emit("game.end", {
            gameId: body.gameId,
            winnerId: result.winner,
            winnerName: winnerPlayer?.user.displayName || null,
            isDraw: result.isDraw,
            reason: result.state?.isCheckmate ? "checkmate" : 
                    result.state?.isStalemate ? "stalemate" :
                    result.state?.drawReason || "game_over"
          });
          
          this.logger.log(`Chess game ${body.gameId} ended - Winner: ${result.winner || "Draw"}`);
        }
      } else if (game.type === GameType.CONNECT_FOUR) {
        if (body.colIndex === undefined) {
          client.emit("game.error", { message: "Column index required for Connect Four" });
          return;
        }

        const result = await this.connectFourService.makeMove(body.gameId, user.sub, body.colIndex);

        if (!result.success) {
          client.emit("game.error", { message: result.error });
          return;
        }

        this.server.to(`game:${body.gameId}`).emit("game.stateUpdate", {
          gameId: body.gameId,
          state: result.state,
          lastMove: { col: body.colIndex, row: result.state?.moveHistory?.slice(-1)[0]?.row }
        });

        if (result.winner !== null || result.isDraw) {
          const winnerPlayer = result.winner
            ? game.players.find(p => p.userId === result.winner)
            : null;

          this.server.to(`game:${body.gameId}`).emit("game.end", {
            gameId: body.gameId,
            winnerId: result.winner,
            winnerName: winnerPlayer?.user.displayName || null,
            isDraw: result.isDraw,
            reason: result.isDraw ? "draw" : "win",
            winningCells: result.winningCells
          });

          this.logger.log(`Connect Four game ${body.gameId} ended - Winner: ${result.winner || "Draw"}`);
        }
      } else if (game.type === GameType.CHECKERS) {
        if (!body.from || !body.to) {
          client.emit("game.error", { message: "From and to positions required for Checkers" });
          return;
        }

        const result = await this.checkersService.makeMove(
          body.gameId,
          user.sub,
          body.from as any,
          body.to as any
        );

        if (!result.success) {
          client.emit("game.error", { message: result.error });
          return;
        }

        this.server.to(`game:${body.gameId}`).emit("game.stateUpdate", {
          gameId: body.gameId,
          state: result.state,
          lastMove: { from: body.from, to: body.to }
        });

        if (result.winner !== null || result.isDraw) {
          const winnerPlayer = result.winner
            ? game.players.find(p => p.userId === result.winner)
            : null;

          this.server.to(`game:${body.gameId}`).emit("game.end", {
            gameId: body.gameId,
            winnerId: result.winner,
            winnerName: winnerPlayer?.user.displayName || null,
            isDraw: result.isDraw,
            reason: result.isDraw ? "draw" : "win"
          });

          this.logger.log(`Checkers game ${body.gameId} ended - Winner: ${result.winner || "Draw"}`);
        }
      } else if (game.type === GameType.MEMORY_CARDS) {
        if (body.cardIndex === undefined) {
          client.emit("game.error", { message: "Card index required for Memory Cards" });
          return;
        }

        const result = await this.memoryService.makeMove(body.gameId, user.sub, body.cardIndex);

        if (!result.success) {
          client.emit("game.error", { message: result.error });
          return;
        }

        this.server.to(`game:${body.gameId}`).emit("game.stateUpdate", {
          gameId: body.gameId,
          state: result.state
        });

        if (result.winner !== undefined || result.isDraw) {
          const winnerPlayer = result.winner
            ? game.players.find(p => p.userId === result.winner)
            : null;

          this.server.to(`game:${body.gameId}`).emit("game.end", {
            gameId: body.gameId,
            winnerId: result.winner,
            winnerName: winnerPlayer?.user.displayName || null,
            isDraw: result.isDraw,
            reason: result.isDraw ? "draw" : "win"
          });

          this.logger.log(`Memory Cards game ${body.gameId} ended - Winner: ${result.winner || "Draw"}`);
        } else if (result.pendingFlipBack) {
          // Server-side 1.5s timer to auto-flip cards back
          const gameIdForTimer = body.gameId;
          const roomKey = `game:${gameIdForTimer}`;
          setTimeout(async () => {
            try {
              const flipResult = await this.memoryService.flipBack(gameIdForTimer);
              if (flipResult) {
                this.server.to(roomKey).emit("game.stateUpdate", {
                  gameId: gameIdForTimer,
                  state: flipResult.state
                });
              }
            } catch (err) {
              this.logger.error(`Memory flip-back error for game ${gameIdForTimer}:`, err);
            }
          }, 1500);
        }
      } else if (game.type === GameType.UNO) {
        if (!body.unoMoveType) {
          client.emit("game.error", { message: "unoMoveType required for UNO" });
          return;
        }

        const result = await this.unoService.makeMove(body.gameId, user.sub, {
          type: body.unoMoveType,
          cardId: body.unoCardId,
          chosenColor: body.unoChosenColor as any,
        });

        if (!result.success) {
          client.emit("game.error", { message: result.error });
          return;
        }

        // Send each player their own sanitized state so neither can see the other's hand
        const unoGameSockets = await this.server.in(`game:${body.gameId}`).fetchSockets();
        if (unoGameSockets.length > 0) {
          for (const s of unoGameSockets) {
            const su = (s as any).user;
            if (su) {
              s.emit("game.stateUpdate", {
                gameId: body.gameId,
                state: this.unoService.sanitizeForPlayer(result.state!, su.sub)
              });
            }
          }
        } else {
          // Fallback: broadcast full state (client renders only own hand)
          this.server.to(`game:${body.gameId}`).emit("game.stateUpdate", {
            gameId: body.gameId,
            state: result.state
          });
        }

        if (result.winner !== null || result.isDraw) {
          const winnerPlayer = result.winner
            ? game.players.find(p => p.userId === result.winner)
            : null;

          this.server.to(`game:${body.gameId}`).emit("game.end", {
            gameId: body.gameId,
            winnerId: result.winner,
            winnerName: winnerPlayer?.user.displayName || null,
            isDraw: result.isDraw,
            reason: result.isDraw ? "draw" : "win",
          });

          this.logger.log(`UNO game ${body.gameId} ended - Winner: ${result.winner || "Draw"}`);
        }
      } else {
        client.emit("game.error", { message: "Game type not supported yet" });
      }
    } catch (error: any) {
      this.logger.error("Game move error:", error);
      client.emit("game.error", { message: error.message || "Failed to make move" });
    }
  }
  
  @UseGuards(WsJwtGuard)
  @SubscribeMessage("game.forfeit")
  async handleGameForfeit(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: { gameId: string }
  ) {
    const user = (client as any).user;
    
    try {
      const game = await this.gamesService.getGame(body.gameId);
      
      if (game.type === GameType.TICTACTOE) {
        const result = await this.ticTacToeService.forfeitGame(body.gameId, user.sub);
        
        const winnerPlayer = game.players.find(p => p.userId === result.winnerId);
        
        this.server.to(`game:${body.gameId}`).emit("game.end", {
          gameId: body.gameId,
          winnerId: result.winnerId,
          winnerName: winnerPlayer?.user.displayName || null,
          isDraw: false,
          reason: "forfeit",
          forfeitedBy: user.sub
        });
        
        this.logger.log(`Game ${body.gameId} forfeited by ${user.sub}`);
      } else if (game.type === GameType.CHESS) {
        // Get current game state
        const currentState = game.state as any;
        if (!currentState) {
          client.emit("game.error", { message: "Game state not found" });
          return;
        }
        
        const result = this.chessService.forfeitGame(currentState, user.sub);
        
        // Update game in database
        await this.prisma.game.update({
          where: { id: body.gameId },
          data: {
            status: "COMPLETED",
            endedAt: new Date(),
            winnerUserId: result.winnerId
          }
        });
        
        const winnerPlayer = game.players.find(p => p.userId === result.winnerId);
        
        this.server.to(`game:${body.gameId}`).emit("game.end", {
          gameId: body.gameId,
          winnerId: result.winnerId,
          winnerName: winnerPlayer?.user.displayName || null,
          isDraw: false,
          reason: "resignation",
          forfeitedBy: user.sub
        });
        
        this.logger.log(`Chess game ${body.gameId} forfeited by ${user.sub}`);
      } else if (game.type === GameType.CHECKERS) {
        const result = await this.checkersService.forfeitGame(body.gameId, user.sub);
        const winnerPlayer = game.players.find(p => p.userId === result.winnerId);

        this.server.to(`game:${body.gameId}`).emit("game.end", {
          gameId: body.gameId,
          winnerId: result.winnerId,
          winnerName: winnerPlayer?.user.displayName || null,
          isDraw: false,
          reason: "forfeit",
          forfeitedBy: user.sub
        });

        this.logger.log(`Checkers game ${body.gameId} forfeited by ${user.sub}`);
      } else if (game.type === GameType.MEMORY_CARDS) {
        const result = await this.memoryService.forfeitGame(body.gameId, user.sub);
        const winnerPlayer = game.players.find(p => p.userId === result.winnerId);

        this.server.to(`game:${body.gameId}`).emit("game.end", {
          gameId: body.gameId,
          winnerId: result.winnerId,
          winnerName: winnerPlayer?.user.displayName || null,
          isDraw: false,
          reason: "forfeit",
          forfeitedBy: user.sub
        });

        this.logger.log(`Memory Cards game ${body.gameId} forfeited by ${user.sub}`);
      } else if (game.type === GameType.UNO) {
        const result = await this.unoService.forfeitGame(body.gameId, user.sub);
        const winnerPlayer = game.players.find(p => p.userId === result.winnerId);

        this.server.to(`game:${body.gameId}`).emit("game.end", {
          gameId: body.gameId,
          winnerId: result.winnerId,
          winnerName: winnerPlayer?.user.displayName || null,
          isDraw: false,
          reason: "forfeit",
          forfeitedBy: user.sub
        });

        this.logger.log(`UNO game ${body.gameId} forfeited by ${user.sub}`);
      } else {
        client.emit("game.error", { message: "Game type not supported yet" });
      }
    } catch (error: any) {
      this.logger.error("Game forfeit error:", error);
      client.emit("game.error", { message: error.message || "Failed to forfeit game" });
    }
  }

  @UseGuards(WsJwtGuard)
  @SubscribeMessage("session.end")
  async handleSessionEnd(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: { sessionId: string }
  ) {
    const user = (client as any).user;
    await this.sessionsService.endSession(body.sessionId, user.sub, "USER_LEFT");
    // Notify the other player that this user left (not the sender)
    client.to(`session:${body.sessionId}`).emit("session.peerLeft", { userId: user.sub, sessionId: body.sessionId });
    // Also emit session.end to the whole room (including sender) for cleanup
    this.server.to(`session:${body.sessionId}`).emit("session.end", { sessionId: body.sessionId, leavingUserId: user.sub });
  }

  @UseGuards(WsJwtGuard)
  @UsePipes(new ValidationPipe({ 
    whitelist: true, 
    forbidNonWhitelisted: true,
    transform: true,
    exceptionFactory: (errors) => new WsException(errors)
  }))
  @SubscribeMessage("session.sendGift")
  async handleSendGift(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: SendGiftDto
  ) {
    const user = (client as any).user;
    
    try {
      // Get session to find the recipient
      const session = await this.sessionsService.getSession(body.sessionId);
      if (!session) {
        client.emit("error", { message: "Session not found" });
        return;
      }
      
      // Determine recipient (the other user in the session)
      const receiverUserId = session.userAId === user.sub ? session.userBId : session.userAId;
      
      // Validate amount
      if (!body.amountTokens || body.amountTokens <= 0) {
        client.emit("error", { message: "Invalid gift amount" });
        return;
      }
      
      // Perform the actual gift transfer
      const result = await this.walletService.sendGift(
        user.sub,
        receiverUserId,
        body.amountTokens,
        body.sessionId
      );
      
      this.logger.log(`Gift sent: ${user.sub} -> ${receiverUserId}, amount: ${body.amountTokens}`);
      
      // Notify both users
      this.server.to(`session:${body.sessionId}`).emit("session.giftReceived", {
        from: user.sub,
        to: receiverUserId,
        amount: body.amountTokens,
        success: true
      });
      
      // Notify sender of their new balance
      client.emit("wallet.updated", { balance: result.senderBalance });
      
    } catch (error: any) {
      this.logger.error("Gift transfer failed:", error.message);
      client.emit("error", { message: error.message || "Failed to send gift" });
    }
  }

  @UseGuards(WsJwtGuard)
  @SubscribeMessage("session.report")
  async handleSessionReport(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: { sessionId: string; reason: string; comment?: string }
  ) {
    const user = (client as any).user;
    
    try {
      // Get session to find the reported user
      const session = await this.sessionsService.getSession(body.sessionId);
      if (!session) {
        client.emit("error", { message: "Session not found" });
        return;
      }
      
      // Determine reported user (the other user in the session)
      const reportedUserId = session.userAId === user.sub ? session.userBId : session.userAId;
      
      // Create the report in database
      const report = await this.reportsService.createReport(
        user.sub,
        reportedUserId,
        body.reason as any, // Will be converted to enum in service
        body.comment,
        body.sessionId
      );
      
      this.logger.log(`Report created: ${user.sub} reported ${reportedUserId} for ${body.reason}`);
      
      client.emit("session.reportSubmitted", { 
        success: true, 
        reportId: report.id,
        message: "Report submitted successfully. Our team will review it."
      });
      
    } catch (error: any) {
      this.logger.error("Report creation failed:", error.message);
      client.emit("error", { message: error.message || "Failed to submit report" });
    }
  }

  // ==================== ROOM EVENTS ====================

  @UseGuards(WsJwtGuard)
  @UsePipes(new ValidationPipe({ 
    whitelist: true, 
    forbidNonWhitelisted: true,
    transform: true,
    exceptionFactory: (errors) => new WsException(errors)
  }))
  @SubscribeMessage("room.join")
  async handleRoomJoin(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: RoomJoinDto
  ) {
    const user = (client as any).user;
    
    try {
      const room = await this.roomsService.joinRoom(user.sub, body.roomId, body.password);
      
      // Join socket room
      client.join(`room:${body.roomId}`);
      
      // Notify all room participants
      this.server.to(`room:${body.roomId}`).emit("room.userJoined", {
        userId: user.sub,
        room
      });
      
      client.emit("room.joined", { room });
    } catch (error: any) {
      // If user is already in the room, just get the room state and send it
      if (error.message === "Already in this room") {
        try {
          const room = await this.roomsService.getRoomDetails(body.roomId);
          client.join(`room:${body.roomId}`);
          client.emit("room.joined", { room });
          return;
        } catch (innerError: any) {
          client.emit("room.error", { message: innerError.message || "Failed to get room state" });
          return;
        }
      }
      client.emit("room.error", { message: error.message || "Failed to join room" });
    }
  }

  @UseGuards(WsJwtGuard)
  @SubscribeMessage("room.leave")
  async handleRoomLeave(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: { roomId: string }
  ) {
    const user = (client as any).user;
    
    try {
      const result = await this.roomsService.leaveRoom(user.sub, body.roomId);
      
      client.leave(`room:${body.roomId}`);
      
      if (result.roomEnded) {
        // Clean up any voting timers for this room's rounds
        // We need to find the current round ID from the room
        const room = await this.roomsService.getRoomDetails(body.roomId);
        if (room.currentRoundId) {
          const timer = this.votingTimers.get(room.currentRoundId);
          if (timer) {
            clearTimeout(timer);
            this.votingTimers.delete(room.currentRoundId);
          }
        }
        this.server.to(`room:${body.roomId}`).emit("room.ended", { roomId: body.roomId });
      } else {
        this.server.to(`room:${body.roomId}`).emit("room.userLeft", { userId: user.sub });
      }
      
      client.emit("room.left", { success: true });
    } catch (error: any) {
      client.emit("room.error", { message: error.message || "Failed to leave room" });
    }
  }

  @UseGuards(WsJwtGuard)
  @SubscribeMessage("room.startRound")
  async handleStartRound(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: { roomId: string; entryFeeTokens: number }
  ) {
    const user = (client as any).user;
    
    try {
      const round = await this.roomsService.startRound(body.roomId, user.sub, body.entryFeeTokens);
      
      this.server.to(`room:${body.roomId}`).emit("room.roundStarted", {
        round,
        entryFeeTokens: body.entryFeeTokens
      });
    } catch (error: any) {
      client.emit("room.error", { message: error.message || "Failed to start round" });
    }
  }

  @UseGuards(WsJwtGuard)
  @SubscribeMessage("room.joinRound")
  async handleJoinRound(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: { roomId: string; roundId: string }
  ) {
    const user = (client as any).user;
    
    try {
      const round = await this.roomsService.joinRound(body.roomId, body.roundId, user.sub);
      
      // Broadcast updated round to all
      this.server.to(`room:${body.roomId}`).emit("room.roundUpdated", { round });
      
      // Update user's wallet balance
      const wallet = await this.walletService.getWallet(user.sub);
      client.emit("wallet.updated", { balance: wallet?.balanceTokens || 0 });
    } catch (error: any) {
      client.emit("room.error", { message: error.message || "Failed to join round" });
    }
  }

  @UseGuards(WsJwtGuard)
  @SubscribeMessage("room.startVoting")
  async handleStartVoting(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: { roomId: string; roundId: string }
  ) {
    const user = (client as any).user;
    
    try {
      const result = await this.roomsService.startVoting(body.roomId, body.roundId, user.sub);
      
      // Notify all participants
      this.server.to(`room:${body.roomId}`).emit("room.votingStarted", {
        roundId: body.roundId,
        votingEndsAt: result.votingEndsAt
      });
      
      // Clear any existing timer for this round (in case of restart)
      const existingTimer = this.votingTimers.get(body.roundId);
      if (existingTimer) {
        clearTimeout(existingTimer);
      }

      // Set timer to auto-finalize voting
      const timer = setTimeout(async () => {
        try {
          const gameResult = await this.roomsService.finalizeVotingAndStartGame(body.roundId);
          if (gameResult) {
            this.server.to(`room:${body.roomId}`).emit("room.gameStarting", {
              roundId: body.roundId,
              gameType: gameResult.gameType
            });
          }
        } catch (err) {
          this.logger.error("Failed to finalize voting:", err);
        } finally {
          this.votingTimers.delete(body.roundId);
        }
      }, this.configService.get<number>("intervals.votingDuration") || 20000);
      
      this.votingTimers.set(body.roundId, timer);
    } catch (error: any) {
      client.emit("room.error", { message: error.message || "Failed to start voting" });
    }
  }

  @UseGuards(WsJwtGuard)
  @UsePipes(new ValidationPipe({ 
    whitelist: true, 
    forbidNonWhitelisted: true,
    transform: true,
    exceptionFactory: (errors) => new WsException(errors)
  }))
  @SubscribeMessage("room.vote")
  async handleVote(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: RoomVoteDto
  ) {
    const user = (client as any).user;
    
    try {
      const results = await this.roomsService.voteForGame(body.roundId, user.sub, body.gameType);
      
      // Broadcast vote results to all
      this.server.to(`room:${body.roomId}`).emit("room.voteUpdate", {
        roundId: body.roundId,
        results
      });
    } catch (error: any) {
      client.emit("room.error", { message: error.message || "Failed to vote" });
    }
  }

  @UseGuards(WsJwtGuard)
  @SubscribeMessage("room.gameMove")
  async handleRoomGameMove(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: { roomId: string; roundId: string; cellIndex: number }
  ) {
    const user = (client as any).user;
    
    try {
      // Get round to find the game ID
      const round = await this.roomsService.getRoundDetails(body.roundId);
      
      if (!round.gameId) {
        client.emit("room.error", { message: "No game in progress" });
        return;
      }
      
      // Make the move using TicTacToe service
      const result = await this.ticTacToeService.makeMove(round.gameId, user.sub, body.cellIndex);
      
      if (!result.success) {
        client.emit("room.error", { message: result.error });
        return;
      }
      
      // Broadcast state update
      this.server.to(`room:${body.roomId}`).emit("room.gameStateUpdate", {
        roundId: body.roundId,
        state: result.state,
        lastMove: { cell: body.cellIndex }
      });
      
      // Check if game ended (winner is set OR it's a draw)
      if (result.winner !== null || result.isDraw) {
        const payout = await this.roomsService.completeRound(
          body.roundId,
          result.winner || null,
          result.isDraw || false
        );
        
        this.server.to(`room:${body.roomId}`).emit("room.roundEnded", {
          roundId: body.roundId,
          winnerId: result.winner,
          isDraw: result.isDraw,
          winningLine: result.winningLine,
          payout: payout.payout
        });
        
        // Update winner's wallet
        if (result.winner) {
          const winnerWallet = await this.walletService.getWallet(result.winner);
          // Find the winner's socket and emit wallet update
          const sockets = await this.server.in(`room:${body.roomId}`).fetchSockets();
          for (const s of sockets) {
            if ((s as any).user?.sub === result.winner) {
              s.emit("wallet.updated", { balance: winnerWallet?.balanceTokens || 0 });
            }
          }
        }
      }
    } catch (error: any) {
      this.logger.error("Room game move error:", error);
      client.emit("room.error", { message: error.message || "Failed to make move" });
    }
  }

  @UseGuards(WsJwtGuard)
  @SubscribeMessage("room.getState")
  async handleGetRoomState(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: { roomId: string }
  ) {
    try {
      const room = await this.roomsService.getRoomDetails(body.roomId);
      client.emit("room.state", { room });
    } catch (error: any) {
      client.emit("room.error", { message: error.message || "Failed to get room state" });
    }
  }

  private getUserRoom(userId: string) {
    return `user:${userId}`;
  }

  // ==================== TRIVIA GAME HANDLERS ====================

  private triviaQuestionTimers = new Map<string, NodeJS.Timeout>();
  private triviaQuestionStartTimes = new Map<string, number>();

  private startTriviaQuestion(gameId: string, roomKey: string) {
    const state = this.triviaService.getState(gameId);
    if (!state || state.phase === "gameEnd") return;

    const question = this.triviaService.getCurrentQuestion(state);
    if (!question) {
      // No more questions, end game
      this.endTriviaGame(gameId, roomKey);
      return;
    }

    // Reset answers for new question
    const updatedState = {
      ...state,
      phase: "question" as const,
      currentAnswers: []
    };
    this.triviaService.setState(gameId, updatedState);

    // Emit state update so frontend knows we're in question phase
    this.server.to(roomKey).emit("game.stateUpdate", {
      gameId,
      state: updatedState
    });

    // Update database
    this.prisma.game.update({
      where: { id: gameId },
      data: { state: updatedState as any }
    }).catch((err: any) => this.logger.error("Failed to update game state:", err));

    // Record start time
    this.triviaQuestionStartTimes.set(gameId, Date.now());

    // Emit question start event
    this.server.to(roomKey).emit("trivia.questionStart", {
      gameId,
      questionIndex: updatedState.currentQuestionIndex,
      timeLimit: Math.floor((this.configService.get<number>("intervals.triviaQuestionDuration") || 10000) / 1000) // Convert ms to seconds (10 seconds)
    });

    // Set timer to end question after 10 seconds
    const timer = setTimeout(() => {
      this.endTriviaQuestion(gameId, roomKey);
    }, this.configService.get<number>("intervals.triviaQuestionDuration") || 10000);
    this.triviaQuestionTimers.set(gameId, timer);
  }

  private endTriviaQuestion(gameId: string, roomKey: string) {
    // Clear timer
    const timer = this.triviaQuestionTimers.get(gameId);
    if (timer) {
      clearTimeout(timer);
      this.triviaQuestionTimers.delete(gameId);
    }

    const state = this.triviaService.getState(gameId);
    if (!state) return;

    const question = this.triviaService.getCurrentQuestion(state);
    if (!question) return;

    const endedState = this.triviaService.endQuestion(state);
    this.triviaService.setState(gameId, endedState);

    const correctAnswerIndex = question.allAnswers.findIndex(
      a => a === question.correctAnswer
    );

    // Send results
    this.server.to(roomKey).emit("trivia.questionResult", {
      gameId,
      correctAnswer: question.correctAnswer,
      correctAnswerIndex,
      results: endedState.currentAnswers.map(answer => ({
        odUserId: answer.odUserId,
        displayName: answer.odUserDisplayName,
        selectedAnswer: answer.selectedAnswer,
        selectedAnswerIndex: answer.selectedAnswerIndex,
        isCorrect: answer.isCorrect,
        pointsEarned: answer.pointsEarned,
        timeToAnswer: answer.timeToAnswer
      })),
      scores: endedState.players
    });

    // Update state in database
    this.prisma.game.update({
      where: { id: gameId },
      data: { state: endedState as any }
    }).catch((err: any) => this.logger.error("Failed to update game state:", err));

    // After delay, either next question or end game
    setTimeout(() => {
      const currentState = this.triviaService.getState(gameId);
      if (!currentState) {
        this.logger.warn(`No state found for game ${gameId} when trying to advance`);
        return;
      }

      this.logger.log(`Advancing from question ${currentState.currentQuestionIndex} of ${currentState.questions.length}`);

      // Check if this was the last question (we're currently showing results for the last question)
      // If we just finished question index 9 (the 10th question), we should end the game
      if (currentState.currentQuestionIndex >= currentState.questions.length - 1) {
        // Game over - this was the last question
        this.logger.log(`Game ${gameId} ending - last question completed`);
        this.endTriviaGame(gameId, roomKey);
      } else {
        // Next question
        this.logger.log(`Advancing to next question for game ${gameId}`);
        const nextState = this.triviaService.advanceToNextQuestion(currentState);
        this.triviaService.setState(gameId, nextState);

        // Emit state update so frontend knows we're moving to next question
        this.server.to(roomKey).emit("game.stateUpdate", {
          gameId,
          state: nextState
        });

        // Update database
        this.prisma.game.update({
          where: { id: gameId },
          data: { state: nextState as any }
        }).catch((err: any) => this.logger.error("Failed to update game state:", err));

        // Brief pause, then start next question
        setTimeout(() => {
          this.logger.log(`Starting next question for game ${gameId}`);
          this.startTriviaQuestion(gameId, roomKey);
        }, this.configService.get<number>("intervals.triviaQuestionPause") || 2000);
      }
    }, this.configService.get<number>("intervals.triviaQuestionDelay") || 3000); // Reduced to 3 seconds
  }

  private endTriviaGame(gameId: string, roomKey: string) {
    // Clear any timers
    const timer = this.triviaQuestionTimers.get(gameId);
    if (timer) {
      clearTimeout(timer);
      this.triviaQuestionTimers.delete(gameId);
    }
    this.triviaQuestionStartTimes.delete(gameId);

    const state = this.triviaService.getState(gameId);
    if (!state) return;

    const finishedState = this.triviaService.endGame(state);
    const endResult = this.triviaService.getGameEndResult(finishedState);

    // Update database
    this.prisma.game.update({
      where: { id: gameId },
      data: {
        status: "COMPLETED" as any,
        endedAt: new Date(),
        winnerUserId: endResult.winnerId,
        state: finishedState as any
      }
    }).catch((err: any) => this.logger.error("Failed to update game state:", err));

    // Emit game end event
    this.server.to(roomKey).emit("trivia.gameEnd", {
      gameId,
      finalScores: endResult.finalScores,
      winnerId: endResult.winnerId,
      winnerIds: endResult.winnerIds,
      isDraw: endResult.isDraw
    });

    // Also emit standard game.end for consistency
    this.server.to(roomKey).emit("game.end", {
      gameId,
      winnerId: endResult.winnerId,
      isDraw: endResult.isDraw,
      reason: "completed"
    });

    // Clean up state
    this.triviaService.deleteState(gameId);
  }

  @UseGuards(WsJwtGuard)
  @UsePipes(new ValidationPipe({ 
    whitelist: true, 
    forbidNonWhitelisted: true,
    transform: true,
    exceptionFactory: (errors) => new WsException(errors)
  }))
  @SubscribeMessage("trivia.selectTheme")
  async handleTriviaThemeSelection(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: TriviaSelectThemeDto
  ) {
    const user = (client as any).user;

    try {
      const game = await this.gamesService.getGame(body.gameId);
      if (game.type !== GameType.TRIVIA) {
        client.emit("game.error", { message: "Not a trivia game" });
        return;
      }

      // SECURITY: Verify user is a player in this game
      this.assertPlayerInGame(game, user.sub);

      // Select theme
      const result = this.triviaService.selectTheme(
        body.gameId,
        user.sub,
        body.theme as any
      );

      // Get session ID from game
      const sessionId = game.sessionId;
      const roomKey = sessionId ? `session:${sessionId}` : `game:${body.gameId}`;

      // Update state in database
      await this.prisma.game.update({
        where: { id: body.gameId },
        data: { state: result.state as any }
      });

      // Emit theme selection update
      this.server.to(roomKey).emit("trivia.themeSelected", {
        gameId: body.gameId,
        userId: user.sub,
        theme: body.theme,
        allPlayersSelected: result.allPlayersSelected,
        selectedTheme: result.selectedTheme
      });

      // If all players selected, move to countdown and start game after delay
      if (result.allPlayersSelected && result.selectedTheme) {
        // Update state to countdown phase
        this.server.to(roomKey).emit("game.stateUpdate", {
          gameId: body.gameId,
          state: result.state
        });

        // Start the game after countdown
        setTimeout(() => {
          const countdownState = this.triviaService.getState(body.gameId);
          if (countdownState) {
            const startedState = this.triviaService.startGame(body.gameId, countdownState);
            this.triviaService.setState(body.gameId, startedState);
            
            this.server.to(roomKey).emit("game.stateUpdate", {
              gameId: body.gameId,
              state: startedState
            });

            // Start first question
            this.startTriviaQuestion(body.gameId, roomKey);
          }
        }, this.configService.get<number>("intervals.triviaCountdown") || 3000);
      }
    } catch (error: any) {
      this.logger.error("Trivia theme selection error:", error);
      client.emit("game.error", { message: error.message || "Failed to select theme" });
    }
  }

  @UseGuards(WsJwtGuard)
  @UsePipes(new ValidationPipe({ 
    whitelist: true, 
    forbidNonWhitelisted: true,
    transform: true,
    exceptionFactory: (errors) => new WsException(errors)
  }))
  @SubscribeMessage("trivia.answer")
  async handleTriviaAnswer(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: TriviaAnswerDto
  ) {
    const user = (client as any).user;

    try {
      const game = await this.gamesService.getGame(body.gameId);
      if (game.type !== GameType.TRIVIA) {
        client.emit("game.error", { message: "Not a trivia game" });
        return;
      }

      // SECURITY: Verify user is a player in this game
      this.assertPlayerInGame(game, user.sub);

      // Get user display name
      const userRecord = await this.prisma.user.findUnique({
        where: { id: user.sub },
        select: { displayName: true }
      });
      const displayName = userRecord?.displayName || "Player";

      // Calculate time to answer
      const startTime = this.triviaQuestionStartTimes.get(body.gameId);
      const timeToAnswer = startTime ? (Date.now() - startTime) / 1000 : 0;

      // Get current state to validate
      const currentState = this.triviaService.getState(body.gameId);
      if (!currentState) {
        client.emit("game.error", { message: "Game state not found" });
        return;
      }

      // Submit answer
      let result;
      try {
        result = this.triviaService.submitAnswer(
        body.gameId,
        user.sub,
        displayName,
        body.questionIndex,
        body.answerIndex,
        timeToAnswer
      );
      } catch (error: any) {
        this.logger.error(`Answer submission error for game ${body.gameId}:`, error);
        client.emit("game.error", { message: error.message || "Failed to submit answer" });
        return;
      }

      if (!result.isNewAnswer) {
        // Already answered - silently ignore (don't send error, just return)
        return;
      }

      // Get session ID from game
      const sessionId = game.sessionId;
      const roomKey = sessionId ? `session:${sessionId}` : `game:${body.gameId}`;

      // Emit player answered event
      this.server.to(roomKey).emit("trivia.playerAnswered", {
        odUserId: user.sub
      });

      // Update state in database
      await this.prisma.game.update({
        where: { id: body.gameId },
        data: { state: result.state as any }
      });

      // Check if all players have answered
      if (this.triviaService.allPlayersAnswered(result.state)) {
        this.logger.log(`All players answered for game ${body.gameId}, ending question ${body.questionIndex}`);
        // End question immediately
        this.endTriviaQuestion(body.gameId, roomKey);
      } else {
        this.logger.log(`Waiting for more answers. Current: ${result.state.currentAnswers.length}/${result.state.playerCount}`);
      }
    } catch (error: any) {
      this.logger.error("Trivia answer error:", error);
      client.emit("game.error", { message: error.message || "Failed to submit answer" });
    }
  }

  // ==================== TRUTHS AND LIE GAME ====================

  @UseGuards(WsJwtGuard)
  @UsePipes(new ValidationPipe({ 
    whitelist: true, 
    forbidNonWhitelisted: true,
    transform: true,
    exceptionFactory: (errors) => new WsException(errors)
  }))
  @SubscribeMessage("truthsAndLie.submitStatements")
  async handleSubmitStatements(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: TruthsAndLieSubmitStatementsDto
  ) {
    const user = (client as any).user;

    try {
      const game = await this.gamesService.getGame(body.gameId);
      if (game.type !== GameType.TRUTHS_AND_LIE) {
        client.emit("game.error", { message: "Not a truths and lie game" });
        return;
      }

      // SECURITY: Verify user is a player in this game
      this.assertPlayerInGame(game, user.sub);

      const result = this.truthsAndLieService.submitStatements(
        body.gameId,
        user.sub,
        body.statements,
        body.lieIndex
      );

      // Get session ID from game
      const sessionId = game.sessionId;
      const roomKey = sessionId ? `session:${sessionId}` : `game:${body.gameId}`;

      // Update state in database
      await this.prisma.game.update({
        where: { id: body.gameId },
        data: { state: result as any }
      });

      // Emit full state update so both users have the statements
      this.server.to(roomKey).emit("game.stateUpdate", {
        gameId: body.gameId,
        state: {
          ...result,
          // For guesser, hide which statement is the lie
          statements: result.statements.map(s => ({
            text: s.text,
            isLie: false, // Hide the lie indicator from guesser
            index: s.index
          }))
        }
      });

      // Emit statements submitted event
      this.server.to(roomKey).emit("truthsAndLie.statementsSubmitted", {
        gameId: body.gameId,
        statements: result.statements.map(s => s.text), // Don't reveal which is the lie
        phase: result.phase
      });

      // Start the guessing phase with timer
      this.startTruthsAndLieGuessing(body.gameId, roomKey);
    } catch (error: any) {
      this.logger.error("Submit statements error:", error);
      client.emit("game.error", { message: error.message || "Failed to submit statements" });
    }
  }

  @UseGuards(WsJwtGuard)
  @UsePipes(new ValidationPipe({ 
    whitelist: true, 
    forbidNonWhitelisted: true,
    transform: true,
    exceptionFactory: (errors) => new WsException(errors)
  }))
  @SubscribeMessage("truthsAndLie.submitGuess")
  async handleSubmitGuess(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: TruthsAndLieSubmitGuessDto
  ) {
    const user = (client as any).user;

    try {
      const game = await this.gamesService.getGame(body.gameId);
      if (game.type !== GameType.TRUTHS_AND_LIE) {
        client.emit("game.error", { message: "Not a truths and lie game" });
        return;
      }

      // SECURITY: Verify user is a player in this game
      this.assertPlayerInGame(game, user.sub);

      const result = this.truthsAndLieService.submitGuess(
        body.gameId,
        user.sub,
        body.selectedIndex
      );

      // Get session ID from game
      const sessionId = game.sessionId;
      const roomKey = sessionId ? `session:${sessionId}` : `game:${body.gameId}`;

      // Clear timer
      this.truthsAndLieService.clearTimer(body.gameId);

      // Update state in database
      await this.prisma.game.update({
        where: { id: body.gameId },
        data: { state: result as any }
      });

      // Emit result
      this.server.to(roomKey).emit("truthsAndLie.result", {
        gameId: body.gameId,
        selectedIndex: result.selectedStatementIndex,
        isCorrect: result.isCorrect,
        winnerId: result.winnerId,
        lieIndex: result.statements.findIndex(s => s.isLie),
        phase: result.phase
      });

      // End game after showing result
      setTimeout(() => {
        const endedState = this.truthsAndLieService.endGame(body.gameId);
        if (endedState) {
          this.server.to(roomKey).emit("truthsAndLie.gameEnd", {
            gameId: body.gameId,
            winnerId: endedState.winnerId,
            state: endedState
          });
        }
      }, 5000); // Show result for 5 seconds
    } catch (error: any) {
      this.logger.error("Submit guess error:", error);
      client.emit("game.error", { message: error.message || "Failed to submit guess" });
    }
  }

  // ==================== 21 QUESTIONS GAME ====================

  @UseGuards(WsJwtGuard)
  @UsePipes(new ValidationPipe({ 
    whitelist: true, 
    forbidNonWhitelisted: true,
    transform: true,
    exceptionFactory: (errors) => new WsException(errors)
  }))
  @SubscribeMessage("twentyOneQuestions.next")
  async handleNextQuestion(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: TwentyOneQuestionsNextDto
  ) {
    const user = (client as any).user;

    try {
      const game = await this.gamesService.getGame(body.gameId);
      if (game.type !== GameType.TWENTY_ONE_QUESTIONS) {
        client.emit("game.error", { message: "Not a 21 Questions game" });
        return;
      }

      // SECURITY: Verify user is a player in this game
      this.assertPlayerInGame(game, user.sub);

      // Mark player as ready for next question
      const result = this.twentyOneQuestionsService.markPlayerReady(
        body.gameId,
        user.sub
      );

      // Get session ID from game
      const sessionId = game.sessionId;
      const roomKey = sessionId ? `session:${sessionId}` : `game:${body.gameId}`;

      // Update state in database
      await this.prisma.game.update({
        where: { id: body.gameId },
        data: { state: result.state as any }
      });

      // Emit player ready status
      this.server.to(roomKey).emit("twentyOneQuestions.playerReady", {
        gameId: body.gameId,
        playerId: user.sub,
        allReady: result.allReady,
        state: result.state
      });

      // If all players are ready, emit next question
      if (result.allReady) {
        if (result.state.phase === "gameEnd") {
          // Game completed
          this.server.to(roomKey).emit("twentyOneQuestions.gameEnd", {
            gameId: body.gameId,
            completedQuestions: result.state.completedQuestions,
            totalQuestions: result.state.totalQuestions,
            state: result.state
          });
        } else if (result.nextQuestion) {
          // Next question available
          this.server.to(roomKey).emit("twentyOneQuestions.nextQuestion", {
            gameId: body.gameId,
            question: result.nextQuestion,
            questionNumber: result.state.currentQuestionIndex + 1,
            totalQuestions: result.state.totalQuestions,
            state: result.state
          });
        }
      }

      // Also emit state update for UI sync
      this.server.to(roomKey).emit("game.stateUpdate", {
        gameId: body.gameId,
        state: result.state
      });
    } catch (error: any) {
      this.logger.error("Next question error:", error);
      client.emit("game.error", { message: error.message || "Failed to proceed to next question" });
    }
  }

  private startTruthsAndLieGuessing(gameId: string, roomKey: string) {
    const state = this.truthsAndLieService.getState(gameId);
    if (!state) return;

    // Emit guessing phase started
    this.server.to(roomKey).emit("truthsAndLie.guessingStarted", {
      gameId,
      timeLimit: 20
    });

    // Set timer to auto-submit wrong answer if time runs out
    this.truthsAndLieService.setTimer(gameId, () => {
      const currentState = this.truthsAndLieService.getState(gameId);
      if (!currentState || currentState.phase !== "guessing") return;

      // Auto-submit first statement (assuming it's not the lie, so wrong answer)
      // Actually, we should submit a random wrong answer
      const wrongIndices = currentState.statements
        .map((s, idx) => ({ s, idx }))
        .filter(({ s }) => !s.isLie)
        .map(({ idx }) => idx);

      if (wrongIndices.length > 0) {
        const wrongIndex = wrongIndices[0]; // Pick first wrong answer
        const result = this.truthsAndLieService.submitGuess(
          gameId,
          currentState.guesserId,
          wrongIndex
        );

        // Update database
        this.prisma.game.update({
          where: { id: gameId },
          data: { state: result as any }
        }).catch((err: any) => this.logger.error("Failed to update game state:", err));

        // Emit result
        this.server.to(roomKey).emit("truthsAndLie.result", {
          gameId,
          selectedIndex: result.selectedStatementIndex,
          isCorrect: result.isCorrect,
          winnerId: result.winnerId,
          lieIndex: result.statements.findIndex(s => s.isLie),
          phase: result.phase,
          timedOut: true
        });

        // End game after showing result
        setTimeout(() => {
          const endedState = this.truthsAndLieService.endGame(gameId);
          if (endedState) {
            this.server.to(roomKey).emit("truthsAndLie.gameEnd", {
              gameId,
              winnerId: endedState.winnerId,
              state: endedState
            });
          }
        }, 5000);
      }
    }, 20000); // 20 seconds
  }

  // ==================== BILLIARDS GAME ====================

  @UseGuards(WsJwtGuard)
  @UsePipes(new ValidationPipe({ 
    whitelist: true, 
    forbidNonWhitelisted: true,
    transform: true,
    exceptionFactory: (errors) => new WsException(errors)
  }))
  @SubscribeMessage("billiards.shot")
  async handleBilliardsShot(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: BilliardsShotDto
  ) {
    const user = (client as any).user;

    try {
      const game = await this.gamesService.getGame(body.gameId);
      if (game.type !== GameType.BILLIARDS) {
        client.emit("game.error", { message: "Not a billiards game" });
        return;
      }

      // SECURITY: Verify user is a player in this game
      this.assertPlayerInGame(game, user.sub);

      // Execute shot
      const result = this.billiardsService.executeShot(
        body.gameId,
        user.sub,
        body.power,
        body.angle
      );

      // Get session ID from game
      const sessionId = game.sessionId;
      const roomKey = sessionId ? `session:${sessionId}` : `game:${body.gameId}`;

      // Update state in database
      await this.prisma.game.update({
        where: { id: body.gameId },
        data: { state: result.state as any }
      });

      // Emit shot result
      this.server.to(roomKey).emit("billiards.shotResult", {
        gameId: body.gameId,
        shot: result.state.lastShot,
        finalBallStates: result.state.balls,
        turnResult: result.result,
        gameState: result.state,
        winnerId: result.state.winnerId
      });

      // Emit state update
      this.server.to(roomKey).emit("game.stateUpdate", {
        gameId: body.gameId,
        state: result.state
      });

      // If game ended, emit game end event
      if (result.state.gameStatus === 'ended') {
        this.server.to(roomKey).emit("billiards.gameEnd", {
          gameId: body.gameId,
          winnerId: result.state.winnerId,
          reason: result.state.turnHistory[result.state.turnHistory.length - 1]?.result === 'win' ? 'win' : 'loss',
          finalState: result.state
        });
      }
    } catch (error: any) {
      this.logger.error("Billiards shot error:", error);
      client.emit("game.error", { message: error.message || "Failed to execute shot" });
    }
  }

  @UseGuards(WsJwtGuard)
  @UsePipes(new ValidationPipe({ 
    whitelist: true, 
    forbidNonWhitelisted: true,
    transform: true,
    exceptionFactory: (errors) => new WsException(errors)
  }))
  @SubscribeMessage("billiards.event")
  async handleBilliardsEvent(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: BilliardsEventDto
  ) {
    try {
      const user = (client as any).user;
      if (!user?.sub) {
        client.emit("game.error", { message: "Unauthorized" });
        return;
      }

      const game = await this.gamesService.getGame(data.gameId);
      if (!game) {
        client.emit("game.error", { message: "Game not found" });
        return;
      }

      if (game.type !== GameType.BILLIARDS) {
        client.emit("game.error", { message: "Not a billiards game" });
        return;
      }

      // SECURITY: Verify user is a player in this game
      this.assertPlayerInGame(game, user.sub);

      // Relay event to other players in the session
      const roomKey = `session:${game.sessionId}`;
      client.to(roomKey).emit("billiards.event", {
        gameId: data.gameId,
        event: data.event
      });
    } catch (error) {
      this.logger.error("Billiards event error:", error);
      client.emit("game.error", { message: "Failed to process billiards event" });
    }
  }

  @UseGuards(WsJwtGuard)
  @UsePipes(new ValidationPipe({ 
    whitelist: true, 
    forbidNonWhitelisted: true,
    transform: true,
    exceptionFactory: (errors) => new WsException(errors)
  }))
  @SubscribeMessage("billiards.placeCueBall")
  async handlePlaceCueBall(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: BilliardsPlaceCueBallDto
  ) {
    const user = (client as any).user;

    try {
      const game = await this.gamesService.getGame(body.gameId);
      if (game.type !== GameType.BILLIARDS) {
        client.emit("game.error", { message: "Not a billiards game" });
        return;
      }

      // SECURITY: Verify user is a player in this game
      this.assertPlayerInGame(game, user.sub);

      // Place cue ball
      const result = this.billiardsService.placeCueBall(
        body.gameId,
        user.sub,
        body.position
      );

      if (!result.success) {
        client.emit("game.error", { message: result.error || "Failed to place cue ball" });
        return;
      }

      // Get session ID from game
      const sessionId = game.sessionId;
      const roomKey = sessionId ? `session:${sessionId}` : `game:${body.gameId}`;

      // Update state in database
      await this.prisma.game.update({
        where: { id: body.gameId },
        data: { state: result.state as any }
      });

      // Emit state update
      this.server.to(roomKey).emit("game.stateUpdate", {
        gameId: body.gameId,
        state: result.state
      });
    } catch (error: any) {
      this.logger.error("Place cue ball error:", error);
      client.emit("game.error", { message: error.message || "Failed to place cue ball" });
    }
  }

  @UseGuards(WsJwtGuard)
  @UsePipes(new ValidationPipe({ 
    whitelist: true, 
    forbidNonWhitelisted: true,
    transform: true,
    exceptionFactory: (errors) => new WsException(errors)
  }))
  @SubscribeMessage("poker.action")
  async handlePokerAction(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: PokerActionDto
  ) {
    const user = (client as any).user;

    try {
      const game = await this.gamesService.getGame(body.gameId);
      if (game.type !== GameType.POKER) {
        client.emit("game.error", { message: "Not a poker game" });
        return;
      }

      // SECURITY: Verify user is a player in this game
      this.assertPlayerInGame(game, user.sub);

      // Process poker action
      const result = await this.pokerService.processAction(
        body.gameId,
        user.sub,
        body.action as any,
        body.amount
      );

      if (!result.success) {
        client.emit("game.error", { message: result.error || "Failed to process action" });
        return;
      }

      // Get session ID from game
      const sessionId = game.sessionId;
      const roomKey = sessionId ? `session:${sessionId}` : `game:${body.gameId}`;

      // Log detailed state before saving
      this.logger.log(`[handlePokerAction] ===== ACTION RESULT =====`);
      this.logger.log(`[handlePokerAction] Game: ${body.gameId}`);
      this.logger.log(`[handlePokerAction] Action: ${body.action} (amount: ${body.amount})`);
      this.logger.log(`[handlePokerAction] Result state: currentPlayerIndex=${result.state?.currentPlayerIndex}, round=${result.state?.currentBettingRound}, pot=${result.state?.pot}`);
      this.logger.log(`[handlePokerAction] Players: ${result.state?.players?.map((p: any, i: number) => `[${i}] ${p.userId.slice(-6)} (${p.status}, chips=${p.chips}, bet=${p.betThisRound})`).join(' | ')}`);
      this.logger.log(`[handlePokerAction] Next to act: ${result.nextAction?.currentPlayerId?.slice(-6)}`);

      // Update state in database
      await this.prisma.game.update({
        where: { id: body.gameId },
        data: { state: result.state as any }
      });
      
      // Ensure the in-memory state is also updated
      if (result.state) {
        this.pokerService.setState(body.gameId, result.state);
      }

      // Emit action result to all players (contains full state, so no need for separate stateUpdate)
      this.logger.log(`[handlePokerAction] Emitting to room: ${roomKey}`);
      this.server.to(roomKey).emit("poker.actionResult", {
        gameId: body.gameId,
        action: body.action,
        amount: body.amount,
        state: result.state,
        handComplete: result.handComplete,
        winners: result.winners,
        nextAction: result.nextAction
      });

      // Note: Removed duplicate game.stateUpdate emission - poker.actionResult already contains full state
      // This prevents double state updates on the frontend

      // If hand completed, emit hand end event
      if (result.handComplete) {
        this.server.to(roomKey).emit("poker.handEnd", {
          gameId: body.gameId,
          winners: result.winners,
          state: result.state
        });
      }
    } catch (error: any) {
      this.logger.error("Poker action error:", error);
      client.emit("game.error", { message: error.message || "Failed to process poker action" });
    }
  }

  @UseGuards(WsJwtGuard)
  @UsePipes(new ValidationPipe({ 
    whitelist: true, 
    forbidNonWhitelisted: true,
    transform: true,
    exceptionFactory: (errors) => new WsException(errors)
  }))
  @SubscribeMessage("poker.startNewHand")
  async handlePokerStartNewHand(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: PokerNewHandDto
  ) {
    const user = (client as any).user;

    try {
      const game = await this.gamesService.getGame(body.gameId);
      if (game.type !== GameType.POKER) {
        client.emit("game.error", { message: "Not a poker game" });
        return;
      }

      // Check if user is a player in the game
      const isPlayer = game.players.some(p => p.userId === user.sub);
      if (!isPlayer) {
        client.emit("game.error", { message: "You are not a player in this game" });
        return;
      }

      // Start new hand
      const newState = this.pokerService.startNewHand(body.gameId);
      if (!newState) {
        client.emit("game.error", { message: "Failed to start new hand" });
        return;
      }

      // Get session ID from game
      const sessionId = game.sessionId;
      const roomKey = sessionId ? `session:${sessionId}` : `game:${body.gameId}`;

      // Check if game is over (one player has all chips)
      const playersWithChips = newState.players.filter((p: any) => p.chips > 0);
      if (playersWithChips.length < 2) {
        // Game is over - mark as completed
        await this.prisma.game.update({
          where: { id: body.gameId },
          data: { 
            state: newState as any,
            status: "COMPLETED",
            endedAt: new Date(),
            winnerUserId: newState.winnerIds?.[0] || playersWithChips[0]?.userId || null
          }
        });

        // Emit game over
        this.server.to(roomKey).emit("poker.gameOver", {
          gameId: body.gameId,
          winnerId: newState.winnerIds?.[0] || playersWithChips[0]?.userId,
          state: newState
        });

        this.server.to(roomKey).emit("game.end", {
          gameId: body.gameId,
          winnerId: newState.winnerIds?.[0] || playersWithChips[0]?.userId,
          reason: "all_chips_won"
        });

        // Cleanup game from memory after a delay
        setTimeout(() => {
          this.pokerService.cleanupGame(body.gameId);
        }, 60000); // Keep in memory for 1 minute for any late reconnects

        return;
      }

      // Update state in database
      await this.prisma.game.update({
        where: { id: body.gameId },
        data: { state: newState as any }
      });

      // Emit new hand started to all players
      this.server.to(roomKey).emit("poker.newHand", {
        gameId: body.gameId,
        state: newState
      });

      // Emit state update
      this.server.to(roomKey).emit("game.stateUpdate", {
        gameId: body.gameId,
        state: newState
      });
    } catch (error: any) {
      this.logger.error("Poker start new hand error:", error);
      client.emit("game.error", { message: error.message || "Failed to start new hand" });
    }
  }

  @UseGuards(WsJwtGuard)
  @SubscribeMessage("poker.endGame")
  async handlePokerEndGame(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: { gameId: string }
  ) {
    const user = (client as any).user;

    try {
      const game = await this.gamesService.getGame(body.gameId);
      if (game.type !== GameType.POKER) {
        client.emit("game.error", { message: "Not a poker game" });
        return;
      }

      // Cleanup game from memory
      this.pokerService.cleanupGame(body.gameId);

      // Update game status in database
      await this.prisma.game.update({
        where: { id: body.gameId },
        data: { 
          status: "COMPLETED",
          endedAt: new Date()
        }
      });

      const sessionId = game.sessionId;
      const roomKey = sessionId ? `session:${sessionId}` : `game:${body.gameId}`;

      this.server.to(roomKey).emit("game.end", {
        gameId: body.gameId,
        reason: "game_ended"
      });

      this.logger.log(`Poker game ${body.gameId} ended by user ${user.sub}`);
    } catch (error: any) {
      this.logger.error("Poker end game error:", error);
      client.emit("game.error", { message: error.message || "Failed to end game" });
    }
  }

  // ==================== GEOGUESSER GAME HANDLERS ====================

  private geoGuesserRoundTimers = new Map<string, NodeJS.Timeout>();

  private startGeoGuesserRound(gameId: string, roomKey: string) {
    const state = this.geoGuesserService.startRound(gameId);
    if (!state) return;

    const currentRound = state.rounds[state.currentRound - 1];

    this.server.to(roomKey).emit("geoGuesser.roundStart", {
      gameId,
      roundNumber: state.currentRound,
      totalRounds: state.totalRounds,
      location: currentRound.location,
      panoramaPov: currentRound.panoramaPov,
      roundDurationSeconds: state.roundDurationSeconds,
      roundStartedAt: state.roundStartedAt,
    });

    // Server-side timer: end round when time expires
    const timer = setTimeout(async () => {
      this.geoGuesserRoundTimers.delete(gameId);
      await this.endGeoGuesserRound(gameId, roomKey);
    }, state.roundDurationSeconds * 1000);

    this.geoGuesserRoundTimers.set(gameId, timer);
  }

  private async endGeoGuesserRound(gameId: string, roomKey: string) {
    const result = this.geoGuesserService.endRound(gameId);

    // Persist round state to DB
    const state = this.geoGuesserService.getState(gameId);
    if (state) {
      await this.geoGuesserService.persistRoundEnd(gameId, state);
    }

    this.server.to(roomKey).emit("geoGuesser.roundResult", {
      gameId,
      roundNumber: result.roundNumber,
      location: result.location,
      guesses: result.guesses,
      scores: result.scores,
      isGameOver: result.isGameOver,
    });

    if (result.isGameOver) {
      // Finalize game in DB
      await this.geoGuesserService.finalizeGame(gameId, result.winnerId ?? null);

      this.server.to(roomKey).emit("geoGuesser.gameEnd", {
        gameId,
        winnerId: result.winnerId ?? null,
        isDraw: result.isDraw,
        finalScores: result.scores,
      });

      this.server.to(roomKey).emit("game.end", {
        gameId,
        winnerId: result.winnerId ?? null,
        isDraw: result.isDraw,
        reason: "game_over",
      });

      this.logger.log(`GeoGuesser game ${gameId} ended. Winner: ${result.winnerId ?? "draw"}`);
    } else {
      // Start next round after a 5-second results viewing window
      setTimeout(() => {
        this.startGeoGuesserRound(gameId, roomKey);
      }, 5000);
    }
  }

  @UseGuards(WsJwtGuard)
  @SubscribeMessage("geoGuesser.guess")
  async handleGeoGuesserGuess(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: { gameId: string; lat: number; lng: number }
  ) {
    const user = (client as any).user;

    try {
      const game = await this.gamesService.getGame(body.gameId);
      if (game.type !== GameType.GEO_GUESSER) {
        client.emit("game.error", { message: "Not a GeoGuesser game" });
        return;
      }

      this.assertPlayerInGame(game, user.sub);

      const sessionId = game.sessionId;
      const roomKey = sessionId ? `session:${sessionId}` : `game:${body.gameId}`;

      const { guess, roundComplete } = this.geoGuesserService.submitGuess(
        body.gameId,
        user.sub,
        body.lat,
        body.lng
      );

      // Tell all players that this user has locked in their guess
      this.server.to(roomKey).emit("geoGuesser.playerGuessed", {
        gameId: body.gameId,
        userId: user.sub,
        pointsEarned: guess.pointsEarned,
      });

      if (roundComplete) {
        // Cancel the server-side timer — both players submitted before time ran out
        const timer = this.geoGuesserRoundTimers.get(body.gameId);
        if (timer) {
          clearTimeout(timer);
          this.geoGuesserRoundTimers.delete(body.gameId);
        }
        await this.endGeoGuesserRound(body.gameId, roomKey);
      }
    } catch (error: any) {
      this.logger.error("GeoGuesser guess error:", error);
      client.emit("game.error", { message: error.message || "Failed to submit guess" });
    }
  }

  @UseGuards(WsJwtGuard)
  @SubscribeMessage("geoGuesser.forfeit")
  async handleGeoGuesserForfeit(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: { gameId: string }
  ) {
    const user = (client as any).user;

    try {
      const game = await this.gamesService.getGame(body.gameId);
      if (game.type !== GameType.GEO_GUESSER) {
        client.emit("game.error", { message: "Not a GeoGuesser game" });
        return;
      }

      this.assertPlayerInGame(game, user.sub);

      const sessionId = game.sessionId;
      const roomKey = sessionId ? `session:${sessionId}` : `game:${body.gameId}`;

      // Cancel round timer
      const timer = this.geoGuesserRoundTimers.get(body.gameId);
      if (timer) {
        clearTimeout(timer);
        this.geoGuesserRoundTimers.delete(body.gameId);
      }

      // Determine the winner as the other player
      const state = this.geoGuesserService.getState(body.gameId);
      const winnerId = state?.players.find(p => p.userId !== user.sub)?.userId ?? null;

      await this.geoGuesserService.finalizeGame(body.gameId, winnerId);

      this.server.to(roomKey).emit("geoGuesser.gameEnd", {
        gameId: body.gameId,
        winnerId,
        isDraw: false,
        finalScores: state?.players ?? [],
      });

      this.server.to(roomKey).emit("game.end", {
        gameId: body.gameId,
        winnerId,
        reason: "forfeit",
      });

      this.logger.log(`GeoGuesser game ${body.gameId} forfeited by ${user.sub}`);
    } catch (error: any) {
      this.logger.error("GeoGuesser forfeit error:", error);
      client.emit("game.error", { message: error.message || "Failed to forfeit game" });
    }
  }

  // ─── Tanks ────────────────────────────────────────────────────────────────

  private startTanksGameLoop(gameId: string, roomKey: string): void {
    const interval = setInterval(async () => {
      try {
        const result = this.tanksService.tick(gameId);
        if (!result || !result.state) return;

        this.server.to(roomKey).emit('tanks.tick', result.state);

        if (result.state.phase === 'ended') {
          clearInterval(interval);
          this.tanksGameLoops.delete(gameId);

          this.server.to(roomKey).emit('tanks.gameEnd', {
            gameId,
            winnerId: result.state.winnerId,
            isDraw: result.state.isDraw,
          });

          this.server.to(roomKey).emit('game.end', {
            gameId,
            winnerId: result.state.winnerId,
            isDraw: result.state.isDraw,
          });

          try {
            await this.prisma.game.update({
              where: { id: gameId },
              data: {
                status: 'COMPLETED' as any,
                winnerUserId: result.state.winnerId,
                state: result.state as any,
                endedAt: new Date(),
              },
            });
          } catch (dbErr) {
            this.logger.error('Failed to persist tanks game end:', dbErr);
          }

          this.tanksService.deleteState(gameId);
        }
      } catch (err) {
        this.logger.error(`Tanks game loop error for ${gameId}:`, err);
      }
    }, 50);

    this.tanksGameLoops.set(gameId, interval);
    this.logger.log(`Tanks game loop started for game ${gameId}`);
  }

  @UseGuards(WsJwtGuard)
  @UsePipes(new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
    exceptionFactory: (errors) => new WsException(errors)
  }))
  @SubscribeMessage('tanks.input')
  async handleTanksInput(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: TanksInputDto
  ) {
    const user = (client as any).user;
    try {
      this.tanksService.applyInput(body.gameId, user.sub, {
        keys: body.keys,
        turretAngle: body.turretAngle,
        shooting: body.shooting,
      });
    } catch (err: any) {
      client.emit('game.error', { message: err.message || 'Input error' });
    }
  }

  @UseGuards(WsJwtGuard)
  @UsePipes(new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
    exceptionFactory: (errors) => new WsException(errors)
  }))
  @SubscribeMessage('penguin.move')
  async handlePenguinMove(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: PenguinMoveDto
  ) {
    const user = (client as any).user;
    const roomKey = `game:${body.gameId}`;

    try {
      const result = await this.penguinKnockoutService.submitMove(
        body.gameId,
        user.sub,
        { direction: body.direction as any, power: body.power as any }
      );

      if (!result.success) {
        client.emit('game.error', { message: result.error || 'Move failed' });
        return;
      }

      if (result.waitingForOpponent) {
        // Acknowledge to submitting player; opponent gets notified when they also submit
        client.emit('penguin.moveAcknowledged', { gameId: body.gameId });
        // Broadcast to the room so opponent knows a move was submitted (without revealing it)
        this.server.to(roomKey).emit('penguin.opponentReady', { gameId: body.gameId, userId: user.sub });
        return;
      }

      // Both submitted — broadcast full resolution
      if (result.winner !== undefined && result.winner !== null) {
        this.server.to(roomKey).emit('game.stateUpdate', {
          gameId: body.gameId,
          state: result.state,
          roundResolution: result.roundResolution,
        });
        this.server.to(roomKey).emit('game.end', {
          gameId: body.gameId,
          winnerId: result.winner,
          isDraw: result.isDraw,
          reason: 'win',
          state: result.state,
        });
      } else if (result.isDraw) {
        this.server.to(roomKey).emit('game.stateUpdate', {
          gameId: body.gameId,
          state: result.state,
          roundResolution: result.roundResolution,
        });
        this.server.to(roomKey).emit('game.end', {
          gameId: body.gameId,
          winnerId: null,
          isDraw: true,
          reason: 'draw',
          state: result.state,
        });
      } else {
        this.server.to(roomKey).emit('game.stateUpdate', {
          gameId: body.gameId,
          state: result.state,
          roundResolution: result.roundResolution,
        });
      }
    } catch (err: any) {
      this.logger.error('penguin.move error:', err);
      client.emit('game.error', { message: err.message || 'Move failed' });
    }
  }
}

