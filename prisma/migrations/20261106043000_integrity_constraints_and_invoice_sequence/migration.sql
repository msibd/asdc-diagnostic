-- Database-level integrity rules (defence in depth: the API already validates these).
--
-- Constraints are added NOT VALID so this migration is safe on a database that already holds data:
-- PostgreSQL enforces them for every new or changed row immediately, without scanning old rows.
-- To also verify historical rows, run once (it fails, listing the constraint, if a row violates it):
--   ALTER TABLE "<table>" VALIDATE CONSTRAINT "<constraint>";

-- Money and quantities
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_amounts_nonnegative_chk" CHECK ("subtotal" >= 0 AND "discount" >= 0 AND "tax" >= 0) NOT VALID;
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_discount_within_total_chk" CHECK ("discount" <= "subtotal" + "tax") NOT VALID;
ALTER TABLE "InvoiceItem" ADD CONSTRAINT "InvoiceItem_values_chk" CHECK ("quantity" > 0 AND "unitPrice" >= 0 AND "amount" >= 0) NOT VALID;
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_amount_positive_chk" CHECK ("amount" > 0) NOT VALID;
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_amount_positive_chk" CHECK ("amount" > 0) NOT VALID;
ALTER TABLE "ClinicService" ADD CONSTRAINT "ClinicService_values_chk" CHECK ("standardPrice" >= 0 AND "durationMinutes" > 0) NOT VALID;
ALTER TABLE "TreatmentPlan" ADD CONSTRAINT "TreatmentPlan_estimatedCost_chk" CHECK ("estimatedCost" >= 0) NOT VALID;
ALTER TABLE "DoctorProfile" ADD CONSTRAINT "DoctorProfile_consultationFee_chk" CHECK ("consultationFee" >= 0) NOT VALID;

-- Scheduling
ALTER TABLE "Appointment" ADD CONSTRAINT "Appointment_duration_positive_chk" CHECK ("durationMinutes" > 0) NOT VALID;
ALTER TABLE "DoctorSchedule" ADD CONSTRAINT "DoctorSchedule_dayOfWeek_chk" CHECK ("dayOfWeek" BETWEEN 0 AND 6) NOT VALID;

-- Other domain rules
ALTER TABLE "ClinicReview" ADD CONSTRAINT "ClinicReview_rating_chk" CHECK ("rating" BETWEEN 1 AND 5) NOT VALID;
-- FDI two-digit tooth numbers: permanent 11-48, primary 51-85.
ALTER TABLE "DentalChartEntry" ADD CONSTRAINT "DentalChartEntry_toothNumber_chk" CHECK ("toothNumber" ~ '^([1-4][1-8]|[5-8][1-5])$') NOT VALID;
ALTER TABLE "user" ADD CONSTRAINT "user_role_chk" CHECK ("role" IN ('admin', 'receptionist', 'user')) NOT VALID;

-- Invoice numbers come from a sequence (like patient codes) instead of a slice of the row id, so two
-- invoices can never be given the same number. Existing invoice codes are left untouched.
CREATE SEQUENCE IF NOT EXISTS "invoice_code_seq" START WITH 1 INCREMENT BY 1 MINVALUE 1;
