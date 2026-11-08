-- CreateIndex
CREATE INDEX "AuditEvent_createdAt_idx" ON "AuditEvent"("createdAt" DESC);

-- CreateIndex
CREATE INDEX "Invoice_issuedAt_id_idx" ON "Invoice"("issuedAt" DESC, "id" DESC);

-- CreateIndex
CREATE INDEX "Patient_createdAt_id_idx" ON "Patient"("createdAt" DESC, "id");

-- CreateIndex
CREATE INDEX "Payment_status_receivedAt_idx" ON "Payment"("status", "receivedAt");

-- CreateIndex
CREATE INDEX "Prescription_createdAt_id_idx" ON "Prescription"("createdAt" DESC, "id" DESC);

-- CreateIndex
CREATE INDEX "TreatmentPlan_updatedAt_id_idx" ON "TreatmentPlan"("updatedAt" DESC, "id");

