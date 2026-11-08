"use client";

import { CheckCircle2, PhoneCall, PlugZap, Save, XCircle } from "lucide-react";
import { useCallback, useState, type FormEvent } from "react";
import { requestJson } from "@/modules/clinic/components/clinic-types";
import { useSectionLoader } from "@/modules/clinic/components/section-shared";

type Settings = { sender: string; reminderVoice: string; tokenSet: boolean; enabled: boolean; lastTestAt: string | null; lastTestStatus: string | null; lastTestMessage: string | null };
type Form = { token: string; sender: string; reminderVoice: string; enabled: boolean };

const toForm = (settings: Settings): Form => ({ token: "", sender: settings.sender, reminderVoice: settings.reminderVoice, enabled: settings.enabled });

// AwajDigital voice reminder calls. Calls are placed from the Reminders panel on the bookings screen.
export default function VoiceSettings({ onNotice }: { onNotice: (message: string, error: boolean) => void }) {
  const [saved, setSaved] = useState<Settings | null>(null);
  const [form, setForm] = useState<Form | null>(null);
  const [busy, setBusy] = useState<"" | "save" | "connect">("");
  const [error, setError] = useState("");
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);

  const load = useCallback(async () => {
    const response = await requestJson<{ settings: Settings }>(await fetch("/api/voice/settings", { cache: "no-store" }));
    setSaved(response.settings);
    setForm((current) => current ?? toForm(response.settings));
  }, []);
  const { gate, reload } = useSectionLoader({ section: "sms", load, shouldPauseLive: () => busy !== "", softReload: true });

  if (gate) return gate;
  if (!saved || !form) return null;

  const set = <K extends keyof Form>(key: K, value: Form[K]) => setForm((current) => (current ? { ...current, [key]: value } : current));
  const setupDirty = form.token !== "" || form.sender !== saved.sender || form.reminderVoice !== saved.reminderVoice;
  const dirty = setupDirty || form.enabled !== saved.enabled;
  const testedOk = saved.lastTestStatus === "SUCCESS" && !setupDirty;
  const canTest = saved.tokenSet && !setupDirty;

  async function run(kind: "save" | "connect", action: () => Promise<void>) {
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
      const response = await requestJson<{ settings: Settings }>(await fetch("/api/voice/settings", {
        method: "PUT", headers: { "Content-Type": "application/json" },
        // A blank token means "keep the saved one"; the server never sends it back.
        body: JSON.stringify({ ...form, enabled: form.enabled && !setupDirty, token: form.token || undefined }),
      }));
      setSaved(response.settings);
      setForm(toForm(response.settings));
      onNotice("Voice settings saved.", false);
    });
  }

  const label = "grid gap-1.5 text-sm font-semibold text-ink-2";
  const input = "min-h-10 w-full rounded-control border border-line-1 bg-surface-1 px-3 py-2 font-normal text-ink-1";

  return (
    <form className="panel-card" onSubmit={submit}>
      <header className="panel-header">
        <div>
          <h2 className="panel-title"><PhoneCall size={14} /> Voice reminder calls (AwajDigital)</h2>
          <p className="panel-description">Plays a pre-recorded voice to patients with upcoming bookings. Upload the recording in the AwajDigital panel and wait for approval, then enter its exact name here.</p>
        </div>
        <span className={saved.enabled ? "badge badge-success" : "badge badge-neutral"}>{saved.enabled ? "Voice on" : "Voice off"}</span>
      </header>
      <div className="grid gap-4 px-5 pb-5">
        <div className="grid gap-4 md:grid-cols-3">
          <label className={label}>{saved.tokenSet ? "API token" : "API token *"}
            <input className={input} type="password" value={form.token} onChange={(event) => set("token", event.target.value)} required={!saved.tokenSet}
              autoComplete="off" spellCheck={false} maxLength={500} placeholder={saved.tokenSet ? "Saved. Type a new one only to replace it" : "AwajDigital panel → API tokens"} />
          </label>
          <label className={label}>Sender number *
            <input className={input} required inputMode="numeric" value={form.sender} onChange={(event) => set("sender", event.target.value)} maxLength={13} placeholder="e.g. 8809612000000" autoComplete="off" />
          </label>
          <label className={label}>Reminder voice name *
            <input className={input} required value={form.reminderVoice} onChange={(event) => set("reminderVoice", event.target.value)} maxLength={255} placeholder="e.g. appointment-reminder" autoComplete="off" />
          </label>
        </div>

        <div className="text-sm">
          <strong className="text-ink-3">Last test: </strong>
          {saved.lastTestStatus
            ? <span className={`inline-flex items-center gap-1.5 ${saved.lastTestStatus === "SUCCESS" ? "text-success-text" : "text-danger-text"}`}>{saved.lastTestStatus === "SUCCESS" ? <CheckCircle2 size={14} /> : <XCircle size={14} />} {saved.lastTestMessage}</span>
            : "Not tested since the last change"}
        </div>

        <label className={`flex items-start gap-2.5 rounded-card border border-line-1 bg-surface-2 px-4 py-3 ${testedOk ? "" : "opacity-75"}`}>
          <input type="checkbox" className="mt-1" checked={form.enabled && testedOk} disabled={!testedOk} onChange={(event) => set("enabled", event.target.checked)} />
          <span className="grid gap-0.5"><strong>Allow voice reminder calls</strong><small className="text-ink-3">{testedOk ? "Staff can call all upcoming patients from the Reminders panel. Each call costs money." : "Save, then run a successful connection test to unlock this."}</small></span>
        </label>

        {error && <div className="form-error" role="alert">{error}</div>}
        {result && (
          <div className={`flex items-start gap-2 rounded-card border px-4 py-3 text-sm ${result.ok ? "border-success-border bg-success-bg text-success-text" : "border-danger-border bg-danger-bg text-danger-text"}`} role="status">
            {result.ok ? <CheckCircle2 size={16} className="mt-0.5 shrink-0" /> : <XCircle size={16} className="mt-0.5 shrink-0" />}<span>{result.message}</span>
          </div>
        )}
        <div className="flex flex-wrap justify-end gap-2.5">
          <button type="button" className="button-secondary inline-flex items-center gap-1.5" disabled={!canTest || busy !== ""}
            onClick={() => void run("connect", async () => {
              const response = await requestJson<{ ok: boolean; message: string; settings: Settings }>(await fetch("/api/voice/test-connection", { method: "POST" }));
              setSaved(response.settings);
              setResult(response);
            })}>
            <PlugZap size={14} /> {busy === "connect" ? "Testing…" : "Test connection (no call)"}
          </button>
          <button className="button-primary inline-flex items-center gap-1.5" disabled={busy !== "" || !dirty}><Save size={14} /> {busy === "save" ? "Saving…" : "Save voice settings"}</button>
        </div>
      </div>
    </form>
  );
}
