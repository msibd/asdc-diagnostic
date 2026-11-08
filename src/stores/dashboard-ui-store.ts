"use client";

import { create } from "zustand";

export type ThemePreference = "light" | "dark" | "system";

type DashboardUiState = {
  sidebarCollapsed: boolean;
  mobileSidebarOpen: boolean;
  globalSearch: string;
  profileMenuOpen: boolean;
  theme: ThemePreference;
  toggleSidebarCollapsed: () => void;
  setMobileSidebarOpen: (open: boolean) => void;
  setGlobalSearch: (query: string) => void;
  setProfileMenuOpen: (open: boolean) => void;
  toggleProfileMenu: () => void;
  setTheme: (theme: ThemePreference) => void;
};

export const useDashboardUiStore = create<DashboardUiState>((set) => ({
  sidebarCollapsed: false,
  mobileSidebarOpen: false,
  globalSearch: "",
  profileMenuOpen: false,
  theme: "system",
  toggleSidebarCollapsed: () =>
    set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),
  setMobileSidebarOpen: (mobileSidebarOpen) => set({ mobileSidebarOpen }),
  setGlobalSearch: (globalSearch) => set({ globalSearch }),
  setProfileMenuOpen: (profileMenuOpen) => set({ profileMenuOpen }),
  toggleProfileMenu: () =>
    set((state) => ({ profileMenuOpen: !state.profileMenuOpen })),
  setTheme: (theme) => {
    window.localStorage.setItem("clinic-theme", theme);
    set({ theme });
  },
}));
