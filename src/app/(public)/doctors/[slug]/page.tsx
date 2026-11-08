import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { BRAND_NAME } from "@/lib/brand";
import { getClinicIdentity, getPublishedDoctor } from "@/app/public_website/queries/doctor-queries";
import DoctorProfileView from "../_components/doctor-profile";
import DoctorsShell from "../_components/doctors-shell";

export const instant = false;

const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

function summary(doctor: NonNullable<Awaited<ReturnType<typeof getPublishedDoctor>>>) {
  const text = doctor.bio?.replace(/\s+/g, " ").trim()
    || [doctor.designation, doctor.qualifications, doctor.specialization].filter(Boolean).join(" · ");
  return text.length > 160 ? `${text.slice(0, 157).trimEnd()}…` : text;
}

export async function generateMetadata(props: PageProps<"/doctors/[slug]">): Promise<Metadata> {
  const { slug } = await props.params;
  const doctor = SLUG_PATTERN.test(slug) ? await getPublishedDoctor(slug) : null;
  if (!doctor) return { title: "Doctor not found", robots: { index: false, follow: false } };
  const path = `/doctors/${doctor.slug}`;
  const title = `${doctor.name} — ${doctor.designation || doctor.specialization}`;
  return {
    title,
    description: summary(doctor),
    alternates: { canonical: path },
    openGraph: {
      type: "profile",
      title: `${title} | ${BRAND_NAME}`,
      description: summary(doctor),
      url: path,
      ...(doctor.imageUrl ? { images: [{ url: doctor.imageUrl, alt: doctor.name }] } : {}),
    },
  };
}

export default async function DoctorPage(props: PageProps<"/doctors/[slug]">) {
  const { slug } = await props.params;
  if (!SLUG_PATTERN.test(slug)) notFound();
  const [clinic, doctor] = await Promise.all([getClinicIdentity(), getPublishedDoctor(slug)]);
  if (!doctor) notFound();

  // Structured data for search engines. Only fields already visible on the page are included.
  const structuredData = {
    "@context": "https://schema.org",
    "@type": "Physician",
    name: doctor.name,
    ...(doctor.designation ? { jobTitle: doctor.designation } : {}),
    ...(doctor.imageUrl ? { image: doctor.imageUrl } : {}),
    description: summary(doctor),
    url: `${(process.env.BETTER_AUTH_URL ?? "http://localhost:3000").replace(/\/$/, "")}/doctors/${doctor.slug}`,
    worksFor: { "@type": "MedicalClinic", name: clinic.clinicName },
  };

  return (
    <DoctorsShell clinic={clinic}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData).replace(/</g, "\\u003c") }} />
      <DoctorProfileView doctor={doctor} />
    </DoctorsShell>
  );
}
