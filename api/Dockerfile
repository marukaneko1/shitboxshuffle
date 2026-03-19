# ─── Stage 1: Build ───────────────────────────────────────────────────────────
# Debian slim: Prisma's native schema-engine often breaks on Alpine (musl/OpenSSL) with
# "Could not parse schema engine response ... Error load..." — bookworm-slim uses glibc + OpenSSL Prisma expects.
FROM node:20-bookworm-slim AS builder

RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy workspace root package files
COPY package.json package-lock.json ./
COPY api/package.json ./api/
COPY shared/package.json ./shared/

# Install all dependencies (including devDependencies for build)
RUN npm install --workspace api --include-workspace-root

# Copy source
COPY api/ ./api/
COPY shared/ ./shared/
COPY tsconfig.json ./

# Generate Prisma client and build
WORKDIR /app/api
RUN npx prisma generate
RUN npm run build

# ─── Stage 2: Production ──────────────────────────────────────────────────────
FROM node:20-bookworm-slim AS production

RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install only production dependencies
COPY package.json package-lock.json ./
COPY api/package.json ./api/
COPY shared/package.json ./shared/
RUN npm install --workspace api --omit=dev --include-workspace-root

# Copy built output and Prisma files
# npm workspaces hoist @prisma/client to /app/node_modules — prisma generate writes .prisma there, not under api/
COPY --from=builder /app/api/dist ./api/dist
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY api/prisma ./api/prisma

# Inline entrypoint so deploy works even if api/docker-entrypoint.sh was never committed to Git
RUN printf '%s\n' \
  '#!/bin/sh' \
  'set -e' \
  '' \
  'if [ -z "$DATABASE_URL" ]; then' \
  '  echo ""' \
  '  echo "========== RAILWAY: DATABASE_URL is missing =========="' \
  '  echo "Prisma cannot run migrations without it."' \
  '  echo ""' \
  '  echo "Fix in Railway:"' \
  '  echo "  1. Project → + New → Database → PostgreSQL (if you have no DB yet)."' \
  '  echo "  2. Open your API service (this app) → Variables."' \
  '  echo "  3. + New variable → Variable reference (or Reference)."' \
  '  echo "  4. Select your PostgreSQL service → choose DATABASE_URL."' \
  '  echo "  5. Redeploy."' \
  '  echo "======================================================"' \
  '  echo ""' \
  '  exit 1' \
  'fi' \
  '' \
  'npx prisma migrate deploy' \
  'exec node dist/main.js' \
  > ./api/docker-entrypoint.sh && chmod +x ./api/docker-entrypoint.sh

WORKDIR /app/api

# Document only — the app listens on process.env.PORT (Railway often sets 8080).
# In Railway → Settings → Networking, the public port must match that log line:
#   [Bootstrap] API listening on 0.0.0.0:XXXX
EXPOSE 8080

# Migrations + server (entrypoint prints help if DATABASE_URL missing)
ENTRYPOINT ["./docker-entrypoint.sh"]
