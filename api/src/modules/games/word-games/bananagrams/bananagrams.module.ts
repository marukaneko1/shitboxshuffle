import { Module } from "@nestjs/common";
import { PrismaModule } from "../../../../prisma/prisma.module";
import { DictionaryModule } from "../dictionary.module";
import { BananagramsService } from "./bananagrams.service";

@Module({
  imports: [PrismaModule, DictionaryModule],
  providers: [BananagramsService],
  exports: [BananagramsService],
})
export class BananagramsModule {}
