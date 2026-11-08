import { beforeAll, describe, expect, it } from "vitest";
import { GET as listInvoices } from "@/app/api/billing/route";
import { prisma } from "@/lib/prisma";
import { ageLabel, takaInWords } from "@/lib/format";
import { call, createSession, type TestUser } from "./helpers";

describe("amount in words", () => {
  it("writes taka the way the paper invoice does", () => {
    expect(takaInWords(780)).toBe("seven hundred eighty Tk. Only");
    expect(takaInWords(840)).toBe("eight hundred forty Tk. Only");
    expect(takaInWords(1000)).toBe("one thousand Tk. Only");
    expect(takaInWords(125_000)).toBe("one lakh twenty five thousand Tk. Only");
    expect(takaInWords(12_345_678)).toBe("one crore twenty three lakh forty five thousand six hundred seventy eight Tk. Only");
    expect(takaInWords(12.5)).toBe("twelve Tk. and fifty paisa Only");
    expect(takaInWords(0)).toBe("zero Tk. Only");
  });
});

describe("age on the invoice date", () => {
  it("counts years, months and days", () => {
    expect(ageLabel("2026-10-16", "2026-11-01T06:00:00Z")).toBe("00Y 00M 16D");
    expect(ageLabel("1990-03-31", "2026-11-07T06:00:00Z")).toBe("36Y 07M 07D");
    expect(ageLabel("2000-12-31", "2026-01-01T06:00:00Z")).toBe("25Y 00M 01D");
  });
});

describe("invoice list carries what the printed invoice needs", () => {
  let admin: TestUser;
  beforeAll(async () => { admin = await createSession("admin"); });

  it("returns age data, sex, test codes, turnaround and the letterhead", async () => {
    const run = Date.now().toString(36);
    const patient = await prisma.patient.create({
      data: { name: `Era ${run}`, phone: `01836${Math.floor(Math.random() * 900000 + 100000)}`, patientCode: `PID-P${run}`, dateOfBirth: new Date("2026-10-16T00:00:00Z"), sex: "FEMALE" },
    });
    const service = await prisma.clinicService.create({ data: { code: `BIL${run}`, name: `S. Bilirubin ${run}`, standardPrice: 300, turnaroundHours: 6 } });
    const invoice = await prisma.invoice.create({
      data: {
        invoiceCode: `INV-P${run}`, patientId: patient.id, subtotal: 300, notes: "Walk-in",
        items: { create: [{ serviceId: service.id, description: service.name, unitPrice: 300, amount: 300 }] },
      },
    });

    const { status, json } = await call(listInvoices, `/api/billing?search=${invoice.invoiceCode}`, { cookie: admin.cookie });
    expect(status).toBe(200);
    expect(json.clinic).toMatchObject({ clinicName: expect.any(String) });
    expect(json.clinic.clinicName.length).toBeGreaterThan(0);
    const found = json.invoices.find((row: { invoiceCode: string }) => row.invoiceCode === invoice.invoiceCode);
    expect(found.patient).toMatchObject({ patientCode: `PID-P${run}`, dateOfBirth: "2026-10-16", sex: "FEMALE" });
    expect(found.items[0]).toMatchObject({ code: `BIL${run}`, turnaroundHours: 6, amount: "300" });
    expect(found.notes).toBe("Walk-in");
    expect(found.referredBy).toBeNull();
    // The relation objects used to build these fields are not leaked.
    expect(found.testOrder).toBeUndefined();
    expect(found.items[0].service).toBeUndefined();
  });
});
