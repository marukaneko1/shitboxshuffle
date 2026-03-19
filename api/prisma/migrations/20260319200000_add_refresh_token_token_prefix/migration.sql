-- RefreshToken.tokenPrefix was added in schema but no migration existed; production DBs created from init_schema lack this column.

ALTER TABLE "RefreshToken" ADD COLUMN "tokenPrefix" TEXT;

CREATE INDEX "RefreshToken_tokenPrefix_idx" ON "RefreshToken"("tokenPrefix");
