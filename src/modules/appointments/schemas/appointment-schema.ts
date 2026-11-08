import { AppointmentSource, AppointmentStatus } from "@/generated/prisma/client";
import {
  firstFieldError,
  validateAppointmentFields,
  type AppointmentFieldErrors,
} from "@/modules/appointments/schemas/appointment-rules";

export type AppointmentRecord = {
  id: string;
  patientId: string | null;
  patientName: string;
  patientPhone: string;
  patientEmail: string | null;
  service: string;
  doctorId: string | null;
  dateTime: string;
  createdAt: string;
  status: AppointmentStatus;
  source: AppointmentSource;
  notes: string | null;
};

export type AppointmentStatusValue = AppointmentStatus;

export type CreateAppointmentInput = {
  patientId: string | null;
  patientName: string;
  patientPhone: string;
  patientEmail: string | null;
  service: string;
  dateTime: Date;
  notes: string | null;
  source?: AppointmentSource;
  /** The doctor the visit is with; empty means the clinic's main doctor. */
  doctorId?: string | null;
};

export type ValidationResult<T> =
  | { success: true; data: T }
  | { success: false; error: string; fieldErrors?: AppointmentFieldErrors };

function parseAppointmentInput(
  payload: unknown,
  rejectPastDateTime: boolean,
  now: number,
): ValidationResult<CreateAppointmentInput> {
  if (!payload || typeof payload !== "object") {
    return { success: false, error: "Appointment details are required." };
  }

  const data = payload as Record<string, unknown>;
  const patientId = typeof data.patientId === "string" ? data.patientId.trim() : "";
  const patientName = typeof data.patientName === "string" ? data.patientName.trim() : "";
  const patientPhone = typeof data.patientPhone === "string" ? data.patientPhone.trim() : "";
  const patientEmail = typeof data.patientEmail === "string" ? data.patientEmail.trim() : "";
  const service = typeof data.service === "string" ? data.service.trim() : "";
  const notes = typeof data.notes === "string" ? data.notes.trim() : "";
  const doctorId = typeof data.doctorId === "string" ? data.doctorId.trim() : "";
  const dateTimeValue = typeof data.dateTime === "string" ? data.dateTime : "";
  const dateTime = new Date(dateTimeValue);
  const source = data.source;
  const parsedSource = typeof source === "string"
    ? Object.values(AppointmentSource).find((value) => value === source)
    : undefined;

  // Same rules the browser form runs; the server repeats them because it cannot trust the client.
  const fieldErrors = validateAppointmentFields(
    { patientId, patientName, patientPhone, patientEmail, service, dateTime: Number.isFinite(dateTime.getTime()) ? dateTime.toISOString() : "", notes },
    { rejectPast: rejectPastDateTime, now },
  );
  // The instant must carry an explicit offset (Z or +06:00); a bare local time is ambiguous.
  if (!fieldErrors.dateTime && !/(?:[zZ]|[+-]\d{2}:\d{2})$/.test(dateTimeValue)) {
    fieldErrors.dateTime = "Send the date and time with a timezone offset.";
  }
  if (Object.keys(fieldErrors).length) {
    return { success: false, error: firstFieldError(fieldErrors) ?? "Please provide valid appointment details.", fieldErrors };
  }

  if (patientId.length > 100 || doctorId.length > 100 || (source !== undefined && !parsedSource)) {
    return { success: false, error: "Please provide valid appointment details." };
  }

  return {
    success: true,
    data: {
      patientId: patientId || null,
      patientName,
      patientPhone,
      patientEmail: patientEmail || null,
      service,
      dateTime,
      notes: notes || null,
      doctorId: doctorId || null,
      ...(parsedSource ? { source: parsedSource } : {}),
    },
  };
}

export function parseCreateAppointment(
  payload: unknown,
  now = Date.now(),
): ValidationResult<CreateAppointmentInput> {
  return parseAppointmentInput(payload, true, now);
}

export function parseUpdateAppointment(
  payload: unknown,
): ValidationResult<CreateAppointmentInput> {
  return parseAppointmentInput(payload, false, Date.now());
}

export function parseAppointmentStatus(value: unknown): AppointmentStatus | null {
  if (
    typeof value === "string" &&
    Object.values(AppointmentStatus).some((status) => status === value)
  ) {
    return value as AppointmentStatus;
  }

  return null;
}
