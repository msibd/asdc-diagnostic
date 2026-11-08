-- CreateEnum
CREATE TYPE "PatientSex" AS ENUM ('MALE', 'FEMALE', 'OTHER');

-- CreateEnum
CREATE TYPE "TestOrderStatus" AS ENUM ('ORDERED', 'SAMPLE_COLLECTED', 'RECEIVED', 'IN_PROCESS', 'RESULT_ENTERED', 'VERIFIED', 'DELIVERED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "OrderPriority" AS ENUM ('ROUTINE', 'URGENT');

-- CreateEnum
CREATE TYPE "SampleStatus" AS ENUM ('PENDING', 'COLLECTED', 'RECEIVED', 'REJECTED');

-- AlterTable
ALTER TABLE "Patient" ADD COLUMN     "sex" "PatientSex";

-- CreateTable
CREATE TABLE "TestOrder" (
    "id" TEXT NOT NULL,
    "orderCode" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "invoiceId" TEXT,
    "status" "TestOrderStatus" NOT NULL DEFAULT 'ORDERED',
    "priority" "OrderPriority" NOT NULL DEFAULT 'ROUTINE',
    "referredBy" TEXT,
    "clinicalNotes" TEXT,
    "cancelReason" TEXT,
    "cancelledAt" TIMESTAMP(3),
    "orderedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TestOrder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TestOrderItem" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "testId" TEXT NOT NULL,
    "panelId" TEXT,
    "sampleId" TEXT,
    "testCode" TEXT NOT NULL,
    "testName" TEXT NOT NULL,
    "sampleType" TEXT,

    CONSTRAINT "TestOrderItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Sample" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "sampleCode" TEXT NOT NULL,
    "sampleType" TEXT NOT NULL,
    "status" "SampleStatus" NOT NULL DEFAULT 'PENDING',
    "collectedAt" TIMESTAMP(3),
    "collectedBy" TEXT,
    "receivedAt" TIMESTAMP(3),
    "receivedBy" TEXT,
    "rejectedAt" TIMESTAMP(3),
    "rejectedBy" TEXT,
    "rejectReason" TEXT,
    "replacesId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Sample_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TestOrder_orderCode_key" ON "TestOrder"("orderCode");

-- CreateIndex
CREATE UNIQUE INDEX "TestOrder_invoiceId_key" ON "TestOrder"("invoiceId");

-- CreateIndex
CREATE INDEX "TestOrder_patientId_orderedAt_idx" ON "TestOrder"("patientId", "orderedAt");

-- CreateIndex
CREATE INDEX "TestOrder_status_orderedAt_idx" ON "TestOrder"("status", "orderedAt");

-- CreateIndex
CREATE INDEX "TestOrder_orderedAt_id_idx" ON "TestOrder"("orderedAt" DESC, "id" DESC);

-- CreateIndex
CREATE INDEX "TestOrderItem_sampleId_idx" ON "TestOrderItem"("sampleId");

-- CreateIndex
CREATE INDEX "TestOrderItem_testId_idx" ON "TestOrderItem"("testId");

-- CreateIndex
CREATE UNIQUE INDEX "TestOrderItem_orderId_testId_key" ON "TestOrderItem"("orderId", "testId");

-- CreateIndex
CREATE UNIQUE INDEX "Sample_sampleCode_key" ON "Sample"("sampleCode");

-- CreateIndex
CREATE UNIQUE INDEX "Sample_replacesId_key" ON "Sample"("replacesId");

-- CreateIndex
CREATE INDEX "Sample_orderId_idx" ON "Sample"("orderId");

-- CreateIndex
CREATE INDEX "Sample_status_createdAt_idx" ON "Sample"("status", "createdAt");

-- AddForeignKey
ALTER TABLE "TestOrder" ADD CONSTRAINT "TestOrder_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TestOrder" ADD CONSTRAINT "TestOrder_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TestOrderItem" ADD CONSTRAINT "TestOrderItem_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "TestOrder"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TestOrderItem" ADD CONSTRAINT "TestOrderItem_testId_fkey" FOREIGN KEY ("testId") REFERENCES "ClinicService"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TestOrderItem" ADD CONSTRAINT "TestOrderItem_panelId_fkey" FOREIGN KEY ("panelId") REFERENCES "ClinicService"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TestOrderItem" ADD CONSTRAINT "TestOrderItem_sampleId_fkey" FOREIGN KEY ("sampleId") REFERENCES "Sample"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Sample" ADD CONSTRAINT "Sample_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "TestOrder"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Sample" ADD CONSTRAINT "Sample_replacesId_fkey" FOREIGN KEY ("replacesId") REFERENCES "Sample"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- Sequential, collision-free codes: ORD-000123 for orders, SMP-000123 for sample barcodes.
CREATE SEQUENCE IF NOT EXISTS "test_order_code_seq" START WITH 1 INCREMENT BY 1 MINVALUE 1;
CREATE SEQUENCE IF NOT EXISTS "sample_code_seq" START WITH 1 INCREMENT BY 1 MINVALUE 1;

-- Live screens refresh when these tables change (same trigger the other tables use).
DO $$
DECLARE
  table_name TEXT;
BEGIN
  FOREACH table_name IN ARRAY ARRAY['TestOrder', 'TestOrderItem', 'Sample']
  LOOP
    EXECUTE format(
      'CREATE TRIGGER clinic_change_notification
       AFTER INSERT OR UPDATE OR DELETE ON %I
       FOR EACH STATEMENT
       EXECUTE FUNCTION notify_clinic_change()',
      table_name
    );
  END LOOP;
END;
$$;

-- Roles already saved in the database keep their old permission list, so grant the new lab
-- permissions to the built-in roles that should have them. Edited roles are only ever added to.
UPDATE "Role"
SET "permissions" = ARRAY(SELECT DISTINCT unnest("permissions" || ARRAY['orders:read', 'orders:write', 'samples:write']))
WHERE "key" = 'receptionist';

UPDATE "Role"
SET "permissions" = ARRAY(SELECT DISTINCT unnest("permissions" || ARRAY['orders:read']))
WHERE "key" = 'accountant';
