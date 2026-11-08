"use client";

import dynamic from "next/dynamic";
import { Activity, ArrowRight, CalendarDays, ChartNoAxesCombined, Check, CircleCheck, Clock3, Eye, FileText, MoreHorizontal, Pencil, ReceiptText, Stethoscope, Trash2, UsersRound } from "lucide-react";
import { useState } from "react";
import { addClinicDays, formatClinicDate, formatClinicTime, formatClinicWeekday, getClinicDateKey, getClinicMonthKey } from "@/lib/clinic-date";
import { initials, bdtCurrency as dashboardCurrency } from "@/lib/format";
import { formatStatus } from "@/lib/status-labels";
import { type Appointment, type DashboardSummary } from "./dashboard-shared";

const TreatmentDonut = dynamic(() => import("./overview-charts").then((module) => module.TreatmentDonut), { ssr: false });
const AppointmentsBarChart = dynamic(() => import("./overview-charts").then((module) => module.AppointmentsBarChart), { ssr: false });

export default function Overview({
  appointments,
  now,
  todayCount,
  patientCount,
  summary,
  onViewAppointments,
  onViewRequest,
  onEditRequest,
  onDeleteRequest,
  onApproveRequest,
  onViewPatients,
}: {
  appointments: Appointment[];
  now: string;
  todayCount: number;
  patientCount: number;
  summary: DashboardSummary | null;
  onViewAppointments: () => void;
  onViewRequest: (appointment: Appointment) => void;
  onEditRequest: (appointment: Appointment) => void;
  onDeleteRequest: (appointment: Appointment) => void;
  onApproveRequest: (appointment: Appointment) => void;
  onViewPatients: () => void;
}) {
  const [openRequestMenu, setOpenRequestMenu] = useState<string | null>(null);
  const [chartRange, setChartRange] = useState<"week" | "month" | "year">("month");
  const activeAppointments = appointments.filter((item) => item.status !== "CANCELLED");
  const pendingAppointments = activeAppointments.filter((item) => item.status === "PENDING");
  const pendingCount = summary?.pendingAppointments ?? pendingAppointments.length;
  const currentMonth = getClinicMonthKey(now);
  const calculatedCompletedThisMonth = appointments.filter(
    (item) => item.status === "COMPLETED" && getClinicMonthKey(item.dateTime) === currentMonth,
  ).length;
  const completedThisMonth = summary?.completedThisMonth ?? calculatedCompletedThisMonth;
  const upcoming = activeAppointments
    .filter((item) => new Date(item.dateTime).getTime() >= new Date(now).getTime() && item.status !== "CANCELLED")
    .sort((left, right) => new Date(left.dateTime).getTime() - new Date(right.dateTime).getTime());
  const todayAppointments = activeAppointments
    .filter((item) => getClinicDateKey(item.dateTime) === getClinicDateKey(now))
    .sort((left, right) => new Date(left.dateTime).getTime() - new Date(right.dateTime).getTime());
  // Whole-clinic figures come from the server summary; the loaded appointment page is only a fallback.
  const overview = summary?.overview;
  const nextAppointment = overview ? overview.nextAppointment : upcoming[0];
  const pendingList = overview?.pendingRequests ?? pendingAppointments;
  const todayList = overview?.todaySchedule ?? todayAppointments;
  const completedCount = overview?.completedCount ?? activeAppointments.filter((item) => item.status === "COMPLETED").length;
  const activeTotal = summary?.totalAppointments ?? activeAppointments.length;
  const completionRate = activeTotal
    ? Math.round((completedCount / activeTotal) * 100)
    : 0;
  const monthAppointments = overview?.monthAppointments ?? activeAppointments.filter(
    (item) => getClinicMonthKey(item.dateTime) === currentMonth,
  ).length;
  const treatmentCounts = overview?.topServices ?? Array.from(
    activeAppointments.reduce((counts, item) => {
      counts.set(item.service, (counts.get(item.service) ?? 0) + 1);
      return counts;
    }, new Map<string, number>()),
    ([name, count]) => ({ name, count }),
  )
    .sort((left, right) => right.count - left.count)
    .slice(0, 4);
  const statusCounts = [
    { label: "Awaiting confirmation", count: pendingCount },
    { label: "Confirmed", count: overview?.confirmedCount ?? activeAppointments.filter((item) => item.status === "CONFIRMED").length },
    { label: "Completed", count: completedCount },
  ];
  return (
    <div className="overview-dashboard">
      <div className="overview-top-grid">
        <div className="overview-stat-grid">
          <KpiCard tone="blue" label="Total Patients" value={summary?.totalPatients ?? patientCount} note="Unique patient records" icon={<UsersRound size={16} />} />
          <KpiCard tone="teal" label="Appointments" value={summary?.totalAppointments ?? activeAppointments.length} note="Non-cancelled appointments" icon={<CalendarDays size={16} />} />
          <KpiCard tone="amber" label="Pending Requests" value={pendingCount} note="Awaiting review" icon={<Clock3 size={16} />} />
          <KpiCard tone="green" label="Completed" value={completedThisMonth} note="This month" icon={<CircleCheck size={16} />} />
        </div>
        <section className="overview-card overview-chart-card">
          <div className="overview-card-header overview-chart-header">
            <div>
              <h2>Bookings</h2>
              <p>Bookings by period</p>
            </div>
            <div className="overview-period-switch" aria-label="Appointment chart period">
              {(["week", "month", "year"] as const).map((range) => (
                <button
                  type="button"
                  key={range}
                  className={chartRange === range ? "is-active" : ""}
                  aria-pressed={chartRange === range}
                  onClick={() => setChartRange(range)}
                >
                  {range === "week" ? "Weekly" : range === "month" ? "Monthly" : "Yearly"}
                </button>
              ))}
            </div>
          </div>
          <AppointmentsChart appointments={appointments} now={now} range={chartRange} weeklySummary={summary?.weeklyAppointments} periodSummary={summary?.overview} />
        </section>
      </div>
      {summary && <div className="overview-finance-grid">
        {summary.revenue && summary.outstanding !== undefined && <>
        <KpiCard tone="blue" label="Revenue today" value={dashboardCurrency.format(Number(summary.revenue.today))} note="Payments received" icon={<ReceiptText size={16} />} />
        <KpiCard tone="teal" label="Revenue this week" value={dashboardCurrency.format(Number(summary.revenue.week))} note="Payments received" icon={<ChartNoAxesCombined size={16} />} />
        <KpiCard tone="green" label="Revenue this month" value={dashboardCurrency.format(Number(summary.revenue.month))} note="Payments received" icon={<ChartNoAxesCombined size={16} />} />
        <KpiCard tone="amber" label="Outstanding payments" value={dashboardCurrency.format(Number(summary.outstanding))} note="All non-void invoices" icon={<Clock3 size={16} />} />
        </>}
        <KpiCard tone="violet" label="Clinic doctors" value={summary.doctorCount} note="Configured doctor profiles" icon={<Stethoscope size={16} />} />
      </div>}
      <div className="overview-middle-grid">
        <section className="overview-card overview-treatment-card">
          <div className="overview-card-header">
            <div>
              <h2>Top Treatments</h2>
              <p>By booking requests</p>
            </div>
          </div>
          {treatmentCounts.length ? (
            <div className="overview-treatment-content">
              <div className="overview-donut">
                <TreatmentDonut data={treatmentCounts} colors={overviewColors} />
              </div>
              <ul className="overview-legend">
                {treatmentCounts.map((treatment, index) => (
                  <li key={treatment.name}>
                    <span style={{ backgroundColor: overviewColors[index % overviewColors.length] }} />
                    <span>{treatment.name}</span>
                    <strong>{treatment.count}</strong>
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <OverviewEmpty icon={<Activity size={18} />} message="Treatment data will appear after appointments are booked." />
          )}
        </section>
        <section className="overview-card overview-next-card">
          <div className="overview-card-header">
            <div>
              <h2>Next Patient Details</h2>
              <p>Your next scheduled visit</p>
            </div>
            {nextAppointment && (
              <button
                type="button"
                className="overview-icon-action"
                onClick={() => onViewRequest(nextAppointment)}
                aria-label={`View ${nextAppointment.patientName}'s appointment`}
              >
                <FileText size={15} />
              </button>
            )}
          </div>
          {nextAppointment ? (
            <div className="overview-next-details">
              <div className="overview-patient-heading">
                <span className="overview-patient-avatar">{initials(nextAppointment.patientName)}</span>
                <div>
                  <strong>{nextAppointment.patientName}</strong>
                  <span>{nextAppointment.service}</span>
                </div>
              </div>
              <dl>
                <div><dt>Next booking</dt><dd>{formatClinicDate(nextAppointment.dateTime)}</dd></div>
                <div><dt>Time</dt><dd>{formatClinicTime(nextAppointment.dateTime)}</dd></div>
                <div><dt>Status</dt><dd>{formatStatus(nextAppointment.status)}</dd></div>
              </dl>
              <button type="button" className="overview-text-link" onClick={() => onEditRequest(nextAppointment)}>
                View details <ArrowRight size={13} />
              </button>
            </div>
          ) : (
            <OverviewEmpty icon={<CalendarDays size={18} />} message="No upcoming appointments." />
          )}
        </section>
        <section className="overview-card overview-approval-card">
          <div className="overview-card-header">
            <div>
              <h2>Approval Requests</h2>
              <p>{pendingCount} awaiting confirmation</p>
            </div>
            <button type="button" className="overview-text-link" onClick={onViewAppointments}>
              View all <ArrowRight size={13} />
            </button>
          </div>
          {pendingList.length ? (
            <div className="overview-approval-list">
              {pendingList.slice(0, 3).map((appointment) => (
                <div className="overview-approval-row" key={appointment.id}>
                  <button type="button" className="overview-approval-patient" onClick={() => onViewRequest(appointment)}>
                    <span className="overview-patient-avatar">{initials(appointment.patientName)}</span>
                    <span>
                      <strong>{appointment.patientName}</strong>
                      <small>{appointment.service} · {formatClinicDate(appointment.dateTime)}</small>
                    </span>
                  </button>
                  <div className="overview-request-actions">
                    <button
                      type="button"
                      className="overview-confirm-button"
                      onClick={() => onApproveRequest(appointment)}
                      aria-label={`Confirm appointment for ${appointment.patientName}`}
                      title="Confirm appointment"
                    >
                      <Check size={14} />
                    </button>
                    <div className="request-menu-wrap">
                      <button
                        type="button"
                        className="request-action"
                        aria-label={`More actions for ${appointment.patientName}`}
                        aria-expanded={openRequestMenu === appointment.id}
                        onClick={() => setOpenRequestMenu((current) => current === appointment.id ? null : appointment.id)}
                      >
                        <MoreHorizontal size={17} />
                      </button>
                      {openRequestMenu === appointment.id && (
                        <div className="request-menu">
                          <button type="button" onClick={() => {
                            setOpenRequestMenu(null);
                            onViewRequest(appointment);
                          }}><Eye size={14} /> View details</button>
                          <button type="button" onClick={() => {
                            setOpenRequestMenu(null);
                            onEditRequest(appointment);
                          }}><Pencil size={14} /> Edit booking</button>
                          <button type="button" className="request-menu-danger" onClick={() => {
                            setOpenRequestMenu(null);
                            onDeleteRequest(appointment);
                          }}><Trash2 size={14} /> Delete request</button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <OverviewEmpty icon={<CircleCheck size={18} />} message="No requests need approval." />
          )}
        </section>
      </div>
      <div className="overview-bottom-grid">
        <section className="overview-card overview-today-card">
          <div className="overview-card-header">
            <div>
              <h2>Today&apos;s Appointment ({todayCount})</h2>
              <p>Scheduled visits</p>
            </div>
            <button type="button" className="overview-icon-action" onClick={onViewAppointments} aria-label="View all appointments">
              <ArrowRight size={15} />
            </button>
          </div>
          {todayList.length ? (
            <div className="overview-today-list">
              {todayList.slice(0, 4).map((appointment) => (
                <button
                  type="button"
                  className="overview-today-row"
                  key={appointment.id}
                  onClick={() => onViewRequest(appointment)}
                >
                  <span className="overview-today-copy">
                    <small>{appointment.service}</small>
                    <strong>{appointment.patientName}</strong>
                  </span>
                  <time>{formatClinicTime(appointment.dateTime)}</time>
                </button>
              ))}
            </div>
          ) : (
            <OverviewEmpty icon={<CalendarDays size={18} />} message="No appointments scheduled for today." />
          )}
        </section>

        <section className="overview-card overview-success-card">
          <div className="overview-card-header">
            <div>
              <h2>Success Stats</h2>
              <p>Completed booking rate</p>
            </div>
            <CircleCheck size={17} className="overview-success-icon" />
          </div>
          <div className="overview-success-value">{completionRate}<span>%</span></div>
          <div
            className="overview-progress"
            role="progressbar"
            aria-label="Appointment completion rate"
            aria-valuenow={completionRate}
            aria-valuemin={0}
            aria-valuemax={100}
          >
            <span style={{ width: `${completionRate}%` }} />
          </div>
          <p className="overview-footnote">{completedCount} completed of {activeTotal} non-cancelled appointments</p>
        </section>

        <section className="overview-card overview-patient-summary">
          <div className="overview-card-header">
            <div>
              <h2>Patient Records</h2>
              <p>Registered clinic patients</p>
            </div>
            <UsersRound size={17} className="overview-patient-icon" />
          </div>
          <div className="overview-patient-total">{patientCount}</div>
          <div className="overview-patient-month">{monthAppointments} appointments this month</div>
          <button type="button" className="overview-text-link" onClick={onViewPatients}>
            View patient list <ArrowRight size={13} />
          </button>
        </section>

        <section className="overview-card overview-status-card">
          <div className="overview-card-header">
            <div>
              <h2>Booking Status</h2>
              <p>Current clinic activity</p>
            </div>
          </div>
          <div className="overview-status-list">
            {statusCounts.map((status, index) => {
              const percentage = activeAppointments.length
                ? Math.round((status.count / activeAppointments.length) * 100)
                : 0;
              return (
                <div className="overview-status-item" key={status.label}>
                  <div className="overview-status-label">
                    <span><i className={`overview-status-dot status-dot-${index}`} />{status.label}</span>
                    <strong>{status.count}</strong>
                  </div>
                  <div className="overview-status-track">
                    <span className={`status-fill-${index}`} style={{ width: `${percentage}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      </div>
    </div>
  );
}

function KpiCard({
  tone,
  label,
  value,
  note,
  icon,
}: {
  tone: "blue" | "teal" | "amber" | "green" | "violet";
  label: string;
  value: number | string;
  note: string;
  icon: React.ReactNode;
}) {
  return (
    <article className={`overview-card overview-stat-card kpi-card kpi-card-${tone}${String(value).length > 11 ? " kpi-card-long" : ""}`} aria-label={`${label}: ${value}`}>
      <span className="overview-stat-icon">{icon}</span>
      <div className="overview-stat-copy">
        <span className="overview-stat-label">{label}</span>
        <strong>{value}</strong>
        <small>{note}</small>
      </div>
    </article>
  );
}

type OverviewRange = "week" | "month" | "year";

const overviewColors = ["#4c70d7", "#5fc17a", "#ffc24b", "#e76b7d"];

function OverviewEmpty({ icon, message }: { icon: React.ReactNode; message: string }) {
  return (
    <div className="overview-empty">
      <span>{icon}</span>
      <p>{message}</p>
    </div>
  );
}

function AppointmentsChart({
  appointments,
  now,
  range,
  weeklySummary,
  periodSummary,
}: {
  appointments: Appointment[];
  now: string;
  range: OverviewRange;
  weeklySummary?: DashboardSummary["weeklyAppointments"];
  periodSummary?: DashboardSummary["overview"];
}) {
  const today = getClinicDateKey(now);
  const currentDate = new Date(`${today}T12:00:00.000Z`);
  const buckets = Array.from({ length: range === "week" ? 7 : 6 }, (_, index) => {
    if (range === "week") {
      const date = addClinicDays(today, index - 6);
      return { key: date, label: formatClinicWeekday(date) };
    }

    if (range === "month") {
      const date = new Date(Date.UTC(
        currentDate.getUTCFullYear(),
        currentDate.getUTCMonth() + index - 5,
        1,
        12,
      ));
      return {
        key: date.toISOString().slice(0, 7),
        label: new Intl.DateTimeFormat("en", { month: "short", timeZone: "UTC" }).format(date),
      };
    }

    const year = currentDate.getUTCFullYear() + index - 5;
    return { key: String(year), label: String(year) };
  });
  const data = range === "week" && weeklySummary?.length
    ? weeklySummary.map((day) => ({
        label: formatClinicWeekday(day.date),
        appointments: day.count,
        completed: day.completed,
      }))
    : periodSummary && range !== "week"
    ? buckets.map((bucket) => {
        const row = (range === "month" ? periodSummary.monthly : periodSummary.yearly).find((item) => item.key === bucket.key);
        return { label: bucket.label, appointments: row?.count ?? 0, completed: row?.completed ?? 0 };
      })
    : buckets.map((bucket) => {
    const matching = appointments.filter((appointment) => {
      if (appointment.status === "CANCELLED") return false;
      const date = getClinicDateKey(appointment.dateTime);
      const key = range === "week" ? date : range === "month" ? date.slice(0, 7) : date.slice(0, 4);
      return key === bucket.key;
      });

    return {
      label: bucket.label,
      appointments: matching.length,
      completed: matching.filter((appointment) => appointment.status === "COMPLETED").length,
    };
  });
  const hasData = data.some((item) => item.appointments > 0);

  return (
    <div className="overview-chart-wrap">
      <AppointmentsBarChart data={data} />
      {!hasData && <div className="overview-chart-empty">No bookings in this period</div>}
    </div>
  );
}
