import { z } from "zod";
import { layoutOverridesSchema } from "@/modules/website/schemas/website-layout";

/**
 * Editable public-website content. Shared by the admin form (instant feedback) and the API
 * (the authority), so both apply the same limits. All text is plain text; the site renders it
 * through React, which escapes it, so nothing here can inject markup.
 */
export const CONTENT_LIMITS = {
  name: 80,
  title: 160,
  paragraph: 800,
  note: 400,
  highlight: 160,
  highlights: 8,
  url: 2048,
} as const;

const text = (max: number, label: string) =>
  z.string({ error: `${label} must be text.` })
    .trim()
    .max(max, `${label} must be ${max} characters or fewer.`);

const imageUrl = (label: string) =>
  z.string({ error: `${label} must be text.` })
    .trim()
    .max(CONTENT_LIMITS.url, `${label} is too long.`)
    .refine((value) => {
      if (!value) return true;
      try {
        return new URL(value).protocol === "https:";
      } catch {
        return false;
      }
    }, `${label} must be a full https:// link, or empty.`);

const highlights = (label: string) =>
  z.array(text(CONTENT_LIMITS.highlight, label).min(1, `${label} cannot contain an empty line.`), { error: `${label} must be a list.` })
    .max(CONTENT_LIMITS.highlights, `Add at most ${CONTENT_LIMITS.highlights} lines to ${label}.`);

export const websiteContentSchema = z.object({
  clinicName: text(CONTENT_LIMITS.name, "Clinic name"),
  clinicSubtitle: text(CONTENT_LIMITS.name, "Clinic subtitle"),
  heroTitleEn: text(CONTENT_LIMITS.title, "Headline (English)"),
  heroTitleBn: text(CONTENT_LIMITS.title, "Headline (Bangla)"),
  heroSubtitleEn: text(CONTENT_LIMITS.paragraph, "Intro (English)"),
  heroSubtitleBn: text(CONTENT_LIMITS.paragraph, "Intro (Bangla)"),
  technologyEn: text(CONTENT_LIMITS.paragraph, "Technology (English)"),
  technologyBn: text(CONTENT_LIMITS.paragraph, "Technology (Bangla)"),
  bookingNoteEn: text(CONTENT_LIMITS.note, "Booking note (English)"),
  bookingNoteBn: text(CONTENT_LIMITS.note, "Booking note (Bangla)"),
  closingMessageEn: text(CONTENT_LIMITS.note, "Closing message (English)"),
  closingMessageBn: text(CONTENT_LIMITS.note, "Closing message (Bangla)"),
  doctorHighlightsEn: highlights("Doctor highlights (English)"),
  doctorHighlightsBn: highlights("Doctor highlights (Bangla)"),
  heroImageUrl: imageUrl("Hero image"),
  doctorImageUrl: imageUrl("Doctor photo"),
  // Defaults keep older clients (that do not send these) working.
  centreAboutEn: text(CONTENT_LIMITS.paragraph * 3, "About the centre (English)").default(""),
  centreAboutBn: text(CONTENT_LIMITS.paragraph * 3, "About the centre (Bangla)").default(""),
  centreFactsEn: highlights("Centre facts (English)").default([]),
  centreFactsBn: highlights("Centre facts (Bangla)").default([]),
  centreImageUrl: imageUrl("Centre photo").default(""),
  // Menu labels, section headings, feature cards, footer: only what the clinic changed.
  layout: layoutOverridesSchema,
});

export type WebsiteContentInput = z.infer<typeof websiteContentSchema>;

/** Shape returned by the API and used by the public site. Empty text means "use the default". */
export type WebsiteContent = WebsiteContentInput;

export const emptyWebsiteContent: WebsiteContent = {
  clinicName: "",
  clinicSubtitle: "",
  heroTitleEn: "",
  heroTitleBn: "",
  heroSubtitleEn: "",
  heroSubtitleBn: "",
  technologyEn: "",
  technologyBn: "",
  bookingNoteEn: "",
  bookingNoteBn: "",
  closingMessageEn: "",
  closingMessageBn: "",
  doctorHighlightsEn: [],
  doctorHighlightsBn: [],
  heroImageUrl: "",
  doctorImageUrl: "",
  centreAboutEn: "",
  centreAboutBn: "",
  centreFactsEn: [],
  centreFactsBn: [],
  centreImageUrl: "",
  layout: {},
};

/**
 * Messages for a failed parse, keyed by the field's path ("heroTitleEn", or
 * "layout.nav.home.label.en" for nested settings), so the form can show each one beside its field.
 */
export function websiteContentFieldErrors(error: z.ZodError): Record<string, string> {
  const errors: Record<string, string> = {};
  for (const issue of error.issues) {
    // Settings under "layout" are reported by their full path; everything else by field name.
    const key = issue.path[0] === "layout" ? issue.path.join(".") : String(issue.path[0] ?? "");
    if (key && !errors[key]) errors[key] = issue.message;
  }
  return errors;
}
