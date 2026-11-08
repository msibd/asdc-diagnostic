import type { Metadata } from "next";
import { BRAND_NAME } from "@/lib/brand";
import SectionPage from "@/app/public_website/components/section-page";

export const instant = false;

export const metadata: Metadata = {
  title: "Why choose us",
  description: "Why patients trust our diagnostic centre.",
  alternates: { canonical: "/why-us" },
  openGraph: { type: "website", title: `Why choose us | ${BRAND_NAME}`, url: "/why-us" },
};

export default function Page() {
  return <SectionPage only="whyUs" />;
}
