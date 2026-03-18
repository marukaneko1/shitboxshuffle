# ─── Stage 1: Build ───────────────────────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

# Copy workspace root package files
COPY package.json package-lock.json ./
COPY api/package.json ./api/
COPY shared/package.json ./shared/ 2>/dev/null || true

# Install all dependencies (including devDependencies for build)
RUN npm install --workspace api --include-workspace-root

# Copy source
COPY api/ ./api/
COPY shared/ ./shared/ 2>/dev/null || true
COPY tsconfig.json ./

# Generate Prisma client and build
WORKDIR /app/api
RUN npx prisma generate
RUN npm run build

# ─── Stage 2: Production ──────────────────────────────────────────────────────
FROM node:20-alpine AS production

WORKDIR /app

# Install only production dependencies
COPY package.json package-lock.json ./
COPY api/package.json ./api/
COPY shared/package.json ./shared/ 2>/dev/null || true
RUN npm install --workspace api --omit=dev --include-workspace-root

# Copy built output and Prisma files
COPY --from=builder /app/api/dist ./api/dist
COPY --from=builder /app/api/node_modules/.prisma ./api/node_modules/.prisma
COPY api/prisma ./api/prisma

WORKDIR /app/api

# Expose the port Railway will route to
EXPOSE 3001

# Run migrations then start the server
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/main.js"]
