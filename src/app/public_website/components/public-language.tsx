"use client";

import { createContext, useContext, useEffect, useSyncExternalStore, type ReactNode } from "react";

export type PublicLanguage = "en" | "bn";

const languageStorageKey = "clinic-public-language";
let currentLanguage: PublicLanguage = "en";
let initialized = false;
const listeners = new Set<() => void>();
const PublicLanguageContext = createContext<{
  language: PublicLanguage;
  setLanguage: (language: PublicLanguage) => void;
} | null>(null);

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getLanguageSnapshot() {
  if (typeof window !== "undefined" && !initialized) {
    const savedLanguage = window.localStorage.getItem(languageStorageKey);
    if (savedLanguage === "en" || savedLanguage === "bn") currentLanguage = savedLanguage;
    initialized = true;
  }
  return currentLanguage;
}

function setPublicLanguage(language: PublicLanguage) {
  currentLanguage = language;
  initialized = true;
  window.localStorage.setItem(languageStorageKey, language);
  listeners.forEach((listener) => listener());
}

export function PublicLanguageProvider({ children }: { children: ReactNode }) {
  const language = useSyncExternalStore(subscribe, getLanguageSnapshot, (): PublicLanguage => "en");

  // Reveal the page once it is rendering in the visitor's saved language (see the bootstrap script
  // in the root layout). During hydration the language is still the server's "en", so wait for it.
  useEffect(() => {
    const root = document.documentElement;
    const saved = root.dataset.publicLang;
    if (!saved || saved === language) root.dataset.publicReady = "1";
  }, [language]);

  return (
    <PublicLanguageContext.Provider value={{ language, setLanguage: setPublicLanguage }}>
      {children}
    </PublicLanguageContext.Provider>
  );
}

export function usePublicLanguage() {
  const context = useContext(PublicLanguageContext);
  if (!context) throw new Error("usePublicLanguage must be used within PublicLanguageProvider.");
  return context;
}

export function localize(language: PublicLanguage, english: string, bangla: string) {
  return language === "bn" ? bangla : english;
}
