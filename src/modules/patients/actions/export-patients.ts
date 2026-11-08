import { csvCell } from "@/lib/csv";
import type { PatientListRecord } from "@/modules/patients/schemas/patient-schema";

export { csvCell };

export function patientsToCsv(patients: PatientListRecord[]) {
  const rows = [
    ["Patient ID", "Patient", "Phone", "Email", "Status", "Appointments", "Last appointment"],
    ...patients.map((patient) => [
      patient.patientCode,
      patient.name,
      patient.phone,
      patient.email ?? "",
      patient.isActive ? "Active" : "Inactive",
      String(patient.appointmentCount),
      patient.latestAppointment?.dateTime ?? "",
    ]),
  ];
  // The byte-order mark makes Excel read the file as UTF-8, so Bangla names are not garbled.
  return `\uFEFF${rows.map((row) => row.map(csvCell).join(",")).join("\r\n")}`;
}

export function exportPatientsCsv(patients: PatientListRecord[]) {
  const url = URL.createObjectURL(new Blob([patientsToCsv(patients)], { type: "text/csv;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = `clinic-patients-${new Date().toISOString().slice(0, 10)}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}
