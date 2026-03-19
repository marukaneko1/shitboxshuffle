import { Module } from "@nestjs/common";
import { PrismaModule } from "../../../../prisma/prisma.module";
import { DictionaryModule } from "../dictionary.module";
import { SpellingBeeService } from "./spelling-bee.service";

@Module({
  imports: [PrismaModule, DictionaryModule],
  providers: [SpellingBeeService],
  exports: [SpellingBeeService],
})
export class SpellingBeeModule {}
