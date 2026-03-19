import { Module } from "@nestjs/common";
import { PrismaModule } from "../../../../prisma/prisma.module";
import { DictionaryModule } from "../dictionary.module";
import { HangmanService } from "./hangman.service";

@Module({
  imports: [PrismaModule, DictionaryModule],
  providers: [HangmanService],
  exports: [HangmanService],
})
export class HangmanModule {}
