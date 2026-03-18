-- AlterEnum
-- Add TWENTY_ONE_QUESTIONS to GameType enum
DO $$ BEGIN
    ALTER TYPE "GameType" ADD VALUE IF NOT EXISTS 'TWENTY_ONE_QUESTIONS';
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

