-- SMS gateway settings and SMS log (appointment notifications).
-- CreateTable
CREATE TABLE "SmsConfiguration" (
    "id" TEXT NOT NULL DEFAULT 'primary',
    "provider" TEXT NOT NULL DEFAULT 'bulksmsbd',
    "encryptedApiKey" TEXT,
    "senderId" TEXT NOT NULL DEFAULT '',
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "appointmentTemplate" TEXT NOT NULL DEFAULT '',
    "perNumberDailyLimit" INTEGER NOT NULL DEFAULT 3,
    "dailyLimit" INTEGER NOT NULL DEFAULT 200,
    "lastTestAt" TIMESTAMP(3),
    "lastTestStatus" TEXT,
    "lastTestMessage" TEXT,
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SmsConfiguration_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SmsLog" (
    "id" TEXT NOT NULL,
    "purpose" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "recipient" TEXT,
    "recipientHash" TEXT,
    "providerCode" TEXT,
    "message" TEXT,
    "appointmentId" TEXT,
    "actorId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SmsLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SmsLog_createdAt_idx" ON "SmsLog"("createdAt" DESC);

-- CreateIndex
CREATE INDEX "SmsLog_appointmentId_idx" ON "SmsLog"("appointmentId");

-- AddForeignKey
ALTER TABLE "SmsLog" ADD CONSTRAINT "SmsLog_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;


ALTER TABLE "SmsConfiguration" ADD CONSTRAINT "SmsConfiguration_limits_chk" CHECK ("perNumberDailyLimit" BETWEEN 1 AND 20 AND "dailyLimit" BETWEEN 1 AND 10000);
