import { beforeAll, describe, expect, it } from "vitest";
import { GET as countPatients } from "@/app/api/patients/count/route";
import { GET as listPatients, POST as createPatient } from "@/app/api/patients/route";
import { DELETE as deletePatient, GET as getPatient, PATCH as patchPatient } from "@/app/api/patients/[id]/route";
import { prisma } from "@/lib/prisma";
import { call, createSession, patientInput, type TestUser } from "./helpers";

let admin: TestUser;
let receptionist: TestUser;

const create = (body: unknown, cookie = admin.cookie) => call(createPatient, "/api/patients", { method: "POST", body, cookie });

beforeAll(async () => {
  admin = await createSession("admin");
  receptionist = await createSession("receptionist");
});

describe("registration", () => {
  it("registers a patient with a unique sequential patient code", async () => {
    const first = await create(patientInput({ name: "Rahim Uddin", email: "rahim@example.test", dateOfBirth: "1990-04-12", allergies: "Penicillin" }));
    const second = await create(patientInput());
    expect(first.status).toBe(201);
    expect(first.json.patient.patientCode).toMatch(/^PID-\d{5}$/);
    expect(second.json.patient.patientCode).not.toBe(first.json.patient.patientCode);
    expect(Number(second.json.patient.patientCode.slice(4))).toBeGreaterThan(Number(first.json.patient.patientCode.slice(4)));
    expect(first.json.patient.allergies).toBe("Penicillin");
    expect(first.json.patient.isActive).toBe(true);
  });

  it("never issues the same code twice under concurrent registration", async () => {
    const results = await Promise.all(Array.from({ length: 12 }, () => create(patientInput())));
    expect(results.every((result) => result.status === 201)).toBe(true);
    const codes = results.map((result) => result.json.patient.patientCode as string);
    expect(new Set(codes).size).toBe(codes.length);
  });

  it("treats blank optional fields as empty", async () => {
    const { status, json } = await create(patientInput({ email: "", address: "", dateOfBirth: "" }));
    expect(status).toBe(201);
    expect(json.patient.email).toBeNull();
    expect(json.patient.address).toBeNull();
    expect(json.patient.dateOfBirth).toBeNull();
  });

  it("rejects invalid input", async () => {
    const invalid: unknown[] = [
      { phone: "01700000000" },
      patientInput({ name: "   " }),
      patientInput({ phone: "1" }),
      patientInput({ email: "not-an-email" }),
      patientInput({ dateOfBirth: "12/04/1990" }),
      patientInput({ name: "x".repeat(121) }),
      "just a string",
      null,
    ];
    for (const body of invalid) expect((await create(body)).status, JSON.stringify(body)).toBe(400);
  });

  it("names the invalid fields so the form can mark them", async () => {
    const { status, json } = await create(patientInput({ name: "A", phone: "12", email: "nope", dateOfBirth: "2999-01-01" }));
    expect(status).toBe(400);
    expect(Object.keys(json.fieldErrors).sort()).toEqual(["dateOfBirth", "email", "name", "phone"]);
    expect(json.error).toBe(json.fieldErrors.name);
    // The same checks apply when editing.
    const patient = (await create(patientInput())).json.patient;
    const edit = await call(patchPatient, `/api/patients/${patient.id}`, { method: "PATCH", body: patientInput({ phone: "0171" }), cookie: admin.cookie, params: { id: patient.id } });
    expect(edit.status).toBe(400);
    expect(edit.json.fieldErrors.phone).toBeTruthy();
  });

  it("refuses to register the same name and phone twice", async () => {
    const input = patientInput({ name: "Twin Check" });
    expect((await create(input)).status).toBe(201);
    const again = await create({ ...input, name: "  twin check " });
    expect(again.status).toBe(409);
    expect(again.json.error).toMatch(/already registered/);
    expect(again.json.existingPatientCode).toMatch(/^PID-/);
    // Family members sharing a phone number are different people.
    expect((await create({ ...input, name: "Twin Sibling" })).status).toBe(201);
  });

  it("trims text and stores blank optional fields as null", async () => {
    const { json } = await create(patientInput({ name: "  Padded Name  ", notes: "   ", emergencyContactName: "" }));
    expect(json.patient.name).toBe("Padded Name");
    expect(json.patient.notes).toBeNull();
    expect(json.patient.emergencyContactName).toBeNull();
  });

  it("rejects a body that is not JSON", async () => {
    const response = await createPatient(new Request("http://localhost:3000/api/patients", {
      method: "POST",
      headers: { cookie: admin.cookie },
      body: "{oops",
    }));
    expect(response.status).toBe(400);
  });
});

describe("profile, search and counts", () => {
  let patientId = "";

  beforeAll(async () => {
    const { json } = await create(patientInput({ name: "Nusrat Jahan", phone: "01555123456", medicalHistory: "Diabetic (type 2)", allergies: "Latex" }));
    patientId = json.patient.id;
    await prisma.appointment.create({
      data: { patientId, patientName: "Nusrat Jahan", patientPhone: "01555123456", service: "Scaling", dateTime: new Date("2026-01-10T04:00:00Z"), status: "COMPLETED" },
    });
  });

  it("returns the profile with medical alerts and visit history", async () => {
    const { status, json } = await call(getPatient, `/api/patients/${patientId}`, { cookie: receptionist.cookie, params: { id: patientId } });
    expect(status).toBe(200);
    expect(json.patient.allergies).toBe("Latex");
    expect(json.patient.medicalHistory).toBe("Diabetic (type 2)");
    expect(json.patient.appointmentCount).toBe(1);
    expect(json.patient.latestAppointment.service).toBe("Scaling");
  });

  it("sorts by name, and rejects an unknown sort", async () => {
    const byName = await call(listPatients, "/api/patients?sort=name&pageSize=100", { cookie: admin.cookie });
    const names = byName.json.patients.map((p: { name: string }) => p.name);
    expect(names.length).toBeGreaterThan(1);
    // Database collation can differ from JavaScript's, so only compare the two ends.
    expect(names[0].localeCompare(names[names.length - 1], "en", { sensitivity: "base" })).toBeLessThanOrEqual(0);
    expect((await call(listPatients, "/api/patients?sort=oldest", { cookie: admin.cookie })).status).toBe(400);
  });

  it("returns 404 for an unknown patient", async () => {
    expect((await call(getPatient, "/api/patients/nope", { cookie: admin.cookie, params: { id: "nope" } })).status).toBe(404);
  });

  it("finds patients by name, phone fragment and patient code", async () => {
    const byName = await call(listPatients, "/api/patients?search=nusrat", { cookie: admin.cookie });
    const byPhone = await call(listPatients, "/api/patients?search=555123", { cookie: admin.cookie });
    expect(byName.json.patients.map((p: { id: string }) => p.id)).toContain(patientId);
    expect(byPhone.json.patients.map((p: { id: string }) => p.id)).toContain(patientId);
    const code = byName.json.patients.find((p: { id: string }) => p.id === patientId).patientCode as string;
    const byCode = await call(listPatients, `/api/patients?search=${code}`, { cookie: admin.cookie });
    expect(byCode.json.patients.map((p: { id: string }) => p.id)).toContain(patientId);
  });

  it("paginates and validates paging parameters", async () => {
    const page = await call(listPatients, "/api/patients?page=1&pageSize=5", { cookie: admin.cookie });
    expect(page.status).toBe(200);
    expect(page.json.patients.length).toBeLessThanOrEqual(5);
    expect((await call(listPatients, "/api/patients?pageSize=100000", { cookie: admin.cookie })).status).toBe(400);
    expect((await call(listPatients, "/api/patients?page=0", { cookie: admin.cookie })).status).toBe(400);
  });

  it("counts patients", async () => {
    const { status, json } = await call(countPatients, "/api/patients/count", { cookie: admin.cookie });
    expect(status).toBe(200);
    expect(json.total).toBeGreaterThan(0);
  });
});

describe("updating, disabling and deleting", () => {
  it("updates details and records an audit event", async () => {
    const patient = (await create(patientInput({ name: "Before" }))).json.patient;
    const { status, json } = await call(patchPatient, `/api/patients/${patient.id}`, {
      method: "PATCH", cookie: receptionist.cookie, params: { id: patient.id },
      body: patientInput({ name: "After", phone: patient.phone }),
    });
    expect(status).toBe(200);
    expect(json.patient.name).toBe("After");
    const audit = await prisma.auditEvent.findFirst({ where: { entity: "Patient", entityId: patient.id, action: "UPDATE" } });
    expect(audit?.actorId).toBe(receptionist.id);
  });

  it("disables and re-enables a patient without deleting history", async () => {
    const patient = (await create(patientInput())).json.patient;
    const off = await call(patchPatient, `/api/patients/${patient.id}`, { method: "PATCH", cookie: admin.cookie, params: { id: patient.id }, body: { isActive: false } });
    expect(off.json.patient.isActive).toBe(false);
    const on = await call(patchPatient, `/api/patients/${patient.id}`, { method: "PATCH", cookie: admin.cookie, params: { id: patient.id }, body: { isActive: true } });
    expect(on.json.patient.isActive).toBe(true);
  });

  it("returns 404 when updating an unknown patient", async () => {
    const { status } = await call(patchPatient, "/api/patients/nope", { method: "PATCH", cookie: admin.cookie, params: { id: "nope" }, body: patientInput() });
    expect(status).toBe(404);
  });

  it("deletes a patient with no records, but only for administrators", async () => {
    const patient = (await create(patientInput())).json.patient;
    expect((await call(deletePatient, `/api/patients/${patient.id}`, { method: "DELETE", cookie: receptionist.cookie, params: { id: patient.id } })).status).toBe(403);
    expect((await call(deletePatient, `/api/patients/${patient.id}`, { method: "DELETE", cookie: admin.cookie, params: { id: patient.id } })).status).toBe(200);
    expect(await prisma.patient.findUnique({ where: { id: patient.id } })).toBeNull();
  });

  it("refuses to delete a patient who has lab orders, bookings or billing history", async () => {
    const withOrder = (await create(patientInput())).json.patient;
    await prisma.testOrder.create({ data: { orderCode: `ORD-DEL-${Date.now().toString(36)}`, patientId: withOrder.id } });
    const withBooking = (await create(patientInput())).json.patient;
    await prisma.appointment.create({ data: { patientId: withBooking.id, patientName: withBooking.name, patientPhone: withBooking.phone, service: "Check", dateTime: new Date(Date.now() + 86_400_000) } });
    const withInvoice = (await create(patientInput())).json.patient;
    await prisma.invoice.create({ data: { invoiceCode: `INV-T-DEL-${Date.now().toString(36)}`, patientId: withInvoice.id, subtotal: 100 } });

    for (const patient of [withOrder, withBooking, withInvoice]) {
      const result = await call(deletePatient, `/api/patients/${patient.id}`, { method: "DELETE", cookie: admin.cookie, params: { id: patient.id } });
      expect(result.status, patient.id).toBe(409);
      expect(await prisma.patient.findUnique({ where: { id: patient.id } })).not.toBeNull();
    }
  });

  it("still deletes a patient with no history at all", async () => {
    const fresh = (await create(patientInput())).json.patient;
    const result = await call(deletePatient, `/api/patients/${fresh.id}`, { method: "DELETE", cookie: admin.cookie, params: { id: fresh.id } });
    expect(result.status).toBe(200);
    expect(await prisma.patient.findUnique({ where: { id: fresh.id } })).toBeNull();
  });
});
