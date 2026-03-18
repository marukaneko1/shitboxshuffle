import { Module } from "@nestjs/common";
import { GamesService } from "./games.service";
import { TicTacToeModule } from "./tictactoe/tictactoe.module";
import { TicTacToeService } from "./tictactoe/tictactoe.service";
import { ChessModule } from "./chess/chess.module";
import { ChessService } from "./chess/chess.service";
import { TriviaModule } from "./trivia/trivia.module";
import { TriviaService } from "./trivia/trivia.service";
import { TruthsAndLieModule } from "./truths-and-lie/truths-and-lie.module";
import { TruthsAndLieService } from "./truths-and-lie/truths-and-lie.service";
import { BilliardsModule } from "./billiards/billiards.module";
import { BilliardsService } from "./billiards/billiards.service";
import { PokerModule } from "./poker/poker.module";
import { PokerService } from "./poker/poker.service";
import { TwentyOneQuestionsModule } from "./twenty-one-questions/twenty-one-questions.module";
import { TwentyOneQuestionsService } from "./twenty-one-questions/twenty-one-questions.service";
import { ConnectFourModule } from "./connect-four/connect-four.module";
import { ConnectFourService } from "./connect-four/connect-four.service";
import { CheckersModule } from "./checkers/checkers.module";
import { CheckersService } from "./checkers/checkers.service";
import { MemoryModule } from "./memory/memory.module";
import { MemoryService } from "./memory/memory.service";
import { UnoModule } from "./uno/uno.module";
import { UnoService } from "./uno/uno.service";
import { GeoGuesserModule } from "./geoguesser/geoguesser.module";
import { GeoGuesserService } from "./geoguesser/geoguesser.service";
import { TanksModule } from "./tanks/tanks.module";
import { TanksService } from "./tanks/tanks.service";
import { PenguinKnockoutModule } from "./penguin-knockout/penguin-knockout.module";
import { PenguinKnockoutService } from "./penguin-knockout/penguin-knockout.service";
import { PrismaModule } from "../../prisma/prisma.module";

@Module({
  imports: [PrismaModule, TicTacToeModule, ChessModule, TriviaModule, TruthsAndLieModule, BilliardsModule, PokerModule, TwentyOneQuestionsModule, ConnectFourModule, CheckersModule, MemoryModule, UnoModule, GeoGuesserModule, TanksModule, PenguinKnockoutModule],
  providers: [GamesService, TicTacToeService, ChessService, TriviaService, TruthsAndLieService, BilliardsService, PokerService, TwentyOneQuestionsService, ConnectFourService, CheckersService, MemoryService, UnoService, GeoGuesserService, TanksService, PenguinKnockoutService],
  exports: [GamesService, TicTacToeService, ChessService, TriviaService, TruthsAndLieService, BilliardsService, PokerService, TwentyOneQuestionsService, ConnectFourService, CheckersService, MemoryService, UnoService, GeoGuesserService, TanksService, PenguinKnockoutService]
})
export class GamesModule {}

