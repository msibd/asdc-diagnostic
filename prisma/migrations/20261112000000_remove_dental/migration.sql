-- DropForeignKey
ALTER TABLE "DentalChartEntry" DROP CONSTRAINT "DentalChartEntry_patientId_fkey";

-- DropForeignKey
ALTER TABLE "DentalChartEntry" DROP CONSTRAINT "DentalChartEntry_updatedById_fkey";

-- DropForeignKey
ALTER TABLE "ExaminationRecord" DROP CONSTRAINT "ExaminationRecord_appointmentId_fkey";

-- DropForeignKey
ALTER TABLE "ExaminationRecord" DROP CONSTRAINT "ExaminationRecord_examinedById_fkey";

-- DropForeignKey
ALTER TABLE "ExaminationRecord" DROP CONSTRAINT "ExaminationRecord_patientId_fkey";

-- DropForeignKey
ALTER TABLE "Prescription" DROP CONSTRAINT "Prescription_patientId_fkey";

-- DropForeignKey
ALTER TABLE "Prescription" DROP CONSTRAINT "Prescription_prescribedById_fkey";

-- DropForeignKey
ALTER TABLE "PrescriptionMedication" DROP CONSTRAINT "PrescriptionMedication_prescriptionId_fkey";

-- DropForeignKey
ALTER TABLE "TreatmentPlan" DROP CONSTRAINT "TreatmentPlan_patientId_fkey";

-- DropForeignKey
ALTER TABLE "TreatmentSession" DROP CONSTRAINT "TreatmentSession_createdById_fkey";

-- DropForeignKey
ALTER TABLE "TreatmentSession" DROP CONSTRAINT "TreatmentSession_treatmentPlanId_fkey";

-- AlterTable
ALTER TABLE "DoctorProfile" ALTER COLUMN "specialization" SET DEFAULT 'Pathology';

-- AlterTable
ALTER TABLE "EmailConfiguration" ALTER COLUMN "senderName" SET DEFAULT 'ASDC Diagnostic';

-- AlterTable
ALTER TABLE "InventoryItem" ALTER COLUMN "category" SET DEFAULT 'Reagents';

-- AlterTable
ALTER TABLE "Patient" DROP COLUMN "dentalHistory";

-- DropTable
DROP TABLE "DentalChartEntry";

-- DropTable
DROP TABLE "ExaminationRecord";

-- DropTable
DROP TABLE "Prescription";

-- DropTable
DROP TABLE "PrescriptionMedication";

-- DropTable
DROP TABLE "TreatmentPlan";

-- DropTable
DROP TABLE "TreatmentSession";

-- DropEnum
DROP TYPE "ToothCondition";

-- DropEnum
DROP TYPE "TreatmentPlanStatus";


-- ---------------------------------------------------------------------------------------------
-- Staff roles after the dental features are gone.
-- Roles already saved in the database may still list the dental permissions; remove them.
-- ---------------------------------------------------------------------------------------------
UPDATE "Role"
SET "permissions" = ARRAY(
  SELECT p FROM unnest("permissions") AS p
  WHERE p NOT LIKE 'clinical:%' AND p NOT LIKE 'prescriptions:%' AND p NOT LIKE 'treatments:%'
);

-- The built-in "Dental assistant" is replaced by "Laboratory staff". Anyone who held it moves over,
-- so nobody is silently locked out.
UPDATE "user" SET "role" = 'lab_staff' WHERE "role" = 'assistant';
DELETE FROM "Role" WHERE "key" = 'assistant' AND "isSystem" = true;

-- The built-in "Doctor" role now means a consulting doctor: it can see test orders.
UPDATE "Role"
SET "description" = 'Consulting doctor: sees patients, their test orders and released reports.',
    "permissions" = ARRAY(SELECT DISTINCT unnest("permissions" || ARRAY['orders:read']))
WHERE "key" = 'doctor' AND "isSystem" = true;
