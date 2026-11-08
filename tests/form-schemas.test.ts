import { describe, expect, it } from "vitest";
import { emptyInvoiceForm, invoiceFormSchema, invoiceInputSchema } from "@/modules/billing/billing-schema";
import { emptyPurchaseLine, purchaseFormSchema } from "@/modules/inventory/inventory-schema";
import { patientFormSchema, patientInputSchema } from "@/modules/patients/schemas/patient-schema";

// The forms (React Hook Form + zodResolver) and the API must accept and refuse the same things.
const fieldsOf = (result: { success: boolean; error?: { issues: { path: PropertyKey[] }[] } }) =>
  result.success ? [] : (result.error?.issues ?? []).map((issue) => issue.path.join("."));

describe("patient form", () => {
  const blank = { name: "", phone: "", email: "", dateOfBirth: "", address: "", emergencyContactName: "", emergencyContactPhone: "", medicalHistory: "", allergies: "", notes: "" };

  it("flags the same fields as the API, with the same messages", () => {
    const bad = { ...blank, name: "A", phone: "123", email: "nope", dateOfBirth: "2999-01-01" };
    const form = patientFormSchema.safeParse(bad);
    const api = patientInputSchema.safeParse(bad);
    expect(fieldsOf(form).sort()).toEqual(fieldsOf(api).sort());
    expect(form.error?.issues.map((issue) => issue.message).sort()).toEqual(api.error?.issues.map((issue) => issue.message).sort());
  });

  it("accepts a valid patient both ways", () => {
    const good = { ...blank, name: "Rahim Uddin", phone: "01712345678" };
    expect(patientFormSchema.safeParse(good).success).toBe(true);
    expect(patientInputSchema.safeParse(good).success).toBe(true);
  });
});

describe("invoice form", () => {
  const filled = () => ({ ...emptyInvoiceForm(), patientId: "p1", items: [{ serviceId: "", description: "Filling", quantity: "2", unitPrice: "800" }] });

  it("checks quantities, prices and that the discount fits the bill", () => {
    expect(invoiceFormSchema.safeParse(filled()).success).toBe(true);
    expect(fieldsOf(invoiceFormSchema.safeParse({ ...filled(), items: [{ serviceId: "", description: "", quantity: "0", unitPrice: "1.234" }] })))
      .toEqual(expect.arrayContaining(["items.0.description", "items.0.quantity", "items.0.unitPrice"]));
    expect(fieldsOf(invoiceFormSchema.safeParse({ ...filled(), discount: "1600.01" }))).toContain("discount");
    expect(invoiceFormSchema.safeParse({ ...filled(), discount: "1600", tax: "0" }).success).toBe(true);
    expect(fieldsOf(invoiceFormSchema.safeParse({ ...filled(), patientId: "" }))).toContain("patientId");
  });

  it("produces what the API accepts", () => {
    const values = filled();
    expect(invoiceInputSchema.safeParse({
      patientId: values.patientId, discount: Number(values.discount), tax: Number(values.tax), notes: null,
      items: values.items.map((item) => ({ serviceId: null, description: item.description, quantity: Number(item.quantity), unitPrice: Number(item.unitPrice) })),
    }).success).toBe(true);
  });
});

describe("purchase form", () => {
  const base = () => ({
    purchasedAt: "2026-11-01", supplierId: "", invoiceNumber: "", note: "", recordExpense: true, paymentMethod: "CASH" as const,
    lines: [{ ...emptyPurchaseLine(), itemId: "i1", quantity: "10", unitCost: "25.50" }],
  });

  it("accepts a normal purchase and refuses incomplete lines", () => {
    expect(purchaseFormSchema.safeParse(base()).success).toBe(true);
    expect(fieldsOf(purchaseFormSchema.safeParse({ ...base(), lines: [emptyPurchaseLine()] })))
      .toEqual(expect.arrayContaining(["lines.0.itemId", "lines.0.quantity", "lines.0.unitCost"]));
    expect(fieldsOf(purchaseFormSchema.safeParse({ ...base(), lines: [] }))).toContain("lines");
  });

  it("needs the expiry to be after the purchase date (same rule as the server)", () => {
    const expired = base();
    expired.lines[0].expiryDate = "2026-11-01";
    expect(fieldsOf(purchaseFormSchema.safeParse(expired))).toContain("lines.0.expiryDate");
    expired.lines[0].expiryDate = "2027-05-01";
    expect(purchaseFormSchema.safeParse(expired).success).toBe(true);
  });
});
