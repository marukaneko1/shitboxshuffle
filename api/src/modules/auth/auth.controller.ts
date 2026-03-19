import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpException,
  HttpStatus,
  Post,
  Req,
  Res,
  UnauthorizedException,
  UseGuards
} from "@nestjs/common";
import { AuthService } from "./auth.service";
import { RegisterDto } from "./dto/register.dto";
import { LoginDto } from "./dto/login.dto";
import { GoogleLoginDto } from "./dto/google-login.dto";
import { RefreshDto } from "./dto/refresh.dto";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { RateLimitGuard } from "../../common/guards/rate-limit.guard";
import { Request, Response } from "express";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { JwtPayload } from "../../types/auth";

@Controller("auth")
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post("register")
  @UseGuards(RateLimitGuard)
  async register(@Body() dto: RegisterDto, @Res({ passthrough: true }) res: Response) {
    const tokens = await this.authService.register(dto);
    this.setRefreshCookie(res, tokens.refreshToken);
    return { accessToken: tokens.accessToken };
  }

  @Post("login")
  @HttpCode(200)
  @UseGuards(RateLimitGuard)
  async login(@Body() dto: LoginDto, @Res({ passthrough: true }) res: Response) {
    const tokens = await this.authService.login(dto);
    this.setRefreshCookie(res, tokens.refreshToken);
    return { accessToken: tokens.accessToken };
  }

  @Post("google")
  @UseGuards(RateLimitGuard)
  async google(@Body() dto: GoogleLoginDto, @Res({ passthrough: true }) res: Response) {
    const tokens = await this.authService.googleLogin(dto);
    this.setRefreshCookie(res, tokens.refreshToken);
    return { accessToken: tokens.accessToken };
  }

  @Post("refresh")
  @UseGuards(RateLimitGuard)
  async refresh(@Body() dto: RefreshDto, @Req() req: Request, @Res({ passthrough: true }) res: Response) {
    // SECURITY: Pass client IP for brute force protection
    const clientIp = req.ip || req.headers['x-forwarded-for']?.toString()?.split(',')[0]?.trim() || 'unknown';
    
    // Debug logging for cookie issues (remove in production if needed)
    if (process.env.NODE_ENV === 'development' || process.env.VERCEL_ENV) {
      console.log('[Refresh] Cookies:', req.cookies);
      console.log('[Refresh] Cookie header:', req.headers.cookie);
      console.log('[Refresh] DTO refreshToken:', dto.refreshToken ? 'present' : 'missing');
    }
    
    // Try to get refresh token from cookie first, then from body
    const refreshTokenFromCookie = req.cookies?.refresh_token;
    const refreshToken = dto.refreshToken || refreshTokenFromCookie;
    
    if (!refreshToken) {
      throw new UnauthorizedException("Missing refresh token. Please log in again.");
    }
    
    const tokens = await this.authService.refresh(dto, refreshToken, clientIp);
    if (tokens.refreshToken) {
      this.setRefreshCookie(res, tokens.refreshToken);
    }
    return { accessToken: tokens.accessToken };
  }

  @Post("logout")
  @UseGuards(JwtAuthGuard)
  async logout(
    @CurrentUser() user: JwtPayload,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response
  ) {
    await this.authService.logout(user.sub, (req.cookies?.refresh_token as string) || undefined);
    const isProduction = Boolean(
      process.env.NODE_ENV === "production" || 
      process.env.VERCEL === "1" || 
      !!process.env.VERCEL_ENV
    );
    res.clearCookie("refresh_token", {
      httpOnly: true,
      sameSite: isProduction ? "none" : "lax",
      secure: isProduction,
      path: "/"
    });
    return { success: true };
  }

  @Get("health")
  @HttpCode(200)
  health() {
    return { ok: true };
  }

  private setRefreshCookie(res: Response, token?: string) {
    if (!token) return;
    
    // Determine if we're in production (Vercel, HTTPS, etc.)
    // Explicitly convert each check to boolean to ensure TypeScript type inference
    const isProduction = Boolean(
      process.env.NODE_ENV === "production" || 
      process.env.VERCEL === "1" || 
      !!process.env.VERCEL_ENV
    );
    
    // For production (HTTPS), use secure cookies with sameSite: "none" for cross-origin
    // For development (localhost), use sameSite: "lax"
    res.cookie("refresh_token", token, {
      httpOnly: true,
      sameSite: isProduction ? "none" : "lax", // "none" required for cross-origin with secure
      secure: isProduction, // Secure cookies required for sameSite: "none"
      maxAge: this.getRefreshMs(),
      path: "/" // Ensure cookie is available for all paths
    });
  }

  private getRefreshMs() {
    const value = process.env.JWT_REFRESH_EXPIRES_IN || "7d";
    const match = value.match(/^(\d+)([smhd])$/);
    if (!match) return 7 * 24 * 60 * 60 * 1000;
    const num = parseInt(match[1], 10);
    const unit = match[2];
    switch (unit) {
      case "s":
        return num * 1000;
      case "m":
        return num * 60 * 1000;
      case "h":
        return num * 60 * 60 * 1000;
      case "d":
      default:
        return num * 24 * 60 * 60 * 1000;
    }
  }
}


