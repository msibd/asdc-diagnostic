-- Email (SMTP) settings, e-mail audit log, and OTP-based password recovery.
-- CreateEnum
CREATE TYPE "EmailAuthMethod" AS ENUM ('APP_PASSWORD', 'PASSWORD');

-- CreateTable
CREATE TABLE "EmailConfiguration" (
    "id" TEXT NOT NULL DEFAULT 'primary',
    "provider" TEXT NOT NULL DEFAULT 'gmail',
    "host" TEXT NOT NULL DEFAULT 'smtp.gmail.com',
    "port" INTEGER NOT NULL DEFAULT 465,
    "secure" BOOLEAN NOT NULL DEFAULT true,
    "authMethod" "EmailAuthMethod" NOT NULL DEFAULT 'APP_PASSWORD',
    "username" TEXT NOT NULL DEFAULT '',
    "encryptedPassword" TEXT,
    "senderEmail" TEXT NOT NULL DEFAULT '',
    "senderName" TEXT NOT NULL DEFAULT 'Dr Ovi''s Dental Care',
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "lastTestAt" TIMESTAMP(3),
    "lastTestStatus" TEXT,
    "lastTestMessage" TEXT,
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmailConfiguration_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PasswordResetOtp" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "codeHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "consumedAt" TIMESTAMP(3),
    "invalidatedAt" TIMESTAMP(3),
    "ipAddress" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PasswordResetOtp_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PasswordResetAuthorization" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "otpId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "consumedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PasswordResetAuthorization_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmailAuditLog" (
    "id" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "actorId" TEXT,
    "recipient" TEXT,
    "message" TEXT,
    "details" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EmailAuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PasswordResetOtp_userId_createdAt_idx" ON "PasswordResetOtp"("userId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "PasswordResetOtp_email_createdAt_idx" ON "PasswordResetOtp"("email", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "PasswordResetOtp_expiresAt_idx" ON "PasswordResetOtp"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "PasswordResetAuthorization_otpId_key" ON "PasswordResetAuthorization"("otpId");

-- CreateIndex
CREATE UNIQUE INDEX "PasswordResetAuthorization_tokenHash_key" ON "PasswordResetAuthorization"("tokenHash");

-- CreateIndex
CREATE INDEX "PasswordResetAuthorization_userId_idx" ON "PasswordResetAuthorization"("userId");

-- CreateIndex
CREATE INDEX "PasswordResetAuthorization_expiresAt_idx" ON "PasswordResetAuthorization"("expiresAt");

-- CreateIndex
CREATE INDEX "EmailAuditLog_createdAt_idx" ON "EmailAuditLog"("createdAt" DESC);

-- CreateIndex
CREATE INDEX "EmailAuditLog_action_createdAt_idx" ON "EmailAuditLog"("action", "createdAt");

-- AddForeignKey
ALTER TABLE "PasswordResetOtp" ADD CONSTRAINT "PasswordResetOtp_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PasswordResetAuthorization" ADD CONSTRAINT "PasswordResetAuthorization_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmailAuditLog" ADD CONSTRAINT "EmailAuditLog_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- Integrity rules
ALTER TABLE "EmailConfiguration" ADD CONSTRAINT "EmailConfiguration_port_chk" CHECK ("port" BETWEEN 1 AND 65535);
ALTER TABLE "PasswordResetOtp" ADD CONSTRAINT "PasswordResetOtp_attempts_chk" CHECK ("attempts" >= 0);
