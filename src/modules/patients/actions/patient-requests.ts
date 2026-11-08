import type { PatientFieldErrors } from "@/modules/patients/schemas/patient-rules";

/** A failed patient request. `fieldErrors` is set when the server named the fields that were wrong. */
export class PatientRequestError extends Error {
  constructor(message: string, readonly status: number, readonly fieldErrors?: PatientFieldErrors) {
    super(message);
    this.name = "PatientRequestError";
  }
}

type ResponseBody = { error?: string; fieldErrors?: PatientFieldErrors } & Record<string, unknown>;

function parseBody(text: string): ResponseBody | null {
  try {
    return JSON.parse(text) as ResponseBody;
  } catch {
    return null;
  }
}

/** Reads a JSON response and throws a PatientRequestError with the server's message on failure. */
export async function readPatientResponse<T = Record<string, unknown>>(response: Response): Promise<T> {
  const text = await response.text();
  const result = text ? parseBody(text) : null;
  if (!response.ok) {
    throw new PatientRequestError(result?.error ?? `Patient request failed (HTTP ${response.status}).`, response.status, result?.fieldErrors);
  }
  if (!result) throw new PatientRequestError("The server returned an invalid response. Please try again.", response.status);
  return result as T;
}
