import { cacheLife, cacheTag } from "next/cache";
import { BRAND_NAME } from "@/lib/brand";
import { publicCacheTags } from "@/lib/public-cache";
import {
  countPublishedDoctors as countDoctors,
  findPublishedDoctor,
  listPublishedDoctorSlugs,
  listPublishedDoctors,
} from "@/modules/doctors/public-doctors";
import { NAV_ANCHORS, NAV_KEYS, NAV_PAGES, resolveLayout } from "@/modules/website/schemas/website-layout";
import { readWebsiteContent } from "@/modules/website/queries/website-content";

// Cached wrappers for the public doctor pages. The data rules (only active and published doctors,
// only public fields) live in modules/doctors/public-doctors.ts. Saving a doctor expires the
// "doctors" tag, so changes show on the next request.

export async function getPublishedDoctors(page = 1) {
  "use cache";
  cacheLife("hours");
  cacheTag(publicCacheTags.doctors);
  return listPublishedDoctors(page);
}

export async function getPublishedDoctor(slug: string) {
  "use cache";
  cacheLife("hours");
  cacheTag(publicCacheTags.doctors);
  return findPublishedDoctor(slug);
}

/** Slugs for the sitemap. */
export async function getPublishedDoctorSlugs() {
  "use cache";
  cacheLife("hours");
  cacheTag(publicCacheTags.doctors);
  return listPublishedDoctorSlugs();
}

/** How many doctors the directory shows; the home page links to it only when this is above zero. */
export async function countPublishedDoctors() {
  "use cache";
  cacheLife("hours");
  cacheTag(publicCacheTags.doctors);
  return countDoctors();
}

/** The clinic's name for the page header (managed under Website content). */
export async function getClinicIdentity() {
  "use cache";
  cacheLife("hours");
  cacheTag(publicCacheTags.clinic);
  const content = await readWebsiteContent();
  // The same menu as the home page (labels and visibility are set under Website content).
  const layout = resolveLayout(content.layout);
  const nav = NAV_KEYS.filter((key) => layout.nav[key].visible).map((key) => ({ key: NAV_ANCHORS[key], href: NAV_PAGES[key], label: layout.nav[key].label }));
  return { clinicName: content.clinicName.trim() || BRAND_NAME, clinicSubtitle: content.clinicSubtitle.trim() || "Diagnostic Center", nav, announcements: layout.announcements, announcementLabel: layout.announcementLabel };
}
