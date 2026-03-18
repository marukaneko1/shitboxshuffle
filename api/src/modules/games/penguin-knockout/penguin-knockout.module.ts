import { Module } from "@nestjs/common";
import { PenguinKnockoutService } from "./penguin-knockout.service";
import { PrismaModule } from "../../../prisma/prisma.module";

@Module({
  imports: [PrismaModule],
  providers: [PenguinKnockoutService],
  exports: [PenguinKnockoutService],
})
export class PenguinKnockoutModule {}
