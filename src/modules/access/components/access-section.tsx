"use client";

import { useState } from "react";
import { useAdminSession } from "@/components/shared/admin-session-provider";
import { can } from "@/lib/permissions";
import RolesTab from "./roles-tab";
import UsersTab from "./users-tab";

export default function AccessSection({ onNotice }: { onNotice: (message: string, error: boolean) => void }) {
  const { user } = useAdminSession();
  const canRoles = can(user.permissions, "roles:manage");
  const [tab, setTab] = useState<"users" | "roles">("users");
  const tabs = [{ id: "users" as const, label: "Staff accounts" }, ...(canRoles ? [{ id: "roles" as const, label: "Roles & permissions" }] : [])];

  return (
    <div className="inventory-section">
      <div className="wc-tabs" role="tablist" aria-label="Access control">
        {tabs.map((item) => (
          <button key={item.id} type="button" role="tab" id={`acc-tab-${item.id}`} aria-selected={tab === item.id} aria-controls={`acc-panel-${item.id}`} className={`wc-tab${tab === item.id ? " is-active" : ""}`} onClick={() => setTab(item.id)}>{item.label}</button>
        ))}
      </div>
      <div role="tabpanel" id={`acc-panel-${tab}`} aria-labelledby={`acc-tab-${tab}`} className="inventory-panel">
        {tab === "users" ? <UsersTab onNotice={onNotice} /> : <RolesTab onNotice={onNotice} />}
      </div>
    </div>
  );
}
