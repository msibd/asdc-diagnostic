CREATE SEQUENCE "patient_code_seq" START WITH 10001;

WITH numbered_patients AS (
    SELECT
        "id",
        ROW_NUMBER() OVER (ORDER BY "createdAt" ASC, "id" ASC) AS row_number
    FROM "Patient"
)
UPDATE "Patient" AS patient
SET "patientCode" = 'PID-' || LPAD((10000 + numbered_patients.row_number)::text, 5, '0')
FROM numbered_patients
WHERE patient."id" = numbered_patients."id";

SELECT setval(
    '"patient_code_seq"',
    COALESCE(MAX(substring("patientCode" FROM 5)::bigint), 10000),
    true
)
FROM "Patient";
