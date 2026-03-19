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
COPY api/docker-entrypoint.sh ./api/docker-entrypoint.sh
RUN chmod +x ./api/docker-entrypoint.sh

WORKDIR /app/api

# Expose the port Railway will route to
EXPOSE 3001

# Migrations + server (entrypoint prints help if DATABASE_URL missing)
ENTRYPOINT ["./docker-entrypoint.sh"]
