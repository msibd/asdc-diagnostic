"use client";

import { useEffect, useState } from "react";
import { CalendarCheck, ChevronLeft, ChevronRight, Clock3, Pause, Play } from "lucide-react";
import { localize, usePublicLanguage } from "./public-language";
import { categoryName, feeLabel, numberFormat, pick, ServiceIcon, serviceName, timeLabel } from "./public-services";
import type { ClinicService } from "./types";

const AUTOPLAY_MS = 5000;
const MAX_SLIDES = 8;

/**
 * The hero's slider of the centre's tests and services. It shows the services saved under Services in
 * the dashboard (newest changes appear after the public page refreshes), one at a time: arrows, dots,
 * and an automatic advance that stops on hover, on keyboard focus, and for visitors who ask for less
 * motion. A pause button is always available.
 */
export default function HeroServiceSlider({ services, onBook }: { services: ClinicService[]; onBook: (service: ClinicService) => void }) {
  const { language } = usePublicLanguage();
  const slides = services.slice(0, MAX_SLIDES);
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [hovering, setHovering] = useState(false);
  const [reduceMotion, setReduceMotion] = useState(true);
  const count = slides.length;
  const digits = numberFormat(language);

  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setReduceMotion(query.matches);
    sync();
    query.addEventListener("change", sync);
    return () => query.removeEventListener("change", sync);
  }, []);

  const playing = !paused && !hovering && !reduceMotion && count > 1;
  useEffect(() => {
    if (!playing) return;
    const timer = window.setInterval(() => setIndex((current) => (current + 1) % count), AUTOPLAY_MS);
    return () => window.clearInterval(timer);
  }, [playing, count]);

  if (!count) return null;
  const current = Math.min(index, count - 1);
  const go = (next: number) => setIndex((next + count) % count);

  return (
    <section
      aria-roledescription="carousel"
      aria-label={localize(language, "Our tests and services", "আমাদের পরীক্ষা ও সেবা")}
      className="w-full max-w-md rounded-xl border border-purple-200 bg-white shadow-[0_12px_32px_-12px_rgb(8_69_72/0.25)]"
      onMouseEnter={() => setHovering(true)}
      onMouseLeave={() => setHovering(false)}
      onFocus={() => setHovering(true)}
      onBlur={() => setHovering(false)}
    >
      <div className="flex items-center justify-between gap-3 border-b border-purple-100 px-5 py-3">
        <h2 className="text-base font-bold text-ink">{localize(language, "Our tests and services", "আমাদের পরীক্ষা ও সেবা")}</h2>
        <span className="text-sm tabular-nums text-slate-600" aria-hidden="true">{digits.format(current + 1)} / {digits.format(count)}</span>
      </div>

      <div className="overflow-hidden">
        <ul
          className="flex transition-transform duration-500 ease-out motion-reduce:transition-none"
          style={{ transform: `translateX(-${current * 100}%)` }}
          aria-live={playing ? "off" : "polite"}
        >
          {slides.map((service, position) => {
            const description = (language === "bn" && service.descriptionBn) || service.description || pick(language, service.detailsEn, service.detailsBn);
            const name = serviceName(service, language);
            return (
              <li
                key={service.id}
                className="w-full shrink-0 px-5 py-5"
                role="group"
                aria-roledescription="slide"
                aria-label={`${digits.format(position + 1)} / ${digits.format(count)}`}
                aria-hidden={position !== current}
                inert={position !== current}
              >
                <div className="flex items-start gap-4">
                  <span className="grid size-12 shrink-0 place-items-center rounded-full bg-purple-100 text-purple-700"><ServiceIcon service={service} size={22} /></span>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-purple-700">{categoryName(service, language)}</p>
                    <h3 className="mt-0.5 text-xl font-bold leading-snug text-ink">{name}</h3>
                  </div>
                </div>
                {description && <p className="mt-3 line-clamp-3 min-h-[4.5rem] text-sm leading-relaxed text-slate-600">{description}</p>}
                <dl className="mt-4 grid grid-cols-2 gap-3 rounded-lg bg-purple-50 px-4 py-3 text-sm">
                  <div>
                    <dt className="flex items-center gap-1.5 text-slate-600"><Clock3 size={14} aria-hidden="true" /> {localize(language, "Report time", "সময়")}</dt>
                    <dd className="mt-0.5 font-semibold text-ink">{timeLabel(service, language)}</dd>
                  </div>
                  <div>
                    <dt className="text-slate-600">{localize(language, "Fee", "ফি")}</dt>
                    <dd className="mt-0.5 font-bold tabular-nums text-ink">{feeLabel(service, language)}</dd>
                  </div>
                </dl>
                <button type="button" onClick={() => onBook(service)} className="mt-4 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-md bg-cta px-4 text-sm font-semibold text-purple-950 transition-colors hover:bg-cta-dark">
                  <CalendarCheck size={16} aria-hidden="true" /> {localize(language, "Book", "বুক করুন")}<span className="sr-only"> — {name}</span>
                </button>
              </li>
            );
          })}
        </ul>
      </div>

      {count > 1 && (
        <div className="flex items-center justify-between gap-3 border-t border-purple-100 px-4 py-2.5">
          <div className="flex items-center gap-1">
            <button type="button" onClick={() => go(current - 1)} aria-label={localize(language, "Previous service", "আগের সেবা")} className="grid size-9 place-items-center rounded-full text-purple-800 transition-colors hover:bg-purple-100"><ChevronLeft size={18} aria-hidden="true" /></button>
            <button type="button" onClick={() => go(current + 1)} aria-label={localize(language, "Next service", "পরের সেবা")} className="grid size-9 place-items-center rounded-full text-purple-800 transition-colors hover:bg-purple-100"><ChevronRight size={18} aria-hidden="true" /></button>
          </div>
          <div className="flex items-center gap-1" role="group" aria-label={localize(language, "Choose a service", "সেবা বেছে নিন")}>
            {slides.map((service, position) => (
              <button key={service.id} type="button" onClick={() => setIndex(position)} aria-label={serviceName(service, language)} aria-current={position === current ? "true" : undefined} className="grid size-6 place-items-center rounded-full">
                <span className={`block rounded-full transition-all ${position === current ? "h-2 w-5 bg-purple-700" : "size-2 bg-purple-300"}`} />
              </button>
            ))}
          </div>
          <button type="button" onClick={() => setPaused((value) => !value)} aria-pressed={paused} aria-label={paused ? localize(language, "Play slideshow", "স্লাইড চালু করুন") : localize(language, "Pause slideshow", "স্লাইড থামান")} className="grid size-9 place-items-center rounded-full text-purple-800 transition-colors hover:bg-purple-100">
            {paused ? <Play size={16} aria-hidden="true" /> : <Pause size={16} aria-hidden="true" />}
          </button>
        </div>
      )}
    </section>
  );
}
