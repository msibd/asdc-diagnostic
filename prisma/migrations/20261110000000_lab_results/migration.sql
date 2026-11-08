-- CreateEnum
CREATE TYPE "ResultStatus" AS ENUM ('PENDING', 'ENTERED', 'VERIFIED');

-- CreateEnum
CREATE TYPE "ResultFlag" AS ENUM ('NORMAL', 'LOW', 'HIGH', 'CRITICAL_LOW', 'CRITICAL_HIGH', 'ABNORMAL');

-- AlterTable
ALTER TABLE "TestOrderItem" ADD COLUMN     "enteredAt" TIMESTAMP(3),
ADD COLUMN     "enteredBy" TEXT,
ADD COLUMN     "resultNote" TEXT,
ADD COLUMN     "resultStatus" "ResultStatus" NOT NULL DEFAULT 'PENDING',
ADD COLUMN     "resultText" TEXT,
ADD COLUMN     "returnReason" TEXT,
ADD COLUMN     "verifiedAt" TIMESTAMP(3),
ADD COLUMN     "verifiedBy" TEXT;

-- CreateTable
CREATE TABLE "TestResult" (
    "id" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "parameterName" TEXT NOT NULL,
    "unit" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "value" TEXT NOT NULL,
    "numericValue" DECIMAL(18,6),
    "flag" "ResultFlag",
    "referenceText" TEXT,

    CONSTRAINT "TestResult_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TestResult_itemId_sortOrder_idx" ON "TestResult"("itemId", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "TestResult_itemId_parameterName_key" ON "TestResult"("itemId", "parameterName");

-- CreateIndex
CREATE INDEX "TestOrderItem_resultStatus_idx" ON "TestOrderItem"("resultStatus");

-- AddForeignKey
ALTER TABLE "TestResult" ADD CONSTRAINT "TestResult_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "TestOrderItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- Live screens refresh when results change.
CREATE TRIGGER clinic_change_notification
AFTER INSERT OR UPDATE OR DELETE ON "TestResult"
FOR EACH STATEMENT
EXECUTE FUNCTION notify_clinic_change();

-- Roles already saved in the database keep their old permission list, so add the result-entry
-- permission to the built-in lab role. (The new pathologist role is created on first use.)
UPDATE "Role"
SET "permissions" = ARRAY(SELECT DISTINCT unnest("permissions" || ARRAY['results:enter']))
WHERE "key" = 'lab_staff';
