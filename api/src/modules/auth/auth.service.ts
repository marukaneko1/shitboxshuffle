import { BadRequestException, Injectable, UnauthorizedException, Logger, OnModuleDestroy } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { RegisterDto } from "./dto/register.dto";
import { LoginDto } from "./dto/login.dto";
import { GoogleLoginDto } from "./dto/google-login.dto";
import { RefreshDto } from "./dto/refresh.dto";
import * as argon2 from "argon2";
import { JwtService } from "@nestjs/jwt";
import { ConfigService } from "@nestjs/config";
import { OAuth2Client } from "google-auth-library";
import { v4 as uuidv4 } from "uuid";
import * as crypto from "crypto";
import { JwtPayload, AuthRole } from "../../types/auth";

/**
 * SECURITY: Account lockout configuration
 */
interface LoginAttempt {
  count: number;
  lastAttempt: number;
  lockedUntil?: number;
}

// SECURITY: Constants for account lockout
const MAX_LOGIN_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 15 * 60 * 1000; // 15 minutes
const ATTEMPT_WINDOW_MS = 15 * 60 * 1000; // 15 minutes

// SECURITY: Constants for refresh token brute force protection
const MAX_REFRESH_ATTEMPTS = 10;
const REFRESH_LOCKOUT_MS = 60 * 60 * 1000; // 1 hour

@Injectable()
export class AuthService implements OnModuleDestroy {
  private readonly logger = new Logger(AuthService.name);
  private googleClient: OAuth2Client | null = null;
  private cleanupTimer: NodeJS.Timeout;
  
  private loginAttempts = new Map<string, LoginAttempt>();
  private refreshAttempts = new Map<string, LoginAttempt>();

  private static readonly DUMMY_HASH = '$argon2id$v=19$m=65536,t=3,p=4$c29tZXNhbHQ$RdescudvJCsgt3ub+b+daw';

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService
  ) {
    const clientId = this.configService.get<string>("google.clientId");
    if (clientId) {
      this.googleClient = new OAuth2Client(clientId);
    }
    
    this.cleanupTimer = setInterval(() => this.cleanupAttempts(), 30 * 60 * 1000);
  }

  onModuleDestroy() {
    clearInterval(this.cleanupTimer);
  }
  
  /**
   * SECURITY: Check if account is locked out
   */
  private checkLockout(key: string, attemptsMap: Map<string, LoginAttempt>, maxAttempts: number, lockoutMs: number): void {
    const attempt = attemptsMap.get(key);
    if (!attempt) return;
    
    const now = Date.now();
    
    // Check if currently locked
    if (attempt.lockedUntil && now < attempt.lockedUntil) {
      const remainingMs = attempt.lockedUntil - now;
      const remainingMins = Math.ceil(remainingMs / 60000);
      throw new UnauthorizedException(`Account locked. Try again in ${remainingMins} minutes.`);
    }
    
    // Reset if window has passed
    if (now - attempt.lastAttempt > ATTEMPT_WINDOW_MS) {
      attemptsMap.delete(key);
    }
  }
  
  /**
   * SECURITY: Record a failed attempt
   */
  private recordFailedAttempt(key: string, attemptsMap: Map<string, LoginAttempt>, maxAttempts: number, lockoutMs: number): void {
    const now = Date.now();
    const attempt = attemptsMap.get(key) || { count: 0, lastAttempt: now };
    
    // Reset if window has passed
    if (now - attempt.lastAttempt > ATTEMPT_WINDOW_MS) {
      attempt.count = 0;
    }
    
    attempt.count++;
    attempt.lastAttempt = now;
    
    if (attempt.count >= maxAttempts) {
      attempt.lockedUntil = now + lockoutMs;
      this.logger.warn(`Account locked for key: ${key.substring(0, 8)}... after ${attempt.count} failed attempts`);
    }
    
    attemptsMap.set(key, attempt);
  }
  
  /**
   * SECURITY: Clear failed attempts on successful action
   */
  private clearAttempts(key: string, attemptsMap: Map<string, LoginAttempt>): void {
    attemptsMap.delete(key);
  }
  
  /**
   * Cleanup old attempt entries
   */
  private cleanupAttempts(): void {
    const now = Date.now();
    for (const [key, attempt] of this.loginAttempts.entries()) {
      if (now - attempt.lastAttempt > ATTEMPT_WINDOW_MS * 2) {
        this.loginAttempts.delete(key);
      }
    }
    for (const [key, attempt] of this.refreshAttempts.entries()) {
      if (now - attempt.lastAttempt > REFRESH_LOCKOUT_MS * 2) {
        this.refreshAttempts.delete(key);
      }
    }
  }

  async register(dto: RegisterDto) {
    const normalizedEmail = dto.email.toLowerCase().trim();
    
    const passwordHash = await argon2.hash(dto.password);

    try {
      const user = await this.prisma.user.create({
        data: {
          email: normalizedEmail,
          passwordHash,
          displayName: dto.displayName,
          username: dto.username,
          dateOfBirth: dto.dateOfBirth ? new Date(dto.dateOfBirth) : undefined,
          wallet: {
            create: {}
          },
          subscription: {
            create: {}
          }
        }
      });

      const tokens = await this.issueTokens(user);
      return tokens;
    } catch (error: any) {
      if (error?.code === "P2002") {
        const raw = error.meta?.target;
        const targets = Array.isArray(raw) ? raw.map(String) : raw != null ? [String(raw)] : [];
        const joined = targets.join(" ");
        if (joined.includes("username")) {
          throw new BadRequestException("Username already taken");
        }
        throw new BadRequestException("Email already registered");
      }
      this.logger.error(`register failed: ${error?.message ?? error}`, error?.stack);
      throw error;
    }
  }

  async login(dto: LoginDto) {
    const normalizedEmail = dto.email.toLowerCase().trim();
    this.checkLockout(normalizedEmail, this.loginAttempts, MAX_LOGIN_ATTEMPTS, LOCKOUT_DURATION_MS);
    
    const user = await this.prisma.user.findUnique({ where: { email: normalizedEmail } });
    if (!user || !user.passwordHash) {
      await argon2.verify(AuthService.DUMMY_HASH, dto.password).catch(() => {});
      this.recordFailedAttempt(normalizedEmail, this.loginAttempts, MAX_LOGIN_ATTEMPTS, LOCKOUT_DURATION_MS);
      throw new UnauthorizedException("Invalid credentials");
    }
    
    const valid = await argon2.verify(user.passwordHash, dto.password);
    if (!valid) {
      this.recordFailedAttempt(normalizedEmail, this.loginAttempts, MAX_LOGIN_ATTEMPTS, LOCKOUT_DURATION_MS);
      throw new UnauthorizedException("Invalid credentials");
    }
    
    this.clearAttempts(normalizedEmail, this.loginAttempts);
    
    this.assertNotBanned(user);
    await this.ensureWalletAndSubscription(user.id);
    return this.issueTokens(user);
  }

  async googleLogin(dto: GoogleLoginDto) {
    if (!this.googleClient) {
      throw new BadRequestException("Google OAuth not configured");
    }
    const ticket = await this.googleClient.verifyIdToken({
      idToken: dto.idToken,
      audience: this.configService.get<string>("google.clientId")
    });
    const payload = ticket.getPayload();
    if (!payload?.email || !payload.sub) {
      throw new UnauthorizedException("Invalid Google token");
    }

    let user = await this.prisma.user.findFirst({
      where: {
        OR: [{ googleId: payload.sub }, { email: payload.email }]
      }
    });

    if (!user) {
      user = await this.prisma.user.create({
        data: {
          email: payload.email,
          googleId: payload.sub,
          displayName: payload.name || payload.email.split("@")[0],
          username: await this.sanitizeUsername(payload.email),
          avatarUrl: payload.picture,
          is18PlusVerified: false,
          wallet: { create: {} },
          subscription: { create: {} }
        }
      });
    } else if (!user.googleId) {
      user = await this.prisma.user.update({
        where: { id: user.id },
        data: { googleId: payload.sub }
      });
    }

    await this.ensureWalletAndSubscription(user.id);
    return this.issueTokens(user);
  }

  async refresh(dto: RefreshDto, refreshTokenFromCookie?: string, clientIp?: string) {
    const raw = refreshTokenFromCookie || dto.refreshToken;
    if (!raw) {
      throw new UnauthorizedException("Missing refresh token");
    }
    
    const rateLimitKey = clientIp || 'unknown';
    this.checkLockout(rateLimitKey, this.refreshAttempts, MAX_REFRESH_ATTEMPTS, REFRESH_LOCKOUT_MS);
    
    const { prefix } = this.splitToken(raw);
    const candidates = await this.prisma.refreshToken.findMany({
      where: { tokenPrefix: prefix, revokedAt: null, expiresAt: { gt: new Date() } },
      orderBy: { createdAt: "desc" },
      take: 5
    });
    
    const matched = await this.findMatchingRefreshToken(candidates, raw);
    if (!matched) {
      this.recordFailedAttempt(rateLimitKey, this.refreshAttempts, MAX_REFRESH_ATTEMPTS, REFRESH_LOCKOUT_MS);
      throw new UnauthorizedException("Invalid refresh token");
    }
    
    this.clearAttempts(rateLimitKey, this.refreshAttempts);
    
    const user = await this.prisma.user.findUnique({ 
      where: { id: matched.userId },
      select: { id: true, email: true, isBanned: true, isAdmin: true, banReason: true }
    });
    if (!user) {
      throw new UnauthorizedException("Invalid refresh token");
    }
    this.assertNotBanned(user);
    
    await this.prisma.refreshToken.update({
      where: { id: matched.id },
      data: { revokedAt: new Date() }
    });
    
    return this.issueTokens(user);
  }

  async logout(userId: string, providedToken?: string) {
    if (!providedToken) return;

    const { prefix } = this.splitToken(providedToken);
    const candidates = await this.prisma.refreshToken.findMany({
      where: { userId, tokenPrefix: prefix, revokedAt: null, expiresAt: { gt: new Date() } },
      select: { id: true, tokenHash: true }
    });

    for (const candidate of candidates) {
      const valid = await argon2.verify(candidate.tokenHash, providedToken);
      if (valid) {
        await this.prisma.refreshToken.update({
          where: { id: candidate.id },
          data: { revokedAt: new Date() }
        });
        return;
      }
    }
  }

  private async issueTokens(user: { id: string; email: string; isBanned: boolean; isAdmin?: boolean }) {
    const roles: AuthRole[] = [];
    if (user.isAdmin) roles.push('admin');
    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      isBanned: user.isBanned,
      roles,
    };
    const accessToken = await this.jwtService.signAsync(payload, {
      secret: this.configService.get<string>("jwt.accessSecret"),
      expiresIn: this.configService.get<string>("jwt.accessExpiresIn") || "15m"
    });

    const refreshToken = uuidv4();
    const { prefix } = this.splitToken(refreshToken);
    const hashed = await this.hash(refreshToken);
    const expiresIn = this.configService.get<string>("jwt.refreshExpiresIn") || "7d";
    const expiresAt = new Date(Date.now() + this.parseExpiresInMs(expiresIn));
    await this.prisma.refreshToken.create({
      data: {
        userId: user.id,
        tokenHash: hashed,
        tokenPrefix: prefix,
        expiresAt
      }
    });

    return { accessToken, refreshToken };
  }

  private async ensureWalletAndSubscription(userId: string) {
    await this.prisma.wallet.upsert({
      where: { userId },
      update: {},
      create: { userId }
    });
    await this.prisma.subscription.upsert({
      where: { userId },
      update: {},
      create: { userId }
    });
  }

  private async sanitizeUsername(email: string): Promise<string> {
    const base = email.split("@")[0].replace(/[^a-zA-Z0-9_]/g, "").slice(0, 15) || "user";
    
    // Try to create a unique username with retries
    let attempts = 0;
    const maxAttempts = 10;
    
    while (attempts < maxAttempts) {
      const candidate = `${base}${Math.floor(Math.random() * 10000)}`;
      const existing = await this.prisma.user.findUnique({ 
        where: { username: candidate },
        select: { id: true }
      });
      
      if (!existing) {
        return candidate;
      }
      
      attempts++;
    }
    
    // Fallback to UUID-based username if all attempts fail
    return `${base}_${uuidv4().slice(0, 8)}`;
  }

  private splitToken(token: string): { prefix: string } {
    return { prefix: crypto.createHash('sha256').update(token).digest('hex').slice(0, 16) };
  }

  private async hash(value: string) {
    return argon2.hash(value);
  }

  private async findMatchingRefreshToken(
    tokens: { id: string; tokenHash: string; userId: string }[],
    raw: string
  ) {
    for (const token of tokens) {
      const valid = await argon2.verify(token.tokenHash, raw);
      if (valid) return token;
    }
    return null;
  }

  private parseExpiresInMs(expiresIn: string): number {
    const match = expiresIn.match(/^(\d+)([smhd])$/);
    if (!match) return 7 * 24 * 60 * 60 * 1000;
    const value = parseInt(match[1], 10);
    const unit = match[2];
    switch (unit) {
      case "s":
        return value * 1000;
      case "m":
        return value * 60 * 1000;
      case "h":
        return value * 60 * 60 * 1000;
      case "d":
      default:
        return value * 24 * 60 * 60 * 1000;
    }
  }

  private assertNotBanned(user: { isBanned: boolean; banReason?: string | null }) {
    if (user.isBanned) {
      throw new UnauthorizedException("Account is banned");
    }
  }
}

