import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import configuration from "./config/configuration";
import { validationSchema } from "./config/env.validation";
import { PrismaModule } from "./prisma/prisma.module";
import { AuthModule } from "./modules/auth/auth.module";
import { UsersModule } from "./modules/users/users.module";
import { SubscriptionsModule } from "./modules/subscriptions/subscriptions.module";
import { WalletModule } from "./modules/wallet/wallet.module";
import { WebsocketModule } from "./modules/websocket/websocket.module";
import { VideoModule } from "./modules/video/video.module";
import { AdminModule } from "./modules/admin/admin.module";
import { RoomsModule } from "./modules/rooms/rooms.module";
import { ReportsModule } from "./modules/reports/reports.module";

// Conditionally include WebSocket module only if not in serverless mode
// WebSockets require persistent connections, which Vercel serverless functions don't support
const isServerless = process.env.IS_SERVERLESS === 'true' || process.env.VERCEL === '1';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
      validationSchema
    }),
    PrismaModule,
    AuthModule,
    UsersModule,
    SubscriptionsModule,
    WalletModule,
    // Only load WebSocket module if not in serverless mode
    // In serverless mode, WebSockets won't work, so we skip loading the module
    ...(isServerless ? [] : [WebsocketModule]),
    VideoModule,
    AdminModule,
    RoomsModule,
    ReportsModule
  ]
})
export class AppModule {}

