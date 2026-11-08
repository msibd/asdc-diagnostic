import { z } from "zod";
import { authorize } from "@/lib/admin-session";
import { apiError, parseQuery } from "@/lib/api";
import { writeAuditEvent } from "@/lib/audit";
import { BRAND_NAME } from "@/lib/brand";
import { formatClinicDateTime } from "@/lib/clinic-date";
import { csvLine } from "@/lib/csv";
import { hitRateLimit } from "@/lib/rate-limit";
import { renderPrintable } from "@/modules/export/export-print";
import { isExportDataset } from "@/modules/export/export-config";
import { EXPORTS, EXPORT_LIMITS, exportFileName, type Cell, type ExportFilters } from "@/modules/export/export-service";

const querySchema = z.object({
  format: z.enum(["csv", "print"]).default("csv"),
  from: z.iso.date().optional(),
  to: z.iso.date().optional(),
  search: z.string().trim().max(100).default(""),
  status: z.string().trim().max(30).default(""),
  category: z.string().trim().max(30).default(""),
  sort: z.enum(["newest", "name"]).default("newest"),
});

/**
 * Downloads a list as CSV (opens in Excel; written in pieces, so a long list never fills memory) or as
 * a printable report page (Print, then "Save as PDF"). The filters are the ones on screen. The
 * permission is the one that lets the person see that list, and only safe columns are written.
 */
export async function GET(request: Request, { params }: { params: Promise<{ dataset: string }> }) {
  const { dataset } = await params;
  if (!isExportDataset(dataset)) return apiError("Unknown export.", 404);
  const definition = EXPORTS[dataset];
  const access = await authorize(request.headers, definition.permission);
  if (!access.session) return apiError(access.error, access.status);

  const query = parseQuery(request, querySchema, "Invalid export filters.");
  if (!query.ok) return query.response;
  const { format, ...filters } = query.data satisfies { format: "csv" | "print" } & ExportFilters;
  if (filters.from && filters.to && filters.from > filters.to) return apiError("The start date is after the end date.", 400);
  if (filters.status && !definition.statuses?.includes(filters.status)) return apiError("Unknown status filter.", 400);
  if (filters.category && !definition.categories?.includes(filters.category)) return apiError("Unknown category filter.", 400);

  const limit = await hitRateLimit(`export:${access.session.user.id}`, 30, 60 * 60);
  if (limit.limited) return new Response(JSON.stringify({ error: "Too many exports. Try again later." }), { status: 429, headers: { "Content-Type": "application/json", "Retry-After": String(limit.retryAfter) } });

  await writeAuditEvent(request, access.session.user.id, "EXPORT", dataset, undefined, {
    format, from: filters.from ?? null, to: filters.to ?? null, search: filters.search || null, status: filters.status || null, category: filters.category || null,
  });

  const noStore = { "Cache-Control": "no-store" };

  if (format === "print") {
    const rows: Cell[][] = [];
    for await (const row of definition.rows(filters)) {
      if (rows.length >= EXPORT_LIMITS.printRows) return apiError(`Too many rows to print (the limit is ${EXPORT_LIMITS.printRows.toLocaleString("en")}). Narrow the dates or filters, or download the CSV.`, 400);
      rows.push(row);
    }
    const parts = [
      filters.from || filters.to ? `${filters.from ?? "Start"} to ${filters.to ?? "today"}` : "All dates",
      filters.status && `Status: ${filters.status}`, filters.category && `Category: ${filters.category}`, filters.search && `Search: ${filters.search}`,
    ].filter(Boolean);
    const html = renderPrintable({
      clinic: BRAND_NAME, title: definition.title, filters: parts.join(" · "), headers: definition.headers, rows, sumColumns: definition.sumColumns,
      printedBy: access.session.user.name, printedAt: formatClinicDateTime(new Date()),
    });
    return new Response(html, { headers: { "Content-Type": "text/html; charset=utf-8", ...noStore } });
  }

  // CSV: the header goes out first, then one line per row as the database hands them over.
  const encoder = new TextEncoder();
  const iterator = definition.rows(filters)[Symbol.asyncIterator]();
  let written = 0;
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      // The byte-order mark makes Excel read the file as UTF-8, so Bangla names are not garbled.
      controller.enqueue(encoder.encode(`﻿${csvLine(definition.headers)}\r\n`));
    },
    async pull(controller) {
      const next = await iterator.next();
      if (next.done) return controller.close();
      if (written >= EXPORT_LIMITS.csvRows) {
        controller.enqueue(encoder.encode(`${csvLine([`Stopped at ${EXPORT_LIMITS.csvRows.toLocaleString("en")} rows. Narrow the dates or filters to get the rest.`])}\r\n`));
        await iterator.return?.(undefined);
        return controller.close();
      }
      written += 1;
      controller.enqueue(encoder.encode(`${csvLine(next.value)}\r\n`));
    },
    async cancel() { await iterator.return?.(undefined); },
  });
  return new Response(stream, {
    headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="${exportFileName(definition, filters, "csv")}"`, ...noStore },
  });
}
