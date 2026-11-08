CREATE TYPE "AppointmentSource" AS ENUM ('DIRECT', 'WHATSAPP', 'ADMIN');

ALTER TABLE "Appointment"
ADD COLUMN "source" "AppointmentSource" NOT NULL DEFAULT 'DIRECT';

CREATE INDEX "Appointment_source_dateTime_idx" ON "Appointment"("source", "dateTime");
