import { describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { updateAppointmentStatus } from "@/modules/appointments/services/appointment-service";
import { layoutOverridesSchema } from "@/modules/website/schemas/website-layout";

const run = Date.now().toString(36);
let counter = 0;
// A fresh mobile number per test so patients from other test files never collide.
const phone = () => `0199${String(Math.floor(Math.random() * 9_000_000) + 1_000_000)}`;
const confirmed = (data: { patientName: string; patientPhone: string; patientId?: string }) =>
  prisma.appointment.create({
    data: { service: "Check-up", dateTime: new Date(Date.now() + (2 + counter++) * 86_400_000), status: "CONFIRMED", ...data },
  });

describe("completing an appointment registers the patient", () => {
  it("creates a patient with the next patient ID and links the visit", async () => {
    const mobile = phone();
    const visit = await confirmed({ patientName: `Rony ${run}`, patientPhone: mobile });
    expect(visit.patientId).toBeNull();

    const done = await updateAppointmentStatus(visit.id, "COMPLETED");
    expect(done?.status).toBe("COMPLETED");
    expect(done?.patientId).toBeTruthy();
    const patient = await prisma.patient.findUniqueOrThrow({ where: { id: done!.patientId! } });
    expect(patient).toMatchObject({ name: `Rony ${run}`, phone: mobile, isActive: true });
    expect(patient.patientCode).toMatch(/^PID-\d{5,}$/);
  });

  it("reuses the same person even when the mobile is written another way", async () => {
    const mobile = phone();
    const first = await updateAppointmentStatus((await confirmed({ patientName: `Ayesha ${run}`, patientPhone: mobile })).id, "COMPLETED");
    const second = await updateAppointmentStatus((await confirmed({ patientName: `AYESHA ${run}`, patientPhone: `+88${mobile}` })).id, "COMPLETED");
    expect(second?.patientId).toBe(first?.patientId);
    expect(await prisma.patient.count({ where: { name: { equals: `Ayesha ${run}`, mode: "insensitive" } } })).toBe(1);
  });

  it("gives a different person on a shared number their own patient ID", async () => {
    const mobile = phone();
    const mother = await updateAppointmentStatus((await confirmed({ patientName: `Mother ${run}`, patientPhone: mobile })).id, "COMPLETED");
    const child = await updateAppointmentStatus((await confirmed({ patientName: `Child ${run}`, patientPhone: mobile })).id, "COMPLETED");
    expect(child?.patientId).not.toBe(mother?.patientId);
    const codes = await prisma.patient.findMany({ where: { id: { in: [mother!.patientId!, child!.patientId!] } }, select: { patientCode: true } });
    expect(new Set(codes.map((row) => row.patientCode)).size).toBe(2);
  });

  it("keeps a patient the staff already linked, and creates none for other statuses", async () => {
    const linked = await prisma.patient.create({ data: { name: `Linked ${run}`, phone: phone(), patientCode: `PID-T${run}${counter++}` } });
    const before = await prisma.patient.count();
    const visit = await confirmed({ patientName: linked.name, patientPhone: linked.phone, patientId: linked.id });
    expect((await updateAppointmentStatus(visit.id, "COMPLETED"))?.patientId).toBe(linked.id);

    const cancelled = await confirmed({ patientName: `Nobody ${run}`, patientPhone: phone() });
    expect((await updateAppointmentStatus(cancelled.id, "CANCELLED"))?.patientId).toBeNull();
    expect(await prisma.patient.count()).toBe(before);
  });
});

describe("WhatsApp number setting", () => {
  it("accepts a real number or empty, and rejects junk", () => {
    const ok = (value: string) => layoutOverridesSchema.safeParse({ whatsappNumber: value }).success;
    expect(ok("01712345678")).toBe(true);
    expect(ok("+880 1712-345678")).toBe(true);
    expect(ok("")).toBe(true);
    expect(ok("12345")).toBe(false);
    expect(ok("call me")).toBe(false);
  });
});
