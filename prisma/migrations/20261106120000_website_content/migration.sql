-- Bangla name and description for services, shown on the bilingual public website.
ALTER TABLE "ClinicService" ADD COLUMN "nameBn" TEXT;
ALTER TABLE "ClinicService" ADD COLUMN "descriptionBn" TEXT;

-- Editable public website text and images (single row, id = 'primary').
CREATE TABLE "ClinicContent" (
    "id" TEXT NOT NULL DEFAULT 'primary',
    "clinicName" TEXT NOT NULL DEFAULT '',
    "clinicSubtitle" TEXT NOT NULL DEFAULT '',
    "heroTitleEn" TEXT NOT NULL DEFAULT '',
    "heroTitleBn" TEXT NOT NULL DEFAULT '',
    "heroSubtitleEn" TEXT NOT NULL DEFAULT '',
    "heroSubtitleBn" TEXT NOT NULL DEFAULT '',
    "technologyEn" TEXT NOT NULL DEFAULT '',
    "technologyBn" TEXT NOT NULL DEFAULT '',
    "bookingNoteEn" TEXT NOT NULL DEFAULT '',
    "bookingNoteBn" TEXT NOT NULL DEFAULT '',
    "closingMessageEn" TEXT NOT NULL DEFAULT '',
    "closingMessageBn" TEXT NOT NULL DEFAULT '',
    "doctorHighlightsEn" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "doctorHighlightsBn" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "heroImageUrl" TEXT,
    "doctorImageUrl" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClinicContent_pkey" PRIMARY KEY ("id")
);
