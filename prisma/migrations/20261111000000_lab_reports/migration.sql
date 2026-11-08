-- CreateEnum
CREATE TYPE "ReportStatus" AS ENUM ('ISSUED', 'WITHDRAWN');

-- CreateTable
CREATE TABLE "LabReport" (
    "id" TEXT NOT NULL,
    "reportCode" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "status" "ReportStatus" NOT NULL DEFAULT 'ISSUED',
    "accessToken" TEXT NOT NULL,
    "verifyCode" TEXT NOT NULL,
    "snapshot" JSONB NOT NULL,
    "issuedBy" TEXT NOT NULL,
    "issuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "withdrawnBy" TEXT,
    "withdrawnAt" TIMESTAMP(3),
    "withdrawReason" TEXT,
    "smsSentAt" TIMESTAMP(3),
    "emailSentAt" TIMESTAMP(3),
    "firstViewedAt" TIMESTAMP(3),
    "viewCount" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "LabReport_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "LabReport_reportCode_key" ON "LabReport"("reportCode");

-- CreateIndex
CREATE UNIQUE INDEX "LabReport_accessToken_key" ON "LabReport"("accessToken");

-- CreateIndex
CREATE UNIQUE INDEX "LabReport_verifyCode_key" ON "LabReport"("verifyCode");

-- CreateIndex
CREATE INDEX "LabReport_orderId_status_idx" ON "LabReport"("orderId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "LabReport_orderId_version_key" ON "LabReport"("orderId", "version");

-- AddForeignKey
ALTER TABLE "LabReport" ADD CONSTRAINT "LabReport_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "TestOrder"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- Report codes: RPT-000123.
CREATE SEQUENCE IF NOT EXISTS "report_code_seq" START WITH 1 INCREMENT BY 1 MINVALUE 1;

-- Live screens refresh when a report is released or withdrawn.
CREATE TRIGGER clinic_change_notification
AFTER INSERT OR UPDATE OR DELETE ON "LabReport"
FOR EACH STATEMENT
EXECUTE FUNCTION notify_clinic_change();

-- Roles already saved in the database keep their old permission list, so add the new report
-- permissions to the built-in roles that should have them (edited roles are only ever added to).
UPDATE "Role"
SET "permissions" = ARRAY(SELECT DISTINCT unnest("permissions" || ARRAY['reports:send']))
WHERE "key" IN ('receptionist', 'lab_staff', 'pathologist');

UPDATE "Role"
SET "permissions" = ARRAY(SELECT DISTINCT unnest("permissions" || ARRAY['results:release']))
WHERE "key" = 'pathologist';
