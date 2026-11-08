"use client";

import {
  columnFilteringFeature,
  createColumnHelper,
  createFilteredRowModel,
  createPaginatedRowModel,
  createSortedRowModel,
  filterFn_includesString,
  globalFilteringFeature,
  rowPaginationFeature,
  rowSortingFeature,
  sortFn_alphanumeric,
  sortFn_basic,
  sortFn_text,
  tableFeatures,
  useTable,
  type ColumnDef,
  type RowData,
} from "@tanstack/react-table";
import { ArrowDown, ArrowUp, ArrowUpDown, ChevronLeft, ChevronRight } from "lucide-react";
import type { ReactNode } from "react";

// A sortable, searchable, paged table (TanStack Table v9, headless) drawn with the app's own
// `data-table` styles. By default everything happens in the browser: use it for lists the API
// returns whole (inventory items, staff accounts…). For a list the API pages itself, pass `server`:
// the rows are then one page, and the pager asks the caller for another page.

export const dataTableFeatures = tableFeatures({
  rowSortingFeature,
  sortedRowModel: createSortedRowModel(),
  sortFns: { alphanumeric: sortFn_alphanumeric, text: sortFn_text, basic: sortFn_basic },
  columnFilteringFeature,
  globalFilteringFeature,
  filteredRowModel: createFilteredRowModel(),
  filterFns: { includesString: filterFn_includesString },
  rowPaginationFeature,
  paginatedRowModel: createPaginatedRowModel(),
});

type Features = typeof dataTableFeatures;
export type DataTableColumn<T extends RowData> = ColumnDef<Features, T>;
/** Typed column builder for a row type: `const col = dataTableColumns<Item>()`. */
export const dataTableColumns = <T extends RowData>() => createColumnHelper<Features, T>();

/** `className` goes on the column's th and td; `label` becomes the td's data-label (for stacked mobile rows). */
export type ColumnMeta = { numeric?: boolean; className?: string; label?: string };

const cx = (...names: (string | false | undefined)[]) => names.filter(Boolean).join(" ") || undefined;

export default function DataTable<T extends RowData>({
  data,
  columns,
  search = "",
  pageSize = 25,
  emptyMessage,
  caption,
  rowClassName,
  getRowId,
  tableClassName,
  busy,
  server,
  itemLabel = "rows",
}: {
  /** Keep this array stable (state or useMemo): a new array every render recomputes every model. */
  data: T[];
  /** Define at module scope or with useMemo. */
  columns: DataTableColumn<T>[];
  /** Text to search for in every searchable column. */
  search?: string;
  pageSize?: number;
  emptyMessage: ReactNode;
  caption?: string;
  rowClassName?: (row: T) => string | undefined;
  getRowId?: (row: T) => string;
  /** Extra class on the table, for page-specific styling. */
  tableClassName?: string;
  /** True while the rows are being refreshed. */
  busy?: boolean;
  /** The list is paged by the API: `data` is the current page (1-based `page`), `total` counts all rows. */
  server?: { page: number; total: number; onPageChange: (page: number) => void };
  /** Plural noun for the pager text, e.g. "doctors". */
  itemLabel?: string;
}) {
  const table = useTable({
    features: dataTableFeatures,
    columns,
    data,
    getRowId: getRowId ? (row: T) => getRowId(row) : undefined,
    state: { globalFilter: search, ...(server && { pagination: { pageIndex: server.page - 1, pageSize } }) },
    globalFilterFn: "includesString",
    initialState: { pagination: { pageIndex: 0, pageSize } },
    ...(server && {
      manualPagination: true,
      rowCount: server.total,
      onPaginationChange: (updater) => {
        const next = typeof updater === "function" ? updater({ pageIndex: server.page - 1, pageSize }) : updater;
        server.onPageChange(next.pageIndex + 1);
      },
    }),
  });

  const rows = table.getRowModel().rows;
  const filteredCount = table.getFilteredRowModel().rows.length;
  const { pageIndex } = table.state.pagination;
  const pageCount = table.getPageCount();
  const colSpan = table.getAllLeafColumns().length;

  return (
    <>
      <div className="table-scroll" aria-busy={busy}>
        <table className={cx("data-table", tableClassName)}>
          {caption && <caption className="sr-only">{caption}</caption>}
          <thead>
            {table.getHeaderGroups().map((group) => (
              <tr key={group.id}>
                {group.headers.map((header) => {
                  const columnMeta = header.column.columnDef.meta as ColumnMeta | undefined;
                  const numeric = columnMeta?.numeric;
                  const sorted = header.column.getIsSorted();
                  const label = header.isPlaceholder ? null : <table.FlexRender header={header} />;
                  return (
                    <th key={header.id} className={cx(numeric && "numeric", columnMeta?.className)}
                      aria-sort={sorted === "asc" ? "ascending" : sorted === "desc" ? "descending" : header.column.getCanSort() ? "none" : undefined}>
                      {header.column.getCanSort() ? (
                        <button type="button" className={`inline-flex items-center gap-1 font-[inherit] text-inherit ${numeric ? "flex-row-reverse" : ""}`} onClick={header.column.getToggleSortingHandler()}>
                          {label}
                          {sorted === "asc" ? <ArrowUp size={12} aria-hidden="true" /> : sorted === "desc" ? <ArrowDown size={12} aria-hidden="true" /> : <ArrowUpDown size={12} className="opacity-40" aria-hidden="true" />}
                        </button>
                      ) : label}
                    </th>
                  );
                })}
              </tr>
            ))}
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} className={rowClassName?.(row.original)}>
                {row.getAllCells().map((cell) => {
                  const columnMeta = cell.column.columnDef.meta as ColumnMeta | undefined;
                  return (
                    <td key={cell.id} className={cx(columnMeta?.numeric && "numeric", columnMeta?.className)} data-label={columnMeta?.label}>
                      <table.FlexRender cell={cell} />
                    </td>
                  );
                })}
              </tr>
            ))}
            {!rows.length && <tr><td colSpan={colSpan}>{emptyMessage}</td></tr>}
          </tbody>
        </table>
      </div>
      {(server ? server.total > 0 : pageCount > 1) && (
        <nav className="pagination" aria-label="Table pages">
          <button type="button" className="button-secondary inline-flex items-center gap-1" onClick={() => table.previousPage()} disabled={!table.getCanPreviousPage()}>
            <ChevronLeft size={14} /> Previous
          </button>
          <span className="text-sm text-ink-2" aria-live="polite">{server
            ? `Showing ${pageIndex * pageSize + 1}–${Math.min((pageIndex + 1) * pageSize, server.total)} of ${server.total} ${itemLabel} · Page ${pageIndex + 1} of ${pageCount}`
            : `Page ${pageIndex + 1} of ${pageCount} · ${filteredCount} rows`}</span>
          <button type="button" className="button-secondary inline-flex items-center gap-1" onClick={() => table.nextPage()} disabled={!table.getCanNextPage()}>
            Next <ChevronRight size={14} />
          </button>
        </nav>
      )}
    </>
  );
}
