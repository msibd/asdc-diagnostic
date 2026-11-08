"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { X } from "lucide-react";
import { useEffect } from "react";
import { useForm, useWatch, type UseFormRegisterReturn } from "react-hook-form";
import Modal from "@/components/shared/modal";
import {
  PATIENT_LIMITS,
  type PatientField,
  type PatientFieldErrors,
} from "@/modules/patients/schemas/patient-rules";
import { patientFormSchema, type PatientFormValues } from "@/modules/patients/schemas/patient-schema";

export type { PatientFormValues };

export const emptyPatientForm: PatientFormValues = {
  name: "",
  phone: "",
  email: "",
  dateOfBirth: "",
  sex: "",
  address: "",
  emergencyContactName: "",
  emergencyContactPhone: "",
  medicalHistory: "",
  allergies: "",
  notes: "",
};

type FieldProps = {
  field: PatientField;
  label: string;
  registration: UseFormRegisterReturn;
  error?: string;
  /** Current length, for the counter under long text fields. */
  length?: number;
  required?: boolean;
  type?: string;
  multiline?: boolean;
  rows?: number;
  max?: number;
  hint?: string;
  placeholder?: string;
  inputMode?: "tel" | "email" | "text";
  autoComplete?: string;
};

function FormField({ field, label, registration, error, length, required, type = "text", multiline, rows = 3, max, hint, placeholder, inputMode, autoComplete = "off" }: FieldProps) {
  const id = `patient-${field}`;
  const describedBy = [error ? `${id}-error` : "", hint ? `${id}-hint` : ""].filter(Boolean).join(" ") || undefined;
  const shared = {
    id,
    placeholder,
    autoComplete,
    "aria-invalid": error ? true : undefined,
    "aria-describedby": describedBy,
    ...registration,
  } as const;
  return (
    <div className="form-field">
      <label htmlFor={id}>{label}{required ? " *" : ""}</label>
      {multiline
        ? <textarea {...shared} rows={rows} maxLength={max} />
        : <input {...shared} type={type} inputMode={inputMode} />}
      {error && <small className="field-error" id={`${id}-error`} role="alert">{error}</small>}
      {hint && !error && <small id={`${id}-hint`}>{hint}</small>}
      {multiline && max !== undefined && <small className="field-counter">{length ?? 0} / {max}</small>}
    </div>
  );
}

/** Age in whole years for a valid birth date, or null. Shown beside the date as a quick sanity check. */
function ageFrom(dateOfBirth: string): number | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateOfBirth)) return null;
  const born = new Date(`${dateOfBirth}T00:00:00.000Z`);
  if (!Number.isFinite(born.getTime())) return null;
  const now = new Date();
  let age = now.getUTCFullYear() - born.getUTCFullYear();
  if (now.getUTCMonth() < born.getUTCMonth() || (now.getUTCMonth() === born.getUTCMonth() && now.getUTCDate() < born.getUTCDate())) age -= 1;
  return age >= 0 && age < 150 ? age : null;
}

function PatientFormBody({
  initial,
  saving,
  serverError,
  serverFieldErrors,
  submitLabel,
  onSubmit,
  onClose,
}: {
  initial: PatientFormValues;
  saving: boolean;
  serverError: string;
  serverFieldErrors: PatientFieldErrors;
  submitLabel: string;
  onSubmit: (values: PatientFormValues) => void;
  onClose: () => void;
}) {
  // The same rules as the API (patient-rules.ts). A field is checked once it has been left, then
  // on every change; submitting checks everything and focuses the first problem.
  const { register, handleSubmit, setError, control, formState: { errors } } = useForm<PatientFormValues>({
    resolver: zodResolver(patientFormSchema),
    defaultValues: initial,
    mode: "onTouched",
  });

  // Problems only the server can find (e.g. a duplicate patient) appear beside their field and
  // clear as soon as that field is checked again.
  useEffect(() => {
    for (const [field, message] of Object.entries(serverFieldErrors)) {
      if (message) setError(field as PatientField, { type: "server", message });
    }
  }, [serverFieldErrors, setError]);

  // Live values for the counters and the age hint (useWatch re-renders only this form).
  const values = useWatch({ control });
  const age = ageFrom(values.dateOfBirth ?? "");

  const field = (key: PatientField, label: string, extra: Partial<FieldProps> = {}) => (
    <FormField field={key} label={label} registration={register(key)} error={errors[key]?.message} length={values[key]?.length} {...extra} />
  );

  return (
    <form className="modal-form patient-form" noValidate onSubmit={handleSubmit(onSubmit)} aria-describedby={serverError ? "patient-form-error" : undefined}>
      <fieldset className="patient-form-section">
        <legend>Basic information</legend>
        <div className="form-grid">
          {field("name", "Full name", { required: true })}
          {field("phone", "Phone", { required: true, type: "tel", inputMode: "tel", placeholder: "01XXXXXXXXX" })}
          {field("email", "Email", { type: "email", inputMode: "email", placeholder: "name@example.com" })}
          {field("dateOfBirth", "Date of birth", { type: "date", hint: age !== null ? `Age ${age}` : undefined })}
          <div className="form-field">
            <label htmlFor="patient-sex">Sex</label>
            <select id="patient-sex" {...register("sex")}>
              <option value="">Not recorded</option>
              <option value="MALE">Male</option>
              <option value="FEMALE">Female</option>
              <option value="OTHER">Other</option>
            </select>
            <small>Used to pick the right normal range on lab reports.</small>
          </div>
        </div>
      </fieldset>
      <fieldset className="patient-form-section">
        <legend>Emergency contact</legend>
        <div className="form-grid">
          {field("emergencyContactName", "Contact name")}
          {field("emergencyContactPhone", "Contact phone", { type: "tel", inputMode: "tel", placeholder: "01XXXXXXXXX" })}
        </div>
      </fieldset>
      <fieldset className="patient-form-section">
        <legend>Address and history</legend>
        {field("address", "Address", { multiline: true, rows: 2, max: PATIENT_LIMITS.address })}
        {field("allergies", "Allergies", { multiline: true, rows: 2, max: PATIENT_LIMITS.allergies, hint: "For example penicillin, latex or local anaesthetic." })}
        {field("medicalHistory", "Medical history", { multiline: true, max: PATIENT_LIMITS.medicalHistory })}
        {field("notes", "Notes", { multiline: true, max: PATIENT_LIMITS.notes })}
      </fieldset>
      {serverError && <div className="form-error" id="patient-form-error" role="alert">{serverError}</div>}
      <div className="modal-actions">
        <button type="button" className="button-secondary" onClick={onClose} disabled={saving}>Cancel</button>
        <button type="submit" className="button-primary" disabled={saving}>{saving ? "Saving…" : submitLabel}</button>
      </div>
    </form>
  );
}

export default function PatientFormModal({
  editing,
  initial,
  loading,
  saving,
  serverError,
  serverFieldErrors,
  onSubmit,
  onClose,
}: {
  editing: boolean;
  /** null while an existing patient's profile is still loading. */
  initial: PatientFormValues | null;
  loading: boolean;
  saving: boolean;
  serverError: string;
  serverFieldErrors: PatientFieldErrors;
  onSubmit: (values: PatientFormValues) => void;
  onClose: () => void;
}) {
  return (
    <Modal className="patient-modal" labelledBy="patient-form-title" onRequestClose={() => { if (!saving) onClose(); }}>
      <div className="modal-heading">
        <div>
          <h2 id="patient-form-title">{editing ? "Edit patient profile" : "Register patient"}</h2>
          <p>Patient information is stored in the clinic database. Fields marked * are required.</p>
        </div>
        <button type="button" className="icon-button" onClick={onClose} disabled={saving} aria-label="Close form">
          <X size={16} />
        </button>
      </div>
      {loading || !initial ? (
        serverError
          ? <div className="modal-form"><div className="form-error" role="alert">{serverError}</div></div>
          : <div className="loading-state" role="status">Loading patient profile…</div>
      ) : (
        <PatientFormBody
          initial={initial}
          saving={saving}
          serverError={serverError}
          serverFieldErrors={serverFieldErrors}
          submitLabel={editing ? "Save changes" : "Register patient"}
          onSubmit={onSubmit}
          onClose={onClose}
        />
      )}
    </Modal>
  );
}
