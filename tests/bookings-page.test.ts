import { beforeAll, describe, expect, it } from "vitest";
import { GET as listBookings } from "@/app/api/appointments/route";
import { prisma } from "@/lib/prisma";
import { call, createSession, type TestUser } from "./helpers";

// The Bookings table is read a page at a time (GET /api/appointments?page=N) with its search and
// filters applied by the database. The test files share one database, so every row here carries a
// service name of its own and each request narrows to it.

const SERVICE = `Pager check ${Date.now().toString(36)}`;
const OTHER_SERVICE = `${SERVICE} (other)`;
let admin: TestUser;

const DAY = 86_400_000;
const page = (query: Record<string, string | number>, cookie = admin.cookie) => {
  const params = new URLSearchParams({ service: SERVICE, ...Object.fromEntries(Object.entries(query).map(([key, value]) => [key, String(value)])) });
  return call(listBookings, `/api/appointments?${params}`, { cookie });
};

beforeAll(async () => {
  admin = await createSession("admin");
  const base = Date.UTC(2031, 0, 1, 4, 0, 0); // 10:00 in Dhaka, far from any other test's dates
  // 23 bookings, one a day: the first 5 are cancelled, the rest pending; every 4th came from WhatsApp.
  await prisma.appointment.createMany({
    data: Array.from({ length: 23 }, (_, index) => ({
      patientName: index === 7 ? "Zed Pagetest" : `Patient ${index}`,
      patientPhone: `0188${String(1000 + index).padStart(7, "0")}`,
      service: SERVICE,
      dateTime: new Date(base + index * DAY),
      status: index < 5 ? "CANCELLED" as const : "PENDING" as const,
      source: index % 4 === 0 ? "WHATSAPP" as const : "DIRECT" as const,
    })),
  });
  await prisma.appointment.create({ data: { patientName: "Someone Else", patientPhone: "01880009999", service: OTHER_SERVICE, dateTime: new Date(base) } });
});

describe("bookings, a page at a time", () => {
  it("returns ten rows a page with the total, newest first", async () => {
    const first = await page({ page: 1 });
    expect(first.status).toBe(200);
    expect(first.json).toMatchObject({ total: 23, page: 1, pageSize: 10, pageCount: 3 });
    expect(first.json.appointments).toHaveLength(10);
    const times = first.json.appointments.map((row: { dateTime: string }) => Date.parse(row.dateTime));
    expect(times).toEqual([...times].sort((a, b) => b - a));
    // The newest booking (day 22) leads page 1; page 2 continues where page 1 stopped.
    expect(first.json.appointments[0].patientName).toBe("Patient 22");
    const second = await page({ page: 2 });
    expect(second.json.appointments).toHaveLength(10);
    expect(second.json.appointments[0].patientName).toBe("Patient 12");
    const third = await page({ page: 3 });
    expect(third.json.appointments).toHaveLength(3);
    // No row appears on two pages.
    const ids = [first, second, third].flatMap((result) => result.json.appointments.map((row: { id: string }) => row.id));
    expect(new Set(ids).size).toBe(23);
  });

  it("moves a page number past the end back to the last page", async () => {
    const result = await page({ page: 9 });
    expect(result.status).toBe(200);
    expect(result.json.page).toBe(3);
    expect(result.json.appointments).toHaveLength(3);
  });

  it("counts and pages only the rows that match the filters", async () => {
    const pending = await page({ page: 1, status: "PENDING" });
    expect(pending.json).toMatchObject({ total: 18, pageCount: 2 });
    expect(pending.json.appointments.every((row: { status: string }) => row.status === "PENDING")).toBe(true);

    const whatsapp = await page({ page: 1, source: "WHATSAPP" });
    expect(whatsapp.json.total).toBe(6); // days 0, 4, 8, 12, 16, 20

    const both = await page({ page: 1, status: "PENDING", source: "WHATSAPP" });
    expect(both.json.total).toBe(4); // days 8, 12, 16 and 20: days 0 and 4 are cancelled

    const none = await page({ page: 1, status: "COMPLETED" });
    expect(none.json).toMatchObject({ total: 0, page: 1, pageCount: 1, appointments: [] });
  });

  it("searches name, phone and service on the server", async () => {
    expect((await page({ page: 1, q: "zed page" })).json.total).toBe(1);
    expect((await page({ page: 1, q: "ZED" })).json.appointments[0].patientName).toBe("Zed Pagetest");
    expect((await page({ page: 1, q: "0001005" })).json.total).toBe(1); // the phone of patient 5 is 01880001005
    expect((await page({ page: 1, q: "nobody-has-this-name" })).json.total).toBe(0);
  });

  it("limits to a range of clinic days, both ends included", async () => {
    // Days 2 to 4 of January 2031.
    const range = await page({ page: 1, from: "2031-01-03", to: "2031-01-05" });
    expect(range.json.total).toBe(3);
    expect(await page({ page: 1, from: "2031-01-23" }).then((result) => result.json.total)).toBe(1);
    expect(await page({ page: 1, to: "2031-01-01" }).then((result) => result.json.total)).toBe(1);
  });

  it("keeps the other service out of this list and answers bad input with 400", async () => {
    const other = await call(listBookings, `/api/appointments?page=1&service=${encodeURIComponent(OTHER_SERVICE)}`, { cookie: admin.cookie });
    expect(other.json.total).toBe(1);
    const badQueries: Record<string, string | number>[] = [{ page: 0 }, { page: "abc" }, { page: 1, status: "NOT_A_STATUS" }, { page: 1, source: "FAX" }, { page: 1, from: "07-11-2026" }];
    for (const query of badQueries) {
      expect((await page(query)).status, JSON.stringify(query)).toBe(400);
    }
  });

  it("is closed to visitors and to staff without access to bookings", async () => {
    expect((await call(listBookings, "/api/appointments?page=1")).status).toBe(401);
    const doctor = await createSession("doctor"); // no appointments:read
    expect((await page({ page: 1 }, doctor.cookie)).status).toBe(403);
  });

  it("leaves the old cursor list and the quick search as they were", async () => {
    const cursorList = await call(listBookings, "/api/appointments", { cookie: admin.cookie });
    expect(cursorList.status).toBe(200);
    expect(cursorList.json).toHaveProperty("nextCursor");
    const quick = await call(listBookings, "/api/appointments?search=Zed%20Pagetest", { cookie: admin.cookie });
    expect(quick.json.appointments.length).toBeGreaterThan(0);
    expect(quick.json.appointments.length).toBeLessThanOrEqual(5);
  });
});
