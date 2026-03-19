import { CanActivate, ExecutionContext, HttpException, HttpStatus, Injectable, Logger, OnModuleDestroy } from '@nestjs/common';

/**
 * SECURITY: Simple in-memory rate limiter for WebSocket and HTTP requests
 * For production, consider using Redis-based rate limiting (@nestjs/throttler with Redis store)
 */

interface RateLimitEntry {
  count: number;
  resetTime: number;
}

// Rate limit configuration
export interface RateLimitConfig {
  limit: number;      // Max requests
  windowMs: number;   // Time window in milliseconds
}

// Default rate limits
const DEFAULT_RATE_LIMITS: Record<string, RateLimitConfig> = {
  // Auth endpoints - stricter limits
  'auth.login': { limit: 5, windowMs: 60 * 1000 },        // 5 per minute
  'auth.register': { limit: 3, windowMs: 60 * 1000 },     // 3 per minute
  'auth.refresh': { limit: 10, windowMs: 60 * 1000 },     // 10 per minute
  
  // Game actions - more permissive but still limited
  'game.move': { limit: 60, windowMs: 60 * 1000 },        // 60 per minute (1 per second)
  'poker.action': { limit: 30, windowMs: 60 * 1000 },     // 30 per minute
  'billiards.shot': { limit: 20, windowMs: 60 * 1000 },   // 20 per minute
  
  // Default for other endpoints
  'default': { limit: 100, windowMs: 60 * 1000 },         // 100 per minute
};

@Injectable()
export class RateLimitGuard implements CanActivate, OnModuleDestroy {
  private readonly logger = new Logger(RateLimitGuard.name);
  private readonly rateLimitMap = new Map<string, RateLimitEntry>();
  private readonly cleanupTimer: NodeJS.Timeout;
  
  constructor() {
    this.cleanupTimer = setInterval(() => this.cleanup(), 5 * 60 * 1000);
  }

  onModuleDestroy() {
    clearInterval(this.cleanupTimer);
  }
  
  canActivate(context: ExecutionContext): boolean {
    const type = context.getType();
    let identifier: string;
    let action: string;
    
    if (type === 'http') {
      const request = context.switchToHttp().getRequest();
      identifier = this.getIdentifier(request);
      action = `${request.method}:${request.path}`;
    } else if (type === 'ws') {
      const client = context.switchToWs().getClient();
      const data = context.switchToWs().getData();
      identifier = (client as any).user?.sub || client.handshake?.address || 'unknown';
      // Get the event name from the handler
      const handler = context.getHandler();
      action = handler.name || 'unknown';
    } else {
      return true; // Allow if type is unknown
    }
    
    const config = this.getRateLimitConfig(action);
    const key = `${identifier}:${action}`;
    const now = Date.now();
    
    const entry = this.rateLimitMap.get(key);
    
    if (!entry || now > entry.resetTime) {
      // First request or window has reset
      this.rateLimitMap.set(key, {
        count: 1,
        resetTime: now + config.windowMs,
      });
      return true;
    }
    
    if (entry.count >= config.limit) {
      this.logger.warn(`Rate limit exceeded for ${identifier} on ${action}`);
      throw new HttpException('Too Many Requests', HttpStatus.TOO_MANY_REQUESTS);
    }
    
    // Increment count
    entry.count++;
    return true;
  }
  
  private getIdentifier(request: any): string {
    // Prefer authenticated user ID, then IP
    if (request.user?.sub) {
      return request.user.sub;
    }
    
    // Try to get real IP from proxy headers
    return request.ip || 
           request.headers?.['x-forwarded-for']?.split(',')[0]?.trim() ||
           request.connection?.remoteAddress ||
           'unknown';
  }
  
  private getRateLimitConfig(action: string): RateLimitConfig {
    for (const [key, config] of Object.entries(DEFAULT_RATE_LIMITS)) {
      if (key === 'default') continue;
      if (action === key || action.endsWith('/' + key) || action.endsWith(':' + key)) {
        return config;
      }
    }
    return DEFAULT_RATE_LIMITS['default'];
  }
  
  private cleanup(): void {
    const now = Date.now();
    let cleaned = 0;
    for (const [key, entry] of this.rateLimitMap.entries()) {
      if (now > entry.resetTime) {
        this.rateLimitMap.delete(key);
        cleaned++;
      }
    }
    if (cleaned > 0) {
      this.logger.debug(`Cleaned up ${cleaned} expired rate limit entries`);
    }
  }
}

/**
 * WebSocket-specific rate limiter for high-frequency events
 */
@Injectable()
export class WsRateLimitGuard implements CanActivate, OnModuleDestroy {
  private readonly logger = new Logger(WsRateLimitGuard.name);
  private readonly rateLimitMap = new Map<string, RateLimitEntry>();
  private readonly cleanupTimer: NodeJS.Timeout;
  
  constructor() {
    this.cleanupTimer = setInterval(() => this.cleanup(), 5 * 60 * 1000);
  }

  onModuleDestroy() {
    clearInterval(this.cleanupTimer);
  }
  
  canActivate(context: ExecutionContext): boolean {
    if (context.getType() !== 'ws') {
      return true;
    }
    
    const client = context.switchToWs().getClient();
    const handler = context.getHandler();
    const action = handler.name || 'unknown';
    
    const userId = (client as any).user?.sub;
    const socketId = client.id;
    const identifier = userId || socketId || 'unknown';
    
    const config = DEFAULT_RATE_LIMITS[action] || DEFAULT_RATE_LIMITS['default'];
    const key = `${identifier}:${action}`;
    const now = Date.now();
    
    const entry = this.rateLimitMap.get(key);
    
    if (!entry || now > entry.resetTime) {
      this.rateLimitMap.set(key, {
        count: 1,
        resetTime: now + config.windowMs,
      });
      return true;
    }
    
    if (entry.count >= config.limit) {
      this.logger.warn(`WebSocket rate limit exceeded: ${identifier} on ${action}`);
      client.emit('error', { message: 'Rate limit exceeded. Please slow down.' });
      return false;
    }
    
    entry.count++;
    return true;
  }
  
  private cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of this.rateLimitMap.entries()) {
      if (now > entry.resetTime) {
        this.rateLimitMap.delete(key);
      }
    }
  }
}



