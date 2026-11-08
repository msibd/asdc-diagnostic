import type { Cell } from "./export-service";

const escapeHtml = (value: string | number) => String(value).replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char] as string);

/**
 * A clean A4 report page: clinic name, report title, filters, who printed it and when, a table whose
 * header repeats on every page, and a totals row. The reader uses Print, then "Save as PDF". Every
 * value is escaped, so a name or note can never inject markup.
 */
export function renderPrintable({ clinic, title, filters, headers, rows, sumColumns = [], printedBy, printedAt }: {
  clinic: string; title: string; filters: string; headers: string[]; rows: Cell[][]; sumColumns?: number[]; printedBy: string; printedAt: string;
}) {
  const numeric = new Set(headers.map((_, column) => column).filter((column) => rows.some((row) => typeof row[column] === "number")));
  const totals = sumColumns.map((column) => rows.reduce((sum, row) => sum + (typeof row[column] === "number" ? (row[column] as number) : 0), 0));
  const cell = (tag: "th" | "td", value: Cell, column: number) => `<${tag}${numeric.has(column) ? ' class="num"' : ""}>${escapeHtml(value)}</${tag}>`;
  const totalRow = sumColumns.length
    ? `<tr class="total">${headers.map((_, column) => {
        const index = sumColumns.indexOf(column);
        if (index >= 0) return `<td class="num">${escapeHtml(totals[index].toFixed(2))}</td>`;
        return `<td>${column === 0 ? "Total" : ""}</td>`;
      }).join("")}</tr>`
    : "";

  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(`${clinic} - ${title}`)}</title>
<style>
  @page { size: A4; margin: 14mm; }
  * { box-sizing: border-box; }
  body { margin: 0; padding: 24px; color: #1f2c40; font: 12px/1.45 system-ui, -apple-system, "Segoe UI", sans-serif; }
  header { padding-bottom: 10px; border-bottom: 2px solid #1f2c40; }
  .clinic { font-size: 11px; font-weight: 600; letter-spacing: .02em; color: #4a5668; }
  h1 { margin: 2px 0 6px; font-size: 20px; }
  .meta { display: flex; flex-wrap: wrap; gap: 4px 18px; color: #4a5668; }
  table { width: 100%; margin-top: 14px; border-collapse: collapse; }
  thead { display: table-header-group; }
  th, td { padding: 6px 8px; border-bottom: 1px solid #d9d4d0; text-align: left; vertical-align: top; }
  th { background: #f1eeec; font-size: 11px; }
  tr { break-inside: avoid; }
  .num { text-align: right; font-variant-numeric: tabular-nums; white-space: nowrap; }
  .total td { border-top: 2px solid #1f2c40; border-bottom: 0; font-weight: 700; }
  .empty { padding: 24px 8px; color: #4a5668; text-align: center; }
  .actions { margin-bottom: 16px; }
  button { padding: 8px 14px; border: 0; border-radius: 8px; background: #ea580c; color: #fff; font: inherit; font-weight: 600; cursor: pointer; }
  footer { margin-top: 12px; color: #5f6b7a; font-size: 10px; }
  @media print { body { padding: 0; } .actions { display: none; } }
</style></head>
<body>
<div class="actions"><button type="button" onclick="window.print()">Print or save as PDF</button></div>
<header>
  <div class="clinic">${escapeHtml(clinic)}</div>
  <h1>${escapeHtml(title)}</h1>
  <div class="meta"><span>${escapeHtml(filters)}</span><span>${rows.length} row${rows.length === 1 ? "" : "s"}</span><span>Printed ${escapeHtml(printedAt)} by ${escapeHtml(printedBy)}</span></div>
</header>
<table>
  <thead><tr>${headers.map((header, column) => cell("th", header, column)).join("")}</tr></thead>
  <tbody>${rows.length ? rows.map((row) => `<tr>${headers.map((_, column) => cell("td", row[column] ?? "", column)).join("")}</tr>`).join("") : `<tr><td class="empty" colspan="${headers.length}">Nothing matches these filters.</td></tr>`}${totalRow}</tbody>
</table>
<footer>Confidential: for clinic staff only.</footer>
</body></html>`;
}
