import type { AppointmentRecord } from "@/modules/appointments/schemas/appointment-schema";

export type Appointment = AppointmentRecord;
export type DashboardSummary = {
  totalPatients: number;
  todayAppointments: number;
  pendingAppointments: number;
  completedThisMonth: number;
  totalAppointments: number;
  sourceCounts: { direct: number; whatsapp: number };
  doctorCount: number;
  /** Present only when the signed-in role may see billing (billing:read). */
  revenue?: { today: string; week: string; month: string };
  outstanding?: string;
  weeklyAppointments: { date: string; count: number; completed: number }[];
  overview?: {
    confirmedCount: number;
    completedCount: number;
    monthAppointments: number;
    topServices: { name: string; count: number }[];
    monthly: { key: string; count: number; completed: number }[];
    yearly: { key: string; count: number; completed: number }[];
    nextAppointment: Appointment | null;
    pendingRequests: Appointment[];
    todaySchedule: Appointment[];
  };
};

export type AdminUser = {
  name: string;
  email: string;
};

export function localDateTimeValue(date: Date) {
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

export function formatRequestId(id: string) {
  return `REQ-${id.slice(-6).toUpperCase()}`;
}
