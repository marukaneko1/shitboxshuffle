import * as Joi from "joi";

export const validationSchema = Joi.object({
  NODE_ENV: Joi.string().valid("development", "production", "test").default("development"),
  PORT: Joi.alternatives()
    .try(Joi.number(), Joi.string().pattern(/^\d+$/))
    .default(3001),
  // postgresql:// URLs can fail Joi.uri() with some password encodings
  DATABASE_URL: Joi.string().required().min(8),
  REDIS_URL: Joi.string().pattern(/^redis(s)?:\/\//).required(),
  JWT_ACCESS_SECRET: Joi.string().min(16).required(),
  JWT_REFRESH_SECRET: Joi.string().min(16).required(),
  JWT_ACCESS_EXPIRES_IN: Joi.string().default("15m"),
  JWT_REFRESH_EXPIRES_IN: Joi.string().default("7d"),
  GOOGLE_CLIENT_ID: Joi.string().allow("").optional(),
  STRIPE_SECRET_KEY: Joi.string().allow("").optional(),
  STRIPE_WEBHOOK_SECRET: Joi.string().allow("").optional(),
  STRIPE_BASIC_PRICE_ID: Joi.string().allow("").optional(),
  STRIPE_TOKEN_PACK_PRICE_ID: Joi.string().allow("").optional(),
  AGORA_APP_ID: Joi.string().allow("").optional(),
  AGORA_APP_CERTIFICATE: Joi.string().allow("").optional(),
  PERSONA_API_KEY: Joi.string().allow("").optional(),
  PERSONA_WEBHOOK_SECRET: Joi.string().allow("").optional(),
  WEB_BASE_URL: Joi.string().uri().default("http://localhost:3000"),
  API_BASE_URL: Joi.string().uri().default("http://localhost:3001"),
  MATCHMAKING_CHECK_INTERVAL_MS: Joi.number().default(2000),
  VOTING_DURATION_MS: Joi.number().default(20000),
  TRIVIA_COUNTDOWN_MS: Joi.number().default(3000),
  TRIVIA_QUESTION_DURATION_MS: Joi.number().default(30000),
  TRIVIA_QUESTION_DELAY_MS: Joi.number().default(4000),
  TRIVIA_QUESTION_PAUSE_MS: Joi.number().default(2000),
  MATCHMAKING_CLEANUP_INTERVAL_MS: Joi.number().default(300000),
  MATCHMAKING_STALE_TIMEOUT_MS: Joi.number().default(600000)
});


