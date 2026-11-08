import { z } from "zod";

/**
 * Optional website-facing fields of a clinic service (Bangla text, badge, timing, fee range,
 * details and steps). Shared by the create and update routes.
 *
 * Absent means "leave unchanged" (e.g. the active/inactive toggle sends none of them); an empty
 * string clears the value.
 */
// The first group is what the admin screen offers; the second is kept so older rows still validate and show.
export const SERVICE_ICON_KEYS = ["general", "blood", "lab", "package", "home", "xray", "preventive", "smile", "cosmetic", "endodontics", "surgery"] as const;
export const OFFERED_ICON_KEYS = ["general", "blood", "lab", "package", "home", "xray", "preventive"] as const;
export type ServiceIconKey = (typeof SERVICE_ICON_KEYS)[number];

export const SERVICE_PUBLIC_LIMITS = {
  name: 120,
  short: 80,
  description: 1000,
  details: 3000,
  step: 240,
  steps: 12,
} as const;

const optionalText = (max: number, label: string) =>
  z.string({ error: `${label} must be text.` })
    .trim()
    .max(max, `${label} must be ${max} characters or fewer.`)
    .nullish()
    .transform((value) => (value === undefined ? undefined : value || null));

const longText = (max: number, label: string) =>
  z.string({ error: `${label} must be text.` }).trim().max(max, `${label} must be ${max} characters or fewer.`).optional();

const stepList = (label: string) =>
  z.array(
    z.string({ error: `${label} must be text.` }).trim().min(1, `${label} cannot contain an empty line.`).max(SERVICE_PUBLIC_LIMITS.step, `Each line of ${label} must be ${SERVICE_PUBLIC_LIMITS.step} characters or fewer.`),
    { error: `${label} must be a list.` },
  ).max(SERVICE_PUBLIC_LIMITS.steps, `Add at most ${SERVICE_PUBLIC_LIMITS.steps} lines to ${label}.`).optional();

export const servicePublicFields = {
  nameBn: optionalText(SERVICE_PUBLIC_LIMITS.name, "Bangla name"),
  descriptionBn: optionalText(SERVICE_PUBLIC_LIMITS.description, "Bangla description"),
  categoryBn: optionalText(SERVICE_PUBLIC_LIMITS.short, "Bangla category"),
  iconKey: z.enum(SERVICE_ICON_KEYS, { error: "Choose one of the listed icons." }).nullish().or(z.literal("").transform(() => null)),
  badgeEn: optionalText(SERVICE_PUBLIC_LIMITS.short, "Badge (English)"),
  badgeBn: optionalText(SERVICE_PUBLIC_LIMITS.short, "Badge (Bangla)"),
  timeTextEn: optionalText(SERVICE_PUBLIC_LIMITS.short, "Time (English)"),
  timeTextBn: optionalText(SERVICE_PUBLIC_LIMITS.short, "Time (Bangla)"),
  painTextEn: optionalText(SERVICE_PUBLIC_LIMITS.short, "Comfort level (English)"),
  painTextBn: optionalText(SERVICE_PUBLIC_LIMITS.short, "Comfort level (Bangla)"),
  feeMax: z.number({ error: "Maximum fee must be a number." }).finite().min(0, "Maximum fee cannot be negative.").max(99999999, "Maximum fee is too large.").nullish(),
  detailsEn: longText(SERVICE_PUBLIC_LIMITS.details, "Details (English)"),
  detailsBn: longText(SERVICE_PUBLIC_LIMITS.details, "Details (Bangla)"),
  stepsEn: stepList("Steps (English)"),
  stepsBn: stepList("Steps (Bangla)"),
};

/** The fee range only makes sense when its top is not below the standard price. */
export const feeRangeCheck = (value: { standardPrice: number; feeMax?: number | null }) =>
  value.feeMax == null || value.feeMax >= value.standardPrice;

export const feeRangeError = { message: "Maximum fee must be at least the standard price.", path: ["feeMax"] };
