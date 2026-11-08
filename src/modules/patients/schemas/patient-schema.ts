import { z } from "zod";

import { validatePatientFields, type PatientFieldErrors } from "@/modules/patients/schemas/patient-rules";

// Everything is checked by the shared rules in patient-rules.ts (the same ones the form runs), so
// the base shape only needs to say "text or empty". Blank optional fields are stored as null.
const looseText = z.preprocess(
  (value) => (value === undefined ? null : value),
  z.string({ error: "This field must be text." }).nullable(),
);

// Optional. Blank means "not recorded"; anything else must be one of the three choices.
const sexField = z.preprocess(
  (value) => (value === undefined || value === "" ? null : value),
  z.enum(["MALE", "FEMALE", "OTHER"], { error: "Choose male, female or other." }).nullable(),
);

export const patientInputSchema = z
  .object({
    name: z.string({ error: "Enter the patient's name." }),
    phone: z.string({ error: "Enter a phone number." }),
    email: looseText,
    dateOfBirth: looseText,
    sex: sexField,
    address: looseText,
    emergencyContactName: looseText,
    emergencyContactPhone: looseText,
    medicalHistory: looseText,
    allergies: looseText,
    notes: looseText,
  })
  .superRefine((value, context) => {
    const errors = validatePatientFields(value);
    for (const [field, message] of Object.entries(errors)) {
      context.addIssue({ code: "custom", path: [field], message });
    }
  })
  .transform((value) => {
    const blankToNull = (text: string | null) => text?.trim() || null;
    return {
      name: value.name.trim(),
      phone: value.phone.trim(),
      email: blankToNull(value.email),
      dateOfBirth: blankToNull(value.dateOfBirth),
      sex: value.sex,
      address: blankToNull(value.address),
      emergencyContactName: blankToNull(value.emergencyContactName),
      emergencyContactPhone: blankToNull(value.emergencyContactPhone),
      medicalHistory: blankToNull(value.medicalHistory),
      allergies: blankToNull(value.allergies),
      notes: blankToNull(value.notes),
    };
  });

/**
 * The same rules for the browser form (React Hook Form + zodResolver), where every field is text.
 * Using the shared rules keeps the form and the API in agreement message for message.
 */
const formText = z.string();
export const patientFormSchema = z
  .object({
    name: formText, phone: formText, email: formText, dateOfBirth: formText, sex: formText.optional(), address: formText,
    emergencyContactName: formText, emergencyContactPhone: formText, medicalHistory: formText,
    allergies: formText, notes: formText,
  })
  .superRefine((value, context) => {
    for (const [field, message] of Object.entries(validatePatientFields(value))) {
      context.addIssue({ code: "custom", path: [field], message });
    }
  });
export type PatientFormValues = z.infer<typeof patientFormSchema>;

/** Field-by-field messages for a failed parse, for the API to return next to `error`. */
export function patientFieldErrors(error: z.ZodError): PatientFieldErrors {
  const errors: PatientFieldErrors = {};
  for (const issue of error.issues) {
    const field = issue.path[0] as keyof PatientFieldErrors | undefined;
    if (field && !errors[field]) errors[field] = issue.message;
  }
  return errors;
}

export type PatientInput = z.infer<typeof patientInputSchema>;

export type PatientRecord = {
  id: string;
  patientCode: string;
  name: string;
  phone: string;
  isActive: boolean;
  email: string | null;
  dateOfBirth: string | null;
  sex: "MALE" | "FEMALE" | "OTHER" | null;
  address: string | null;
  emergencyContactName: string | null;
  emergencyContactPhone: string | null;
  medicalHistory: string | null;
  allergies: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  appointmentCount: number;
  latestAppointment: { dateTime: string; service: string } | null;
};

export type PatientListRecord = Omit<
  PatientRecord,
  "dateOfBirth" | "sex" | "address" | "emergencyContactName" | "emergencyContactPhone" | "medicalHistory" | "allergies" | "notes"
> & { orderCount: number };
