"use client";

import { Check, X } from "lucide-react";
import { useEffect, useState } from "react";
import type { FocusEvent, FormEvent } from "react";
import Modal from "@/components/shared/modal";
import PatientSelect from "@/components/shared/patient-select";
import {
  APPOINTMENT_LIMITS,
  validateAppointmentFields,
  type AppointmentField,
  type AppointmentFieldErrors,
  type AppointmentFieldInput,
} from "@/modules/appointments/schemas/appointment-rules";
import { localDateTimeValue, type Appointment } from "./dashboard-shared";

const FIELD_ORDER: AppointmentField[] = ["patientName", "patientPhone", "patientEmail", "service", "dateTime", "notes"];

/** Reads the form the same way the submit handler does, so checks match what would be sent. */
function readValues(form: HTMLFormElement, walkIn: boolean): AppointmentFieldInput {
  const data = new FormData(form);
  const text = (name: string) => String(data.get(name) ?? "");
  const parsed = new Date(text("dateTime"));
  return {
    patientId: text("patientId"),
    patientName: text("patientName"),
    patientPhone: text("patientPhone"),
    patientEmail: text("patientEmail"),
    service: text("service"),
    dateTime: walkIn ? new Date().toISOString() : Number.isFinite(parsed.getTime()) ? parsed.toISOString() : "",
    notes: text("notes"),
  };
}

export default function AppointmentModal({
  saving,
  defaultService,
  appointment,
  walkIn = false,
  serverErrors,
  onClose,
  onSubmit,
}: {
  saving: boolean;
  defaultService: string;
  appointment: Appointment | null;
  /** Book the patient for right now, already confirmed (no date or time to choose). */
  walkIn?: boolean;
  /** Field problems the server reported for the last save attempt. */
  serverErrors: AppointmentFieldErrors;
  onClose: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  const [minimumDate] = useState(() => localDateTimeValue(new Date()));
  const [defaultDate] = useState(() => localDateTimeValue(new Date(Date.now() + 60 * 60 * 1000)));
  const [selectedPatientId, setSelectedPatientId] = useState(appointment?.patientId ?? "");
  const [patientChoices, setPatientChoices] = useState<{ id: string; patientCode: string; name: string }[]>([]);
  const [serviceChoices, setServiceChoices] = useState<{ id: string; name: string; standardPrice: string; durationMinutes: number }[]>([]);
  const [doctorChoices, setDoctorChoices] = useState<{ id: string; name: string; specialization: string }[]>([]);
  const [doctorId, setDoctorId] = useState(appointment?.doctorId ?? "");
  const [choicesError, setChoicesError] = useState("");
  const [clientErrors, setClientErrors] = useState<AppointmentFieldErrors>({});
  const [touched, setTouched] = useState<Partial<Record<AppointmentField, boolean>>>({});
  const [serviceName, setServiceName] = useState(appointment?.service ?? defaultService);
  const [dateValue, setDateValue] = useState(
    appointment ? localDateTimeValue(new Date(appointment.dateTime)) : defaultDate,
  );
  const [notesLength, setNotesLength] = useState(appointment?.notes?.length ?? 0);
  // Server errors stay visible until the person edits the field they belong to.
  const [lastServerErrors, setLastServerErrors] = useState(serverErrors);
  const [shownServerErrors, setShownServerErrors] = useState(serverErrors);
  if (serverErrors !== lastServerErrors) {
    setLastServerErrors(serverErrors);
    setShownServerErrors(serverErrors);
  }

  const rejectPast = !appointment && !walkIn;
  const selectedServiceInfo = serviceChoices.find((service) => service.name === serviceName);
  const endsAt = (() => {
    if (!selectedServiceInfo || !dateValue) return "";
    const start = new Date(dateValue);
    if (!Number.isFinite(start.getTime())) return "";
    const end = new Date(start.getTime() + selectedServiceInfo.durationMinutes * 60_000);
    return new Intl.DateTimeFormat("en", { hour: "numeric", minute: "2-digit" }).format(end);
  })();

  function errorFor(field: AppointmentField) {
    return (touched[field] ? clientErrors[field] : undefined) ?? shownServerErrors[field];
  }

  function validateForm(form: HTMLFormElement, markAllTouched: boolean) {
    const errors = validateAppointmentFields(readValues(form, walkIn), { rejectPast });
    setClientErrors(errors);
    if (markAllTouched) setTouched(Object.fromEntries(FIELD_ORDER.map((field) => [field, true])));
    return errors;
  }

  function fieldProps(field: AppointmentField) {
    const message = errorFor(field);
    return {
      "aria-invalid": message ? true : undefined,
      "aria-describedby": message ? `${field}-error` : undefined,
      onBlur: (event: FocusEvent<HTMLElement>) => {
        setTouched((current) => ({ ...current, [field]: true }));
        const form = (event.currentTarget as HTMLInputElement).form;
        if (form) validateForm(form, false);
      },
      onInput: (event: FormEvent<HTMLElement>) => {
        setShownServerErrors((current) => {
          if (!current[field]) return current;
          const rest = { ...current };
          delete rest[field];
          return rest;
        });
        const form = (event.currentTarget as HTMLInputElement).form;
        if (form) validateForm(form, false);
      },
    } as const;
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    const errors = validateForm(event.currentTarget, true);
    const firstInvalid = FIELD_ORDER.find((field) => errors[field]);
    if (firstInvalid) {
      event.preventDefault();
      document.getElementById(firstInvalid)?.focus();
      return;
    }
    onSubmit(event);
  }

  const fieldError = (field: AppointmentField) => {
    const message = errorFor(field);
    return message ? <small className="field-error" id={`${field}-error`} role="alert">{message}</small> : null;
  };

  useEffect(() => {
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      try {
        const [patientsResponse, servicesResponse, doctorsResponse] = await Promise.all([
          fetch("/api/patients?page=1&pageSize=100&status=ACTIVE&fields=picker", { cache: "no-store", signal: controller.signal }),
          fetch("/api/services", { cache: "no-store", signal: controller.signal }),
          // Staff without access to doctors simply get no doctor choice; the booking still works.
          fetch("/api/doctors?status=active&pageSize=50", { cache: "no-store", signal: controller.signal }).catch(() => null),
        ]);
        if (!patientsResponse.ok || !servicesResponse.ok) {
          throw new Error("Unable to load patient and service choices.");
        }
        const [patientsResult, servicesResult] = await Promise.all([
          patientsResponse.json() as Promise<{ patients: { id: string; patientCode: string; name: string }[] }>,
          servicesResponse.json() as Promise<{ services: { id: string; name: string; standardPrice: string; durationMinutes: number }[] }>,
        ]);
        const doctors = doctorsResponse?.ok
          ? ((await doctorsResponse.json()) as { doctors: { id: string; name: string; specialization: string }[] }).doctors
          : [];
        if (!controller.signal.aborted) {
          setPatientChoices(patientsResult.patients);
          setServiceChoices(servicesResult.services);
          setDoctorChoices(doctors);
          // Default to the clinic's main doctor (or the first one) unless this appointment already has one.
          setDoctorId((current) => current || doctors.find((doctor) => doctor.id === "primary")?.id || doctors[0]?.id || "");
        }
      } catch {
        if (!controller.signal.aborted) {
          setPatientChoices([]);
          setServiceChoices([]);
          setChoicesError("Could not load active patient and service choices. You can still enter patient details manually.");
        }
      }
    }, 0);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, []);

  return (
    <Modal labelledBy="modal-title" onRequestClose={onClose}>
        <div className="modal-heading">
          <div>
            <h2 id="modal-title">{appointment ? "Edit appointment" : walkIn ? "Walk-in patient" : "New appointment"}</h2>
            <p>{appointment ? "Update the patient and appointment details." : walkIn ? "A patient who arrived without a booking. They are added for right now, already confirmed." : "Add a patient visit to the clinic schedule."}</p>
          </div>
          <button className="icon-button" onClick={onClose} aria-label="Close dialog"><X size={15} /></button>
        </div>
        <form className="modal-form" id="appointment-form" noValidate onSubmit={handleSubmit}>
          <div className="form-field">
            <label htmlFor="patientId">Link existing patient (optional)</label>
            <PatientSelect id="patientId" name="patientId" value={selectedPatientId} onChange={(id) => { setSelectedPatientId(id); window.setTimeout(() => {
            const form = document.getElementById("appointment-form");
            if (form instanceof HTMLFormElement) validateForm(form, false);
          }, 0); }} choices={patientChoices} status="ACTIVE" placeholder="Enter patient details manually" />
            <small>When linked, the patient’s saved contact details will be used.</small>
          </div>
          {choicesError && <div className="form-error" role="alert">{choicesError}</div>}
          <div className="form-grid">
            <div className="form-field">
              <label htmlFor="patientName">Patient name *</label>
              <input id="patientName" name="patientName" maxLength={APPOINTMENT_LIMITS.nameMax} autoComplete="off" autoFocus defaultValue={appointment?.patientName} {...fieldProps("patientName")} />
              {fieldError("patientName")}
            </div>
            <div className="form-field">
              <label htmlFor="patientPhone">Phone number *</label>
              <input id="patientPhone" name="patientPhone" type="tel" inputMode="tel" autoComplete="off" placeholder="01XXXXXXXXX" maxLength={APPOINTMENT_LIMITS.phoneMax} defaultValue={appointment?.patientPhone} {...fieldProps("patientPhone")} />
              {fieldError("patientPhone")}
            </div>
          </div>
          <div className="form-field">
            <label htmlFor="patientEmail">Email address</label>
            <input id="patientEmail" name="patientEmail" type="email" autoComplete="off" placeholder="name@example.com" maxLength={APPOINTMENT_LIMITS.emailMax} defaultValue={appointment?.patientEmail ?? ""} {...fieldProps("patientEmail")} />
            {fieldError("patientEmail")}
          </div>
          <div className="form-grid">
            <div className="form-field">
              <label htmlFor="service">Treatment *</label>
              <select id="service" name="service" defaultValue={appointment?.service ?? defaultService} {...fieldProps("service")} onChange={(event) => setServiceName(event.target.value)}>
                <option value="" disabled>Select a service</option>
                {serviceChoices.map((service) => <option key={service.id} value={service.name}>{service.name} · ৳{service.standardPrice} · {service.durationMinutes} min</option>)}
              </select>
              {fieldError("service")}
              {selectedServiceInfo && <small>{selectedServiceInfo.durationMinutes} min · ৳{selectedServiceInfo.standardPrice}</small>}
              {!serviceChoices.length && <small>No active services. Add a verified service in the Services module first.</small>}
            </div>
            {walkIn ? (
              <div className="form-field">
                <label htmlFor="walk-in-time">Date & time</label>
                <input id="walk-in-time" value="Now (walk-in)" readOnly disabled />
              </div>
            ) : (
            <div className="form-field">
              <label htmlFor="dateTime">Date & time *</label>
              <input
                id="dateTime"
                name="dateTime"
                type="datetime-local"
                min={appointment ? undefined : minimumDate}
                defaultValue={appointment ? localDateTimeValue(new Date(appointment.dateTime)) : defaultDate}
                {...fieldProps("dateTime")}
                onChange={(event) => setDateValue(event.target.value)}
              />
              {fieldError("dateTime")}
              {endsAt && !errorFor("dateTime") && <small>Ends about {endsAt}</small>}
            </div>
            )}
          </div>
          {doctorChoices.length > 0 && (
            <div className="form-field">
              <label htmlFor="doctorId">Doctor</label>
              <select id="doctorId" name="doctorId" value={doctorId} onChange={(event) => setDoctorId(event.target.value)}>
                {doctorChoices.map((doctor) => <option key={doctor.id} value={doctor.id}>{doctor.name} · {doctor.specialization}</option>)}
              </select>
              <small>The doctor is named in the booking SMS.</small>
            </div>
          )}
          <div className="form-field">
            <label htmlFor="notes">Notes</label>
            <textarea id="notes" name="notes" maxLength={APPOINTMENT_LIMITS.notesMax} placeholder="Optional notes for the clinic" defaultValue={appointment?.notes ?? ""} {...fieldProps("notes")} onChange={(event) => setNotesLength(event.target.value.length)} />
            {fieldError("notes")}
            <small className="field-counter">{notesLength} / {APPOINTMENT_LIMITS.notesMax}</small>
          </div>
          <div className="modal-actions">
            <button className="button-secondary" type="button" onClick={onClose}>Cancel</button>
            <button className="button-primary" type="submit" disabled={saving}>
              <Check size={14} /> {saving ? "Saving…" : appointment ? "Save changes" : walkIn ? "Add walk-in" : "Add appointment"}
            </button>
          </div>
        </form>
      </Modal>
  );
}
