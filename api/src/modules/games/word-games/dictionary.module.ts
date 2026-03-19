import { Module, Global } from "@nestjs/common";
import { DictionaryService } from "./dictionary.service";

@Global()
@Module({
  providers: [DictionaryService],
  exports: [DictionaryService],
})
export class DictionaryModule {}
