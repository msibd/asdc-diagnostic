import { NextResponse } from "next/server";
import { z } from "zod";
import { authorize } from "@/lib/admin-session";
import { writeAuditEvent } from "@/lib/audit";
import { patientFieldErrors, patientInputSchema } from "@/modules/patients/schemas/patient-schema";
import {
  createPatient,
  DuplicatePatientError,
  getPatientChoices,
  getPatientDirectory,
} from "@/modules/patients/services/patient-service";

const patientListParamsSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().trim().max(120).default(""),
  status: z.enum(["ALL", "ACTIVE", "INACTIVE"]).default("ALL"),
  sort: z.enum(["newest", "name"]).default("newest"),
  fields: z.enum(["full", "picker"]).default("full"),
});

export async function GET(request: Request) {
  const access = await authorize(request.headers, "patients:read");
  if (!access.session) return NextResponse.json({ error: access.error }, { status: access.status });

  const searchParams = new URL(request.url).searchParams;
  const parsed = patientListParamsSchema.safeParse({
    page: searchParams.get("page") ?? undefined,
    pageSize: searchParams.get("pageSize") ?? undefined,
    search: searchParams.get("search") ?? undefined,
    status: searchParams.get("status") ?? undefined,
    sort: searchParams.get("sort") ?? undefined,
    fields: searchParams.get("fields") ?? undefined,
  });
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid patient search or pagination parameters." }, { status: 400 });
  }

  const { fields, ...options } = parsed.data;
  const result = fields === "picker"
    ? await getPatientChoices(options)
    : await getPatientDirectory(options);
  return NextResponse.json(result);
}

export async function POST(request: Request) {
  const access = await authorize(request.headers, "patients:write");
  if (!access.session) return NextResponse.json({ error: access.error }, { status: access.status });

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400 });
  }

  const parsed = patientInputSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json({
      error: parsed.error.issues[0]?.message ?? "Invalid patient details.",
      fieldErrors: patientFieldErrors(parsed.error),
    }, { status: 400 });
  }

  let patient;
  try {
    patient = await createPatient(parsed.data);
  } catch (error) {
    if (error instanceof DuplicatePatientError) {
      return NextResponse.json({ error: error.message, existingPatientCode: error.existingPatientCode }, { status: 409 });
    }
    throw error;
  }
  await writeAuditEvent(request, access.session.user.id, "CREATE", "Patient", patient.id);
  return NextResponse.json({ patient }, { status: 201 });
}
