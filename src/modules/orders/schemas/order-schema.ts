import { z } from "zod";

export const ORDER_LIMITS = { items: 60, referredBy: 120, clinicalNotes: 1000, reason: 500, money: 99999999 } as const;

const optionalText = (max: number, label: string) =>
  z.string({ error: `${label} must be text.` }).trim().max(max, `${label} must be ${max} characters or fewer.`).nullish().transform((value) => value || null);

/** What the API accepts when a test order is placed. */
export const createOrderSchema = z.object({
  patientId: z.string({ error: "Select a patient." }).min(1, "Select a patient."),
  serviceIds: z.array(z.string().min(1), { error: "Choose at least one test." })
    .min(1, "Choose at least one test.")
    .max(ORDER_LIMITS.items, `An order can hold at most ${ORDER_LIMITS.items} items.`),
  priority: z.enum(["ROUTINE", "URGENT"], { error: "Choose Routine or Urgent." }).default("ROUTINE"),
  referredBy: optionalText(ORDER_LIMITS.referredBy, "Referred by"),
  clinicalNotes: optionalText(ORDER_LIMITS.clinicalNotes, "Clinical notes"),
  discount: z.number({ error: "Discount must be a number." }).finite().min(0, "Discount cannot be negative.").max(ORDER_LIMITS.money).default(0),
});
export type CreateOrderInput = z.infer<typeof createOrderSchema>;

export const reasonSchema = z.object({
  reason: z.string({ error: "A reason is required." }).trim().min(3, "Give a short reason (at least 3 characters).").max(ORDER_LIMITS.reason, `The reason must be ${ORDER_LIMITS.reason} characters or fewer.`),
});

export const sampleActionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("collect") }),
  z.object({ action: z.literal("receive") }),
  z.object({ action: z.literal("reject"), reason: reasonSchema.shape.reason }),
]);

export const scanSchema = z.object({
  code: z.string({ error: "Scan or type a sample code." }).trim().min(3, "Scan or type a sample code.").max(40, "That is not a sample code."),
});

export const RESULT_LIMITS = { values: 80, value: 200, text: 5000, note: 2000 } as const;

/** Results of one test as typed on the entry screen. A blank value means "not reported". */
export const saveResultsSchema = z.object({
  values: z.array(z.object({
    name: z.string({ error: "Each result needs its parameter name." }).trim().min(1).max(120),
    value: z.string({ error: "A result must be text or a number." }).max(RESULT_LIMITS.value, `A result must be ${RESULT_LIMITS.value} characters or fewer.`),
  })).max(RESULT_LIMITS.values, `A test can have at most ${RESULT_LIMITS.values} results.`).default([]),
  text: z.string().max(RESULT_LIMITS.text, `The written result must be ${RESULT_LIMITS.text} characters or fewer.`).nullish().transform((value) => value ?? null),
  note: z.string().max(RESULT_LIMITS.note, `The comment must be ${RESULT_LIMITS.note} characters or fewer.`).nullish().transform((value) => value ?? null),
});

export const reviewSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("verify"), itemId: z.string().min(1).optional() }),
  z.object({ action: z.literal("return"), itemId: z.string({ error: "Choose the test to send back." }).min(1, "Choose the test to send back."), reason: reasonSchema.shape.reason }),
]);

export const reportActionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("release") }),
  z.object({ action: z.literal("withdraw"), reason: reasonSchema.shape.reason }),
]);

export const sendReportSchema = z.object({ channel: z.enum(["sms", "email"], { error: "Choose SMS or e-mail." }) });

/** What a patient types on the public report page. */
export const openReportSchema = z.object({ pin: z.string({ error: "Enter your PIN." }).trim().min(1, "Enter your PIN.").max(12, "That PIN is not valid.") });
