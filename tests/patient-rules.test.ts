import { describe, expect, it } from "vitest";
import { csvCell, patientsToCsv } from "@/modules/patients/actions/export-patients";
import { firstPatientFieldError, validateDateOfBirth, validatePatientFields } from "@/modules/patients/schemas/patient-rules";
import type { PatientListRecord } from "@/modules/patients/schemas/patient-schema";

// These rules run in the registration form and on the server, so they are tested on their own.
const TODAY = new Date("2026-11-06T06:00:00Z");
const valid = { name: "Rahim Uddin", phone: "01712345678" };

describe("patient field rules", () => {
  it("accepts the minimum (name and phone) and a fully filled record", () => {
    expect(validatePatientFields(valid, TODAY)).toEqual({});
    expect(validatePatientFields({
      ...valid,
      email: "rahim@example.com",
      dateOfBirth: "1990-04-12",
      emergencyContactName: "Karima",
      emergencyContactPhone: "+880 1812-345678",
      address: "Dhaka",
      allergies: "Penicillin",
    }, TODAY)).toEqual({});
  });

  it("requires name and phone", () => {
    const errors = validatePatientFields({ name: " ", phone: "" }, TODAY);
    expect(errors.name).toMatch(/Enter/);
    expect(errors.phone).toMatch(/Enter a phone/);
  });

  it("checks name, phone and email formats", () => {
    expect(validatePatientFields({ ...valid, name: "A" }, TODAY).name).toMatch(/at least 2/);
    expect(validatePatientFields({ ...valid, name: "12345" }, TODAY).name).toMatch(/letters/);
    expect(validatePatientFields({ ...valid, phone: "0171234" }, TODAY).phone).toMatch(/valid mobile/);
    expect(validatePatientFields({ ...valid, phone: "01712-34x678" }, TODAY).phone).toMatch(/digits/);
    expect(validatePatientFields({ ...valid, email: "nope" }, TODAY).email).toMatch(/valid email/);
  });

  it("checks the date of birth", () => {
    expect(validateDateOfBirth("1990-04-12", TODAY)).toBeNull();
    expect(validateDateOfBirth("", TODAY)).toBeNull();
    expect(validateDateOfBirth("12/04/1990", TODAY)).toMatch(/year-month-day/);
    expect(validateDateOfBirth("1990-02-30", TODAY)).toMatch(/does not exist/);
    expect(validateDateOfBirth("1850-01-01", TODAY)).toMatch(/1900/);
    expect(validateDateOfBirth("2027-01-01", TODAY)).toMatch(/future/);
    expect(validateDateOfBirth("2026-11-06", TODAY)).toBeNull(); // born today is allowed
  });

  it("needs both parts of an emergency contact, or neither", () => {
    expect(validatePatientFields({ ...valid, emergencyContactName: "Karima" }, TODAY).emergencyContactPhone).toMatch(/phone number/);
    expect(validatePatientFields({ ...valid, emergencyContactPhone: "01812345678" }, TODAY).emergencyContactName).toMatch(/name/);
  });

  it("limits long text and reports the first error in form order", () => {
    const errors = validatePatientFields({ ...valid, phone: "1", allergies: "a".repeat(3001), notes: "n".repeat(5001) }, TODAY);
    expect(errors.allergies).toMatch(/3000/);
    expect(errors.notes).toMatch(/5000/);
    expect(firstPatientFieldError(errors)).toBe(errors.phone);
  });
});

describe("CSV export", () => {
  it("neutralises spreadsheet formulas", () => {
    expect(csvCell("=HYPERLINK(\"http://evil\")")).toBe("\"'=HYPERLINK(\"\"http://evil\"\")\"");
    expect(csvCell("+8801712345678")).toBe("\"'+8801712345678\"");
    expect(csvCell("-2+3")).toBe("\"'-2+3\"");
    expect(csvCell("@SUM(A1)")).toBe("\"'@SUM(A1)\"");
    expect(csvCell("Rahim \"Ovi\" Uddin")).toBe("\"Rahim \"\"Ovi\"\" Uddin\"");
  });

  it("starts with a byte-order mark so Excel reads Bangla names correctly", () => {
    const patient = {
      id: "1", patientCode: "PID-00001", name: "রহিম উদ্দিন", phone: "01712345678", email: null, isActive: true,
      createdAt: "", updatedAt: "", appointmentCount: 2, orderCount: 0, latestAppointment: null,
    } as PatientListRecord;
    const csv = patientsToCsv([patient]);
    expect(csv.startsWith("﻿")).toBe(true);
    expect(csv).toContain("রহিম উদ্দিন");
    expect(csv.split("\r\n")).toHaveLength(2);
  });
});
