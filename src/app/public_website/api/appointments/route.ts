import { NextResponse } from "next/server";
import { runAfterResponse } from "@/lib/background";
import { prisma } from "@/lib/prisma";
import { notifyAppointmentBooked } from "@/modules/sms/sms-service";
import { enforcePublicRateLimit, publicRateLimits } from "@/lib/rate-limit";
import { parseCreateAppointment } from "@/modules/appointments/schemas/appointment-schema";
import { AppointmentConflictError, createAppointment } from "@/modules/appointments/services/appointment-service";

export async function POST(request: Request) {
  const limited = await enforcePublicRateLimit(request, publicRateLimits.booking);
  if (limited) return limited;

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400 });
  }

  const phone = typeof payload === "object" && payload !== null && "patientPhone" in payload
    ? payload.patientPhone
    : undefined;
  const phoneDigits = typeof phone === "string" ? phone.replace(/\D/g, "") : "";
  if (phoneDigits.length < 7 || phoneDigits.length > 15) {
    return NextResponse.json({ error: "Please provide a valid phone number." }, { status: 400 });
  }

  const parsed = parseCreateAppointment(payload);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error, fieldErrors: parsed.fieldErrors }, { status: 400 });
  }
  const source = parsed.data.source ?? "DIRECT";
  if (source !== "DIRECT" && source !== "WHATSAPP") {
    return NextResponse.json({ error: "Select a valid booking channel." }, { status: 400 });
  }

  const [service, schedules] = await Promise.all([
    prisma.clinicService.findFirst({
      where: { name: parsed.data.service, isActive: true },
      select: { id: true },
    }),
    prisma.doctorSchedule.findMany({
      where: { doctorId: "primary" },
      select: { id: true },
      take: 1,
    }),
  ]);
  if (!service) {
    return NextResponse.json({ error: "This service is not currently available." }, { status: 400 });
  }
  if (!schedules.length) {
    return NextResponse.json({ error: "Online booking is unavailable until clinic hours are configured." }, { status: 503 });
  }

  try {
    // A visitor cannot link the booking to a patient record: only staff can (that would let anyone
    // attach visits to, or read the name of, a registered patient).
    const appointment = await createAppointment({ ...parsed.data, patientId: null, source }, { fromWebsite: true });
    // Confirmation SMS to the number given, sent after this response so booking stays fast.
    runAfterResponse(() => notifyAppointmentBooked(appointment));
    return NextResponse.json({
      appointment: {
        id: appointment.id,
        patientName: appointment.patientName,
        service: appointment.service,
        dateTime: appointment.dateTime,
        status: appointment.status,
        source: appointment.source,
      },
    }, { status: 201 });
  } catch (error) {
    if (error instanceof AppointmentConflictError) {
      // `code` lets the booking form say it in the visitor's language.
      return NextResponse.json({ error: error.message, code: error.code }, { status: 409 });
    }
    throw error;
  }
}
