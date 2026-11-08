"use client";

import { AlertTriangle, CheckCircle2, Info, MessageSquareText, PlugZap, Save, Send, XCircle } from "lucide-react";
import { useCallback, useState, type FormEvent } from "react";
import { requestJson } from "@/modules/clinic/components/clinic-types";
import { useSectionLoader } from "@/modules/clinic/components/section-shared";
import { TEMPLATE_MAX, TEMPLATE_PLACEHOLDERS } from "@/modules/sms/sms-schema";
import { BRAND_NAME } from "@/lib/brand";

type Settings = {
  provider: string; senderId: string; apiKeySet: boolean; enabled: boolean; appointmentTemplate: string;
  perNumberDailyLimit: number; dailyLimit: number; lastTestAt: string | null; lastTestStatus: string | null; lastTestMessage: string | null;
};
type HistoryRow = { id: string; purpose: string; status: string; recipient: string | null; providerCode: string | null; message: string | null; createdAt: string; actor: string | null };
type Form = Pick<Settings, "senderId" | "appointmentTemplate" | "perNumberDailyLimit" | "dailyLimit" | "enabled"> & { apiKey: string };

const PURPOSE: Record<string, string> = {
  APPOINTMENT_BOOKED: "Appointment SMS", TEST_SMS: "Test SMS", CONNECTION_TEST: "Connection test", SETTINGS_UPDATED: "Settings saved",
};
const STATUS_BADGE: Record<string, string> = {
  SENT: "badge badge-success", SUCCESS: "badge badge-success", FAILED: "badge badge-danger", SKIPPED: "badge badge-warning", INFO: "badge badge-info",
};
const when = (value: string) => new Intl.DateTimeFormat("en", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit", timeZone: "Asia/Dhaka" }).format(new Date(value));
const toForm = (settings: Settings): Form => ({
  senderId: settings.senderId, appointmentTemplate: settings.appointmentTemplate, perNumberDailyLimit: settings.perNumberDailyLimit,
  dailyLimit: settings.dailyLimit, enabled: settings.enabled, apiKey: "",
});
/** Unicode (Bangla) SMS are 70 characters per part, 67 when split; plain English 160/153. */
function smsParts(text: string) {
  const unicode = /[^\u0000-\u007F]/.test(text);
  const [single, multi] = unicode ? [70, 67] : [160, 153];
  return text.length <= single ? 1 : Math.ceil(text.length / multi);
}

export default function SmsSettings({ onNotice }: { onNotice: (message: string, error: boolean) => void }) {
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
      requestJson<{ settings: Settings; encryptionConfigured: boolean }>(await fetch("/api/sms/settings", { cache: "no-store" })),
      requestJson<{ history: HistoryRow[] }>(await fetch("/api/sms/history", { cache: "no-store" })),
    ]);
    setSaved(settings.settings);
    setEncryptionOk(settings.encryptionConfigured);
    setHistory(log.history);
    // Fill the form on the first load only, so a refresh never wipes what is being typed.
    setForm((current) => current ?? toForm(settings.settings));
  }, []);
  const { gate, reload } = useSectionLoader({ section: "sms", load, shouldPauseLive: () => busy !== "", softReload: true });

  if (gate) return gate;
  if (!saved || !form) return null;

  const set = <K extends keyof Form>(key: K, value: Form[K]) => setForm((current) => (current ? { ...current, [key]: value } : current));
  const credentialsDirty = form.apiKey !== "" || form.senderId !== saved.senderId;
  const dirty = credentialsDirty || form.appointmentTemplate !== saved.appointmentTemplate || form.enabled !== saved.enabled
    || form.perNumberDailyLimit !== saved.perNumberDailyLimit || form.dailyLimit !== saved.dailyLimit;
  const testedOk = saved.lastTestStatus === "SUCCESS" && !credentialsDirty;
  const canTest = saved.apiKeySet && !credentialsDirty;
  const preview = form.appointmentTemplate
    .replaceAll("{name}", "Rahim Uddin").replaceAll("{date}", "7 Nov 2026").replaceAll("{time}", "5:30 PM").replaceAll("{clinic}", BRAND_NAME).replaceAll("{doctor}", "Dr Ovi");

  async function post<T>(url: string, body?: unknown) {
    return requestJson<T>(await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: body ? JSON.stringify(body) : undefined }));
  }

  async function run(kind: "save" | "connect" | "send", action: () => Promise<void>) {
    setBusy(kind);
    setError("");
    setResult(null);
    try {
      await action();
      reload();
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Something went wrong.");
    } finally {
      setBusy("");
    }
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!form) return;
    void run("save", async () => {
      const response = await requestJson<{ settings: Settings }>(await fetch("/api/sms/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        // A blank key means "keep the saved one"; the server never sends the key back.
        body: JSON.stringify({ ...form, enabled: form.enabled && !credentialsDirty, apiKey: form.apiKey || undefined }),
      }));
      setSaved(response.settings);
      setForm(toForm(response.settings));
      onNotice("SMS settings saved.", false);
    });
  }

  const label = "grid gap-1.5 text-sm font-semibold text-ink-2";
  const input = "min-h-10 w-full rounded-control border border-line-1 bg-surface-1 px-3 py-2 font-normal text-ink-1";

  return (
    <div className="grid gap-4">
      {!encryptionOk && (
        <div className="flex items-start gap-2 rounded-card border border-danger-border bg-danger-bg px-4 py-3 text-sm text-danger-text" role="alert">
          <AlertTriangle size={16} className="mt-0.5 shrink-0" />
          <span>The server has no <code>EMAIL_ENCRYPTION_KEY</code>, so the API key cannot be stored. Set it in the server environment and restart.</span>
        </div>
      )}

      <section className="panel-card">
        <header className="panel-header">
          <div><h2 className="panel-title">Status</h2><p className="panel-description">When on, the patient gets an SMS on the booked phone number each time an appointment is booked (not for walk-ins).</p></div>
          <span className={saved.enabled ? "badge badge-success" : "badge badge-neutral"}>{saved.enabled ? "SMS on" : "SMS off"}</span>
        </header>
        <dl className="m-0 grid gap-2.5 px-5 pb-5 text-sm">
          <div className="grid gap-1 sm:grid-cols-[150px_1fr]"><dt className="font-semibold text-ink-3">Provider</dt><dd className="m-0">BulkSMSBD (HTTPS)</dd></div>
          <div className="grid gap-1 sm:grid-cols-[150px_1fr]"><dt className="font-semibold text-ink-3">API key</dt><dd className="m-0">{saved.apiKeySet ? "Saved (encrypted, never shown)" : "Not set"}</dd></div>
          <div className="grid gap-1 sm:grid-cols-[150px_1fr]">
            <dt className="font-semibold text-ink-3">Last test</dt>
            <dd className="m-0 grid gap-0.5">
              {saved.lastTestStatus
                ? <span className={`inline-flex items-center gap-1.5 ${saved.lastTestStatus === "SUCCESS" ? "text-success-text" : "text-danger-text"}`}>{saved.lastTestStatus === "SUCCESS" ? <CheckCircle2 size={14} /> : <XCircle size={14} />} {saved.lastTestMessage}</span>
                : "Not tested since the last change"}
              {saved.lastTestAt && <small className="text-ink-3">{when(saved.lastTestAt)}</small>}
            </dd>
          </div>
        </dl>
      </section>

      <form className="panel-card" onSubmit={submit}>
        <header className="panel-header"><div><h2 className="panel-title">Gateway and message</h2><p className="panel-description">Find the API key and the approved sender ID in your BulkSMSBD panel.</p></div></header>
        <div className="grid gap-4 px-5 pb-5">
          <div className="grid gap-4 md:grid-cols-2">
            <label className={label}>{saved.apiKeySet ? "API key" : "API key *"}
              <input className={input} type="password" value={form.apiKey} onChange={(event) => set("apiKey", event.target.value)} required={!saved.apiKeySet}
                autoComplete="off" spellCheck={false} maxLength={200} placeholder={saved.apiKeySet ? "Saved. Type a new one only to replace it" : "From the BulkSMSBD panel"} />
              <small className="font-normal text-ink-3">{saved.apiKeySet ? "Replacing the key rotates the stored credential." : "Stored encrypted. It is never shown again."}</small>
            </label>
            <label className={label}>Sender ID *
              <input className={input} required value={form.senderId} onChange={(event) => set("senderId", event.target.value)} maxLength={20} placeholder="e.g. 8809XXXXXXXXXX" autoComplete="off" />
            </label>
          </div>

          <label className={label}>Appointment message *
            <textarea className={`${input} min-h-24`} required value={form.appointmentTemplate} maxLength={TEMPLATE_MAX} onChange={(event) => set("appointmentTemplate", event.target.value)} lang="bn" />
            <small className="font-normal text-ink-3">
              Placeholders: {TEMPLATE_PLACEHOLDERS.join(" ")}. {form.appointmentTemplate.length}/{TEMPLATE_MAX} characters · about {smsParts(preview)} SMS per message. Keep medical details out of SMS.
            </small>
          </label>
          <div className="rounded-control border border-line-1 bg-surface-2 px-3 py-2 text-sm leading-relaxed text-ink-2" lang="bn">
            <strong className="mb-1 block text-xs font-semibold tracking-wide text-ink-3 uppercase">Preview</strong>{preview}
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <label className={label}>SMS per phone number per day
              <input className={input} type="number" inputMode="numeric" min={1} max={20} value={form.perNumberDailyLimit} onChange={(event) => set("perNumberDailyLimit", Number(event.target.value))} />
              <small className="font-normal text-ink-3">Stops someone using the booking form to flood a number.</small>
            </label>
            <label className={label}>SMS per day in total
              <input className={input} type="number" inputMode="numeric" min={1} max={10000} value={form.dailyLimit} onChange={(event) => set("dailyLimit", Number(event.target.value))} />
              <small className="font-normal text-ink-3">A cost cap. Further SMS that day are skipped and logged.</small>
            </label>
          </div>

          <label className={`flex items-start gap-2.5 rounded-card border border-line-1 bg-surface-2 px-4 py-3 ${testedOk ? "" : "opacity-75"}`}>
            <input type="checkbox" className="mt-1" checked={form.enabled && testedOk} disabled={!testedOk} onChange={(event) => set("enabled", event.target.checked)} />
            <span className="grid gap-0.5"><strong>Send appointment SMS</strong><small className="text-ink-3">{testedOk ? "Patients get an SMS when an appointment is booked." : "Save, then run a successful connection test to unlock this."}</small></span>
          </label>

          {error && <div className="form-error" role="alert">{error}</div>}
          <div className="flex justify-end">
            <button className="button-primary inline-flex items-center gap-1.5" disabled={busy !== "" || !dirty || !encryptionOk}><Save size={14} /> {busy === "save" ? "Saving…" : "Save settings"}</button>
          </div>
        </div>
      </form>

      <section className="panel-card">
        <header className="panel-header"><div><h2 className="panel-title">Test</h2><p className="panel-description">{credentialsDirty ? "Save your changes first; tests use the saved settings." : "The connection test reads your balance and sends nothing. A test SMS costs one message."}</p></div></header>
        <div className="grid gap-3 px-5 pb-5">
          <div>
            <button type="button" className="button-secondary inline-flex items-center gap-1.5" disabled={!canTest || busy !== ""}
              onClick={() => void run("connect", async () => { const response = await post<{ ok: boolean; message: string; settings: Settings }>("/api/sms/test-connection"); setSaved(response.settings); setResult(response); })}>
              <PlugZap size={14} /> {busy === "connect" ? "Testing…" : "Test connection"}
            </button>
          </div>
          <form className="flex flex-wrap items-end gap-2.5"
            onSubmit={(event) => { event.preventDefault(); void run("send", async () => { const response = await post<{ ok: boolean; message: string; settings: Settings }>("/api/sms/test-send", { to: testTo }); setSaved(response.settings); setResult(response); }); }}>
            <label className={`${label} min-w-60 flex-1`}>Send a test SMS to
              <input className={input} type="tel" inputMode="tel" required value={testTo} onChange={(event) => setTestTo(event.target.value)} placeholder="01XXXXXXXXX" maxLength={20} disabled={!canTest} />
            </label>
            <button className="button-secondary inline-flex items-center gap-1.5" disabled={!canTest || busy !== "" || !testTo}><Send size={14} /> {busy === "send" ? "Sending…" : "Send test SMS"}</button>
          </form>
          {result && (
            <div className={`flex items-start gap-2 rounded-card border px-4 py-3 text-sm ${result.ok ? "border-success-border bg-success-bg text-success-text" : "border-danger-border bg-danger-bg text-danger-text"}`} role="status">
              {result.ok ? <CheckCircle2 size={16} className="mt-0.5 shrink-0" /> : <XCircle size={16} className="mt-0.5 shrink-0" />}<span>{result.message}</span>
            </div>
          )}
          <p className="m-0 flex items-center gap-1.5 text-xs text-ink-3"><Info size={12} /> &ldquo;Accepted&rdquo; means BulkSMSBD took the message for delivery; the phone network delivers it.</p>
        </div>
      </section>

      <section className="panel-card">
        <header className="panel-header"><div><h2 className="panel-title"><MessageSquareText size={14} /> History</h2><p className="panel-description">Every SMS attempt and settings change. Numbers are partly hidden; message text and the API key are never stored.</p></div></header>
        <div className="table-scroll"><table className="data-table"><thead><tr><th>When</th><th>Event</th><th>Result</th><th>Details</th></tr></thead><tbody>
          {history.map((row) => (
            <tr key={row.id}>
              <td>{when(row.createdAt)}</td>
              <td>{PURPOSE[row.purpose] ?? row.purpose}{row.actor && <div className="cell-secondary">by {row.actor}</div>}</td>
              <td><span className={STATUS_BADGE[row.status] ?? "badge badge-neutral"}>{row.status.charAt(0) + row.status.slice(1).toLowerCase()}</span></td>
              <td>{row.recipient && <span>{row.recipient} · </span>}{row.message ?? "—"}{row.providerCode && row.status === "FAILED" && <span className="cell-secondary"> (code {row.providerCode})</span>}</td>
            </tr>
          ))}
          {!history.length && <tr><td colSpan={4}>Nothing yet.</td></tr>}
        </tbody></table></div>
      </section>
    </div>
  );
}
