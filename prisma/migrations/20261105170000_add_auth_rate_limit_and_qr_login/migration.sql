-- CreateEnum
CREATE TYPE "QrLoginStatus" AS ENUM ('WAITING', 'SCANNED', 'APPROVED', 'EXPIRED', 'CANCELLED', 'CONSUMED');

-- CreateTable
CREATE TABLE "QrLoginSession" (
    "id" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "desktopProofHash" TEXT NOT NULL,
    "desktopCookieName" TEXT NOT NULL,
    "status" "QrLoginStatus" NOT NULL DEFAULT 'WAITING',
    "userId" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "scannedAt" TIMESTAMP(3),
    "approvedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "consumedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "QrLoginSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rateLimit" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "count" INTEGER NOT NULL,
    "lastRequest" BIGINT NOT NULL,

    CONSTRAINT "rateLimit_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "QrLoginSession_tokenHash_key" ON "QrLoginSession"("tokenHash");

-- CreateIndex
CREATE UNIQUE INDEX "QrLoginSession_desktopCookieName_key" ON "QrLoginSession"("desktopCookieName");

-- CreateIndex
CREATE INDEX "QrLoginSession_status_expiresAt_idx" ON "QrLoginSession"("status", "expiresAt");

-- CreateIndex
CREATE INDEX "QrLoginSession_userId_createdAt_idx" ON "QrLoginSession"("userId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "rateLimit_key_key" ON "rateLimit"("key");

-- AddForeignKey
ALTER TABLE "QrLoginSession" ADD CONSTRAINT "QrLoginSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

