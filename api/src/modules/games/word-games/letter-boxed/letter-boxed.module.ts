import { Module } from "@nestjs/common";
import { PrismaModule } from "../../../../prisma/prisma.module";
import { DictionaryModule } from "../dictionary.module";
import { LetterBoxedService } from "./letter-boxed.service";

@Module({
  imports: [PrismaModule, DictionaryModule],
  providers: [LetterBoxedService],
  exports: [LetterBoxedService],
})
export class LetterBoxedModule {}
