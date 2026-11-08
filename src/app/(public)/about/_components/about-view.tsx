"use client";

import Image from "next/image";
import Link from "next/link";
import { ArrowRight, CalendarCheck, CheckCircle2 } from "lucide-react";
import { localize, usePublicLanguage } from "@/app/public_website/components/public-language";
import type { AboutData } from "@/app/public_website/queries/about-queries";
import type { PublicClinicIdentity } from "@/app/(public)/doctors/_components/doctor-types";

/** The About page: the centre's introduction first, then the consultant. */
export default function AboutView({ clinic, data }: { clinic: PublicClinicIdentity; data: AboutData }) {
  const { language } = usePublicLanguage();
  const { about, doctor, doctorCount } = data;
  const bn = language === "bn";
  // The visitor's language first; the other one when it is empty.
  const pick = (en: string, bnText: string) => (bn ? bnText : en).trim() || (bn ? en : bnText).trim();
  const list = (en: string[], bnList: string[]) => ((bn ? bnList : en).length ? (bn ? bnList : en) : (bn ? en : bnList));
  const text = pick(about.centreAboutEn, about.centreAboutBn);
  const facts = list(about.centreFactsEn, about.centreFactsBn);
  const highlights = list(about.doctorHighlightsEn, about.doctorHighlightsBn);
  const hasCentre = Boolean(text || facts.length);
  const name = `${clinic.clinicName} ${clinic.clinicSubtitle}`;

  return (
    <div className="site-container space-y-8 py-6 md:py-8">
      <header>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">{localize(language, "About us", "আমাদের সম্পর্কে")}</h1>
      </header>

      {hasCentre ? (
        <section aria-labelledby="about-centre" className={`grid items-start gap-8 ${about.centreImageUrl ? "lg:grid-cols-2" : ""}`}>
          <div className="space-y-4">
            <h2 id="about-centre" className="text-2xl font-bold text-slate-900 sm:text-3xl">{name}</h2>
            {text && <p className="whitespace-pre-line text-base leading-relaxed text-slate-600">{text}</p>}
            {facts.length > 0 && (
              <ul className="grid gap-2 text-sm font-medium text-slate-700 sm:grid-cols-2">
                {facts.map((line) => <li key={line} className="flex items-start gap-2"><CheckCircle2 size={16} className="mt-0.5 shrink-0 text-emerald-600" aria-hidden /> {line}</li>)}
              </ul>
            )}
          </div>
          {about.centreImageUrl && (
            <div className="overflow-hidden rounded-lg border border-purple-100 shadow-xl">
              <Image src={about.centreImageUrl} alt={name} width={1000} height={700} unoptimized priority className="h-64 w-full object-cover sm:h-[380px]" />
            </div>
          )}
        </section>
      ) : (
        <p className="text-slate-600">{localize(language, "Information about the centre will appear here soon.", "সেন্টারের তথ্য শীঘ্রই এখানে দেখা যাবে।")}</p>
      )}

      {doctor && (
        <section aria-labelledby="about-consultant" className="rounded-lg border border-purple-100 bg-white p-5 shadow-sm sm:p-6">
          <h2 id="about-consultant" className="text-xl font-bold text-slate-900">{localize(language, "Our consultant", "আমাদের পরামর্শক চিকিৎসক")}</h2>
          <div className="mt-3 grid gap-5 lg:grid-cols-[220px_1fr]">
            {about.doctorImageUrl && <Image src={about.doctorImageUrl} alt={doctor.name} width={440} height={440} unoptimized className="aspect-square w-full max-w-[220px] rounded-lg object-cover" />}
            <div className="space-y-2">
              <p className="text-lg font-bold text-slate-900">{doctor.name}</p>
              <p className="text-sm font-semibold text-purple-700">{[doctor.qualifications, doctor.specialization].filter(Boolean).join(" · ")}</p>
              {highlights.length > 0 && (
                <ul className="space-y-1.5 text-sm font-medium text-slate-700">
                  {highlights.map((line) => <li key={line} className="flex items-start gap-2"><CheckCircle2 size={16} className="mt-0.5 shrink-0 text-emerald-600" aria-hidden /> {line}</li>)}
                </ul>
              )}
              {doctor.bio && <p className="whitespace-pre-line text-sm leading-relaxed text-slate-600">{doctor.bio}</p>}
            </div>
          </div>
        </section>
      )}

      <div className="flex flex-wrap gap-3">
        {doctorCount > 0 && (
          <Link href="/doctors" className="inline-flex items-center gap-2 rounded-xl border border-purple-200 bg-white px-5 py-2.5 text-sm font-semibold text-purple-800 hover:bg-purple-50">
            {localize(language, "Meet our doctors", "আমাদের চিকিৎসকগণ")} <ArrowRight size={16} aria-hidden />
          </Link>
        )}
        <Link href="/#appointment" className="inline-flex items-center gap-2 rounded-xl bg-cta px-5 py-2.5 text-sm font-semibold text-purple-950 hover:bg-cta-dark">
          <CalendarCheck size={16} aria-hidden /> {localize(language, "Book an appointment", "সিরিয়াল নিন")}
        </Link>
      </div>
    </div>
  );
}
