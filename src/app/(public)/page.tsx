import type { Metadata } from "next";
import ClinicWebsite from "@/app/public_website/components/clinic-website";
import { getPublicClinicData, getPublicGalleryImages } from "@/app/public_website/queries/clinic-queries";
import { BRAND_NAME } from "@/lib/brand";
import { countPublishedDoctors } from "@/app/public_website/queries/doctor-queries";

export const metadata: Metadata = {
  title: { absolute: BRAND_NAME },
  description: "ক্লিনিকের সেবা, চিকিৎসকের তথ্য এবং অ্যাপয়েন্টমেন্টের অনুরোধ।",
};

export const instant = false;

export default async function HomePage() {
  const [clinic, galleryImages, doctorCount] = await Promise.all([
    getPublicClinicData(),
    getPublicGalleryImages(),
    countPublishedDoctors(),
  ]);
  return <ClinicWebsite clinic={clinic} galleryImages={galleryImages} doctorCount={doctorCount} />;
}
