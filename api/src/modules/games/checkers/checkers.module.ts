import { Module } from "@nestjs/common";
import { CheckersService } from "./checkers.service";
import { PrismaModule } from "../../../prisma/prisma.module";

@Module({
  imports: [PrismaModule],
  providers: [CheckersService],
  exports: [CheckersService]
})
export class CheckersModule {}
