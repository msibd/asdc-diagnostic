"use client";

import { KeyRound, Pencil, Plus, UserCheck, UserX, X } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState, type FormEvent } from "react";
import DataTable, { dataTableColumns } from "@/components/shared/data-table";
import Modal from "@/components/shared/modal";
import type { QueryMeta } from "@/components/shared/query-provider";
import { formatClinicDate } from "@/lib/clinic-date";
import { requestJson } from "@/modules/clinic/components/clinic-types";

type UserRow = {
  id: string; name: string; email: string; phone: string | null; role: string; roleName: string; isActive: boolean;
  createdAt: string; lastActiveAt: string | null;
};
type RoleOption = { key: string; name: string };
type Dialog = { kind: "create" } | { kind: "edit"; user: UserRow } | { kind: "password"; user: UserRow } | null;

const when = (value: string | null) => (value ? formatClinicDate(value) : "Never");
const column = dataTableColumns<UserRow>();
const USERS_KEY = ["access", "users"] as const;
const meta: QueryMeta = { tables: ["user", "Role", "session"] };

/** A readable random password the administrator can hand over (no look-alike characters). */
function suggestPassword() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
  const bytes = crypto.getRandomValues(new Uint8Array(14));
  return Array.from(bytes, (byte) => alphabet[byte % alphabet.length]).join("");
}

export default function UsersTab({ onNotice }: { onNotice: (message: string, error: boolean) => void }) {
  const [dialog, setDialog] = useState<Dialog>(null);
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [shown, setShown] = useState<{ email: string; password: string } | null>(null);

  const queryClient = useQueryClient();
  const usersQuery = useQuery({
    queryKey: USERS_KEY,
    queryFn: async ({ signal }) => requestJson<{ users: UserRow[]; roles: RoleOption[]; currentUserId: string }>(await fetch("/api/users", { cache: "no-store", signal })),
    meta,
  });
  const users = useMemo(() => usersQuery.data?.users ?? [], [usersQuery.data]);
  const roles = usersQuery.data?.roles ?? [];
  const currentUserId = usersQuery.data?.currentUserId ?? "";
  // Any account change also changes the member counts on the Roles tab, so refresh all of "access".
  const mutation = useMutation({
    mutationFn: async ({ url, method, body }: { url: string; method: "POST" | "PATCH"; body: unknown }) =>
      requestJson(await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["access"] }),
  });
  const busy = mutation.isPending;
  const { mutate } = mutation;

  function send(url: string, method: "POST" | "PATCH", body: unknown, success: string, reveal?: { email: string; password: string }) {
    setError("");
    mutate({ url, method, body }, {
      onSuccess: () => { setDialog(null); setShown(reveal ?? null); onNotice(success, false); },
      onError: (failure) => setError(failure instanceof Error ? failure.message : "Unable to save."),
    });
  }

  const columns = useMemo(() => column.columns([
    column.accessor((user) => `${user.name} ${user.email} ${user.phone ?? ""}`, {
      id: "person",
      header: "Person and contact",
      sortFn: (a, b) => a.original.name.localeCompare(b.original.name),
      cell: ({ row: { original: user } }) => (
        <>
          <strong>{user.name}{user.id === currentUserId && <span className="access-you">You</span>}</strong>
          <div className="cell-secondary"><a href={`mailto:${user.email}`}>{user.email}</a></div>
          <div className="cell-secondary">{user.phone ? <a href={`tel:${user.phone}`}>{user.phone}</a> : "No mobile number"}</div>
        </>
      ),
    }),
    column.accessor("roleName", {
      header: "Role",
      cell: ({ row: { original: user } }) => <span className={`access-role access-role-${user.role === "admin" ? "admin" : "other"}`}>{user.roleName}</span>,
    }),
    column.accessor((user) => (user.isActive ? 0 : 1), {
      id: "status",
      header: "Status",
      enableGlobalFilter: false,
      cell: ({ row: { original: user } }) => <span className={`invoice-status ${user.isActive ? "invoice-status-paid" : "invoice-status-void"}`}>{user.isActive ? "Active" : "Deactivated"}</span>,
    }),
    column.accessor((user) => user.lastActiveAt ?? "", { id: "lastActive", header: "Last active", enableGlobalFilter: false, cell: ({ row: { original: user } }) => when(user.lastActiveAt) }),
    column.display({
      id: "actions",
      header: "Actions",
      cell: ({ row: { original: user } }) => {
        const isSelf = user.id === currentUserId;
        return (
          <div className="inventory-row-actions">
            <button type="button" className="request-action" onClick={() => open({ kind: "edit", user })}><Pencil size={12} /> Edit</button>
            {!isSelf && <button type="button" className="request-action" onClick={() => open({ kind: "password", user })}><KeyRound size={12} /> Reset password</button>}
            {!isSelf && (user.isActive
              ? <button type="button" className="request-action request-action-danger" onClick={() => send(`/api/users/${user.id}`, "PATCH", { isActive: false }, `${user.name} was deactivated and signed out.`)}><UserX size={12} /> Deactivate</button>
              : <button type="button" className="request-action" onClick={() => send(`/api/users/${user.id}`, "PATCH", { isActive: true }, `${user.name} can sign in again.`)}><UserCheck size={12} /> Activate</button>)}
          </div>
        );
      },
    }),
  // open/send only use state setters and the stable `mutate`, so the columns depend on the signed-in user alone.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  ]), [currentUserId]);

  function open(next: Dialog) {
    setError("");
    setPassword(next?.kind === "create" || next?.kind === "password" ? suggestPassword() : "");
    setDialog(next);
  }

  function submitCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const email = String(data.get("email") ?? "");
    send("/api/users", "POST", { name: String(data.get("name") ?? ""), email, phone: String(data.get("phone") ?? ""), role: String(data.get("role") ?? ""), password }, "Account created.", { email, password });
  }

  if (usersQuery.isPending) return <div className="loading-state" role="status">Loading staff accounts…</div>;
  if (usersQuery.isError) return <section className="panel-card patient-load-error" role="alert">{usersQuery.error.message}<button className="button-secondary" onClick={() => void usersQuery.refetch()}>Retry</button></section>;
  const active = users.filter((user) => user.isActive).length;

  return (
    <section className="panel-card clinic-module-card">
      <header className="panel-header">
        <div><h2 className="panel-title">Staff accounts</h2><p className="panel-description">{active} active of {users.length}. Each person gets a role that decides what they can see and do.</p></div>
        <button className="button-primary" onClick={() => open({ kind: "create" })}><Plus size={14} /> Add staff</button>
      </header>

      {shown && (
        <div className="access-credentials" role="status">
          <div>
            <strong>Give these sign-in details to the new person</strong>
            <p>E-mail: <code>{shown.email}</code> · Password: <code>{shown.password}</code></p>
            <small>This password is shown only now. They can change it from the Security page after signing in.</small>
          </div>
          <button type="button" className="button-secondary" onClick={() => setShown(null)}>Done</button>
        </div>
      )}

      <div className="inventory-toolbar px-5">
        <label className="form-field">Search<input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Name, e-mail, phone or role" /></label>
      </div>
      <DataTable
        data={users}
        columns={columns}
        search={search}
        caption="Staff accounts"
        getRowId={(user) => user.id}
        rowClassName={(user) => (user.isActive ? undefined : "expense-voided")}
        emptyMessage={users.length ? "No accounts match the search." : "No accounts yet."}
      />
      {error && !dialog && <div className="form-error" role="alert">{error}</div>}

      {dialog && (
        <Modal labelledBy="access-dialog-title" onRequestClose={() => { if (!busy) setDialog(null); }}>
          <form
            className="modal-form"
            onSubmit={(event) => {
              if (dialog.kind === "create") return submitCreate(event);
              event.preventDefault();
              const data = new FormData(event.currentTarget);
              if (dialog.kind === "password") send(`/api/users/${dialog.user.id}/password`, "POST", { password }, `Password changed for ${dialog.user.name}. They were signed out.`, { email: dialog.user.email, password });
              else send(`/api/users/${dialog.user.id}`, "PATCH", { name: String(data.get("name") ?? ""), email: String(data.get("email") ?? ""), phone: String(data.get("phone") ?? ""), ...(dialog.user.id === currentUserId ? {} : { role: String(data.get("role") ?? "") }) }, "Account updated.");
            }}
          >
            <div className="modal-heading">
              <div>
                <h2 id="access-dialog-title">{dialog.kind === "create" ? "Add staff" : dialog.kind === "edit" ? "Edit account" : "Reset password"}</h2>
                <p>{dialog.kind === "create" ? "Create a sign-in for a new team member." : dialog.kind === "edit" ? "Name, contact details and role." : `Set a new password for ${dialog.user.name}. They will be signed out everywhere.`}</p>
              </div>
              <button type="button" className="icon-button" onClick={() => setDialog(null)} aria-label="Close dialog" disabled={busy}><X size={16} /></button>
            </div>
            {dialog.kind !== "password" && (
              <div className="form-grid">
                <label className="form-field">Name *<input name="name" required minLength={2} maxLength={80} autoFocus defaultValue={dialog.kind === "edit" ? dialog.user.name : ""} /></label>
                <label className="form-field">E-mail * (used to sign in)<input name="email" type="email" required maxLength={160} autoComplete="off" defaultValue={dialog.kind === "edit" ? dialog.user.email : ""} /></label>
                <label className="form-field">Mobile number{dialog.kind === "create" ? " *" : ""}<input name="phone" type="tel" inputMode="tel" required={dialog.kind === "create"} maxLength={30} placeholder="01XXXXXXXXX" autoComplete="off" defaultValue={dialog.kind === "edit" ? dialog.user.phone ?? "" : ""} /></label>
                <label className="form-field">Role *
                  <select name="role" required defaultValue={dialog.kind === "edit" ? dialog.user.role : "receptionist"} disabled={dialog.kind === "edit" && dialog.user.id === currentUserId}>
                    {roles.map((role) => <option key={role.key} value={role.key}>{role.name}</option>)}
                  </select>
                  {dialog.kind === "edit" && dialog.user.id === currentUserId && <small>You cannot change your own role.</small>}
                </label>
              </div>
            )}
            {dialog.kind !== "edit" && (
              <label className="form-field">{dialog.kind === "create" ? "Starting password *" : "New password *"}
                <div className="access-password">
                  <input value={password} onChange={(event) => setPassword(event.target.value)} required minLength={10} maxLength={128} autoComplete="new-password" spellCheck={false} />
                  <button type="button" className="button-secondary" onClick={() => setPassword(suggestPassword())}>Generate</button>
                </div>
                <small>At least 10 characters. Share it privately; it is shown only once.</small>
              </label>
            )}
            {error && <div className="form-error" role="alert">{error}</div>}
            <div className="modal-actions">
              <button type="button" className="button-secondary" onClick={() => setDialog(null)} disabled={busy}>Cancel</button>
              <button className="button-primary" disabled={busy}>{busy ? "Saving…" : dialog.kind === "create" ? "Create account" : dialog.kind === "edit" ? "Save changes" : "Reset password"}</button>
            </div>
          </form>
        </Modal>
      )}
    </section>
  );
}
