"use client";

import { createContext, useContext, type ReactNode } from "react";

export type AdminIdentity = {
  name: string;
  email: string;
  role: string;
  /** Display name of the role, e.g. "Receptionist". */
  roleName: string;
  /** What this account may do (decided by the server); the UI only uses it to hide what would be refused. */
  permissions: string[];
};

type AdminSessionValue = {
  user: AdminIdentity;
  todayLabel: string;
  now: string;
};

const AdminSessionContext = createContext<AdminSessionValue | null>(null);

export default function AdminSessionProvider({
  children,
  user,
  todayLabel,
  now,
}: AdminSessionValue & { children: ReactNode }) {
  return (
    <AdminSessionContext.Provider value={{ user, todayLabel, now }}>
      {children}
    </AdminSessionContext.Provider>
  );
}

export function useAdminSession() {
  const value = useContext(AdminSessionContext);
  if (!value) {
    throw new Error("AdminSessionProvider is missing from the dashboard layout.");
  }
  return value;
}
