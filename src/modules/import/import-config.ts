import type { Permission } from "@/lib/permissions";

// Shared by the import screen and the server: which modules can be imported, the columns each one
// understands, and the shapes of the answers. Importing only ever creates NEW records through the
// same routes the screens use; it never updates or deletes.

export const IMPORT_LIMITS = { maxBytes: 2 * 1024 * 1024, maxRows: 500 } as const;

export type ImportModule = "patients" | "inventory-items" | "tests";
export type ImportField = { key: string; label: string; required?: boolean; aliases?: string[]; hint?: string };

export const IMPORT_MODULES: Record<ImportModule, { label: string; noun: string; permission: Permission; fields: ImportField[] }> = {
  patients: {
    label: "patients",
    noun: "patient",
    permission: "patients:write",
    fields: [
      { key: "name", label: "Name", required: true, aliases: ["patient name", "full name"] },
      { key: "phone", label: "Phone", required: true, aliases: ["mobile", "mobile number", "phone number", "contact"] },
      { key: "email", label: "E-mail", aliases: ["email address"] },
      { key: "dateOfBirth", label: "Date of birth", aliases: ["dob", "birth date"], hint: "YYYY-MM-DD" },
      { key: "sex", label: "Sex", aliases: ["gender"], hint: "male, female or other" },
      { key: "address", label: "Address" },
      { key: "emergencyContactName", label: "Emergency contact name", aliases: ["emergency name"] },
      { key: "emergencyContactPhone", label: "Emergency contact phone", aliases: ["emergency phone"] },
      { key: "medicalHistory", label: "Medical history", aliases: ["history"] },
      { key: "allergies", label: "Allergies" },
      { key: "notes", label: "Notes" },
    ],
  },
  "inventory-items": {
    label: "stock items",
    noun: "item",
    permission: "inventory:write",
    fields: [
      { key: "name", label: "Item name", required: true, aliases: ["item", "product"] },
      { key: "category", label: "Category", hint: "default Reagents" },
      { key: "unit", label: "Unit", hint: "default pcs" },
      { key: "reorderLevel", label: "Reorder level", aliases: ["reorder", "minimum stock"], hint: "whole number" },
      { key: "supplier", label: "Supplier name", aliases: ["supplier name"], hint: "must already exist" },
      { key: "notes", label: "Notes" },
    ],
  },
  tests: {
    label: "tests",
    noun: "test",
    permission: "services:write",
    fields: [
      { key: "code", label: "Code", required: true, aliases: ["test code"] },
      { key: "name", label: "Name", required: true, aliases: ["test name"] },
      { key: "category", label: "Category", required: true, aliases: ["department"] },
      { key: "price", label: "Price", required: true, aliases: ["standard price", "fee"], hint: "number" },
      { key: "sampleType", label: "Sample type", aliases: ["sample", "specimen"] },
      { key: "turnaroundHours", label: "Report time (hours)", aliases: ["turnaround", "report time"], hint: "whole hours" },
      { key: "fastingRequired", label: "Fasting required", aliases: ["fasting"], hint: "yes or no" },
      { key: "preparation", label: "Patient instructions", aliases: ["instructions"] },
      { key: "description", label: "Description" },
    ],
  },
};

export const isImportModule = (value: string): value is ImportModule => value in IMPORT_MODULES;

export type ImportMode = "preview" | "commit";
export type ImportRowCheck = { line: number; values: Record<string, string>; status: "valid" | "invalid" | "duplicate"; errors: string[] };
export type ImportRowOutcome = { line: number; values: Record<string, string>; status: "imported" | "skipped" | "failed"; message: string };

export type ImportPreview = {
  mode: "preview";
  summary: { total: number; valid: number; invalid: number; duplicate: number };
  /** Rows that need attention (invalid or duplicate), first 200. */
  problems: ImportRowCheck[];
  truncated: boolean;
};

export type ImportResult = {
  mode: "commit";
  summary: { total: number; imported: number; skipped: number; failed: number };
  /** Rows that were not imported, first 200. */
  problems: ImportRowOutcome[];
  truncated: boolean;
};
