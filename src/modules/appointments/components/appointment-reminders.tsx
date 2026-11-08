"use client";

import { BellRing, MessageCircle, Phone } from "lucide-react";
import { useEffect, useState } from "react";
import { formatClinicDate, formatClinicTime } from "@/lib/clinic-date";

type Reminder = { id: string; patientName: string; patientPhone: string; service: string; dateTime: string; status: string };

const whatsappLink = (phone: string, text: string) => {
  const digits = phone.replace(/\D/g, "");
  const full = digits.startsWith("0") ? `88${digits}` : digits;
  return `https://wa.me/${full}?text=${encodeURIComponent(text)}`;
};

// Upcoming bookings, each with one-tap call and WhatsApp links.
export default function AppointmentReminders() {
  const [open, setOpen] = useState(false);
  const [days, setDays] = useState(2);
  // One result per look-ahead setting; "loading" is simply "no result for the current setting yet".
  const [result, setResult] = useState<{ days: number; reminders: Reminder[]; error: string } | null>(null);

  useEffect(() => {
    if (!open) return;
    const controller = new AbortController();
    fetch(`/api/appointments/reminders?days=${days}`, { cache: "no-store", signal: controller.signal })
      .then(async (response) => {
        const body = await response.json() as { reminders?: Reminder[]; error?: string };
        if (!response.ok) throw new Error(body.error ?? "Unable to load reminders.");
        setResult({ days, reminders: body.reminders ?? [], error: "" });
      })
      .catch((reason: unknown) => {
        if (!controller.signal.aborted) setResult({ days, reminders: [], error: reason instanceof Error ? reason.message : "Unable to load reminders." });
      });
    return () => controller.abort();
  }, [open, days]);

  const current = result?.days === days ? result : null;
  const loading = open && !current;
  const reminders = current?.reminders ?? [];
  const error = current?.error ?? "";

  return (
    <section className="panel-card appointment-reminders">
      <header className="panel-header">
        <div>
          <h2 className="panel-title"><BellRing size={15} /> Reminders</h2>
          <p className="panel-description">Call or message patients before their booking.</p>
        </div>
        <button type="button" className="button-secondary" aria-expanded={open} onClick={() => setOpen((current) => !current)}>
          {open ? "Hide" : "Show reminders"}
        </button>
      </header>
      {open && (
        <div className="reminder-body">
          <label className="form-field reminder-days">Look ahead
            <select value={days} onChange={(event) => setDays(Number(event.target.value))}>
              <option value={1}>Today and tomorrow</option>
              <option value={2}>Next 2 days</option>
              <option value={7}>Next 7 days</option>
            </select>
          </label>
          {error && <div className="form-error" role="alert">{error}</div>}
          {loading ? <p className="reminder-empty">Loading…</p> : (
            <>
              <h3 className="reminder-heading">Upcoming bookings ({reminders.length})</h3>
              {!reminders.length && <p className="reminder-empty">No upcoming bookings in this period.</p>}
              <ul className="reminder-list">
                {reminders.map((item) => (
                  <li key={item.id}>
                    <div>
                      <strong>{item.patientName}</strong>
                      <span className="cell-secondary">{formatClinicDate(item.dateTime)} · {formatClinicTime(item.dateTime)} · {item.service}{item.status === "PENDING" ? " · not confirmed" : ""}</span>
                    </div>
                    <div className="reminder-actions">
                      <a className="button-secondary" href={`tel:${item.patientPhone}`}><Phone size={13} /> Call</a>
                      <a className="button-secondary" href={whatsappLink(item.patientPhone, `Dear ${item.patientName}, this is a reminder of your ${item.service} booking on ${formatClinicDate(item.dateTime)} at ${formatClinicTime(item.dateTime)}.`)} target="_blank" rel="noopener noreferrer"><MessageCircle size={13} /> WhatsApp</a>
                    </div>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      )}
    </section>
  );
}
