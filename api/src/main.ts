import { Logger, ValidationPipe } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import type { NestExpressApplication } from "@nestjs/platform-express";
import * as cookieParser from "cookie-parser";
import { raw, Request, Response, NextFunction } from "express";
import { AppModule } from "./app.module";

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  // Railway / reverse proxies — correct IPs for rate limiting and cookies
  app.set("trust proxy", 1);

  // Root health for load balancers / Railway (no /api prefix, no CORS origin required)
  const expressApp = app.getHttpAdapter().getInstance();
  expressApp.get("/health", (_req: Request, res: Response) => {
    res.status(200).json({ ok: true });
  });

  app.setGlobalPrefix("api");
  
  // SECURITY: Add security headers
  app.use((req: Request, res: Response, next: NextFunction) => {
    // Prevent clickjacking
    res.setHeader('X-Frame-Options', 'DENY');
    // Prevent MIME sniffing
    res.setHeader('X-Content-Type-Options', 'nosniff');
    // XSS Protection (legacy browsers)
    res.setHeader('X-XSS-Protection', '1; mode=block');
    // Referrer policy
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    // Content Security Policy (adjust based on your needs)
    res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'");
    // Permissions Policy
    res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
    next();
  });
  
  // Enable CORS for frontend - support multiple origins
  const allowedOrigins = process.env.ALLOWED_ORIGINS
    ? process.env.ALLOWED_ORIGINS.split(",").map(origin => origin.trim())
    : [process.env.WEB_BASE_URL || "http://localhost:3000"];
  
  app.enableCors({
    origin: (origin, callback) => {
      // No Origin: Railway health checks, curl, mobile — must not block or probes fail
      if (!origin) {
        return callback(null, true);
      }
      
      // In development, allow localhost variations
      const isDev = process.env.NODE_ENV === "development";
      if (isDev && (origin.includes("localhost") || origin.includes("127.0.0.1"))) {
        return callback(null, true);
      }
      
      if (allowedOrigins.indexOf(origin) !== -1) {
        callback(null, true);
      } else {
        callback(new Error("Not allowed by CORS"));
      }
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"]
  });
  
  app.use(cookieParser());
  
  // SECURITY: Limit JSON body size (10KB for most endpoints, prevents DoS)
  // Note: NestJS/Express default is 100KB, we're being more restrictive
  const express = require('express');
  app.use(express.json({ limit: '10kb' }));
  app.use(express.urlencoded({ extended: true, limit: '10kb' }));
  
  // Stripe requires the raw body for signature verification on webhook endpoints.
  // Allow larger size (1MB) for webhooks as they may contain large payloads
  app.use("/api/subscriptions/webhook", raw({ type: "application/json", limit: '1mb' }));
  app.use("/api/wallet/stripe/webhook", raw({ type: "application/json", limit: '1mb' }));
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true
    })
  );

  const port = parseInt(String(process.env.PORT || "3001"), 10);
  await app.listen(port, "0.0.0.0");
  Logger.log(`API listening on 0.0.0.0:${port}`, "Bootstrap");
}

bootstrap();

