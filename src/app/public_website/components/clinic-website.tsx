"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  ArrowRight,
  CalendarDays,
  Check,
  FlaskConical,
  House,
  Mail,
  MapPin,
  Microscope,
  Phone,
  X,
} from "lucide-react";
import Modal from "@/components/shared/modal";
import BookingForm from "./booking-form";
import HeroServiceSlider from "./hero-service-slider";
import LayoutIcon from "./layout-icons";
import AnnouncementTicker from "./announcement-ticker";
import PublicHeader from "./public-header";
import PublicServices from "./public-services";
import { localize, PublicLanguageProvider, usePublicLanguage } from "./public-language";
import ReviewsSection from "./reviews-section";
import { NAV_ANCHORS, NAV_KEYS, NAV_PAGES, resolveLayout, type Bilingual, type NavKey } from "@/modules/website/schemas/website-layout";
import { emptyWebsiteContent } from "@/modules/website/schemas/website-content-schema";
import type { ClinicDoctor, ClinicGalleryImage, ClinicService, PublicClinicData } from "./types";
import { BRAND_NAME } from "@/lib/brand";

const weekdayNames = {
  en: ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"],
  bn: ["রবিবার", "সোমবার", "মঙ্গলবার", "বুধবার", "বৃহস্পতিবার", "শুক্রবার", "শনিবার"],
};

function formatTime(value: string, language: "en" | "bn") {
  const [hour, minute] = value.split(":").map(Number);
  const displayHour = hour % 12 || 12;
  const period = hour >= 12 ? "PM" : "AM";
  const locale = language === "bn" ? "bn-BD" : "en-US";
  return `${new Intl.NumberFormat(locale).format(displayHour)}:${new Intl.NumberFormat(locale, { minimumIntegerDigits: 2, useGrouping: false }).format(minute)} ${period}`;
}

function phoneLinks(phone: string | null) {
  if (!phone) return { tel: null, whatsapp: null };
  const digits = phone.replace(/\D/g, "");
  const whatsapp = digits.startsWith("0")
    ? `88${digits}`
    : digits.startsWith("880") ? digits
      : digits.startsWith("1") ? `880${digits}` : null;
  return { tel: phone.replace(/[^\d+]/g, ""), whatsapp };
}

/** Opening hours with neighbouring days that share the same hours joined into one line ("Sunday – Wednesday"). */
function ClinicHours({ doctor, language }: { doctor: ClinicDoctor | null; language: "en" | "bn" }) {
  const schedules = [...(doctor?.schedules ?? [])].sort((a, b) => a.dayOfWeek - b.dayOfWeek);
  const hoursOf = (schedule: ClinicDoctor["schedules"][number]) => schedule.isWorking ? `${formatTime(schedule.startTime, language)} – ${formatTime(schedule.endTime, language)}` : "";
  const groups: { from: number; to: number; hours: string }[] = [];
  for (const schedule of schedules) {
    const hours = hoursOf(schedule);
    const last = groups.at(-1);
    if (last && last.hours === hours && schedule.dayOfWeek === last.to + 1) last.to = schedule.dayOfWeek;
    else groups.push({ from: schedule.dayOfWeek, to: schedule.dayOfWeek, hours });
  }
  const days = weekdayNames[language];
  if (!groups.length) return <p className="text-sm text-slate-600">{localize(language, "Hours have not been set yet.", "সময়সূচি এখনো নির্ধারণ করা হয়নি।")}</p>;
  return (
    <ul className="space-y-3 text-sm">
      {groups.map((group) => (
        <li key={group.from} className="flex items-start gap-3">
          <CalendarDays size={18} className="mt-0.5 shrink-0 text-purple-700" aria-hidden="true" />
          <span className="flex flex-1 flex-wrap justify-between gap-x-4 gap-y-0.5">
            <span className="font-medium text-ink">{group.from === group.to ? days[group.from] : `${days[group.from]} – ${days[group.to]}`}</span>
            <span className={group.hours ? "tabular-nums text-purple-700" : "text-slate-500"}>{group.hours || localize(language, "Closed", "সাপ্তাহিক বন্ধ")}</span>
          </span>
        </li>
      ))}
    </ul>
  );
}

/** Section heading: a short accent bar, the title, and the one-line explanation beside it on wide screens. */
function SectionHead({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="mb-7 grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,28rem)] lg:items-end lg:gap-12">
      <div>
        <span aria-hidden="true" className="mb-3 block h-1 w-10 rounded-full bg-purple-400" />
        <h2 className="text-3xl font-bold leading-tight tracking-tight text-ink sm:text-4xl">{title}</h2>
      </div>
      {subtitle && <p className="text-base leading-relaxed text-slate-600">{subtitle}</p>}
    </div>
  );
}

/** A filled teal circle with a tick: the list marker used across the page. */
function Tick({ className = "" }: { className?: string }) {
  return <span aria-hidden="true" className={`grid size-5 shrink-0 place-items-center rounded-full bg-purple-700 text-white ${className}`}><Check size={12} strokeWidth={3} /></span>;
}

export default function ClinicWebsite(props: {
  clinic: PublicClinicData;
  galleryImages: ClinicGalleryImage[];
  /** Published doctors in the directory; the link to it is shown only when there are some. */
  doctorCount?: number;
  /** Show only this menu section as its own page. */
  only?: NavKey;
}) {
  return (
    <PublicLanguageProvider>
      <ClinicWebsiteContent {...props} />
    </PublicLanguageProvider>
  );
}

function ClinicWebsiteContent({
  clinic,
  galleryImages,
  doctorCount = 0,
  only,
}: {
  clinic: PublicClinicData;
  galleryImages: ClinicGalleryImage[];
  doctorCount?: number;
  /** Show only this menu section as its own page. */
  only?: NavKey;
}) {
  const { language } = usePublicLanguage();
  const [bookingServiceId, setBookingServiceId] = useState("");
  const [mobileActive, setMobileActive] = useState("home");
  const show = (key: NavKey) => !only || only === key;
  const router = useRouter();
  const [viewingImage, setViewingImage] = useState<ClinicGalleryImage | null>(null);

  const doctor = clinic.doctor;
  const services = clinic.services;
  // Public data is cached. An entry saved before a new field existed lacks it, so fill gaps with defaults.
  const content = { ...emptyWebsiteContent, ...clinic.content };
  // Menu labels, headings, feature cards and footer: the clinic's changes over the built-in wording.
  const layout = resolveLayout(content.layout);
  const t = (value: Bilingual) => value[language];
  // Text managed in the admin panel (Website content). Empty means "use the built-in wording".
  const custom = (en: string, bn: string) => (language === "bn" ? bn : en).trim();
  const clinicName = content.clinicName.trim() || BRAND_NAME;
  const clinicSubtitle = content.clinicSubtitle.trim() || "Diagnostic Center";
  const heroTitle = custom(content.heroTitleEn, content.heroTitleBn);
  const heroSubtitle = custom(content.heroSubtitleEn, content.heroSubtitleBn);
  const technology = custom(content.technologyEn, content.technologyBn);
  const bookingNote = custom(content.bookingNoteEn, content.bookingNoteBn);
  const closingMessage = custom(content.closingMessageEn, content.closingMessageBn);
  const ownHighlights = language === "bn" ? content.doctorHighlightsBn : content.doctorHighlightsEn;
  const otherHighlights = language === "bn" ? content.doctorHighlightsEn : content.doctorHighlightsBn;
  const highlights = ownHighlights.length ? ownHighlights : otherHighlights;
  // The centre's own introduction: the visitor's language first, the other as a fallback.
  const centreAbout = custom(content.centreAboutEn, content.centreAboutBn) || (language === "bn" ? content.centreAboutEn : content.centreAboutBn).trim();
  const centreFacts = (language === "bn" ? content.centreFactsBn : content.centreFactsEn);
  const centreFactList = centreFacts.length ? centreFacts : (language === "bn" ? content.centreFactsEn : content.centreFactsBn);
  const hasCentre = Boolean(centreAbout || centreFactList.length);
  const heroImage = content.heroImageUrl;
  const doctorImage = content.doctorImageUrl;
  const { tel } = phoneLinks(doctor?.phone ?? null);
  // The WhatsApp number set under Website content, or the doctor's phone when none is set.
  const whatsappPhone = layout.whatsappNumber || doctor?.phone || null;
  const { whatsapp } = phoneLinks(whatsappPhone);
  function bookService(service: ClinicService) {
    setBookingServiceId(service.id);
    if (only) { router.push("/#appointment"); return; } // the booking form lives on the home page
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    document.getElementById("appointment")?.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "start" });
  }
  // The clinic's own Google Maps link (managed in Website content) wins; without one the map is
  // searched from the address on the doctor profile.
  const address = layout.contactAddress || doctor?.address || "";
  const email = layout.contactEmail;
  const mapUrl = layout.mapEmbedUrl
    || (address ? `https://www.google.com/maps?q=${encodeURIComponent(address)}&output=embed` : null);
  const openMapUrl = layout.mapUrl
    || (address ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}` : null);

  const consultantName = t(layout.consultant.name) || doctor?.name || "Our consultant";
  const consultantRole = t(layout.consultant.role) || [doctor?.qualifications, doctor?.specialization].filter(Boolean).join(" · ") || localize(language, "Consultant", "পরামর্শক চিকিৎসক");
  const consultantIntro = t(layout.consultant.intro) || doctor?.bio || localize(language, "Contact us or request a booking to learn more about our consultant and the center.", "পরামর্শক চিকিৎসক ও কেন্দ্র সম্পর্কে বিস্তারিত জানতে যোগাযোগ করুন অথবা বুকিংয়ের অনুরোধ পাঠান।");
  const consultantLink = t(layout.consultant.linkLabel) || localize(language, doctorCount > 1 ? "Meet all our doctors" : "View doctor profile", doctorCount > 1 ? "আমাদের সব চিকিৎসক" : "চিকিৎসকের প্রোফাইল দেখুন");
  const consultantItems = [
    ...layout.aboutCards.map((item) => ({ key: `card-${item.title.en}`, icon: <LayoutIcon name={item.icon} size={16} />, text: t(item.title) })),
    ...highlights.map((line) => ({ key: `hl-${line}`, icon: <Check size={16} aria-hidden="true" />, text: line })),
  ];
  const whyUsOn = show("whyUs") && layout.sections.whyUs.visible;
  const galleryPreview = only === "gallery" ? galleryImages : galleryImages.slice(0, 4);

  const whyUsPanel = whyUsOn && (
    <section id="why-us" className="flex gap-5">
      <span aria-hidden="true" className="grid size-14 shrink-0 place-items-center rounded-full bg-purple-400 text-purple-950"><Check size={30} strokeWidth={3} /></span>
      <div className="min-w-0">
        <h2 className="text-2xl font-bold leading-tight tracking-tight text-ink sm:text-3xl">{t(layout.sections.whyUs.title)}</h2>
        {t(layout.sections.whyUs.subtitle) && <p className="mt-3 text-base leading-relaxed text-slate-600">{t(layout.sections.whyUs.subtitle)}</p>}
        {technology && <p className="mt-3 border-l-2 border-purple-400 pl-3 text-sm leading-relaxed text-slate-700">{technology}</p>}
        <ul className="mt-5 space-y-3">
          {layout.whyCards.map((item, index) => (
            <li key={`${index}-${item.title.en}`} className="flex items-start gap-3">
              <Tick className="mt-0.5" />
              <span><strong className="text-sm font-semibold text-ink">{t(item.title)}</strong>{t(item.text) && <span className="mt-0.5 block text-sm leading-relaxed text-slate-600">{t(item.text)}</span>}</span>
            </li>
          ))}
        </ul>
        {closingMessage && <p className="mt-5 text-sm font-medium leading-relaxed text-purple-900">{closingMessage}</p>}
        {only && <Link href="/#appointment" className="mt-6 inline-flex min-h-12 items-center gap-2 rounded-full bg-cta px-6 font-semibold text-purple-950 transition-colors hover:bg-cta-dark">{localize(language, "Book a test", "পরীক্ষার বুকিং দিন")} <ArrowRight size={17} aria-hidden="true" /></Link>}
      </div>
    </section>
  );

  return (
    <div data-public-site className="min-h-screen bg-paper pb-24 text-ink antialiased md:pb-0" lang={language}>
      <PublicHeader
        phone={doctor?.phone ?? null}
        clinicName={clinicName}
        clinicSubtitle={clinicSubtitle}
        navItems={NAV_KEYS.flatMap((key) => [
          ...(layout.nav[key].visible ? [{ anchor: NAV_ANCHORS[key], label: layout.nav[key].label, href: NAV_PAGES[key] }] : []),
          // The doctor directory sits right after About, and only appears once a doctor is published.
          ...(key === "about" && doctorCount > 0 ? [{ anchor: "doctors", href: "/doctors", label: { en: "Doctors", bn: "চিকিৎসক" } }] : []),
        ])}
      />
      <AnnouncementTicker items={layout.announcements} label={layout.announcementLabel} />
      <main>
        {!only && (
        <section id="home" className="relative overflow-hidden bg-gradient-to-br from-purple-100 via-purple-50 to-paper">
          {heroImage && (
            <>
              <Image src={heroImage} alt={localize(language, "Diagnostic center", "ডায়াগনস্টিক সেন্টার")} fill priority unoptimized sizes="100vw" className="object-cover object-center" />
              <div aria-hidden="true" className="absolute inset-0 bg-gradient-to-r from-white via-white/85 to-white/0" />
            </>
          )}
          <div className="site-container relative grid grid-cols-[minmax(0,1fr)] items-center gap-10 py-12 lg:grid-cols-12 lg:py-20 [&>*]:min-w-0">
            <div className="lg:col-span-7">
              <h1 className="max-w-2xl text-4xl font-bold leading-[1.1] tracking-tight text-ink sm:text-5xl lg:text-[4rem]">
                {heroTitle || `${localize(language, "Accurate tests and trusted reports at ", "নির্ভুল পরীক্ষা ও বিশ্বস্ত রিপোর্ট পেতে ")}${content.clinicName.trim() ? `${clinicName} ${clinicSubtitle}` : BRAND_NAME}`}
              </h1>
              <p className="mt-5 max-w-xl text-lg leading-relaxed text-slate-700">
                {heroSubtitle || doctor?.bio || localize(language, "Request a test booking and receive accurate, timely reports.", "পরীক্ষার জন্য বুকিংয়ের অনুরোধ পাঠান এবং নির্ভুল, সময়মতো রিপোর্ট পান।")}
              </p>
              <div className="mt-7 flex flex-wrap gap-3">
                <a href="#appointment" className="inline-flex min-h-12 items-center gap-2 rounded-full bg-cta px-7 font-semibold text-purple-950 transition-colors hover:bg-cta-dark"><CalendarDays size={17} aria-hidden="true" /> {localize(language, "Book a test", "পরীক্ষার বুকিং দিন")} <ArrowRight size={17} aria-hidden="true" /></a>
                <a href="#services" className="inline-flex min-h-12 items-center gap-2 rounded-full border border-purple-700 bg-white px-7 font-semibold text-purple-700 transition-colors hover:bg-purple-100">{localize(language, "See tests and fees", "পরীক্ষা ও ফি দেখুন")}</a>
              </div>
              {layout.heroChips.length > 0 && (
                <ul className="mt-7 flex flex-wrap gap-x-6 gap-y-2 text-sm text-ink">
                  {layout.heroChips.map((chip, index) => (
                    <li key={`${index}-${chip.en}`} className="flex items-center gap-2"><Tick /> {t(chip)}</li>
                  ))}
                </ul>
              )}
            </div>
            <div className="lg:col-span-5 lg:justify-self-end">
              <HeroServiceSlider services={services} onBook={bookService} />
            </div>
          </div>
        </section>
        )}

        {!only && layout.consultant.visible && (
        <section id={hasCentre ? "consultant" : "about"} className="px-4 py-8 sm:px-6 lg:px-8">
          <div className="mx-auto grid max-w-7xl gap-6 rounded-xl border border-purple-200 bg-white p-5 shadow-sm sm:p-7 lg:grid-cols-[17rem_minmax(0,1fr)] lg:gap-8">
            <div className="lg:border-r lg:border-purple-200 lg:pr-8">
              {doctorImage && (
                <Image src={doctorImage} alt={`${consultantName} — ${localize(language, "Consultant", "পরামর্শক চিকিৎসক")}`} width={160} height={160} unoptimized className="mb-4 size-20 rounded-full object-cover" />
              )}
              <h2 className="text-3xl font-bold leading-tight tracking-tight text-ink">{consultantName}</h2>
              <p className="mt-1 text-base text-slate-700">{consultantRole}</p>
              {doctorCount > 0 && (
                <Link href="/doctors" className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-purple-700 underline underline-offset-4 hover:text-purple-900">
                  {consultantLink} <ArrowRight size={16} aria-hidden="true" />
                </Link>
              )}
            </div>
            <div>
              <p className="max-w-3xl text-base font-semibold leading-relaxed text-ink">{consultantIntro}</p>
              {consultantItems.length > 0 && (
                <ul className="mt-4 grid gap-x-8 gap-y-3 text-sm text-ink sm:grid-cols-2">
                  {consultantItems.map((item) => (
                    <li key={item.key} className="flex items-center gap-3"><span className="grid size-8 shrink-0 place-items-center rounded-full bg-purple-100 text-purple-700">{item.icon}</span> {item.text}</li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </section>
        )}

        {!only && hasCentre && (
          <section id="about" className="px-4 py-6 sm:px-6 lg:px-8">
            <div className={`mx-auto grid max-w-7xl gap-8 ${content.centreImageUrl ? "lg:grid-cols-2 lg:items-center" : "lg:grid-cols-12"}`}>
              <div className={content.centreImageUrl ? "" : "lg:col-span-5"}>
                <span aria-hidden="true" className="mb-3 block h-1 w-10 rounded-full bg-purple-400" />
                <h2 className="text-3xl font-bold leading-tight tracking-tight text-ink sm:text-4xl">{clinicName} {clinicSubtitle}</h2>
                <Link href="/about" className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-purple-700 underline underline-offset-4 hover:text-purple-900">
                  {localize(language, "Read more about us", "আমাদের সম্পর্কে আরও পড়ুন")} <ArrowRight size={16} aria-hidden="true" />
                </Link>
              </div>
              <div className={`space-y-4 ${content.centreImageUrl ? "" : "lg:col-span-7"}`}>
                {centreAbout && <p className="max-w-prose whitespace-pre-line text-base leading-relaxed text-slate-700">{centreAbout.length > 320 ? `${centreAbout.slice(0, 317).trimEnd()}…` : centreAbout}</p>}
                {centreFactList.length > 0 && (
                  <ul className="grid gap-x-8 gap-y-2 text-sm text-ink sm:grid-cols-2">
                    {centreFactList.slice(0, 4).map((line) => <li key={line} className="flex items-start gap-2"><Tick className="mt-0.5" /> {line}</li>)}
                  </ul>
                )}
              </div>
              {content.centreImageUrl && (
                <div className="overflow-hidden rounded-xl lg:col-span-2">
                  <Image src={content.centreImageUrl} alt={`${clinicName} ${clinicSubtitle}`} width={1000} height={700} unoptimized className="h-64 w-full object-cover sm:h-[380px]" />
                </div>
              )}
            </div>
          </section>
        )}

        {show("services") && (
        <section id="services" className="px-4 py-10 sm:px-6 md:py-14 lg:px-8">
          <div className="mx-auto max-w-7xl">
            <SectionHead title={t(layout.sections.services.title)} subtitle={t(layout.sections.services.subtitle)} />
            <PublicServices services={services} onBook={bookService} previewCount={only ? undefined : 5} />
          </div>
        </section>
        )}

        {show("gallery") && layout.sections.gallery.visible && (
        <section id="gallery" className="bg-purple-900 py-12 text-white md:py-14">
          <div className="site-container grid items-center gap-8 lg:grid-cols-12">
            <div className="lg:col-span-4">
              <span aria-hidden="true" className="mb-3 block h-1 w-10 rounded-full bg-purple-400" />
              <h2 className="text-3xl font-bold leading-tight tracking-tight">{t(layout.sections.gallery.title)}</h2>
              {t(layout.sections.gallery.subtitle) && <p className="mt-3 max-w-sm text-base leading-relaxed text-purple-100">{t(layout.sections.gallery.subtitle)}</p>}
              {!only && galleryImages.length > 0 && (
                <Link href={NAV_PAGES.gallery} className="mt-5 inline-flex min-h-11 items-center gap-2 rounded-md bg-white px-5 text-sm font-semibold text-purple-900 transition-colors hover:bg-purple-100">
                  {localize(language, "Learn more", "আরও দেখুন")} <ArrowRight size={16} aria-hidden="true" />
                </Link>
              )}
            </div>
            <div className="lg:col-span-8">
              {galleryPreview.length ? (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {galleryPreview.map((image) => (
                  <figure key={image.id} className="group overflow-hidden rounded-lg bg-purple-800">
                    <button
                      type="button"
                      className="block w-full cursor-zoom-in text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
                      aria-label={localize(language, `View image larger: ${image.altText}`, `ছবিটি বড় করে দেখুন: ${image.altText}`)}
                      aria-haspopup="dialog"
                      onClick={() => setViewingImage(image)}
                    >
                      <Image src={image.url} alt={image.altText} width={900} height={650} unoptimized className="aspect-[4/5] w-full object-cover transition-transform duration-500 group-hover:scale-105 sm:aspect-[3/4]" />
                    </button>
                  </figure>
                ))}
              </div>
              ) : (
                <p className="rounded-lg border border-purple-700 px-4 py-10 text-sm text-purple-100">{localize(language, "No images have been added to the gallery yet.", "গ্যালারিতে কোনো ছবি যোগ করা হয়নি।")}</p>
              )}
            </div>
          </div>
        </section>
        )}

        {only === "whyUs" && whyUsOn && (
          <div className="site-section mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">{whyUsPanel}</div>
        )}

        {!only && (
          <div className="site-container grid items-stretch gap-10 py-12 md:py-16 lg:grid-cols-2">
            {whyUsPanel && <div className="lg:py-4">{whyUsPanel}</div>}
            <div className={whyUsPanel ? "" : "mx-auto w-full max-w-2xl lg:col-span-2"}>
              <BookingForm doctor={doctor ? { ...doctor, name: consultantName, specialization: consultantRole } : doctor} whatsappPhone={whatsappPhone} services={services} note={bookingNote} requestedServiceId={bookingServiceId} title={t(layout.sections.booking.title)} subtitle={t(layout.sections.booking.subtitle)} />
            </div>
          </div>
        )}

        {show("reviews") && layout.sections.reviews.visible && <ReviewsSection title={t(layout.sections.reviews.title)} subtitle={t(layout.sections.reviews.subtitle)} />}

        {show("contact") && (
        <section id="contact" className="site-section border-t border-purple-200 bg-white">
          <div className="site-container">
            <div className="mb-8 max-w-2xl">
              <span aria-hidden="true" className="mb-3 block h-1 w-10 rounded-full bg-purple-400" />
              <h2 className="text-3xl font-bold leading-tight tracking-tight text-ink sm:text-4xl">{t(layout.sections.contact.title) || localize(language, "Contact and location", "যোগাযোগ ও আমাদের অবস্থান")}</h2>
              {t(layout.sections.contact.subtitle) && <p className="mt-3 text-base leading-relaxed text-slate-600">{t(layout.sections.contact.subtitle)}</p>}
            </div>
            <div className="grid items-start gap-6 lg:grid-cols-2 lg:gap-8">
              <div className="grid gap-6 rounded-xl border border-purple-200 bg-white p-5 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)] sm:p-6 sm:[&>*+*]:border-l sm:[&>*+*]:border-purple-200 sm:[&>*+*]:pl-6">
                <div className="min-w-0">
                  <h3 className="mb-3 text-base font-bold text-ink">{clinicName}</h3>
                  <ul className="space-y-3 text-sm">
                    {address && <li className="flex items-start gap-3"><MapPin size={18} className="mt-0.5 shrink-0 text-purple-700" aria-hidden="true" /><span className="leading-relaxed text-ink">{address}</span></li>}
                    {tel && <li className="flex items-start gap-3"><Phone size={18} className="mt-0.5 shrink-0 text-purple-700" aria-hidden="true" /><a href={`tel:${tel}`} className="text-ink hover:text-purple-800">{doctor?.phone}</a></li>}
                    {email && <li className="flex items-start gap-3"><Mail size={18} className="mt-0.5 shrink-0 text-purple-700" aria-hidden="true" /><a href={`mailto:${email}`} className="break-all text-ink hover:text-purple-800">{email}</a></li>}
                  </ul>
                </div>
                <div className="min-w-0">
                  <h3 className="mb-3 text-base font-bold text-ink">{localize(language, "Opening hours", "সপ্তাহের কার্যদিবস")}</h3>
                  <ClinicHours doctor={doctor} language={language} />
                </div>
              </div>
              <div className="space-y-3">
                {(mapUrl || openMapUrl) && (
                <div className="overflow-hidden rounded-xl border border-purple-200 bg-white">
                  {mapUrl && (
                    <iframe title={localize(language, "Clinic map", "ক্লিনিকের মানচিত্র")} src={mapUrl} className="h-64 w-full border-0 sm:h-72" loading="lazy" allowFullScreen referrerPolicy="no-referrer-when-downgrade" />
                  )}
                  {openMapUrl && (
                    <a href={openMapUrl} target="_blank" rel="noopener noreferrer" className="flex min-h-11 items-center justify-center gap-2 border-t border-purple-200 bg-purple-50 px-4 text-sm font-semibold text-purple-800 hover:bg-purple-100">
                      <MapPin size={16} aria-hidden="true" /> {localize(language, "Open in Google Maps", "Google Maps-এ খুলুন")}
                    </a>
                  )}
                </div>
                )}
                {(tel || whatsapp || layout.facebookUrl) && (
                <div className="grid gap-3 sm:grid-cols-[repeat(auto-fit,minmax(9rem,1fr))]">
                  {tel && <a href={`tel:${tel}`} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md bg-purple-700 px-4 text-sm font-semibold text-white hover:bg-purple-800"><Phone size={16} aria-hidden="true" /> {localize(language, "Call us", "কল করুন")}</a>}
                  {whatsapp && <a href={`https://wa.me/${whatsapp}`} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md bg-emerald-700 px-4 text-sm font-semibold text-white hover:bg-emerald-800">WhatsApp</a>}
                  {layout.facebookUrl && <a href={layout.facebookUrl} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md bg-blue-700 px-4 text-sm font-semibold text-white hover:bg-blue-800">Facebook</a>}
                </div>
                )}
              </div>
            </div>
          </div>
        </section>
        )}
      </main>

      <footer className="bg-purple-900 text-purple-100">
        <div className="site-container grid gap-10 py-12 md:grid-cols-2 lg:grid-cols-[1.5fr_1fr_1.3fr_auto]">
          <div>
            <div className="flex items-center gap-3">
              <span className="grid size-12 shrink-0 place-items-center rounded-full border border-purple-400/60 text-purple-400"><Microscope size={24} aria-hidden="true" /></span>
              <div>
                <p className="text-xl font-bold leading-tight text-white">{clinicName}</p>
                <p className="text-sm">{clinicSubtitle}</p>
              </div>
            </div>
            {t(layout.footerNote) && <p className="mt-4 max-w-sm text-sm leading-relaxed">{t(layout.footerNote)}</p>}
          </div>
          <nav aria-label={localize(language, "Footer navigation", "ফুটার নেভিগেশন")}>
            <h2 className="text-base font-bold text-white">{localize(language, "Quick links", "দ্রুত লিংক")}</h2>
            <ul className="mt-3 space-y-2 text-sm">
              <li><Link href={NAV_PAGES.home} className="hover:text-white">{t(layout.nav.home.label)}</Link></li>
              <li><Link href={NAV_PAGES.services} className="hover:text-white">{t(layout.nav.services.label)}</Link></li>
              {doctorCount > 0 && <li><Link href="/doctors" className="hover:text-white">{localize(language, "Doctors", "চিকিৎসক")}</Link></li>}
              <li><Link href="/#appointment" className="hover:text-white">{localize(language, "Appointments", "অ্যাপয়েন্টমেন্ট")}</Link></li>
              <li><Link href="/verify" className="hover:text-white">{localize(language, "Verify a report", "রিপোর্ট যাচাই")}</Link></li>
              <li><Link href={NAV_PAGES.contact} className="hover:text-white">{t(layout.nav.contact.label)}</Link></li>
            </ul>
          </nav>
          {(tel || address || email) && (
          <div>
            <h2 className="text-base font-bold text-white">{localize(language, "Contact us", "যোগাযোগ")}</h2>
            <ul className="mt-3 space-y-3 text-sm">
              {tel && <li className="flex items-start gap-3"><Phone size={16} className="mt-0.5 shrink-0 text-purple-400" aria-hidden="true" /><a href={`tel:${tel}`} className="hover:text-white">{doctor?.phone}</a></li>}
              {email && <li className="flex items-start gap-3"><Mail size={16} className="mt-0.5 shrink-0 text-purple-400" aria-hidden="true" /><a href={`mailto:${email}`} className="break-all hover:text-white">{email}</a></li>}
              {address && <li className="flex items-start gap-3"><MapPin size={16} className="mt-0.5 shrink-0 text-purple-400" aria-hidden="true" /><span>{address}</span></li>}
            </ul>
          </div>
          )}
          {layout.facebookUrl && (
            <div>
              <h2 className="text-base font-bold text-white">{localize(language, "Follow us", "আমাদের অনুসরণ করুন")}</h2>
              <a href={layout.facebookUrl} target="_blank" rel="noopener noreferrer" aria-label="Facebook" className="mt-3 grid size-10 place-items-center rounded-full bg-purple-400 text-xl font-bold text-purple-950 transition-colors hover:bg-white">f</a>
            </div>
          )}
        </div>
        <div className="border-t border-purple-800 py-4 text-center text-sm">
          <p className="mx-auto max-w-7xl px-4">© {clinicName}. {localize(language, "All rights reserved.", "সর্বস্বত্ব সংরক্ষিত।")}</p>
        </div>
      </footer>

      {!only && <nav className="fixed inset-x-4 bottom-4 z-40 flex items-center justify-around rounded-lg border border-purple-200 bg-white/95 px-3 py-2 shadow-lg backdrop-blur-lg md:hidden" aria-label={localize(language, "Quick navigation", "মোবাইল দ্রুত নেভিগেশন")}>
        {[
          ["home", localize(language, "Home", "হোম"), <House size={19} key="i" />],
          ["appointment", localize(language, "Book", "সিরিয়াল"), <CalendarDays size={19} key="i" />],
          ["services", localize(language, "Tests", "পরীক্ষা"), <FlaskConical size={19} key="i" />],
          ["contact", localize(language, "Contact", "যোগাযোগ"), <Phone size={18} key="i" />],
        ].map(([id, label, icon]) => (
          <a key={String(id)} href={`#${id}`} onClick={() => setMobileActive(String(id))} aria-label={String(label)} aria-current={mobileActive === id ? "true" : undefined} className={`grid size-12 place-items-center rounded-md transition-colors ${mobileActive === id ? "bg-purple-700 text-white" : "text-purple-900 hover:bg-purple-100"}`}>
            {icon}
          </a>
        ))}
      </nav>}

      {viewingImage && (
        <Modal
          className="gallery-image-modal"
          labelledBy="gallery-image-title"
          onRequestClose={() => setViewingImage(null)}
        >
          <div className="gallery-image-modal-content">
            <div className="gallery-image-modal-heading">
              <h2 id="gallery-image-title">{viewingImage.altText}</h2>
              <button
                type="button"
                className="icon-button gallery-image-close"
                onClick={() => setViewingImage(null)}
                aria-label={localize(language, "Close image", "ছবি বন্ধ করুন")}
              >
                <X size={18} />
              </button>
            </div>
            <Image
              src={viewingImage.url}
              alt={viewingImage.altText}
              width={1600}
              height={1200}
              unoptimized
              className="gallery-image-expanded"
            />
          </div>
        </Modal>
      )}
    </div>
  );
}
