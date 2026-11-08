"use client";

import { useId, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Download, Upload } from "lucide-react";
import Modal from "@/components/shared/modal";
import { parseCsv } from "@/lib/csv";
import { requestJson } from "@/modules/clinic/components/clinic-types";
import { IMPORT_LIMITS, IMPORT_MODULES, type ImportField, type ImportMode, type ImportModule, type ImportPreview, type ImportResult } from "../import-config";

const normalize = (text: string) => text.toLowerCase().replace(/[^a-z0-9]/g, "");

/** Pre-selects the file column whose name matches a field's name or a known alias. */
function autoMap(headers: string[], fields: ImportField[]) {
  const mapping: Record<string, string> = {};
  for (const field of fields) {
    const names = [field.key, field.label, ...(field.aliases ?? [])].map(normalize);
    const match = headers.find((header) => names.includes(normalize(header)));
    if (match) mapping[field.key] = match;
  }
  return mapping;
}

function downloadTemplate(module: ImportModule) {
  const { fields } = IMPORT_MODULES[module];
  const url = URL.createObjectURL(new Blob([`﻿${fields.map((field) => `"${field.label}"`).join(",")}\r\n`], { type: "text/csv;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = `${module}-import-template.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

/**
 * CSV import in four steps: choose the file, match its columns to the fields, check it (nothing is
 * saved), then import the valid rows. The server checks everything again before saving.
 */
export default function ImportDialog({ module, onClose, onImported }: { module: ImportModule; onClose: () => void; onImported: () => void }) {
  const titleId = useId();
  const config = IMPORT_MODULES[module];
  const [file, setFile] = useState<{ name: string; text: string; table: string[][] } | null>(null);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState("");

  const run = useMutation({
    mutationFn: async (mode: ImportMode) => requestJson<ImportPreview | ImportResult>(await fetch(`/api/import/${module}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fileName: file?.name, csv: file?.text, mapping: Object.fromEntries(Object.entries(mapping).filter(([, header]) => header)), mode }),
    })),
    onSuccess: (data) => {
      setError("");
      if (data.mode === "preview") setPreview(data);
      else { setResult(data); onImported(); }
    },
    onError: (failure) => setError(failure instanceof Error ? failure.message : "The import failed."),
  });

  async function choose(selected: File | undefined) {
    setPreview(null); setResult(null); setError("");
    if (!selected) return;
    if (!/\.csv$/i.test(selected.name)) return setError("Only .csv files can be imported. In Excel, use Save As and choose CSV.");
    if (selected.size > IMPORT_LIMITS.maxBytes) return setError("The file is too large (2 MB at most).");
    try {
      const text = await selected.text();
      const table = parseCsv(text);
      if (table.length < 2) return setError("The file needs a header row and at least one data row.");
      setFile({ name: selected.name, text, table });
      setMapping(autoMap(table[0].map((cell) => cell.trim()), config.fields));
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "The file could not be read.");
    }
  }

  const headers = file?.table[0].map((cell) => cell.trim()).filter(Boolean) ?? [];
  const missing = config.fields.filter((field) => field.required && !mapping[field.key]);
  const busy = run.isPending;
  const rows = file ? file.table.length - 1 : 0;
  const summaryOf = (row: { values: Record<string, string> }) => config.fields.slice(0, 2).map((field) => row.values[field.key]).filter(Boolean).join(" · ") || "—";

  return (
    <Modal className="import-modal" labelledBy={titleId} onRequestClose={() => { if (!busy) onClose(); }}>
      <div className="modal-heading">
        <div>
          <h2 id={titleId}>Import {config.label} from CSV</h2>
          <p>Up to {IMPORT_LIMITS.maxRows} rows, 2 MB. Existing records are never changed; repeats are skipped.</p>
        </div>
      </div>

      <div className="import-body">
        {error && <div className="form-error" role="alert">{error}</div>}

        <div className="import-file">
          <label className="button-secondary import-pick"><Upload size={14} /> {file ? "Choose another file" : "Choose CSV file"}
            <input type="file" accept=".csv,text/csv" hidden onChange={(event) => { void choose(event.target.files?.[0]); event.target.value = ""; }} />
          </label>
          <button type="button" className="request-action" onClick={() => downloadTemplate(module)}><Download size={12} /> Download template</button>
          {file && <span className="import-file-name">{file.name} · {rows} row{rows === 1 ? "" : "s"}</span>}
        </div>

        {file && !result && (
          <>
            <fieldset className="import-map">
              <legend>Match columns</legend>
              <div className="form-grid">
                {config.fields.map((field) => (
                  <label className="form-field" key={field.key}>{field.label}{field.required && " *"}{field.hint && <small> ({field.hint})</small>}
                    <select value={mapping[field.key] ?? ""} disabled={busy} onChange={(event) => { setMapping((current) => ({ ...current, [field.key]: event.target.value })); setPreview(null); }}>
                      <option value="">{field.required ? "Choose a column" : "Not in the file"}</option>
                      {headers.map((header) => <option key={header} value={header}>{header}</option>)}
                    </select>
                  </label>
                ))}
              </div>
            </fieldset>

            <div className="table-scroll import-sample">
              <table className="data-table">
                <caption className="sr-only">First rows of the file</caption>
                <thead><tr>{file.table[0].map((cell, index) => <th key={index} scope="col">{cell}</th>)}</tr></thead>
                <tbody>{file.table.slice(1, 6).map((row, index) => <tr key={index}>{file.table[0].map((_, column) => <td key={column}>{row[column] ?? ""}</td>)}</tr>)}</tbody>
              </table>
            </div>
          </>
        )}

        {preview && !result && (
          <div className="import-summary" role="status">
            <span className="badge badge-success">{preview.summary.valid} ready to import</span>
            <span className="badge badge-warning">{preview.summary.duplicate} duplicate{preview.summary.duplicate === 1 ? "" : "s"} (skipped)</span>
            <span className="badge badge-danger">{preview.summary.invalid} with errors</span>
          </div>
        )}
        {result && (
          <div className="import-summary" role="status">
            <span className="badge badge-success">{result.summary.imported} imported</span>
            <span className="badge badge-warning">{result.summary.skipped} skipped</span>
            <span className="badge badge-danger">{result.summary.failed} failed</span>
          </div>
        )}

        {(result ? result.problems : preview?.problems)?.length ? (
          <div className="table-scroll import-problems">
            <table className="data-table">
              <caption className="sr-only">Rows that need attention</caption>
              <thead><tr><th scope="col">Row</th><th scope="col">Record</th><th scope="col">Status</th><th scope="col">Why</th></tr></thead>
              <tbody>
                {(result ? result.problems : preview!.problems).map((row) => {
                  const message = "message" in row ? row.message : row.errors.join(" ");
                  const tone = row.status === "invalid" || row.status === "failed" ? "badge-danger" : "badge-warning";
                  return <tr key={row.line}><td>{row.line}</td><td>{summaryOf(row)}</td><td><span className={`badge ${tone}`}>{row.status}</span></td><td>{message}</td></tr>;
                })}
              </tbody>
            </table>
            {(result ? result.truncated : preview?.truncated) && <p className="import-note">Only the first 200 problem rows are shown.</p>}
          </div>
        ) : null}
      </div>

      <div className="modal-actions">
        <button type="button" className="button-secondary" disabled={busy} onClick={onClose}>{result ? "Close" : "Cancel"}</button>
        {file && !result && (
          preview && preview.summary.valid > 0 ? (
            <button type="button" className="button-primary" disabled={busy} onClick={() => run.mutate("commit")}>{busy ? "Importing…" : `Import ${preview.summary.valid} ${preview.summary.valid === 1 ? config.noun : `${config.noun}s`}`}</button>
          ) : (
            <button type="button" className="button-primary" disabled={busy || missing.length > 0} title={missing.length ? `Choose the column for ${missing.map((field) => field.label).join(", ")}` : undefined} onClick={() => run.mutate("preview")}>{busy ? "Checking…" : "Check file"}</button>
          )
        )}
      </div>
    </Modal>
  );
}
