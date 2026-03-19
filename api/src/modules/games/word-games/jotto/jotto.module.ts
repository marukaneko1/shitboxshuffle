import { Module } from "@nestjs/common";
import { PrismaModule } from "../../../../prisma/prisma.module";
import { DictionaryModule } from "../dictionary.module";
import { JottoService } from "./jotto.service";

@Module({
  imports: [PrismaModule, DictionaryModule],
  providers: [JottoService],
  exports: [JottoService],
})
export class JottoModule {}
