import { z } from "zod";
import { compactPhone, validatePhone } from "@/lib/contact-rules";
import { ADMIN_ONLY_PERMISSIONS, isPermission, type Permission } from "@/lib/permissions";

const phone = (required: boolean) =>
  z.string().trim().max(30, "The phone number is too long.")
    .superRefine((value, context) => {
      const problem = validatePhone(value, required);
      if (problem) context.addIssue({ code: "custom", message: problem });
    })
    .transform((value) => compactPhone(value));

export const userCreateSchema = z.object({
  name: z.string().trim().min(2, "Enter the person's name.").max(80),
  email: z.string().trim().toLowerCase().email("Enter a valid e-mail address.").max(160),
  phone: phone(true),
  role: z.string().trim().min(1, "Choose a role.").max(60),
  password: z.string().min(10, "The password must be at least 10 characters.").max(128, "The password is too long."),
});

export const userUpdateSchema = z.object({
  name: z.string().trim().min(2).max(80).optional(),
  email: z.string().trim().toLowerCase().email("Enter a valid e-mail address.").max(160).optional(),
  // Empty clears the number.
  phone: phone(false).optional(),
  role: z.string().trim().min(1).max(60).optional(),
  isActive: z.boolean().optional(),
}).refine((value) => Object.keys(value).length > 0, "Nothing to change.");

export const passwordResetSchema = z.object({
  password: z.string().min(10, "The password must be at least 10 characters.").max(128, "The password is too long."),
});

const permissionList = z.array(z.string()).max(100).transform((values, context) => {
  const unique = [...new Set(values)];
  const unknown = unique.find((value) => !isPermission(value));
  if (unknown) {
    context.addIssue({ code: "custom", message: `Unknown permission: ${unknown}` });
    return z.NEVER;
  }
  const restricted = unique.find((value) => (ADMIN_ONLY_PERMISSIONS as readonly string[]).includes(value));
  if (restricted) {
    context.addIssue({ code: "custom", message: "Managing staff and roles can only be done by the administrator role." });
    return z.NEVER;
  }
  return unique as Permission[];
});

export const roleCreateSchema = z.object({
  name: z.string().trim().min(2, "Enter a role name.").max(40),
  description: z.string().trim().max(240).default(""),
  permissions: permissionList,
});

export const roleUpdateSchema = z.object({
  name: z.string().trim().min(2).max(40).optional(),
  description: z.string().trim().max(240).optional(),
  permissions: permissionList.optional(),
}).refine((value) => Object.keys(value).length > 0, "Nothing to change.");

/** "Lab technician" -> "lab-technician": the stable key stored on each user. */
export const roleKeyFromName = (name: string) =>
  name.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40);
