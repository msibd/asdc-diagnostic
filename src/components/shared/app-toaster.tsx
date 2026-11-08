"use client";

import { Toaster } from "sonner";
import { useDashboardUiStore } from "@/stores/dashboard-ui-store";

// One notification area for the whole app. It follows the app's own light/dark/system choice
// (not only the device setting), sits bottom-right, and every toast can be closed by hand.
export default function AppToaster() {
  const theme = useDashboardUiStore((state) => state.theme);
  return (
    <Toaster
      theme={theme}
      position="bottom-right"
      richColors
      closeButton
      visibleToasts={4}
      duration={4000}
      offset={20}
      mobileOffset={16}
      toastOptions={{ style: { fontFamily: "var(--font-geist-sans), system-ui, sans-serif", fontSize: "13.5px" } }}
    />
  );
}
