import { z } from "zod";

export const TEMPLATE_PLACEHOLDERS = ["{name}", "{date}", "{time}", "{clinic}", "{doctor}"] as const;
export const TEMPLATE_MAX = 320;

export const DEFAULT_APPOINTMENT_TEMPLATE =
  "{clinic}: প্রিয় {name}, আপনার অ্যাপয়েন্টমেন্টের অনুরোধ পেয়েছি। তারিখ {date}, সময় {time}। ক্লিনিক থেকে নিশ্চিত করা হবে।";

export const smsSettingsSchema = z.object({
  // Optional: leave out to keep the saved key. It is never sent back to the browser.
  apiKey: z.string().trim().max(200).optional().transform((value) => value || undefined)
    .refine((value) => value === undefined || /^[A-Za-z0-9_-]{8,200}$/.test(value), "The API key should be letters and digits only."),
  senderId: z.string().trim().min(3, "Enter the approved sender ID.").max(20).regex(/^[A-Za-z0-9 .-]+$/, "The sender ID can only contain letters, digits, spaces, dots and dashes."),
  appointmentTemplate: z.string().trim().max(TEMPLATE_MAX, `Keep the message to ${TEMPLATE_MAX} characters or fewer.`)
    .refine((value) => !/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/.test(value), "The message contains characters that cannot be sent.")
    .refine((value) => (value.match(/\{[^}]*\}/g) ?? []).every((token) => (TEMPLATE_PLACEHOLDERS as readonly string[]).includes(token)), `Only these placeholders work: ${TEMPLATE_PLACEHOLDERS.join(" ")}`),
  perNumberDailyLimit: z.number().int().min(1).max(20),
  dailyLimit: z.number().int().min(1).max(10_000),
  enabled: z.boolean(),
});
export type SmsSettingsInput = z.infer<typeof smsSettingsSchema>;

export const smsTestSendSchema = z.object({ to: z.string().trim().min(10).max(20) });
