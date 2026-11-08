-- CreateEnum
CREATE TYPE "ToothCondition" AS ENUM ('HEALTHY', 'CARIES', 'FILLED', 'CROWN', 'ROOT_CANAL', 'IMPLANT', 'FRACTURED', 'MISSING', 'EXTRACTED', 'OTHER');

-- CreateEnum
CREATE TYPE "ExpenseCategory" AS ENUM ('RENT', 'UTILITIES', 'SUPPLIES', 'LAB_FEES', 'EQUIPMENT', 'SALARY', 'MARKETING', 'MAINTENANCE', 'OTHER');

-- CreateTable
CREATE TABLE "ExaminationRecord" (
    "id" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "appointmentId" TEXT,
    "examinedById" TEXT,
    "examinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "chiefComplaint" TEXT NOT NULL,
    "findings" TEXT,
    "diagnosis" TEXT NOT NULL,
    "notes" TEXT,
    "followUpDate" DATE,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExaminationRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DentalChartEntry" (
    "id" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "toothNumber" VARCHAR(2) NOT NULL,
    "condition" "ToothCondition" NOT NULL,
    "notes" TEXT,
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DentalChartEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Expense" (
    "id" TEXT NOT NULL,
    "category" "ExpenseCategory" NOT NULL,
    "description" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "spentAt" DATE NOT NULL,
    "method" "PaymentMethod" NOT NULL DEFAULT 'CASH',
    "reference" TEXT,
    "voidedAt" TIMESTAMP(3),
    "voidReason" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Expense_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ExaminationRecord_patientId_examinedAt_idx" ON "ExaminationRecord"("patientId", "examinedAt" DESC);

-- CreateIndex
CREATE INDEX "ExaminationRecord_appointmentId_idx" ON "ExaminationRecord"("appointmentId");

-- CreateIndex
CREATE INDEX "ExaminationRecord_followUpDate_idx" ON "ExaminationRecord"("followUpDate");

-- CreateIndex
CREATE UNIQUE INDEX "DentalChartEntry_patientId_toothNumber_key" ON "DentalChartEntry"("patientId", "toothNumber");

-- CreateIndex
CREATE INDEX "Expense_spentAt_idx" ON "Expense"("spentAt" DESC);

-- CreateIndex
CREATE INDEX "Expense_category_spentAt_idx" ON "Expense"("category", "spentAt");

-- AddForeignKey
ALTER TABLE "ExaminationRecord" ADD CONSTRAINT "ExaminationRecord_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExaminationRecord" ADD CONSTRAINT "ExaminationRecord_appointmentId_fkey" FOREIGN KEY ("appointmentId") REFERENCES "Appointment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExaminationRecord" ADD CONSTRAINT "ExaminationRecord_examinedById_fkey" FOREIGN KEY ("examinedById") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DentalChartEntry" ADD CONSTRAINT "DentalChartEntry_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DentalChartEntry" ADD CONSTRAINT "DentalChartEntry_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;
