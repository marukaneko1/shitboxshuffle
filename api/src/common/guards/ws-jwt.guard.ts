import { CanActivate, ExecutionContext, Injectable, UnauthorizedException, Logger } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { Socket } from "socket.io";
import { ConfigService } from "@nestjs/config";

@Injectable()
export class WsJwtGuard implements CanActivate {
  private readonly logger = new Logger(WsJwtGuard.name);

  constructor(private readonly jwtService: JwtService, private readonly configService: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const client: Socket = context.switchToWs().getClient<Socket>();
    
    const token =
      client.handshake.auth?.token ||
      client.handshake.query?.token ||
      (client.handshake.headers?.authorization as string)?.replace(/^bearer\s+/i, "");

    if (!token || typeof token !== "string") {
      this.logger.warn(`[WEBSOCKET AUTH] Missing access token. Headers: ${JSON.stringify(Object.keys(client.handshake.headers))}`);
      throw new UnauthorizedException("Missing access token");
    }

    try {
      const payload = this.jwtService.verify(token, {
        secret: this.configService.get<string>("jwt.accessSecret")
      });
      (client as any).user = payload;
      this.logger.debug(`[WEBSOCKET AUTH] Successfully authenticated user ${payload.sub}`);
      return true;
    } catch (error: any) {
      // Log more details for debugging (but don't expose to client)
      this.logger.warn(`[WEBSOCKET AUTH] Token verification failed: ${error?.name} - ${error?.message}`);
      if (error?.name === 'TokenExpiredError') {
        this.logger.warn(`[WEBSOCKET AUTH] Token expired at: ${error?.expiredAt}`);
      }
      // Don't expose token details or error specifics to prevent information leakage
      throw new UnauthorizedException("Invalid or expired access token");
    }
  }
}


