import type { Metadata } from "next";
import { BRAND_NAME } from "@/lib/brand";
import SectionPage from "@/app/public_website/components/section-page";

export const instant = false;

export const metadata: Metadata = {
  title: "Tests & services",
  description: "Our diagnostic tests, packages and services with prices.",
  alternates: { canonical: "/our-services" },
  openGraph: { type: "website", title: `Tests & services | ${BRAND_NAME}`, url: "/our-services" },
};

export default function Page() {
  return <SectionPage only="services" />;
}
