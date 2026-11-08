import type {
  AppointmentRecord,
  AppointmentStatusValue,
  CreateAppointmentInput,
} from "@/modules/appointments/schemas/appointment-schema";
import type { AppointmentFieldErrors } from "@/modules/appointments/schemas/appointment-rules";
import type { ApiErrorResponse } from "@/types/api";

type AppointmentResponse = ApiErrorResponse & {
  appointment?: AppointmentRecord;
  error?: string;
  fieldErrors?: AppointmentFieldErrors;
};

/** A 400 from the server that says which form fields were wrong, so the form can mark them. */
export class AppointmentValidationError extends Error {
  constructor(message: string, readonly fieldErrors: AppointmentFieldErrors) {
    super(message);
    this.name = "AppointmentValidationError";
  }
}

async function readResponse(response: Response): Promise<AppointmentResponse> {
  const result = (await response.json()) as AppointmentResponse;
  if (!response.ok) {
    if (result.fieldErrors && Object.keys(result.fieldErrors).length) {
      throw new AppointmentValidationError(result.error ?? "Please check the highlighted fields.", result.fieldErrors);
    }
    throw new Error(result.error ?? "Appointment request failed.");
  }
  return result;
}

export async function createAppointmentRequest(
  input: Omit<CreateAppointmentInput, "dateTime"> & { dateTime: string },
) {
  const result = await readResponse(
    await fetch("/api/appointments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    }),
  );
  if (!result.appointment) {
    throw new Error("The server did not return the created appointment.");
  }
  return result.appointment;
}

export async function updateAppointmentStatusRequest(
  id: string,
  status: AppointmentStatusValue,
) {
  const result = await readResponse(
    await fetch(`/api/appointments/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    }),
  );
  if (!result.appointment) {
    throw new Error("The server did not return the updated appointment.");
  }
  return result.appointment;
}

export async function updateAppointmentRequest(
  id: string,
  input: Omit<CreateAppointmentInput, "dateTime"> & { dateTime: string },
) {
  const result = await readResponse(
    await fetch(`/api/appointments/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    }),
  );
  if (!result.appointment) {
    throw new Error("The server did not return the updated appointment.");
  }
  return result.appointment;
}

export async function deleteAppointmentRequest(id: string) {
  await readResponse(
    await fetch(`/api/appointments/${id}`, {
      method: "DELETE",
    }),
  );
}
