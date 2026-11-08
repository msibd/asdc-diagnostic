import type { MetadataRoute } from "next";
import { getPublishedDoctorSlugs } from "@/app/public_website/queries/doctor-queries";

const siteUrl = (process.env.BETTER_AUTH_URL ?? "http://localhost:3000").replace(/\/$/, "");

// The public website is one page with anchors, plus the doctor directory and one page per published doctor.
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const doctors = await getPublishedDoctorSlugs();
  return [
    { url: siteUrl, changeFrequency: "weekly", priority: 1 },
    ...["about", "our-services", "photo-gallery", "why-us", "patient-reviews", "contact"].map((page) => ({ url: `${siteUrl}/${page}`, changeFrequency: "monthly" as const, priority: 0.6 })),
    ...(doctors.length ? [{ url: `${siteUrl}/doctors`, changeFrequency: "weekly" as const, priority: 0.8 }] : []),
    ...doctors.map((doctor) => ({
      url: `${siteUrl}/doctors/${doctor.slug}`,
      lastModified: doctor.updatedAt,
      changeFrequency: "monthly" as const,
      priority: 0.7,
    })),
  ];
}
