import { z } from "zod";
// The browser-safe enums module (the Prisma client itself is server-only; this file is also used by the purchase form).
import { PaymentMethod, StockMovementType } from "@/generated/prisma/enums";

const money = (label: string, { allowZero = false } = {}) =>
  z.number().finite()
    .refine((value) => (allowZero ? value >= 0 : value > 0), allowZero ? `${label} cannot be negative.` : `${label} must be greater than zero.`)
    .max(99999999, `${label} is too large.`)
    .refine((value) => Math.abs(value * 100 - Math.round(value * 100)) < 1e-6, "Use at most two decimal places.");

const quantity = z.number().int("Quantity must be a whole number.").positive("Quantity must be greater than zero.").max(1_000_000, "Quantity is too large.");
const optionalText = (max: number) =>
  z.string().trim().max(max).nullish().transform((value) => value || null);

export const itemInputSchema = z.object({
  name: z.string().trim().min(2, "Enter the item name.").max(120),
  category: z.string().trim().min(2).max(60).default("Reagents"),
  unit: z.string().trim().min(1, "Enter a unit, e.g. pcs, box, ml.").max(20).default("pcs"),
  reorderLevel: z.number().int().min(0, "Reorder level cannot be negative.").max(1_000_000).default(0),
  supplierId: z.string().min(1).max(100).nullish().transform((value) => value || null),
  notes: optionalText(1000),
});
export type ItemInput = z.infer<typeof itemInputSchema>;

export const itemUpdateSchema = itemInputSchema.partial().extend({ isActive: z.boolean().optional() });

export const itemListQuerySchema = z.object({
  includeInactive: z.enum(["true", "false"]).optional(),
});

export const supplierInputSchema = z.object({
  name: z.string().trim().min(2, "Enter the supplier name.").max(120),
  contactPerson: optionalText(120),
  phone: optionalText(40),
  email: z.string().trim().max(160).nullish().transform((value) => value || null)
    .refine((value) => value === null || /^\S+@\S+\.\S+$/.test(value), "Enter a valid e-mail address."),
  address: optionalText(500),
  notes: optionalText(1000),
});
export const supplierUpdateSchema = supplierInputSchema.partial().extend({ isActive: z.boolean().optional() });

const dateOnly = z.iso.date();

export const purchaseInputSchema = z.object({
  supplierId: z.string().min(1).max(100).nullish().transform((value) => value || null),
  invoiceNumber: optionalText(80),
  purchasedAt: dateOnly,
  note: optionalText(1000),
  lines: z.array(z.object({
    itemId: z.string().min(1).max(100),
    quantity,
    unitCost: money("Unit cost", { allowZero: true }),
    batchNumber: optionalText(60),
    expiryDate: dateOnly.nullish().transform((value) => value || null),
  })).min(1, "Add at least one item.").max(50, "A purchase can hold up to 50 lines."),
  // When the clinic paid at purchase time, an expense (category Supplies) is recorded with it.
  recordExpense: z.boolean().default(true),
  paymentMethod: z.nativeEnum(PaymentMethod).default("CASH"),
});
export type PurchaseInput = z.infer<typeof purchaseInputSchema>;

export const movementInputSchema = z.object({
  itemId: z.string().min(1).max(100),
  // ISSUE: used in the clinic. ADJUST_IN / ADJUST_OUT: manual correction (stock-take, damage, expiry).
  kind: z.enum(["ISSUE", "ADJUST_IN", "ADJUST_OUT"]),
  quantity,
  reason: z.string().trim().min(3, "Give a short reason.").max(300),
  // ADJUST_OUT can target one batch (e.g. write off an expired lot).
  batchId: z.string().min(1).max(100).nullish().transform((value) => value || null),
  // ADJUST_IN can record the expiry of the stock being added.
  expiryDate: dateOnly.nullish().transform((value) => value || null),
});
export type MovementInput = z.infer<typeof movementInputSchema>;

export const movementListQuerySchema = z.object({
  itemId: z.string().min(1).max(100).optional(),
  type: z.nativeEnum(StockMovementType).optional(),
  from: dateOnly.optional(),
  to: dateOnly.optional(),
  cursor: z.string().min(1).max(100).optional(),
});

export const purchaseListQuerySchema = z.object({
  from: dateOnly.optional(),
  to: dateOnly.optional(),
  cursor: z.string().min(1).max(100).optional(),
});

export const reportQuerySchema = z.object({ from: dateOnly, to: dateOnly });

export const EXPIRY_WARNING_DAYS = 30;

// ---- Browser form for a purchase (every field is text there); same limits as the API ----

const isCost = (value: string) => /^\d{1,8}(\.\d{1,2})?$/.test(value.trim());

export const purchaseFormSchema = z.object({
  purchasedAt: z.iso.date({ error: "Choose the purchase date." }),
  supplierId: z.string(),
  invoiceNumber: z.string().trim().max(80, "Keep this to 80 characters or fewer."),
  note: z.string().trim().max(1000, "Keep this to 1000 characters or fewer."),
  recordExpense: z.boolean(),
  paymentMethod: z.nativeEnum(PaymentMethod),
  lines: z.array(z.object({
    itemId: z.string().min(1, "Choose an item."),
    quantity: z.string().trim().refine((value) => /^\d+$/.test(value) && Number(value) >= 1 && Number(value) <= 1_000_000, "A whole number, 1 or more."),
    unitCost: z.string().trim().refine(isCost, "A price with up to 2 decimals."),
    batchNumber: z.string().trim().max(60, "Keep this to 60 characters or fewer."),
    expiryDate: z.union([z.iso.date(), z.literal("")]),
  })).min(1, "Add at least one item.").max(50, "A purchase can hold up to 50 lines."),
}).superRefine((value, context) => {
  value.lines.forEach((line, index) => {
    if (line.expiryDate && line.expiryDate <= value.purchasedAt) {
      context.addIssue({ code: "custom", path: ["lines", index, "expiryDate"], message: "Must be after the purchase date." });
    }
  });
});
export type PurchaseFormValues = z.infer<typeof purchaseFormSchema>;

export const emptyPurchaseLine = (): PurchaseFormValues["lines"][number] => ({ itemId: "", quantity: "", unitCost: "", batchNumber: "", expiryDate: "" });
