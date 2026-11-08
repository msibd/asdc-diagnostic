import { NextResponse } from "next/server";
import { z } from "zod";
import { apiError, parseQuery } from "@/lib/api";
import { addClinicDays, getClinicDateKey } from "@/lib/clinic-date";
import { listBusyTimes } from "@/modules/appointments/services/appointment-service";

const querySchema = z.object({ date: z.iso.date() });

// Which times are already taken on a day, so the booking form can grey them out. Start and end
// times only: never who booked or for what. Always fresh: it changes with every booking.
export async function GET(request: Request) {
  const query = parseQuery(request, querySchema, "Choose a valid date.");
  if (!query.ok) return query.response;
  const today = getClinicDateKey(new Date());
  if (query.data.date < today || query.data.date > addClinicDays(today, 365)) return apiError("Choose a date from today up to a year ahead.", 400);
  return NextResponse.json({ date: query.data.date, busy: await listBusyTimes(query.data.date) }, { headers: { "Cache-Control": "no-store" } });
}
