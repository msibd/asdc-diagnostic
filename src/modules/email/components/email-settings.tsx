"use client";

import { AlertTriangle, CheckCircle2, Info, Mail, PlugZap, Save, Send, XCircle } from "lucide-react";
import { useCallback, useState, type FormEvent } from "react";
import { requestJson } from "@/modules/clinic/components/clinic-types";
import { useSectionLoader } from "@/modules/clinic/components/section-shared";

type Settings = {
  provider: "gmail" | "custom"; host: string; port: number; secure: boolean; authMethod: "APP_PASSWORD" | "PASSWORD";
  username: string; senderEmail: string; senderName: string; passwordSet: boolean; enabled: boolean;
  lastTestAt: string | null; lastTestStatus: string | null; lastTestMessage: string | null; updatedAt: string | null;
};
type HistoryRow = { id: string; action: string; status: string; recipient: string | null; message: string | null; createdAt: string; actor: string | null };
type Form = Omit<Settings, "passwordSet" | "lastTestAt" | "lastTestStatus" | "lastTestMessage" | "updatedAt"> & { password: string };

const GMAIL = { host: "smtp.gmail.com", port: 465, secure: true };
const ACTION_LABELS: Record<string, string> = {
  SETTINGS_UPDATED: "Settings saved", CONNECTION_TEST: "Connection test", TEST_EMAIL: "Test e-mail",
  PASSWORD_RESET_OTP: "Reset code sent", PASSWORD_CHANGED_NOTICE: "Password-changed notice", PASSWORD_RESET_LOCKED: "Reset code cancelled",
};
const when = (value: string) => new Intl.DateTimeFormat("en", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit", timeZone: "Asia/Dhaka" }).format(new Date(value));
const toForm = (settings: Settings): Form => ({
  provider: settings.provider, host: settings.host, port: settings.port, secure: settings.secure, authMethod: settings.authMethod,
  username: settings.username, senderEmail: settings.senderEmail, senderName: settings.senderName, enabled: settings.enabled, password: "",
});

export default function EmailSettings({ onNotice }: { onNotice: (message: string, error: boolean) => void }) {
  const [saved, setSaved] = useState<Settings | null>(null);
  const [form, setForm] = useState<Form | null>(null);
  const [history, setHistory] = useState<HistoryRow[]>([]);
  const [encryptionOk, setEncryptionOk] = useState(true);
  const [testTo, setTestTo] = useState("");
  const [busy, setBusy] = useState<"" | "save" | "connect" | "send">("");
  const [error, setError] = useState("");
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);

  const load = useCallback(async () => {
    const [settings, log] = await Promise.all([
      requestJson<{ settings: Settings; encryptionConfigured: boolean }>(await fetch("/api/email/settings", { cache: "no-store" })),
      requestJson<{ history: HistoryRow[] }>(await fetch("/api/email/history", { cache: "no-store" })),
    ]);
    setSaved(settings.settings);
    setEncryptionOk(settings.encryptionConfigured);
    setHistory(log.history);
    // Fill the form on the first load only, so a refresh never wipes what is being typed.
    setForm((current) => current ?? toForm(settings.settings));
  }, []);
  const { gate, reload } = useSectionLoader({ section: "email", load, shouldPauseLive: () => busy !== "", softReload: true });

  if (gate) return gate;
  if (!saved || !form) return null;

  const set = <K extends keyof Form>(key: K, value: Form[K]) => setForm((current) => (current ? { ...current, [key]: value } : current));
  const connectionDirty = form.host !== saved.host || form.port !== saved.port || form.secure !== saved.secure || form.authMethod !== saved.authMethod
    || form.username !== saved.username || form.password !== "";
  const dirty = connectionDirty || form.senderEmail !== saved.senderEmail || form.senderName !== saved.senderName || form.enabled !== saved.enabled;
  const testedOk = saved.lastTestStatus === "SUCCESS" && !connectionDirty;
  const canTest = saved.passwordSet && !connectionDirty;

  function chooseProvider(provider: "gmail" | "custom") {
    setForm((current) => (current ? { ...current, provider, ...(provider === "gmail" ? { ...GMAIL, authMethod: "APP_PASSWORD" as const, enabled: false } : { enabled: false }) } : current));
  }

  async function post<T>(url: string, body?: unknown) {
    return requestJson<T>(await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: body ? JSON.stringify(body) : undefined }));
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!form) return;
    setBusy("save");
    setError("");
    setResult(null);
    try {
      const response = await requestJson<{ settings: Settings }>(await fetch("/api/email/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        // A blank password means "keep the saved one"; it is never sent back by the server.
        body: JSON.stringify({ ...form, enabled: form.enabled && !connectionDirty, password: form.password || undefined }),
      }));
      setSaved(response.settings);
      setForm(toForm(response.settings));
      onNotice("E-mail settings saved.", false);
      reload();
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Unable to save.");
    } finally {
      setBusy("");
    }
  }

  async function runConnect() {
    setBusy("connect");
    setError("");
    setResult(null);
    try {
      const response = await post<{ ok: boolean; message: string; settings: Settings }>("/api/email/test-connection");
      setSaved(response.settings);
      setResult({ ok: response.ok, message: response.message });
      reload();
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "The test could not run.");
    } finally {
      setBusy("");
    }
  }

  async function runSend(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy("send");
    setError("");
    setResult(null);
    try {
      const response = await post<{ ok: boolean; message: string; settings: Settings }>("/api/email/test-send", { to: testTo });
      setSaved(response.settings);
      setResult({ ok: response.ok, message: response.ok ? `${response.message} Check the inbox (and spam folder) of ${testTo}.` : response.message });
      reload();
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "The test e-mail could not be sent.");
    } finally {
      setBusy("");
    }
  }

  return (
    <div className="email-settings">
      {!encryptionOk && (
        <div className="email-banner email-banner-bad" role="alert">
          <AlertTriangle size={16} />
          <span>The server has no <code>EMAIL_ENCRYPTION_KEY</code>, so the SMTP password cannot be stored. Set it in the server environment and restart.</span>
        </div>
      )}

      <section className="panel-card clinic-module-card">
        <header className="panel-header">
          <div><h2 className="panel-title">Status</h2><p className="panel-description">E-mail is used for password recovery codes. It stays off until a connection test succeeds.</p></div>
          <span className={`invoice-status ${saved.enabled ? "invoice-status-paid" : "invoice-status-void"}`}>{saved.enabled ? "E-mail service on" : "E-mail service off"}</span>
        </header>
        <dl className="email-status">
          <div><dt>SMTP password</dt><dd>{saved.passwordSet ? "Saved (encrypted, never shown)" : "Not set"}</dd></div>
          <div>
            <dt>Last test</dt>
            <dd>
              {saved.lastTestStatus ? (
                <span className={saved.lastTestStatus === "SUCCESS" ? "inventory-good" : "inventory-bad"}>
                  {saved.lastTestStatus === "SUCCESS" ? <CheckCircle2 size={14} /> : <XCircle size={14} />} {saved.lastTestMessage}
                </span>
              ) : "Not tested since the last change"}
              {saved.lastTestAt && <small>{when(saved.lastTestAt)}</small>}
            </dd>
          </div>
        </dl>
      </section>

      <form className="panel-card clinic-module-card" onSubmit={submit}>
        <header className="panel-header"><div><h2 className="panel-title">SMTP settings</h2><p className="panel-description">Connections always use TLS. The password is encrypted before it is saved.</p></div></header>
        <div className="modal-form">
          <div className="form-grid">
            <label className="form-field">Provider
              <select value={form.provider} onChange={(event) => chooseProvider(event.target.value as "gmail" | "custom")}>
                <option value="gmail">Gmail</option>
                <option value="custom">Other SMTP server</option>
              </select>
            </label>
            <label className="form-field">Sign-in method
              <select value={form.authMethod} onChange={(event) => set("authMethod", event.target.value as Form["authMethod"])} disabled={form.provider === "gmail"}>
                <option value="APP_PASSWORD">Gmail app password</option>
                <option value="PASSWORD">SMTP password</option>
              </select>
              {form.provider === "gmail" && <small>Gmail OAuth 2.0 is not available in this system; use an app password.</small>}
            </label>
            <label className="form-field">SMTP host *<input required value={form.host} onChange={(event) => set("host", event.target.value)} readOnly={form.provider === "gmail"} maxLength={253} autoComplete="off" /></label>
            <label className="form-field">Port *
              <input required type="number" inputMode="numeric" min={1} max={65535} value={form.port} onChange={(event) => set("port", Number(event.target.value))} readOnly={form.provider === "gmail"} />
              <small>465 uses direct TLS, 587 uses STARTTLS.</small>
            </label>
            <label className="inventory-check"><input type="checkbox" checked={form.secure} disabled={form.provider === "gmail"} onChange={(event) => set("secure", event.target.checked)} /> Direct TLS (port 465)</label>
            <span />
            <label className="form-field">Username (sign-in e-mail) *<input required type="email" value={form.username} onChange={(event) => set("username", event.target.value)} autoComplete="off" maxLength={160} /></label>
            <label className="form-field">{form.authMethod === "APP_PASSWORD" ? "App password" : "Password"} {saved.passwordSet ? "" : "*"}
              <input type="password" value={form.password} onChange={(event) => set("password", event.target.value)} required={!saved.passwordSet} autoComplete="new-password" maxLength={256}
                placeholder={saved.passwordSet ? "Saved. Type a new one only to replace it" : "16-character app password"} spellCheck={false} />
              <small>{saved.passwordSet ? "Replacing the password rotates the stored credential." : "Stored encrypted. It is never shown again."}</small>
            </label>
            <label className="form-field">Sender e-mail *<input required type="email" value={form.senderEmail} onChange={(event) => set("senderEmail", event.target.value)} maxLength={160} /></label>
            <label className="form-field">Sender name *<input required minLength={2} maxLength={80} value={form.senderName} onChange={(event) => set("senderName", event.target.value)} /></label>
          </div>

          <label className={`email-toggle${!testedOk ? " is-disabled" : ""}`}>
            <input type="checkbox" checked={form.enabled && testedOk} disabled={!testedOk} onChange={(event) => set("enabled", event.target.checked)} />
            <span><strong>Turn the e-mail service on</strong><small>{testedOk ? "Password recovery codes will be sent." : "Save, then run a successful connection test to unlock this."}</small></span>
          </label>

          {error && <div className="form-error" role="alert">{error}</div>}
          <div className="modal-actions">
            <button className="button-primary" disabled={busy !== "" || !dirty || !encryptionOk}><Save size={14} /> {busy === "save" ? "Saving…" : "Save settings"}</button>
          </div>
        </div>
      </form>

      <section className="panel-card clinic-module-card">
        <header className="panel-header"><div><h2 className="panel-title">Test</h2><p className="panel-description">{connectionDirty ? "Save your changes first; tests use the saved settings." : "Tests use the saved settings."}</p></div></header>
        <div className="modal-form">
          <div className="inventory-row-actions">
            <button type="button" className="button-secondary" disabled={!canTest || busy !== ""} onClick={() => void runConnect()}><PlugZap size={14} /> {busy === "connect" ? "Testing…" : "Test connection"}</button>
          </div>
          <form className="email-test-send" onSubmit={runSend}>
            <label className="form-field">Send a test e-mail to
              <input type="email" required value={testTo} onChange={(event) => setTestTo(event.target.value)} placeholder="you@example.com" maxLength={160} disabled={!canTest} />
            </label>
            <button className="button-secondary" disabled={!canTest || busy !== "" || !testTo}><Send size={14} /> {busy === "send" ? "Sending…" : "Send test e-mail"}</button>
          </form>
          {result && (
            <div className={`email-banner ${result.ok ? "email-banner-good" : "email-banner-bad"}`} role="status">
              {result.ok ? <CheckCircle2 size={16} /> : <XCircle size={16} />}<span>{result.message}</span>
            </div>
          )}
          <p className="cell-secondary"><Info size={12} /> &ldquo;Accepted&rdquo; means the mail server took the message for delivery. It cannot promise the inbox, so always check the recipient.</p>
        </div>
      </section>

      <section className="panel-card clinic-module-card">
        <header className="panel-header"><div><h2 className="panel-title">Gmail setup</h2></div></header>
        <ol className="email-steps">
          <li>Turn on <strong>2-Step Verification</strong> for the Gmail account (Google Account → Security).</li>
          <li>Open <strong>App passwords</strong>, create one named &ldquo;Clinic system&rdquo;, and copy the 16 characters.</li>
          <li>Choose <strong>Gmail</strong> above, enter the Gmail address as username and sender, paste the app password, and save.</li>
          <li>Press <strong>Test connection</strong>, then send a test e-mail to yourself, then turn the service on.</li>
        </ol>
      </section>

      <section className="panel-card clinic-module-card">
        <header className="panel-header"><div><h2 className="panel-title"><Mail size={14} /> History</h2><p className="panel-description">Changes to these settings and every e-mail attempt. Addresses are partly hidden; codes and passwords are never recorded.</p></div></header>
        <div className="table-scroll"><table className="data-table"><thead><tr><th>When</th><th>Event</th><th>Result</th><th>Details</th></tr></thead><tbody>
          {history.map((row) => (
            <tr key={row.id}>
              <td>{when(row.createdAt)}</td>
              <td>{ACTION_LABELS[row.action] ?? row.action}{row.actor && <div className="cell-secondary">by {row.actor}</div>}</td>
              <td><span className={`invoice-status ${row.status === "SUCCESS" ? "invoice-status-paid" : row.status === "FAILED" ? "invoice-status-void" : "invoice-status-issued"}`}>{row.status === "SUCCESS" ? "OK" : row.status === "FAILED" ? "Failed" : "Info"}</span></td>
              <td>{row.recipient && <span>{row.recipient} · </span>}{row.message ?? "—"}</td>
            </tr>
          ))}
          {!history.length && <tr><td colSpan={4}>Nothing yet.</td></tr>}
        </tbody></table></div>
      </section>
    </div>
  );
}
