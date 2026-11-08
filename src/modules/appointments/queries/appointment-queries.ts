import type { AppointmentSource, AppointmentStatus, Prisma } from "@/generated/prisma/client";
import { addClinicDays } from "@/lib/clinic-date";
import { prisma } from "@/lib/prisma";

export async function listAppointments(cursor?: string) {
  const [appointments, totalCount] = await prisma.$transaction([
    prisma.appointment.findMany({
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      orderBy: [{ dateTime: "desc" }, { id: "desc" }],
      take: 101,
    }),
    prisma.appointment.count(),
  ]);
  const hasMore = appointments.length > 100;
  const page = hasMore ? appointments.slice(0, 100) : appointments;

  return {
    appointments: page,
    totalCount,
    nextCursor: hasMore ? page.at(-1)?.id ?? null : null,
  };
}

// Case-insensitive substring search across the fields shown in the dashboard search box.
export async function searchAppointments(search: string) {
  const contains = { contains: search, mode: "insensitive" as const };
  const appointments = await prisma.appointment.findMany({
    where: { OR: [{ patientName: contains }, { patientPhone: contains }, { service: contains }, { id: contains }] },
    orderBy: [{ dateTime: "desc" }, { id: "desc" }],
    take: 5,
  });
  return { appointments, totalCount: appointments.length, nextCursor: null };
}

export const BOOKINGS_PAGE_SIZE = 10;

export type BookingsFilters = {
  /** Text typed in the search box: name, phone, e-mail or service. */
  q?: string;
  status?: AppointmentStatus;
  service?: string;
  source?: AppointmentSource;
  /** Clinic calendar days (YYYY-MM-DD), both ends included. */
  from?: string;
  to?: string;
};

function bookingsWhere({ q, status, service, source, from, to }: BookingsFilters): Prisma.AppointmentWhereInput {
  const contains = (value: string) => ({ contains: value, mode: "insensitive" as const });
  return {
    ...(status ? { status } : {}),
    ...(service ? { service } : {}),
    ...(source ? { source } : {}),
    // Days are the clinic's (Dhaka, UTC+6), the same way the rest of the dashboard reads them.
    ...(from || to ? {
      dateTime: {
        ...(from ? { gte: new Date(`${from}T00:00:00+06:00`) } : {}),
        ...(to ? { lt: new Date(`${addClinicDays(to, 1)}T00:00:00+06:00`) } : {}),
      },
    } : {}),
    ...(q ? { OR: [{ patientName: contains(q) }, { patientPhone: contains(q) }, { patientEmail: contains(q) }, { service: contains(q) }] } : {}),
  };
}

/**
 * One page of bookings that match the filters, newest first. The count and the page come from the
 * same filter, and a page number past the end is moved back to the last page (for example after the
 * last booking on a page was deleted).
 */
export async function listAppointmentsPage(filters: BookingsFilters, page: number, pageSize = BOOKINGS_PAGE_SIZE) {
  const where = bookingsWhere(filters);
  const total = await prisma.appointment.count({ where });
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const current = Math.min(Math.max(1, page), pageCount);
  const appointments = await prisma.appointment.findMany({
    where,
    orderBy: [{ dateTime: "desc" }, { id: "desc" }],
    skip: (current - 1) * pageSize,
    take: pageSize,
  });
  return { appointments, total, page: current, pageSize, pageCount };
}
