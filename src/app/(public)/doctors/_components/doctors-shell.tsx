"use client";

import type { ReactNode } from "react";
import AnnouncementTicker from "@/app/public_website/components/announcement-ticker";
import PublicHeader from "@/app/public_website/components/public-header";
import { localize, PublicLanguageProvider, usePublicLanguage } from "@/app/public_website/components/public-language";
import type { PublicClinicIdentity } from "./doctor-types";

function Chrome({ clinic, children }: { clinic: PublicClinicIdentity; children: ReactNode }) {
  const { language } = usePublicLanguage();
  // Same items as the home page menu; Doctors sits after About (or second if there is no About).
  const doctors = { key: "doctors", href: "/doctors", label: { en: "Doctors", bn: "চিকিৎসক" } };
  const navItems = clinic.nav.flatMap((item) => [item, ...(item.key === "about" ? [doctors] : [])]);
  if (!clinic.nav.some((item) => item.key === "about")) navItems.splice(Math.min(1, navItems.length), 0, doctors);
  return (
    <div data-public-site lang={language} className="flex min-h-screen flex-col bg-purple-50/30 text-slate-800 antialiased">
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-3 focus:top-3 focus:z-50 focus:rounded-lg focus:bg-white focus:px-3 focus:py-2 focus:text-sm focus:font-semibold focus:text-purple-800">
        {localize(language, "Skip to content", "মূল অংশে যান")}
      </a>
      <PublicHeader phone={null} clinicName={clinic.clinicName} clinicSubtitle={clinic.clinicSubtitle} navItems={navItems.map((item) => ({ anchor: item.key, href: item.href, label: item.label }))} />
      <AnnouncementTicker items={clinic.announcements} label={clinic.announcementLabel} />
      <main id="main" className="flex-1">{children}</main>
      <footer className="bg-purple-950 py-8 text-purple-200">
        <div className="site-container flex flex-col gap-2 text-xs md:flex-row md:items-center md:justify-between">
          <p className="text-base font-bold text-white">{clinic.clinicName} {clinic.clinicSubtitle}</p>
          <p>{localize(language, "Profiles are provided by the clinic for information only.", "প্রোফাইলের তথ্য ক্লিনিক কর্তৃক শুধুমাত্র তথ্যের জন্য দেওয়া হয়েছে।")}</p>
        </div>
      </footer>
    </div>
  );
}

/** Page frame (header, language switch, footer) for the public doctor pages. */
export default function DoctorsShell({ clinic, children }: { clinic: PublicClinicIdentity; children: ReactNode }) {
  return (
    <PublicLanguageProvider>
      <Chrome clinic={clinic}>{children}</Chrome>
    </PublicLanguageProvider>
  );
}
