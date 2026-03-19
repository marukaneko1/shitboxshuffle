import { Module } from "@nestjs/common";
import { PrismaModule } from "../../../../prisma/prisma.module";
import { DictionaryModule } from "../dictionary.module";
import { GhostService } from "./ghost.service";

@Module({
  imports: [PrismaModule, DictionaryModule],
  providers: [GhostService],
  exports: [GhostService],
})
export class GhostModule {}
