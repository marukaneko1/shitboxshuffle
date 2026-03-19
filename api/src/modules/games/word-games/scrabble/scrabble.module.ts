import { Module } from "@nestjs/common";
import { PrismaModule } from "../../../../prisma/prisma.module";
import { DictionaryModule } from "../dictionary.module";
import { ScrabbleService } from "./scrabble.service";

@Module({
  imports: [PrismaModule, DictionaryModule],
  providers: [ScrabbleService],
  exports: [ScrabbleService],
})
export class ScrabbleModule {}
