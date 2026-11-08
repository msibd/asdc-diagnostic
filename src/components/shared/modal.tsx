"use client";

import { useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from "react";

const focusableSelector = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled]):not([type=hidden])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "[tabindex]:not([tabindex='-1'])",
].join(",");

function focusableWithin(root: HTMLElement) {
  return [...root.querySelectorAll<HTMLElement>(focusableSelector)].filter(
    (element) => element.getClientRects().length > 0,
  );
}

// How many dialogs are open (a confirm can sit on top of a form): the page behind scrolls only when none is.
let openDialogs = 0;

// Accessible dialog shell: moves focus in on open, keeps Tab inside, closes on Escape or a
// click on the backdrop, and returns focus to whatever opened it. The caller decides whether
// closing is allowed right now (e.g. while saving) by passing a guarded `onRequestClose`.
export default function Modal({
  className,
  labelledBy,
  onRequestClose,
  children,
}: {
  className?: string;
  labelledBy: string;
  onRequestClose: () => void;
  children: ReactNode;
}) {
  const dialogRef = useRef<HTMLElement>(null);
  // Captured during the first render, before React's autoFocus can move focus into the dialog.
  const [opener] = useState<HTMLElement | null>(() =>
    typeof document !== "undefined" && document.activeElement instanceof HTMLElement && document.activeElement !== document.body
      ? document.activeElement
      : null,
  );

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    // An element inside may already have taken focus through autoFocus.
    if (!dialog.contains(document.activeElement)) {
      const focusable = focusableWithin(dialog);
      // Prefer the first form field so data entry can start immediately; otherwise the first control.
      const target = focusable.find((element) => /^(INPUT|SELECT|TEXTAREA)$/.test(element.tagName)) ?? focusable[0] ?? dialog;
      target.focus();
    }

    return () => {
      if (opener && document.contains(opener)) opener.focus();
    };
  }, [opener]);

  useEffect(() => {
    if (openDialogs++ === 0) document.body.style.overflow = "hidden";
    return () => { if (--openDialogs === 0) document.body.style.overflow = ""; };
  }, []);

  function handleKeyDown(event: KeyboardEvent<HTMLElement>) {
    if (event.key === "Escape") {
      event.stopPropagation();
      onRequestClose();
      return;
    }
    if (event.key !== "Tab") return;

    const dialog = dialogRef.current;
    if (!dialog) return;
    const focusable = focusableWithin(dialog);
    if (!focusable.length) {
      event.preventDefault();
      dialog.focus();
      return;
    }
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    const active = document.activeElement;
    if (event.shiftKey && (active === first || active === dialog)) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && active === last) {
      event.preventDefault();
      first.focus();
    }
  }

  return (
    <div
      className="modal-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onRequestClose();
      }}
    >
      <section
        ref={dialogRef}
        className={`modal${className ? ` ${className}` : ""}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
        tabIndex={-1}
        onKeyDown={handleKeyDown}
      >
        {children}
      </section>
    </div>
  );
}
