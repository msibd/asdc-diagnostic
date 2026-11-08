import { beforeAll, describe, expect, it } from "vitest";
import { POST as createAppointment, GET as listAppointments } from "@/app/api/appointments/route";
import { DELETE as deleteAppointment, PATCH as patchAppointment } from "@/app/api/appointments/[id]/route";
import { POST as publicBooking } from "@/app/public_website/api/appointments/route";
import { GET as availability } from "@/app/public_website/api/availability/route";
import { prisma } from "@/lib/prisma";
import { call, clinicTime, createSession, ensureDoctorSchedule, patientInput, type TestUser } from "./helpers";
import { POST as createPatient } from "@/app/api/patients/route";

let admin: TestUser;
let receptionist: TestUser;

// Each booking is a different person (own phone number) unless a test says otherwise: one person
// cannot hold two bookings for the same service on the same day.
let phoneSequence = 0;
const booking = (overrides: Record<string, unknown> = {}) => ({
  patientName: "Walk In",
  patientPhone: `0171${String((phoneSequence += 1)).padStart(7, "0")}`,
  service: "Scaling",
  dateTime: clinicTime(10, "10:00"),
  ...overrides,
});

async function create(body: Record<string, unknown>, cookie = admin.cookie) {
  return call(createAppointment, "/api/appointments", { method: "POST", body, cookie });
}
const setStatus = (id: string, status: string, cookie = admin.cookie) =>
  call(patchAppointment, `/api/appointments/${id}`, { method: "PATCH", body: { status }, cookie, params: { id } });

beforeAll(async () => {
  admin = await createSession("admin");
  receptionist = await createSession("receptionist");
  await ensureDoctorSchedule();
  await prisma.clinicService.create({ data: { code: "SCALE", name: "Scaling", standardPrice: 1500, durationMinutes: 60 } });
});

describe("creating appointments", () => {
  it("creates a pending appointment using the service's duration", async () => {
    const { status, json } = await create(booking({ dateTime: clinicTime(10, "10:00") }));
    expect(status).toBe(201);
    expect(json.appointment.status).toBe("PENDING");
    expect(json.appointment.durationMinutes).toBe(60);
    expect(json.appointment.source).toBe("ADMIN");
  });

  it("lets the receptionist book", async () => {
    const { status } = await create(booking({ dateTime: clinicTime(11, "10:00") }), receptionist.cookie);
    expect(status).toBe(201);
  });

  it("links an existing active patient and takes their contact details", async () => {
    const patient = (await call(createPatient, "/api/patients", { method: "POST", body: patientInput({ phone: "01899000111" }), cookie: admin.cookie })).json.patient;
    const { status, json } = await create({ patientId: patient.id, service: "Scaling", dateTime: clinicTime(12, "10:00") });
    expect(status).toBe(201);
    expect(json.appointment.patientId).toBe(patient.id);
    expect(json.appointment.patientPhone).toBe("01899000111");
  });

  it("rejects a disabled patient", async () => {
    const patient = await prisma.patient.create({ data: { patientCode: "PID-TEST-OFF", name: "Inactive", phone: "01000000000", isActive: false } });
    const { status, json } = await create({ patientId: patient.id, service: "Scaling", dateTime: clinicTime(12, "12:00") });
    expect(status).toBe(409);
    expect(json.error).toMatch(/active patient/i);
  });

  it("lets staff book at any time, even outside the doctor's hours or on a closed day", async () => {
    expect((await create(booking({ dateTime: clinicTime(13, "08:00") }))).status).toBe(201);
    // 16:30 + 60 minutes runs past the 17:00 closing time.
    expect((await create(booking({ dateTime: clinicTime(13, "16:30") }))).status).toBe(201);
    const target = new Date(clinicTime(14, "10:00"));
    const weekday = new Date(target.getTime() + 6 * 3600_000).getUTCDay();
    await prisma.doctorSchedule.update({ where: { doctorId_dayOfWeek: { doctorId: "primary", dayOfWeek: weekday } }, data: { isWorking: false } });
    const closedDay = await create(booking({ dateTime: target.toISOString() }));
    await prisma.doctorSchedule.update({ where: { doctorId_dayOfWeek: { doctorId: "primary", dayOfWeek: weekday } }, data: { isWorking: true } });
    expect(closedDay.status).toBe(201);
  });

  it("still holds website requests to the doctor's hours and working days", async () => {
    const web = (dateTime: string, ip: string) =>
      call(publicBooking, "/public_website/api/appointments", { method: "POST", body: booking({ dateTime }), headers: { "x-forwarded-for": ip } });
    expect((await web(clinicTime(15, "08:00"), "198.19.0.1")).status).toBe(409);
    expect((await web(clinicTime(15, "16:30"), "198.19.0.2")).status).toBe(409);
    expect((await web(clinicTime(15, "10:00"), "198.19.0.3")).status).toBe(201);
  });

  it("rejects invalid input", async () => {
    const cases: Record<string, unknown>[] = [
      booking({ patientName: "" }),
      booking({ patientPhone: "" }),
      booking({ service: "" }),
      booking({ dateTime: "tomorrow" }),
      booking({ dateTime: "2030-01-01T10:00:00" }),
      booking({ dateTime: new Date(Date.now() - 86_400_000).toISOString() }),
      booking({ patientEmail: "not-an-email" }),
      booking({ source: "FAX" }),
    ];
    for (const body of cases) expect((await create(body)).status, JSON.stringify(body)).toBe(400);
  });

  it("names the invalid fields so the form can mark them", async () => {
    const { status, json } = await create(booking({ patientName: "A", patientPhone: "12", patientEmail: "nope" }));
    expect(status).toBe(400);
    expect(json.fieldErrors).toMatchObject({
      patientName: expect.stringMatching(/at least 2/),
      patientPhone: expect.any(String),
      patientEmail: expect.stringMatching(/valid email/),
    });
    expect(json.error).toBe(json.fieldErrors.patientName);
  });

  it("rejects a body that is not JSON", async () => {
    const request = new Request("http://localhost:3000/api/appointments", {
      method: "POST",
      headers: { cookie: admin.cookie, "content-type": "application/json" },
      body: "{not json",
    });
    const response = await createAppointment(request);
    expect(response.status).toBe(400);
  });
});

describe("appointment conflicts", () => {
  it("prevents two confirmed appointments from overlapping", async () => {
    const first = (await create(booking({ dateTime: clinicTime(20, "10:00"), patientName: "Alice" }))).json.appointment;
    const overlapping = (await create(booking({ dateTime: clinicTime(20, "10:30"), patientName: "Patient B" }))).json.appointment;
    expect((await setStatus(first.id, "CONFIRMED")).status).toBe(200);

    const blocked = await setStatus(overlapping.id, "CONFIRMED");
    expect(blocked.status).toBe(409);
    expect(blocked.json.error).toMatch(/overlaps a confirmed appointment/);
    expect((await prisma.appointment.findUniqueOrThrow({ where: { id: overlapping.id } })).status).toBe("PENDING");
  });

  it("allows back-to-back appointments that only touch at the boundary", async () => {
    const first = (await create(booking({ dateTime: clinicTime(21, "10:00"), patientName: "Patient C" }))).json.appointment;
    const next = (await create(booking({ dateTime: clinicTime(21, "11:00"), patientName: "Patient D" }))).json.appointment;
    expect((await setStatus(first.id, "CONFIRMED")).status).toBe(200);
    expect((await setStatus(next.id, "CONFIRMED")).status).toBe(200);
  });

  it("frees the slot when a confirmed appointment is cancelled", async () => {
    const first = (await create(booking({ dateTime: clinicTime(22, "10:00"), patientName: "Patient E" }))).json.appointment;
    const second = (await create(booking({ dateTime: clinicTime(22, "10:15"), patientName: "Patient F" }))).json.appointment;
    await setStatus(first.id, "CONFIRMED");
    expect((await setStatus(second.id, "CONFIRMED")).status).toBe(409);
    expect((await setStatus(first.id, "CANCELLED")).status).toBe(200);
    expect((await setStatus(second.id, "CONFIRMED")).status).toBe(200);
  });

  it("lets only one of many simultaneous confirmations of the same slot succeed", async () => {
    const day = 23;
    const ids = await Promise.all(
      [0, 1, 2, 3, 4].map(async (n) => (await create(booking({ dateTime: clinicTime(day, "10:00"), patientName: `Racer ${n}` }))).json.appointment.id as string),
    );
    const results = await Promise.all(ids.map((id) => setStatus(id, "CONFIRMED")));
    expect(results.filter((result) => result.status === 200)).toHaveLength(1);
    expect(results.filter((result) => result.status === 409)).toHaveLength(4);
  });
});

describe("status workflow", () => {
  it("follows pending -> confirmed -> completed", async () => {
    const appointment = (await create(booking({ dateTime: clinicTime(30, "10:00") }))).json.appointment;
    expect((await setStatus(appointment.id, "CONFIRMED")).status).toBe(200);
    expect((await setStatus(appointment.id, "COMPLETED")).status).toBe(200);
  });

  it("rejects transitions the workflow does not allow", async () => {
    const appointment = (await create(booking({ dateTime: clinicTime(31, "10:00") }))).json.appointment;
    // pending cannot jump straight to completed
    expect((await setStatus(appointment.id, "COMPLETED")).status).toBe(409);
    await setStatus(appointment.id, "CANCELLED");
    // cancelled is final
    const reopened = await setStatus(appointment.id, "CONFIRMED");
    expect(reopened.status).toBe(409);
    expect(reopened.json.error).toMatch(/cannot change an appointment from cancelled/i);
  });

  it("returns 404 for an unknown appointment", async () => {
    expect((await setStatus("does-not-exist", "CONFIRMED")).status).toBe(404);
  });
});

describe("rescheduling and history", () => {
  it("reschedules a pending appointment", async () => {
    const appointment = (await create(booking({ dateTime: clinicTime(40, "10:00") }))).json.appointment;
    const moved = await call(patchAppointment, `/api/appointments/${appointment.id}`, {
      method: "PATCH",
      body: booking({ dateTime: clinicTime(41, "14:00") }),
      cookie: admin.cookie,
      params: { id: appointment.id },
    });
    expect(moved.status).toBe(200);
    expect(new Date(moved.json.appointment.dateTime).toISOString()).toBe(clinicTime(41, "14:00"));
  });

  it("does not let completed or cancelled appointments be edited (history is preserved)", async () => {
    const done = (await create(booking({ dateTime: clinicTime(42, "10:00") }))).json.appointment;
    await setStatus(done.id, "CONFIRMED");
    await setStatus(done.id, "COMPLETED");
    const cancelled = (await create(booking({ dateTime: clinicTime(43, "10:00") }))).json.appointment;
    await setStatus(cancelled.id, "CANCELLED");

    for (const appointment of [done, cancelled]) {
      const edit = await call(patchAppointment, `/api/appointments/${appointment.id}`, {
        method: "PATCH",
        body: booking({ dateTime: clinicTime(50, "10:00") }),
        cookie: admin.cookie,
        params: { id: appointment.id },
      });
      expect(edit.status).toBe(409);
      expect(edit.json.error).toMatch(/cannot be edited/i);
    }
  });

  it("only allows deleting pending or cancelled requests, and only for administrators", async () => {
    const pending = (await create(booking({ dateTime: clinicTime(44, "10:00") }))).json.appointment;
    const confirmed = (await create(booking({ dateTime: clinicTime(45, "10:00") }))).json.appointment;
    await setStatus(confirmed.id, "CONFIRMED");

    const asReceptionist = await call(deleteAppointment, `/api/appointments/${pending.id}`, { method: "DELETE", cookie: receptionist.cookie, params: { id: pending.id } });
    expect(asReceptionist.status).toBe(403);
    expect((await call(deleteAppointment, `/api/appointments/${confirmed.id}`, { method: "DELETE", cookie: admin.cookie, params: { id: confirmed.id } })).status).toBe(409);
    expect((await call(deleteAppointment, `/api/appointments/${pending.id}`, { method: "DELETE", cookie: admin.cookie, params: { id: pending.id } })).status).toBe(200);
  });
});

describe("public booking", () => {
  const publicCall = (body: unknown, ip: string) =>
    publicBooking(new Request("http://localhost:3000/public_website/api/appointments", {
      method: "POST",
      headers: { "content-type": "application/json", "x-forwarded-for": ip },
      body: JSON.stringify(body),
    }));

  it("never lets a website visitor link a booking to a registered patient", async () => {
    const patient = await prisma.patient.create({ data: { patientCode: "PID-TEST-PRIV", name: "Private Person", phone: "01999000123", email: "private@example.test" } });
    const response = await publicCall(booking({ dateTime: clinicTime(62, "10:00"), patientName: "Someone Else", patientPhone: "01711000999", patientId: patient.id }), "203.0.113.40");
    expect(response.status).toBe(201);
    const body = await response.json() as { appointment: { id: string; patientName: string } };
    // The visitor's own details are kept; the patient's name is neither stored nor returned.
    expect(body.appointment.patientName).toBe("Someone Else");
    const saved = await prisma.appointment.findUniqueOrThrow({ where: { id: body.appointment.id } });
    expect(saved.patientId).toBeNull();
    expect(saved.patientPhone).toBe("01711000999");
  });

  it("accepts a website request, which is saved as a pending DIRECT appointment", async () => {
    const response = await publicCall(booking({ dateTime: clinicTime(60, "10:00"), patientName: "Web Visitor" }), "203.0.113.10");
    expect(response.status).toBe(201);
    const json = await response.json();
    expect(json.appointment.status).toBe("PENDING");
    expect(json.appointment.source).toBe("DIRECT");
  });

  it("will not let a visitor pick the ADMIN source or an inactive service", async () => {
    expect((await publicCall(booking({ source: "ADMIN" }), "203.0.113.11")).status).toBe(400);
    expect((await publicCall(booking({ service: "Does not exist" }), "203.0.113.11")).status).toBe(400);
  });

  it("rate-limits repeated requests from one address", async () => {
    const statuses: number[] = [];
    for (let attempt = 0; attempt < 7; attempt += 1) {
      statuses.push((await publicCall(booking({ dateTime: clinicTime(90 + attempt, "10:00") }), "203.0.113.99")).status);
    }
    expect(statuses.slice(0, 5).every((status) => status === 201)).toBe(true);
    expect(statuses.slice(5)).toEqual([429, 429]);
  });
});

describe("listing", () => {
  it("returns appointments to staff", async () => {
    const { status, json } = await call(listAppointments, "/api/appointments", { cookie: receptionist.cookie });
    expect(status).toBe(200);
    expect(Array.isArray(json.appointments)).toBe(true);
    expect(json.appointments.length).toBeGreaterThan(0);
  });
});

describe("walk-ins and no-shows", () => {
  it("adds a walk-in for right now, already confirmed, even when the time overlaps another visit", async () => {
    await prisma.clinicService.create({ data: { code: "QUICK", name: "Quick check", standardPrice: 100, durationMinutes: 5 } });
    // Open all day so the test does not depend on the time it runs.
    await prisma.doctorSchedule.updateMany({ where: { doctorId: "primary" }, data: { startTime: "00:00", endTime: "23:59" } });
    try {
      const first = await create({ patientName: "Walk In One", patientPhone: "01755000001", service: "Quick check", walkIn: true });
      expect(first.status).toBe(201);
      expect(first.json.appointment.source).toBe("WALK_IN");
      expect(first.json.appointment.status).toBe("CONFIRMED");
      expect(Math.abs(new Date(first.json.appointment.dateTime).getTime() - Date.now())).toBeLessThan(60_000);
      // A second walk-in at the same moment is allowed (only booked visits block each other).
      expect((await create({ patientName: "Walk In Two", patientPhone: "01755000002", service: "Quick check", walkIn: true })).status).toBe(201);
      // A walk-in still needs valid details.
      expect((await create({ patientName: "", patientPhone: "", service: "Quick check", walkIn: true })).status).toBe(400);
      // Ignores a client-supplied date: a walk-in is always now.
      const forced = await create({ patientName: "Walk In Three", patientPhone: "01755000003", service: "Quick check", walkIn: true, dateTime: clinicTime(30, "10:00") });
      expect(Math.abs(new Date(forced.json.appointment.dateTime).getTime() - Date.now())).toBeLessThan(60_000);
    } finally {
      await ensureDoctorSchedule();
    }
  });

  it("tracks no-shows and lets a mistaken one be undone", async () => {
    const appointment = (await create(booking({ dateTime: clinicTime(40, "10:00"), patientName: "Missed Visit" }))).json.appointment;
    const noShow = await setStatus(appointment.id, "NO_SHOW");
    expect(noShow.status).toBe(200);
    expect(noShow.json.appointment.status).toBe("NO_SHOW");
    // A missed visit is history: it cannot be edited or deleted, only rebooked as a new appointment.
    const edit = await call(patchAppointment, `/api/appointments/${appointment.id}`, { method: "PATCH", body: booking({ dateTime: clinicTime(41, "10:00") }), cookie: admin.cookie, params: { id: appointment.id } });
    expect(edit.status).toBe(409);
    expect((await call(deleteAppointment, `/api/appointments/${appointment.id}`, { method: "DELETE", cookie: admin.cookie, params: { id: appointment.id } })).status).toBe(409);
    expect((await setStatus(appointment.id, "COMPLETED")).status).toBe(409);
    expect((await setStatus(appointment.id, "CONFIRMED")).status).toBe(200);
  });

  it("does not let a completed visit become a no-show", async () => {
    const appointment = (await create(booking({ dateTime: clinicTime(42, "10:00"), patientName: "Came In" }))).json.appointment;
    await setStatus(appointment.id, "CONFIRMED");
    await setStatus(appointment.id, "COMPLETED");
    expect((await setStatus(appointment.id, "NO_SHOW")).status).toBe(409);
  });
});

describe("double bookings", () => {
  const web = (body: Record<string, unknown>, ip: string) =>
    call(publicBooking, "/public_website/api/appointments", { method: "POST", body, headers: { "x-forwarded-for": ip } });

  it("refuses the same person booking the same service, day and time twice, however the number is written", async () => {
    const first = await web(booking({ patientPhone: "01722333444", dateTime: clinicTime(100, "10:00") }), "198.18.0.1");
    expect(first.status).toBe(201);
    for (const phone of ["01722333444", "+880 1722-333444", "8801722333444"]) {
      const again = await web(booking({ patientPhone: phone, dateTime: clinicTime(100, "10:00") }), "198.18.0.2");
      expect(again.status, phone).toBe(409);
      expect(again.json.code).toBe("DUPLICATE_REQUEST");
    }
    // The same service later the same day is also a duplicate (it is the same visit asked twice).
    expect((await web(booking({ patientPhone: "01722333444", dateTime: clinicTime(100, "15:00") }), "198.18.0.3")).json.code).toBe("DUPLICATE_REQUEST");
    // Staff get the same protection.
    const staff = await create(booking({ patientPhone: "01722333444", dateTime: clinicTime(100, "16:00") }));
    expect(staff.status).toBe(409);
    expect(staff.json.error).toMatch(/already has a Scaling appointment/);
  });

  it("lets the same person book again on another day, or after cancelling", async () => {
    const first = await web(booking({ patientPhone: "01733444555", dateTime: clinicTime(101, "10:00") }), "198.18.0.4");
    expect((await web(booking({ patientPhone: "01733444555", dateTime: clinicTime(102, "10:00") }), "198.18.0.5")).status).toBe(201);
    expect((await setStatus(first.json.appointment.id, "CANCELLED")).status).toBe(200);
    expect((await web(booking({ patientPhone: "01733444555", dateTime: clinicTime(101, "12:00") }), "198.18.0.6")).status).toBe(201);
  });

  it("treats a time someone else requested on the website as taken", async () => {
    expect((await web(booking({ dateTime: clinicTime(103, "10:00") }), "198.18.0.7")).status).toBe(201);
    const clash = await web(booking({ dateTime: clinicTime(103, "10:30") }), "198.18.0.8"); // Scaling lasts 60 minutes
    expect(clash.status).toBe(409);
    expect(clash.json.code).toBe("SLOT_TAKEN");
    expect((await web(booking({ dateTime: clinicTime(103, "11:00") }), "198.18.0.9")).status).toBe(201);
  });

  it("lets only one of many identical requests sent at once through", async () => {
    const body = booking({ patientPhone: "01744555666", dateTime: clinicTime(104, "10:00") });
    const results = await Promise.all(Array.from({ length: 5 }, (_, index) => web(body, `198.18.1.${index}`)));
    expect(results.filter((result) => result.status === 201)).toHaveLength(1);
    expect(results.filter((result) => result.status === 409)).toHaveLength(4);
  });

  it("publishes taken times for the booking form, without names or services", async () => {
    await web(booking({ patientName: "Hidden Name", dateTime: clinicTime(105, "14:00") }), "198.18.0.10");
    const day = clinicTime(105, "14:00").slice(0, 10);
    const response = await call(availability, `/public_website/api/availability?date=${day}`);
    expect(response.status).toBe(200);
    expect(response.json.busy).toContainEqual({ start: "14:00", end: "15:00" });
    expect(JSON.stringify(response.json)).not.toMatch(/Hidden Name|Scaling|0171/);
    expect((await call(availability, "/public_website/api/availability?date=2020-01-01")).status).toBe(400);
    expect((await call(availability, "/public_website/api/availability?date=nope")).status).toBe(400);
  });
});
