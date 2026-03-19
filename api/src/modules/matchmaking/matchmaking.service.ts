import { Injectable, UnauthorizedException, OnModuleDestroy, Logger } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import Redis from "ioredis";
import { ConfigService } from "@nestjs/config";

interface QueueRequest {
  userId: string;
  region: string;
  language: string;
  latitude?: number;
  longitude?: number;
  enqueuedAt: number;
}

@Injectable()
export class MatchmakingService implements OnModuleDestroy {
  private readonly logger = new Logger(MatchmakingService.name);
  private redis: Redis | null = null;
  
  private async ensureRedis(): Promise<Redis> {
    if (!this.redis) {
      // Redis is not initialized - this should not happen in non-serverless mode
      // In serverless mode, matchmaking won't work, so throw a clear error
      throw new Error('Redis not initialized. Matchmaking requires Redis connection.');
    }
    return this.redis;
  }
  // Track user -> queue key mapping (with timestamps for cleanup)
  private userQueues = new Map<string, { key: string; addedAt: number }>();
  // Cleanup interval
  private cleanupInterval: NodeJS.Timeout | null = null;

  private getStaleEntryMs(): number {
    return this.configService.get<number>("intervals.matchmakingStaleTimeout") || 600000; // 10 minutes default
  }
  
  private getCleanupIntervalMs(): number {
    return this.configService.get<number>("intervals.matchmakingCleanup") || 300000; // 5 minutes default
  }

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService
  ) {
    // Skip Redis connection in serverless environments - connect lazily on first use
    // This prevents timeouts during serverless function initialization
    if (process.env.IS_SERVERLESS === 'true') {
      this.logger.log('Skipping Redis connection in serverless mode - will connect on first use');
      return;
    }

    const redisUrl = configService.get<string>("redisUrl") || "redis://localhost:6379";
    
    // Check if this is an Upstash Redis URL (requires TLS)
    const isUpstash = redisUrl.includes("upstash.io");
    
    // Configure Redis client with TLS for Upstash
    let redisOptions: any;
    
    if (isUpstash) {
      // Parse Upstash URL: redis://default:password@host:port
      const urlMatch = redisUrl.match(/redis:\/\/([^:]+):([^@]+)@([^:]+):(\d+)/);
      if (!urlMatch) {
        throw new Error("Invalid Upstash Redis URL format");
      }
      
      const [, username, password, host, port] = urlMatch;
      
      redisOptions = {
        host,
        port: parseInt(port, 10),
        password,
        username: username !== "default" ? username : undefined,
        tls: {
          // Upstash uses valid certificates
          rejectUnauthorized: true
        },
        retryStrategy: (times: number) => {
          if (times > 3) {
            return null; // Stop retrying after 3 attempts
          }
          return Math.min(times * 200, 2000); // Exponential backoff, max 2s
        },
        reconnectOnError: (err: Error) => {
          const targetError = "READONLY";
          if (err.message.includes(targetError)) {
            return true; // Reconnect on READONLY errors
          }
          return false;
        },
        maxRetriesPerRequest: 3,
        enableReadyCheck: true,
        lazyConnect: false
      };
    } else {
      // Local Redis - just use the URL
      redisOptions = redisUrl;
    }
    
    this.redis = new Redis(redisOptions);
    
    // Handle Redis connection errors to prevent unhandled error events
    if (this.redis) {
      this.redis.on("error", (err) => {
        this.logger.error(`Redis connection error: ${err.message}`);
        // Don't throw - let Redis handle reconnection automatically
      });
      
      this.redis.on("connect", () => {
        this.logger.log("Connected to Redis server");
      });
      
      this.redis.on("ready", () => {
        this.logger.log("Redis client ready");
      });
      
      this.redis.on("close", () => {
        this.logger.warn("Redis connection closed");
      });
      
      this.redis.on("reconnecting", () => {
        this.logger.log("Reconnecting to Redis...");
      });
    }
    
    // Start periodic cleanup of stale userQueues entries
    this.cleanupInterval = setInterval(() => {
      this.cleanupStaleEntries();
    }, this.getCleanupIntervalMs());
  }

  /**
   * Cleanup stale entries from userQueues map
   * This prevents memory leaks when Redis is cleared or users disconnect without proper cleanup
   */
  private async cleanupStaleEntries() {
    const now = Date.now();
    const staleUserIds: string[] = [];
    
    for (const [userId, entry] of this.userQueues.entries()) {
      // Check if entry is stale
      if (now - entry.addedAt > this.getStaleEntryMs()) {
        staleUserIds.push(userId);
      }
    }
    
    // Verify and clean up stale entries
    for (const userId of staleUserIds) {
      const entry = this.userQueues.get(userId);
      if (!entry) continue;
      
      // Check if user is actually still in the Redis queue
      if (!this.redis) return;
      const redis = await this.ensureRedis();
      const items = await redis.lrange(entry.key, 0, -1);
      let stillInQueue = false;
      
      for (const item of items) {
        try {
          const parsed = JSON.parse(item);
          if (parsed.userId === userId) {
            stillInQueue = true;
            break;
          }
        } catch {
          continue;
        }
      }
      
      if (!stillInQueue) {
        this.userQueues.delete(userId);
        this.logger.debug(`Cleaned up stale entry for user ${userId}`);
      } else {
        // Update timestamp since user is still in queue
        this.userQueues.set(userId, { key: entry.key, addedAt: now });
      }
    }
  }

  /**
   * Cleanup on module destroy
   */
  async onModuleDestroy() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
    if (this.redis) {
      try { await this.redis.quit(); } catch {}
    }
  }

  async joinQueue(userId: string, region: string, language: string, latitude?: number, longitude?: number) {
    const eligible = await this.ensureEligible(userId);
    if (!eligible) {
      // Get more details for better error message
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: {
          isBanned: true,
          is18PlusVerified: true,
          subscription: { select: { status: true } }
        }
      });
      let reason = "Not eligible for matchmaking";
      if (!user) reason = "User not found";
      else if (user.isBanned) reason = "Account is banned";
      else if (!user.is18PlusVerified) reason = "Age verification required (18+)";
      else if (user.subscription?.status !== "ACTIVE") reason = "Active subscription required";
      throw new UnauthorizedException(reason);
    }
    
    // Get user location if not provided
    if (latitude === undefined || longitude === undefined) {
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { latitude: true, longitude: true }
      });
      latitude = user?.latitude ?? undefined;
      longitude = user?.longitude ?? undefined;
    }
    
    const key = this.queueKey(region, language);
    
    // Remove user from queue first to prevent duplicates
    await this.leaveQueue(userId);
    
    const payload: QueueRequest = { userId, region, language, latitude, longitude, enqueuedAt: Date.now() };
    const redis = await this.ensureRedis();
    await redis.rpush(key, JSON.stringify(payload));
    this.userQueues.set(userId, { key, addedAt: Date.now() });
    
    // Try to find the closest match
    const match = await this.findClosestMatch(userId, key, latitude, longitude);
    if (match) {
      return match;
    }
    
    const length = await redis.llen(key);
    this.logger.log(`User ${userId} joined queue ${key}. Queue length: ${length}`);
    return null;
  }

  async leaveQueue(userId: string) {
    // Try to get queue key from map first
    const entry = this.userQueues.get(userId);
    let key = entry?.key;
    
    // If not in map, use SCAN to find queue keys (non-blocking alternative to KEYS)
    if (!key) {
      try {
        const allQueueKeys: string[] = [];
        let cursor = "0";
        
        // Use SCAN to iteratively find all queue keys (production-safe, non-blocking)
        const redis = await this.ensureRedis();
        do {
          const result = await redis.scan(
            cursor,
            "MATCH",
            "match_queue:*",
            "COUNT",
            100
          );
          cursor = result[0];
          allQueueKeys.push(...result[1]);
        } while (cursor !== "0");
        
        // Search through each queue key to find the user
        for (const possibleKey of allQueueKeys) {
          const items = await redis.lrange(possibleKey, 0, -1);
          for (const item of items) {
            try {
              const parsed = JSON.parse(item);
              if (parsed.userId === userId) {
                key = possibleKey;
                break;
              }
            } catch {
              continue;
            }
          }
          if (key) break;
        }
      } catch (err) {
        this.logger.error("Error scanning queues:", err);
      }
    }
    
    if (!key) return; // User not in any queue
    
    // Remove ALL occurrences of this user from the queue (handle duplicates)
    // Collect all matching items first to avoid race conditions during iteration
    const redis = await this.ensureRedis();
    const items = await redis.lrange(key, 0, -1);
    const matchingItems: string[] = [];
    for (const item of items) {
      try {
        const parsed = JSON.parse(item);
        if (parsed.userId === userId) {
          matchingItems.push(item);
        }
      } catch {
        continue;
      }
    }
    
      // Remove all matching items using a pipeline for atomic operation
      if (matchingItems.length > 0 && this.redis) {
        const pipeline = this.redis.pipeline();
      for (const item of matchingItems) {
        pipeline.lrem(key, 0, item); // Remove all occurrences of this exact JSON string
      }
      const results = await pipeline.exec();
      const removed = results?.reduce((sum, result) => sum + (result[1] as number || 0), 0) || 0;
      
      if (removed > 0) {
        this.logger.debug(`Removed ${removed} queue entry/entries for user ${userId} from ${key}`);
      }
    }
    
    this.userQueues.delete(userId);
  }

  async findMatch(userId: string, region: string, language: string, latitude?: number, longitude?: number): Promise<[QueueRequest, QueueRequest] | null> {
    const key = this.queueKey(region, language);
    
    // First, verify user is still in the queue
    const redis = await this.ensureRedis();
    const allItems = await redis.lrange(key, 0, -1);
    const userInQueue = allItems.some(item => {
      try {
        const parsed = JSON.parse(item) as QueueRequest;
        return parsed.userId === userId;
      } catch {
        return false;
      }
    });
    
    if (!userInQueue) {
      this.logger.debug(`[MATCHMAKING] User ${userId} not in queue ${key}, cannot find match`);
      return null;
    }
    
    return this.findClosestMatch(userId, key, latitude, longitude);
  }

  private async findClosestMatch(userId: string, queueKey: string, userLat?: number, userLon?: number): Promise<[QueueRequest, QueueRequest] | null> {
    const redis = await this.ensureRedis();
    
    // Get all users in queue FIRST (before checking length)
    // This ensures we see all users even if there's a race condition
    const allItems = await redis.lrange(queueKey, 0, -1);
    const length = allItems.length;
    
    this.logger.log(`[MATCHMAKING] findClosestMatch for ${userId}, queue: ${queueKey}, length: ${length}, items: ${allItems.length}`);
    
    // Log all user IDs in queue for debugging
    const userIdsInQueue: string[] = [];
    for (const item of allItems) {
      try {
        const parsed = JSON.parse(item) as QueueRequest;
        userIdsInQueue.push(parsed.userId);
      } catch {
        // Skip invalid items
      }
    }
    this.logger.debug(`[MATCHMAKING] User IDs in queue: ${userIdsInQueue.join(', ')}`);
    
    if (length < 2) {
      this.logger.warn(`[MATCHMAKING] Queue too short (${length} < 2) - need at least 2 users to match`);
      return null;
    }
    
    const parsedRequests: QueueRequest[] = [];
    for (const item of allItems) {
      try {
        const request = JSON.parse(item) as QueueRequest;
        if (request.userId !== userId) parsedRequests.push(request);
      } catch {
        continue;
      }
    }

    const candidateIds = parsedRequests.map(r => r.userId);
    const eligibleSet = await this.batchCheckEligibility(candidateIds);

    const queueRequests: Array<{ request: QueueRequest; distance: number }> = [];
    
    for (const request of parsedRequests) {
      if (!eligibleSet.has(request.userId)) continue;

      let distance = Infinity;
      if (userLat !== undefined && userLon !== undefined && request.latitude !== undefined && request.longitude !== undefined) {
        distance = this.calculateDistance(userLat, userLon, request.latitude, request.longitude);
      }
      
      queueRequests.push({ request, distance });
    }
    
    if (queueRequests.length === 0) {
      this.logger.warn(`[MATCHMAKING] No eligible matches found for ${userId} in queue ${queueKey} (checked ${allItems.length} items, ${userIdsInQueue.length} unique users)`);
      if (userIdsInQueue.length > 1) {
        this.logger.warn(`[MATCHMAKING] Queue has ${userIdsInQueue.length} users but none are eligible matches. User IDs: ${userIdsInQueue.join(', ')}`);
      }
      return null;
    }
    
    // Sort by distance (closest first)
    queueRequests.sort((a, b) => a.distance - b.distance);
    
    // Get the closest match
    const closestMatch = queueRequests[0].request;
    this.logger.log(`Closest match: ${closestMatch.userId} (distance: ${queueRequests[0].distance})`);
    
    // Find current user's request
    let currentUserRequest: QueueRequest | null = null;
    let currentUserJson: string | null = null;
    for (const item of allItems) {
      try {
        const request = JSON.parse(item) as QueueRequest;
        if (request.userId === userId) {
          currentUserRequest = request;
          currentUserJson = item; // Keep original JSON to ensure exact match
          break;
        }
      } catch {
        continue;
      }
    }
    
    if (!currentUserRequest || !currentUserJson) {
        this.logger.warn("Current user's request not found in queue");
      return null;
    }
    
    // Find the exact JSON string for the match user
    let matchUserJson: string | null = null;
    for (const item of allItems) {
      try {
        const request = JSON.parse(item) as QueueRequest;
        if (request.userId === closestMatch.userId) {
          matchUserJson = item;
          break;
        }
      } catch {
        continue;
      }
    }
    
    if (!matchUserJson) {
        this.logger.warn("Match user's request not found in queue");
      return null;
    }
    
    // Use Redis WATCH + MULTI/EXEC for atomic operation
    // This ensures that if the queue changes between our read and write, the transaction fails
    try {
      await redis.watch(queueKey);
        
        // Double-check both users are still in queue before removing
        const currentQueueItems = await redis.lrange(queueKey, 0, -1);
      const currentUserStillInQueue = currentQueueItems.includes(currentUserJson);
      const matchUserStillInQueue = currentQueueItems.includes(matchUserJson);
      
        if (!currentUserStillInQueue || !matchUserStillInQueue) {
          await redis.unwatch();
        this.logger.debug(`Users no longer in queue (current: ${currentUserStillInQueue}, match: ${matchUserStillInQueue})`);
        return null;
      }
      
        // Execute atomic removal
        const pipeline = redis.multi();
      pipeline.lrem(queueKey, 1, currentUserJson);
      pipeline.lrem(queueKey, 1, matchUserJson);
      const results = await pipeline.exec();
      
      // Check if transaction succeeded
      if (!results) {
        // Transaction was aborted due to WATCH - queue was modified
        this.logger.debug("Transaction aborted - queue was modified by another process");
        return null;
      }
      
      // Verify both removals succeeded
      const removed1 = results[0]?.[1] as number;
      const removed2 = results[1]?.[1] as number;
      
      if (removed1 === 0 || removed2 === 0) {
        this.logger.warn(`[MATCHMAKING] Removal failed in transaction (removed1: ${removed1}, removed2: ${removed2}) for users ${userId} and ${closestMatch.userId}`);
          // Re-add current user if needed
          if (removed1 > 0 && removed2 === 0) {
            await redis.rpush(queueKey, currentUserJson);
        }
        return null;
      }
      
      this.logger.log(`[MATCHMAKING] Successfully matched ${userId} with ${closestMatch.userId} (removed both from queue)`);
      
      this.logger.log(`Successfully matched ${userId} with ${closestMatch.userId} (atomic)`);
      } catch (err) {
        this.logger.error("Transaction error:", err);
        try {
          await redis.unwatch();
        } catch {
          // Ignore unwatch errors
        }
      return null;
    }
    this.userQueues.delete(userId);
    this.userQueues.delete(closestMatch.userId);
    
    return [currentUserRequest, closestMatch] as [QueueRequest, QueueRequest];
  }

  /**
   * Calculate distance between two coordinates using Haversine formula
   * Returns distance in kilometers
   */
  private calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371; // Earth's radius in kilometers
    const dLat = this.toRad(lat2 - lat1);
    const dLon = this.toRad(lon2 - lon1);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.toRad(lat1)) * Math.cos(this.toRad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  private toRad(degrees: number): number {
    return degrees * (Math.PI / 180);
  }

  queueKey(region: string, language: string) {
    return `match_queue:${region}:${language}`;
  }

  private async batchCheckEligibility(userIds: string[]): Promise<Set<string>> {
    if (userIds.length === 0) return new Set();
    const users = await this.prisma.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, isBanned: true, is18PlusVerified: true, subscription: { select: { status: true } } }
    });
    const eligible = new Set<string>();
    const isDev = process.env.NODE_ENV === 'development';
    for (const user of users) {
      if (user.isBanned) continue;
      if (isDev) { eligible.add(user.id); continue; }
      if (!user.is18PlusVerified) continue;
      if (user.subscription?.status !== "ACTIVE") continue;
      eligible.add(user.id);
    }
    return eligible;
  }

  private async ensureEligible(userId: string): Promise<boolean> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        isBanned: true,
        is18PlusVerified: true,
        subscription: { select: { status: true } }
      }
    });
    if (!user) return false;
    if (user.isBanned) return false;
    // In development, skip subscription and age verification so local accounts can match freely
    if (process.env.NODE_ENV === 'development') return true;
    if (!user.is18PlusVerified) return false;
    if (user.subscription?.status !== "ACTIVE") return false;
    return true;
  }
}

