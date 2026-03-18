import { Module } from "@nestjs/common";
import { AppGateway } from "./websocket.gateway";
import { MatchmakingService } from "../matchmaking/matchmaking.service";
import { SessionsService } from "../sessions/sessions.service";
import { PrismaService } from "../../prisma/prisma.service";
import { JwtModule } from "@nestjs/jwt";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { WsJwtGuard } from "../../common/guards/ws-jwt.guard";
import { VideoModule } from "../video/video.module";
import { WalletModule } from "../wallet/wallet.module";
import { ReportsModule } from "../reports/reports.module";
import { GamesModule } from "../games/games.module";
import { RoomsModule } from "../rooms/rooms.module";

@Module({
  imports: [
    ConfigModule,
    VideoModule,
    WalletModule,
    ReportsModule,
    GamesModule,
    RoomsModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        secret: configService.get<string>("jwt.accessSecret")
      }),
      inject: [ConfigService]
    })
  ],
  providers: [AppGateway, MatchmakingService, SessionsService, WsJwtGuard, PrismaService]
})
export class WebsocketModule {}

