import { NextResponse } from "next/server";
import { z } from "zod";
import { authorize } from "@/lib/admin-session";
import { apiError, parseQuery } from "@/lib/api";
import { addClinicDays, getClinicDateKey } from "@/lib/clinic-date";
import { prisma } from "@/lib/prisma";

const querySchema = z.object({ days: z.coerce.number().int().min(1).max(14).default(2) });

// Appointments coming up in the next few days, so the front desk can call or message the patients.
// Contact details only: no notes or clinical information.
export async function GET(request: Request) {
  const access = await authorize(request.headers, "appointments:read");
  if (!access.session) return apiError(access.error, access.status);
  const query = parseQuery(request, querySchema);
  if (!query.ok) return query.response;

  const now = new Date();
  const today = getClinicDateKey(now);
  const end = new Date(`${addClinicDays(today, query.data.days + 1)}T00:00:00+06:00`);
  const appointments = await prisma.appointment.findMany({
    where: { status: { in: ["PENDING", "CONFIRMED"] }, dateTime: { gte: now, lt: end } },
    select: { id: true, patientName: true, patientPhone: true, service: true, dateTime: true, status: true },
    orderBy: { dateTime: "asc" },
    take: 200,
  });
  return NextResponse.json({
    range: { from: today, days: query.data.days },
    reminders: appointments.map((appointment) => ({ ...appointment, dateTime: appointment.dateTime.toISOString() })),
  });
}
