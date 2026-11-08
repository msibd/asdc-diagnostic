CREATE TYPE "TreatmentPlanStatus" AS ENUM (
    'PLANNED',
    'IN_PROGRESS',
    'ON_HOLD',
    'COMPLETED',
    'CANCELLED'
);

CREATE TABLE "TreatmentPlan" (
    "id" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "diagnosis" TEXT NOT NULL,
    "procedureName" TEXT NOT NULL,
    "toothNumbers" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "estimatedCost" DECIMAL(12,2) NOT NULL,
    "status" "TreatmentPlanStatus" NOT NULL DEFAULT 'PLANNED',
    "notes" TEXT,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TreatmentPlan_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "TreatmentSession" (
    "id" TEXT NOT NULL,
    "treatmentPlanId" TEXT NOT NULL,
    "createdById" TEXT,
    "performedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notes" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TreatmentSession_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "TreatmentPlan_patientId_createdAt_idx" ON "TreatmentPlan"("patientId", "createdAt");
CREATE INDEX "TreatmentPlan_status_createdAt_idx" ON "TreatmentPlan"("status", "createdAt");
CREATE INDEX "TreatmentSession_treatmentPlanId_performedAt_idx" ON "TreatmentSession"("treatmentPlanId", "performedAt");
CREATE INDEX "TreatmentSession_createdById_idx" ON "TreatmentSession"("createdById");

ALTER TABLE "TreatmentPlan"
ADD CONSTRAINT "TreatmentPlan_patientId_fkey"
FOREIGN KEY ("patientId") REFERENCES "Patient"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "TreatmentSession"
ADD CONSTRAINT "TreatmentSession_treatmentPlanId_fkey"
FOREIGN KEY ("treatmentPlanId") REFERENCES "TreatmentPlan"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "TreatmentSession"
ADD CONSTRAINT "TreatmentSession_createdById_fkey"
FOREIGN KEY ("createdById") REFERENCES "user"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
