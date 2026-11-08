"use client";

import Link from "next/link";
import { ArrowLeft, Award, BadgeCheck, CalendarCheck, Clock3, GraduationCap, Stethoscope, Wallet } from "lucide-react";
import type { ReactNode } from "react";
import { localize, usePublicLanguage } from "@/app/public_website/components/public-language";
import type { PublicDoctor } from "./doctor-types";
import DoctorPhoto from "./doctor-photo";
import { formatFee, formatNumber, groupedHours, specialtyList } from "./public-format";

function Section({ icon, title, children }: { icon: ReactNode; title: string; children: ReactNode }) {
  return (
    <section className="rounded-lg border border-purple-100 bg-white p-5 shadow-sm sm:p-6">
      <h2 className="flex items-center gap-2 text-lg font-bold text-slate-900"><span className="text-purple-700" aria-hidden>{icon}</span>{title}</h2>
      <div className="mt-3 text-sm leading-relaxed text-slate-700">{children}</div>
    </section>
  );
}

/** One doctor's full profile with the appointment call-to-action. */
export default function DoctorProfileView({ doctor }: { doctor: PublicDoctor }) {
  const { language } = usePublicLanguage();
  const hours = groupedHours(doctor.schedules, language);
  const hasConsultation = Boolean(doctor.consultationFee || doctor.consultationInfo || hours.length);
  const bookButton = (
    <Link href="/#appointment" className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-cta px-5 py-3 text-sm font-semibold text-purple-950 shadow-md shadow-purple-700/25 transition-colors hover:bg-cta-dark">
      <CalendarCheck size={17} aria-hidden />{localize(language, "Book an appointment", "সিরিয়াল নিন")}
    </Link>
  );

  return (
    <div className="mx-auto max-w-6xl px-4 py-5 sm:px-6 md:py-6 lg:px-8">
      <Link href="/doctors" className="inline-flex items-center gap-1.5 text-sm font-semibold text-purple-800 hover:underline">
        <ArrowLeft size={16} aria-hidden />{localize(language, "All doctors", "সব চিকিৎসক")}
      </Link>

      <article className="mt-5 grid gap-6 lg:grid-cols-[320px_1fr]">
        <aside className="space-y-4 lg:sticky lg:top-24 lg:self-start">
          <div className="overflow-hidden rounded-lg border border-purple-100 bg-white shadow-sm">
            <DoctorPhoto name={doctor.name} imageUrl={doctor.imageUrl} priority className="aspect-[4/3] w-full lg:aspect-square" />
            <div className="space-y-3 p-5">
              {bookButton}
              <p className="text-center text-xs text-slate-500">{localize(language, "Appointments are requested through the clinic's booking form.", "ক্লিনিকের বুকিং ফর্মের মাধ্যমে সিরিয়ালের অনুরোধ করুন।")}</p>
            </div>
          </div>
        </aside>

        <div className="space-y-5">
          <header className="rounded-lg border border-purple-100 bg-white p-5 shadow-sm sm:p-6">
            <h1 className="text-3xl font-bold leading-tight tracking-tight text-slate-900 sm:text-4xl">{doctor.name}</h1>
            {doctor.designation && <p className="mt-1 text-base font-semibold text-purple-700">{doctor.designation}</p>}
            {doctor.qualifications && <p className="mt-2 text-sm text-slate-600">{doctor.qualifications}</p>}
            <dl className="mt-4 flex flex-wrap gap-2 text-xs font-semibold">
              {doctor.experienceYears != null && (
                <div className="inline-flex items-center gap-1.5 rounded-lg border border-purple-200 bg-purple-50 px-3 py-1.5 text-purple-900">
                  <dt className="sr-only">{localize(language, "Experience", "অভিজ্ঞতা")}</dt>
                  <dd className="inline-flex items-center gap-1.5"><Award size={14} aria-hidden />{localize(language, `${formatNumber(doctor.experienceYears, language)} years of experience`, `${formatNumber(doctor.experienceYears, language)} বছরের অভিজ্ঞতা`)}</dd>
                </div>
              )}
              {doctor.registrationNumber && (
                <div className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-slate-700">
                  <dt className="inline-flex items-center gap-1.5"><BadgeCheck size={14} aria-hidden />{localize(language, "Registration no.", "নিবন্ধন নং")}</dt>
                  <dd>{doctor.registrationNumber}</dd>
                </div>
              )}
            </dl>
          </header>

          {doctor.bio && (
            <Section icon={<GraduationCap size={19} />} title={localize(language, "About", "পরিচিতি")}>
              <p className="whitespace-pre-line">{doctor.bio}</p>
            </Section>
          )}

          <Section icon={<Stethoscope size={19} />} title={localize(language, "Specialization and expertise", "বিশেষজ্ঞতা")}>
            <ul className="flex flex-wrap gap-2">
              {specialtyList(doctor.specialization).map((item) => (
                <li key={item} className="rounded-lg border border-purple-200 bg-purple-50 px-3 py-1.5 text-sm font-semibold text-purple-900">{item}</li>
              ))}
            </ul>
            <p className="mt-3 text-slate-600">
              {localize(language, "See the tests and services we offer on our ", "আমাদের পরীক্ষা ও সেবাগুলো দেখুন ")}
              <Link href="/#services" className="font-semibold text-purple-800 underline">{localize(language, "services section", "সেবা বিভাগে")}</Link>.
            </p>
          </Section>

          {hasConsultation && (
            <Section icon={<Clock3 size={19} />} title={localize(language, "Consultation information", "পরামর্শের তথ্য")}>
              <div className="space-y-4">
                {doctor.consultationFee && (
                  <p className="flex items-center gap-2"><Wallet size={16} className="text-purple-700" aria-hidden />
                    <span><strong>{localize(language, "Consultation fee:", "পরামর্শ ফি:")}</strong> {formatFee(doctor.consultationFee, language)}</span>
                  </p>
                )}
                {hours.length > 0 && (
                  <dl className="divide-y divide-purple-50 rounded-xl border border-purple-100">
                    {hours.map((group) => (
                      <div key={group.key} className="flex flex-wrap justify-between gap-x-4 px-4 py-2.5">
                        <dt className="font-semibold text-slate-700">{group.days}</dt>
                        <dd className="font-semibold text-purple-700">{group.hours}</dd>
                      </div>
                    ))}
                  </dl>
                )}
                {doctor.consultationInfo && <p className="whitespace-pre-line">{doctor.consultationInfo}</p>}
              </div>
            </Section>
          )}

          <div className="lg:hidden">{bookButton}</div>
        </div>
      </article>
    </div>
  );
}
