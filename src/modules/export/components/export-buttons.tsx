"use client";

import { useState } from "react";
import { Download, Printer } from "lucide-react";
import { useAdminSession } from "@/components/shared/admin-session-provider";
import { getClinicDateKey } from "@/lib/clinic-date";
import { EXPORT_PERMISSIONS, type ExportDataset } from "../export-config";

type Filters = { search?: string; status?: string; category?: string; sort?: string };

/**
 * "CSV" downloads the list (opens in Excel); "PDF" opens a printable report to save as PDF. Both use
 * the filters passed in, which should be the ones on screen. With `range` the person also picks dates;
 * a screen that already has date pickers passes its own as `dates`.
 * Shown only to people who may export that list; the server checks again.
 */
export default function ExportButtons({ dataset, filters = {}, range = false, dates }: { dataset: ExportDataset; filters?: Filters; range?: boolean; dates?: { from: string; to: string } }) {
  const { user } = useAdminSession();
  const today = getClinicDateKey(new Date());
  const [ownFrom, setFrom] = useState(`${today.slice(0, 8)}01`);
  const [ownTo, setTo] = useState(today);
  const from = dates?.from ?? ownFrom;
  const to = dates?.to ?? ownTo;
  const useDates = range || Boolean(dates);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  if (!user.permissions.includes(EXPORT_PERMISSIONS[dataset])) return null;

  const query = (format: "csv" | "print") => {
    const params = new URLSearchParams({ format });
    if (useDates) { params.set("from", from); params.set("to", to); }
    for (const [key, value] of Object.entries(filters)) if (value && value !== "ALL") params.set(key, value);
    return `/api/export/${dataset}?${params}`;
  };

  async function download() {
    setBusy(true);
    setError("");
    try {
      const response = await fetch(query("csv"));
      if (!response.ok) throw new Error(((await response.json().catch(() => ({}))) as { error?: string }).error ?? "The export failed.");
      const name = /filename="([^"]+)"/.exec(response.headers.get("content-disposition") ?? "")?.[1] ?? `${dataset}.csv`;
      const url = URL.createObjectURL(await response.blob());
      const link = document.createElement("a");
      link.href = url;
      link.download = name;
      link.click();
      URL.revokeObjectURL(url);
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "The export failed.");
    } finally { setBusy(false); }
  }

  return (
    <div className="export-bar">
      {range && !dates && (
        <>
          <label className="export-date">From<input type="date" value={from} max={to} onChange={(event) => setFrom(event.target.value)} /></label>
          <label className="export-date">To<input type="date" value={to} min={from} onChange={(event) => setTo(event.target.value)} /></label>
        </>
      )}
      <button type="button" className="button-secondary" disabled={busy || (useDates && (!from || !to))} onClick={() => void download()}><Download size={14} /> {busy ? "Preparing…" : "CSV"}</button>
      <a className="button-secondary" href={query("print")} target="_blank" rel="noopener" aria-disabled={useDates && (!from || !to)}><Printer size={14} /> PDF</a>
      {error && <span className="export-error" role="alert">{error}</span>}
    </div>
  );
}
