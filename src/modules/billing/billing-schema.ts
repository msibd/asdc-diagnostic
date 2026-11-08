import { z } from "zod";

// One definition of an invoice for both the API and the form.

const LIMITS = { description: 200, notes: 2000, quantity: 1000, money: 99999999, items: 100 } as const;

/** What the API accepts. */
export const invoiceInputSchema = z.object({
  patientId: z.string().min(1, "Select a patient."),
  discount: z.number().finite().min(0).default(0),
  tax: z.number().finite().min(0).default(0),
  notes: z.string().trim().max(LIMITS.notes).nullable(),
  items: z.array(z.object({
    serviceId: z.string().nullable(),
    description: z.string().trim().min(1, "Describe the item.").max(LIMITS.description),
    quantity: z.number().int().min(1).max(LIMITS.quantity),
    unitPrice: z.number().finite().min(0).max(LIMITS.money),
  })).min(1, "Add at least one item.").max(LIMITS.items),
});

// Number fields arrive from inputs as text; these check the text the way the API will read it.
const isMoney = (value: string) => /^\d{1,8}(\.\d{1,2})?$/.test(value.trim());
const money = (label: string) => z.string().trim().refine(isMoney, `${label}: use a number with up to 2 decimals.`);

/** The browser form, where every field is text. */
export const invoiceFormSchema = z.object({
  patientId: z.string().min(1, "Select a patient."),
  discount: money("Discount"),
  tax: money("Tax"),
  notes: z.string().trim().max(LIMITS.notes, `Keep notes to ${LIMITS.notes} characters or fewer.`),
  items: z.array(z.object({
    serviceId: z.string(),
    description: z.string().trim().min(1, "Describe the item.").max(LIMITS.description, `Keep this to ${LIMITS.description} characters or fewer.`),
    quantity: z.string().trim().refine((value) => /^\d+$/.test(value) && Number(value) >= 1 && Number(value) <= LIMITS.quantity, `Quantity: a whole number from 1 to ${LIMITS.quantity}.`),
    unitPrice: money("Unit price"),
  })).min(1, "Add at least one item.").max(LIMITS.items, `Up to ${LIMITS.items} items.`),
}).superRefine((value, context) => {
  // A discount cannot be larger than the bill (the database refuses it too).
  const subtotal = value.items.reduce((sum, item) => sum + (isMoney(item.unitPrice) ? Math.round(Number(item.unitPrice) * 100) * Number(item.quantity || 0) : 0), 0);
  const tax = isMoney(value.tax) ? Math.round(Number(value.tax) * 100) : 0;
  if (isMoney(value.discount) && Math.round(Number(value.discount) * 100) > subtotal + tax) {
    context.addIssue({ code: "custom", path: ["discount"], message: "The discount cannot be more than the total." });
  }
});
export type InvoiceFormValues = z.infer<typeof invoiceFormSchema>;

export const emptyInvoiceItem = () => ({ serviceId: "", description: "", quantity: "1", unitPrice: "" });
export const emptyInvoiceForm = (): InvoiceFormValues => ({ patientId: "", items: [emptyInvoiceItem()], discount: "0", tax: "0", notes: "" });
