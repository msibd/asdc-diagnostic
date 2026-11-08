"use client";

import { ChartNoAxesColumn, ChevronDown } from "lucide-react";
import dynamic from "next/dynamic";
import { useMemo, useState } from "react";
import { addClinicDays, getClinicDateKey } from "@/lib/clinic-date";
import type {
  DayBar,
  HourBar,
  StatusSlice,
} from "@/modules/appointments/components/appointment-insight-charts";
import type { AppointmentRecord } from "@/modules/appointments/schemas/appointment-schema";

const StatusDonut = dynamic(() => import("./appointment-insight-charts").then((module) => module.StatusDonut), { ssr: false });
const DayBars = dynamic(() => import("./appointment-insight-charts").then((module) => module.DayBars), { ssr: false });
const HourBars = dynamic(() => import("./appointment-insight-charts").then((module) => module.HourBars), { ssr: false });

const STATUS_STYLE = [
  { key: "PENDING", name: "Pending", color: "#f59e0b" },
  { key: "CONFIRMED", name: "Confirmed", color: "#ea580c" },
  { key: "COMPLETED", name: "Completed", color: "#2563eb" },
  { key: "CANCELLED", name: "Cancelled", color: "#94a3b8" },
  { key: "NO_SHOW", name: "No-show", color: "#e11d48" },
] as const;

const CLINIC_HOURS = Array.from({ length: 11 }, (_, index) => index + 8); // 08:00 to 18:00
const clinicHourFormat = new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Dhaka", hour: "2-digit", hourCycle: "h23" });
const dayLabelFormat = new Intl.DateTimeFormat("en", { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" });

function hourLabel(hour: number) {
  const suffix = hour >= 12 ? "p" : "a";
  return `${hour % 12 === 0 ? 12 : hour % 12}${suffix}`;
}

/**
 * Live charts for the appointments page. They are computed from whatever the filters currently
 * show, so searching or filtering redraws them, and picking a status slice filters the list.
 */
export default function AppointmentInsights({
  appointments,
  statusFilter,
  onStatusSelect,
  today,
}: {
  appointments: AppointmentRecord[];
  statusFilter: string;
  onStatusSelect: (status: string) => void;
  today: string;
}) {
  const [open, setOpen] = useState(true);

  const { statusData, dayData, hourData, peakHour } = useMemo(() => {
    const statusCounts = new Map<string, number>();
    const dayCounts = new Map<string, number>();
    const hourCounts = new Map<number, number>();
    for (const appointment of appointments) {
      statusCounts.set(appointment.status, (statusCounts.get(appointment.status) ?? 0) + 1);
      // The charts below follow the status filter; cancelled visits are left out unless asked for.
      if (statusFilter === "ALL" ? appointment.status === "CANCELLED" || appointment.status === "NO_SHOW" : appointment.status !== statusFilter) continue;
      const day = getClinicDateKey(appointment.dateTime);
      dayCounts.set(day, (dayCounts.get(day) ?? 0) + 1);
      const hour = Number(clinicHourFormat.format(new Date(appointment.dateTime)));
      hourCounts.set(hour, (hourCounts.get(hour) ?? 0) + 1);
    }
    const statusData: StatusSlice[] = STATUS_STYLE.map((style) => ({ ...style, count: statusCounts.get(style.key) ?? 0 }));
    const dayData: DayBar[] = Array.from({ length: 14 }, (_, index) => {
      const date = addClinicDays(today, index - 6);
      return {
        label: String(Number(date.slice(8, 10))),
        full: dayLabelFormat.format(new Date(`${date}T12:00:00Z`)),
        count: dayCounts.get(date) ?? 0,
        tone: date === today ? "today" : date < today ? "past" : "future",
      };
    });
    const hours = Array.from(new Set([...CLINIC_HOURS, ...hourCounts.keys()])).sort((a, b) => a - b);
    const hourData: HourBar[] = hours.map((hour) => ({ label: hourLabel(hour), count: hourCounts.get(hour) ?? 0 }));
    const peak = hourData.reduce((best, bar) => (bar.count > best.count ? bar : best), { label: "", count: 0 });
    return { statusData, dayData, hourData, peakHour: peak.count > 0 ? peak : null };
  }, [appointments, today, statusFilter]);

  const total = statusData.reduce((sum, slice) => sum + slice.count, 0);
  const selectedStatus = STATUS_STYLE.find((style) => style.key === statusFilter);

  return (
    <section className="appointment-insights" aria-label="Appointment insights">
      <header className="appointment-insights-header">
        <div>
          <h2><ChartNoAxesColumn size={16} aria-hidden="true" /> Insights</h2>
          <p>
            {total
              ? `Based on ${total} appointment${total === 1 ? "" : "s"} matching your filters.`
              : "No appointments match your filters."}
          </p>
        </div>
        <button
          type="button"
          className="button-secondary insights-toggle"
          aria-expanded={open}
          onClick={() => setOpen((current) => !current)}
        >
          {open ? "Hide" : "Show"} <ChevronDown size={14} className={open ? "is-open" : ""} aria-hidden="true" />
        </button>
      </header>
      {open && (
        <div className="appointment-insights-grid">
          <article className="insight-card">
            <h3>Status mix</h3>
            <div className="insight-donut-row">
              <div className="insight-donut" role="img" aria-label={`Status mix of ${total} appointments`}>
                {total > 0 ? (
                  <StatusDonut data={statusData} activeKey={statusFilter} onSelect={(key) => onStatusSelect(statusFilter === key ? "ALL" : key)} />
                ) : <span className="insight-empty">No data</span>}
                {total > 0 && <div className="insight-donut-total"><strong>{selectedStatus ? statusData.find((s) => s.key === selectedStatus.key)?.count : total}</strong><span>{selectedStatus ? selectedStatus.name : "Total"}</span></div>}
              </div>
              <ul className="insight-legend">
                {statusData.map((slice) => (
                  <li key={slice.key}>
                    <button
                      type="button"
                      className={statusFilter === slice.key ? "is-active" : undefined}
                      aria-pressed={statusFilter === slice.key}
                      onClick={() => onStatusSelect(statusFilter === slice.key ? "ALL" : slice.key)}
                    >
                      <span className="legend-dot" style={{ background: slice.color }} aria-hidden="true" />
                      <span>{slice.name}</span>
                      <strong>{slice.count}</strong>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          </article>
          <article className="insight-card">
            <h3>Visits per day <small>last 6 days to next 7</small></h3>
            <div className="insight-chart" role="img" aria-label="Appointments per day">
              <DayBars data={dayData} />
            </div>
          </article>
          <article className="insight-card">
            <h3>Busiest hours {peakHour && <small>peak {peakHour.label} · {peakHour.count}</small>}</h3>
            <div className="insight-chart" role="img" aria-label="Appointments by hour of day">
              <HourBars data={hourData} />
            </div>
          </article>
        </div>
      )}
    </section>
  );
}
