"use client";

import { LockKeyhole, Mail } from "lucide-react";
import { useEffect, useState } from "react";
import type { FormEvent } from "react";

type Result = { message: string; error: boolean };

async function post(url: string, body?: unknown) {
  const response = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
  const data = await response.json().catch(() => ({})) as { error?: string; retryAfter?: number; email?: string };
  if (!response.ok) throw Object.assign(new Error(data.error ?? "Something went wrong. Try again."), { retryAfter: data.retryAfter });
  return data;
}

export default function SecurityView({ onResult }: { onResult: (result: Result) => void }) {
  const [saving, setSaving] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  // Step 2 appears once a verification code has been e-mailed to the signed-in user.
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [resendIn, setResendIn] = useState(0);

  useEffect(() => {
    if (resendIn <= 0) return;
    const timer = window.setTimeout(() => setResendIn((seconds) => seconds - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [resendIn]);

  function checkFields() {
    if (newPassword.length < 10) return "Password must be at least 10 characters.";
    if (newPassword !== confirmPassword) return "New passwords do not match.";
    return null;
  }

  async function sendCode() {
    const problem = checkFields();
    if (problem) return onResult({ message: problem, error: true });
    setSaving(true);
    try {
      const result = await post("/api/security/password/code");
      setSentTo(result.email ?? "your e-mail");
      setCode("");
      setResendIn(60);
      onResult({ message: `Verification code sent to ${result.email}.`, error: false });
    } catch (error) {
      const wait = (error as { retryAfter?: number }).retryAfter;
      if (wait) setResendIn(wait);
      onResult({ message: error instanceof Error ? error.message : "Could not send the code.", error: true });
    } finally {
      setSaving(false);
    }
  }

  async function updatePassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!sentTo) return sendCode();
    const problem = checkFields();
    if (problem) return onResult({ message: problem, error: true });
    if (!/^\d{6}$/.test(code)) return onResult({ message: "Enter the 6-digit code from your e-mail.", error: true });

    setSaving(true);
    try {
      await post("/api/security/password", { currentPassword, newPassword, code });
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setCode("");
      setSentTo(null);
      setResendIn(0);
      onResult({ message: "Password updated. Other active sessions were signed out.", error: false });
    } catch (error) {
      onResult({ message: error instanceof Error ? error.message : "Could not update password.", error: true });
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="panel-card security-card">
      <div className="panel-header">
        <div>
          <h2 className="panel-title">Change password</h2>
          <div className="panel-description">Use a unique password with at least 10 characters. We e-mail a code to confirm it is you.</div>
        </div>
        <span className="stat-icon"><LockKeyhole size={16} /></span>
      </div>
      <form className="security-form" onSubmit={updatePassword}>
        <div className="form-field">
          <label htmlFor="currentPassword">Current password</label>
          <input
            id="currentPassword"
            type="password"
            autoComplete="current-password"
            value={currentPassword}
            onChange={(event) => setCurrentPassword(event.target.value)}
            required
          />
        </div>
        <div className="form-grid">
          <div className="form-field">
            <label htmlFor="newPassword">New password</label>
            <input
              id="newPassword"
              type="password"
              autoComplete="new-password"
              minLength={10}
              value={newPassword}
              onChange={(event) => setNewPassword(event.target.value)}
              required
            />
          </div>
          <div className="form-field">
            <label htmlFor="confirmPassword">Confirm new password</label>
            <input
              id="confirmPassword"
              type="password"
              autoComplete="new-password"
              minLength={10}
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              required
            />
          </div>
        </div>
        {sentTo && (
          <div className="form-field">
            <label htmlFor="verificationCode">Verification code</label>
            <input
              id="verificationCode"
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="\d{6}"
              maxLength={6}
              placeholder="6-digit code"
              value={code}
              onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))}
              autoFocus
              required
            />
            <small>We sent a code to {sentTo}. It expires in 5 minutes.</small>
          </div>
        )}
        <div className="security-note">Your new password is never stored in the application environment file.</div>
        <div className="modal-actions" style={{ justifyContent: "flex-start" }}>
          <button className="button-primary" type="submit" disabled={saving}>
            {sentTo ? <LockKeyhole size={14} /> : <Mail size={14} />}
            {saving ? "Please wait…" : sentTo ? "Update password" : "Send verification code"}
          </button>
          {sentTo && (
            <button className="button-secondary" type="button" disabled={saving || resendIn > 0} onClick={() => void sendCode()}>
              {resendIn > 0 ? `Send a new code in ${resendIn}s` : "Send a new code"}
            </button>
          )}
        </div>
      </form>
    </section>
  );
}
