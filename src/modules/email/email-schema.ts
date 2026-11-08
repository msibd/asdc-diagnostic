import { z } from "zod";

export const PROVIDERS = {
  gmail: { label: "Gmail", host: "smtp.gmail.com", port: 465, secure: true },
  custom: { label: "Other SMTP server", host: "", port: 587, secure: false },
} as const;

const email = z.string().trim().toLowerCase().email("Enter a valid e-mail address.").max(160);

// Hosts that would point the server at its own machine or private network. SMTP settings are
// admin-only, but there is no reason for a clinic's mail server to live there.
const PRIVATE_HOST = /^(localhost|.*\.local|.*\.internal|0\.0\.0\.0|127\.\d+\.\d+\.\d+|10\.\d+\.\d+\.\d+|192\.168\.\d+\.\d+|172\.(1[6-9]|2\d|3[01])\.\d+\.\d+|169\.254\.\d+\.\d+|\[?::1?\]?|\[?(fc|fd|fe80)[0-9a-f:]*\]?)$/i;

export const isPrivateHost = (host: string) => PRIVATE_HOST.test(host.trim());

export const emailSettingsSchema = z.object({
  provider: z.enum(["gmail", "custom"]),
  host: z.string().trim().min(3, "Enter the SMTP host.").max(253)
    .regex(/^[A-Za-z0-9.-]+$/, "The host can only contain letters, digits, dots and dashes.")
    .refine((host) => process.env.EMAIL_ALLOW_PRIVATE_HOSTS === "true" || !isPrivateHost(host), "That host is on a private or local network. Use your mail provider's public SMTP host."),
  port: z.number().int().min(1).max(65535),
  secure: z.boolean(),
  authMethod: z.enum(["APP_PASSWORD", "PASSWORD"]),
  username: email,
  // Optional: leave out to keep the saved password. Never sent back to the browser.
  password: z.string().max(256).optional().transform((value) => value || undefined),
  senderEmail: email,
  senderName: z.string().trim().min(2, "Enter the sender name.").max(80).regex(/^[^\r\n<>]+$/, "The sender name cannot contain line breaks or angle brackets."),
  enabled: z.boolean(),
});
export type EmailSettingsInput = z.infer<typeof emailSettingsSchema>;

export const testSendSchema = z.object({ to: email });
