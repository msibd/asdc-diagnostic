"use client";

import ExportButtons from "@/modules/export/components/export-buttons";
import { useCallback, useState } from "react";
import { ShieldCheck } from "lucide-react";
import { formatClinicDate } from "@/lib/clinic-date";
import { useAdminSession } from "@/components/shared/admin-session-provider";
import { useConfirm } from "@/components/shared/confirm-dialog";
import { can } from "@/lib/permissions";
import { requestJson } from "./clinic-types";
import { useSectionLoader, type SectionProps } from "./section-shared";

export default function SecuritySection({ onNotice }: SectionProps) {
  const [auditEvents, setAuditEvents] = useState<{ id: string; action: string; entity: string; entityId: string | null; createdAt: string; actor: { name: string; email: string } | null }[]>([]);
  const [sessions, setSessions] = useState<{ id: string; createdAt: string; expiresAt: string; ipAddress: string | null; userAgent: string | null }[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState("");
  const { confirm, dialog: confirmDialog } = useConfirm();
  const { user } = useAdminSession();
  // Everyone sees their own sessions; the clinic-wide audit history needs the security permission.
  const canSeeAudit = can(user.permissions, "security:manage");

  const load = useCallback(async () => {
    const [auditResult, sessionResult] = await Promise.all([
      canSeeAudit ? fetch("/api/security/audit?page=1&pageSize=50", { cache: "no-store" }).then((response) => requestJson<{ events: typeof auditEvents }>(response)) : Promise.resolve({ events: [] as typeof auditEvents }),
      requestJson<{ sessions: typeof sessions; currentSessionId: string }>(await fetch("/api/security/sessions", { cache: "no-store" })),
    ]);
    setAuditEvents(auditResult.events);
    setSessions(sessionResult.sessions);
    setCurrentSessionId(sessionResult.currentSessionId);
  }, [canSeeAudit]);

  const { gate, reload } = useSectionLoader({ section: "security", load });

  if (gate) return gate;

  return (
    <div className="clinic-module-grid">
      {confirmDialog}
      <section className="panel-card clinic-module-card security-card">
        <header className="panel-header"><div><h2 className="panel-title"><ShieldCheck size={16} /> Access controls</h2><p className="panel-description">Every page and API checks the signed-in person’s role. Staff accounts and roles are managed by the administrator under Users &amp; roles.</p></div></header>
        <ul className="clinic-security-list"><li>Protected dashboard and module APIs</li><li>Passwords managed by Better Auth; no application-side password storage</li><li>You can change your own password above and sign out other devices below</li><li>Clinical and financial create/update actions are recorded in the audit history</li></ul>
      </section>
      <section className="panel-card clinic-module-card">
        <header className="panel-header"><div><h2 className="panel-title">Active sessions</h2><p className="panel-description">Revoke sessions you no longer recognize. The current session is protected.</p></div></header>
        <div className="table-scroll"><table className="data-table"><thead><tr><th>Session</th><th>Started</th><th>Expires</th><th>IP address</th><th>Action</th></tr></thead><tbody>{sessions.map((session) => <tr key={session.id}><td>{session.id === currentSessionId ? "This device" : session.userAgent?.slice(0, 60) || "Other device"}</td><td>{formatClinicDate(session.createdAt)}</td><td>{formatClinicDate(session.expiresAt)}</td><td>{session.ipAddress ?? "Not recorded"}</td><td>{session.id === currentSessionId ? "Current" : <button className="request-action request-action-danger" onClick={async () => { if (!await confirm({ title: "Revoke this session?", description: "Whoever is using it will need to sign in again.", confirmLabel: "Revoke session", destructive: true })) return; try { await requestJson(await fetch(`/api/security/sessions/${session.id}`, { method: "DELETE" })); onNotice("Session revoked.", false); reload(); } catch (revokeError) { onNotice(revokeError instanceof Error ? revokeError.message : "Unable to revoke session.", true); } }}>Revoke</button>}</td></tr>)}{!sessions.length && <tr><td colSpan={5}>No sessions found.</td></tr>}</tbody></table></div>
      </section>
      {canSeeAudit && <section className="panel-card clinic-module-card">
        <header className="panel-header"><div><h2 className="panel-title">Audit history</h2><p className="panel-description">Latest {auditEvents.length} recorded events</p></div><ExportButtons dataset="audit-log" range /></header>
        <div className="table-scroll"><table className="data-table"><thead><tr><th>When</th><th>Actor</th><th>Action</th><th>Record</th></tr></thead><tbody>{auditEvents.map((event) => <tr key={event.id}><td>{formatClinicDate(event.createdAt)}</td><td>{event.actor?.name ?? event.actor?.email ?? "Former user"}</td><td>{event.action}</td><td>{event.entity}{event.entityId ? ` · ${event.entityId}` : ""}</td></tr>)}{!auditEvents.length && <tr><td colSpan={4}>No audit events recorded yet.</td></tr>}</tbody></table></div>
      </section>}
    </div>
  );
}
