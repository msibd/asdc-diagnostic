CREATE TABLE "Patient" (
    "id" TEXT NOT NULL,
    "patientCode" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "email" TEXT,
    "dateOfBirth" DATE,
    "address" TEXT,
    "emergencyContactName" TEXT,
    "emergencyContactPhone" TEXT,
    "medicalHistory" TEXT,
    "allergies" TEXT,
    "dentalHistory" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Patient_pkey" PRIMARY KEY ("id")
);

INSERT INTO "Patient" (
    "id",
    "patientCode",
    "name",
    "phone",
    "email",
    "createdAt",
    "updatedAt"
)
SELECT
    'legacy-' || md5(lower(btrim("patientPhone"))),
    'PAT-LEGACY-' || md5(lower(btrim("patientPhone"))),
    (array_agg("patientName" ORDER BY "dateTime" DESC, "createdAt" DESC))[1],
    (array_agg("patientPhone" ORDER BY "dateTime" DESC, "createdAt" DESC))[1],
    (array_agg("patientEmail" ORDER BY "dateTime" DESC, "createdAt" DESC))[1],
    min("createdAt"),
    max("updatedAt")
FROM "Appointment"
WHERE btrim("patientPhone") <> ''
GROUP BY lower(btrim("patientPhone"));

ALTER TABLE "Appointment" ADD COLUMN "patientId" TEXT;

UPDATE "Appointment"
SET "patientId" = 'legacy-' || md5(lower(btrim("patientPhone")))
WHERE btrim("patientPhone") <> '';

CREATE UNIQUE INDEX "Patient_patientCode_key" ON "Patient"("patientCode");
CREATE INDEX "Patient_phone_idx" ON "Patient"("phone");
CREATE INDEX "Patient_name_idx" ON "Patient"("name");
CREATE INDEX "Appointment_patientId_dateTime_idx" ON "Appointment"("patientId", "dateTime");

ALTER TABLE "Appointment"
ADD CONSTRAINT "Appointment_patientId_fkey"
FOREIGN KEY ("patientId") REFERENCES "Patient"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
