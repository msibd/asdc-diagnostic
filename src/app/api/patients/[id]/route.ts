import { NextResponse } from "next/server";
import { authorize } from "@/lib/admin-session";
import { writeAuditEvent } from "@/lib/audit";
import { patientFieldErrors, patientInputSchema } from "@/modules/patients/schemas/patient-schema";
import { z } from "zod";
import {
  deletePatient,
  getPatientProfile,
  updatePatient,
  updatePatientActiveStatus,
} from "@/modules/patients/services/patient-service";

const patientStatusSchema = z.object({ isActive: z.boolean() }).strict();

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const access = await authorize(request.headers, "patients:read");
  if (!access.session) return NextResponse.json({ error: access.error }, { status: access.status });

  const { id } = await params;
  const patient = await getPatientProfile(id);
  if (!patient) {
    return NextResponse.json({ error: "Patient not found." }, { status: 404 });
  }
  return NextResponse.json({ patient });
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const access = await authorize(request.headers, "patients:write");
  if (!access.session) return NextResponse.json({ error: access.error }, { status: access.status });

  const { id } = await params;
  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400 });
  }

  const parsedStatus = patientStatusSchema.safeParse(payload);
  if (parsedStatus.success) {
    const patient = await updatePatientActiveStatus(id, parsedStatus.data.isActive);
    if (!patient) {
      return NextResponse.json({ error: "Patient not found." }, { status: 404 });
    }
    await writeAuditEvent(request, access.session.user.id, parsedStatus.data.isActive ? "ENABLE" : "DISABLE", "Patient", id);
    return NextResponse.json({ patient });
  }

  const parsed = patientInputSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json({
      error: parsed.error.issues[0]?.message ?? "Invalid patient details.",
      fieldErrors: patientFieldErrors(parsed.error),
    }, { status: 400 });
  }

  const patient = await updatePatient(id, parsed.data);
  if (!patient) {
    return NextResponse.json({ error: "Patient not found." }, { status: 404 });
  }
  await writeAuditEvent(request, access.session.user.id, "UPDATE", "Patient", id);
  return NextResponse.json({ patient });
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const access = await authorize(request.headers, "patients:delete");
  if (!access.session) return NextResponse.json({ error: access.error }, { status: access.status });

  const { id } = await params;
  try {
    const result = await deletePatient(id);
    if (!result) {
      return NextResponse.json({ error: "Patient not found." }, { status: 404 });
    }
    if (!result.deleted) {
      return NextResponse.json({
        error: "This patient has bookings, lab orders or invoices and cannot be deleted. Disable the record to keep its history.",
        ...result,
      }, { status: 409 });
    }
    await writeAuditEvent(request, access.session.user.id, "DELETE", "Patient", id);
    return NextResponse.json({ success: true });
  } catch (error) {
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === "P2003"
    ) {
      return NextResponse.json({
        error: "This patient has linked records and cannot be deleted. Disable the record to keep its history.",
      }, { status: 409 });
    }
    throw error;
  }
}
