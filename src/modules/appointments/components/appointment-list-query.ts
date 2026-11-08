"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import type { QueryMeta } from "@/components/shared/query-provider";
import { requestJson } from "@/modules/clinic/components/clinic-types";
import type { AppointmentRecord } from "@/modules/appointments/schemas/appointment-schema";

// The Bookings table, one server page at a time. The page number and every filter are part of the
// query key, so each page of each search is cached on its own, and going back to a page already
// seen shows it at once. Every key starts with "bookings": one invalidation after a change
// (and the live "Appointment" table events) refreshes whichever page is on screen.

/** "ALL" or an empty string means "no filter" for that field. */
export type BookingsFilters = { q: string; status: string; service: string; source: string; from: string; to: string };

export type BookingsPage = { appointments: AppointmentRecord[]; total: number; page: number; pageSize: number; pageCount: number };

export const bookingKeys = {
  all: ["bookings"] as const,
  list: (filters: BookingsFilters, page: number) => ["bookings", "list", filters, page] as const,
};

const TABLES: QueryMeta = { tables: ["Appointment"] };

export function useBookingsPage(filters: BookingsFilters, page: number) {
  return useQuery({
    queryKey: bookingKeys.list(filters, page),
    queryFn: async ({ signal }) => {
      const params = new URLSearchParams({ page: String(page) });
      for (const [key, value] of Object.entries(filters)) if (value && value !== "ALL") params.set(key, value);
      return requestJson<BookingsPage>(await fetch(`/api/appointments?${params}`, { cache: "no-store", signal }));
    },
    // While the next page (or a new search) loads, keep showing the current rows instead of a blank table.
    placeholderData: keepPreviousData,
    meta: TABLES,
  });
}
