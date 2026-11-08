import { z } from "zod";

/**
 * Editable structure and wording of the public website beyond the main content fields: menu labels,
 * section headings, the two feature-card lists, hero chips, footer note and Facebook link.
 *
 * How it is stored: only what the clinic changed ("overrides"). Everything else comes from
 * LAYOUT_DEFAULTS below, which is the wording the website had before it became editable. Empty text
 * means "use the default", so a half-filled setting can never leave a gap on the site.
 *
 * Pure module (no database, no React): shared by the admin form, the API and the public site.
 */

export type Bilingual = { en: string; bn: string };

export const NAV_KEYS = ["home", "about", "services", "gallery", "whyUs", "reviews", "contact"] as const;
export type NavKey = (typeof NAV_KEYS)[number];

/** Sections with their own badge, title and subtitle. */
export const SECTION_KEYS = ["services", "gallery", "whyUs", "reviews", "booking", "contact"] as const;
export type SectionKey = (typeof SECTION_KEYS)[number];

/** Sections that can be switched off (and disappear from the menu with them). */
export const HIDEABLE_SECTIONS = ["gallery", "whyUs", "reviews"] as const;

export const CARD_ICONS = ["stethoscope", "shield", "clock", "calendar", "microscope", "heart", "sparkles", "smile", "phone"] as const;
export type CardIcon = (typeof CARD_ICONS)[number];

export type LayoutCard = { icon: CardIcon; title: Bilingual; text: Bilingual };

export const LAYOUT_LIMITS = {
  label: 40,
  badge: 60,
  title: 120,
  subtitle: 300,
  chip: 100,
  cardTitle: 80,
  cardText: 240,
  footerNote: 200,
  announcement: 200,
  announcements: 8,
  chips: 4,
  cards: 6,
  url: 2048,
} as const;

// ---------------------------------------------------------------------------------------------
// Validation (overrides). Absent or empty fields are fine: they fall back to the defaults.
// ---------------------------------------------------------------------------------------------

const text = (max: number, label: string) =>
  z.string({ error: `${label} must be text.` }).trim().max(max, `${label} must be ${max} characters or fewer.`);

/** One text in both languages; each may be left out. */
const bilingual = (max: number, label: string) =>
  z.object({
    en: text(max, `${label} (English)`).optional(),
    bn: text(max, `${label} (Bangla)`).optional(),
  }).optional();

const card = z.object({
  icon: z.enum(CARD_ICONS, { error: "Choose one of the listed icons." }),
  title: z.object({
    en: text(LAYOUT_LIMITS.cardTitle, "Card title (English)"),
    bn: text(LAYOUT_LIMITS.cardTitle, "Card title (Bangla)"),
  }),
  text: z.object({
    en: text(LAYOUT_LIMITS.cardText, "Card text (English)"),
    bn: text(LAYOUT_LIMITS.cardText, "Card text (Bangla)"),
  }),
}).refine((value) => Boolean(value.title.en || value.title.bn), { message: "Give every card a title.", path: ["title", "en"] });

const cards = (label: string) =>
  z.array(card, { error: `${label} must be a list.` }).max(LAYOUT_LIMITS.cards, `Use at most ${LAYOUT_LIMITS.cards} cards in ${label}.`).optional();

const whatsappNumber = text(30, "WhatsApp number").refine(
  (value) => !value || (/^\+?[\d\s-]+$/.test(value) && value.replace(/\D/g, "").length >= 10),
  "Enter a valid WhatsApp number, for example 01712345678.",
);

const contactEmail = text(120, "Email").refine(
  (value) => !value || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value),
  "Enter a valid email address, or leave it empty.",
);

// A news item may link to a page of this site ("/#appointment") or to an https address.
const announcementLink = text(LAYOUT_LIMITS.url, "Link").refine(
  (value) => !value || (/^\/(?!\/)/.test(value)) || /^https:\/\/[^\s]+$/i.test(value),
  "A link must start with / (a page of this site) or https://, or be empty.",
);

const announcement = z.object({
  en: text(LAYOUT_LIMITS.announcement, "News text (English)"),
  bn: text(LAYOUT_LIMITS.announcement, "News text (Bangla)"),
  link: announcementLink.optional(),
  /** Off keeps the item saved but hides it from the website (for an offer that is paused). */
  visible: z.boolean().optional(),
}).refine((value) => Boolean(value.en || value.bn), { message: "Write the news text, in at least one language.", path: ["en"] });

const facebookUrl = text(LAYOUT_LIMITS.url, "Facebook link").refine((value) => {
  if (!value) return true;
  try {
    return new URL(value).protocol === "https:";
  } catch {
    return false;
  }
}, "The Facebook link must be a full https:// link, or empty.");

/**
 * True for an address the public site may put in a frame: Google's own map host over https. The
 * value is checked again when the page is built, so a bad value in the database can never make the
 * site embed some other address.
 */
export function isSafeMapEmbed(value: string | undefined | null) {
  if (!value) return false;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && /^(www\.|maps\.)?google\.[a-z]{2,3}(\.[a-z]{2})?$/i.test(url.hostname) && url.pathname.startsWith("/maps");
  } catch {
    return false;
  }
}

// What the clinic pasted from Google Maps (a share link, the full link, or embed code). The server
// turns it into `mapEmbedUrl` when the settings are saved; the browser never sets that one.
const mapUrl = text(LAYOUT_LIMITS.url, "Map link").refine(
  (value) => !value || /https:\/\//i.test(value),
  "Paste a Google Maps link that starts with https://.",
);

export const layoutOverridesSchema = z.object({
  nav: z.object({
    home: z.object({ label: bilingual(LAYOUT_LIMITS.label, "Menu label"), visible: z.boolean().optional() }).optional(),
    about: z.object({ label: bilingual(LAYOUT_LIMITS.label, "Menu label"), visible: z.boolean().optional() }).optional(),
    services: z.object({ label: bilingual(LAYOUT_LIMITS.label, "Menu label"), visible: z.boolean().optional() }).optional(),
    gallery: z.object({ label: bilingual(LAYOUT_LIMITS.label, "Menu label"), visible: z.boolean().optional() }).optional(),
    whyUs: z.object({ label: bilingual(LAYOUT_LIMITS.label, "Menu label"), visible: z.boolean().optional() }).optional(),
    reviews: z.object({ label: bilingual(LAYOUT_LIMITS.label, "Menu label"), visible: z.boolean().optional() }).optional(),
    contact: z.object({ label: bilingual(LAYOUT_LIMITS.label, "Menu label"), visible: z.boolean().optional() }).optional(),
  }).optional(),
  sections: z.object({
    services: z.object({ badge: bilingual(LAYOUT_LIMITS.badge, "Badge"), title: bilingual(LAYOUT_LIMITS.title, "Title"), subtitle: bilingual(LAYOUT_LIMITS.subtitle, "Subtitle"), visible: z.boolean().optional() }).optional(),
    gallery: z.object({ badge: bilingual(LAYOUT_LIMITS.badge, "Badge"), title: bilingual(LAYOUT_LIMITS.title, "Title"), subtitle: bilingual(LAYOUT_LIMITS.subtitle, "Subtitle"), visible: z.boolean().optional() }).optional(),
    whyUs: z.object({ badge: bilingual(LAYOUT_LIMITS.badge, "Badge"), title: bilingual(LAYOUT_LIMITS.title, "Title"), subtitle: bilingual(LAYOUT_LIMITS.subtitle, "Subtitle"), visible: z.boolean().optional() }).optional(),
    reviews: z.object({ badge: bilingual(LAYOUT_LIMITS.badge, "Badge"), title: bilingual(LAYOUT_LIMITS.title, "Title"), subtitle: bilingual(LAYOUT_LIMITS.subtitle, "Subtitle"), visible: z.boolean().optional() }).optional(),
    booking: z.object({ badge: bilingual(LAYOUT_LIMITS.badge, "Badge"), title: bilingual(LAYOUT_LIMITS.title, "Title"), subtitle: bilingual(LAYOUT_LIMITS.subtitle, "Subtitle"), visible: z.boolean().optional() }).optional(),
    contact: z.object({ badge: bilingual(LAYOUT_LIMITS.badge, "Badge"), title: bilingual(LAYOUT_LIMITS.title, "Title"), subtitle: bilingual(LAYOUT_LIMITS.subtitle, "Subtitle"), visible: z.boolean().optional() }).optional(),
  }).optional(),
  heroBadge: bilingual(LAYOUT_LIMITS.badge, "Hero badge"),
  heroChips: z.array(
    z.object({
      en: text(LAYOUT_LIMITS.chip, "Highlight (English)"),
      bn: text(LAYOUT_LIMITS.chip, "Highlight (Bangla)"),
    }).refine((value) => Boolean(value.en || value.bn), { message: "A highlight cannot be empty.", path: ["en"] }),
    { error: "Highlights must be a list." },
  ).max(LAYOUT_LIMITS.chips, `Use at most ${LAYOUT_LIMITS.chips} highlights.`).optional(),
  /** The consultant card under the hero: any field left empty falls back to the doctor profile. */
  consultant: z.object({
    visible: z.boolean().optional(),
    name: bilingual(80, "Name"),
    role: bilingual(LAYOUT_LIMITS.title, "Title"),
    intro: bilingual(LAYOUT_LIMITS.subtitle, "Introduction"),
    linkLabel: bilingual(LAYOUT_LIMITS.label, "Link text"),
  }).optional(),
  aboutCards: cards("the consultant cards"),
  whyCards: cards("the “Why choose us” cards"),
  /** The tag at the left of the strip. Empty means the built-in wording. */
  announcementLabel: bilingual(LAYOUT_LIMITS.label, "Strip label"),
  /** News and offers that scroll under the header. */
  announcements: z.array(announcement, { error: "News must be a list." }).max(LAYOUT_LIMITS.announcements, `Use at most ${LAYOUT_LIMITS.announcements} news items.`).optional(),
  footerNote: bilingual(LAYOUT_LIMITS.footerNote, "Footer note"),
  facebookUrl: facebookUrl.optional(),
  contactEmail: contactEmail.optional(),
  contactAddress: text(300, "Clinic address").optional(),
  whatsappNumber: whatsappNumber.optional(),
  mapUrl: mapUrl.optional(),
  mapEmbedUrl: text(LAYOUT_LIMITS.url, "Map embed link").refine((value) => !value || isSafeMapEmbed(value), "Not a Google Maps address.").optional(),
}).default({});

export type WebsiteLayoutOverrides = z.infer<typeof layoutOverridesSchema>;

// ---------------------------------------------------------------------------------------------
// Defaults: the wording the website had before it became editable.
// ---------------------------------------------------------------------------------------------

const b = (en: string, bn: string): Bilingual => ({ en, bn });

export type ResolvedLayout = {
  nav: Record<NavKey, { label: Bilingual; visible: boolean }>;
  sections: Record<SectionKey, { badge: Bilingual; title: Bilingual; subtitle: Bilingual; visible: boolean }>;
  heroBadge: Bilingual;
  heroChips: Bilingual[];
  /** Empty text means "use the doctor profile"; `visible` switches the whole card off. */
  consultant: { visible: boolean; name: Bilingual; role: Bilingual; intro: Bilingual; linkLabel: Bilingual };
  aboutCards: LayoutCard[];
  whyCards: LayoutCard[];
  /** The tag at the left of the news strip. */
  announcementLabel: Bilingual;
  /** Visible news items only, in order. Empty means no strip is shown. */
  announcements: { text: Bilingual; href: string }[];
  footerNote: Bilingual;
  facebookUrl: string;
  /** Shown in the contact section and footer; the address falls back to the one under Doctors. */
  contactEmail: string;
  contactAddress: string;
  whatsappNumber: string;
  /** The link as the clinic gave it (opens Google Maps), and the address shown in the frame. */
  mapUrl: string;
  mapEmbedUrl: string;
};

const noText = b("", "");

export const LAYOUT_DEFAULTS: ResolvedLayout = {
  nav: {
    home: { label: b("Home", "হোম"), visible: true },
    about: { label: b("About", "পরিচিতি"), visible: true },
    services: { label: b("Services", "পরীক্ষাসমূহ"), visible: true },
    gallery: { label: b("Gallery", "গ্যালারি"), visible: true },
    whyUs: { label: b("Why us", "কেন আসবেন"), visible: true },
    reviews: { label: b("Reviews", "রিভিউ"), visible: true },
    contact: { label: b("Contact", "যোগাযোগ"), visible: true },
  },
  sections: {
    services: {
      badge: b("Services", "পরীক্ষাসমূহ"),
      title: b("Tests & services", "পরীক্ষা ও সেবা"),
      subtitle: b("Choose a test to see what it involves, how long the report takes and the price.", "একটি পরীক্ষা বেছে নিন এবং জানুন তাতে কী লাগে, রিপোর্ট কত সময়ে পাবেন ও খরচ কত।"),
      visible: true,
    },
    gallery: { badge: b("Our center", "আমাদের কেন্দ্র"), title: b("Our laboratory and team", "আমাদের ল্যাবরেটরি ও টিম"), subtitle: noText, visible: true },
    whyUs: {
      badge: b("Why choose us", "আমাদের সেবা"),
      title: b("Accurate results you can trust", "নির্ভুল ফলাফল, আস্থার রিপোর্ট"),
      subtitle: b("Your doctor decides which tests you need; we make them simple, accurate and on time.", "কোন পরীক্ষা দরকার তা আপনার চিকিৎসক ঠিক করেন; আমরা সেগুলো সহজ, নির্ভুল ও সময়মতো করি।"),
      visible: true,
    },
    reviews: { badge: b("Patient voices", "রোগীদের মতামত"), title: b("Patient reviews", "প্রকাশিত রোগী-রিভিউ"), subtitle: noText, visible: true },
    // An empty subtitle here means "show the doctor's name and speciality"; the contact title defaults to the clinic name.
    booking: { badge: b("Online booking", "অনলাইন বুকিং"), title: b("Book a test", "পরীক্ষার জন্য বুকিং করুন"), subtitle: noText, visible: true },
    contact: { badge: b("Contact & opening hours", "যোগাযোগ ও সময়সূচি"), title: noText, subtitle: noText, visible: true },
  },
  heroBadge: b("Diagnostic tests & reports", "ডায়াগনস্টিক পরীক্ষা ও রিপোর্ট"),
  heroChips: [
    b("Accurate, timely reports", "নির্ভুল ও সময়মতো রিপোর্ট"),
    b("Book your tests online", "অনলাইনে পরীক্ষার বুকিং"),
  ],
  consultant: { visible: true, name: noText, role: noText, intro: noText, linkLabel: noText },
  aboutCards: [
    { icon: "microscope", title: b("Laboratory tests", "ল্যাবরেটরি পরীক্ষা"), text: b("Choose a test from the services list", "সেবার তালিকা থেকে পরীক্ষা নির্বাচন করুন") },
    { icon: "shield", title: b("Center information", "কেন্দ্রের তথ্য"), text: b("Contact details and hours managed by the center", "যোগাযোগ ও সময়সূচি কেন্দ্র থেকে পরিচালিত") },
    { icon: "stethoscope", title: b("Expert review", "বিশেষজ্ঞের পর্যালোচনা"), text: b("Every report is approved by a pathologist", "প্রতিটি রিপোর্ট প্যাথলজিস্ট অনুমোদন করেন") },
    { icon: "calendar", title: b("Bookings", "বুকিং"), text: b("Send a request; the center will confirm", "অনুরোধ পাঠান; কেন্দ্র নিশ্চিত করবে") },
  ],
  whyCards: [
    { icon: "stethoscope", title: b("Expert approval", "বিশেষজ্ঞের অনুমোদন"), text: b("Results are checked and approved by a pathologist before release.", "রিপোর্ট প্রকাশের আগে প্যাথলজিস্ট যাচাই ও অনুমোদন করেন।") },
    { icon: "shield", title: b("Safe and hygienic", "নিরাপদ ও পরিচ্ছন্ন"), text: b("Learn about our sample handling and hygiene.", "নমুনা সংগ্রহ ও স্বাস্থ্যবিধি সম্পর্কে সরাসরি জানুন।") },
    { icon: "clock", title: b("Convenient scheduling", "সময়সূচি অনুযায়ী"), text: b("Choose an available time and request a booking.", "উপলভ্য সময় বেছে বুকিংয়ের অনুরোধ পাঠান।") },
  ],
  announcementLabel: b("News & offers", "নিউজ ও অফার"),
  announcements: [],
  footerNote: noText,
  facebookUrl: "",
  contactEmail: "",
  contactAddress: "",
  whatsappNumber: "",
  mapUrl: "",
  mapEmbedUrl: "",
};

// ---------------------------------------------------------------------------------------------
// Resolving: overrides + defaults = what the website shows.
// ---------------------------------------------------------------------------------------------

/** Each language falls back to its own default when the override is empty. */
function mergeBilingual(override: Partial<Bilingual> | undefined, fallback: Bilingual): Bilingual {
  return { en: override?.en?.trim() || fallback.en, bn: override?.bn?.trim() || fallback.bn };
}

/** A custom entry in only one language shows that text in both languages rather than nothing. */
function fillBoth(value: Bilingual): Bilingual {
  return { en: value.en.trim() || value.bn.trim(), bn: value.bn.trim() || value.en.trim() };
}

function resolveCards(custom: LayoutCard[] | undefined, fallback: LayoutCard[]): LayoutCard[] {
  if (!custom?.length) return fallback;
  return custom.map((item) => ({ icon: item.icon, title: fillBoth(item.title), text: fillBoth(item.text) }));
}

export function resolveLayout(overrides: WebsiteLayoutOverrides | null | undefined): ResolvedLayout {
  const o = overrides ?? {};
  const nav = {} as ResolvedLayout["nav"];
  for (const key of NAV_KEYS) {
    nav[key] = {
      label: mergeBilingual(o.nav?.[key]?.label, LAYOUT_DEFAULTS.nav[key].label),
      visible: o.nav?.[key]?.visible ?? true,
    };
  }
  const sections = {} as ResolvedLayout["sections"];
  for (const key of SECTION_KEYS) {
    const base = LAYOUT_DEFAULTS.sections[key];
    const own = o.sections?.[key];
    sections[key] = {
      badge: mergeBilingual(own?.badge, base.badge),
      title: mergeBilingual(own?.title, base.title),
      subtitle: mergeBilingual(own?.subtitle, base.subtitle),
      // Only some sections can be hidden; the rest are always shown.
      visible: (HIDEABLE_SECTIONS as readonly string[]).includes(key) ? own?.visible ?? true : true,
    };
  }
  // A hidden section also leaves the menu, whatever the menu setting says.
  if (!sections.gallery.visible) nav.gallery.visible = false;
  if (!sections.whyUs.visible) nav.whyUs.visible = false;
  if (!sections.reviews.visible) nav.reviews.visible = false;

  return {
    nav,
    sections,
    heroBadge: mergeBilingual(o.heroBadge, LAYOUT_DEFAULTS.heroBadge),
    heroChips: o.heroChips?.length ? o.heroChips.map(fillBoth) : LAYOUT_DEFAULTS.heroChips,
    consultant: {
      visible: o.consultant?.visible !== false,
      name: mergeBilingual(o.consultant?.name, noText),
      role: mergeBilingual(o.consultant?.role, noText),
      intro: mergeBilingual(o.consultant?.intro, noText),
      linkLabel: mergeBilingual(o.consultant?.linkLabel, noText),
    },
    aboutCards: resolveCards(o.aboutCards, LAYOUT_DEFAULTS.aboutCards),
    whyCards: resolveCards(o.whyCards, LAYOUT_DEFAULTS.whyCards),
    announcementLabel: mergeBilingual(o.announcementLabel, LAYOUT_DEFAULTS.announcementLabel),
    announcements: (o.announcements ?? [])
      .filter((item) => item.visible !== false && (item.en.trim() || item.bn.trim()))
      .map((item) => ({ text: fillBoth(item), href: item.link?.trim() ?? "" })),
    footerNote: mergeBilingual(o.footerNote, LAYOUT_DEFAULTS.footerNote),
    facebookUrl: o.facebookUrl?.trim() ?? "",
    contactEmail: o.contactEmail?.trim() ?? "",
    contactAddress: o.contactAddress?.trim() ?? "",
    whatsappNumber: o.whatsappNumber?.trim() ?? "",
    mapUrl: /^https:\/\//i.test(o.mapUrl?.trim() ?? "") ? o.mapUrl!.trim() : "",
    mapEmbedUrl: isSafeMapEmbed(o.mapEmbedUrl) ? o.mapEmbedUrl!.trim() : "",
  };
}

/** The page each menu entry opens. (/services, /reviews and /gallery belong to the admin dashboard.) */
export const NAV_PAGES: Record<NavKey, string> = {
  home: "/",
  about: "/about",
  services: "/our-services",
  gallery: "/photo-gallery",
  whyUs: "/why-us",
  reviews: "/patient-reviews",
  contact: "/contact",
};

/** Anchor on the page for each menu entry. */
export const NAV_ANCHORS: Record<NavKey, string> = {
  home: "home",
  about: "about",
  services: "services",
  gallery: "gallery",
  whyUs: "why-us",
  reviews: "reviews",
  contact: "contact",
};
