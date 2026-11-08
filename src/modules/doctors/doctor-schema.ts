import { z } from "zod";

// Validation shared by the admin form (browser) and the API (server). No server-only imports.

export const PRIMARY_DOCTOR_ID = "primary";

export const DOCTOR_STATUS_FILTERS = ["all", "active", "inactive", "published", "unpublished"] as const;
export type DoctorStatusFilter = (typeof DOCTOR_STATUS_FILTERS)[number];

export const DOCTOR_PAGE_SIZE = 10;

const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** "Dr. Anika Rahman" -> "dr-anika-rahman". Names with no Latin letters (e.g. Bangla) give "doctor". */
export function slugify(value: string) {
  const slug = value
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80)
    .replace(/-+$/g, "");
  return slug || "doctor";
}

const optionalText = (max: number) =>
  z.string().trim().max(max, `Use at most ${max} characters.`).nullable().transform((value) => value || null);

export const scheduleSchema = z.array(z.object({
  dayOfWeek: z.number().int().min(0).max(6),
  startTime: z.string().regex(/^\d{2}:\d{2}$/, "Use a time like 09:00."),
  endTime: z.string().regex(/^\d{2}:\d{2}$/, "Use a time like 17:00."),
  isWorking: z.boolean(),
})).length(7, "Provide all seven weekdays.").superRefine((days, context) => {
  if (new Set(days.map((day) => day.dayOfWeek)).size !== 7) {
    context.addIssue({ code: "custom", message: "Each weekday must appear exactly once." });
  }
  days.forEach((day, index) => {
    if (day.isWorking && day.startTime >= day.endTime) {
      context.addIssue({ code: "custom", path: [index, "endTime"], message: "End time must be after start time." });
    }
  });
});

const imageUrl = z.string().trim().max(2000, "The image address is too long.")
  .refine((value) => {
    try {
      return new URL(value).protocol === "https:";
    } catch {
      return false;
    }
  }, "Use a public https:// image address.")
  .nullable()
  .transform((value) => value || null);

const slugField = z.string().trim().toLowerCase().min(2, "The slug needs at least 2 characters.").max(80, "The slug is too long.")
  .regex(SLUG_PATTERN, "Use only lowercase letters, numbers and single hyphens.");

const doctorShape = {
  name: z.string().trim().min(1, "Enter the doctor's full name.").max(120, "The name is too long."),
  // Omit (or send "") to have the server generate a unique one from the name.
  slug: z.union([slugField, z.literal("").transform(() => undefined)]).optional(),
  designation: optionalText(120),
  imageUrl,
  qualifications: z.string().trim().max(500, "Use at most 500 characters."),
  specialization: z.string().trim().min(1, "Enter a specialization.").max(120, "The specialization is too long."),
  experienceYears: z.number().int("Use whole years.").min(0, "Experience cannot be negative.").max(70, "Experience cannot exceed 70 years.").nullable(),
  bio: optionalText(3000),
  registrationNumber: optionalText(80),
  consultationInfo: optionalText(1000),
  consultationFee: z.number().finite().min(0, "The fee cannot be negative.").max(99999999, "The fee is too large."),
  phone: optionalText(30),
  email: z.union([z.email("Enter a valid e-mail address."), z.literal(""), z.null()]).transform((value) => value || null),
  address: optionalText(1000),
  displayOrder: z.number().int("Use a whole number.").min(0, "Use 0 or more.").max(9999, "Use at most 9999."),
  isActive: z.boolean(),
  isPublished: z.boolean(),
  schedules: scheduleSchema,
};

export const doctorInputSchema = z.object({ ...doctorShape, qualifications: doctorShape.qualifications.default("") });

export type DoctorInput = z.infer<typeof doctorInputSchema>;

/**
 * Any subset of the fields: used for edits and for the one-click activate / publish switches.
 * Built from the shape without defaults so a field that is not sent is never reset.
 */
export const doctorUpdateSchema = z.object(doctorShape).partial().refine((value) => Object.keys(value).length > 0, "Nothing to update.");

export const doctorListQuerySchema = z.object({
  search: z.string().trim().max(100).default(""),
  status: z.enum(DOCTOR_STATUS_FILTERS).default("all"),
  specialization: z.string().trim().max(120).default(""),
  page: z.coerce.number().int().min(1).max(10000).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(DOCTOR_PAGE_SIZE),
});

/** Shape of one doctor in the admin API (and what the admin screens work with). */
export type DoctorRecord = {
  id: string;
  name: string;
  slug: string;
  designation: string | null;
  imageUrl: string | null;
  qualifications: string;
  specialization: string;
  experienceYears: number | null;
  bio: string | null;
  registrationNumber: string | null;
  consultationInfo: string | null;
  consultationFee: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  displayOrder: number;
  isActive: boolean;
  isPublished: boolean;
  createdAt: string;
  updatedAt: string;
  schedules: { dayOfWeek: number; startTime: string; endTime: string; isWorking: boolean }[];
};
