"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { CalendarDays, LogIn, Menu, Microscope, Phone, X } from "lucide-react";
import { localize, usePublicLanguage } from "./public-language";
import type { Bilingual } from "@/modules/website/schemas/website-layout";

export default function PublicHeader({ phone, clinicName, clinicSubtitle, navItems }: { phone: string | null; clinicName: string; clinicSubtitle: string; navItems: { anchor: string; label: Bilingual; href?: string }[] }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const { language, setLanguage } = usePublicLanguage();
  const pathname = usePathname();
  const tel = phone?.replace(/[^\d+]/g, "");
  const isActive = (href?: string) => Boolean(href) && href === pathname;
  const languageToggle = (className = "") => (
    <div className={`inline-flex shrink-0 rounded-full border border-purple-200 bg-white p-0.5 ${className}`} role="group" aria-label={localize(language, "Choose language", "ভাষা নির্বাচন করুন")}>
      <button type="button" onClick={() => setLanguage("en")} aria-pressed={language === "en"} className={`rounded-full px-2.5 py-1 text-xs font-semibold transition-colors ${language === "en" ? "bg-purple-700 text-white" : "text-purple-900 hover:bg-purple-100"}`}>EN</button>
      <button type="button" onClick={() => setLanguage("bn")} aria-pressed={language === "bn"} className={`rounded-full px-2.5 py-1 text-xs font-semibold transition-colors ${language === "bn" ? "bg-purple-700 text-white" : "text-purple-900 hover:bg-purple-100"}`}>বাংলা</button>
    </div>
  );

  return (
    <header className="sticky top-0 z-40 border-b border-purple-200 bg-white/95 backdrop-blur-md">
      {/* Always one row: brand, menu and actions side by side from 1024px; below that the menu is behind the menu button. */}
      <div className="site-container flex h-16 items-center justify-between gap-x-3 lg:h-[72px] xl:gap-x-4">
        <Link href="/" className="flex min-w-0 flex-1 items-center gap-2.5 py-2 lg:flex-none" aria-label={localize(language, "Go to home", "হোমে ফিরে যান")}>
          <span className="grid size-10 shrink-0 place-items-center rounded-full bg-purple-700 text-white">
            <Microscope size={20} aria-hidden="true" />
          </span>
          <span className="min-w-0">
            <span className="block truncate text-sm font-bold tracking-tight text-purple-900 xl:text-[15px]">{clinicName}</span>
            <span className="block text-xs font-medium text-slate-600">{clinicSubtitle}</span>
          </span>
        </Link>

        <nav className="hidden min-w-0 flex-1 lg:block" aria-label={localize(language, "Main navigation", "প্রধান নেভিগেশন")}>
          <div className="flex flex-nowrap items-center justify-center text-[13px] font-medium text-ink min-[1100px]:text-sm">
            {navItems.map(({ anchor, label, href }) => {
              const className = `relative whitespace-nowrap px-1 py-3 min-[1100px]:px-1.5 xl:px-2 transition-colors hover:text-purple-700 ${isActive(href) ? "text-purple-700 after:absolute after:inset-x-2 after:bottom-1 after:h-0.5 after:bg-purple-700" : ""}`;
              // A page link uses <Link>, so the browser switches pages without reloading the whole site.
              return href
                ? <Link key={anchor} href={href} aria-current={isActive(href) ? "page" : undefined} className={className}>{label[language]}</Link>
                : <a key={anchor} href={`#${anchor}`} className={className}>{label[language]}</a>;
            })}
          </div>
        </nav>

        <div className="flex shrink-0 items-center gap-2 py-2">
          <Link href="/#appointment" aria-label={localize(language, "Book an appointment", "সিরিয়াল নিন")} className="hidden items-center gap-2 rounded-md bg-cta px-3.5 py-2.5 text-sm font-semibold text-purple-950 transition-colors hover:bg-cta-dark md:inline-flex">
            <CalendarDays size={16} aria-hidden="true" /> <span className="hidden min-[1100px]:inline xl:hidden">{localize(language, "Book", "সিরিয়াল নিন")}</span><span className="hidden xl:inline">{localize(language, "Book an appointment", "সিরিয়াল নিন")}</span>
          </Link>
          {languageToggle("hidden md:inline-flex")}
          <Link href="/login" aria-label={localize(language, "Admin login", "অ্যাডমিন লগইন")} className="hidden size-10 items-center justify-center rounded-full border border-purple-200 bg-white text-purple-800 transition-colors hover:bg-purple-100 md:inline-flex">
            <LogIn size={16} aria-hidden="true" />
          </Link>
          <button type="button" className="grid size-10 place-items-center rounded-full border border-purple-200 bg-white text-purple-800 lg:hidden" onClick={() => setMenuOpen(!menuOpen)} aria-label={menuOpen ? localize(language, "Close menu", "মেনু বন্ধ করুন") : localize(language, "Open menu", "মেনু খুলুন")} aria-expanded={menuOpen}>
            {menuOpen ? <X size={19} /> : <Menu size={19} />}
          </button>
        </div>
      </div>

      {menuOpen && (
        <nav className="border-t border-purple-200 bg-white px-4 py-3 lg:hidden" aria-label={localize(language, "Mobile navigation", "মোবাইল নেভিগেশন")}>
          <div className="mx-auto grid max-w-7xl grid-cols-2 gap-2">
            <div className="col-span-2 flex justify-center pb-1">
              {languageToggle()}
            </div>
            {navItems.map(({ anchor, label, href }) => {
              const className = "rounded-md px-3 py-2.5 text-sm font-medium text-ink hover:bg-purple-100 hover:text-purple-800";
              return href
                ? <Link key={anchor} href={href} onClick={() => setMenuOpen(false)} className={className}>{label[language]}</Link>
                : <a key={anchor} href={`#${anchor}`} onClick={() => setMenuOpen(false)} className={className}>{label[language]}</a>;
            })}
            <Link href="/login" onClick={() => setMenuOpen(false)} className="col-span-2 inline-flex items-center justify-center gap-2 rounded-md bg-purple-100 px-3 py-2.5 text-sm font-semibold text-purple-800 hover:bg-purple-200">
              <LogIn size={16} aria-hidden="true" /> {localize(language, "Admin login", "অ্যাডমিন লগইন")}
            </Link>
            {tel && (
              <a href={`tel:${tel}`} onClick={() => setMenuOpen(false)} className="inline-flex items-center justify-center gap-2 rounded-md border border-purple-200 px-3 py-2.5 text-sm font-semibold text-purple-800 hover:bg-purple-100">
                <Phone size={16} aria-hidden="true" /> {localize(language, "Call", "কল করুন")}
              </a>
            )}
            <Link href="/#appointment" onClick={() => setMenuOpen(false)} className="inline-flex items-center justify-center gap-2 rounded-md bg-cta px-3 py-2.5 text-sm font-semibold text-purple-950 hover:bg-cta-dark">
              {localize(language, "Book", "সিরিয়াল নিন")} <CalendarDays size={16} aria-hidden="true" />
            </Link>
          </div>
        </nav>
      )}
    </header>
  );
}
