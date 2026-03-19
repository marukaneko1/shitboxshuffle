#!/bin/sh
set -e

if [ -z "$DATABASE_URL" ]; then
  echo ""
  echo "========== RAILWAY: DATABASE_URL is missing =========="
  echo "Prisma cannot run migrations without it."
  echo ""
  echo "Fix in Railway:"
  echo "  1. Project → + New → Database → PostgreSQL (if you have no DB yet)."
  echo "  2. Open your API service (this app) → Variables."
  echo "  3. + New variable → Variable reference (or Reference)."
  echo "  4. Select your PostgreSQL service → choose DATABASE_URL."
  echo "  5. Redeploy."
  echo "======================================================"
  echo ""
  exit 1
fi

npx prisma migrate deploy
exec node dist/main.js
