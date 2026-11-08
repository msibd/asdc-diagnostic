"use client";

import { Lock, Plus, Save, Trash2 } from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import { useConfirm } from "@/components/shared/confirm-dialog";
import { ADMIN_ONLY_PERMISSIONS, PERMISSION_GROUPS, type Permission } from "@/lib/permissions";
import { requestJson } from "@/modules/clinic/components/clinic-types";
import { useSectionLoader } from "@/modules/clinic/components/section-shared";

type RoleRow = {
  id: string; key: string; name: string; description: string; permissions: string[];
  isSystem: boolean; locked: boolean; userCount: number;
};

const sameSet = (first: string[], second: string[]) => first.length === second.length && first.every((item) => second.includes(item));
const editable = (permission: Permission) => !(ADMIN_ONLY_PERMISSIONS as readonly string[]).includes(permission);

type Draft = { forId: string; name: string; description: string; permissions: string[] };
const draftFrom = (role: RoleRow): Draft => ({ forId: role.id, name: role.name, description: role.description, permissions: role.permissions });

export default function RolesTab({ onNotice }: { onNotice: (message: string, error: boolean) => void }) {
  const { confirm, dialog: confirmDialog } = useConfirm();
  const [roles, setRoles] = useState<RoleRow[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [creating, setCreating] = useState(false);
  const [draft, setDraft] = useState<Draft>({ forId: "", name: "", description: "", permissions: [] });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  // The open role: the one picked, else the first. The editor draft follows it (reset when it changes).
  const selected = roles.find((role) => role.id === selectedId) ?? roles[0] ?? null;
  if (!creating && selected && draft.forId !== selected.id) setDraft(draftFrom(selected));
  const { name, description, permissions } = draft;
  const dirty = creating || (selected !== null && (name !== selected.name || description !== selected.description || !sameSet(permissions, selected.permissions)));

  const choose = (role: RoleRow) => {
    setCreating(false);
    setSelectedId(role.id);
    setDraft(draftFrom(role));
    setError("");
  };

  const load = useCallback(async () => {
    const result = await requestJson<{ roles: RoleRow[] }>(await fetch("/api/roles", { cache: "no-store" }));
    setRoles(result.roles);
  }, []);
  const { gate, reload } = useSectionLoader({ section: "access", load, shouldPauseLive: () => busy || dirty, softReload: true });

  const total = useMemo(() => PERMISSION_GROUPS.flatMap((group) => group.items).filter((item) => editable(item.permission)).length, []);
  const locked = selected?.locked === true && !creating;
  const setName = (value: string) => setDraft((current) => ({ ...current, name: value }));
  const setDescription = (value: string) => setDraft((current) => ({ ...current, description: value }));
  const setPermissions = (update: (current: string[]) => string[]) => setDraft((current) => ({ ...current, permissions: update(current.permissions) }));

  function toggle(permission: Permission, on: boolean) {
    setPermissions((current) => (on ? [...new Set([...current, permission])] : current.filter((item) => item !== permission)));
  }

  function toggleGroup(groupId: string, on: boolean) {
    const group = PERMISSION_GROUPS.find((entry) => entry.id === groupId);
    if (!group) return;
    const keys = group.items.map((item) => item.permission).filter(editable);
    setPermissions((current) => (on ? [...new Set([...current, ...keys])] : current.filter((item) => !keys.includes(item as Permission))));
  }

  async function save() {
    setBusy(true);
    setError("");
    try {
      const body = { name, description, permissions: permissions.filter((item) => editable(item as Permission)) };
      const result = creating
        ? await requestJson<{ role: RoleRow }>(await fetch("/api/roles", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }))
        : await requestJson<{ role: RoleRow }>(await fetch(`/api/roles/${selectedId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }));
      setCreating(false);
      setSelectedId(result.role.id);
      setDraft({ ...draftFrom(result.role), forId: result.role.id });
      onNotice(creating ? "Role created." : "Permissions saved. They apply to everyone with this role straight away.", false);
      reload();
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Unable to save the role.");
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!selected) return;
    const ok = await confirm({
      title: `Delete the ${selected.name} role?`,
      description: "This cannot be undone. A role that staff still use cannot be deleted.",
      confirmLabel: "Delete role", cancelLabel: "Keep role", destructive: true,
    });
    if (!ok) return;
    setBusy(true);
    setError("");
    try {
      await requestJson(await fetch(`/api/roles/${selected.id}`, { method: "DELETE" }));
      setSelectedId("");
      onNotice("Role deleted.", false);
      reload();
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Unable to delete the role.");
    } finally {
      setBusy(false);
    }
  }

  if (gate) return gate;

  return (
    <div className="access-roles">
      {confirmDialog}
      <section className="panel-card access-role-list">
        <header className="panel-header">
          <div><h2 className="panel-title">Roles</h2></div>
          <button className="button-secondary" onClick={() => { setCreating(true); setSelectedId(""); setDraft({ forId: "new", name: "", description: "", permissions: ["dashboard:read"] }); setError(""); }}><Plus size={14} /> New role</button>
        </header>
        <ul>
          {roles.map((role) => (
            <li key={role.id}>
              <button type="button" className={`access-role-item${!creating && role.id === selectedId ? " is-active" : ""}`} onClick={() => choose(role)} aria-pressed={!creating && role.id === selectedId}>
                <span><strong>{role.name}</strong>{role.locked && <Lock size={12} aria-label="Locked" />}</span>
                <small>{role.userCount} {role.userCount === 1 ? "person" : "people"} · {role.locked ? "all" : role.permissions.length} permissions</small>
              </button>
            </li>
          ))}
          {creating && <li><div className="access-role-item is-active"><span><strong>{name || "New role"}</strong></span><small>Not saved yet</small></div></li>}
        </ul>
      </section>

      <section className="panel-card access-role-editor">
        {(selected || creating) ? (
          <>
            <header className="panel-header">
              <div>
                <h2 className="panel-title">{creating ? "New role" : selected?.name}</h2>
                <p className="panel-description">{locked ? "The administrator always has every permission and cannot be changed." : "Tick what this role may do. Changes apply to everyone with the role immediately."}</p>
              </div>
            </header>
            <div className="modal-form">
              <div className="form-grid">
                <label className="form-field">Role name *<input value={name} onChange={(event) => setName(event.target.value)} maxLength={40} required disabled={locked} /></label>
                <label className="form-field">Description<input value={description} onChange={(event) => setDescription(event.target.value)} maxLength={240} disabled={locked} placeholder="What is this role for?" /></label>
              </div>
              <p className="access-count" aria-live="polite">{locked ? "All permissions" : `${permissions.filter((item) => editable(item as Permission)).length} of ${total} permissions selected`}</p>
              <div className="access-groups">
                {PERMISSION_GROUPS.map((group) => {
                  const items = group.items;
                  const selectable = items.filter((item) => editable(item.permission));
                  const checked = selectable.filter((item) => locked || permissions.includes(item.permission)).length;
                  const allAdminOnly = selectable.length === 0;
                  return (
                    <fieldset className="access-group" key={group.id} disabled={locked || busy}>
                      <legend>{group.label}</legend>
                      {!allAdminOnly && !locked && (
                        <label className="access-group-all">
                          <input type="checkbox" checked={checked === selectable.length} ref={(input) => { if (input) input.indeterminate = checked > 0 && checked < selectable.length; }} onChange={(event) => toggleGroup(group.id, event.target.checked)} /> Select all
                        </label>
                      )}
                      {items.map((item) => {
                        const adminOnly = !editable(item.permission);
                        return (
                          <label key={item.permission} className={`access-permission${adminOnly ? " is-locked" : ""}`}>
                            <input type="checkbox" checked={locked || (!adminOnly && permissions.includes(item.permission))} disabled={adminOnly || locked} onChange={(event) => toggle(item.permission, event.target.checked)} />
                            <span>{item.label}{adminOnly && <em> · administrator only</em>}</span>
                          </label>
                        );
                      })}
                    </fieldset>
                  );
                })}
              </div>
              {error && <div className="form-error" role="alert">{error}</div>}
              {!locked && (
                <div className="modal-actions">
                  {!creating && selected && !selected.isSystem && <button type="button" className="button-secondary" onClick={() => void remove()} disabled={busy}><Trash2 size={14} /> Delete role</button>}
                  {!creating && selected && <button type="button" className="button-secondary" onClick={() => choose(selected)} disabled={busy || !dirty}>Discard changes</button>}
                  <button type="button" className="button-primary" onClick={() => void save()} disabled={busy || !dirty || name.trim().length < 2}><Save size={14} /> {busy ? "Saving…" : creating ? "Create role" : "Save permissions"}</button>
                </div>
              )}
            </div>
          </>
        ) : <div className="empty-state">Choose a role to see what it can do.</div>}
      </section>
    </div>
  );
}
