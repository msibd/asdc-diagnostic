import type { Metadata } from "next";
import { BRAND_NAME } from "@/lib/brand";
import { getAboutData } from "@/app/public_website/queries/about-queries";
import { getClinicIdentity } from "@/app/public_website/queries/doctor-queries";
import DoctorsShell from "@/app/(public)/doctors/_components/doctors-shell";
import AboutView from "./_components/about-view";

export const instant = false;

export const metadata: Metadata = {
  title: "About us",
  description: `About ${BRAND_NAME}: our diagnostic centre, our facilities and our consultant.`,
  alternates: { canonical: "/about" },
  openGraph: { type: "website", title: `About us | ${BRAND_NAME}`, url: "/about" },
};

export default async function AboutPage() {
  const [clinic, data] = await Promise.all([getClinicIdentity(), getAboutData()]);
  return (
    <DoctorsShell clinic={clinic}>
      <AboutView clinic={clinic} data={data} />
    </DoctorsShell>
  );
}
