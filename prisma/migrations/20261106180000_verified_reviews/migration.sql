-- A review is linked to the registered patient who wrote it. The mobile number used to verify the
-- patient is not stored on the review. Reviews written before this check have no patient.
ALTER TABLE "ClinicReview" ADD COLUMN "patientId" TEXT;

CREATE INDEX "ClinicReview_patientId_idx" ON "ClinicReview"("patientId");

ALTER TABLE "ClinicReview" ADD CONSTRAINT "ClinicReview_patientId_fkey"
  FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE SET NULL ON UPDATE CASCADE;
