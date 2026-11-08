import { cacheLife, cacheTag } from "next/cache";
import { prisma } from "@/lib/prisma";
import { publicCacheTags } from "@/lib/public-cache";
import { countPublishedDoctors } from "@/modules/doctors/public-doctors";
import { emptyWebsiteContent } from "@/modules/website/schemas/website-content-schema";
import { readWebsiteContent } from "@/modules/website/queries/website-content";

/** Only what the About page shows: no services, reviews or gallery are loaded for it. */
export async function getAboutData() {
  "use cache";
  cacheLife("hours");
  cacheTag(publicCacheTags.clinic, publicCacheTags.doctors);
  const [content, doctor, doctorCount] = await Promise.all([
    readWebsiteContent(),
    prisma.doctorProfile.findUnique({ where: { id: "primary" }, select: { name: true, qualifications: true, specialization: true, bio: true } }),
    countPublishedDoctors(),
  ]);
  const c = { ...emptyWebsiteContent, ...content };
  return {
    doctor,
    doctorCount,
    about: {
      centreAboutEn: c.centreAboutEn, centreAboutBn: c.centreAboutBn,
      centreFactsEn: c.centreFactsEn, centreFactsBn: c.centreFactsBn, centreImageUrl: c.centreImageUrl,
      doctorHighlightsEn: c.doctorHighlightsEn, doctorHighlightsBn: c.doctorHighlightsBn, doctorImageUrl: c.doctorImageUrl,
    },
  };
}

export type AboutData = Awaited<ReturnType<typeof getAboutData>>;
