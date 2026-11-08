INSERT INTO "DoctorSchedule" ("id", "doctorId", "dayOfWeek", "startTime", "endTime", "isWorking")
VALUES
    ('clinic-hours-primary-0', 'primary', 0, '17:00', '21:00', true),
    ('clinic-hours-primary-1', 'primary', 1, '17:00', '21:00', true),
    ('clinic-hours-primary-2', 'primary', 2, '17:00', '21:00', true),
    ('clinic-hours-primary-3', 'primary', 3, '17:00', '21:00', true),
    ('clinic-hours-primary-4', 'primary', 4, '16:00', '20:00', true),
    ('clinic-hours-primary-5', 'primary', 5, '00:00', '00:00', false),
    ('clinic-hours-primary-6', 'primary', 6, '17:00', '21:00', true)
ON CONFLICT ("doctorId", "dayOfWeek") DO NOTHING;
