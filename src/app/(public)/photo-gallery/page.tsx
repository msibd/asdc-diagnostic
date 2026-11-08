import type { Metadata } from "next";
import { BRAND_NAME } from "@/lib/brand";
import SectionPage from "@/app/public_website/components/section-page";

export const instant = false;

export const metadata: Metadata = {
  title: "Gallery",
  description: "Photos of our diagnostic centre.",
  alternates: { canonical: "/photo-gallery" },
  openGraph: { type: "website", title: `Gallery | ${BRAND_NAME}`, url: "/photo-gallery" },
};

export default function Page() {
  return <SectionPage only="gallery" />;
}
