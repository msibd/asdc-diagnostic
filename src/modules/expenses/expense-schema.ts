import { z } from "zod";
import { ExpenseCategory, PaymentMethod } from "@/generated/prisma/client";

export const expenseInputSchema = z.object({
  category: z.nativeEnum(ExpenseCategory),
  description: z.string().trim().min(2, "Describe the expense.").max(300),
  amount: z.number().finite().positive("The amount must be greater than zero.").max(99999999)
    .refine((value) => Math.abs(value * 100 - Math.round(value * 100)) < 1e-6, "Use at most two decimal places."),
  spentAt: z.iso.date(),
  method: z.nativeEnum(PaymentMethod).default("CASH"),
  reference: z.string().trim().max(120).nullable().optional().transform((value) => value || null),
});
export type ExpenseInput = z.infer<typeof expenseInputSchema>;

export const expenseVoidSchema = z.object({ reason: z.string().trim().min(3, "A reason is required.").max(500) });

export const expenseListQuerySchema = z.object({
  from: z.iso.date().optional(),
  to: z.iso.date().optional(),
  category: z.nativeEnum(ExpenseCategory).optional(),
  cursor: z.string().min(1).max(100).optional(),
});
