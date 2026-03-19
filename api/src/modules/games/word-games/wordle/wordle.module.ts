import { Module } from "@nestjs/common";
import { PrismaModule } from "../../../../prisma/prisma.module";
import { DictionaryModule } from "../dictionary.module";
import { WordleService } from "./wordle.service";

@Module({
  imports: [PrismaModule, DictionaryModule],
  providers: [WordleService],
  exports: [WordleService],
})
export class WordleModule {}
