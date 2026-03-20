export default () => ({
  env: process.env.NODE_ENV || "development",
  port: parseInt(process.env.PORT ?? "3001", 10),
  databaseUrl: process.env.DATABASE_URL,
  redisUrl: process.env.REDIS_URL,
  jwt: {
    accessSecret: process.env.JWT_ACCESS_SECRET,
    refreshSecret: process.env.JWT_REFRESH_SECRET,
    accessExpiresIn: process.env.JWT_ACCESS_EXPIRES_IN || "15m",
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || "7d"
  },
  google: {
    clientId: process.env.GOOGLE_CLIENT_ID
  },
  /** Browser Maps JS API key for GeoGuesser (Street View + map). Restrict by referrer in GCP. */
  googleMaps: {
    browserKey: (process.env.GOOGLE_MAPS_API_KEY || "").trim()
  },
  stripe: {
    secretKey: process.env.STRIPE_SECRET_KEY,
    webhookSecret: process.env.STRIPE_WEBHOOK_SECRET,
    basicPriceId: process.env.STRIPE_BASIC_PRICE_ID,
    tokenPackPriceId: process.env.STRIPE_TOKEN_PACK_PRICE_ID,
    // Optional: per-pack price IDs (100 tokens = $1). Fallback to tokenPackPriceId if not set.
    tokenPackPriceIds: {
      small: process.env.STRIPE_TOKEN_PACK_SMALL_PRICE_ID || process.env.STRIPE_TOKEN_PACK_PRICE_ID,
      medium: process.env.STRIPE_TOKEN_PACK_MEDIUM_PRICE_ID || process.env.STRIPE_TOKEN_PACK_PRICE_ID,
      large: process.env.STRIPE_TOKEN_PACK_LARGE_PRICE_ID || process.env.STRIPE_TOKEN_PACK_PRICE_ID,
      mega: process.env.STRIPE_TOKEN_PACK_MEGA_PRICE_ID || process.env.STRIPE_TOKEN_PACK_PRICE_ID
    }
  },
  agora: {
    appId: process.env.AGORA_APP_ID,
    appCertificate: process.env.AGORA_APP_CERTIFICATE
  },
  persona: {
    apiKey: process.env.PERSONA_API_KEY,
    webhookSecret: process.env.PERSONA_WEBHOOK_SECRET
  },
  urls: {
    webBaseUrl: process.env.WEB_BASE_URL || "http://localhost:3000",
    apiBaseUrl: process.env.API_BASE_URL || "http://localhost:3001"
  },
  intervals: {
    matchmakingCheck: parseInt(process.env.MATCHMAKING_CHECK_INTERVAL_MS || "2000", 10),
    votingDuration: parseInt(process.env.VOTING_DURATION_MS || "20000", 10),
    triviaCountdown: parseInt(process.env.TRIVIA_COUNTDOWN_MS || "0", 10),
    triviaQuestionDuration: parseInt(process.env.TRIVIA_QUESTION_DURATION_MS || "10000", 10), // 10 seconds
    triviaQuestionDelay: parseInt(process.env.TRIVIA_QUESTION_DELAY_MS || "2500", 10),
    triviaQuestionPause: parseInt(process.env.TRIVIA_QUESTION_PAUSE_MS || "2000", 10),
    matchmakingCleanup: parseInt(process.env.MATCHMAKING_CLEANUP_INTERVAL_MS || "300000", 10), // 5 minutes
    matchmakingStaleTimeout: parseInt(process.env.MATCHMAKING_STALE_TIMEOUT_MS || "600000", 10) // 10 minutes
  }
});


