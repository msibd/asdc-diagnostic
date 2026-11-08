import type { Metadata } from "next";
import { Suspense } from "react";
import { BRAND_NAME } from "@/lib/brand";
import { getClinicIdentity, getPublishedDoctors } from "@/app/public_website/queries/doctor-queries";
import DoctorDirectory from "./_components/doctor-directory";
import DoctorsShell from "./_components/doctors-shell";
import DoctorsSkeleton from "./_components/doctors-skeleton";

export const instant = false;

export const metadata: Metadata = {
  title: "Our Doctors",
  description: `Meet the doctors at ${BRAND_NAME}: qualifications, specializations and experience, with online appointment requests.`,
  alternates: { canonical: "/doctors" },
  openGraph: {
    type: "website",
    title: `Our Doctors | ${BRAND_NAME}`,
    description: `Meet the doctors at ${BRAND_NAME} and request an appointment.`,
    url: "/doctors",
  },
};

function pageNumber(value: string | string[] | undefined) {
  const parsed = Number(Array.isArray(value) ? value[0] : value);
  return Number.isInteger(parsed) && parsed >= 1 && parsed <= 10_000 ? parsed : 1;
}

async function DoctorList({ searchParams }: { searchParams: PageProps<"/doctors">["searchParams"] }) {
  const requested = pageNumber((await searchParams).page);
  const [clinic, first] = await Promise.all([getClinicIdentity(), getPublishedDoctors(requested)]);
  // A page past the end (e.g. a doctor was unpublished since the link was made) shows the last page.
  const page = Math.min(requested, first.pageCount);
  const directory = page === requested ? first : await getPublishedDoctors(page);
  return (
    <DoctorsShell clinic={clinic}>
      <DoctorDirectory doctors={directory.doctors} page={page} pageCount={directory.pageCount} total={directory.total} />
    </DoctorsShell>
  );
}

// The skeleton is shown only for this list. The profile page deliberately has no such boundary: it
// must decide "found or 404" before the response starts, so an unknown doctor gets a real 404 status.
export default function DoctorsPage(props: PageProps<"/doctors">) {
  return (
    <Suspense fallback={<div data-public-site className="min-h-screen bg-purple-50/30"><DoctorsSkeleton /></div>}>
      <DoctorList searchParams={props.searchParams} />
    </Suspense>
  );
}
