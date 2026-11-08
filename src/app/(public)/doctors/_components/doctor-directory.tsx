"use client";

import Link from "next/link";
import { Award, CalendarCheck, ChevronLeft, ChevronRight, Stethoscope, UserRound } from "lucide-react";
import { localize, usePublicLanguage } from "@/app/public_website/components/public-language";
import type { PublicDoctor } from "./doctor-types";
import DoctorPhoto from "./doctor-photo";
import { formatFee, formatNumber, specialtyList } from "./public-format";

function DoctorCard({ doctor, priority }: { doctor: PublicDoctor; priority: boolean }) {
  const { language } = usePublicLanguage();
  const profileHref = `/doctors/${doctor.slug}`;
  return (
    <li>
      <article className="flex h-full flex-col overflow-hidden rounded-lg border border-purple-100 bg-white shadow-sm transition-shadow hover:shadow-md">
        <Link href={profileHref} tabIndex={-1} aria-hidden className="block">
          <DoctorPhoto name={doctor.name} imageUrl={doctor.imageUrl} priority={priority} className="aspect-[16/9] w-full" />
        </Link>
        <div className="flex flex-1 flex-col gap-3 p-5">
          <header>
            <h2 className="text-lg font-bold leading-snug text-slate-900">
              <Link href={profileHref} className="hover:text-purple-800 focus-visible:underline">{doctor.name}</Link>
            </h2>
            {doctor.designation && <p className="mt-0.5 text-sm font-semibold text-purple-700">{doctor.designation}</p>}
            {doctor.qualifications && <p className="mt-1 text-sm text-slate-600">{doctor.qualifications}</p>}
          </header>
          <ul className="flex flex-wrap gap-1.5" aria-label={localize(language, "Specialization", "বিশেষজ্ঞতা")}>
            {specialtyList(doctor.specialization).map((item) => (
              <li key={item} className="inline-flex items-center gap-1 rounded-lg border border-purple-200 bg-purple-50 px-2.5 py-1 text-xs font-semibold text-purple-900"><Stethoscope size={12} aria-hidden />{item}</li>
            ))}
          </ul>
          <dl className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-600">
            {doctor.experienceYears != null && (
              <div className="flex items-center gap-1.5">
                <dt className="sr-only">{localize(language, "Experience", "অভিজ্ঞতা")}</dt>
                <dd className="inline-flex items-center gap-1.5"><Award size={14} className="text-purple-700" aria-hidden />
                  {localize(language, `${formatNumber(doctor.experienceYears, language)} years experience`, `${formatNumber(doctor.experienceYears, language)} বছরের অভিজ্ঞতা`)}
                </dd>
              </div>
            )}
            {doctor.consultationFee && (
              <div className="flex items-center gap-1.5">
                <dt className="font-semibold">{localize(language, "Consultation fee:", "পরামর্শ ফি:")}</dt>
                <dd>{formatFee(doctor.consultationFee, language)}</dd>
              </div>
            )}
          </dl>
          {doctor.bio && <p className="line-clamp-3 text-sm leading-relaxed text-slate-600">{doctor.bio}</p>}
          <div className="mt-auto flex flex-wrap gap-2 pt-2">
            <Link href={profileHref} className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl border border-purple-200 bg-white px-4 py-2.5 text-sm font-semibold text-purple-800 transition-colors hover:bg-purple-50">
              <UserRound size={16} aria-hidden />{localize(language, "View profile", "প্রোফাইল দেখুন")}
              <span className="sr-only"> — {doctor.name}</span>
            </Link>
            <Link href="/#appointment" className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-cta px-4 py-2.5 text-sm font-semibold text-purple-950 shadow-md shadow-purple-700/20 transition-colors hover:bg-cta-dark">
              <CalendarCheck size={16} aria-hidden />{localize(language, "Book appointment", "সিরিয়াল নিন")}
            </Link>
          </div>
        </div>
      </article>
    </li>
  );
}

function Pagination({ page, pageCount }: { page: number; pageCount: number }) {
  const { language } = usePublicLanguage();
  if (pageCount <= 1) return null;
  const href = (value: number) => (value <= 1 ? "/doctors" : `/doctors?page=${value}`);
  const linkClass = "inline-flex items-center gap-1 rounded-xl border border-purple-200 bg-white px-4 py-2 text-sm font-semibold text-purple-800 hover:bg-purple-50";
  return (
    <nav className="mt-10 flex items-center justify-center gap-3" aria-label={localize(language, "Pages", "পাতা")}>
      {page > 1 ? <Link href={href(page - 1)} rel="prev" className={linkClass}><ChevronLeft size={16} aria-hidden />{localize(language, "Previous", "আগের")}</Link> : <span />}
      <span className="text-sm text-slate-600" aria-current="page">{localize(language, `Page ${page} of ${pageCount}`, `পাতা ${formatNumber(page, language)} / ${formatNumber(pageCount, language)}`)}</span>
      {page < pageCount ? <Link href={href(page + 1)} rel="next" className={linkClass}>{localize(language, "Next", "পরের")}<ChevronRight size={16} aria-hidden /></Link> : <span />}
    </nav>
  );
}

/** The doctor listing: heading, card grid (or an empty state) and page links. */
export default function DoctorDirectory({ doctors, page, pageCount, total }: { doctors: PublicDoctor[]; page: number; pageCount: number; total: number }) {
  const { language } = usePublicLanguage();
  return (
    <>
      <section className="border-b border-purple-100 bg-gradient-to-br from-purple-100 via-purple-50 to-white py-5 md:py-6">
        <div className="site-container">
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">{localize(language, "Our Doctors", "আমাদের চিকিৎসকগণ")}</h1>
          <p className="mt-1 max-w-2xl text-sm text-slate-600 sm:text-base">
            {localize(language, "Meet the doctors who care for our patients, and request an appointment.", "আমাদের চিকিৎসকদের সম্পর্কে জানুন এবং সিরিয়ালের অনুরোধ পাঠান।")}
          </p>
        </div>
      </section>
      <section className="site-container py-5" aria-label={localize(language, "Doctor list", "চিকিৎসকের তালিকা")}>
        {doctors.length ? (
          <>
            <p className="mb-3 text-sm text-slate-600" aria-live="polite">{localize(language, `${total} doctor${total === 1 ? "" : "s"}`, `${formatNumber(total, language)} জন চিকিৎসক`)}</p>
            <ul className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {doctors.map((doctor, index) => <DoctorCard key={doctor.slug} doctor={doctor} priority={index < 3} />)}
            </ul>
            <Pagination page={page} pageCount={pageCount} />
          </>
        ) : (
          <div className="mx-auto max-w-lg rounded-lg border border-dashed border-purple-200 bg-white px-6 py-14 text-center">
            <span className="mx-auto grid size-12 place-items-center rounded-full bg-purple-50 text-purple-700"><Stethoscope size={22} aria-hidden /></span>
            <h2 className="mt-4 text-lg font-bold text-slate-900">{localize(language, "No doctors to show yet", "এখনো কোনো চিকিৎসকের তথ্য নেই")}</h2>
            <p className="mt-1 text-sm text-slate-600">{localize(language, "Doctor profiles will appear here soon. You can still request an appointment.", "চিকিৎসকদের প্রোফাইল শীঘ্রই এখানে দেখা যাবে। আপনি এখনই সিরিয়ালের অনুরোধ পাঠাতে পারেন।")}</p>
            <Link href="/#appointment" className="mt-5 inline-flex items-center gap-2 rounded-xl bg-cta px-5 py-2.5 text-sm font-semibold text-purple-950 hover:bg-cta-dark">
              <CalendarCheck size={16} aria-hidden />{localize(language, "Book appointment", "সিরিয়াল নিন")}
            </Link>
          </div>
        )}
      </section>
    </>
  );
}
