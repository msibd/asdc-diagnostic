"use client";

import { useCallback, useEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type ReactNode } from "react";
import { Ellipsis, Eye, EyeOff, Pencil, Plus, RefreshCw, Search, Stethoscope, Trash2, UserCheck, UserX } from "lucide-react";
import DataTable, { dataTableColumns } from "@/components/shared/data-table";
import EmptyState from "@/components/shared/empty-state";
import { useConfirm } from "@/components/shared/confirm-dialog";
import useLiveRefresh from "@/hooks/use-live-refresh";
import { requestJson } from "@/modules/clinic/components/clinic-types";
import { liveTables, useDebouncedValue, type SectionProps } from "@/modules/clinic/components/section-shared";
import { DOCTOR_PAGE_SIZE, DOCTOR_STATUS_FILTERS, PRIMARY_DOCTOR_ID, type DoctorRecord, type DoctorStatusFilter } from "../doctor-schema";
import DoctorAvatar from "./doctor-avatar";
import DoctorDetailsDialog from "./doctor-details-dialog";
import DoctorFormDialog from "./doctor-form-dialog";

type ListResult = { doctors: DoctorRecord[]; total: number; page: number; pageSize: number; specializations: string[] };
const column = dataTableColumns<DoctorRecord>();
type Dialog = { kind: "create" } | { kind: "edit"; doctor: DoctorRecord } | { kind: "view"; doctor: DoctorRecord } | null;

const STATUS_LABELS: Record<DoctorStatusFilter, string> = {
  all: "All statuses", active: "Active", inactive: "Inactive", published: "Published", unpublished: "Draft (unpublished)",
};

function SkeletonRows() {
  return (
    <div className="patient-skeleton" role="status" aria-label="Loading doctors">
      {[0, 1, 2, 3].map((row) => (
        <div className="patient-skeleton-row" key={row}>
          <span className="skeleton-block skeleton-avatar" />
          <span className="skeleton-block" style={{ width: "34%", height: 14 }} />
          <span className="skeleton-block" style={{ width: "18%", height: 14 }} />
          <span className="skeleton-block" style={{ width: "12%", height: 14 }} />
        </div>
      ))}
    </div>
  );
}

type MenuItem = { key: string; label: string; icon: ReactNode; onSelect: () => void; danger?: boolean; disabled?: boolean; title?: string };

/** Compact "more actions" menu. Fixed-positioned so the table scroll area never clips it. */
function RowMenu({ label, items, busy }: { label: string; items: MenuItem[]; busy: boolean }) {
  const [pos, setPos] = useState<{ top: number; right: number } | null>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  const close = useCallback(() => setPos(null), []);

  useEffect(() => {
    if (!pos) return;
    menu.current?.querySelector<HTMLButtonElement>("button:not(:disabled)")?.focus();
    const onDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (!menu.current?.contains(target) && !trigger.current?.contains(target)) close();
    };
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") { close(); trigger.current?.focus(); } };
    window.addEventListener("mousedown", onDown);
    window.addEventListener("keydown", onKey);
    window.addEventListener("resize", close);
    window.addEventListener("scroll", close, true);
    return () => {
      window.removeEventListener("mousedown", onDown);
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("resize", close);
      window.removeEventListener("scroll", close, true);
    };
  }, [pos, close]);

  function toggle() {
    if (pos) return close();
    const rect = trigger.current?.getBoundingClientRect();
    if (!rect) return;
    const height = items.length * 36 + 16;
    const fitsBelow = window.innerHeight - rect.bottom > height + 8;
    setPos({ top: fitsBelow ? rect.bottom + 4 : Math.max(8, rect.top - height - 4), right: window.innerWidth - rect.right });
  }

  function onMenuKey(event: ReactKeyboardEvent) {
    if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
    event.preventDefault();
    const buttons = Array.from(menu.current?.querySelectorAll<HTMLButtonElement>("button:not(:disabled)") ?? []);
    const index = buttons.indexOf(document.activeElement as HTMLButtonElement);
    buttons[(index + (event.key === "ArrowDown" ? 1 : -1) + buttons.length) % buttons.length]?.focus();
  }

  return (
    <>
      <button ref={trigger} type="button" className="doctor-menu-trigger" aria-label={`Actions for ${label}`} aria-haspopup="menu" aria-expanded={Boolean(pos)} disabled={busy} onClick={toggle}>
        <Ellipsis size={18} aria-hidden />
      </button>
      {pos && (
        <div ref={menu} className="doctor-menu" role="menu" style={{ top: pos.top, right: pos.right }} onKeyDown={onMenuKey}>
          {items.map((item) => (
            <button key={item.key} type="button" role="menuitem" className={item.danger ? "is-danger" : undefined} disabled={item.disabled} title={item.title} onClick={() => { close(); item.onSelect(); }}>
              {item.icon}{item.label}
            </button>
          ))}
        </div>
      )}
    </>
  );
}

/** The doctor directory: searchable, filterable, paged list with add / edit / view and status switches. */
export default function DoctorsSection({ onNotice }: SectionProps) {
  const { confirm, dialog: confirmDialog } = useConfirm();
  const [result, setResult] = useState<ListResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<DoctorStatusFilter>("all");
  const [specialization, setSpecialization] = useState("");
  const [page, setPage] = useState(1);
  const [dialog, setDialog] = useState<Dialog>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const debouncedSearch = useDebouncedValue(search);
  // Only the newest request may update the screen (a slow earlier one must not overwrite it).
  const requestId = useRef(0);

  const load = useCallback(async (background: boolean) => {
    const id = ++requestId.current;
    if (!background) setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams({ page: String(page), pageSize: String(DOCTOR_PAGE_SIZE) });
      if (debouncedSearch.trim()) params.set("search", debouncedSearch.trim());
      if (status !== "all") params.set("status", status);
      if (specialization) params.set("specialization", specialization);
      const data = await requestJson<ListResult>(await fetch(`/api/doctors?${params}`, { cache: "no-store" }));
      if (id !== requestId.current) return;
      // Deleting the last doctor on a page leaves it empty: step back.
      if (!data.doctors.length && data.total > 0 && page > 1) { setPage(Math.max(1, Math.ceil(data.total / data.pageSize))); return; }
      setResult(data);
    } catch (loadError) {
      if (id === requestId.current) setError(loadError instanceof Error ? loadError.message : "Unable to load doctors.");
    } finally {
      if (id === requestId.current) setLoading(false);
    }
  }, [page, debouncedSearch, status, specialization]);

  useEffect(() => {
    const timer = window.setTimeout(() => { void load(false); }, 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  // Live updates must not disturb an open form.
  useLiveRefresh(() => { if (!dialog) void load(true); }, true, 30_000, liveTables.doctors);

  async function send(url: string, method: "POST" | "PATCH" | "DELETE", body?: unknown) {
    return requestJson<{ doctor?: DoctorRecord }>(await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    }));
  }

  async function save(payload: Record<string, unknown>) {
    const editing = dialog?.kind === "edit" ? dialog.doctor : null;
    try {
      await send(editing ? `/api/doctors/${editing.id}` : "/api/doctors", editing ? "PATCH" : "POST", payload);
      setDialog(null);
      onNotice(editing ? "Doctor updated." : "Doctor added.", false);
      void load(true);
      return null;
    } catch (saveError) {
      return saveError instanceof Error ? saveError.message : "Unable to save the doctor.";
    }
  }

  async function change(doctor: DoctorRecord, patch: { isActive?: boolean; isPublished?: boolean }, message: string) {
    setBusyId(doctor.id);
    try {
      await send(`/api/doctors/${doctor.id}`, "PATCH", patch);
      onNotice(message, false);
      void load(true);
    } catch (changeError) {
      onNotice(changeError instanceof Error ? changeError.message : "Unable to update the doctor.", true);
    } finally { setBusyId(null); }
  }

  async function toggleActive(doctor: DoctorRecord) {
    if (doctor.isActive && !await confirm({
      title: `Deactivate ${doctor.name}?`,
      description: "The profile is hidden everywhere on the public website until you activate it again. Nothing is deleted.",
      confirmLabel: "Deactivate",
      destructive: true,
    })) return;
    await change(doctor, { isActive: !doctor.isActive }, `${doctor.name} ${doctor.isActive ? "deactivated" : "activated"}.`);
  }

  async function togglePublished(doctor: DoctorRecord) {
    await change(doctor, { isPublished: !doctor.isPublished }, `${doctor.name} ${doctor.isPublished ? "unpublished" : "published"}.`);
  }

  async function remove(doctor: DoctorRecord) {
    if (!await confirm({
      title: `Delete ${doctor.name}?`,
      description: "This permanently deletes the profile and its weekly hours. To keep the record, deactivate it instead.",
      confirmLabel: "Delete doctor",
      destructive: true,
    })) return;
    setBusyId(doctor.id);
    try {
      await send(`/api/doctors/${doctor.id}`, "DELETE");
      onNotice(`${doctor.name} deleted.`, false);
      void load(true);
    } catch (removeError) {
      onNotice(removeError instanceof Error ? removeError.message : "Unable to delete the doctor.", true);
    } finally { setBusyId(null); }
  }

  const doctors = result?.doctors ?? [];
  const total = result?.total ?? 0;
  const filtered = Boolean(debouncedSearch.trim() || status !== "all" || specialization);
  const resetFilters = () => { setSearch(""); setStatus("all"); setSpecialization(""); setPage(1); };

  // Rebuilt each render on purpose: the handlers close over the current filters and page. A page is at most 10 rows.
  const columns = [
    column.display({
      id: "doctor",
      header: "Doctor",
      meta: { label: "Doctor" },
      cell: ({ row: { original: doctor } }) => (
        <div className="doctor-cell">
          <DoctorAvatar name={doctor.name} imageUrl={doctor.imageUrl} />
          <div className="doctor-identity">
            <div className="doctor-name-line"><strong>{doctor.name}</strong>{doctor.id === PRIMARY_DOCTOR_ID && <span className="badge badge-warning">Main profile</span>}</div>
            <div className="cell-secondary">{doctor.designation || doctor.qualifications || "—"}</div>
          </div>
        </div>
      ),
    }),
    column.display({ id: "specialization", header: "Specialization", meta: { label: "Specialization", className: "doctor-specialization" }, cell: ({ row: { original: doctor } }) => doctor.specialization }),
    column.display({ id: "experience", header: "Experience", meta: { label: "Experience", className: "doctor-col-num" }, cell: ({ row: { original: doctor } }) => (doctor.experienceYears == null ? "—" : `${doctor.experienceYears} yr${doctor.experienceYears === 1 ? "" : "s"}`) }),
    column.display({ id: "order", header: "Order", meta: { label: "Order", className: "doctor-col-num" }, cell: ({ row: { original: doctor } }) => doctor.displayOrder }),
    column.display({
      id: "status",
      header: "Status",
      meta: { label: "Status" },
      cell: ({ row: { original: doctor } }) => (
        <div className="doctor-badges">
          <span className={`badge doctor-badge ${doctor.isActive ? "badge-success" : "badge-neutral"}`}>{doctor.isActive ? "Active" : "Inactive"}</span>
          <span className={`badge doctor-badge ${doctor.isPublished ? "badge-info" : "badge-neutral"}`}>{doctor.isPublished ? "Published" : "Draft"}</span>
        </div>
      ),
    }),
    column.display({
      id: "actions",
      header: () => <span className="sr-only">Actions</span>,
      meta: { className: "doctor-col-actions" },
      cell: ({ row: { original: doctor } }) => {
        const isPrimary = doctor.id === PRIMARY_DOCTOR_ID;
        const items: MenuItem[] = [
          { key: "view", label: "View", icon: <Eye size={15} />, onSelect: () => setDialog({ kind: "view", doctor }) },
          { key: "edit", label: "Edit", icon: <Pencil size={15} />, onSelect: () => setDialog({ kind: "edit", doctor }) },
          { key: "publish", label: doctor.isPublished ? "Unpublish" : "Publish", icon: doctor.isPublished ? <EyeOff size={15} /> : <Eye size={15} />, onSelect: () => void togglePublished(doctor) },
          { key: "active", label: doctor.isActive ? "Deactivate" : "Activate", icon: doctor.isActive ? <UserX size={15} /> : <UserCheck size={15} />, onSelect: () => void toggleActive(doctor), danger: doctor.isActive },
          { key: "delete", label: "Delete", icon: <Trash2 size={15} />, onSelect: () => void remove(doctor), danger: true, disabled: isPrimary, title: isPrimary ? "The main profile supplies booking hours and report letterhead. Deactivate it instead." : undefined },
        ];
        return <RowMenu label={doctor.name} items={items} busy={busyId === doctor.id} />;
      },
    }),
  ];

  return (
    <section className="panel-card clinic-module-card">
      <header className="panel-header">
        <div>
          <h2 className="panel-title">Doctors</h2>
          <p className="panel-description">The doctors listed on your website. A doctor appears publicly only when active and published.</p>
        </div>
        <button type="button" className="button-primary" onClick={() => setDialog({ kind: "create" })}><Plus size={14} /> Add doctor</button>
      </header>

      <div className="doctor-toolbar">
        <label className="patient-search">
          <Search size={16} aria-hidden />
          <input value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} placeholder="Search name, specialization or designation" aria-label="Search doctors" />
        </label>
        <select className="select-control" value={status} onChange={(event) => { setStatus(event.target.value as DoctorStatusFilter); setPage(1); }} aria-label="Filter by status">
          {DOCTOR_STATUS_FILTERS.map((value) => <option key={value} value={value}>{STATUS_LABELS[value]}</option>)}
        </select>
        <select className="select-control" value={specialization} onChange={(event) => { setSpecialization(event.target.value); setPage(1); }} aria-label="Filter by specialization">
          <option value="">All specializations</option>
          {(result?.specializations ?? []).map((value) => <option key={value} value={value}>{value}</option>)}
        </select>
      </div>

      {error ? (
        <div className="patient-load-error" role="alert">{error}<button type="button" className="button-secondary" onClick={() => void load(false)}><RefreshCw size={14} /> Retry</button></div>
      ) : loading && !result ? (
        <SkeletonRows />
      ) : !doctors.length ? (
        <div className="doctor-empty">
          <EmptyState icon={<Stethoscope size={17} />} message={filtered ? "No doctors match your search and filters." : "No doctors yet. Add the first doctor to build your directory."} />
          {filtered
            ? <button type="button" className="button-secondary" onClick={resetFilters}>Clear filters</button>
            : <button type="button" className="button-primary" onClick={() => setDialog({ kind: "create" })}><Plus size={14} /> Add doctor</button>}
        </div>
      ) : (
        <DataTable
            data={doctors}
            columns={columns}
            pageSize={DOCTOR_PAGE_SIZE}
            busy={loading}
            tableClassName="doctor-table"
            caption="Doctors"
            getRowId={(doctor) => doctor.id}
            rowClassName={(doctor) => (doctor.isActive ? undefined : "expense-voided")}
            emptyMessage=""
            server={{ page, total, onPageChange: setPage }}
            itemLabel="doctors"
          />
      )}

      {dialog?.kind === "create" && <DoctorFormDialog doctor={null} onSave={save} onClose={() => setDialog(null)} />}
      {dialog?.kind === "edit" && <DoctorFormDialog key={dialog.doctor.id} doctor={dialog.doctor} onSave={save} onClose={() => setDialog(null)} />}
      {dialog?.kind === "view" && <DoctorDetailsDialog doctor={dialog.doctor} onEdit={() => setDialog({ kind: "edit", doctor: dialog.doctor })} onClose={() => setDialog(null)} />}
      {confirmDialog}
    </section>
  );
}
