"use client";

import { useEffect, type ReactNode } from "react";
import {
  useDashboardUiStore,
  type ThemePreference,
} from "@/stores/dashboard-ui-store";

function isThemePreference(value: string | null): value is ThemePreference {
  return value === "light" || value === "dark" || value === "system";
}

export default function ThemeProvider({ children }: { children: ReactNode }) {
  const theme = useDashboardUiStore((state) => state.theme);
  const setTheme = useDashboardUiStore((state) => state.setTheme);

  useEffect(() => {
    const savedTheme = window.localStorage.getItem("clinic-theme");
    if (isThemePreference(savedTheme)) setTheme(savedTheme);
  }, [setTheme]);

  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const applyTheme = () => {
      const isDark = theme === "dark" || (theme === "system" && media.matches);
      document.documentElement.dataset.theme = isDark ? "dark" : "light";
      document.documentElement.style.colorScheme = isDark ? "dark" : "light";
    };

    applyTheme();
    media.addEventListener("change", applyTheme);
    return () => media.removeEventListener("change", applyTheme);
  }, [theme]);

  return children;
}
