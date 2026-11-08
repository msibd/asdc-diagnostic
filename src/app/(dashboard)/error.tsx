"use client";

import { useEffect } from "react";
import { AlertCircle } from "lucide-react";

// Shown inside the dashboard shell (sidebar stays) when a page fails to render, instead of a
// blank screen. Network/API failures inside pages are already handled by the pages themselves.
export default function DashboardError({
  error,
  retry,
}: {
  error: unknown;
  retry: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="main-area">
      <main className="content">
        <section className="panel-card patient-load-error dashboard-error" role="alert">
          <AlertCircle size={20} aria-hidden="true" />
          <div>
            <h1>Something went wrong</h1>
            <p>This page could not be displayed. Your data has not been changed. Try again, or return to the overview.</p>
          </div>
          <div className="dashboard-error-actions">
            <button type="button" className="button-primary" onClick={() => retry()}>Try again</button>
            <a className="button-secondary" href="/dashboard">Back to overview</a>
          </div>
        </section>
      </main>
    </div>
  );
}
