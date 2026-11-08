"use client";

import { useId, useState, type FormEvent, type ReactNode } from "react";
import { Save, X } from "lucide-react";
import Modal from "@/components/shared/modal";
import { days } from "@/modules/clinic/components/clinic-types";
import { PRIMARY_DOCTOR_ID, doctorInputSchema, slugify, type DoctorRecord } from "../doctor-schema";
import DoctorAvatar from "./doctor-avatar";

type Schedule = { dayOfWeek: number; startTime: string; endTime: string; isWorking: boolean };

type FormState = {
  name: string;
  slug: string;
  designation: string;
  imageUrl: string;
  qualifications: string;
  specialization: string;
  experienceYears: string;
  bio: string;
  registrationNumber: string;
  consultationInfo: string;
  consultationFee: string;
  phone: string;
  email: string;
  address: string;
  displayOrder: string;
  isActive: boolean;
  isPublished: boolean;
  schedules: Schedule[];
};

const closedWeek = (): Schedule[] => days.map((_, dayOfWeek) => ({ dayOfWeek, startTime: "09:00", endTime: "17:00", isWorking: false }));

function toForm(doctor: DoctorRecord | null): FormState {
  if (!doctor) {
    return {
      name: "", slug: "", designation: "", imageUrl: "", qualifications: "", specialization: "", experienceYears: "", bio: "",
      registrationNumber: "", consultationInfo: "", consultationFee: "0", phone: "", email: "", address: "", displayOrder: "0",
      isActive: true, isPublished: false, schedules: closedWeek(),
    };
  }
  const byDay = new Map(doctor.schedules.map((schedule) => [schedule.dayOfWeek, schedule]));
  return {
    name: doctor.name,
    slug: doctor.slug,
    designation: doctor.designation ?? "",
    imageUrl: doctor.imageUrl ?? "",
    qualifications: doctor.qualifications,
    specialization: doctor.specialization,
    experienceYears: doctor.experienceYears == null ? "" : String(doctor.experienceYears),
    bio: doctor.bio ?? "",
    registrationNumber: doctor.registrationNumber ?? "",
    consultationInfo: doctor.consultationInfo ?? "",
    consultationFee: doctor.consultationFee,
    phone: doctor.phone ?? "",
    email: doctor.email ?? "",
    address: doctor.address ?? "",
    displayOrder: String(doctor.displayOrder),
    isActive: doctor.isActive,
    isPublished: doctor.isPublished,
    schedules: days.map((_, dayOfWeek) => byDay.get(dayOfWeek) ?? { dayOfWeek, startTime: "09:00", endTime: "17:00", isWorking: false }),
  };
}

function toPayload(form: FormState) {
  const blank = (value: string) => value.trim() || null;
  return {
    name: form.name,
    slug: form.slug,
    designation: blank(form.designation),
    imageUrl: blank(form.imageUrl),
    qualifications: form.qualifications,
    specialization: form.specialization,
    experienceYears: form.experienceYears.trim() === "" ? null : Number(form.experienceYears),
    bio: blank(form.bio),
    registrationNumber: blank(form.registrationNumber),
    consultationInfo: blank(form.consultationInfo),
    consultationFee: form.consultationFee.trim() === "" ? 0 : Number(form.consultationFee),
    phone: blank(form.phone),
    email: blank(form.email),
    address: blank(form.address),
    displayOrder: form.displayOrder.trim() === "" ? 0 : Number(form.displayOrder),
    isActive: form.isActive,
    isPublished: form.isPublished,
    schedules: form.schedules,
  };
}

/** Add or edit a doctor. Validates with the same schema the server uses, then asks the parent to save. */
export default function DoctorFormDialog({ doctor, onSave, onClose }: {
  doctor: DoctorRecord | null;
  /** Resolves with an error message to show in the dialog, or null when the save worked. */
  onSave: (payload: ReturnType<typeof toPayload>) => Promise<string | null>;
  onClose: () => void;
}) {
  const titleId = useId();
  const [form, setForm] = useState<FormState>(() => toForm(doctor));
  // While the slug has not been edited by hand it follows the name.
  const [slugEdited, setSlugEdited] = useState(Boolean(doctor));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);
  const isPrimary = doctor?.id === PRIMARY_DOCTOR_ID;

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => setForm((current) => ({ ...current, [key]: value }));
  const setSchedule = (dayOfWeek: number, patch: Partial<Schedule>) =>
    setForm((current) => ({ ...current, schedules: current.schedules.map((item) => (item.dayOfWeek === dayOfWeek ? { ...item, ...patch } : item)) }));

  function onNameChange(value: string) {
    setForm((current) => ({ ...current, name: value, slug: slugEdited ? current.slug : (value.trim() ? slugify(value) : "") }));
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError("");
    const payload = toPayload(form);
    const parsed = doctorInputSchema.safeParse(payload);
    if (!parsed.success) {
      const next: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        const key = String(issue.path[0] ?? "form");
        // Only the first problem per field; schedule problems are reported against the schedule block.
        if (!next[key]) next[key] = key === "schedules" && typeof issue.path[1] === "number" ? `${days[payload.schedules[issue.path[1]]?.dayOfWeek ?? 0]}: ${issue.message}` : issue.message;
      }
      setErrors(next);
      setFormError("Please fix the highlighted fields.");
      return;
    }
    setErrors({});
    setSaving(true);
    const failure = await onSave(payload);
    setSaving(false);
    if (failure) {
      setFormError(failure);
      // A slug clash is reported by the server (it is the only thing only it can know).
      if (/slug/i.test(failure)) setErrors({ slug: failure });
    }
  }

  const field = (key: string, label: ReactNode, control: (props: { id: string; "aria-invalid": boolean; "aria-describedby"?: string }) => ReactNode, hint?: ReactNode) => {
    const id = `${titleId}-${key}`;
    const message = errors[key];
    return (
      <div className="form-field">
        <label htmlFor={id}>{label}</label>
        {control({ id, "aria-invalid": Boolean(message), "aria-describedby": message ? `${id}-error` : undefined })}
        {hint && <small>{hint}</small>}
        {message && <span className="field-error" id={`${id}-error`} role="alert">{message}</span>}
      </div>
    );
  };

  return (
    <Modal className="doctor-modal" labelledBy={titleId} onRequestClose={() => { if (!saving) onClose(); }}>
      <form className="modal-form" onSubmit={submit} noValidate>
        <div className="modal-heading">
          <div>
            <h2 id={titleId}>{doctor ? "Edit doctor" : "Add doctor"}</h2>
            <p>{doctor ? "Changes appear on the public website as soon as you save." : "A profile is hidden from the public website until you publish it."}</p>
          </div>
          <button type="button" className="icon-button" onClick={onClose} aria-label="Close dialog" disabled={saving}><X size={16} /></button>
        </div>

        {isPrimary && (
          <p className="doctor-note" role="note">
            This is the clinic&apos;s main profile. Its weekly hours decide when patients can book, and its phone, e-mail and address are used on report letterheads and in the website&apos;s contact section. It can be hidden but not deleted.
          </p>
        )}

        <fieldset className="doctor-fieldset">
          <legend>Profile</legend>
          <div className="form-grid">
            {field("name", "Full name *", (p) => <input {...p} required maxLength={120} autoFocus value={form.name} onChange={(event) => onNameChange(event.target.value)} />)}
            {field("designation", "Designation", (p) => <input {...p} maxLength={120} placeholder="e.g. Consultant Pathologist" value={form.designation} onChange={(event) => set("designation", event.target.value)} />)}
            {field("qualifications", "Qualifications and degrees", (p) => <input {...p} maxLength={500} placeholder="e.g. MBBS, MD (Pathology)" value={form.qualifications} onChange={(event) => set("qualifications", event.target.value)} />)}
            {field("specialization", "Specialization *", (p) => <input {...p} required maxLength={120} value={form.specialization} onChange={(event) => set("specialization", event.target.value)} />, "Separate several areas with commas.")}
            {field("experienceYears", "Experience (years)", (p) => <input {...p} type="number" inputMode="numeric" min={0} max={70} step={1} value={form.experienceYears} onChange={(event) => set("experienceYears", event.target.value)} />)}
            {field("registrationNumber", "Professional registration number", (p) => <input {...p} maxLength={80} value={form.registrationNumber} onChange={(event) => set("registrationNumber", event.target.value)} />, "Optional. Shown publicly exactly as typed, so enter only a real number.")}
          </div>
          {field("imageUrl", "Profile image address", (p) => <input {...p} type="url" inputMode="url" maxLength={2000} placeholder="https://…" value={form.imageUrl} onChange={(event) => set("imageUrl", event.target.value)} />, "A public https:// link to a square or portrait photo.")}
          {form.imageUrl.trim() && !errors.imageUrl && (
            <div className="doctor-image-preview"><DoctorAvatar key={form.imageUrl} name={form.name || "Doctor"} imageUrl={form.imageUrl.trim()} size={56} /><span>Preview</span></div>
          )}
          {field("bio", "Biography", (p) => <textarea {...p} rows={5} maxLength={3000} value={form.bio} onChange={(event) => set("bio", event.target.value)} />)}
        </fieldset>

        <fieldset className="doctor-fieldset">
          <legend>Consultation</legend>
          <div className="form-grid">
            {field("consultationFee", "Consultation fee (BDT)", (p) => <input {...p} type="number" inputMode="decimal" min={0} step="0.01" value={form.consultationFee} onChange={(event) => set("consultationFee", event.target.value)} />, "Leave at 0 to hide the fee.")}
          </div>
          {field("consultationInfo", "Consultation information", (p) => <textarea {...p} rows={3} maxLength={1000} placeholder="e.g. Appointments by serial; bring previous reports." value={form.consultationInfo} onChange={(event) => set("consultationInfo", event.target.value)} />)}
          <h3 className="clinic-subheading">Weekly hours · Asia/Dhaka</h3>
          <div className="clinic-schedule">
            {form.schedules.map((schedule) => (
              <div className="clinic-schedule-row" key={schedule.dayOfWeek}>
                <label><input type="checkbox" checked={schedule.isWorking} onChange={(event) => setSchedule(schedule.dayOfWeek, { isWorking: event.target.checked })} />{days[schedule.dayOfWeek]}</label>
                <input aria-label={`${days[schedule.dayOfWeek]} start time`} type="time" value={schedule.startTime} disabled={!schedule.isWorking} onChange={(event) => setSchedule(schedule.dayOfWeek, { startTime: event.target.value })} />
                <span>to</span>
                <input aria-label={`${days[schedule.dayOfWeek]} end time`} type="time" value={schedule.endTime} disabled={!schedule.isWorking} onChange={(event) => setSchedule(schedule.dayOfWeek, { endTime: event.target.value })} />
              </div>
            ))}
          </div>
          {errors.schedules && <span className="field-error" role="alert">{errors.schedules}</span>}
          {!isPrimary && <small className="doctor-hint">These hours are shown on this doctor&apos;s public profile. Online booking follows the clinic&apos;s main profile.</small>}
        </fieldset>

        <fieldset className="doctor-fieldset">
          <legend>Contact (not shown on doctor pages)</legend>
          <div className="form-grid">
            {field("phone", "Phone", (p) => <input {...p} type="tel" autoComplete="off" maxLength={30} value={form.phone} onChange={(event) => set("phone", event.target.value)} />)}
            {field("email", "E-mail", (p) => <input {...p} type="email" autoComplete="off" value={form.email} onChange={(event) => set("email", event.target.value)} />)}
          </div>
          {field("address", "Address", (p) => <input {...p} maxLength={1000} value={form.address} onChange={(event) => set("address", event.target.value)} />)}
        </fieldset>

        <fieldset className="doctor-fieldset">
          <legend>Publishing</legend>
          <div className="form-grid">
            {field("slug", "Web address (slug)", (p) => <input {...p} maxLength={80} spellCheck={false} autoCapitalize="none" value={form.slug} onChange={(event) => { setSlugEdited(true); set("slug", event.target.value); }} />, <>Profile page: <code>/doctors/{form.slug || "…"}</code>. Made from the name; change it if you like.</>)}
            {field("displayOrder", "Display order", (p) => <input {...p} type="number" inputMode="numeric" min={0} max={9999} step={1} value={form.displayOrder} onChange={(event) => set("displayOrder", event.target.value)} />, "Smaller numbers are listed first.")}
          </div>
          <label className="doctor-check"><input type="checkbox" checked={form.isActive} onChange={(event) => set("isActive", event.target.checked)} /> Active <small>Inactive doctors are hidden everywhere on the public website.</small></label>
          <label className="doctor-check"><input type="checkbox" checked={form.isPublished} onChange={(event) => set("isPublished", event.target.checked)} /> Published <small>Show this profile on the public website (the doctor must also be active).</small></label>
        </fieldset>

        {formError && <div className="form-error" role="alert">{formError}</div>}
        <div className="modal-actions">
          <button type="button" className="button-secondary" onClick={onClose} disabled={saving}>Cancel</button>
          <button className="button-primary" disabled={saving}><Save size={14} />{saving ? "Saving…" : doctor ? "Save changes" : "Add doctor"}</button>
        </div>
      </form>
    </Modal>
  );
}
