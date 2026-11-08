"use client";

import {
  ArrowRight,
  Banknote,
  CalendarCheck,
  Clock3,
  Droplet,
  FlaskConical,
  Gauge,
  HeartPulse,
  House,
  Info,
  ListChecks,
  Microscope,
  Package,
  Scissors,
  ScanLine,
  Search,
  ShieldCheck,
  Smile,
  Sparkles,
  X,
} from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import Modal from "@/components/shared/modal";
import { localize, usePublicLanguage, type PublicLanguage } from "./public-language";
import type { ClinicService } from "./types";

// ---- text helpers: prefer the visitor's language, fall back to the other one ----

export const pick = (language: PublicLanguage, en: string | null | undefined, bn: string | null | undefined) =>
  ((language === "bn" ? bn || en : en || bn) ?? "").trim();

const pickList = (language: PublicLanguage, en: string[], bn: string[]) =>
  language === "bn" ? (bn.length ? bn : en) : (en.length ? en : bn);

export const serviceName = (service: ClinicService, language: PublicLanguage) =>
  language === "bn" && service.nameBn ? service.nameBn : service.name;

export const categoryName = (service: ClinicService, language: PublicLanguage) =>
  (language === "bn" && service.categoryBn ? service.categoryBn : service.category) || localize(language, "Service", "সেবা");

export const numberFormat = (language: PublicLanguage) => new Intl.NumberFormat(language === "bn" ? "bn-BD" : "en-US", { maximumFractionDigits: 0 });

export function feeLabel(service: ClinicService, language: PublicLanguage): string {
  const price = Number(service.standardPrice);
  const max = service.feeMax === null ? 0 : Number(service.feeMax);
  if (!(price > 0)) return localize(language, "Contact us for pricing", "ফি জানতে যোগাযোগ করুন");
  // The taka sign goes in front in Bangla; English keeps the BDT code.
  const money = (amount: number) =>
    language === "bn" ? `৳${numberFormat("bn").format(amount)}` : `BDT ${numberFormat("en").format(amount)}`;
  return max > price ? `${money(price)} – ${money(max)}` : money(price);
}

export function timeLabel(service: ClinicService, language: PublicLanguage): string {
  const custom = pick(language, service.timeTextEn, service.timeTextBn);
  if (custom) return custom;
  return `${numberFormat(language).format(service.durationMinutes)} ${localize(language, "min", "মিনিট")}`;
}

// ---- icons ----

type IconName = "general" | "blood" | "lab" | "package" | "home" | "smile" | "cosmetic" | "endodontics" | "surgery" | "preventive" | "xray";

function iconName(service: ClinicService): IconName {
  const chosen = service.iconKey;
  if (chosen === "general" || chosen === "blood" || chosen === "lab" || chosen === "package" || chosen === "home" || chosen === "smile" || chosen === "cosmetic" || chosen === "endodontics" || chosen === "surgery" || chosen === "preventive" || chosen === "xray") return chosen;
  // No icon chosen: guess from the category, so a freshly added test still looks right.
  if (/haemat|hemat|blood/i.test(service.category)) return "blood";
  if (/biochem|serolog|hormon|urine|microbio|patholog|lab/i.test(service.category)) return "lab";
  if (/package|profile|check-?up/i.test(service.category)) return "package";
  if (/home|collection/i.test(service.category)) return "home";
  if (/cosmetic|whiten|beauty|aesthetic/i.test(service.category)) return "cosmetic";
  if (/endo/i.test(service.category)) return "endodontics";
  if (/surgery|implant/i.test(service.category)) return "surgery";
  if (/prevent|clean/i.test(service.category)) return "preventive";
  if (/diagnos|x-?ray/i.test(service.category)) return "xray";
  return "general";
}

export function ServiceIcon({ service, size }: { service: ClinicService; size: number }) {
  switch (iconName(service)) {
    case "blood": return <Droplet size={size} aria-hidden="true" />;
    case "lab": return <FlaskConical size={size} aria-hidden="true" />;
    case "package": return <Package size={size} aria-hidden="true" />;
    case "home": return <House size={size} aria-hidden="true" />;
    case "smile": return <Smile size={size} aria-hidden="true" />;
    case "cosmetic": return <Sparkles size={size} aria-hidden="true" />;
    case "endodontics": return <Microscope size={size} aria-hidden="true" />;
    case "surgery": return <Scissors size={size} aria-hidden="true" />;
    case "preventive": return <ShieldCheck size={size} aria-hidden="true" />;
    case "xray": return <ScanLine size={size} aria-hidden="true" />;
    default: return <HeartPulse size={size} aria-hidden="true" />;
  }
}

// ---- card ----

function ServiceRow({
  service,
  language,
  onDetails,
  onBook,
}: {
  service: ClinicService;
  language: PublicLanguage;
  onDetails: () => void;
  onBook: () => void;
}) {
  const badge = pick(language, service.badgeEn, service.badgeBn);
  const description = (language === "bn" && service.descriptionBn) || service.description
    || pick(language, service.detailsEn, service.detailsBn)
    || "";
  const name = serviceName(service, language);
  return (
    <li className="grid items-center gap-x-5 gap-y-3 border-b border-purple-200 px-4 py-4 last:border-b-0 sm:px-5 md:grid-cols-[minmax(0,1fr)_7rem_8rem_15rem]">
      <div className="flex min-w-0 items-center gap-4">
        <span className="grid size-11 shrink-0 place-items-center rounded-full bg-purple-100 text-purple-700"><ServiceIcon service={service} size={20} /></span>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <h3 className="text-base font-bold leading-snug text-ink">{name}</h3>
            {badge && <span className="rounded-sm bg-purple-100 px-2 py-0.5 text-xs font-semibold text-purple-800">{badge}</span>}
          </div>
          {description && <p className="mt-0.5 line-clamp-1 text-sm text-slate-600">{description}</p>}
        </div>
      </div>
      <p className="text-sm text-slate-700">
        <span className="text-slate-500 md:sr-only">{localize(language, "Report time", "সময়")}: </span>{timeLabel(service, language)}
      </p>
      <p className="text-base font-bold tabular-nums text-ink">
        <span className="text-sm font-normal text-slate-500 md:sr-only">{localize(language, "Fee", "ফি")}: </span>{feeLabel(service, language)}
      </p>
      <div className="flex items-center gap-2 md:justify-end">
        <button type="button" onClick={onDetails} className="inline-flex min-h-10 items-center justify-center whitespace-nowrap rounded-md border border-purple-700 px-4 text-sm font-semibold text-purple-700 transition-colors hover:bg-purple-100">
          {localize(language, "Details", "বিস্তারিত")}<span className="sr-only"> — {name}</span>
        </button>
        <button type="button" onClick={onBook} className="inline-flex min-h-10 items-center justify-center gap-2 whitespace-nowrap rounded-md bg-cta px-4 text-sm font-semibold text-purple-950 transition-colors hover:bg-cta-dark">
          <CalendarCheck size={15} aria-hidden="true" /> {localize(language, "Book", "বুক করুন")}<span className="sr-only"> — {name}</span>
        </button>
      </div>
    </li>
  );
}

// ---- details window ----

function DetailsModal({
  service,
  language,
  onClose,
  onBook,
}: {
  service: ClinicService;
  language: PublicLanguage;
  onClose: () => void;
  onBook: () => void;
}) {
  const details = pick(language, service.detailsEn, service.detailsBn) || (language === "bn" && service.descriptionBn) || service.description || "";
  const steps = pickList(language, service.stepsEn, service.stepsBn);
  const comfort = pick(language, service.painTextEn, service.painTextBn);
  const stats = [
    { icon: <Clock3 size={13} aria-hidden="true" />, label: localize(language, "Duration", "সময়সীমা"), value: timeLabel(service, language) },
    ...(comfort ? [{ icon: <Gauge size={13} aria-hidden="true" />, label: localize(language, "Comfort level", "আরামের মাত্রা"), value: comfort }] : []),
    { icon: <Banknote size={13} aria-hidden="true" />, label: localize(language, "Estimated fee", "আনুমানিক ফি"), value: feeLabel(service, language) },
  ];
  const digits = numberFormat(language);

  return (
    <Modal className="service-details-modal" labelledBy="service-details-title" onRequestClose={onClose}>
      <header className="service-details-header">
        <div>
          <span className="inline-block rounded-full bg-white/20 px-3 py-1 text-xs font-bold">{categoryName(service, language)}</span>
          <h2 id="service-details-title" className="mt-3 text-2xl font-bold leading-tight sm:text-3xl">{serviceName(service, language)}</h2>
        </div>
        <button type="button" onClick={onClose} aria-label={localize(language, "Close", "বন্ধ করুন")} className="grid size-10 shrink-0 place-items-center rounded-full bg-white/20 transition-colors hover:bg-white/30">
          <X size={20} aria-hidden="true" />
        </button>
      </header>
      <div className="service-details-body">
        <dl className="grid gap-3 rounded-lg border border-purple-100 bg-purple-50/60 p-4 text-center" style={{ gridTemplateColumns: `repeat(${stats.length}, minmax(0, 1fr))` }}>
          {stats.map(({ icon, label, value }) => (
            <div key={label} className="min-w-0">
              <dt className="flex items-center justify-center gap-1.5 text-xs font-medium text-slate-500">{icon} {label}</dt>
              <dd className="mt-1 text-sm font-bold text-purple-800 sm:text-base">{value}</dd>
            </div>
          ))}
        </dl>
        {details ? (
          <section className="mt-6">
            <h3 className="flex items-center gap-2 text-lg font-bold text-slate-900"><Info size={18} className="text-purple-700" aria-hidden="true" /> {localize(language, "About this test", "বিস্তারিত বিবরণ")}</h3>
            <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-slate-600 sm:text-base">{details}</p>
          </section>
        ) : (
          <p className="mt-6 rounded-xl bg-slate-50 px-4 py-3 text-sm text-slate-600">{localize(language, "Contact the center for more details about this test.", "এই পরীক্ষা সম্পর্কে আরও জানতে কেন্দ্রে যোগাযোগ করুন।")}</p>
        )}
        {steps.length > 0 && (
          <section className="mt-6">
            <h3 className="flex items-center gap-2 text-lg font-bold text-slate-900"><ListChecks size={18} className="text-purple-700" aria-hidden="true" /> {localize(language, "How it works", "পরীক্ষার মূল ধাপসমূহ")}</h3>
            <ol className="mt-3 space-y-2">
              {steps.map((step, index) => (
                <li key={`${index}-${step}`} className="flex items-start gap-3 rounded-xl border border-purple-100 bg-purple-50/50 px-4 py-3 text-sm leading-relaxed text-slate-700">
                  <span className="mt-0.5 grid size-6 shrink-0 place-items-center rounded-full bg-purple-700 text-xs font-bold text-white">{digits.format(index + 1)}</span>
                  <span>{step}</span>
                </li>
              ))}
            </ol>
          </section>
        )}
      </div>
      <footer className="service-details-footer">
        <button type="button" onClick={onClose} className="min-h-12 rounded-xl bg-slate-100 px-4 text-sm font-bold text-slate-700 transition-colors hover:bg-slate-200">{localize(language, "Close", "বন্ধ করুন")}</button>
        <button type="button" onClick={onBook} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-cta px-4 text-sm font-bold text-purple-950 transition-colors hover:bg-cta-dark">
          <CalendarCheck size={16} aria-hidden="true" /> {localize(language, "Book this test", "এখনই বুকিং করুন")}
        </button>
      </footer>
    </Modal>
  );
}

// ---- section ----

export default function PublicServices({
  services,
  onBook,
  previewCount,
}: {
  services: ClinicService[];
  /** Called with the chosen service; the page scrolls to the booking form with it selected. */
  onBook: (service: ClinicService) => void;
  /** On the home page, show only this many (until a filter or search is used) with a link to the full list. */
  previewCount?: number;
}) {
  const { language } = usePublicLanguage();
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("ALL");
  const [viewing, setViewing] = useState<ClinicService | null>(null);

  const categories = useMemo(() => {
    const seen = new Map<string, ClinicService>();
    // The pill is labelled from any service in the category that has a Bangla category name.
    for (const service of services) {
      const current = seen.get(service.category);
      if (!current || (!current.categoryBn && service.categoryBn)) seen.set(service.category, service);
    }
    return [...seen.entries()].map(([key, sample]) => ({ key, sample }));
  }, [services]);

  const needle = search.trim().toLocaleLowerCase();
  const matching = services.filter((service) => {
    if (category !== "ALL" && service.category !== category) return false;
    if (!needle) return true;
    const haystack = [service.name, service.nameBn, service.category, service.categoryBn, service.description, service.descriptionBn, service.badgeEn, service.badgeBn]
      .filter(Boolean).join(" ").toLocaleLowerCase();
    return haystack.includes(needle);
  });
  const preview = Boolean(previewCount) && category === "ALL" && !needle && matching.length > (previewCount ?? 0);
  const visible = preview ? matching.slice(0, previewCount) : matching;

  function book(service: ClinicService) {
    setViewing(null);
    onBook(service);
  }

  if (!services.length) {
    return <p className="rounded-lg border border-purple-100 bg-white px-4 py-10 text-center text-sm text-slate-500">{localize(language, "There are no services to show yet.", "এখনো দেখানোর মতো কোনো সেবা নেই।")}</p>;
  }

  return (
    <>
      <div className="mb-8 flex flex-col gap-4 lg:mb-10 lg:flex-row lg:items-start lg:justify-between lg:gap-8">
        <div
          className="order-2 -mx-4 flex snap-x scroll-px-4 gap-2 overflow-x-auto px-4 pb-2 [scrollbar-width:none] sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0 sm:pb-0 lg:order-1 lg:flex-1 [&::-webkit-scrollbar]:hidden"
          role="group"
          aria-label={localize(language, "Filter by category", "ক্যাটাগরি অনুযায়ী বাছুন")}
        >
          {[{ key: "ALL", label: localize(language, "All services", "সকল সেবা") }, ...categories.map(({ key, sample }) => ({ key, label: categoryName(sample, language) }))].map((item) => (
            <button
              key={item.key}
              type="button"
              aria-pressed={category === item.key}
              onClick={(event) => {
                setCategory(item.key);
                event.currentTarget.scrollIntoView({ block: "nearest", inline: "center", behavior: "smooth" });
              }}
              className={`min-h-10 shrink-0 snap-start whitespace-nowrap rounded-full px-5 text-sm font-medium leading-normal transition-colors ${category === item.key ? "bg-purple-700 text-white" : "border border-purple-200 bg-white text-ink hover:bg-purple-100"}`}
            >
              {item.label}
            </button>
          ))}
        </div>
        <label className="relative order-1 block w-full lg:order-2 lg:w-72 lg:shrink-0">
          <span className="sr-only">{localize(language, "Search services", "সেবা খুঁজুন")}</span>
          <Search size={16} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-600" aria-hidden="true" />
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder={localize(language, "Search services…", "সেবা খুঁজুন…")}
            className="min-h-11 w-full rounded-md border border-purple-500 bg-white pl-11 pr-4 text-sm outline-none placeholder:text-slate-600 focus:border-purple-700 focus:ring-2 focus:ring-purple-200"
          />
        </label>
      </div>
      <p className="sr-only" aria-live="polite">{localize(language, `${visible.length} services shown`, `${numberFormat(language).format(visible.length)}টি সেবা দেখানো হচ্ছে`)}</p>
      {visible.length ? (
        <div className="overflow-hidden rounded-xl border border-purple-200 bg-white">
          <div className="hidden grid-cols-[minmax(0,1fr)_7rem_8rem_15rem] gap-x-5 border-b border-purple-200 bg-purple-50 px-5 py-3 text-sm font-semibold text-purple-900 md:grid" aria-hidden="true">
            <span>{localize(language, "Test", "পরীক্ষা")}</span>
            <span>{localize(language, "Report time", "সময়")}</span>
            <span>{localize(language, "Fee", "ফি")}</span>
            <span className="text-right">{localize(language, "Action", "অ্যাকশন")}</span>
          </div>
          <ul>
            {visible.map((service) => (
              <ServiceRow key={service.id} service={service} language={language} onDetails={() => setViewing(service)} onBook={() => book(service)} />
            ))}
          </ul>
        </div>
      ) : (
        <p className="rounded-lg border border-purple-100 bg-white px-4 py-10 text-center text-sm text-slate-500">{localize(language, "No services match your search.", "আপনার খোঁজের সঙ্গে কোনো সেবা মেলেনি।")}</p>
      )}
      {preview && (
        <div className="mt-8">
          <Link href="/our-services" className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full border border-purple-700 bg-white px-6 text-sm font-semibold text-purple-700 hover:bg-purple-100">
            {localize(language, `View all ${matching.length} tests & services`, `সব ${numberFormat(language).format(matching.length)}টি পরীক্ষা ও সেবা দেখুন`)} <ArrowRight size={15} aria-hidden="true" />
          </Link>
        </div>
      )}
      {viewing && <DetailsModal service={viewing} language={language} onClose={() => setViewing(null)} onBook={() => book(viewing)} />}
    </>
  );
}
