import type { Metadata } from "next";
import { BRAND_NAME } from "@/lib/brand";
import SectionPage from "@/app/public_website/components/section-page";

export const instant = false;

export const metadata: Metadata = {
  title: "Contact us",
  description: "Address, opening hours, phone and map.",
  alternates: { canonical: "/contact" },
  openGraph: { type: "website", title: `Contact us | ${BRAND_NAME}`, url: "/contact" },
};

export default function Page() {
  return <SectionPage only="contact" />;
}
