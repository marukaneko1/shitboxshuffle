import { Injectable, UnauthorizedException } from "@nestjs/common";
import { PassportStrategy } from "@nestjs/passport";
import { ExtractJwt, Strategy } from "passport-jwt";
import { ConfigService } from "@nestjs/config";
import { PrismaService } from "../../prisma/prisma.service";
import { JwtPayload } from "../../types/auth";

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    configService: ConfigService,
    private readonly prisma: PrismaService
  ) {
    const secret = configService.get<string>("jwt.accessSecret");
    if (!secret) {
      throw new Error("JWT access secret is not configured (jwt.accessSecret)");
    }
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: secret
    });
  }

  async validate(payload: JwtPayload) {
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      select: { id: true, isBanned: true }
    });
    if (!user) {
      throw new UnauthorizedException("User no longer exists");
    }
    if (user.isBanned) {
      throw new UnauthorizedException("Account is banned");
    }
    return payload;
  }
}


