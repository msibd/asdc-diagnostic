CREATE OR REPLACE FUNCTION notify_clinic_change()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  PERFORM pg_notify(
    'clinic_changes',
    json_build_object('table', TG_TABLE_NAME, 'operation', TG_OP)::text
  );
  RETURN NULL;
END;
$$;

DO $$
DECLARE
  table_name TEXT;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'Patient',
    'Appointment',
    'DoctorProfile',
    'DoctorSchedule',
    'ClinicService',
    'TreatmentPlan',
    'TreatmentSession',
    'Prescription',
    'PrescriptionMedication',
    'Invoice',
    'InvoiceItem',
    'Payment',
    'AuditEvent',
    'session'
  ]
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
