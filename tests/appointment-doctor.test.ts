import { beforeAll, describe, expect, it } from "vitest";
import { POST as createAppointment } from "@/app/api/appointments/route";
import { prisma } from "@/lib/prisma";
import { renderAppointmentSms } from "@/modules/sms/sms-service";
import { smsSettingsSchema } from "@/modules/sms/sms-schema";
import { call, clinicTime, createSession, ensureDoctorSchedule, type TestUser } from "./helpers";

let admin: TestUser;
const run = Date.now().toString(36);
let counter = 0;
const book = (overrides: Record<string, unknown> = {}) =>
  call(createAppointment, "/api/appointments", {
    method: "POST",
    cookie: admin.cookie,
    body: {
      patientName: `Doctor Test ${run}`,
      patientPhone: `0188${String(2_000_000 + Math.floor(Math.random() * 7_000_000))}`,
      service: "Check-up",
      dateTime: clinicTime(30 + (counter += 1), "11:00"),
      ...overrides,
    },
  });

async function makeDoctor(overrides: Record<string, unknown> = {}) {
  return prisma.doctorProfile.create({
    data: { id: `appt-doc-${run}-${(counter += 1)}`, slug: `appt-doc-${run}-${counter}`, name: `Dr Appointment ${run}${counter}`, specialization: "Pathology", ...overrides },
  });
}

beforeAll(async () => {
  admin = await createSession("admin");
  await ensureDoctorSchedule();
});

describe("an appointment is with a doctor", () => {
  it("records the chosen doctor, and the main doctor when none is chosen", async () => {
    const doctor = await makeDoctor();
    const chosen = await book({ doctorId: doctor.id });
    expect(chosen.status).toBe(201);
    expect(chosen.json.appointment.doctorId).toBe(doctor.id);

    const unchosen = await book();
    expect(unchosen.status).toBe(201);
    expect(unchosen.json.appointment.doctorId).toBe("primary");

    const walkIn = await book({ walkIn: true });
    expect(walkIn.json.appointment.doctorId).toBe("primary");
  });

  it("refuses an unknown or inactive doctor", async () => {
    const inactive = await makeDoctor({ isActive: false });
    for (const doctorId of [inactive.id, "no-such-doctor"]) {
      const result = await book({ doctorId });
      expect(result.status, doctorId).toBe(409);
      expect(result.json.error).toMatch(/active doctor/i);
    }
  });

  it("keeps the appointment when its doctor is deleted", async () => {
    const doctor = await makeDoctor();
    const made = await book({ doctorId: doctor.id });
    await prisma.doctorProfile.delete({ where: { id: doctor.id } });
    expect((await prisma.appointment.findUniqueOrThrow({ where: { id: made.json.appointment.id } })).doctorId).toBeNull();
  });
});

describe("the booking SMS names the doctor", () => {
  const when = new Date("2026-11-07T11:30:00Z");
  const base = { name: "Rahim", dateTime: when, clinic: "Ash-Shifa" };

  it("fills {doctor}, and adds the doctor to a saved message that has no {doctor}", () => {
    expect(renderAppointmentSms("{clinic}: {name}, দেখা হবে {doctor} এর সাথে।", { ...base, doctor: "Dr Ovi" })).toBe("Ash-Shifa: Rahim, দেখা হবে Dr Ovi এর সাথে।");
    const old = renderAppointmentSms("{clinic}: {name}, {date} {time}।", { ...base, doctor: "Dr Ovi" });
    expect(old).toMatch(/ডাক্তার: Dr Ovi।$/);
    expect(old).not.toContain("{");
  });

  it("is unchanged when there is no doctor", () => {
    const text = renderAppointmentSms("{clinic}: {name}, {date} {time}।", base);
    expect(text).toBe(renderAppointmentSms("{clinic}: {name}, {date} {time}।", { ...base, doctor: null }));
    expect(text).not.toContain("ডাক্তার");
    expect(renderAppointmentSms("a {doctor} b", base)).toBe("a  b");
  });

  it("accepts {doctor} in the SMS settings template", () => {
    const template = smsSettingsSchema.shape.appointmentTemplate;
    expect(template.safeParse("{clinic}: {name}, {doctor}, {date} {time}").success).toBe(true);
    expect(template.safeParse("{clinic}: {nope}").success).toBe(false);
  });
});
