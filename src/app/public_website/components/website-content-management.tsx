"use client";

import { ExternalLink, Save } from "lucide-react";
import Image from "next/image";
import { useEffect, useState, type FormEvent } from "react";
import {
  CONTENT_LIMITS,
  emptyWebsiteContent,
  websiteContentFieldErrors,
  websiteContentSchema,
  type WebsiteContent,
} from "@/modules/website/schemas/website-content-schema";
import type { WebsiteLayoutOverrides } from "@/modules/website/schemas/website-layout";
import WebsiteLayoutEditor, { type LayoutCategory } from "./website-layout-editor";
import GalleryManagement from "./gallery-management";
import { BRAND_NAME } from "@/lib/brand";

// The form edits highlights as one line per item; everything else is the same shape as the API.
type Draft = Omit<WebsiteContent, "doctorHighlightsEn" | "doctorHighlightsBn" | "centreFactsEn" | "centreFactsBn"> & {
  centreFactsEn: string;
  centreFactsBn: string;
  doctorHighlightsEn: string;
  doctorHighlightsBn: string;
};
type FieldKey = keyof WebsiteContent;
// Keyed by field path: "heroTitleEn", or "layout.nav.home.label.en" for the menu, headings and cards.
type Errors = Record<string, string>;

const toDraft = (content: WebsiteContent): Draft => ({
  ...content,
  doctorHighlightsEn: content.doctorHighlightsEn.join("\n"),
  doctorHighlightsBn: content.doctorHighlightsBn.join("\n"),
  centreFactsEn: content.centreFactsEn.join("\n"),
  centreFactsBn: content.centreFactsBn.join("\n"),
});

const splitLines = (value: string) => value.split("\n").map((line) => line.trim()).filter(Boolean);

const toPayload = (draft: Draft): WebsiteContent => ({
  ...draft,
  doctorHighlightsEn: splitLines(draft.doctorHighlightsEn),
  doctorHighlightsBn: splitLines(draft.doctorHighlightsBn),
  centreFactsEn: splitLines(draft.centreFactsEn),
  centreFactsBn: splitLines(draft.centreFactsBn),
});

// Website parts, in the order visitors scroll through them.
const CATEGORIES: { id: LayoutCategory; label: string }[] = [
  { id: "identity", label: "Clinic & menu" },
  { id: "home", label: "Home" },
  { id: "about", label: "About" },
  { id: "services", label: "Services" },
  { id: "gallery", label: "Gallery" },
  { id: "why", label: "Why choose us" },
  { id: "reviews", label: "Reviews" },
  { id: "booking", label: "Booking" },
  { id: "contact", label: "Contact & footer" },
];

const SECTION_CATEGORY: Record<string, LayoutCategory> = {
  services: "services", gallery: "gallery", whyUs: "why", reviews: "reviews", booking: "booking", contact: "contact",
};

// Which tab holds a field, from its error key.
function categoryOf(key: string): LayoutCategory {
  if (key.startsWith("layout.sections.")) return SECTION_CATEGORY[key.split(".")[2]] ?? "identity";
  if (key.startsWith("layout.nav") || key.startsWith("clinic")) return "identity";
  if (key.startsWith("hero") || key.startsWith("layout.hero")) return "home";
  if (key.startsWith("doctor") || key.startsWith("centre") || key.startsWith("layout.aboutCards")) return "about";
  if (key.startsWith("technology") || key.startsWith("layout.whyCards")) return "why";
  if (key.startsWith("booking")) return "booking";
  return "contact"; // closing message, footer note, Facebook link
}

// What visitors see when a field is left empty (the wording built into the website).
const DEFAULTS = {
  clinicName: BRAND_NAME,
  clinicSubtitle: "Diagnostic Center",
  heroTitleEn: "Accurate tests and trusted reports at <center name>",
  heroTitleBn: "নির্ভুল পরীক্ষা ও বিশ্বস্ত রিপোর্ট পেতে <কেন্দ্রের নাম>",
  heroSubtitleEn: "The doctor's bio, or: Request a test booking and receive accurate, timely reports.",
  heroSubtitleBn: "ডাক্তারের বায়ো, অথবা: পরীক্ষার জন্য বুকিংয়ের অনুরোধ পাঠান এবং নির্ভুল, সময়মতো রিপোর্ট পান।",
  technologyEn: "Nothing is shown when empty.",
  technologyBn: "ফাঁকা থাকলে কিছু দেখানো হয় না।",
  bookingNoteEn: "Nothing is shown when empty.",
  bookingNoteBn: "ফাঁকা থাকলে কিছু দেখানো হয় না।",
  closingMessageEn: "Nothing is shown when empty.",
  closingMessageBn: "ফাঁকা থাকলে কিছু দেখানো হয় না।",
} as const;

function TextField({
  label,
  field,
  value,
  error,
  onChange,
  max,
  multiline,
  rows = 3,
  lang,
  placeholder,
  hint,
}: {
  label: string;
  field: FieldKey;
  value: string;
  error?: string;
  onChange: (field: FieldKey, value: string) => void;
  max?: number;
  multiline?: boolean;
  rows?: number;
  lang?: string;
  placeholder?: string;
  hint?: string;
}) {
  const id = `wc-${field}`;
  const describedBy = [error ? `${id}-error` : "", hint ? `${id}-hint` : ""].filter(Boolean).join(" ") || undefined;
  return (
    <div className="form-field">
      <label htmlFor={id}>{label}</label>
      {multiline ? (
        <textarea id={id} rows={rows} lang={lang} value={value} placeholder={placeholder} aria-invalid={error ? true : undefined} aria-describedby={describedBy} onChange={(event) => onChange(field, event.target.value)} />
      ) : (
        <input id={id} lang={lang} value={value} placeholder={placeholder} aria-invalid={error ? true : undefined} aria-describedby={describedBy} onChange={(event) => onChange(field, event.target.value)} />
      )}
      {error && <small className="field-error" id={`${id}-error`} role="alert">{error}</small>}
      {hint && !error && <small id={`${id}-hint`}>{hint}</small>}
      {max !== undefined && <small className="field-counter">{value.length} / {max}</small>}
    </div>
  );
}

function ImagePreview({ url, label }: { url: string; label: string }) {
  let valid = false;
  try {
    valid = Boolean(url) && new URL(url).protocol === "https:";
  } catch {
    valid = false;
  }
  if (!valid) return <div className="wc-preview wc-preview-empty">No image set. The built-in photo is shown.</div>;
  return (
    <div className="wc-preview">
      <Image src={url} alt={`Preview: ${label}`} width={480} height={260} unoptimized />
    </div>
  );
}

export default function WebsiteContentManagement() {
  const [draft, setDraft] = useState<Draft>(() => toDraft(emptyWebsiteContent));
  const [saved, setSaved] = useState<string>(() => JSON.stringify(toPayload(toDraft(emptyWebsiteContent))));
  const [errors, setErrors] = useState<Errors>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [category, setCategory] = useState<LayoutCategory>("identity");
  const [notice, setNotice] = useState<{ text: string; error: boolean } | null>(null);

  useEffect(() => {
    let active = true;
    fetch("/api/website-content", { cache: "no-store" })
      .then(async (response) => {
        const result = await response.json() as { content?: WebsiteContent; error?: string };
        if (!response.ok || !result.content) throw new Error(result.error ?? "Could not load website content.");
        return result.content;
      })
      .then((content) => {
        if (!active) return;
        setDraft(toDraft(content));
        setSaved(JSON.stringify(content));
      })
      .catch((error: unknown) => {
        if (active) setLoadError(error instanceof Error ? error.message : "Could not load website content.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const dirty = JSON.stringify(toPayload(draft)) !== saved;

  // Warn before leaving with edits that were not saved.
  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  function change(field: FieldKey, value: string) {
    const next = { ...draft, [field]: value } as Draft;
    setDraft(next);
    setNotice(null);
    // Re-check as the person types, so a message disappears the moment the problem is fixed.
    const result = websiteContentSchema.safeParse(toPayload(next));
    setErrors(result.success ? {} : websiteContentFieldErrors(result.error));
  }

  function changeLayout(next: WebsiteLayoutOverrides) {
    const updated = { ...draft, layout: next };
    setDraft(updated);
    setNotice(null);
    const result = websiteContentSchema.safeParse(toPayload(updated));
    setErrors(result.success ? {} : websiteContentFieldErrors(result.error));
  }

  function focusField(key: string) {
    setCategory(categoryOf(key));
    // Wait for the tab to show before focusing the field inside it.
    requestAnimationFrame(() => document.getElementById(`wc-${key}`)?.focus());
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const payload = toPayload(draft);
    const result = websiteContentSchema.safeParse(payload);
    if (!result.success) {
      const found = websiteContentFieldErrors(result.error);
      setErrors(found);
      setNotice({ text: "Please fix the highlighted fields.", error: true });
      const first = Object.keys(found)[0];
      if (first) focusField(first);
      return;
    }
    setSaving(true);
    setNotice(null);
    try {
      const response = await fetch("/api/website-content", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(result.data),
      });
      const body = await response.json() as { content?: WebsiteContent; error?: string; fieldErrors?: Errors };
      if (!response.ok || !body.content) {
        if (body.fieldErrors) setErrors(body.fieldErrors);
        throw new Error(body.error ?? "Could not save website content.");
      }
      setDraft(toDraft(body.content));
      setSaved(JSON.stringify(body.content));
      setErrors({});
      setNotice({ text: "Saved. The public website now shows this content.", error: false });
    } catch (error) {
      setNotice({ text: error instanceof Error ? error.message : "Could not save website content.", error: true });
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <div className="loading-state">Loading website content…</div>;
  if (loadError) return <div className="panel-card empty-state" role="alert"><strong>Couldn’t load website content</strong><div style={{ marginTop: 7 }}>{loadError}</div></div>;

  const field = (key: FieldKey, label: string, extra: Partial<Parameters<typeof TextField>[0]> = {}) => (
    <TextField
      label={label}
      field={key}
      value={String(draft[key])}
      error={errors[key]}
      onChange={change}
      {...extra}
    />
  );

  return (
    <div className="wc-page">
    <p className="wc-intro">
      Everything here appears on the public website. Leave a field empty to keep the built-in wording.
      Changes go live as soon as you save.
    </p>

    <div className="wc-tabs" role="tablist" aria-label="Website parts">
      {CATEGORIES.map((item) => {
        const failing = Object.keys(errors).some((key) => categoryOf(key) === item.id);
        return (
          <button key={item.id} type="button" role="tab" id={`wc-tab-${item.id}`} aria-selected={category === item.id} aria-controls={`wc-panel-${item.id}`} className={`wc-tab${category === item.id ? " is-active" : ""}`} onClick={() => setCategory(item.id)}>
            {item.label}{failing && <span className="wc-tab-dot" role="img" aria-label="has errors" />}
          </button>
        );
      })}
    </div>

    <div id="gallery" className="website-gallery" hidden={category !== "gallery"}><GalleryManagement /></div>
    <form className="website-content" onSubmit={save} noValidate>
      <div role="tabpanel" id="wc-panel-identity" aria-labelledby="wc-tab-identity" hidden={category !== "identity"} className="wc-panel">
        <section className="panel-card">
          <header className="panel-header"><div><h2 className="panel-title">Clinic identity</h2><p className="panel-description">Shown in the website header, contact section and footer.</p></div></header>
          <div className="modal-form">
            <div className="form-grid">
              {field("clinicName", "Clinic name", { max: CONTENT_LIMITS.name, placeholder: DEFAULTS.clinicName })}
              {field("clinicSubtitle", "Subtitle", { max: CONTENT_LIMITS.name, placeholder: DEFAULTS.clinicSubtitle })}
            </div>
          </div>
        </section>

        <WebsiteLayoutEditor category="identity" layout={draft.layout} errors={errors} onChange={changeLayout} />
      </div>

      <div role="tabpanel" id="wc-panel-home" aria-labelledby="wc-tab-home" hidden={category !== "home"} className="wc-panel">
        <section className="panel-card">
          <header className="panel-header"><div><h2 className="panel-title">Home page</h2><p className="panel-description">The headline, intro text and photo at the top of the website.</p></div></header>
          <div className="modal-form">
            <div className="form-grid">
              {field("heroTitleEn", "Headline · English", { max: CONTENT_LIMITS.title, placeholder: DEFAULTS.heroTitleEn })}
              {field("heroTitleBn", "Headline · বাংলা", { max: CONTENT_LIMITS.title, placeholder: DEFAULTS.heroTitleBn, lang: "bn" })}
              {field("heroSubtitleEn", "Intro · English", { max: CONTENT_LIMITS.paragraph, multiline: true, rows: 4, placeholder: DEFAULTS.heroSubtitleEn })}
              {field("heroSubtitleBn", "Intro · বাংলা", { max: CONTENT_LIMITS.paragraph, multiline: true, rows: 4, placeholder: DEFAULTS.heroSubtitleBn, lang: "bn" })}
            </div>
            {field("heroImageUrl", "Hero photo link", { placeholder: "https://…", hint: "A full https:// link to an image. Leave empty for the built-in photo." })}
            <ImagePreview url={draft.heroImageUrl} label="hero" />
          </div>
        </section>

        <WebsiteLayoutEditor category="home" layout={draft.layout} errors={errors} onChange={changeLayout} />
      </div>

      <div role="tabpanel" id="wc-panel-about" aria-labelledby="wc-tab-about" hidden={category !== "about"} className="wc-panel">
        <section className="panel-card">
          <header className="panel-header"><div><h2 className="panel-title">About the centre</h2><p className="panel-description">Introduce the diagnostic centre: its story, mission, licences and facilities. Shown first in the About section.</p></div></header>
          <div className="modal-form">
            <div className="form-grid">
              {field("centreAboutEn", "Introduction · English", { multiline: true, rows: 6, hint: "A few short paragraphs." })}
              {field("centreAboutBn", "পরিচিতি · বাংলা", { multiline: true, rows: 6, lang: "bn", hint: "ফাঁকা থাকলে ইংরেজি লেখা দেখানো হবে।" })}
              {field("centreFactsEn", "Key facts · English (one per line)", { multiline: true, rows: 4, hint: `Up to ${CONTENT_LIMITS.highlights} lines.`, placeholder: "e.g. Established 2015" })}
              {field("centreFactsBn", "মূল তথ্য · বাংলা (প্রতি লাইনে একটি)", { multiline: true, rows: 4, lang: "bn", hint: "ফাঁকা থাকলে ইংরেজি তালিকা দেখানো হবে।" })}
            </div>
            {field("centreImageUrl", "Centre photo link", { placeholder: "https://…", hint: "A full https:// link to an image. Optional." })}
            <ImagePreview url={draft.centreImageUrl} label="centre" />
          </div>
        </section>
        <section className="panel-card">
          <header className="panel-header"><div><h2 className="panel-title">About the consultant</h2><p className="panel-description">Name, degrees and phone come from Doctors. Add training and credentials here, one per line.</p></div></header>
          <div className="modal-form">
            <div className="form-grid">
              {field("doctorHighlightsEn", "Credentials · English (one per line)", { multiline: true, rows: 4, hint: `Up to ${CONTENT_LIMITS.highlights} lines.`, placeholder: "e.g. MD (Pathology), 10 years of laboratory experience" })}
              {field("doctorHighlightsBn", "Credentials · বাংলা (প্রতি লাইনে একটি)", { multiline: true, rows: 4, lang: "bn", hint: "ফাঁকা থাকলে ইংরেজি তালিকা দেখানো হবে।" })}
            </div>
            {field("doctorImageUrl", "Doctor photo link", { placeholder: "https://…", hint: "A full https:// link to an image. Leave empty for the built-in photo." })}
            <ImagePreview url={draft.doctorImageUrl} label="doctor" />
          </div>
        </section>

        <WebsiteLayoutEditor category="about" layout={draft.layout} errors={errors} onChange={changeLayout} />
      </div>

      <div role="tabpanel" id="wc-panel-services" aria-labelledby="wc-tab-services" hidden={category !== "services"} className="wc-panel">
        <WebsiteLayoutEditor category="services" layout={draft.layout} errors={errors} onChange={changeLayout} />
      </div>

      <div role="tabpanel" id="wc-panel-gallery" aria-labelledby="wc-tab-gallery" hidden={category !== "gallery"} className="wc-panel">
        <WebsiteLayoutEditor category="gallery" layout={draft.layout} errors={errors} onChange={changeLayout} />
      </div>

      <div role="tabpanel" id="wc-panel-why" aria-labelledby="wc-tab-why" hidden={category !== "why"} className="wc-panel">
        <section className="panel-card">
          <header className="panel-header"><div><h2 className="panel-title">Technology and equipment</h2><p className="panel-description">Shown in “Why choose us”.</p></div></header>
          <div className="modal-form">
            <div className="form-grid">
              {field("technologyEn", "Technology and equipment · English", { max: CONTENT_LIMITS.paragraph, multiline: true, rows: 3, placeholder: DEFAULTS.technologyEn, hint: "Shown in “Why choose us”." })}
              {field("technologyBn", "Technology and equipment · বাংলা", { max: CONTENT_LIMITS.paragraph, multiline: true, rows: 3, lang: "bn", placeholder: DEFAULTS.technologyBn })}
            </div>
          </div>
        </section>
        <WebsiteLayoutEditor category="why" layout={draft.layout} errors={errors} onChange={changeLayout} />
      </div>

      <div role="tabpanel" id="wc-panel-reviews" aria-labelledby="wc-tab-reviews" hidden={category !== "reviews"} className="wc-panel">
        <WebsiteLayoutEditor category="reviews" layout={draft.layout} errors={errors} onChange={changeLayout} />
      </div>

      <div role="tabpanel" id="wc-panel-booking" aria-labelledby="wc-tab-booking" hidden={category !== "booking"} className="wc-panel">
        <section className="panel-card">
          <header className="panel-header"><div><h2 className="panel-title">Booking note</h2><p className="panel-description">Shown above the appointment form.</p></div></header>
          <div className="modal-form">
            <div className="form-grid">
              {field("bookingNoteEn", "Booking note · English", { max: CONTENT_LIMITS.note, multiline: true, rows: 2, placeholder: DEFAULTS.bookingNoteEn, hint: "Shown above the appointment form." })}
              {field("bookingNoteBn", "Booking note · বাংলা", { max: CONTENT_LIMITS.note, multiline: true, rows: 2, lang: "bn", placeholder: DEFAULTS.bookingNoteBn })}
            </div>
          </div>
        </section>
        <WebsiteLayoutEditor category="booking" layout={draft.layout} errors={errors} onChange={changeLayout} />
      </div>

      <div role="tabpanel" id="wc-panel-contact" aria-labelledby="wc-tab-contact" hidden={category !== "contact"} className="wc-panel">
        <section className="panel-card">
          <header className="panel-header"><div><h2 className="panel-title">Closing message</h2><p className="panel-description">Shown next to the final “Book an appointment” button.</p></div></header>
          <div className="modal-form">
            <div className="form-grid">
              {field("closingMessageEn", "Closing message · English", { max: CONTENT_LIMITS.note, multiline: true, rows: 2, placeholder: DEFAULTS.closingMessageEn, hint: "Shown next to the final “Book an appointment” button." })}
              {field("closingMessageBn", "Closing message · বাংলা", { max: CONTENT_LIMITS.note, multiline: true, rows: 2, lang: "bn", placeholder: DEFAULTS.closingMessageBn })}
            </div>
          </div>
        </section>
        <WebsiteLayoutEditor category="contact" layout={draft.layout} errors={errors} onChange={changeLayout} />
      </div>

      <div className="wc-savebar" role="region" aria-label="Save changes">
        <span className={`wc-status${dirty ? " is-dirty" : ""}`}>
          {notice ? <span role={notice.error ? "alert" : "status"} className={notice.error ? "wc-error" : "wc-ok"}>{notice.text}</span> : dirty ? "You have unsaved changes." : "All changes saved."}
        </span>
        <a className="button-secondary" href="/" target="_blank" rel="noopener noreferrer"><ExternalLink size={14} /> View website</a>
        <button className="button-primary" type="submit" disabled={saving || !dirty}><Save size={14} /> {saving ? "Saving…" : "Save changes"}</button>
      </div>
    </form>
    </div>
  );
}
