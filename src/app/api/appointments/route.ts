import { NextResponse } from "next/server";
import { z } from "zod";
import { authorize } from "@/lib/admin-session";
import { runAfterResponse } from "@/lib/background";
import { notifyAppointmentBooked } from "@/modules/sms/sms-service";
import { writeAuditEvent } from "@/lib/audit";
import { AppointmentConflictError, createAppointment } from "@/modules/appointments/services/appointment-service";
import { listAppointments, listAppointmentsPage, searchAppointments } from "@/modules/appointments/queries/appointment-queries";
import { parseCreateAppointment } from "@/modules/appointments/schemas/appointment-schema";

const dayKey = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use a date like 2026-11-07.");
// The Bookings table: a page at a time, with its search and filters applied on the server.
const bookingsPageQuery = z.object({
  page: z.coerce.number().int().min(1).max(100_000),
  q: z.string().trim().max(100).optional(),
  status: z.enum(["PENDING", "CONFIRMED", "COMPLETED", "CANCELLED", "NO_SHOW"]).optional(),
  service: z.string().trim().max(200).optional(),
  source: z.enum(["DIRECT", "WHATSAPP", "ADMIN", "WALK_IN"]).optional(),
  from: dayKey.optional(),
  to: dayKey.optional(),
});

export async function GET(request: Request) {
  const access = await authorize(request.headers, "appointments:read");
  if (!access.session) return NextResponse.json({ error: access.error }, { status: access.status });

  const searchParams = new URL(request.url).searchParams;
  if (searchParams.has("page")) {
    const query = bookingsPageQuery.safeParse(Object.fromEntries(searchParams));
    if (!query.success) return NextResponse.json({ error: query.error.issues[0]?.message ?? "Invalid bookings filter." }, { status: 400 });
    const { page, q, status, service, source, from, to } = query.data;
    return NextResponse.json(await listAppointmentsPage({ q: q || undefined, status, service: service || undefined, source, from, to }, page));
  }
  const search = z.string().trim().min(1).max(100).safeParse(searchParams.get("search") ?? undefined);
  if (searchParams.has("search")) {
    if (!search.success) return NextResponse.json({ error: "Invalid appointment search." }, { status: 400 });
    return NextResponse.json(await searchAppointments(search.data));
  }

  const cursor = searchParams.get("cursor") ?? undefined;
  const parsed = z.string().min(1).max(100).safeParse(cursor);
  if (cursor !== undefined && !parsed.success) {
    return NextResponse.json({ error: "Invalid appointment cursor." }, { status: 400 });
  }

  try {
    return NextResponse.json(await listAppointments(parsed.success ? parsed.data : undefined));
  } catch (error) {
    if (typeof error === "object" && error !== null && "code" in error && error.code === "P2025") {
      return NextResponse.json({ error: "Appointment cursor was not found. Refresh the list and try again." }, { status: 400 });
    }
    throw error;
  }
}

export async function POST(request: Request) {
  const access = await authorize(request.headers, "appointments:write");
  if (!access.session) return NextResponse.json({ error: access.error }, { status: access.status });

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400 });
  }

  // A walk-in is a patient who arrives without a booking: it is placed at the current time and
  // starts confirmed, so the "future time" rule does not apply to it.
  const walkIn = typeof payload === "object" && payload !== null && "walkIn" in payload && payload.walkIn === true;
  if (walkIn) payload = { ...(payload as Record<string, unknown>), dateTime: new Date().toISOString() };
  const parsed = parseCreateAppointment(payload, walkIn ? Date.now() - 60_000 : undefined);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error, fieldErrors: parsed.fieldErrors }, { status: 400 });
  }

  let appointment;
  try {
    appointment = await createAppointment({ ...parsed.data, source: "ADMIN" }, { walkIn });
  } catch (error) {
    if (error instanceof AppointmentConflictError) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    throw error;
  }
  await writeAuditEvent(request, access.session.user.id, "CREATE", "Appointment", appointment.id);
  // Text the patient about every booking made here, walk-ins included (when SMS is turned on).
  const booked = appointment;
  runAfterResponse(() => notifyAppointmentBooked(booked));
  return NextResponse.json({ appointment }, { status: 201 });
}
