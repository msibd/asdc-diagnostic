import type { Metadata } from "next";
import { BRAND_NAME } from "@/lib/brand";
import SectionPage from "@/app/public_website/components/section-page";

export const instant = false;

export const metadata: Metadata = {
  title: "Patient reviews",
  description: "What our patients say, and share your own feedback.",
  alternates: { canonical: "/patient-reviews" },
  openGraph: { type: "website", title: `Patient reviews | ${BRAND_NAME}`, url: "/patient-reviews" },
};

export default function Page() {
  return <SectionPage only="reviews" />;
}
