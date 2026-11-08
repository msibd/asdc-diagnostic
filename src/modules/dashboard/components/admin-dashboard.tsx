"use client";

import {
  Activity,
  ArrowRight,
  Bell,
  ChevronDown,
  Clock3,
  LockKeyhole,
  LogOut,
  Menu,
  Plus,
  Search,
  Sun,
} from "lucide-react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { bookingKeys } from "@/modules/appointments/components/appointment-list-query";
import { authClient } from "@/lib/auth-client";
import {
  formatClinicDate,
  getClinicDateKey,
} from "@/lib/clinic-date";

import {
  AppointmentValidationError,
  createAppointmentRequest,
  deleteAppointmentRequest,
  updateAppointmentRequest,
  updateAppointmentStatusRequest,
} from "@/modules/appointments/actions/appointment-actions";
import type { AppointmentFieldErrors } from "@/modules/appointments/schemas/appointment-rules";
import type {
  AppointmentStatusValue,
} from "@/modules/appointments/schemas/appointment-schema";





import { useDashboardUiStore, type ThemePreference } from "@/stores/dashboard-ui-store";
import { initials } from "@/lib/format";

import { type Appointment, type AdminUser, type DashboardSummary } from "./dashboard-shared";
import { useConfirm } from "@/components/shared/confirm-dialog";
import Overview from "./dashboard-overview";
import AppointmentDetailsDialog from "./appointment-details-dialog";
import SecurityView from "./security-view";
import AppointmentModal from "./appointment-modal";
import { notify } from "@/lib/notify";
import { pageTitles, sectionPaths, type DashboardSection } from "./dashboard-sections";
export type { DashboardSection } from "./dashboard-sections";

// Section modules and charts load only on the routes that render them.
const AppointmentManagement = dynamic(() => import("@/modules/appointments/components/appointment-management"));
const PatientDirectory = dynamic(() => import("@/modules/patients/components/patient-directory"));
const ClinicOperations = dynamic(() => import("@/modules/clinic/components/clinic-operations"));
const FinanceSection = dynamic(() => import("@/modules/finance/components/finance-section"));
const SmsSettings = dynamic(() => import("@/modules/sms/components/sms-settings"));
const VoiceSettings = dynamic(() => import("@/modules/voice/components/voice-settings"));
const EmailSettings = dynamic(() => import("@/modules/email/components/email-settings"));
const AccessSection = dynamic(() => import("@/modules/access/components/access-section"));
const OrdersSection = dynamic(() => import("@/modules/orders/components/orders-section"));
const InventorySection = dynamic(() => import("@/modules/inventory/components/inventory-section"));
const ReviewManagement = dynamic(() => import("@/app/public_website/components/review-management"));
const GalleryManagement = dynamic(() => import("@/app/public_website/components/gallery-management"));
const WebsiteContentManagement = dynamic(() => import("@/app/public_website/components/website-content-management"));

type AppointmentStatus = AppointmentStatusValue;


export default function AdminDashboard({
  user,
  todayLabel,
  now,
  initialSection,
}: {
  user: AdminUser;
  todayLabel: string;
  now: string;
  initialSection: DashboardSection;
}) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { confirm, dialog: confirmDialog } = useConfirm();
  const [section, setSection] = useState<DashboardSection>(initialSection);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [appointmentTotal, setAppointmentTotal] = useState(0);
  const [appointmentCursor, setAppointmentCursor] = useState<string | null>(null);
  const [loadingMoreAppointments, setLoadingMoreAppointments] = useState(false);
  const [patientCount, setPatientCount] = useState(0);
  const [dashboardSummary, setDashboardSummary] = useState<DashboardSummary | null>(null);
  const [loading, setLoading] = useState(initialSection === "overview" || initialSection === "appointments");
  const [loadError, setLoadError] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedService, setSelectedService] = useState("");
  // A walk-in is booked for right now and starts confirmed (the server sets the time and status).
  const [walkInMode, setWalkInMode] = useState(false);
  const [appointmentToEdit, setAppointmentToEdit] = useState<Appointment | null>(null);
  // Field problems the server reported for the appointment form, shown next to each input.
  const [appointmentServerErrors, setAppointmentServerErrors] = useState<AppointmentFieldErrors>({});
  const [appointmentToView, setAppointmentToView] = useState<Appointment | null>(null);
  const globalSearch = useDashboardUiStore((state) => state.globalSearch);
  const setGlobalSearch = useDashboardUiStore((state) => state.setGlobalSearch);
  const profileOpen = useDashboardUiStore((state) => state.profileMenuOpen);
  const setProfileOpen = useDashboardUiStore((state) => state.setProfileMenuOpen);
  const toggleProfileMenu = useDashboardUiStore((state) => state.toggleProfileMenu);
  const toggleSidebarCollapsed = useDashboardUiStore((state) => state.toggleSidebarCollapsed);
  const theme = useDashboardUiStore((state) => state.theme);
  const setTheme = useDashboardUiStore((state) => state.setTheme);
  const [saving, setSaving] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const showToast = ({ message, error }: { message: string; error: boolean }) => notify(message, error);
  const globalSearchRef = useRef<HTMLInputElement>(null);
  // Lets mutations refresh the server-derived overview figures immediately.
  const reloadSummaryRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    if (initialSection !== "overview" && initialSection !== "appointments") return;
    const controller = new AbortController();
    let refreshing = false;
    async function loadAppointments(background = false) {
      if (refreshing) return;
      refreshing = true;
      if (!background) setLoadError("");
      try {
        const [appointmentsResponse, summaryResponse] = await Promise.all([
          fetch("/api/appointments", { cache: "no-store", signal: controller.signal }),
          fetch("/api/dashboard/summary", { cache: "no-store", signal: controller.signal }),
        ]);
        const [appointmentsResult, summaryResult] = await Promise.all([
          appointmentsResponse.json() as Promise<{ appointments?: Appointment[]; totalCount?: number; nextCursor?: string | null; error?: string }>,
          summaryResponse.json() as Promise<DashboardSummary & { error?: string }>,
        ]);
        if (!appointmentsResponse.ok) {
          throw new Error(appointmentsResult.error ?? "Unable to load appointments.");
        }
        if (!summaryResponse.ok) {
          throw new Error(summaryResult.error ?? "Unable to load clinic summary.");
        }
        setAppointments(appointmentsResult.appointments ?? []);
        setAppointmentTotal(appointmentsResult.totalCount ?? 0);
        setAppointmentCursor(appointmentsResult.nextCursor ?? null);
        setPatientCount(summaryResult.totalPatients);
        setDashboardSummary(summaryResult);
      } catch (error) {
        if (!background && !controller.signal.aborted) {
          setLoadError(error instanceof Error ? error.message : "Unable to load appointments.");
        }
      } finally {
        refreshing = false;
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    }

    void loadAppointments();
    reloadSummaryRef.current = () => void loadAppointments(true);
    const source = new EventSource("/api/realtime");
    const refreshFromServer = () => {
      if (document.visibilityState === "visible") void loadAppointments(true);
    };
    // Only these tables affect the overview/appointments views; a write can emit several events.
    const watchedTables = new Set(["Appointment", "Patient", "Payment", "Invoice", "DoctorProfile"]);
    let coalesceTimer: number | undefined;
    const onClinicChange = (event: Event) => {
      try {
        const change = JSON.parse((event as MessageEvent<string>).data) as { table?: string };
        if (change.table && !watchedTables.has(change.table)) return;
      } catch {
        // Malformed payload: refresh to stay correct.
      }
      window.clearTimeout(coalesceTimer);
      coalesceTimer = window.setTimeout(refreshFromServer, 400);
    };
    source.addEventListener("clinic-change", onClinicChange);
    const interval = window.setInterval(() => {
      if (
        source.readyState !== EventSource.OPEN &&
        document.visibilityState === "visible"
      ) {
        void loadAppointments(true);
      }
    }, 30_000);
    window.addEventListener("focus", refreshFromServer);
    document.addEventListener("visibilitychange", refreshFromServer);
    return () => {
      controller.abort();
      reloadSummaryRef.current = null;
      window.clearTimeout(coalesceTimer);
      source.close();
      window.clearInterval(interval);
      window.removeEventListener("focus", refreshFromServer);
      document.removeEventListener("visibilitychange", refreshFromServer);
    };
  }, [initialSection]);

  async function loadMoreAppointments() {
    if (!appointmentCursor || loadingMoreAppointments) return;
    setLoadingMoreAppointments(true);
    setLoadError("");
    try {
      const response = await fetch(`/api/appointments?cursor=${encodeURIComponent(appointmentCursor)}`, { cache: "no-store" });
      const result = await response.json() as { appointments?: Appointment[]; totalCount?: number; nextCursor?: string | null; error?: string };
      if (!response.ok) throw new Error(result.error ?? "Unable to load more appointments.");
      setAppointments((current) => {
        const existingIds = new Set(current.map((appointment) => appointment.id));
        return [...current, ...(result.appointments ?? []).filter((appointment) => !existingIds.has(appointment.id))];
      });
      setAppointmentTotal(result.totalCount ?? appointmentTotal);
      setAppointmentCursor(result.nextCursor ?? null);
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : "Unable to load more appointments.");
    } finally {
      setLoadingMoreAppointments(false);
    }
  }


  useEffect(() => {
    function handleSearchShortcut(event: KeyboardEvent) {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        globalSearchRef.current?.focus();
      }
    }

    window.addEventListener("keydown", handleSearchShortcut);
    return () => window.removeEventListener("keydown", handleSearchShortcut);
  }, []);

  const todayAppointments = useMemo(() => {
    const today = getClinicDateKey(now);
    return appointments.filter((appointment) => {
      return getClinicDateKey(appointment.dateTime) === today && appointment.status !== "CANCELLED";
    });
  }, [appointments, now]);
  // Searches the whole appointment table on the server, not just the page already loaded.
  const searchTerm = globalSearch.trim();
  const [searchResult, setSearchResult] = useState<{ term: string; items: Appointment[] } | null>(null);
  useEffect(() => {
    if (!searchTerm) return;
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      try {
        const response = await fetch(`/api/appointments?search=${encodeURIComponent(searchTerm)}`, {
          cache: "no-store",
          signal: controller.signal,
        });
        if (!response.ok) throw new Error("Search failed.");
        const result = await response.json() as { appointments?: Appointment[] };
        setSearchResult({ term: searchTerm, items: result.appointments ?? [] });
      } catch {
        if (!controller.signal.aborted) setSearchResult({ term: searchTerm, items: [] });
      }
    }, 250);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [searchTerm]);
  const globalSearchResults = searchTerm && searchResult?.term === searchTerm ? searchResult.items : [];
  const globalSearchPending = Boolean(searchTerm) && searchResult?.term !== searchTerm;


  function navigateToSection(nextSection: DashboardSection, nextStatusFilter = "ALL") {
    setSection(nextSection);
    setStatusFilter(nextStatusFilter);
    router.push(sectionPaths[nextSection]);
  }

  async function changeStatus(id: string, status: AppointmentStatus) {
    try {
      const appointment = await updateAppointmentStatusRequest(id, status);
      setAppointments((current) =>
        current.map((item) => item.id === id ? appointment : item),
      );
      showToast({ message: "Appointment status updated.", error: false });
      reloadSummaryRef.current?.();
      void queryClient.invalidateQueries({ queryKey: bookingKeys.all });
    } catch (error) {
      showToast({ message: error instanceof Error ? error.message : "Could not update appointment.",
        error: true,
      });
    }
  }

  async function saveAppointment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setAppointmentServerErrors({});
    const formData = new FormData(event.currentTarget);
    const enteredDateTime = String(formData.get("dateTime") ?? "");
    const parsedDateTime = new Date(enteredDateTime);
    const payload = {
      patientName: String(formData.get("patientName") ?? ""),
      patientId: String(formData.get("patientId") ?? ""),
      patientPhone: String(formData.get("patientPhone") ?? ""),
      patientEmail: String(formData.get("patientEmail") ?? ""),
      service: String(formData.get("service") ?? ""),
      doctorId: String(formData.get("doctorId") ?? ""),
      dateTime: walkInMode ? new Date().toISOString() : Number.isFinite(parsedDateTime.getTime()) ? parsedDateTime.toISOString() : "",
      notes: String(formData.get("notes") ?? ""),
      ...(walkInMode && !appointmentToEdit ? { walkIn: true } : {}),
    };

    try {
      const appointment = appointmentToEdit
        ? await updateAppointmentRequest(appointmentToEdit.id, payload)
        : await createAppointmentRequest(payload);
      setAppointments((current) =>
        (appointmentToEdit
          ? current.map((item) => item.id === appointment.id ? appointment : item)
          : [...current, appointment]).sort(
          (left, right) =>
            new Date(left.dateTime).getTime() - new Date(right.dateTime).getTime(),
        ),
      );
      try {
        const response = await fetch("/api/patients/count", { cache: "no-store" });
        const result = await response.json() as { total?: number; error?: string };
        if (!response.ok) throw new Error(result.error ?? "Unable to refresh patients.");
        setPatientCount(result.total ?? 0);
      } catch {
        showToast({ message: "Appointment saved, but the patient list could not refresh.", error: true });
        setModalOpen(false);
        setWalkInMode(false);
        setAppointmentToEdit(null);
        return;
      }
      setModalOpen(false);
      setWalkInMode(false);
      setAppointmentToEdit(null);
      showToast({ message: appointmentToEdit ? "Appointment updated successfully." : walkInMode ? "Walk-in patient added." : "Appointment added successfully.",
        error: false,
      });
      reloadSummaryRef.current?.();
      void queryClient.invalidateQueries({ queryKey: bookingKeys.all });
    } catch (error) {
      if (error instanceof AppointmentValidationError) {
        // The form shows each problem beside its field; no toast needed.
        setAppointmentServerErrors(error.fieldErrors);
      } else {
        showToast({ message: error instanceof Error ? error.message : "Could not create appointment.",
          error: true,
        });
      }
    } finally {
      setSaving(false);
    }
  }

  async function deleteAppointment(appointment: Appointment) {
    const confirmed = await confirm({
      title: "Delete appointment request?",
      description: `The request from ${appointment.patientName} will be permanently removed. This cannot be undone.`,
      confirmLabel: "Delete request",
      destructive: true,
    });
    if (!confirmed) return;

    try {
      await deleteAppointmentRequest(appointment.id);
      setAppointments((current) => current.filter((item) => item.id !== appointment.id));
      reloadSummaryRef.current?.();
      void queryClient.invalidateQueries({ queryKey: bookingKeys.all });
      try {
        const response = await fetch("/api/patients/count", { cache: "no-store" });
        const result = await response.json() as { total?: number; error?: string };
        if (!response.ok) throw new Error(result.error ?? "Unable to refresh patients.");
        setPatientCount(result.total ?? 0);
        showToast({ message: "Appointment request deleted.", error: false });
      } catch {
        showToast({ message: "Request deleted, but the patient list could not refresh.", error: true });
      }
    } catch (error) {
      showToast({ message: error instanceof Error ? error.message : "Could not delete appointment.",
        error: true,
      });
    }
  }

  async function signOut() {
    setSigningOut(true);
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 15_000);

    try {
      const result = await authClient.signOut({
        fetchOptions: { signal: controller.signal },
      });
      if (result.error) {
        throw new Error(result.error.message ?? "Could not sign out.");
      }
      window.location.replace("/login");
    } catch (error) {
      showToast({ message: error instanceof DOMException && error.name === "AbortError"
            ? "সাইন আউটের অনুরোধের সময় শেষ হয়েছে। আবার চেষ্টা করুন।"
            : error instanceof Error
              ? error.message
              : "Could not sign out.",
        error: true,
      });
      setSigningOut(false);
    } finally {
      window.clearTimeout(timeout);
    }
  }

  const page = pageTitles[section];

  return (
      <div className="main-area">
        <header className="topbar">
          <div className="topbar-leading">
            {/* The same collapse control on every page, not only the overview. */}
            <button
              type="button"
              className="icon-button topbar-sidebar-toggle"
              aria-label="Toggle sidebar"
              onClick={toggleSidebarCollapsed}
            >
              <Menu size={17} />
            </button>
            {section === "overview" ? (
              <span className="topbar-title">Dashboard Overview</span>
            ) : (
              <div className="breadcrumb">Clinic / <strong>{page.title}</strong></div>
            )}
          </div>
          <div className="topbar-actions">
            <div className="global-search-wrap">
              <label className="global-search">
                <Search size={16} aria-hidden="true" />
                <input
                  ref={globalSearchRef}
                  type="search"
                  value={globalSearch}
                  onChange={(event) => setGlobalSearch(event.target.value)}
                  placeholder="Search patients, appointments..."
                  aria-label="Search patients and appointments"
                />
                <kbd>Ctrl K</kbd>
              </label>
              {globalSearch.trim() && (
                <div className="global-search-results">
                  {globalSearchResults.length ? globalSearchResults.map((appointment) => (
                    <button
                      type="button"
                      key={appointment.id}
                      className="global-search-result"
                      onClick={() => {
                        setAppointmentToView(appointment);
                        setGlobalSearch("");
                      }}
                    >
                      <span className="patient-avatar">{initials(appointment.patientName)}</span>
                      <span className="global-search-copy">
                        <strong>{appointment.patientName}</strong>
                        <small>{appointment.service} · {formatClinicDate(appointment.dateTime)}</small>
                      </span>
                      <ArrowRight size={15} />
                    </button>
                  )) : <div className="global-search-empty">{globalSearchPending ? "Searching…" : "No matching appointments"}</div>}
                </div>
              )}
            </div>
            <button
              className="icon-button notification-button"
              aria-label="View pending appointment requests"
              onClick={() => navigateToSection("appointments", "PENDING")}
            >
              <Bell size={18} />
              {(dashboardSummary ? dashboardSummary.pendingAppointments > 0 : appointments.some((appointment) => appointment.status === "PENDING")) && <span className="notification-dot" />}
            </button>
            <div className="profile-switcher-wrap">
              <button
                type="button"
                className={`profile-switcher${profileOpen ? " is-open" : ""}`}
                onClick={toggleProfileMenu}
                aria-expanded={profileOpen}
                aria-label="Open profile menu"
              >
                <span className="avatar">{initials(user.name) || "AD"}</span>
                <span className="profile-copy">
                  <strong>{user.name}</strong>
                  <small>Administrator</small>
                </span>
                <ChevronDown size={15} />
              </button>
              {profileOpen && (
                <div className="profile-menu">
                  <div className="profile-menu-user">
                    <strong>{user.name}</strong>
                    <span>{user.email}</span>
                  </div>
                  <label className="theme-menu-control">
                    <Sun size={15} aria-hidden="true" />
                    <span>Appearance</span>
                    <select
                      value={theme}
                      onChange={(event) => setTheme(event.target.value as ThemePreference)}
                      aria-label="Theme preference"
                    >
                      <option value="light">Light</option>
                      <option value="dark">Dark</option>
                      <option value="system">System</option>
                    </select>
                  </label>
                  <button type="button" onClick={() => {
                    setProfileOpen(false);
                    navigateToSection("security");
                  }}>
                    <LockKeyhole size={15} /> Security settings
                  </button>
                  <button type="button" onClick={signOut} disabled={signingOut}>
                    <LogOut size={15} /> {signingOut ? "Signing out…" : "Sign out"}
                  </button>
                </div>
              )}
            </div>
            <button
              className="icon-button topbar-logout"
              onClick={signOut}
              title="Sign out"
              aria-label="Sign out"
              disabled={signingOut}
            >
              {signingOut ? <Clock3 size={17} /> : <LogOut size={17} />}
            </button>
          </div>
        </header>

        <main id="main-content" tabIndex={-1} className={`content${section === "overview" ? " overview-content" : ""}`}>
          <div className={`page-heading${section === "overview" ? " overview-page-heading" : ""}`}>
            <div>
              <div className="eyebrow">{todayLabel}</div>
              <h1 className="page-title">
                {section === "overview" ? `Welcome Back, ${user.name}!` : page.title}
              </h1>
              <p className="page-subtitle">{page.description}</p>
            </div>
            {section === "overview" && (
              <button className="button-primary" onClick={() => {
                setSelectedService("");
                setModalOpen(true);
              }}>
                <Plus size={15} /> New appointment
              </button>
            )}
          </div>

          {loading ? (
            <div className="loading-state">Loading your clinic data…</div>
          ) : loadError ? (
            <div className="panel-card empty-state" role="alert">
              <div className="empty-icon"><Activity size={18} /></div>
              <strong>Couldn’t load clinic data</strong>
              <div style={{ marginTop: 7 }}>{loadError}</div>
              <button className="button-secondary" style={{ marginTop: 15 }} onClick={() => window.location.reload()}>
                Try again
              </button>
            </div>
          ) : (
            <>
              {section === "overview" && (
                <Overview
                  appointments={appointments}
                  now={now}
                  todayCount={dashboardSummary?.todayAppointments ?? todayAppointments.length}
                  patientCount={patientCount}
                  summary={dashboardSummary}
                  onViewAppointments={() => navigateToSection("appointments")}
                  onViewRequest={setAppointmentToView}
                  onEditRequest={(appointment) => {
                    setAppointmentToEdit(appointment);
                    setSelectedService(appointment.service);
                    setModalOpen(true);
                  }}
                  onDeleteRequest={deleteAppointment}
                  onApproveRequest={(appointment) => changeStatus(appointment.id, "CONFIRMED")}
                  onViewPatients={() => navigateToSection("patients")}
                />
              )}
              {section === "appointments" && (
                <AppointmentManagement
                  appointments={appointments}
                  totalCount={appointmentTotal}
                  sourceCounts={dashboardSummary?.sourceCounts ?? { direct: 0, whatsapp: 0 }}
                  hasMore={appointmentCursor !== null}
                  loadingMore={loadingMoreAppointments}
                  onLoadMore={() => void loadMoreAppointments()}
                  defaultStatusFilter={statusFilter}
                  onStatusChange={changeStatus}
                  onNewAppointment={() => {
                    setSelectedService("");
                    setWalkInMode(false);
                    setModalOpen(true);
                  }}
                  onNewWalkIn={() => {
                    setSelectedService("");
                    setWalkInMode(true);
                    setModalOpen(true);
                  }}
                  onEdit={(appointment) => {
                    setAppointmentToEdit(appointment);
                    setSelectedService(appointment.service);
                    setModalOpen(true);
                  }}
                  onDelete={deleteAppointment}
                />
              )}
              {section === "patients" && <PatientDirectory />}
              {section === "services" && <ClinicOperations section="services" onNotice={notify} onBookService={(service) => {
                setSelectedService(service);
                setModalOpen(true);
              }} />}
              {section === "reviews" && <ReviewManagement />}
              {section === "gallery" && <GalleryManagement />}
              {section === "website" && <WebsiteContentManagement />}
              {section === "security" && <>
                <SecurityView onResult={(result) => notify(result.message, result.error)} />
                <ClinicOperations section="security" onNotice={notify} />
              </>}
              {section === "doctors" && <ClinicOperations section="doctors" onNotice={notify} />}
              {section === "billing" && <ClinicOperations section="billing" onNotice={notify} />}
              {section === "reports" && <ClinicOperations section="reports" onNotice={notify} />}
              {section === "expenses" && <FinanceSection onNotice={notify} />}
              {section === "sms" && <div className="grid gap-4"><VoiceSettings onNotice={notify} /><SmsSettings onNotice={notify} /></div>}
              {section === "email" && <EmailSettings onNotice={notify} />}
              {section === "access" && <AccessSection onNotice={notify} />}
              {section === "inventory" && <InventorySection onNotice={notify} />}
              {section === "orders" && <OrdersSection onNotice={notify} />}
            </>
          )}
        </main>
      {modalOpen && (
        <AppointmentModal
          saving={saving}
          defaultService={selectedService}
          appointment={appointmentToEdit}
          walkIn={walkInMode && !appointmentToEdit}
          serverErrors={appointmentServerErrors}
          onClose={() => {
            setAppointmentServerErrors({});
            setWalkInMode(false);
            setModalOpen(false);
            setSelectedService("");
            setAppointmentToEdit(null);
          }}
          onSubmit={saveAppointment}
        />
      )}
      {appointmentToView && (
        <AppointmentDetailsDialog
          appointment={appointmentToView}
          onClose={() => setAppointmentToView(null)}
          onEdit={() => {
            setAppointmentToEdit(appointmentToView);
            setSelectedService(appointmentToView.service);
            setAppointmentToView(null);
            setModalOpen(true);
          }}
        />
      )}
      {confirmDialog}
      </div>
  );
}
