import { describe, expect, it } from "vitest";
import {
  firstFieldError,
  validateAppointmentFields,
  validateEmail,
  validatePatientName,
  validatePhone,
} from "@/modules/appointments/schemas/appointment-rules";

// These rules run in the browser form and on the server, so they are tested on their own.
const NOW = Date.parse("2026-11-06T06:00:00Z");
const valid = {
  patientName: "Rahim Uddin",
  patientPhone: "01712345678",
  patientEmail: "",
  service: "Scaling",
  dateTime: "2026-11-10T04:00:00.000Z",
  notes: "",
};

describe("appointment field rules", () => {
  it("accepts a complete, valid appointment", () => {
    expect(validateAppointmentFields(valid, { rejectPast: true, now: NOW })).toEqual({});
  });

  it("requires name and phone unless a patient is linked", () => {
    const blank = { ...valid, patientName: "", patientPhone: "" };
    const errors = validateAppointmentFields(blank, { rejectPast: true, now: NOW });
    expect(errors.patientName).toBeTruthy();
    expect(errors.patientPhone).toBeTruthy();
    expect(validateAppointmentFields({ ...blank, patientId: "p1" }, { rejectPast: true, now: NOW })).toEqual({});
  });

  it("checks names", () => {
    expect(validatePatientName("A", true)).toMatch(/at least 2/);
    expect(validatePatientName("1234", true)).toMatch(/letters/);
    expect(validatePatientName("x".repeat(121), true)).toMatch(/120/);
    expect(validatePatientName("রহিম উদ্দিন", true)).toBeNull();
  });

  it("checks Bangladeshi mobile numbers and allows common formatting", () => {
    expect(validatePhone("01712345678", true)).toBeNull();
    expect(validatePhone("+880 1712-345678", true)).toBeNull();
    expect(validatePhone("8801712345678", true)).toBeNull();
    expect(validatePhone("01212345678", true)).toMatch(/valid mobile/); // 012 is not a mobile prefix
    expect(validatePhone("0171234", true)).toMatch(/valid mobile/); // too short
    expect(validatePhone("abc", true)).toMatch(/digits/);
  });

  it("accepts other countries by length", () => {
    expect(validatePhone("+14155550123", true)).toBeNull();
    expect(validatePhone("12345", true)).toMatch(/7 to 15/);
  });

  it("checks email only when given", () => {
    expect(validateEmail("")).toBeNull();
    expect(validateEmail("name@example.com")).toBeNull();
    expect(validateEmail("not-an-email")).toMatch(/valid email/);
  });

  it("rejects past times only when asked, and bookings more than a year out", () => {
    const past = { ...valid, dateTime: "2026-11-01T04:00:00.000Z" };
    expect(validateAppointmentFields(past, { rejectPast: true, now: NOW }).dateTime).toMatch(/future/);
    expect(validateAppointmentFields(past, { rejectPast: false, now: NOW }).dateTime).toBeUndefined();
    const far = { ...valid, dateTime: "2028-01-01T04:00:00.000Z" };
    expect(validateAppointmentFields(far, { rejectPast: true, now: NOW }).dateTime).toMatch(/365 days/);
    expect(validateAppointmentFields({ ...valid, dateTime: "" }, { rejectPast: true, now: NOW }).dateTime).toMatch(/Choose a date/);
  });

  it("limits notes and reports the first error in form order", () => {
    const errors = validateAppointmentFields(
      { ...valid, patientEmail: "bad", notes: "n".repeat(2001) },
      { rejectPast: true, now: NOW },
    );
    expect(errors.notes).toMatch(/2000/);
    expect(firstFieldError(errors)).toMatch(/valid email/);
  });
});
