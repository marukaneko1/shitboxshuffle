import { Module } from "@nestjs/common";
import { PrismaModule } from "../../../../prisma/prisma.module";
import { DictionaryModule } from "../dictionary.module";
import { BoggleService } from "./boggle.service";

@Module({
  imports: [PrismaModule, DictionaryModule],
  providers: [BoggleService],
  exports: [BoggleService],
})
export class BoggleModule {}
