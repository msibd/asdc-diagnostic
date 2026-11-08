-- pg_trgm powers GIN indexes for case-insensitive substring (ILIKE %term%) search.
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- CreateIndex
CREATE INDEX "Appointment_patientName_trgm_idx" ON "Appointment" USING GIN ("patientName" gin_trgm_ops);

-- CreateIndex
CREATE INDEX "Appointment_patientPhone_trgm_idx" ON "Appointment" USING GIN ("patientPhone" gin_trgm_ops);

-- CreateIndex
CREATE INDEX "Appointment_service_trgm_idx" ON "Appointment" USING GIN ("service" gin_trgm_ops);

-- CreateIndex
CREATE INDEX "Appointment_id_trgm_idx" ON "Appointment" USING GIN ("id" gin_trgm_ops);

-- CreateIndex
CREATE INDEX "Patient_name_trgm_idx" ON "Patient" USING GIN ("name" gin_trgm_ops);

-- CreateIndex
CREATE INDEX "Patient_phone_trgm_idx" ON "Patient" USING GIN ("phone" gin_trgm_ops);

-- CreateIndex
CREATE INDEX "Patient_patientCode_trgm_idx" ON "Patient" USING GIN ("patientCode" gin_trgm_ops);

-- CreateIndex
CREATE INDEX "Patient_email_trgm_idx" ON "Patient" USING GIN ("email" gin_trgm_ops);

