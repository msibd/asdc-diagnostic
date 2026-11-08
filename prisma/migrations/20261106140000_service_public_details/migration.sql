-- Optional public-website presentation for each service (card badge, timing, fee range, details, steps).
ALTER TABLE "ClinicService" ADD COLUMN "categoryBn" TEXT;
ALTER TABLE "ClinicService" ADD COLUMN "iconKey" TEXT;
ALTER TABLE "ClinicService" ADD COLUMN "badgeEn" TEXT;
ALTER TABLE "ClinicService" ADD COLUMN "badgeBn" TEXT;
ALTER TABLE "ClinicService" ADD COLUMN "timeTextEn" TEXT;
ALTER TABLE "ClinicService" ADD COLUMN "timeTextBn" TEXT;
ALTER TABLE "ClinicService" ADD COLUMN "painTextEn" TEXT;
ALTER TABLE "ClinicService" ADD COLUMN "painTextBn" TEXT;
ALTER TABLE "ClinicService" ADD COLUMN "feeMax" DECIMAL(12,2);
ALTER TABLE "ClinicService" ADD COLUMN "detailsEn" TEXT NOT NULL DEFAULT '';
ALTER TABLE "ClinicService" ADD COLUMN "detailsBn" TEXT NOT NULL DEFAULT '';
ALTER TABLE "ClinicService" ADD COLUMN "stepsEn" TEXT[] DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "ClinicService" ADD COLUMN "stepsBn" TEXT[] DEFAULT ARRAY[]::TEXT[];
