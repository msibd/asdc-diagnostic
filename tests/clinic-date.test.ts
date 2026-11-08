import { describe, expect, it } from "vitest";
import {
  addClinicDays, formatClinicDate, formatClinicDateTime, formatClinicTime, formatClinicWeekday, formatDay, getClinicDateKey, getClinicMonthKey,
} from "@/lib/clinic-date";

// The previous implementation (Intl), kept here as the reference the date-fns version must match.
const intl = (options: Intl.DateTimeFormatOptions, value: Date) => new Intl.DateTimeFormat("en", options).format(value);
const reference = {
  date: (value: Date) => intl({ day: "numeric", month: "short", timeZone: "Asia/Dhaka", year: "numeric" }, value),
  time: (value: Date) => intl({ hour: "numeric", minute: "2-digit", timeZone: "Asia/Dhaka" }, value),
  key: (value: Date) => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Dhaka" }).format(value),
};

// Instants around the clinic's midnight (UTC+6), month and year ends, and a leap day.
const instants = [
  "2026-11-06T17:59:59Z", "2026-11-06T18:00:00Z", "2026-11-06T19:05:00Z", "2026-12-31T18:30:00Z",
  "2027-01-01T00:00:00Z", "2028-02-28T18:00:00Z", "2026-03-29T01:00:00Z", "2026-06-15T11:30:00Z",
].map((value) => new Date(value));

describe("clinic dates (date-fns, Asia/Dhaka)", () => {
  it("matches the previous formatting for every instant", () => {
    for (const instant of instants) {
      expect(getClinicDateKey(instant), instant.toISOString()).toBe(reference.key(instant));
      expect(formatClinicDate(instant), instant.toISOString()).toBe(reference.date(instant));
      expect(formatClinicTime(instant), instant.toISOString()).toBe(reference.time(instant));
    }
  });

  it("puts an instant on the clinic's day, not the server's", () => {
    expect(getClinicDateKey("2026-11-06T17:59:59Z")).toBe("2026-11-06");
    expect(getClinicDateKey("2026-11-06T18:00:00Z")).toBe("2026-11-07"); // midnight in Dhaka
    expect(getClinicMonthKey("2026-11-30T18:00:00Z")).toBe("2026-12");
  });

  it("does calendar arithmetic across months, years and leap days", () => {
    expect(addClinicDays("2026-11-30", 1)).toBe("2026-12-01");
    expect(addClinicDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(addClinicDays("2028-02-28", 1)).toBe("2028-02-29");
    expect(addClinicDays("2026-03-01", -1)).toBe("2026-02-28");
    expect(addClinicDays("2026-11-07", 0)).toBe("2026-11-07");
  });

  it("formats weekdays, plain days and date-times", () => {
    expect(formatClinicWeekday("2026-11-07")).toBe("Sat");
    expect(formatDay("2026-11-07")).toBe("7 Nov 2026");
    expect(formatDay("2026-11-07T00:00:00.000Z")).toBe("7 Nov 2026");
    expect(formatClinicDateTime("2026-11-07T11:30:00Z")).toBe("Nov 7, 5:30 PM");
  });
});
