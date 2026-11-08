import { TZDate } from "@date-fns/tz";
import { addDays, format, parseISO } from "date-fns";

// The clinic's calendar. Every date the clinic talks about ("today", "7 Nov") is a day in
// Asia/Dhaka, whatever time zone the server or the visitor's device uses. Built on date-fns with
// @date-fns/tz, so formatting and day arithmetic are explicit about the zone.

export const CLINIC_TIME_ZONE = "Asia/Dhaka";

const inClinic = (value: string | Date) => new TZDate(value instanceof Date ? value.getTime() : new Date(value).getTime(), CLINIC_TIME_ZONE);

/** The clinic day of an instant, as "YYYY-MM-DD". */
export function getClinicDateKey(value: string | Date) {
  return format(inClinic(value), "yyyy-MM-dd");
}

/** The clinic month of an instant, as "YYYY-MM". */
export function getClinicMonthKey(value: string | Date) {
  return format(inClinic(value), "yyyy-MM");
}

/** Calendar arithmetic on a "YYYY-MM-DD" day (no time zone involved: a day is a day). */
export function addClinicDays(dateKey: string, days: number) {
  return format(addDays(parseISO(dateKey), days), "yyyy-MM-dd");
}

/** "Nov 7, 2026" */
export function formatClinicDate(value: string | Date) {
  return format(inClinic(value), "MMM d, yyyy");
}

/** "5:30 PM" */
export function formatClinicTime(value: string | Date) {
  return format(inClinic(value), "h:mm a");
}

/** "Nov 7, 5:30 PM": for activity lists and history tables. */
export function formatClinicDateTime(value: string | Date) {
  return format(inClinic(value), "MMM d, h:mm a");
}

/** "Sat" for a "YYYY-MM-DD" day. */
export function formatClinicWeekday(dateKey: string) {
  return format(parseISO(dateKey), "EEE");
}

/** "7 Nov 2026" for a plain calendar day such as an expiry or purchase date ("YYYY-MM-DD"). */
export function formatDay(dateKey: string) {
  return format(parseISO(dateKey.slice(0, 10)), "d MMM yyyy");
}
