-- CreateEnum
CREATE TYPE "CatalogItemKind" AS ENUM ('SERVICE', 'TEST', 'PANEL');

-- CreateEnum
CREATE TYPE "ReferenceSex" AS ENUM ('ANY', 'MALE', 'FEMALE');

-- AlterTable
ALTER TABLE "ClinicService" ADD COLUMN     "fastingRequired" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "kind" "CatalogItemKind" NOT NULL DEFAULT 'SERVICE',
ADD COLUMN     "preparation" TEXT,
ADD COLUMN     "sampleType" TEXT,
ADD COLUMN     "turnaroundHours" INTEGER;

-- CreateTable
CREATE TABLE "TestParameter" (
    "id" TEXT NOT NULL,
    "testId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "unit" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "TestParameter_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TestReferenceRange" (
    "id" TEXT NOT NULL,
    "parameterId" TEXT NOT NULL,
    "sex" "ReferenceSex" NOT NULL DEFAULT 'ANY',
    "minAgeYears" DECIMAL(6,2),
    "maxAgeYears" DECIMAL(6,2),
    "low" DECIMAL(14,4),
    "high" DECIMAL(14,4),
    "criticalLow" DECIMAL(14,4),
    "criticalHigh" DECIMAL(14,4),
    "note" TEXT,

    CONSTRAINT "TestReferenceRange_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TestPanelItem" (
    "panelId" TEXT NOT NULL,
    "testId" TEXT NOT NULL,

    CONSTRAINT "TestPanelItem_pkey" PRIMARY KEY ("panelId","testId")
);

-- CreateIndex
CREATE INDEX "TestParameter_testId_sortOrder_idx" ON "TestParameter"("testId", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "TestParameter_testId_name_key" ON "TestParameter"("testId", "name");

-- CreateIndex
CREATE INDEX "TestReferenceRange_parameterId_idx" ON "TestReferenceRange"("parameterId");

-- CreateIndex
CREATE INDEX "TestPanelItem_testId_idx" ON "TestPanelItem"("testId");

-- CreateIndex
CREATE INDEX "ClinicService_kind_isActive_idx" ON "ClinicService"("kind", "isActive");

-- AddForeignKey
ALTER TABLE "TestParameter" ADD CONSTRAINT "TestParameter_testId_fkey" FOREIGN KEY ("testId") REFERENCES "ClinicService"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TestReferenceRange" ADD CONSTRAINT "TestReferenceRange_parameterId_fkey" FOREIGN KEY ("parameterId") REFERENCES "TestParameter"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TestPanelItem" ADD CONSTRAINT "TestPanelItem_panelId_fkey" FOREIGN KEY ("panelId") REFERENCES "ClinicService"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TestPanelItem" ADD CONSTRAINT "TestPanelItem_testId_fkey" FOREIGN KEY ("testId") REFERENCES "ClinicService"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
