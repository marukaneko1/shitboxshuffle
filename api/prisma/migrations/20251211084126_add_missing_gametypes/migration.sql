-- AlterEnum: Add missing GameType enum values
-- Note: PostgreSQL doesn't support IF NOT EXISTS for ALTER TYPE ADD VALUE
-- These will be idempotent if run multiple times (will error if value exists, but that's OK)
DO $$ BEGIN
    ALTER TYPE "GameType" ADD VALUE 'TRUTHS_AND_LIE';
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    ALTER TYPE "GameType" ADD VALUE 'BILLIARDS';
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    ALTER TYPE "GameType" ADD VALUE 'POKER';
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;
