import { Module } from "@nestjs/common";
import { ConnectFourService } from "./connect-four.service";
import { PrismaModule } from "../../../prisma/prisma.module";

@Module({
  imports: [PrismaModule],
  providers: [ConnectFourService],
  exports: [ConnectFourService]
})
export class ConnectFourModule {}
