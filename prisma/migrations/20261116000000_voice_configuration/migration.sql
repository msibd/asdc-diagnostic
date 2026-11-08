-- AwajDigital voice reminder settings. One row ("primary"); the API token is stored encrypted.
CREATE TABLE "VoiceConfiguration" (
    "id" TEXT NOT NULL DEFAULT 'primary',
    "encryptedToken" TEXT,
    "sender" TEXT NOT NULL DEFAULT '',
    "reminderVoice" TEXT NOT NULL DEFAULT '',
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "lastTestAt" TIMESTAMP(3),
    "lastTestStatus" TEXT,
    "lastTestMessage" TEXT,
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VoiceConfiguration_pkey" PRIMARY KEY ("id")
);
