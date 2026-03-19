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
import { BlackjackModule } from "./blackjack/blackjack.module";
import { BlackjackService } from "./blackjack/blackjack.service";
import { BsModule } from "./bs/bs.module";
import { BsService } from "./bs/bs.service";
import { PrismaModule } from "../../prisma/prisma.module";
import { DictionaryModule } from "./word-games/dictionary.module";
import { HangmanModule } from "./word-games/hangman/hangman.module";
import { HangmanService } from "./word-games/hangman/hangman.service";
import { GhostModule } from "./word-games/ghost/ghost.module";
import { GhostService } from "./word-games/ghost/ghost.service";
import { WordleModule } from "./word-games/wordle/wordle.module";
import { WordleService } from "./word-games/wordle/wordle.service";
import { JottoModule } from "./word-games/jotto/jotto.module";
import { JottoService } from "./word-games/jotto/jotto.service";
import { SpellingBeeModule } from "./word-games/spelling-bee/spelling-bee.module";
import { SpellingBeeService } from "./word-games/spelling-bee/spelling-bee.service";
import { LetterBoxedModule } from "./word-games/letter-boxed/letter-boxed.module";
import { LetterBoxedService } from "./word-games/letter-boxed/letter-boxed.service";
import { BoggleModule } from "./word-games/boggle/boggle.module";
import { BoggleService } from "./word-games/boggle/boggle.service";
import { ScattergoriesModule } from "./word-games/scattergories/scattergories.module";
import { ScattergoriesService } from "./word-games/scattergories/scattergories.service";
import { ScrabbleModule } from "./word-games/scrabble/scrabble.module";
import { ScrabbleService } from "./word-games/scrabble/scrabble.service";
import { BananagramsModule } from "./word-games/bananagrams/bananagrams.module";
import { BananagramsService } from "./word-games/bananagrams/bananagrams.service";
import { MonopolyModule } from "./monopoly/monopoly.module";
import { MonopolyService } from "./monopoly/monopoly.service";
import { SpinTheWheelModule } from "./spin-the-wheel/spin-the-wheel.module";
import { SpinTheWheelService } from "./spin-the-wheel/spin-the-wheel.service";

@Module({
  imports: [
    PrismaModule, DictionaryModule,
    TicTacToeModule, ChessModule, TriviaModule, TruthsAndLieModule,
    BilliardsModule, PokerModule, TwentyOneQuestionsModule,
    ConnectFourModule, CheckersModule, MemoryModule, UnoModule,
    GeoGuesserModule, TanksModule, PenguinKnockoutModule, BlackjackModule,
    BsModule,
    HangmanModule, GhostModule, WordleModule, JottoModule,
    SpellingBeeModule, LetterBoxedModule, BoggleModule,
    ScattergoriesModule, ScrabbleModule, BananagramsModule,
    MonopolyModule,
    SpinTheWheelModule,
  ],
  providers: [
    GamesService,
    TicTacToeService, ChessService, TriviaService, TruthsAndLieService,
    BilliardsService, PokerService, TwentyOneQuestionsService,
    ConnectFourService, CheckersService, MemoryService, UnoService,
    GeoGuesserService, TanksService, PenguinKnockoutService, BlackjackService,
    BsService,
    HangmanService, GhostService, WordleService, JottoService,
    SpellingBeeService, LetterBoxedService, BoggleService,
    ScattergoriesService, ScrabbleService, BananagramsService,
    MonopolyService,
    SpinTheWheelService,
  ],
  exports: [
    GamesService,
    TicTacToeService, ChessService, TriviaService, TruthsAndLieService,
    BilliardsService, PokerService, TwentyOneQuestionsService,
    ConnectFourService, CheckersService, MemoryService, UnoService,
    GeoGuesserService, TanksService, PenguinKnockoutService, BlackjackService,
    BsService,
    HangmanService, GhostService, WordleService, JottoService,
    SpellingBeeService, LetterBoxedService, BoggleService,
    ScattergoriesService, ScrabbleService, BananagramsService,
    MonopolyService,
    SpinTheWheelService,
  ],
})
export class GamesModule {}
