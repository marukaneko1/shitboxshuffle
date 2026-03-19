import { Module } from "@nestjs/common";
import { PrismaModule } from "../../../../prisma/prisma.module";
import { DictionaryModule } from "../dictionary.module";
import { ScattergoriesService } from "./scattergories.service";

@Module({
  imports: [PrismaModule, DictionaryModule],
  providers: [ScattergoriesService],
  exports: [ScattergoriesService],
})
export class ScattergoriesModule {}
