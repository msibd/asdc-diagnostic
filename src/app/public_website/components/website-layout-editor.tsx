"use client";

import { ArrowDown, ArrowUp, Plus, RotateCcw, Trash2 } from "lucide-react";
import {
  CARD_ICONS,
  HIDEABLE_SECTIONS,
  LAYOUT_DEFAULTS,
  LAYOUT_LIMITS,
  NAV_KEYS,
  type Bilingual,
  type CardIcon,
  type LayoutCard,
  type NavKey,
  type SectionKey,
  type WebsiteLayoutOverrides,
} from "@/modules/website/schemas/website-layout";

type Errors = Record<string, string>;
type Path = (string | number)[];

// ---- immutable updates; empty values are removed so only real changes are stored ----

function setIn(root: unknown, path: Path, value: unknown): unknown {
  if (!path.length) return value;
  const [head, ...rest] = path;
  const copy: Record<string | number, unknown> | unknown[] = Array.isArray(root) ? [...root] : { ...((root as object) ?? {}) };
  (copy as Record<string | number, unknown>)[head] = setIn((copy as Record<string | number, unknown>)[head], rest, value);
  return copy;
}

function prune(value: unknown): unknown {
  if (Array.isArray(value)) return value.length ? value : undefined;
  if (value && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>)
      .map(([key, inner]) => [key, prune(inner)] as const)
      .filter(([, inner]) => inner !== undefined);
    return entries.length ? Object.fromEntries(entries) : undefined;
  }
  if (typeof value === "string") return value === "" ? undefined : value;
  return value === undefined || value === null ? undefined : value;
}

function readIn(root: unknown, path: Path): unknown {
  return path.reduce<unknown>((current, key) => (current && typeof current === "object" ? (current as Record<string | number, unknown>)[key] : undefined), root);
}

const ICON_LABELS: Record<CardIcon, string> = {
  stethoscope: "Stethoscope",
  shield: "Shield (clean, safe)",
  clock: "Clock",
  calendar: "Calendar",
  microscope: "Microscope",
  heart: "Heart",
  sparkles: "Sparkles",
  smile: "Smile",
  phone: "Phone",
};

const NAV_TITLES: Record<NavKey, string> = {
  home: "Home", about: "About the consultant", services: "Services", gallery: "Gallery", whyUs: "Why choose us", reviews: "Reviews", contact: "Contact",
};

const SECTION_TITLES: Record<SectionKey, string> = {
  services: "Services", gallery: "Gallery", whyUs: "Why choose us", reviews: "Reviews", booking: "Appointment form", contact: "Contact",
};

const SECTION_NOTES: Partial<Record<SectionKey, string>> = {
  booking: "Leave the subtitle empty to show the doctor's name and speciality.",
  contact: "Leave the title empty to show the clinic name.",
};

// ---- small pieces ----

function BilingualInput({
  path, label, value, placeholder, max, errors, onChange, multiline = false, compact = false,
}: {
  path: Path;
  label: string;
  value: Partial<Bilingual> | undefined;
  placeholder: Bilingual;
  max: number;
  errors: Errors;
  onChange: (path: Path, value: string) => void;
  multiline?: boolean;
  /** One short line: no visible label or counter (the label stays for screen readers). */
  compact?: boolean;
}) {
  return (
    <div className={`wl-bilingual${compact ? " is-compact" : ""}`}>
      {(["en", "bn"] as const).map((lang) => {
        const full = [...path, lang];
        const key = full.join(".");
        const id = `wc-${key}`;
        const text = value?.[lang] ?? "";
        const error = errors[key];
        const shared = {
          id,
          value: text,
          lang: lang === "bn" ? "bn" : undefined,
          placeholder: placeholder[lang] || (lang === "en" ? "Built-in: empty" : "ডিফল্ট: ফাঁকা"),
          "aria-invalid": error ? true : undefined,
          "aria-describedby": error ? `${id}-error` : undefined,
        } as const;
        return (
          <div className="form-field" key={lang}>
            <label htmlFor={id} className={compact ? "sr-only" : undefined}>{label} · {lang === "en" ? "English" : "বাংলা"}</label>
            {multiline
              ? <textarea {...shared} rows={2} onChange={(event) => onChange(full, event.target.value)} />
              : <input {...shared} onChange={(event) => onChange(full, event.target.value)} />}
            {error && <small className="field-error" id={`${id}-error`} role="alert">{error}</small>}
            {!compact && <small className="field-counter">{text.length} / {max}</small>}
          </div>
        );
      })}
    </div>
  );
}

function VisibilityToggle({ id, label, checked, onChange }: { id: string; label: string; checked: boolean; onChange: (checked: boolean) => void }) {
  return (
    <label className="wl-toggle" htmlFor={id}>
      <input id={id} type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} />
      <span>{label}</span>
    </label>
  );
}

// ---- lists ----

function CardListEditor({
  basePath, title, description, cards, defaults, errors, onReplace,
}: {
  basePath: Path;
  title: string;
  description: string;
  cards: LayoutCard[] | undefined;
  defaults: LayoutCard[];
  errors: Errors;
  onReplace: (path: Path, value: LayoutCard[] | undefined) => void;
}) {
  const custom = cards && cards.length > 0 ? cards : null;
  const set = (next: LayoutCard[]) => onReplace(basePath, next.length ? next : undefined);

  function patch(index: number, change: (card: LayoutCard) => LayoutCard) {
    set((custom ?? []).map((card, position) => (position === index ? change(card) : card)));
  }

  function move(index: number, direction: -1 | 1) {
    const next = [...(custom ?? [])];
    const target = index + direction;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    set(next);
  }

  return (
    <div className="wl-list">
      <div className="wl-list-head">
        <div><strong>{title}</strong><small>{description}</small></div>
        {custom
          ? <button type="button" className="button-secondary" onClick={() => onReplace(basePath, undefined)}><RotateCcw size={14} /> Use built-in cards</button>
          : <button type="button" className="button-secondary" onClick={() => set(defaults.map((card) => ({ ...card, title: { ...card.title }, text: { ...card.text } })))}>Customize these cards</button>}
      </div>
      {!custom && (
        <ul className="wl-preview">
          {defaults.map((card, index) => <li key={index}><strong>{card.title.en}</strong> · <span lang="bn">{card.title.bn}</span></li>)}
        </ul>
      )}
      {custom && (
        <>
          {custom.map((card, index) => {
            const row = [...basePath, index];
            return (
              <fieldset className="wl-card" key={index}>
                <legend>Card {index + 1}</legend>
                <div className="wl-card-tools">
                  <button type="button" className="icon-action" onClick={() => move(index, -1)} disabled={index === 0} aria-label={`Move card ${index + 1} up`}><ArrowUp size={15} /></button>
                  <button type="button" className="icon-action" onClick={() => move(index, 1)} disabled={index === custom.length - 1} aria-label={`Move card ${index + 1} down`}><ArrowDown size={15} /></button>
                  <button type="button" className="icon-action icon-action-danger" onClick={() => set(custom.filter((_, position) => position !== index))} aria-label={`Remove card ${index + 1}`}><Trash2 size={15} /></button>
                </div>
                <div className="form-field">
                  <label htmlFor={`wc-${row.join(".")}.icon`}>Icon</label>
                  <select id={`wc-${row.join(".")}.icon`} value={card.icon} onChange={(event) => patch(index, (current) => ({ ...current, icon: event.target.value as CardIcon }))}>
                    {CARD_ICONS.map((icon) => <option key={icon} value={icon}>{ICON_LABELS[icon]}</option>)}
                  </select>
                </div>
                <BilingualInput
                  path={[...row, "title"]} label="Title" value={card.title} placeholder={{ en: "", bn: "" }} max={LAYOUT_LIMITS.cardTitle} errors={errors}
                  onChange={(path, value) => patch(index, (current) => ({ ...current, title: { ...current.title, [path[path.length - 1] as "en" | "bn"]: value } }))}
                />
                <BilingualInput
                  path={[...row, "text"]} label="Text" value={card.text} placeholder={{ en: "", bn: "" }} max={LAYOUT_LIMITS.cardText} errors={errors} multiline
                  onChange={(path, value) => patch(index, (current) => ({ ...current, text: { ...current.text, [path[path.length - 1] as "en" | "bn"]: value } }))}
                />
              </fieldset>
            );
          })}
          {custom.length < LAYOUT_LIMITS.cards && (
            <button type="button" className="button-secondary" onClick={() => set([...custom, { icon: "stethoscope", title: { en: "", bn: "" }, text: { en: "", bn: "" } }])}>
              <Plus size={14} /> Add a card
            </button>
          )}
          {errors[basePath.join(".")] && <small className="field-error" role="alert">{errors[basePath.join(".")]}</small>}
        </>
      )}
    </div>
  );
}

function ChipListEditor({
  basePath, chips, errors, onReplace,
}: {
  basePath: Path;
  chips: Bilingual[] | undefined;
  errors: Errors;
  onReplace: (path: Path, value: Bilingual[] | undefined) => void;
}) {
  const custom = chips && chips.length > 0 ? chips : null;
  const set = (next: Bilingual[]) => onReplace(basePath, next.length ? next : undefined);
  return (
    <div className="wl-list">
      <div className="wl-list-head">
        <div><strong>Highlights under the headline</strong><small>Short ticks shown below the hero buttons (up to {LAYOUT_LIMITS.chips}).</small></div>
        {custom
          ? <button type="button" className="button-secondary" onClick={() => onReplace(basePath, undefined)}><RotateCcw size={14} /> Use built-in highlights</button>
          : <button type="button" className="button-secondary" onClick={() => set(LAYOUT_DEFAULTS.heroChips.map((chip) => ({ ...chip })))}>Customize these highlights</button>}
      </div>
      {!custom && <ul className="wl-preview">{LAYOUT_DEFAULTS.heroChips.map((chip, index) => <li key={index}>{chip.en} · <span lang="bn">{chip.bn}</span></li>)}</ul>}
      {custom && (
        <>
          {custom.map((chip, index) => (
            <div className="wl-chip-row" key={index}>
              <BilingualInput
                path={[...basePath, index]} label={`Highlight ${index + 1}`} value={chip} placeholder={{ en: "", bn: "" }} max={LAYOUT_LIMITS.chip} errors={errors}
                onChange={(path, value) => set(custom.map((item, position) => (position === index ? { ...item, [path[path.length - 1] as "en" | "bn"]: value } : item)))}
              />
              <button type="button" className="icon-action icon-action-danger" onClick={() => set(custom.filter((_, position) => position !== index))} aria-label={`Remove highlight ${index + 1}`}><Trash2 size={15} /></button>
            </div>
          ))}
          {custom.length < LAYOUT_LIMITS.chips && (
            <button type="button" className="button-secondary" onClick={() => set([...custom, { en: "", bn: "" }])}><Plus size={14} /> Add a highlight</button>
          )}
        </>
      )}
    </div>
  );
}

type NewsItem = NonNullable<WebsiteLayoutOverrides["announcements"]>[number];

function NewsListEditor({
  basePath, items, errors, onReplace,
}: {
  basePath: Path;
  items: NewsItem[] | undefined;
  errors: Errors;
  onReplace: (path: Path, value: NewsItem[] | undefined) => void;
}) {
  const list = items ?? [];
  const set = (next: NewsItem[]) => onReplace(basePath, next.length ? next : undefined);
  const patch = (index: number, change: Partial<NewsItem>) => set(list.map((item, position) => (position === index ? { ...item, ...change } : item)));
  function move(index: number, direction: -1 | 1) {
    const next = [...list];
    const target = index + direction;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    set(next);
  }
  return (
    <div className="wl-list">
      <div className="wl-list-head">
        <div><strong>Scrolling news and offers</strong><small>Shown in a strip under the menu, moving from right to left. Up to {LAYOUT_LIMITS.announcements} items. With none, no strip is shown.</small></div>
      </div>
      {list.map((item, index) => {
        const row = [...basePath, index];
        const linkId = `wc-${row.join(".")}.link`;
        const linkError = errors[`${row.join(".")}.link`];
        return (
          <fieldset className="wl-card" key={index}>
            <legend>News {index + 1}</legend>
            <div className="wl-card-tools">
              <button type="button" className="icon-action" onClick={() => move(index, -1)} disabled={index === 0} aria-label={`Move news ${index + 1} up`}><ArrowUp size={15} /></button>
              <button type="button" className="icon-action" onClick={() => move(index, 1)} disabled={index === list.length - 1} aria-label={`Move news ${index + 1} down`}><ArrowDown size={15} /></button>
              <button type="button" className="icon-action icon-action-danger" onClick={() => set(list.filter((_, position) => position !== index))} aria-label={`Remove news ${index + 1}`}><Trash2 size={15} /></button>
            </div>
            <BilingualInput
              path={row} label="Text" value={item} placeholder={{ en: "", bn: "" }} max={LAYOUT_LIMITS.announcement} errors={errors}
              onChange={(path, value) => patch(index, { [path[path.length - 1] as "en" | "bn"]: value })}
            />
            <div className="form-field">
              <label htmlFor={linkId}>Link (optional)</label>
              <input id={linkId} value={item.link ?? ""} placeholder="/#appointment or https://…" aria-invalid={linkError ? true : undefined} onChange={(event) => patch(index, { link: event.target.value })} />
              {linkError && <small className="field-error" role="alert">{linkError}</small>}
              <small>Start with / for a page of this site, or https:// for another site.</small>
            </div>
            <VisibilityToggle id={`wc-${row.join(".")}.visible`} label="Show this on the website" checked={item.visible !== false} onChange={(checked) => patch(index, { visible: checked ? undefined : false })} />
          </fieldset>
        );
      })}
      {list.length < LAYOUT_LIMITS.announcements && (
        <button type="button" className="button-secondary" onClick={() => set([...list, { en: "", bn: "" }])}><Plus size={14} /> Add news or an offer</button>
      )}
      {errors[basePath.join(".")] && <small className="field-error" role="alert">{errors[basePath.join(".")]}</small>}
    </div>
  );
}

// ---- the editor ----

export type LayoutCategory = "identity" | "home" | "about" | "services" | "gallery" | "why" | "reviews" | "booking" | "contact";

export default function WebsiteLayoutEditor({
  layout, errors, onChange, category,
}: {
  layout: WebsiteLayoutOverrides;
  errors: Errors;
  onChange: (next: WebsiteLayoutOverrides) => void;
  /** Which part of the website to edit. */
  category: LayoutCategory;
}) {
  const update = (path: Path, value: unknown) => onChange((prune(setIn(layout, path, value)) ?? {}) as WebsiteLayoutOverrides);
  const text = (path: Path, value: string) => update(path, value);

  const heading = (key: SectionKey) => {
    const hideable = (HIDEABLE_SECTIONS as readonly string[]).includes(key);
    return (
      <section className="panel-card">
        <header className="panel-header"><div><h2 className="panel-title">Section heading</h2><p className="panel-description">The small badge, title and line of text above the {SECTION_TITLES[key]} part of the website.{hideable ? " This section can be switched off." : ""}</p></div></header>
        <div className="modal-form">
          {hideable && (
            <VisibilityToggle
              id={`wc-layout.sections.${key}.visible`}
              label="Show this section on the website"
              checked={(readIn(layout, ["sections", key, "visible"]) as boolean | undefined) ?? true}
              onChange={(checked) => update(["sections", key, "visible"], checked ? undefined : false)}
            />
          )}
          {SECTION_NOTES[key] && <small className="wl-note">{SECTION_NOTES[key]}</small>}
          <BilingualInput path={["layout", "sections", key, "badge"]} label="Badge" value={readIn(layout, ["sections", key, "badge"]) as Partial<Bilingual> | undefined} placeholder={LAYOUT_DEFAULTS.sections[key].badge} max={LAYOUT_LIMITS.badge} errors={errors} onChange={(path, value) => text(path.slice(1), value)} />
          <BilingualInput path={["layout", "sections", key, "title"]} label="Title" value={readIn(layout, ["sections", key, "title"]) as Partial<Bilingual> | undefined} placeholder={LAYOUT_DEFAULTS.sections[key].title} max={LAYOUT_LIMITS.title} errors={errors} onChange={(path, value) => text(path.slice(1), value)} />
          <BilingualInput path={["layout", "sections", key, "subtitle"]} label="Subtitle" value={readIn(layout, ["sections", key, "subtitle"]) as Partial<Bilingual> | undefined} placeholder={LAYOUT_DEFAULTS.sections[key].subtitle} max={LAYOUT_LIMITS.subtitle} errors={errors} multiline onChange={(path, value) => text(path.slice(1), value)} />
        </div>
      </section>
    );
  };

  switch (category) {
    case "identity":
      return (
        <section className="panel-card">
          <header className="panel-header"><div><h2 className="panel-title">Menu</h2><p className="panel-description">The links at the top of the website. Rename them, or hide the ones you do not need.</p></div></header>
          <div className="modal-form">
            {NAV_KEYS.map((key) => (
              <div className="wl-nav-row" key={key}>
                <strong>{NAV_TITLES[key]}</strong>
                <BilingualInput compact path={["layout", "nav", key, "label"]} label={`${NAV_TITLES[key]} label`} value={readIn(layout, ["nav", key, "label"]) as Partial<Bilingual> | undefined} placeholder={LAYOUT_DEFAULTS.nav[key].label} max={LAYOUT_LIMITS.label} errors={errors}
                  onChange={(path, value) => text(path.slice(1), value)} />
                <div className="wl-row-head">
                  <VisibilityToggle
                    id={`wc-layout.nav.${key}.visible`}
                    label="Show"
                    checked={(readIn(layout, ["nav", key, "visible"]) as boolean | undefined) ?? true}
                    onChange={(checked) => update(["nav", key, "visible"], checked ? undefined : false)}
                  />
                </div>
              </div>
            ))}
          </div>
        </section>
      );
    case "home":
      return (
        <>
        <section className="panel-card">
          <header className="panel-header"><div><h2 className="panel-title">News and offers</h2><p className="panel-description">A moving strip under the website menu for announcements, offers and holiday notices.</p></div></header>
          <div className="modal-form">
            <BilingualInput path={["layout", "announcementLabel"]} label="Strip label" value={layout.announcementLabel} placeholder={LAYOUT_DEFAULTS.announcementLabel} max={LAYOUT_LIMITS.label} errors={errors} onChange={(path, value) => text(path.slice(1), value)} />
            <NewsListEditor basePath={["layout", "announcements"]} items={layout.announcements} errors={errors} onReplace={(path, value) => update(path.slice(1), value)} />
          </div>
        </section>
        <section className="panel-card">
          <header className="panel-header"><div><h2 className="panel-title">Home page extras</h2><p className="panel-description">The small badge above the headline and the highlights below the buttons.</p></div></header>
          <div className="modal-form">
            <BilingualInput path={["layout", "heroBadge"]} label="Badge" value={layout.heroBadge} placeholder={LAYOUT_DEFAULTS.heroBadge} max={LAYOUT_LIMITS.badge} errors={errors} onChange={(path, value) => text(path.slice(1), value)} />
            <ChipListEditor basePath={["layout", "heroChips"]} chips={layout.heroChips} errors={errors}
              onReplace={(path, value) => update(path.slice(1), value)} />
          </div>
        </section>
        </>
      );
    case "about":
      return (
        <>
        <section className="panel-card">
          <header className="panel-header"><div><h2 className="panel-title">Consultant card</h2><p className="panel-description">The card just below the top banner. Anything left empty uses the profile saved under Doctors.</p></div></header>
          <div className="modal-form">
            <VisibilityToggle
              id="wc-layout.consultant.visible"
              label="Show the consultant card on the home page"
              checked={(readIn(layout, ["consultant", "visible"]) as boolean | undefined) ?? true}
              onChange={(checked) => update(["consultant", "visible"], checked ? undefined : false)}
            />
            <BilingualInput path={["layout", "consultant", "name"]} label="Name" value={readIn(layout, ["consultant", "name"]) as Partial<Bilingual> | undefined} placeholder={{ en: "From Doctors", bn: "Doctors থেকে" }} max={80} errors={errors} onChange={(path, value) => text(path.slice(1), value)} />
            <BilingualInput path={["layout", "consultant", "role"]} label="Title or specialty" value={readIn(layout, ["consultant", "role"]) as Partial<Bilingual> | undefined} placeholder={{ en: "From Doctors", bn: "Doctors থেকে" }} max={LAYOUT_LIMITS.title} errors={errors} onChange={(path, value) => text(path.slice(1), value)} />
            <BilingualInput path={["layout", "consultant", "intro"]} label="Introduction" value={readIn(layout, ["consultant", "intro"]) as Partial<Bilingual> | undefined} placeholder={{ en: "From Doctors", bn: "Doctors থেকে" }} max={LAYOUT_LIMITS.subtitle} errors={errors} multiline onChange={(path, value) => text(path.slice(1), value)} />
            <BilingualInput path={["layout", "consultant", "linkLabel"]} label="Link text" value={readIn(layout, ["consultant", "linkLabel"]) as Partial<Bilingual> | undefined} placeholder={{ en: "Meet all our doctors", bn: "আমাদের সব চিকিৎসক" }} max={LAYOUT_LIMITS.label} errors={errors} onChange={(path, value) => text(path.slice(1), value)} />
          </div>
        </section>
        <section className="panel-card">
          <header className="panel-header"><div><h2 className="panel-title">Consultant cards</h2><p className="panel-description">The short list beside the consultant’s name. Reorder, add or remove items.</p></div></header>
          <div className="modal-form">
            <CardListEditor basePath={["layout", "aboutCards"]} title="Consultant cards" description="Shown beside the consultant’s photo." cards={layout.aboutCards as LayoutCard[] | undefined} defaults={LAYOUT_DEFAULTS.aboutCards} errors={errors}
              onReplace={(path, value) => update(path.slice(1), value)} />
          </div>
        </section>
        </>
      );
    case "services":
      return heading("services");
    case "gallery":
      return heading("gallery");
    case "why":
      return (
        <>
          {heading("whyUs")}
          <section className="panel-card">
            <header className="panel-header"><div><h2 className="panel-title">Why choose us cards</h2><p className="panel-description">The cards in the dark “Why choose us” section. Reorder, add or remove them.</p></div></header>
            <div className="modal-form">
              <CardListEditor basePath={["layout", "whyCards"]} title="Why choose us cards" description="Shown in the dark “Why choose us” section." cards={layout.whyCards as LayoutCard[] | undefined} defaults={LAYOUT_DEFAULTS.whyCards} errors={errors}
                onReplace={(path, value) => update(path.slice(1), value)} />
            </div>
          </section>
        </>
      );
    case "reviews":
      return heading("reviews");
    case "booking":
      return heading("booking");
    case "contact":
      return (
        <>
          {heading("contact")}
          <section className="panel-card">
            <header className="panel-header"><div><h2 className="panel-title">Address and email</h2><p className="panel-description">Shown beside the opening hours in the Contact section and in the footer.</p></div></header>
            <div className="modal-form">
              <div className="form-field">
                <label htmlFor="wc-layout.contactAddress">Clinic address</label>
                <textarea id="wc-layout.contactAddress" rows={3} value={layout.contactAddress ?? ""} maxLength={300} placeholder="House, road, area, city" aria-invalid={errors["layout.contactAddress"] ? true : undefined} onChange={(event) => update(["contactAddress"], event.target.value)} />
                {errors["layout.contactAddress"]
                  ? <small className="field-error" role="alert">{errors["layout.contactAddress"]}</small>
                  : <small>Leave empty to use the address from Doctors. The map searches this address unless you paste a Google Maps link below.</small>}
              </div>
              <div className="form-field">
                <label htmlFor="wc-layout.contactEmail">Email</label>
                <input id="wc-layout.contactEmail" type="email" inputMode="email" value={layout.contactEmail ?? ""} maxLength={120} placeholder="name@example.com" aria-invalid={errors["layout.contactEmail"] ? true : undefined} onChange={(event) => update(["contactEmail"], event.target.value)} />
                {errors["layout.contactEmail"]
                  ? <small className="field-error" role="alert">{errors["layout.contactEmail"]}</small>
                  : <small>Leave empty to hide it.</small>}
              </div>
            </div>
          </section>

          <section className="panel-card">
            <header className="panel-header"><div><h2 className="panel-title">Google Map</h2><p className="panel-description">The map beside the clinic address in the Contact section.</p></div></header>
            <div className="modal-form">
              <div className="form-field">
                <label htmlFor="wc-layout.mapUrl">Google Maps link</label>
                <input
                  id="wc-layout.mapUrl"
                  type="url"
                  inputMode="url"
                  value={layout.mapUrl ?? ""}
                  maxLength={LAYOUT_LIMITS.url}
                  placeholder="https://maps.app.goo.gl/…"
                  aria-invalid={errors["layout.mapUrl"] ? true : undefined}
                  aria-describedby="wc-layout.mapUrl-hint"
                  onChange={(event) => update(["mapUrl"], event.target.value)}
                />
                {errors["layout.mapUrl"] && <small className="field-error" role="alert">{errors["layout.mapUrl"]}</small>}
                <small id="wc-layout.mapUrl-hint">
                  In Google Maps open your clinic, press <strong>Share</strong>, copy the link and paste it here (a short <code>maps.app.goo.gl</code> link works). The map appears on the website after you save. Leave empty to search the map from the clinic address above.
                </small>
              </div>
              {layout.mapEmbedUrl && layout.mapUrl && (
                <div className="grid gap-2">
                  <strong className="text-sm">Map on the website now</strong>
                  <iframe title="Current clinic map" src={layout.mapEmbedUrl} className="h-60 w-full rounded-xl border border-line-1" loading="lazy" referrerPolicy="no-referrer-when-downgrade" />
                  <small className="text-ink-3">Changed the link? Save to refresh this preview.</small>
                </div>
              )}
            </div>
          </section>

          <section className="panel-card">
            <header className="panel-header"><div><h2 className="panel-title">Footer and links</h2><p className="panel-description">A short note in the footer, and your Facebook page.</p></div></header>
            <div className="modal-form">
              <BilingualInput path={["layout", "footerNote"]} label="Footer note" value={layout.footerNote} placeholder={LAYOUT_DEFAULTS.footerNote} max={LAYOUT_LIMITS.footerNote} errors={errors} multiline onChange={(path, value) => text(path.slice(1), value)} />
              <div className="form-field">
                <label htmlFor="wc-layout.facebookUrl">Facebook page link</label>
                <input id="wc-layout.facebookUrl" value={layout.facebookUrl ?? ""} placeholder="https://www.facebook.com/…" aria-invalid={errors["layout.facebookUrl"] ? true : undefined} onChange={(event) => update(["facebookUrl"], event.target.value)} />
                {errors["layout.facebookUrl"]
                  ? <small className="field-error" role="alert">{errors["layout.facebookUrl"]}</small>
                  : <small>A full https:// link. Shown in the contact section and footer. Leave empty to hide it.</small>}
              </div>
              <div className="form-field">
                <label htmlFor="wc-layout.whatsappNumber">WhatsApp number</label>
                <input id="wc-layout.whatsappNumber" type="tel" inputMode="tel" value={layout.whatsappNumber ?? ""} placeholder="01712345678" aria-invalid={errors["layout.whatsappNumber"] ? true : undefined} onChange={(event) => update(["whatsappNumber"], event.target.value)} />
                {errors["layout.whatsappNumber"]
                  ? <small className="field-error" role="alert">{errors["layout.whatsappNumber"]}</small>
                  : <small>Patients can book and message you on WhatsApp. Shown in the booking form and contact section. Leave empty to use the phone number from Doctors, or to hide WhatsApp.</small>}
              </div>
            </div>
          </section>
        </>
      );
  }
}
