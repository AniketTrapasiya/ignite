-- AlterTable
ALTER TABLE "engine_runs" ADD COLUMN     "mediaInput" TEXT,
ADD COLUMN     "outputType" TEXT NOT NULL DEFAULT 'text',
ADD COLUMN     "outputUrl" TEXT,
ADD COLUMN     "publishLog" JSONB NOT NULL DEFAULT '[]';

-- CreateTable
CREATE TABLE "ai_credentials" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "label" TEXT NOT NULL DEFAULT '',
    "apiKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ai_credentials_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ai_credentials_userId_idx" ON "ai_credentials"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "ai_credentials_userId_provider_key" ON "ai_credentials"("userId", "provider");

-- AddForeignKey
ALTER TABLE "ai_credentials" ADD CONSTRAINT "ai_credentials_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
