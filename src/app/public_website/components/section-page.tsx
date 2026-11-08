import { getPublicClinicData, getPublicGalleryImages } from "@/app/public_website/queries/clinic-queries";
import { countPublishedDoctors } from "@/app/public_website/queries/doctor-queries";
import type { NavKey } from "@/modules/website/schemas/website-layout";
import ClinicWebsite from "./clinic-website";

/** One menu section as its own page (header and footer as on the home page, nothing else). */
export default async function SectionPage({ only }: { only: NavKey }) {
  const [clinic, galleryImages, doctorCount] = await Promise.all([
    getPublicClinicData(),
    only === "gallery" ? getPublicGalleryImages() : Promise.resolve([]),
    countPublishedDoctors(),
  ]);
  return <ClinicWebsite clinic={clinic} galleryImages={galleryImages} doctorCount={doctorCount} only={only} />;
}
