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
import { BlackjackService } from "../games/blackjack/blackjack.service";
import { BsService } from "../games/bs/bs.service";
import { SpinTheWheelService } from "../games/spin-the-wheel/spin-the-wheel.service";
import { MonopolyService } from "../games/monopoly/monopoly.service";
import { HangmanService } from "../games/word-games/hangman/hangman.service";
import { GhostService } from "../games/word-games/ghost/ghost.service";
import { WordleService } from "../games/word-games/wordle/wordle.service";
import { JottoService } from "../games/word-games/jotto/jotto.service";
import { SpellingBeeService } from "../games/word-games/spelling-bee/spelling-bee.service";
import { LetterBoxedService } from "../games/word-games/letter-boxed/letter-boxed.service";
import { BoggleService } from "../games/word-games/boggle/boggle.service";
import { ScattergoriesService } from "../games/word-games/scattergories/scattergories.service";
import { ScrabbleService } from "../games/word-games/scrabble/scrabble.service";
import { BananagramsService } from "../games/word-games/bananagrams/bananagrams.service";
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
  PenguinMoveDto,
  BlackjackActionDto,
  BlackjackNewHandDto,
  BsPlayCardsDto,
  BsCallDto,
  BsEndGameDto,
  MonopolyGameDto,
  MonopolyBidDto,
  MonopolyPropertyDto,
  MonopolyTradeOfferDto,
  MonopolyTradeResponseDto,
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
@UsePipes(new ValidationPipe({
  whitelist: true,
  forbidNonWhitelisted: true,
  transform: true,
  exceptionFactory: (errors) => new WsException(errors)
}))
export class AppGateway implements OnGatewayConnection, OnGatewayDisconnect, OnModuleDestroy {
  @WebSocketServer()
  server!: Server;
  
  private readonly logger = new Logger(AppGateway.name);
  private matchingIntervals = new Map<string, NodeJS.Timeout>();

  // Track voting timers for rooms
  private votingTimers = new Map<string, NodeJS.Timeout>();

  // Track tanks game loop intervals
  private tanksGameLoops = new Map<string, NodeJS.Timeout>();

  // Track word game timers
  private boggleTimers = new Map<string, NodeJS.Timeout>();
  private scattergoriesTimers = new Map<string, NodeJS.Timeout>();

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
    private readonly blackjackService: BlackjackService,
    private readonly bsService: BsService,
    private readonly spinTheWheelService: SpinTheWheelService,
    private readonly monopolyService: MonopolyService,
    private readonly hangmanService: HangmanService,
    private readonly ghostService: GhostService,
    private readonly wordleService: WordleService,
    private readonly jottoService: JottoService,
    private readonly spellingBeeService: SpellingBeeService,
    private readonly letterBoxedService: LetterBoxedService,
    private readonly boggleService: BoggleService,
    private readonly scattergoriesService: ScattergoriesService,
    private readonly scrabbleService: ScrabbleService,
    private readonly bananagramsService: BananagramsService,
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

  /**
   * Clears all timer/interval entries associated with a specific gameId.
   * Safe to call even if no timers exist for the given gameId.
   */
  private cleanupGameTimers(gameId: string): void {
    const triviaTimer = this.triviaQuestionTimers.get(gameId);
    if (triviaTimer) {
      clearTimeout(triviaTimer);
      this.triviaQuestionTimers.delete(gameId);
    }
    this.triviaQuestionStartTimes.delete(gameId);

    const geoTimer = this.geoGuesserRoundTimers.get(gameId);
    if (geoTimer) {
      clearTimeout(geoTimer);
      this.geoGuesserRoundTimers.delete(gameId);
    }

    const tanksLoop = this.tanksGameLoops.get(gameId);
    if (tanksLoop) {
      clearInterval(tanksLoop);
      this.tanksGameLoops.delete(gameId);
    }

    const boggleTimer = this.boggleTimers.get(gameId);
    if (boggleTimer) {
      clearTimeout(boggleTimer);
      this.boggleTimers.delete(gameId);
    }

    const scattergoriesTimer = this.scattergoriesTimers.get(gameId);
    if (scattergoriesTimer) {
      clearTimeout(scattergoriesTimer);
      this.scattergoriesTimers.delete(gameId);
    }
  }

  /**
   * Clears a voting timer for a specific roundId.
   */
  private cleanupVotingTimer(roundId: string): void {
    const timer = this.votingTimers.get(roundId);
    if (timer) {
      clearTimeout(timer);
      this.votingTimers.delete(roundId);
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
          client.to(room).emit('session.peerLeft', { userId, sessionId: room.replace('session:', '') });
        }
      });

      // Clean up game-specific timers for any game rooms this socket was in
      for (const room of rooms) {
        if (room.startsWith('game:')) {
          const gameId = room.replace('game:', '');
          this.cleanupGameTimers(gameId);
        }
      }

      setTimeout(() => {
        if (!this.matchingIntervals.has(userId)) {
          this.matchmakingService.leaveQueue(userId);
        }
      }, 1000);
    }
  }

  onModuleDestroy() {
    for (const [, interval] of this.matchingIntervals.entries()) {
      clearInterval(interval);
    }
    this.matchingIntervals.clear();

    for (const [, timer] of this.votingTimers.entries()) {
      clearTimeout(timer);
    }
    this.votingTimers.clear();

    for (const [, timer] of this.triviaQuestionTimers.entries()) {
      clearTimeout(timer);
    }
    this.triviaQuestionTimers.clear();
    this.triviaQuestionStartTimes.clear();

    for (const [, timer] of this.geoGuesserRoundTimers.entries()) {
      clearTimeout(timer);
    }
    this.geoGuesserRoundTimers.clear();

    for (const [, interval] of this.tanksGameLoops.entries()) {
      clearInterval(interval);
    }
    this.tanksGameLoops.clear();

    for (const [, timer] of this.boggleTimers.entries()) {
      clearTimeout(timer);
    }
    this.boggleTimers.clear();

    for (const [, timer] of this.scattergoriesTimers.entries()) {
      clearTimeout(timer);
    }
    this.scattergoriesTimers.clear();
  }

  @UseGuards(WsJwtGuard)

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
      } else if (startedGame.type === GameType.MONOPOLY && finalState) {
        const mpState = this.monopolyService.getState(startedGame.id);
        if (mpState) {
          for (const player of mpState.players) {
            const gp = startedGame.players.find(p => p.userId === player.userId);
            if (gp) player.displayName = gp.user.displayName || player.displayName;
          }
          this.monopolyService.setState(startedGame.id, mpState);
          finalState = mpState as any;
        }
      }
      
      // Word games with per-player sanitized state
      if (
        (startedGame.type === GameType.HANGMAN || startedGame.type === GameType.WORDLE ||
         startedGame.type === GameType.JOTTO ||
         startedGame.type === GameType.SPELLING_BEE || startedGame.type === GameType.BOGGLE ||
         startedGame.type === GameType.SCATTERGORIES || startedGame.type === GameType.BANANAGRAMS ||
         startedGame.type === GameType.SCRABBLE_GAME) && finalState
      ) {
        const sessionSockets = await this.server.in(`session:${body.sessionId}`).fetchSockets();
        for (const s of sessionSockets) {
          const su = (s as any).user;
          if (su) {
            let sanitized = finalState;
            if (startedGame.type === GameType.HANGMAN) {
              sanitized = this.hangmanService.sanitizeStateForPlayer(finalState as any, su.sub) as any;
            } else if (startedGame.type === GameType.WORDLE) {
              sanitized = this.wordleService.sanitizeStateForPlayer(finalState as any, su.sub) as any;
            } else if (startedGame.type === GameType.JOTTO) {
              sanitized = this.jottoService.sanitizeStateForPlayer(finalState as any, su.sub) as any;
            } else if (startedGame.type === GameType.SPELLING_BEE) {
              sanitized = this.spellingBeeService.sanitizeStateForPlayer(finalState as any, su.sub) as any;
            } else if (startedGame.type === GameType.BOGGLE) {
              sanitized = this.boggleService.sanitizeStateForPlayer(finalState as any, su.sub) as any;
            } else if (startedGame.type === GameType.SCATTERGORIES) {
              sanitized = this.scattergoriesService.sanitizeStateForPlayer(finalState as any, su.sub) as any;
            } else if (startedGame.type === GameType.BANANAGRAMS) {
              sanitized = this.bananagramsService.sanitizeStateForPlayer(finalState as any, su.sub) as any;
            } else if (startedGame.type === GameType.SCRABBLE_GAME) {
              sanitized = this.scrabbleService.sanitizeStateForPlayer(finalState as any, su.sub) as any;
            }
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
        this.logger.log(`Game ${startedGame.id} (${startedGame.type}) started for session ${body.sessionId}`);
        return;
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
      } else if (startedGame.type === GameType.BS && finalState) {
        const sessionSockets = await this.server.in(`session:${body.sessionId}`).fetchSockets();
        for (const s of sessionSockets) {
          const su = (s as any).user;
          if (su) {
            const sanitized = this.bsService.sanitizeStateForPlayer(finalState as any, su.sub);
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
      } else if (startedGame.type === GameType.POKER && finalState) {
        const sessionSockets = await this.server.in(`session:${body.sessionId}`).fetchSockets();
        for (const s of sessionSockets) {
          const su = (s as any).user;
          if (su) {
            const sanitized = this.pokerService.sanitizeStateForPlayer(finalState as any, su.sub);
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
      } else if (startedGame.type === GameType.BLACKJACK && finalState) {
        const sessionSockets = await this.server.in(`session:${body.sessionId}`).fetchSockets();
        for (const s of sessionSockets) {
          const su = (s as any).user;
          if (su) {
            const sanitized = this.blackjackService.sanitizeStateForPlayer(finalState as any, su.sub);
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

      if (startedGame.type === GameType.BLACKJACK) {
        this.scheduleBlackjackTurnTimer(startedGame.id, `session:${body.sessionId}`);
      }

      if (startedGame.type === GameType.BS) {
        this.scheduleBsTurnTimer(startedGame.id, `session:${body.sessionId}`);
      }

      // For Boggle, start 3-minute round timer
      if (startedGame.type === GameType.BOGGLE) {
        const roomKey = `session:${body.sessionId}`;
        this.boggleTimers.set(startedGame.id, setTimeout(async () => {
          try {
            const result = await this.boggleService.endRound(startedGame.id);
            if (result && result.state) {
              const sockets = await this.server.in(roomKey).fetchSockets();
              for (const s of sockets) {
                const su = (s as any).user;
                if (su) {
                  s.emit("game.stateUpdate", {
                    gameId: startedGame.id,
                    state: result.state,
                  });
                }
              }
              if (result.gameEnded) {
                this.server.to(roomKey).emit("game.end", {
                  gameId: startedGame.id,
                  winnerId: result.winner ?? null,
                  isDraw: result.isDraw ?? false,
                  reason: result.winner ? "win" : (result.isDraw ? "draw" : "time"),
                  finalState: result.state,
                });
              }
            }
          } catch (e: any) {
            this.logger.error(`Boggle timer error for ${startedGame.id}:`, e);
          }
          this.boggleTimers.delete(startedGame.id);
        }, 180_000));
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
      
      let gameState = game.state;
      if (game.type === GameType.BS && gameState) {
        const bsState = this.bsService.getState(body.gameId);
        if (bsState) {
          gameState = this.bsService.sanitizeStateForPlayer(bsState, user.sub) as any;
        }
      } else if (game.type === GameType.POKER && gameState) {
        const pokerState = this.pokerService.getState(body.gameId);
        if (pokerState) {
          gameState = this.pokerService.sanitizeStateForPlayer(pokerState, user.sub) as any;
        }
      } else if (game.type === GameType.BLACKJACK && gameState) {
        const bjState = this.blackjackService.getState(body.gameId);
        if (bjState) {
          gameState = this.blackjackService.sanitizeStateForPlayer(bjState, user.sub) as any;
        }
      }
      client.emit("game.state", {
        gameId: game.id,
        gameType: game.type,
        status: game.status,
        state: gameState,
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
    @MessageBody() body: {
      roomId: string;
      roundId: string;
      cellIndex?: number;
      colIndex?: number;
      from?: { row: number; col: number };
      to?: { row: number; col: number };
      promotionPiece?: string;
      cardIndex?: number;
    }
  ) {
    const user = (client as any).user;
    
    try {
      const round = await this.roomsService.getRoundDetails(body.roundId);
      
      if (!round.gameId) {
        client.emit("room.error", { message: "No game in progress" });
        return;
      }

      let result: any;
      const gameId = round.gameId;

      switch (round.gameType) {
        case GameType.TICTACTOE: {
          if (body.cellIndex === undefined) {
            client.emit("room.error", { message: "cellIndex required for TicTacToe" });
            return;
          }
          result = await this.ticTacToeService.makeMove(gameId, user.sub, body.cellIndex);
          break;
        }
        case GameType.CONNECT_FOUR: {
          if (body.colIndex === undefined) {
            client.emit("room.error", { message: "colIndex required for Connect Four" });
            return;
          }
          result = await this.connectFourService.makeMove(gameId, user.sub, body.colIndex);
          break;
        }
        case GameType.CHESS: {
          if (!body.from || !body.to) {
            client.emit("room.error", { message: "from and to required for Chess" });
            return;
          }
          const game = await this.gamesService.getGame(gameId);
          const currentState = game.state as any;
          if (!currentState) {
            client.emit("room.error", { message: "Game state not found" });
            return;
          }
          result = this.chessService.makeMove(currentState, user.sub, body.from, body.to, body.promotionPiece as PieceType | undefined);
          if (result.success && result.state) {
            await this.prisma.game.update({
              where: { id: gameId },
              data: {
                state: result.state as any,
                ...(result.gameEnded ? { status: "COMPLETED", endedAt: new Date(), winnerUserId: result.winner || null } : {})
              }
            });
          }
          break;
        }
        case GameType.CHECKERS: {
          if (!body.from || !body.to) {
            client.emit("room.error", { message: "from and to required for Checkers" });
            return;
          }
          result = await this.checkersService.makeMove(gameId, user.sub, body.from as any, body.to as any);
          break;
        }
        case GameType.MEMORY_CARDS: {
          if (body.cardIndex === undefined) {
            client.emit("room.error", { message: "cardIndex required for Memory Cards" });
            return;
          }
          result = await this.memoryService.makeMove(gameId, user.sub, body.cardIndex);
          break;
        }
        default:
          client.emit("room.error", { message: `Game type ${round.gameType} is not supported for room.gameMove` });
          return;
      }
      
      if (!result.success) {
        client.emit("room.error", { message: result.error });
        return;
      }
      
      this.server.to(`room:${body.roomId}`).emit("room.gameStateUpdate", {
        roundId: body.roundId,
        state: result.state,
        lastMove: {
          ...(body.cellIndex !== undefined && { cell: body.cellIndex }),
          ...(body.colIndex !== undefined && { col: body.colIndex }),
          ...(body.from && { from: body.from }),
          ...(body.to && { to: body.to }),
          ...(body.cardIndex !== undefined && { card: body.cardIndex }),
        }
      });
      
      const isGameOver = result.winner !== null && result.winner !== undefined
        || result.isDraw
        || result.gameEnded;

      if (isGameOver) {
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
          winningCells: result.winningCells,
          payout: payout.payout
        });
        
        if (result.winner) {
          const winnerWallet = await this.walletService.getWallet(result.winner);
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

    // Send results — include the inter-question delay so the client can show a countdown
    const nextQuestionDelay = this.configService.get<number>("intervals.triviaQuestionDelay") ?? 2500;
    this.server.to(roomKey).emit("trivia.questionResult", {
      gameId,
      correctAnswer: question.correctAnswer,
      correctAnswerIndex,
      nextQuestionIn: nextQuestionDelay,
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

        // startTriviaQuestion will emit the single authoritative game.stateUpdate + trivia.questionStart
        // Emitting a second game.stateUpdate here would cause the frontend to render the question
        // before the timer starts, breaking the pendingState mechanism
        this.startTriviaQuestion(gameId, roomKey);
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

      // If all players selected, transition to question phase
      if (result.allPlayersSelected && result.selectedTheme) {
        // Use nullish coalescing so a configured value of 0 is respected (|| treats 0 as falsy)
        const countdownMs = this.configService.get<number>("intervals.triviaCountdown") ?? 0;

        // Only broadcast the countdown state if there is actually a visible countdown delay;
        // skipping it avoids a brief disabled-button flash on the client when delay is 0
        if (countdownMs > 0) {
          this.server.to(roomKey).emit("game.stateUpdate", {
            gameId: body.gameId,
            state: result.state
          });
        }

        setTimeout(() => {
          const countdownState = this.triviaService.getState(body.gameId);
          if (countdownState) {
            const startedState = this.triviaService.startGame(body.gameId, countdownState);
            this.triviaService.setState(body.gameId, startedState);
            // startTriviaQuestion emits the single authoritative game.stateUpdate + trivia.questionStart
            this.startTriviaQuestion(body.gameId, roomKey);
          }
        }, countdownMs);
      }
    } catch (error: any) {
      this.logger.error("Trivia theme selection error:", error);
      client.emit("game.error", { message: error.message || "Failed to select theme" });
    }
  }

  @UseGuards(WsJwtGuard)

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

      this.logger.log(`[handlePokerAction] Emitting to room: ${roomKey}`);
      if (result.state) {
        const pokerActionSockets = await this.server.in(roomKey).fetchSockets();
        for (const s of pokerActionSockets) {
          const su = (s as any).user;
          if (su) {
            const sanitized = this.pokerService.sanitizeStateForPlayer(result.state, su.sub);
            s.emit("poker.actionResult", {
              gameId: body.gameId,
              action: body.action,
              amount: body.amount,
              state: sanitized,
              handComplete: result.handComplete,
              winners: result.winners,
              nextAction: result.nextAction
            });
          }
        }

        if (result.handComplete) {
          for (const s of pokerActionSockets) {
            const su = (s as any).user;
            if (su) {
              const sanitized = this.pokerService.sanitizeStateForPlayer(result.state, su.sub);
              s.emit("poker.handEnd", {
                gameId: body.gameId,
                winners: result.winners,
                state: sanitized
              });
            }
          }
        }
      }
    } catch (error: any) {
      this.logger.error("Poker action error:", error);
      client.emit("game.error", { message: error.message || "Failed to process poker action" });
    }
  }

  @UseGuards(WsJwtGuard)

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

      // Start new hand (returns null if hand already in progress — duplicate auto-trigger)
      const newState = this.pokerService.startNewHand(body.gameId);
      if (!newState) {
        // Silent return: duplicate request from the second client, first already dealt
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

        const pokerGameOverSockets = await this.server.in(roomKey).fetchSockets();
        for (const s of pokerGameOverSockets) {
          const su = (s as any).user;
          if (su) {
            const sanitized = this.pokerService.sanitizeStateForPlayer(newState, su.sub);
            s.emit("poker.gameOver", {
              gameId: body.gameId,
              winnerId: newState.winnerIds?.[0] || playersWithChips[0]?.userId,
              state: sanitized
            });
          }
        }

        this.server.to(roomKey).emit("game.end", {
          gameId: body.gameId,
          winnerId: newState.winnerIds?.[0] || playersWithChips[0]?.userId,
          reason: "all_chips_won"
        });

        setTimeout(() => {
          this.pokerService.cleanupGame(body.gameId);
        }, 60000);

        return;
      }

      await this.prisma.game.update({
        where: { id: body.gameId },
        data: { state: newState as any }
      });

      const pokerNewHandSockets = await this.server.in(roomKey).fetchSockets();
      for (const s of pokerNewHandSockets) {
        const su = (s as any).user;
        if (su) {
          const sanitized = this.pokerService.sanitizeStateForPlayer(newState, su.sub);
          s.emit("poker.newHand", {
            gameId: body.gameId,
            state: sanitized
          });
          s.emit("game.stateUpdate", {
            gameId: body.gameId,
            state: sanitized
          });
        }
      }
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

  private scheduleBlackjackTurnTimer(gameId: string, roomKey: string) {
    this.blackjackService.setTurnTimer(gameId, async () => {
      try {
        const result = await this.blackjackService.autoActForTimeout(gameId);
        if (!result || !result.success || !result.state) return;

        await this.prisma.game.update({
          where: { id: gameId },
          data: { state: result.state as any }
        });

        const bjTimeoutSockets = await this.server.in(roomKey).fetchSockets();
        for (const s of bjTimeoutSockets) {
          const su = (s as any).user;
          if (su) {
            const sanitized = this.blackjackService.sanitizeStateForPlayer(result.state, su.sub);
            s.emit("blackjack.actionResult", {
              gameId,
              action: 'timeout',
              state: sanitized,
              handComplete: result.handComplete,
              winners: result.winners
            });
          }
        }

        if (result.handComplete) {
          this.blackjackService.clearTurnTimer(gameId);
          for (const s of bjTimeoutSockets) {
            const su = (s as any).user;
            if (su) {
              const sanitized = this.blackjackService.sanitizeStateForPlayer(result.state, su.sub);
              s.emit("blackjack.roundEnd", {
                gameId,
                winners: result.winners,
                state: sanitized
              });
            }
          }
        } else {
          this.scheduleBlackjackTurnTimer(gameId, roomKey);
        }
      } catch (error: any) {
        this.logger.error("Blackjack turn timeout error:", error);
      }
    });
  }

  // ==================== BLACKJACK GAME HANDLERS ====================

  @UseGuards(WsJwtGuard)

  @SubscribeMessage("blackjack.action")
  async handleBlackjackAction(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: BlackjackActionDto
  ) {
    const user = (client as any).user;

    try {
      const game = await this.gamesService.getGame(body.gameId);
      if (game.type !== GameType.BLACKJACK) {
        client.emit("game.error", { message: "Not a blackjack game" });
        return;
      }

      this.assertPlayerInGame(game, user.sub);

      const result = await this.blackjackService.processAction(
        body.gameId,
        user.sub,
        body.action as any,
        body.amount
      );

      if (!result.success) {
        client.emit("game.error", { message: result.error || "Invalid action" });
        return;
      }

      const sessionId = game.sessionId;
      const roomKey = sessionId ? `session:${sessionId}` : `game:${body.gameId}`;

      if (result.state) {
        await this.prisma.game.update({
          where: { id: body.gameId },
          data: { state: result.state as any }
        });
      }

      const bjActionSockets = await this.server.in(roomKey).fetchSockets();
      for (const s of bjActionSockets) {
        const su = (s as any).user;
        if (su && result.state) {
          const sanitized = this.blackjackService.sanitizeStateForPlayer(result.state, su.sub);
          s.emit("blackjack.actionResult", {
            gameId: body.gameId,
            action: body.action,
            amount: body.amount,
            state: sanitized,
            handComplete: result.handComplete,
            winners: result.winners
          });
        }
      }

      if (result.handComplete) {
        this.blackjackService.clearTurnTimer(body.gameId);
        for (const s of bjActionSockets) {
          const su = (s as any).user;
          if (su && result.state) {
            const sanitized = this.blackjackService.sanitizeStateForPlayer(result.state, su.sub);
            s.emit("blackjack.roundEnd", {
              gameId: body.gameId,
              winners: result.winners,
              state: sanitized
            });
          }
        }
      } else {
        this.scheduleBlackjackTurnTimer(body.gameId, roomKey);
      }

    } catch (error: any) {
      this.logger.error("Blackjack action error:", error);
      client.emit("game.error", { message: error.message || "Failed to process blackjack action" });
    }
  }

  @UseGuards(WsJwtGuard)

  @SubscribeMessage("blackjack.startNewHand")
  async handleBlackjackStartNewHand(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: BlackjackNewHandDto
  ) {
    const user = (client as any).user;

    try {
      const game = await this.gamesService.getGame(body.gameId);
      if (game.type !== GameType.BLACKJACK) {
        client.emit("game.error", { message: "Not a blackjack game" });
        return;
      }

      this.assertPlayerInGame(game, user.sub);

      const sessionId = game.sessionId;
      const roomKey = sessionId ? `session:${sessionId}` : `game:${body.gameId}`;

      const newState = this.blackjackService.startNewHand(body.gameId);

      if (!newState) {
        // Game over — a player is out of chips
        const currentState = this.blackjackService.getState(body.gameId);
        const winnerId = currentState?.winnerIds?.[0] ||
          currentState?.players.find(p => p.chips > 0)?.userId || null;

        await this.prisma.game.update({
          where: { id: body.gameId },
          data: {
            status: "COMPLETED",
            endedAt: new Date(),
            winnerUserId: winnerId
          }
        });

        if (currentState) {
          const bjGameOverSockets = await this.server.in(roomKey).fetchSockets();
          for (const s of bjGameOverSockets) {
            const su = (s as any).user;
            if (su) {
              const sanitized = this.blackjackService.sanitizeStateForPlayer(currentState, su.sub);
              s.emit("blackjack.gameOver", {
                gameId: body.gameId,
                winnerId,
                state: sanitized
              });
            }
          }
        }

        this.server.to(roomKey).emit("game.end", {
          gameId: body.gameId,
          winnerId,
          reason: "opponent_broke"
        });

        setTimeout(() => {
          this.blackjackService.cleanupGame(body.gameId);
        }, 60000);

        return;
      }

      await this.prisma.game.update({
        where: { id: body.gameId },
        data: { state: newState as any }
      });

      const bjNewHandSockets = await this.server.in(roomKey).fetchSockets();
      for (const s of bjNewHandSockets) {
        const su = (s as any).user;
        if (su) {
          const sanitized = this.blackjackService.sanitizeStateForPlayer(newState, su.sub);
          s.emit("blackjack.newHand", {
            gameId: body.gameId,
            state: sanitized
          });
          s.emit("game.stateUpdate", {
            gameId: body.gameId,
            state: sanitized
          });
        }
      }

      this.scheduleBlackjackTurnTimer(body.gameId, roomKey);

    } catch (error: any) {
      this.logger.error("Blackjack start new hand error:", error);
      client.emit("game.error", { message: error.message || "Failed to start new hand" });
    }
  }

  @UseGuards(WsJwtGuard)
  @SubscribeMessage("blackjack.endGame")
  async handleBlackjackEndGame(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: { gameId: string }
  ) {
    const user = (client as any).user;

    try {
      const game = await this.gamesService.getGame(body.gameId);
      if (game.type !== GameType.BLACKJACK) {
        client.emit("game.error", { message: "Not a blackjack game" });
        return;
      }

      this.blackjackService.cleanupGame(body.gameId);

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

      this.logger.log(`Blackjack game ${body.gameId} ended by user ${user.sub}`);
    } catch (error: any) {
      this.logger.error("Blackjack end game error:", error);
      client.emit("game.error", { message: error.message || "Failed to end game" });
    }
  }

  // ==================== SPIN THE WHEEL HANDLERS ====================

  @UseGuards(WsJwtGuard)
  @SubscribeMessage("stw.bet")
  async handleStwBet(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: { gameId: string; amount: number }
  ) {
    const user = (client as any).user;
    try {
      const game = await this.gamesService.getGame(body.gameId);
      if (game.type !== GameType.SPIN_THE_WHEEL) {
        client.emit("game.error", { message: "Not a Spin the Wheel game" });
        return;
      }
      this.assertPlayerInGame(game, user.sub);

      const result = this.spinTheWheelService.placeBet(body.gameId, user.sub, body.amount);
      if (!result.success) {
        client.emit("game.error", { message: result.error || "Invalid action" });
        return;
      }

      if (result.state) {
        await this.prisma.game.update({
          where: { id: body.gameId },
          data: { state: result.state as any }
        });
      }

      const sessionId = game.sessionId;
      const roomKey = sessionId ? `session:${sessionId}` : `game:${body.gameId}`;
      const sockets = await this.server.in(roomKey).fetchSockets();

      if (result.spinResult) {
        // Both bets placed — broadcast spin result to everyone
        for (const s of sockets) {
          s.emit("stw.spinResult", {
            gameId: body.gameId,
            state: result.state,
            spinResult: result.spinResult
          });
        }
      } else {
        // Only one bet placed so far — tell everyone state updated
        for (const s of sockets) {
          s.emit("stw.betPlaced", {
            gameId: body.gameId,
            state: result.state
          });
        }
      }
    } catch (error: any) {
      this.logger.error("STW bet error:", error);
      client.emit("game.error", { message: error.message || "Failed to place bet" });
    }
  }

  @UseGuards(WsJwtGuard)
  @SubscribeMessage("stw.newRound")
  async handleStwNewRound(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: { gameId: string }
  ) {
    const user = (client as any).user;
    try {
      const game = await this.gamesService.getGame(body.gameId);
      if (game.type !== GameType.SPIN_THE_WHEEL) {
        client.emit("game.error", { message: "Not a Spin the Wheel game" });
        return;
      }
      this.assertPlayerInGame(game, user.sub);

      const newState = this.spinTheWheelService.startNewRound(body.gameId);
      if (!newState) {
        client.emit("game.error", { message: "Could not start new round" });
        return;
      }

      await this.prisma.game.update({
        where: { id: body.gameId },
        data: { state: newState as any }
      });

      const sessionId = game.sessionId;
      const roomKey = sessionId ? `session:${sessionId}` : `game:${body.gameId}`;
      this.server.to(roomKey).emit("stw.newRound", {
        gameId: body.gameId,
        state: newState
      });
    } catch (error: any) {
      this.logger.error("STW new round error:", error);
      client.emit("game.error", { message: error.message || "Failed to start new round" });
    }
  }

  @UseGuards(WsJwtGuard)
  @SubscribeMessage("stw.endGame")
  async handleStwEndGame(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: { gameId: string }
  ) {
    const user = (client as any).user;
    try {
      const game = await this.gamesService.getGame(body.gameId);
      this.spinTheWheelService.cleanupGame(body.gameId);
      await this.prisma.game.update({
        where: { id: body.gameId },
        data: { status: "COMPLETED", endedAt: new Date() }
      });
      const sessionId = game.sessionId;
      const roomKey = sessionId ? `session:${sessionId}` : `game:${body.gameId}`;
      this.server.to(roomKey).emit("game.end", { gameId: body.gameId, reason: "game_ended" });
    } catch (error: any) {
      this.logger.error("STW end game error:", error);
      client.emit("game.error", { message: error.message || "Failed to end game" });
    }
  }

  // ==================== BS GAME HANDLERS ====================

  private scheduleBsTurnTimer(gameId: string, roomKey: string) {
    this.bsService.setTurnTimer(gameId, async () => {
      try {
        const state = this.bsService.getState(gameId);
        if (!state || state.phase !== 'playing') return;

        const currentPlayer = state.players[state.currentPlayerIndex];
        if (!currentPlayer || currentPlayer.hand.length === 0) return;

        const result = await this.bsService.processPlayCards(gameId, currentPlayer.userId, [0]);
        if (!result.success || !result.state) return;

        await this.prisma.game.update({
          where: { id: gameId },
          data: { state: result.state as any }
        });

        for (const p of result.state.players) {
          const clientState = this.bsService.sanitizeStateForPlayer(result.state, p.userId);
          const sockets = await this.server.in(roomKey).fetchSockets();
          for (const s of sockets) {
            if ((s as any).user?.sub === p.userId) {
              s.emit("bs.playResult", { gameId, state: clientState });
            }
          }
        }

        this.scheduleBsCallWindowTimer(gameId, roomKey);
      } catch (error: any) {
        this.logger.error("BS turn timeout error:", error);
      }
    });
  }

  private scheduleBsCallWindowTimer(gameId: string, roomKey: string) {
    this.bsService.setCallWindowTimer(gameId, async () => {
      try {
        const state = this.bsService.getState(gameId);
        if (!state || state.phase !== 'callWindow' || !state.lastPlay) return;

        const opponentId = state.players.find(p => p.userId !== state.lastPlay!.playerId)?.userId;
        if (!opponentId) return;

        const result = await this.bsService.processPass(gameId, opponentId);
        if (!result.success || !result.state) return;

        await this.prisma.game.update({
          where: { id: gameId },
          data: { state: result.state as any }
        });

        if (result.state.phase === 'ended') {
          for (const p of result.state.players) {
            const clientState = this.bsService.sanitizeStateForPlayer(result.state, p.userId);
            const sockets = await this.server.in(roomKey).fetchSockets();
            for (const s of sockets) {
              if ((s as any).user?.sub === p.userId) {
                s.emit("bs.callResult", { gameId, state: clientState, wasBS: null, revealedCards: null, penaltyTo: null, autoPass: true });
              }
            }
          }

          const winnerId = result.state.winnerId;
          this.server.to(roomKey).emit("bs.gameOver", { gameId, winnerId });
          this.server.to(roomKey).emit("game.end", { gameId, winnerId, reason: "bs_win" });

          await this.prisma.game.update({
            where: { id: gameId },
            data: { status: "COMPLETED", endedAt: new Date(), winnerUserId: winnerId }
          });

          setTimeout(() => this.bsService.cleanupGame(gameId), 60000);
          return;
        }

        for (const p of result.state.players) {
          const clientState = this.bsService.sanitizeStateForPlayer(result.state, p.userId);
          const sockets = await this.server.in(roomKey).fetchSockets();
          for (const s of sockets) {
            if ((s as any).user?.sub === p.userId) {
              s.emit("bs.callResult", { gameId, state: clientState, wasBS: null, revealedCards: null, penaltyTo: null, autoPass: true });
            }
          }
        }

        this.scheduleBsTurnTimer(gameId, roomKey);
      } catch (error: any) {
        this.logger.error("BS call window timeout error:", error);
      }
    });
  }

  @UseGuards(WsJwtGuard)

  @SubscribeMessage("bs.playCards")
  async handleBsPlayCards(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: BsPlayCardsDto
  ) {
    const user = (client as any).user;

    try {
      const game = await this.gamesService.getGame(body.gameId);
      if (game.type !== GameType.BS) {
        client.emit("game.error", { message: "Not a BS game" });
        return;
      }

      this.assertPlayerInGame(game, user.sub);

      const result = await this.bsService.processPlayCards(body.gameId, user.sub, body.cardIndices);

      if (!result.success) {
        client.emit("game.error", { message: result.error || "Invalid action" });
        return;
      }

      const sessionId = game.sessionId;
      const roomKey = sessionId ? `session:${sessionId}` : `game:${body.gameId}`;

      if (result.state) {
        await this.prisma.game.update({
          where: { id: body.gameId },
          data: { state: result.state as any }
        });

        for (const p of result.state.players) {
          const clientState = this.bsService.sanitizeStateForPlayer(result.state, p.userId);
          const sockets = await this.server.in(roomKey).fetchSockets();
          for (const s of sockets) {
            if ((s as any).user?.sub === p.userId) {
              s.emit("bs.playResult", { gameId: body.gameId, state: clientState });
            }
          }
        }

      }

      this.scheduleBsCallWindowTimer(body.gameId, roomKey);

    } catch (error: any) {
      this.logger.error("BS play cards error:", error);
      client.emit("game.error", { message: error.message || "Failed to play cards" });
    }
  }

  @UseGuards(WsJwtGuard)

  @SubscribeMessage("bs.call")
  async handleBsCall(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: BsCallDto
  ) {
    const user = (client as any).user;

    try {
      const game = await this.gamesService.getGame(body.gameId);
      if (game.type !== GameType.BS) {
        client.emit("game.error", { message: "Not a BS game" });
        return;
      }

      this.assertPlayerInGame(game, user.sub);

      const sessionId = game.sessionId;
      const roomKey = sessionId ? `session:${sessionId}` : `game:${body.gameId}`;

      if (body.action === 'callBS') {
        const result = await this.bsService.processCallBS(body.gameId, user.sub);

        if (!result.success) {
          client.emit("game.error", { message: result.error || "Invalid call" });
          return;
        }

        if (result.state) {
          await this.prisma.game.update({
            where: { id: body.gameId },
            data: { state: result.state as any }
          });

          for (const p of result.state.players) {
            const clientState = this.bsService.sanitizeStateForPlayer(result.state, p.userId);
            const sockets = await this.server.in(roomKey).fetchSockets();
            for (const s of sockets) {
              if ((s as any).user?.sub === p.userId) {
                s.emit("bs.callResult", {
                  gameId: body.gameId,
                  state: clientState,
                  wasBS: result.wasBS,
                  revealedCards: result.revealedCards,
                  penaltyTo: result.penaltyTo
                });
              }
            }
          }

          setTimeout(async () => {
            try {
              const resolvedState = await this.bsService.resolveAfterReveal(body.gameId);
              if (!resolvedState) return;

              await this.prisma.game.update({
                where: { id: body.gameId },
                data: { state: resolvedState as any }
              });

              if (resolvedState.phase === 'ended') {
                const winnerId = resolvedState.winnerId;
                for (const p of resolvedState.players) {
                  const clientState = this.bsService.sanitizeStateForPlayer(resolvedState, p.userId);
                  const sockets = await this.server.in(roomKey).fetchSockets();
                  for (const s of sockets) {
                    if ((s as any).user?.sub === p.userId) {
                      s.emit("bs.resolved", { gameId: body.gameId, state: clientState });
                    }
                  }
                }
                this.server.to(roomKey).emit("bs.gameOver", { gameId: body.gameId, winnerId });
                this.server.to(roomKey).emit("game.end", { gameId: body.gameId, winnerId, reason: "bs_win" });

                await this.prisma.game.update({
                  where: { id: body.gameId },
                  data: { status: "COMPLETED", endedAt: new Date(), winnerUserId: winnerId }
                });

                setTimeout(() => this.bsService.cleanupGame(body.gameId), 60000);
              } else {
                for (const p of resolvedState.players) {
                  const clientState = this.bsService.sanitizeStateForPlayer(resolvedState, p.userId);
                  const sockets = await this.server.in(roomKey).fetchSockets();
                  for (const s of sockets) {
                    if ((s as any).user?.sub === p.userId) {
                      s.emit("bs.resolved", { gameId: body.gameId, state: clientState });
                    }
                  }
                }

                this.scheduleBsTurnTimer(body.gameId, roomKey);
              }
            } catch (err: any) {
              this.logger.error("BS resolve after reveal error:", err);
            }
          }, 2500);
        }
      } else {
        const result = await this.bsService.processPass(body.gameId, user.sub);

        if (!result.success) {
          client.emit("game.error", { message: result.error || "Invalid pass" });
          return;
        }

        if (result.state) {
          await this.prisma.game.update({
            where: { id: body.gameId },
            data: { state: result.state as any }
          });

          if (result.state.phase === 'ended') {
            const winnerId = result.state.winnerId;
            for (const p of result.state.players) {
              const clientState = this.bsService.sanitizeStateForPlayer(result.state, p.userId);
              const sockets = await this.server.in(roomKey).fetchSockets();
              for (const s of sockets) {
                if ((s as any).user?.sub === p.userId) {
                  s.emit("bs.callResult", { gameId: body.gameId, state: clientState, wasBS: null, revealedCards: null, penaltyTo: null });
                }
              }
            }
            this.server.to(roomKey).emit("bs.gameOver", { gameId: body.gameId, winnerId });
            this.server.to(roomKey).emit("game.end", { gameId: body.gameId, winnerId, reason: "bs_win" });

            await this.prisma.game.update({
              where: { id: body.gameId },
              data: { status: "COMPLETED", endedAt: new Date(), winnerUserId: winnerId }
            });

            setTimeout(() => this.bsService.cleanupGame(body.gameId), 60000);
          } else {
            for (const p of result.state.players) {
              const clientState = this.bsService.sanitizeStateForPlayer(result.state, p.userId);
              const sockets = await this.server.in(roomKey).fetchSockets();
              for (const s of sockets) {
                if ((s as any).user?.sub === p.userId) {
                  s.emit("bs.callResult", { gameId: body.gameId, state: clientState, wasBS: null, revealedCards: null, penaltyTo: null });
                }
              }
            }

            this.scheduleBsTurnTimer(body.gameId, roomKey);
          }
        }
      }

    } catch (error: any) {
      this.logger.error("BS call error:", error);
      client.emit("game.error", { message: error.message || "Failed to process BS call" });
    }
  }

  @UseGuards(WsJwtGuard)
  @SubscribeMessage("bs.endGame")
  async handleBsEndGame(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: BsEndGameDto
  ) {
    const user = (client as any).user;

    try {
      const game = await this.gamesService.getGame(body.gameId);
      if (game.type !== GameType.BS) {
        client.emit("game.error", { message: "Not a BS game" });
        return;
      }

      this.bsService.cleanupGame(body.gameId);

      await this.prisma.game.update({
        where: { id: body.gameId },
        data: { status: "COMPLETED", endedAt: new Date() }
      });

      const sessionId = game.sessionId;
      const roomKey = sessionId ? `session:${sessionId}` : `game:${body.gameId}`;

      this.server.to(roomKey).emit("game.end", { gameId: body.gameId, reason: "game_ended" });

      this.logger.log(`BS game ${body.gameId} ended by user ${user.sub}`);
    } catch (error: any) {
      this.logger.error("BS end game error:", error);
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
        client.broadcast.to(roomKey).emit('penguin.opponentReady', { gameId: body.gameId, userId: user.sub });
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

  // ==================== MONOPOLY GAME HANDLERS ====================

  private async handleMonopolyAction(
    client: Socket,
    gameId: string,
    actionFn: () => any,
    actionName: string,
  ) {
    const user = (client as any).user;
    try {
      const game = await this.gamesService.getGame(gameId);
      if (game.type !== GameType.MONOPOLY) {
        client.emit('game.error', { message: 'Not a Monopoly game' });
        return;
      }
      this.assertPlayerInGame(game, user.sub);

      const result = actionFn();
      if (!result.success) {
        client.emit('game.error', { message: result.error || 'Invalid action' });
        return;
      }

      const sessionId = game.sessionId;
      const roomKey = sessionId ? `session:${sessionId}` : `game:${gameId}`;

      if (result.state) {
        await this.prisma.game.update({
          where: { id: gameId },
          data: { state: result.state as any },
        });
      }

      this.server.to(roomKey).emit('monopoly.stateUpdate', {
        gameId,
        state: result.state,
        events: result.events,
        action: actionName,
      });

      if (result.gameOver) {
        await this.prisma.game.update({
          where: { id: gameId },
          data: {
            status: 'COMPLETED',
            endedAt: new Date(),
            winnerUserId: result.winnerId,
          },
        });

        this.server.to(roomKey).emit('game.end', {
          gameId,
          winnerId: result.winnerId,
          reason: 'bankruptcy',
        });

        this.monopolyService.cleanupGame(gameId);
      }
    } catch (err: any) {
      this.logger.error(`Monopoly ${actionName} error:`, err);
      client.emit('game.error', { message: err.message || `Failed to ${actionName}` });
    }
  }

  @UseGuards(WsJwtGuard)

  @SubscribeMessage('monopoly.rollDice')
  async handleMonopolyRollDice(@ConnectedSocket() client: Socket, @MessageBody() body: MonopolyGameDto) {
    const user = (client as any).user;
    await this.handleMonopolyAction(client, body.gameId,
      () => this.monopolyService.rollDice(body.gameId, user.sub), 'rollDice');
  }

  @UseGuards(WsJwtGuard)

  @SubscribeMessage('monopoly.buyProperty')
  async handleMonopolyBuyProperty(@ConnectedSocket() client: Socket, @MessageBody() body: MonopolyGameDto) {
    const user = (client as any).user;
    await this.handleMonopolyAction(client, body.gameId,
      () => this.monopolyService.buyProperty(body.gameId, user.sub), 'buyProperty');
  }

  @UseGuards(WsJwtGuard)

  @SubscribeMessage('monopoly.declineProperty')
  async handleMonopolyDeclineProperty(@ConnectedSocket() client: Socket, @MessageBody() body: MonopolyGameDto) {
    const user = (client as any).user;
    await this.handleMonopolyAction(client, body.gameId,
      () => this.monopolyService.declineProperty(body.gameId, user.sub), 'declineProperty');
  }

  @UseGuards(WsJwtGuard)

  @SubscribeMessage('monopoly.placeBid')
  async handleMonopolyPlaceBid(@ConnectedSocket() client: Socket, @MessageBody() body: MonopolyBidDto) {
    const user = (client as any).user;
    await this.handleMonopolyAction(client, body.gameId,
      () => this.monopolyService.placeBid(body.gameId, user.sub, body.amount), 'placeBid');
  }

  @UseGuards(WsJwtGuard)

  @SubscribeMessage('monopoly.passBid')
  async handleMonopolyPassBid(@ConnectedSocket() client: Socket, @MessageBody() body: MonopolyGameDto) {
    const user = (client as any).user;
    await this.handleMonopolyAction(client, body.gameId,
      () => this.monopolyService.passBid(body.gameId, user.sub), 'passBid');
  }

  @UseGuards(WsJwtGuard)

  @SubscribeMessage('monopoly.buildHouse')
  async handleMonopolyBuildHouse(@ConnectedSocket() client: Socket, @MessageBody() body: MonopolyPropertyDto) {
    const user = (client as any).user;
    await this.handleMonopolyAction(client, body.gameId,
      () => this.monopolyService.buildHouse(body.gameId, user.sub, body.propertyIndex), 'buildHouse');
  }

  @UseGuards(WsJwtGuard)

  @SubscribeMessage('monopoly.sellHouse')
  async handleMonopolySellHouse(@ConnectedSocket() client: Socket, @MessageBody() body: MonopolyPropertyDto) {
    const user = (client as any).user;
    await this.handleMonopolyAction(client, body.gameId,
      () => this.monopolyService.sellHouse(body.gameId, user.sub, body.propertyIndex), 'sellHouse');
  }

  @UseGuards(WsJwtGuard)

  @SubscribeMessage('monopoly.mortgage')
  async handleMonopolyMortgage(@ConnectedSocket() client: Socket, @MessageBody() body: MonopolyPropertyDto) {
    const user = (client as any).user;
    await this.handleMonopolyAction(client, body.gameId,
      () => this.monopolyService.mortgageProperty(body.gameId, user.sub, body.propertyIndex), 'mortgage');
  }

  @UseGuards(WsJwtGuard)

  @SubscribeMessage('monopoly.unmortgage')
  async handleMonopolyUnmortgage(@ConnectedSocket() client: Socket, @MessageBody() body: MonopolyPropertyDto) {
    const user = (client as any).user;
    await this.handleMonopolyAction(client, body.gameId,
      () => this.monopolyService.unmortgageProperty(body.gameId, user.sub, body.propertyIndex), 'unmortgage');
  }

  @UseGuards(WsJwtGuard)

  @SubscribeMessage('monopoly.proposeTrade')
  async handleMonopolyProposeTrade(@ConnectedSocket() client: Socket, @MessageBody() body: MonopolyTradeOfferDto) {
    const user = (client as any).user;
    await this.handleMonopolyAction(client, body.gameId,
      () => this.monopolyService.proposeTrade(body.gameId, user.sub, {
        fromUserId: user.sub,
        toUserId: '',
        offeredProperties: body.offeredProperties,
        requestedProperties: body.requestedProperties,
        offeredCash: body.offeredCash,
        requestedCash: body.requestedCash,
      }), 'proposeTrade');
  }

  @UseGuards(WsJwtGuard)

  @SubscribeMessage('monopoly.respondTrade')
  async handleMonopolyRespondTrade(@ConnectedSocket() client: Socket, @MessageBody() body: MonopolyTradeResponseDto) {
    const user = (client as any).user;
    await this.handleMonopolyAction(client, body.gameId,
      () => this.monopolyService.respondTrade(body.gameId, user.sub, body.accept), 'respondTrade');
  }

  @UseGuards(WsJwtGuard)

  @SubscribeMessage('monopoly.payJailFine')
  async handleMonopolyPayJailFine(@ConnectedSocket() client: Socket, @MessageBody() body: MonopolyGameDto) {
    const user = (client as any).user;
    await this.handleMonopolyAction(client, body.gameId,
      () => this.monopolyService.payJailFine(body.gameId, user.sub), 'payJailFine');
  }

  @UseGuards(WsJwtGuard)

  @SubscribeMessage('monopoly.useJailCard')
  async handleMonopolyUseJailCard(@ConnectedSocket() client: Socket, @MessageBody() body: MonopolyGameDto) {
    const user = (client as any).user;
    await this.handleMonopolyAction(client, body.gameId,
      () => this.monopolyService.useJailCard(body.gameId, user.sub), 'useJailCard');
  }

  @UseGuards(WsJwtGuard)

  @SubscribeMessage('monopoly.endTurn')
  async handleMonopolyEndTurn(@ConnectedSocket() client: Socket, @MessageBody() body: MonopolyGameDto) {
    const user = (client as any).user;
    await this.handleMonopolyAction(client, body.gameId,
      () => this.monopolyService.endTurn(body.gameId, user.sub), 'endTurn');
  }

  @UseGuards(WsJwtGuard)

  @SubscribeMessage('monopoly.declareBankruptcy')
  async handleMonopolyDeclareBankruptcy(@ConnectedSocket() client: Socket, @MessageBody() body: MonopolyGameDto) {
    const user = (client as any).user;
    await this.handleMonopolyAction(client, body.gameId,
      () => this.monopolyService.declareBankruptcy(body.gameId, user.sub), 'declareBankruptcy');
  }

  // ─── Word Game: HANGMAN ────────────────────────────────

  @UseGuards(WsJwtGuard)
  @SubscribeMessage('hangman.pickWord')
  async handleHangmanPickWord(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: { gameId: string; word: string }
  ) {
    const user = (client as any).user;
    try {
      const game = await this.gamesService.getGame(body.gameId);
      if (game.type !== GameType.HANGMAN) {
        client.emit("game.error", { message: "Not a Hangman game" });
        return;
      }
      this.assertPlayerInGame(game, user.sub);
      const roomKey = game.sessionId ? `session:${game.sessionId}` : `game:${body.gameId}`;

      const result = await this.hangmanService.pickWord(body.gameId, user.sub, body.word);

      if (!result.success) {
        client.emit("game.error", { message: result.error });
        return;
      }

      const sockets = await this.server.in(roomKey).fetchSockets();
      for (const s of sockets) {
        const su = (s as any).user;
        if (su) {
          s.emit("game.stateUpdate", {
            gameId: body.gameId,
            state: this.hangmanService.sanitizeStateForPlayer(result.state!, su.sub),
          });
        }
      }
    } catch (error: any) {
      client.emit("game.error", { message: error.message || "Game error" });
    }
  }

  @UseGuards(WsJwtGuard)
  @SubscribeMessage('hangman.guess')
  async handleHangmanGuess(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: { gameId: string; letter?: string; word?: string }
  ) {
    const user = (client as any).user;
    try {
      const game = await this.gamesService.getGame(body.gameId);
      if (game.type !== GameType.HANGMAN) {
        client.emit("game.error", { message: "Not a Hangman game" });
        return;
      }
      this.assertPlayerInGame(game, user.sub);
      const roomKey = game.sessionId ? `session:${game.sessionId}` : `game:${body.gameId}`;

      let result: any;
      if (body.word) {
        result = await this.hangmanService.guessWord(body.gameId, user.sub, body.word);
      } else if (body.letter) {
        result = await this.hangmanService.guessLetter(body.gameId, user.sub, body.letter);
      } else {
        client.emit("game.error", { message: "Must provide letter or word" });
        return;
      }

      if (!result.success) {
        client.emit("game.error", { message: result.error });
        return;
      }

      const sockets = await this.server.in(roomKey).fetchSockets();
      for (const s of sockets) {
        const su = (s as any).user;
        if (su) {
          s.emit("game.stateUpdate", {
            gameId: body.gameId,
            state: this.hangmanService.sanitizeStateForPlayer(result.state!, su.sub),
          });
        }
      }

      if (result.gameEnded) {
        this.server.to(roomKey).emit("game.end", {
          gameId: body.gameId,
          winnerId: result.winner ?? null,
          isDraw: result.isDraw ?? false,
          reason: result.winner ? "win" : (result.isDraw ? "draw" : "loss"),
          finalState: result.state,
        });
      }
    } catch (error: any) {
      client.emit("game.error", { message: error.message || "Game error" });
    }
  }

  // ─── Word Game: GHOST ────────────────────────────────

  @UseGuards(WsJwtGuard)
  @SubscribeMessage('ghost.addLetter')
  async handleGhostAddLetter(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: { gameId: string; letter: string }
  ) {
    const user = (client as any).user;
    try {
      const game = await this.gamesService.getGame(body.gameId);
      if (game.type !== GameType.GHOST) {
        client.emit("game.error", { message: "Not a Ghost game" });
        return;
      }
      this.assertPlayerInGame(game, user.sub);
      const roomKey = game.sessionId ? `session:${game.sessionId}` : `game:${body.gameId}`;

      const result = await this.ghostService.addLetter(body.gameId, user.sub, body.letter);

      if (!result.success) {
        client.emit("game.error", { message: result.error });
        return;
      }

      this.server.to(roomKey).emit("game.stateUpdate", {
        gameId: body.gameId,
        state: result.state,
      });

      if (result.gameEnded) {
        this.server.to(roomKey).emit("game.end", {
          gameId: body.gameId,
          winnerId: result.winner ?? null,
          isDraw: result.isDraw ?? false,
          reason: result.winner ? "win" : (result.isDraw ? "draw" : "loss"),
          finalState: result.state,
        });
      }
    } catch (error: any) {
      client.emit("game.error", { message: error.message || "Game error" });
    }
  }

  @UseGuards(WsJwtGuard)
  @SubscribeMessage('ghost.challenge')
  async handleGhostChallenge(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: { gameId: string }
  ) {
    const user = (client as any).user;
    try {
      const game = await this.gamesService.getGame(body.gameId);
      if (game.type !== GameType.GHOST) {
        client.emit("game.error", { message: "Not a Ghost game" });
        return;
      }
      this.assertPlayerInGame(game, user.sub);
      const roomKey = game.sessionId ? `session:${game.sessionId}` : `game:${body.gameId}`;

      const result = await this.ghostService.challenge(body.gameId, user.sub);

      if (!result.success) {
        client.emit("game.error", { message: result.error });
        return;
      }

      this.server.to(roomKey).emit("game.stateUpdate", {
        gameId: body.gameId,
        state: result.state,
      });

      if (result.gameEnded) {
        this.server.to(roomKey).emit("game.end", {
          gameId: body.gameId,
          winnerId: result.winner ?? null,
          isDraw: result.isDraw ?? false,
          reason: result.winner ? "win" : (result.isDraw ? "draw" : "loss"),
          finalState: result.state,
        });
      }
    } catch (error: any) {
      client.emit("game.error", { message: error.message || "Game error" });
    }
  }

  @UseGuards(WsJwtGuard)
  @SubscribeMessage('ghost.respond')
  async handleGhostRespond(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: { gameId: string; word: string }
  ) {
    const user = (client as any).user;
    try {
      const game = await this.gamesService.getGame(body.gameId);
      if (game.type !== GameType.GHOST) {
        client.emit("game.error", { message: "Not a Ghost game" });
        return;
      }
      this.assertPlayerInGame(game, user.sub);
      const roomKey = game.sessionId ? `session:${game.sessionId}` : `game:${body.gameId}`;

      const result = await this.ghostService.respondToChallenge(body.gameId, user.sub, body.word);

      if (!result.success) {
        client.emit("game.error", { message: result.error });
        return;
      }

      this.server.to(roomKey).emit("game.stateUpdate", {
        gameId: body.gameId,
        state: result.state,
      });

      if (result.gameEnded) {
        this.server.to(roomKey).emit("game.end", {
          gameId: body.gameId,
          winnerId: result.winner ?? null,
          isDraw: result.isDraw ?? false,
          reason: result.winner ? "win" : (result.isDraw ? "draw" : "loss"),
          finalState: result.state,
        });
      }
    } catch (error: any) {
      client.emit("game.error", { message: error.message || "Game error" });
    }
  }

  // ─── Word Game: WORDLE ────────────────────────────────

  @UseGuards(WsJwtGuard)
  @SubscribeMessage('wordle.guess')
  async handleWordleGuess(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: { gameId: string; word: string }
  ) {
    const user = (client as any).user;
    try {
      const game = await this.gamesService.getGame(body.gameId);
      if (game.type !== GameType.WORDLE) {
        client.emit("game.error", { message: "Not a Wordle game" });
        return;
      }
      this.assertPlayerInGame(game, user.sub);
      const roomKey = game.sessionId ? `session:${game.sessionId}` : `game:${body.gameId}`;

      const result = await this.wordleService.submitGuess(body.gameId, user.sub, body.word);

      if (!result.success) {
        client.emit("game.error", { message: result.error });
        return;
      }

      const sockets = await this.server.in(roomKey).fetchSockets();
      for (const s of sockets) {
        const su = (s as any).user;
        if (su) {
          s.emit("game.stateUpdate", {
            gameId: body.gameId,
            state: this.wordleService.sanitizeStateForPlayer(result.state!, su.sub),
          });
        }
      }

      if (result.gameEnded) {
        this.server.to(roomKey).emit("game.end", {
          gameId: body.gameId,
          winnerId: result.winner ?? null,
          isDraw: result.isDraw ?? false,
          reason: result.winner ? "win" : (result.isDraw ? "draw" : "loss"),
          finalState: result.state,
        });
      }
    } catch (error: any) {
      client.emit("game.error", { message: error.message || "Game error" });
    }
  }

  // ─── Word Game: JOTTO ────────────────────────────────

  @UseGuards(WsJwtGuard)
  @SubscribeMessage('jotto.pickWord')
  async handleJottoPickWord(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: { gameId: string; word: string }
  ) {
    const user = (client as any).user;
    try {
      const game = await this.gamesService.getGame(body.gameId);
      if (game.type !== GameType.JOTTO) {
        client.emit("game.error", { message: "Not a Jotto game" });
        return;
      }
      this.assertPlayerInGame(game, user.sub);
      const roomKey = game.sessionId ? `session:${game.sessionId}` : `game:${body.gameId}`;

      const result = await this.jottoService.pickWord(body.gameId, user.sub, body.word);

      if (!result.success) {
        client.emit("game.error", { message: result.error });
        return;
      }

      const sockets = await this.server.in(roomKey).fetchSockets();
      for (const s of sockets) {
        const su = (s as any).user;
        if (su) {
          s.emit("game.stateUpdate", {
            gameId: body.gameId,
            state: this.jottoService.sanitizeStateForPlayer(result.state!, su.sub),
          });
        }
      }
    } catch (error: any) {
      client.emit("game.error", { message: error.message || "Game error" });
    }
  }

  @UseGuards(WsJwtGuard)
  @SubscribeMessage('jotto.guess')
  async handleJottoGuess(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: { gameId: string; word: string }
  ) {
    const user = (client as any).user;
    try {
      const game = await this.gamesService.getGame(body.gameId);
      if (game.type !== GameType.JOTTO) {
        client.emit("game.error", { message: "Not a Jotto game" });
        return;
      }
      this.assertPlayerInGame(game, user.sub);
      const roomKey = game.sessionId ? `session:${game.sessionId}` : `game:${body.gameId}`;

      const result = await this.jottoService.submitGuess(body.gameId, user.sub, body.word);

      if (!result.success) {
        client.emit("game.error", { message: result.error });
        return;
      }

      const sockets = await this.server.in(roomKey).fetchSockets();
      for (const s of sockets) {
        const su = (s as any).user;
        if (su) {
          s.emit("game.stateUpdate", {
            gameId: body.gameId,
            state: this.jottoService.sanitizeStateForPlayer(result.state!, su.sub),
          });
        }
      }

      if (result.gameEnded) {
        this.server.to(roomKey).emit("game.end", {
          gameId: body.gameId,
          winnerId: result.winner ?? null,
          isDraw: result.isDraw ?? false,
          reason: result.winner ? "win" : (result.isDraw ? "draw" : "loss"),
          finalState: result.state,
        });
      }
    } catch (error: any) {
      client.emit("game.error", { message: error.message || "Game error" });
    }
  }

  // ─── Word Game: SPELLING BEE ────────────────────────────────

  @UseGuards(WsJwtGuard)
  @SubscribeMessage('spellingBee.submit')
  async handleSpellingBeeSubmit(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: { gameId: string; word: string }
  ) {
    const user = (client as any).user;
    try {
      const game = await this.gamesService.getGame(body.gameId);
      if (game.type !== GameType.SPELLING_BEE) {
        client.emit("game.error", { message: "Not a Spelling Bee game" });
        return;
      }
      this.assertPlayerInGame(game, user.sub);
      const roomKey = game.sessionId ? `session:${game.sessionId}` : `game:${body.gameId}`;

      const result = await this.spellingBeeService.submitWord(body.gameId, user.sub, body.word);

      if (!result.success) {
        client.emit("game.error", { message: result.error });
        return;
      }

      const sockets = await this.server.in(roomKey).fetchSockets();
      for (const s of sockets) {
        const su = (s as any).user;
        if (su) {
          s.emit("game.stateUpdate", {
            gameId: body.gameId,
            state: this.spellingBeeService.sanitizeStateForPlayer(result.state!, su.sub),
          });
        }
      }

      if (result.gameEnded) {
        this.server.to(roomKey).emit("game.end", {
          gameId: body.gameId,
          winnerId: result.winner ?? null,
          isDraw: result.isDraw ?? false,
          reason: result.winner ? "win" : (result.isDraw ? "draw" : "loss"),
          finalState: result.state,
        });
      }
    } catch (error: any) {
      client.emit("game.error", { message: error.message || "Game error" });
    }
  }

  @UseGuards(WsJwtGuard)
  @SubscribeMessage('spellingBee.endGame')
  async handleSpellingBeeEnd(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: { gameId: string }
  ) {
    const user = (client as any).user;
    try {
      const game = await this.gamesService.getGame(body.gameId);
      if (game.type !== GameType.SPELLING_BEE) {
        client.emit("game.error", { message: "Not a Spelling Bee game" });
        return;
      }
      this.assertPlayerInGame(game, user.sub);
      const roomKey = game.sessionId ? `session:${game.sessionId}` : `game:${body.gameId}`;

      const result = await this.spellingBeeService.endGame(body.gameId);

      if (!result.success) {
        client.emit("game.error", { message: result.error });
        return;
      }

      const sockets = await this.server.in(roomKey).fetchSockets();
      for (const s of sockets) {
        const su = (s as any).user;
        if (su) {
          s.emit("game.stateUpdate", {
            gameId: body.gameId,
            state: this.spellingBeeService.sanitizeStateForPlayer(result.state!, su.sub),
          });
        }
      }

      if (result.gameEnded) {
        this.server.to(roomKey).emit("game.end", {
          gameId: body.gameId,
          winnerId: result.winner ?? null,
          isDraw: result.isDraw ?? false,
          reason: result.winner ? "win" : (result.isDraw ? "draw" : "time"),
          finalState: result.state,
        });
      }
    } catch (error: any) {
      client.emit("game.error", { message: error.message || "Game error" });
    }
  }

  // ─── Word Game: LETTER BOXED ────────────────────────────────

  @UseGuards(WsJwtGuard)
  @SubscribeMessage('letterBoxed.submit')
  async handleLetterBoxedSubmit(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: { gameId: string; word: string }
  ) {
    const user = (client as any).user;
    try {
      const game = await this.gamesService.getGame(body.gameId);
      if (game.type !== GameType.LETTER_BOXED) {
        client.emit("game.error", { message: "Not a Letter Boxed game" });
        return;
      }
      this.assertPlayerInGame(game, user.sub);
      const roomKey = game.sessionId ? `session:${game.sessionId}` : `game:${body.gameId}`;

      const result = await this.letterBoxedService.submitWord(body.gameId, user.sub, body.word);

      if (!result.success) {
        client.emit("game.error", { message: result.error });
        return;
      }

      this.server.to(roomKey).emit("game.stateUpdate", {
        gameId: body.gameId,
        state: result.state,
      });

      if (result.gameEnded) {
        this.server.to(roomKey).emit("game.end", {
          gameId: body.gameId,
          winnerId: result.winner ?? null,
          isDraw: result.isDraw ?? false,
          reason: result.winner ? "win" : (result.isDraw ? "draw" : "loss"),
          finalState: result.state,
        });
      }
    } catch (error: any) {
      client.emit("game.error", { message: error.message || "Game error" });
    }
  }

  // ─── Word Game: BOGGLE ────────────────────────────────

  @UseGuards(WsJwtGuard)
  @SubscribeMessage('boggle.submit')
  async handleBoggleSubmit(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: { gameId: string; word: string }
  ) {
    const user = (client as any).user;
    try {
      const game = await this.gamesService.getGame(body.gameId);
      if (game.type !== GameType.BOGGLE) {
        client.emit("game.error", { message: "Not a Boggle game" });
        return;
      }
      this.assertPlayerInGame(game, user.sub);
      const roomKey = game.sessionId ? `session:${game.sessionId}` : `game:${body.gameId}`;

      const result = await this.boggleService.submitWord(body.gameId, user.sub, body.word);

      if (!result.success) {
        client.emit("game.error", { message: result.error });
        return;
      }

      const sockets = await this.server.in(roomKey).fetchSockets();
      for (const s of sockets) {
        const su = (s as any).user;
        if (su) {
          s.emit("game.stateUpdate", {
            gameId: body.gameId,
            state: this.boggleService.sanitizeStateForPlayer(result.state!, su.sub),
          });
        }
      }

      if (result.gameEnded) {
        const timer = this.boggleTimers.get(body.gameId);
        if (timer) {
          clearTimeout(timer);
          this.boggleTimers.delete(body.gameId);
        }
        this.server.to(roomKey).emit("game.end", {
          gameId: body.gameId,
          winnerId: result.winner ?? null,
          isDraw: result.isDraw ?? false,
          reason: result.winner ? "win" : (result.isDraw ? "draw" : "time"),
          finalState: result.state,
        });
      }
    } catch (error: any) {
      client.emit("game.error", { message: error.message || "Game error" });
    }
  }

  // ─── Word Game: SCATTERGORIES ────────────────────────────────

  @UseGuards(WsJwtGuard)
  @SubscribeMessage('scattergories.submit')
  async handleScattergoriesSubmit(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: { gameId: string; answers: Record<string, string> }
  ) {
    const user = (client as any).user;
    try {
      const game = await this.gamesService.getGame(body.gameId);
      if (game.type !== GameType.SCATTERGORIES) {
        client.emit("game.error", { message: "Not a Scattergories game" });
        return;
      }
      this.assertPlayerInGame(game, user.sub);
      const roomKey = game.sessionId ? `session:${game.sessionId}` : `game:${body.gameId}`;

      const result = await this.scattergoriesService.submitAnswers(body.gameId, user.sub, body.answers);

      if (!result.success) {
        client.emit("game.error", { message: result.error });
        return;
      }

      // If both submitted, auto-score the round
      if (result.allSubmitted) {
        const scoreResult = await this.scattergoriesService.scoreRound(body.gameId);
        if (scoreResult?.state) {
          this.server.to(roomKey).emit("game.stateUpdate", {
            gameId: body.gameId,
            state: scoreResult.state,
          });

          if (scoreResult.gameEnded) {
            this.server.to(roomKey).emit("game.end", {
              gameId: body.gameId,
              winnerId: scoreResult.winner ?? null,
              isDraw: scoreResult.isDraw ?? false,
              reason: scoreResult.winner ? "win" : (scoreResult.isDraw ? "draw" : "loss"),
              finalState: scoreResult.state,
            });
          }
          return;
        }
      }

      const sockets = await this.server.in(roomKey).fetchSockets();
      for (const s of sockets) {
        const su = (s as any).user;
        if (su) {
          s.emit("game.stateUpdate", {
            gameId: body.gameId,
            state: this.scattergoriesService.sanitizeStateForPlayer(result.state!, su.sub),
          });
        }
      }
    } catch (error: any) {
      client.emit("game.error", { message: error.message || "Game error" });
    }
  }

  @UseGuards(WsJwtGuard)
  @SubscribeMessage('scattergories.nextRound')
  async handleScattergoriesNextRound(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: { gameId: string }
  ) {
    const user = (client as any).user;
    try {
      const game = await this.gamesService.getGame(body.gameId);
      if (game.type !== GameType.SCATTERGORIES) {
        client.emit("game.error", { message: "Not a Scattergories game" });
        return;
      }
      this.assertPlayerInGame(game, user.sub);
      const roomKey = game.sessionId ? `session:${game.sessionId}` : `game:${body.gameId}`;

      const result = await this.scattergoriesService.nextRound(body.gameId);

      if (!result.success) {
        client.emit("game.error", { message: result.error });
        return;
      }

      const sockets = await this.server.in(roomKey).fetchSockets();
      for (const s of sockets) {
        const su = (s as any).user;
        if (su) {
          s.emit("game.stateUpdate", {
            gameId: body.gameId,
            state: this.scattergoriesService.sanitizeStateForPlayer(result.state!, su.sub),
          });
        }
      }
    } catch (error: any) {
      client.emit("game.error", { message: error.message || "Game error" });
    }
  }

  // ─── Word Game: SCRABBLE ────────────────────────────────

  @UseGuards(WsJwtGuard)
  @SubscribeMessage('scrabble.place')
  async handleScrabblePlace(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: { gameId: string; placements: { row: number; col: number; letter: string; isBlank?: boolean }[] }
  ) {
    const user = (client as any).user;
    try {
      const game = await this.gamesService.getGame(body.gameId);
      if (game.type !== GameType.SCRABBLE_GAME) {
        client.emit("game.error", { message: "Not a Scrabble game" });
        return;
      }
      this.assertPlayerInGame(game, user.sub);
      const roomKey = game.sessionId ? `session:${game.sessionId}` : `game:${body.gameId}`;

      const placements = body.placements.map(p => ({ ...p, isBlank: p.isBlank ?? false }));
      const result = await this.scrabbleService.placeTiles(body.gameId, user.sub, placements);

      if (!result.success) {
        client.emit("game.error", { message: result.error });
        return;
      }

      const sockets = await this.server.in(roomKey).fetchSockets();
      for (const s of sockets) {
        const su = (s as any).user;
        if (su) {
          s.emit("game.stateUpdate", {
            gameId: body.gameId,
            state: this.scrabbleService.sanitizeStateForPlayer(result.state, su.sub),
          });
        }
      }

      if (result.gameEnded) {
        this.server.to(roomKey).emit("game.end", {
          gameId: body.gameId,
          winnerId: result.winner ?? null,
          isDraw: result.isDraw ?? false,
          reason: result.winner ? "win" : (result.isDraw ? "draw" : "loss"),
          finalState: result.state,
        });
      }
    } catch (error: any) {
      client.emit("game.error", { message: error.message || "Game error" });
    }
  }

  @UseGuards(WsJwtGuard)
  @SubscribeMessage('scrabble.exchange')
  async handleScrabbleExchange(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: { gameId: string; tileIndices: number[] }
  ) {
    const user = (client as any).user;
    try {
      const game = await this.gamesService.getGame(body.gameId);
      if (game.type !== GameType.SCRABBLE_GAME) {
        client.emit("game.error", { message: "Not a Scrabble game" });
        return;
      }
      this.assertPlayerInGame(game, user.sub);
      const roomKey = game.sessionId ? `session:${game.sessionId}` : `game:${body.gameId}`;

      const result = await this.scrabbleService.exchangeTiles(body.gameId, user.sub, body.tileIndices);

      if (!result.success) {
        client.emit("game.error", { message: result.error });
        return;
      }

      const sockets = await this.server.in(roomKey).fetchSockets();
      for (const s of sockets) {
        const su = (s as any).user;
        if (su) {
          s.emit("game.stateUpdate", {
            gameId: body.gameId,
            state: this.scrabbleService.sanitizeStateForPlayer(result.state, su.sub),
          });
        }
      }
    } catch (error: any) {
      client.emit("game.error", { message: error.message || "Game error" });
    }
  }

  @UseGuards(WsJwtGuard)
  @SubscribeMessage('scrabble.pass')
  async handleScrabblePass(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: { gameId: string }
  ) {
    const user = (client as any).user;
    try {
      const game = await this.gamesService.getGame(body.gameId);
      if (game.type !== GameType.SCRABBLE_GAME) {
        client.emit("game.error", { message: "Not a Scrabble game" });
        return;
      }
      this.assertPlayerInGame(game, user.sub);
      const roomKey = game.sessionId ? `session:${game.sessionId}` : `game:${body.gameId}`;

      const result = await this.scrabbleService.passTurn(body.gameId, user.sub);

      if (!result.success) {
        client.emit("game.error", { message: result.error });
        return;
      }

      const sockets = await this.server.in(roomKey).fetchSockets();
      for (const s of sockets) {
        const su = (s as any).user;
        if (su) {
          s.emit("game.stateUpdate", {
            gameId: body.gameId,
            state: this.scrabbleService.sanitizeStateForPlayer(result.state, su.sub),
          });
        }
      }

      if (result.gameEnded) {
        this.server.to(roomKey).emit("game.end", {
          gameId: body.gameId,
          winnerId: result.winner ?? null,
          isDraw: result.isDraw ?? false,
          reason: result.winner ? "win" : (result.isDraw ? "draw" : "loss"),
          finalState: result.state,
        });
      }
    } catch (error: any) {
      client.emit("game.error", { message: error.message || "Game error" });
    }
  }

  @UseGuards(WsJwtGuard)
  @SubscribeMessage('scrabble.challenge')
  async handleScrabbleChallenge(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: { gameId: string }
  ) {
    const user = (client as any).user;
    try {
      const game = await this.gamesService.getGame(body.gameId);
      if (game.type !== GameType.SCRABBLE_GAME) {
        client.emit("game.error", { message: "Not a Scrabble game" });
        return;
      }
      this.assertPlayerInGame(game, user.sub);
      const roomKey = game.sessionId ? `session:${game.sessionId}` : `game:${body.gameId}`;

      const result = await this.scrabbleService.challenge(body.gameId, user.sub);

      if (!result.success) {
        client.emit("game.error", { message: result.error });
        return;
      }

      const sockets = await this.server.in(roomKey).fetchSockets();
      for (const s of sockets) {
        const su = (s as any).user;
        if (su) {
          s.emit("game.stateUpdate", {
            gameId: body.gameId,
            state: this.scrabbleService.sanitizeStateForPlayer(result.state, su.sub),
          });
        }
      }

      if (result.gameEnded) {
        this.server.to(roomKey).emit("game.end", {
          gameId: body.gameId,
          winnerId: result.winner ?? null,
          isDraw: result.isDraw ?? false,
          reason: result.winner ? "win" : (result.isDraw ? "draw" : "loss"),
          finalState: result.state,
        });
      }
    } catch (error: any) {
      client.emit("game.error", { message: error.message || "Game error" });
    }
  }

  // ─── Word Game: BANANAGRAMS ────────────────────────────────

  @UseGuards(WsJwtGuard)
  @SubscribeMessage('bananagrams.updateGrid')
  async handleBananagramsUpdateGrid(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: { gameId: string; placements: any[] }
  ) {
    const user = (client as any).user;
    try {
      const game = await this.gamesService.getGame(body.gameId);
      if (game.type !== GameType.BANANAGRAMS) {
        client.emit("game.error", { message: "Not a Bananagrams game" });
        return;
      }
      this.assertPlayerInGame(game, user.sub);
      const roomKey = game.sessionId ? `session:${game.sessionId}` : `game:${body.gameId}`;

      const result = await this.bananagramsService.updateGrid(body.gameId, user.sub, body.placements);

      if (!result.success) {
        client.emit("game.error", { message: result.error });
        return;
      }

      const sockets = await this.server.in(roomKey).fetchSockets();
      for (const s of sockets) {
        const su = (s as any).user;
        if (su) {
          s.emit("game.stateUpdate", {
            gameId: body.gameId,
            state: this.bananagramsService.sanitizeStateForPlayer(result.state!, su.sub),
          });
        }
      }
    } catch (error: any) {
      client.emit("game.error", { message: error.message || "Game error" });
    }
  }

  @UseGuards(WsJwtGuard)
  @SubscribeMessage('bananagrams.peel')
  async handleBananagramsPeel(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: { gameId: string }
  ) {
    const user = (client as any).user;
    try {
      const game = await this.gamesService.getGame(body.gameId);
      if (game.type !== GameType.BANANAGRAMS) {
        client.emit("game.error", { message: "Not a Bananagrams game" });
        return;
      }
      this.assertPlayerInGame(game, user.sub);
      const roomKey = game.sessionId ? `session:${game.sessionId}` : `game:${body.gameId}`;

      const result = await this.bananagramsService.peel(body.gameId, user.sub);

      if (!result.success) {
        client.emit("game.error", { message: result.error });
        return;
      }

      // Peel gives both players a new tile - send per-player state
      const sockets = await this.server.in(roomKey).fetchSockets();
      for (const s of sockets) {
        const su = (s as any).user;
        if (su) {
          s.emit("game.stateUpdate", {
            gameId: body.gameId,
            state: this.bananagramsService.sanitizeStateForPlayer(result.state!, su.sub),
          });
        }
      }

      if (result.gameEnded) {
        this.server.to(roomKey).emit("game.end", {
          gameId: body.gameId,
          winnerId: result.winner ?? null,
          isDraw: result.isDraw ?? false,
          reason: result.winner ? "win" : (result.isDraw ? "draw" : "loss"),
          finalState: result.state,
        });
      }
    } catch (error: any) {
      client.emit("game.error", { message: error.message || "Game error" });
    }
  }

  @UseGuards(WsJwtGuard)
  @SubscribeMessage('bananagrams.dump')
  async handleBananagramsDump(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: { gameId: string; letterIndex: number }
  ) {
    const user = (client as any).user;
    try {
      const game = await this.gamesService.getGame(body.gameId);
      if (game.type !== GameType.BANANAGRAMS) {
        client.emit("game.error", { message: "Not a Bananagrams game" });
        return;
      }
      this.assertPlayerInGame(game, user.sub);
      const roomKey = game.sessionId ? `session:${game.sessionId}` : `game:${body.gameId}`;

      const result = await this.bananagramsService.dump(body.gameId, user.sub, body.letterIndex);

      if (!result.success) {
        client.emit("game.error", { message: result.error });
        return;
      }

      const sockets = await this.server.in(roomKey).fetchSockets();
      for (const s of sockets) {
        const su = (s as any).user;
        if (su) {
          s.emit("game.stateUpdate", {
            gameId: body.gameId,
            state: this.bananagramsService.sanitizeStateForPlayer(result.state!, su.sub),
          });
        }
      }
    } catch (error: any) {
      client.emit("game.error", { message: error.message || "Game error" });
    }
  }

  @UseGuards(WsJwtGuard)
  @SubscribeMessage('bananagrams.bananas')
  async handleBananagramsBananas(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: { gameId: string }
  ) {
    const user = (client as any).user;
    try {
      const game = await this.gamesService.getGame(body.gameId);
      if (game.type !== GameType.BANANAGRAMS) {
        client.emit("game.error", { message: "Not a Bananagrams game" });
        return;
      }
      this.assertPlayerInGame(game, user.sub);
      const roomKey = game.sessionId ? `session:${game.sessionId}` : `game:${body.gameId}`;

      const result = await this.bananagramsService.callBananas(body.gameId, user.sub);

      if (!result.success) {
        client.emit("game.error", { message: result.error });
        return;
      }

      const sockets = await this.server.in(roomKey).fetchSockets();
      for (const s of sockets) {
        const su = (s as any).user;
        if (su) {
          s.emit("game.stateUpdate", {
            gameId: body.gameId,
            state: this.bananagramsService.sanitizeStateForPlayer(result.state!, su.sub),
          });
        }
      }

      if (result.gameEnded) {
        this.server.to(roomKey).emit("game.end", {
          gameId: body.gameId,
          winnerId: result.winner ?? null,
          isDraw: result.isDraw ?? false,
          reason: result.winner ? "win" : (result.isDraw ? "draw" : "loss"),
          finalState: result.state,
        });
      }
    } catch (error: any) {
      client.emit("game.error", { message: error.message || "Game error" });
    }
  }
}

