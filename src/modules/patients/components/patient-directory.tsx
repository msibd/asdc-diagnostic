"use client";

import { useEffect, useRef, useState } from "react";
import { Plus, Search, Upload, UsersRound, X } from "lucide-react";
import EmptyState from "@/components/shared/empty-state";
import Button from "@/components/ui/button";
import { useConfirm } from "@/components/shared/confirm-dialog";
import useLiveRefresh from "@/hooks/use-live-refresh";
import { useAdminSession } from "@/components/shared/admin-session-provider";
import ImportDialog from "@/modules/import/components/import-dialog";
import ExportButtons from "@/modules/export/components/export-buttons";
import { PatientRequestError, readPatientResponse } from "@/modules/patients/actions/patient-requests";
import PatientFormModal, { emptyPatientForm, type PatientFormValues } from "@/modules/patients/components/patient-form-modal";
import PatientTable, { PatientTableSkeleton } from "@/modules/patients/components/patient-table";
import type { PatientFieldErrors } from "@/modules/patients/schemas/patient-rules";
import type { PatientListRecord, PatientRecord } from "@/modules/patients/schemas/patient-schema";
import { notify } from "@/lib/notify";

type StatusFilter = "ALL" | "ACTIVE" | "INACTIVE";
type SortOrder = "newest" | "name";

const PAGE_SIZE = 10;

function formValuesFrom(patient: PatientRecord): PatientFormValues {
  return {
    name: patient.name,
    phone: patient.phone,
    email: patient.email ?? "",
    dateOfBirth: patient.dateOfBirth?.slice(0, 10) ?? "",
    sex: patient.sex ?? "",
    address: patient.address ?? "",
    emergencyContactName: patient.emergencyContactName ?? "",
    emergencyContactPhone: patient.emergencyContactPhone ?? "",
    medicalHistory: patient.medicalHistory ?? "",
    allergies: patient.allergies ?? "",
    notes: patient.notes ?? "",
  };
}

export default function PatientDirectory() {
  const { confirm, dialog: confirmDialog } = useConfirm();
  const canImport = useAdminSession().user.permissions.includes("patients:write");
  const [importing, setImporting] = useState(false);
  const [patients, setPatients] = useState<PatientListRecord[]>([]);
  const [total, setTotal] = useState(0);
  const [activeTotal, setActiveTotal] = useState(0);
  const [inactiveTotal, setInactiveTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<StatusFilter>("ALL");
  const [sort, setSort] = useState<SortOrder>("newest");
  const [loading, setLoading] = useState(true);
  const [fetching, setFetching] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [actionError, setActionError] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<PatientListRecord | null>(null);
  const [initialForm, setInitialForm] = useState<PatientFormValues | null>(emptyPatientForm);
  const [saving, setSaving] = useState(false);
  const [loadingProfile, setLoadingProfile] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [saveFieldErrors, setSaveFieldErrors] = useState<PatientFieldErrors>({});
  const [refreshKey, setRefreshKey] = useState(0);
  const profileRequestId = useRef(0);
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const filtered = Boolean(search.trim()) || status !== "ALL";

  useLiveRefresh(
    () => setRefreshKey((key) => key + 1),
    !formOpen && !saving && !loadingProfile,
    30_000,
    ["Patient", "Appointment", "TreatmentPlan"],
  );

  useEffect(() => {
    const controller = new AbortController();
    const timeout = window.setTimeout(async () => {
      setLoadError("");
      setFetching(true);
      try {
        const params = new URLSearchParams({ page: String(page), pageSize: String(PAGE_SIZE), search, status, sort });
        const response = await fetch(`/api/patients?${params}`, { cache: "no-store", signal: controller.signal });
        const result = await readPatientResponse<{
          patients: PatientListRecord[];
          total: number;
          activeTotal: number;
          inactiveTotal: number;
        }>(response);
        setPatients(result.patients);
        setTotal(result.total);
        setActiveTotal(result.activeTotal);
        setInactiveTotal(result.inactiveTotal);
      } catch (error) {
        if (!controller.signal.aborted) {
          setLoadError(error instanceof Error ? error.message : "Unable to load patients.");
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
          setFetching(false);
        }
      }
    }, 180);
    return () => {
      window.clearTimeout(timeout);
      controller.abort();
    };
  }, [page, refreshKey, search, status, sort]);

  const refresh = () => setRefreshKey((key) => key + 1);

  function chooseStatus(next: StatusFilter) {
    setStatus(next);
    setPage(1);
  }

  function clearFilters() {
    setSearch("");
    setStatus("ALL");
    setPage(1);
  }

  function openCreateForm() {
    profileRequestId.current += 1;
    setLoadingProfile(false);
    setEditing(null);
    setInitialForm(emptyPatientForm);
    setSaveError("");
    setSaveFieldErrors({});
    setFormOpen(true);
  }

  async function openEditForm(patient: PatientListRecord) {
    const requestId = ++profileRequestId.current;
    setEditing(patient);
    setInitialForm(null);
    setSaveError("");
    setSaveFieldErrors({});
    setFormOpen(true);
    setLoadingProfile(true);
    try {
      const response = await fetch(`/api/patients/${patient.id}`, { cache: "no-store" });
      const result = await readPatientResponse<{ patient: PatientRecord }>(response);
      if (profileRequestId.current === requestId) setInitialForm(formValuesFrom(result.patient));
    } catch (error) {
      if (profileRequestId.current === requestId) {
        setSaveError(error instanceof Error ? error.message : "Unable to load patient profile.");
      }
    } finally {
      if (profileRequestId.current === requestId) setLoadingProfile(false);
    }
  }

  function closeForm() {
    profileRequestId.current += 1;
    setLoadingProfile(false);
    setFormOpen(false);
  }

  async function savePatient(values: PatientFormValues) {
    setSaving(true);
    setSaveError("");
    setSaveFieldErrors({});
    try {
      const response = await fetch(editing ? `/api/patients/${editing.id}` : "/api/patients", {
        method: editing ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      await readPatientResponse(response);
      setFormOpen(false);
      setPage(1);
      notify(editing ? `${values.name.trim()} was updated.` : `${values.name.trim()} was registered.`);
      refresh();
    } catch (error) {
      if (error instanceof PatientRequestError && error.fieldErrors && Object.keys(error.fieldErrors).length) {
        setSaveFieldErrors(error.fieldErrors); // each message appears beside its field
      } else {
        setSaveError(error instanceof Error ? error.message : "Unable to save patient.");
      }
    } finally {
      setSaving(false);
    }
  }

  async function togglePatientStatus(patient: PatientListRecord) {
    const nextStatus = !patient.isActive;
    setBusyId(patient.id);
    setActionError("");
    try {
      const response = await fetch(`/api/patients/${patient.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: nextStatus }),
      });
      await readPatientResponse(response);
      notify(`${patient.name} is now ${nextStatus ? "active" : "inactive"}.`);
      refresh();
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Unable to update patient status.");
    } finally {
      setBusyId(null);
    }
  }

  async function removePatient(patient: PatientListRecord) {
    const confirmed = await confirm({
      title: "Delete patient permanently?",
      description: `${patient.name} (${patient.patientCode}) will be removed. This cannot be undone, and patients with clinical history must be disabled instead.`,
      confirmLabel: "Delete patient",
      destructive: true,
    });
    if (!confirmed) return;

    setBusyId(patient.id);
    setActionError("");
    try {
      const response = await fetch(`/api/patients/${patient.id}`, { method: "DELETE" });
      await readPatientResponse(response);
      notify(`${patient.name} was deleted.`);
      if (patients.length === 1 && page > 1) setPage((current) => current - 1);
      else refresh();
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Unable to delete patient.");
    } finally {
      setBusyId(null);
    }
  }

  const summaryCards: { key: StatusFilter; label: string; value: number }[] = [
    { key: "ALL", label: "Total patients", value: activeTotal + inactiveTotal },
    { key: "ACTIVE", label: "Active", value: activeTotal },
    { key: "INACTIVE", label: "Inactive", value: inactiveTotal },
  ];

  return (
    <div className="patient-directory-page">
      {confirmDialog}
      {importing && <ImportDialog module="patients" onClose={() => setImporting(false)} onImported={refresh} />}
      <div className="patient-summary-cards" role="group" aria-label="Filter patients by status">
        {summaryCards.map((card) => (
          <button
            key={card.key}
            type="button"
            className={`patient-summary-card${card.key === "ACTIVE" ? " is-active" : card.key === "INACTIVE" ? " is-inactive" : ""}${status === card.key ? " is-selected" : ""}`}
            aria-pressed={status === card.key}
            onClick={() => chooseStatus(status === card.key ? "ALL" : card.key)}
          >
            <span>{card.label}</span>
            <strong>{card.value}</strong>
          </button>
        ))}
      </div>

      <section className="panel-card patient-directory-panel">
        <div className="panel-header patient-directory-header">
          <div>
            <h2 className="panel-title">Patient directory</h2>
            <div className="panel-description" aria-live="polite">
              {filtered ? `${total} matching of ${activeTotal + inactiveTotal} patients` : `${total} patient records`} · Search and manage clinic profiles.
            </div>
          </div>
          <div className="patient-directory-actions">
            <ExportButtons dataset="patients" filters={{ search, status, sort }} />
            {canImport && (
              <Button variant="secondary" onClick={() => setImporting(true)}>
                <Upload size={14} /> Import CSV
              </Button>
            )}
            <button type="button" className="button-primary" onClick={openCreateForm}>
              <Plus size={14} /> Register patient
            </button>
          </div>
        </div>

        <div className="patient-directory-toolbar">
          <label className="patient-search">
            <Search size={15} aria-hidden="true" />
            <input
              type="search"
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setPage(1);
              }}
              placeholder="Search name, phone, email or patient ID"
              aria-label="Search patients"
            />
            {search && (
              <button type="button" className="patient-search-clear" onClick={() => { setSearch(""); setPage(1); }} aria-label="Clear search">
                <X size={14} />
              </button>
            )}
          </label>
          <div className="patient-directory-filters">
            <label htmlFor="patient-sort">Sort by</label>
            <select id="patient-sort" value={sort} onChange={(event) => { setSort(event.target.value as SortOrder); setPage(1); }}>
              <option value="newest">Newest first</option>
              <option value="name">Name A–Z</option>
            </select>
            {filtered && <button type="button" className="patient-clear-filters" onClick={clearFilters}>Clear filters</button>}
          </div>
        </div>

        {actionError && <div className="patient-load-error" role="alert">{actionError}</div>}

        {loadError ? (
          <div className="patient-load-error" role="alert">
            {loadError}
            <button type="button" className="button-secondary" onClick={refresh}>Retry</button>
          </div>
        ) : loading ? (
          <PatientTableSkeleton />
        ) : !patients.length ? (
          <EmptyState
            icon={<UsersRound size={17} />}
            message={filtered ? "No patients match the selected search and status." : "No patient records yet. Register the first patient to begin."}
          />
        ) : (
          <>
            <PatientTable
              patients={patients}
              busyId={busyId}
              refreshing={fetching}
              onEdit={openEditForm}
              onToggleStatus={togglePatientStatus}
              onDelete={removePatient}
            />
            <p className="patient-history-hint">
              Patients with booking or lab order history can be disabled, but their records cannot be deleted.
            </p>
            <div className="patient-pagination">
              <span>Showing {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, total)} of {total} patients</span>
              <div>
                <button type="button" className="patient-page-button" disabled={page <= 1} onClick={() => setPage((value) => value - 1)} aria-label="Previous page">
                  Previous
                </button>
                <span className="patient-page-indicator">Page {page} of {pageCount}</span>
                <button type="button" className="patient-page-button" disabled={page >= pageCount} onClick={() => setPage((value) => value + 1)} aria-label="Next page">
                  Next
                </button>
              </div>
            </div>
          </>
        )}
      </section>

      {formOpen && (
        <PatientFormModal
          key={editing?.id ?? "new"}
          editing={Boolean(editing)}
          initial={initialForm}
          loading={loadingProfile}
          saving={saving}
          serverError={saveError}
          serverFieldErrors={saveFieldErrors}
          onSubmit={savePatient}
          onClose={closeForm}
        />
      )}
    </div>
  );
}
