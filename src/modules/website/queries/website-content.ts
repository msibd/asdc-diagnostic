import { prisma } from "@/lib/prisma";
import { emptyWebsiteContent, type WebsiteContent } from "@/modules/website/schemas/website-content-schema";
import { layoutOverridesSchema } from "@/modules/website/schemas/website-layout";

/** Reads the single content row, or the empty defaults when nothing has been saved yet. */
export async function readWebsiteContent(): Promise<WebsiteContent> {
  const row = await prisma.clinicContent.findUnique({ where: { id: "primary" } });
  if (!row) return emptyWebsiteContent;
  return {
    clinicName: row.clinicName,
    clinicSubtitle: row.clinicSubtitle,
    heroTitleEn: row.heroTitleEn,
    heroTitleBn: row.heroTitleBn,
    heroSubtitleEn: row.heroSubtitleEn,
    heroSubtitleBn: row.heroSubtitleBn,
    technologyEn: row.technologyEn,
    technologyBn: row.technologyBn,
    bookingNoteEn: row.bookingNoteEn,
    bookingNoteBn: row.bookingNoteBn,
    closingMessageEn: row.closingMessageEn,
    closingMessageBn: row.closingMessageBn,
    doctorHighlightsEn: row.doctorHighlightsEn,
    doctorHighlightsBn: row.doctorHighlightsBn,
    heroImageUrl: row.heroImageUrl ?? "",
    doctorImageUrl: row.doctorImageUrl ?? "",
    centreAboutEn: row.centreAboutEn ?? "",
    centreAboutBn: row.centreAboutBn ?? "",
    centreFactsEn: row.centreFactsEn ?? [],
    centreFactsBn: row.centreFactsBn ?? [],
    centreImageUrl: row.centreImageUrl ?? "",
    // A stored value that no longer fits the schema is ignored rather than breaking the website.
    layout: layoutOverridesSchema.safeParse(row.layout ?? {}).data ?? {},
  };
}
