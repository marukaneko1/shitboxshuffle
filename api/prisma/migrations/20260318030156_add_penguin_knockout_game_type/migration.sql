-- AlterEnum: Add PENGUIN_KNOCKOUT game type
DO $$ BEGIN
    ALTER TYPE "GameType" ADD VALUE 'PENGUIN_KNOCKOUT';
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;
