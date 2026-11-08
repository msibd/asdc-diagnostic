"use client";

import Link from "next/link";
import { Megaphone } from "lucide-react";
import { usePublicLanguage } from "./public-language";
import type { Bilingual } from "@/modules/website/schemas/website-layout";

export type Announcement = { text: Bilingual; href: string };

/**
 * News and offers that scroll from right to left under the header (managed in the admin panel under
 * Website content). It pauses while the pointer or keyboard focus is on it, and people who ask their
 * system for reduced motion get the same items as a plain wrapped list. The second copy of the list
 * only makes the loop seamless, so it is hidden from screen readers and skipped by the Tab key.
 */
export default function AnnouncementTicker({ items, label: customLabel }: { items: Announcement[]; label: Bilingual }) {
  const { language } = usePublicLanguage();
  if (!items.length) return null;
  const label = customLabel[language];
  // About 0.17 s per character keeps the text readable; never faster than a 20-second loop.
  const seconds = Math.max(20, Math.round(items.reduce((sum, item) => sum + item.text[language].length, 0) * 0.17));

  const list = (copy: boolean) => (
    <ul className={`ticker-group${copy ? " ticker-copy" : ""}`} aria-hidden={copy || undefined}>
      {items.map((item, index) => {
        const text = item.text[language];
        const internal = item.href.startsWith("/");
        return (
          <li key={index}>
            {item.href
              ? internal
                ? <Link href={item.href} tabIndex={copy ? -1 : undefined}>{text}</Link>
                : <a href={item.href} target="_blank" rel="noopener noreferrer" tabIndex={copy ? -1 : undefined}>{text}</a>
              : <span>{text}</span>}
          </li>
        );
      })}
    </ul>
  );

  return (
    <section className="ticker" aria-label={label}>
      <div className="site-container ticker-row">
        <span className="ticker-label"><Megaphone size={15} aria-hidden="true" />{label}</span>
        <div className="ticker-window">
          <div className="ticker-track" style={{ animationDuration: `${seconds}s` }}>{list(false)}{list(true)}</div>
        </div>
      </div>
    </section>
  );
}
