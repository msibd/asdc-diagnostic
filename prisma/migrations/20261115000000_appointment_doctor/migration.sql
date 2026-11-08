-- Which doctor an appointment is with, so the booking SMS can name them. Optional, so every
-- existing appointment stays valid; deleting a doctor leaves their appointments without one.
ALTER TABLE "Appointment" ADD COLUMN "doctorId" TEXT;

-- CreateIndex
CREATE INDEX "Appointment_doctorId_dateTime_idx" ON "Appointment"("doctorId", "dateTime");

-- AddForeignKey
ALTER TABLE "Appointment" ADD CONSTRAINT "Appointment_doctorId_fkey" FOREIGN KEY ("doctorId") REFERENCES "DoctorProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;
