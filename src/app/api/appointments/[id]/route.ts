import { NextResponse } from "next/server";
import { authorize } from "@/lib/admin-session";
import { writeAuditEvent } from "@/lib/audit";
import {
  parseAppointmentStatus,
  parseUpdateAppointment,
} from "@/modules/appointments/schemas/appointment-schema";
import {
  AppointmentConflictError,
  deleteAppointment,
  updateAppointment,
  updateAppointmentStatus,
} from "@/modules/appointments/services/appointment-service";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const access = await authorize(request.headers, "appointments:write");
  if (!access.session) return NextResponse.json({ error: access.error }, { status: access.status });

  const { id } = await params;
  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400 });
  }

  const status =
    payload && typeof payload === "object" && "status" in payload
      ? parseAppointmentStatus(payload.status)
      : null;
  if (status) {
    let appointment;
    try {
      appointment = await updateAppointmentStatus(id, status);
    } catch (error) {
      if (error instanceof AppointmentConflictError) {
        return NextResponse.json({ error: error.message }, { status: 409 });
      }
      throw error;
    }
    if (!appointment) {
      return NextResponse.json({ error: "Appointment not found." }, { status: 404 });
    }
    await writeAuditEvent(request, access.session.user.id, "UPDATE_STATUS", "Appointment", id, { status });
    return NextResponse.json({ appointment });
  }

  const parsed = parseUpdateAppointment(payload);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error, fieldErrors: parsed.fieldErrors }, { status: 400 });
  }

  let appointment;
  try {
    appointment = await updateAppointment(id, parsed.data);
  } catch (error) {
    if (error instanceof AppointmentConflictError) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    throw error;
  }
  if (!appointment) {
    return NextResponse.json({ error: "Appointment not found." }, { status: 404 });
  }

  await writeAuditEvent(request, access.session.user.id, "UPDATE", "Appointment", id);
  return NextResponse.json({ appointment });
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const access = await authorize(request.headers, "appointments:delete");
  if (!access.session) return NextResponse.json({ error: access.error }, { status: access.status });

  const { id } = await params;
  const deleted = await deleteAppointment(id);
  if (deleted === null) {
    return NextResponse.json({ error: "Appointment not found." }, { status: 404 });
  }
  if (!deleted) return NextResponse.json({ error: "Only pending or cancelled appointment requests can be deleted. Cancel confirmed or completed visits to preserve history." }, { status: 409 });

  await writeAuditEvent(request, access.session.user.id, "DELETE", "Appointment", id);
  return NextResponse.json({ success: true });
}
