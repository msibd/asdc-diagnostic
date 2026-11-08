"use client";

import { Activity, ArrowLeft, CheckCircle2, Eye, EyeOff, KeyRound, MailCheck, ShieldCheck, Smile } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { BRAND_NAME } from "@/lib/brand";

type Step = "email" | "code" | "password" | "done";
const STEPS: Step[] = ["email", "code", "password", "done"];

async function post<T>(url: string, body: unknown): Promise<T> {
  const response = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const result = await response.json().catch(() => ({})) as T & { error?: string; retryAfter?: number };
  if (!response.ok) {
    const wait = response.status === 429 && result.retryAfter ? ` Try again in ${Math.ceil(result.retryAfter / 60)} min.` : "";
    throw new Error(`${result.error ?? "Something went wrong. Please try again."}${wait}`);
  }
  return result;
}

export default function ForgotPasswordForm() {
  const [step, setStep] = useState<Step>("email");
  const [available, setAvailable] = useState<boolean | null>(null);
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [token, setToken] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [cooldown, setCooldown] = useState(0);
  const heading = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    let active = true;
    fetch("/api/password-reset/status", { cache: "no-store" })
      .then((response) => response.json() as Promise<{ available?: boolean }>)
      .then((result) => { if (active) setAvailable(Boolean(result.available)); })
      .catch(() => { if (active) setAvailable(false); });
    return () => { active = false; };
  }, []);

  // Resend countdown.
  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = window.setTimeout(() => setCooldown((value) => value - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [cooldown]);

  // Keyboard and screen-reader users land on the new step's heading.
  useEffect(() => { heading.current?.focus(); }, [step]);

  async function sendCode(event?: FormEvent) {
    event?.preventDefault();
    setBusy(true);
    setError("");
    setInfo("");
    try {
      const result = await post<{ message: string; resendAfterSeconds: number }>("/api/password-reset/request", { email });
      setInfo(result.message);
      setCooldown(result.resendAfterSeconds);
      setCode("");
      setStep("code");
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Could not send the code.");
    } finally {
      setBusy(false);
    }
  }

  async function checkCode(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const result = await post<{ token: string }>("/api/password-reset/verify", { email, code });
      setToken(result.token);
      setInfo("");
      setStep("password");
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Could not check the code.");
    } finally {
      setBusy(false);
    }
  }

  async function savePassword(event: FormEvent) {
    event.preventDefault();
    if (password !== confirm) {
      setError("The two passwords do not match.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      await post("/api/password-reset/complete", { token, password });
      setToken("");
      setPassword("");
      setConfirm("");
      setStep("done");
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Could not change the password.");
    } finally {
      setBusy(false);
    }
  }

  const index = STEPS.indexOf(step);

  return (
    <main className="login-page" lang="en">
      <section className="login-brand-panel">
        <div className="brand">
          <div className="brand-mark"><Smile size={20} /></div>
          <div>
            <div className="brand-name">{BRAND_NAME}</div>
            <div className="brand-caption">Diagnostic Center · Admin portal</div>
          </div>
        </div>
        <div className="login-art">
          <div className="login-art-mark"><Activity size={30} /></div>
          <h1>Locked out? We&apos;ll get you back in.</h1>
          <p>Confirm your e-mail with a one-time code, then choose a new password.</p>
        </div>
        <div className="clinic-card-copy">A calmer, more connected clinic experience.</div>
      </section>

      <section className="login-form-panel">
        <div className="login-card">
          <ol className="recovery-steps" aria-label={`Step ${index + 1} of ${STEPS.length}`}>
            {STEPS.map((item, position) => <li key={item} className={position <= index ? "is-done" : undefined} />)}
          </ol>

          {available === false && step !== "done" ? (
            <>
              <h2 ref={heading} tabIndex={-1}>Recovery by e-mail is not set up</h2>
              <p className="recovery-note">Ask the clinic administrator to reset your password, or to turn on e-mail in Email &amp; SMTP Settings.</p>
              <Link className="button-secondary" href="/login"><ArrowLeft size={14} /> Back to sign in</Link>
            </>
          ) : (
            <>
              {step === "email" && (
                <form onSubmit={sendCode} noValidate={false}>
                  <h2 ref={heading} tabIndex={-1}>Forgot your password?</h2>
                  <p className="recovery-note">Enter the e-mail address of your staff account. We will send a 6-digit code.</p>
                  {error && <div className="login-error" role="alert">{error}</div>}
                  <div className="form-field">
                    <label htmlFor="recovery-email">Email address</label>
                    <input id="recovery-email" type="email" autoComplete="username" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@clinic.com" required maxLength={160} autoFocus />
                  </div>
                  <button className="button-primary" type="submit" disabled={busy || available === null} style={{ width: "100%", marginTop: 8 }}>
                    <MailCheck size={15} /> {busy ? "Sending…" : "Send code"}
                  </button>
                  <div className="recovery-links"><Link className="recovery-link" href="/login">Back to sign in</Link></div>
                </form>
              )}

              {step === "code" && (
                <form onSubmit={checkCode}>
                  <h2 ref={heading} tabIndex={-1}>Enter the code</h2>
                  <p className="recovery-note">{info || "If that address belongs to a staff account, a 6-digit code has been sent."} Check your spam folder too. The code lasts 5 minutes.</p>
                  {error && <div className="login-error" role="alert">{error}</div>}
                  <div className="form-field">
                    <label htmlFor="recovery-code">6-digit code</label>
                    <input id="recovery-code" className="recovery-otp" inputMode="numeric" autoComplete="one-time-code" pattern="\d{6}" maxLength={6} value={code}
                      onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))} placeholder="••••••" required autoFocus />
                  </div>
                  <button className="button-primary" type="submit" disabled={busy || code.length !== 6} style={{ width: "100%", marginTop: 8 }}>
                    <ShieldCheck size={15} /> {busy ? "Checking…" : "Verify code"}
                  </button>
                  <div className="recovery-links">
                    <button type="button" className="recovery-link" disabled={cooldown > 0 || busy} onClick={() => void sendCode()}>
                      {cooldown > 0 ? `Resend code in ${cooldown}s` : "Resend code"}
                    </button>
                    <button type="button" className="recovery-link" onClick={() => { setStep("email"); setError(""); }}>Use a different e-mail</button>
                  </div>
                </form>
              )}

              {step === "password" && (
                <form onSubmit={savePassword}>
                  <h2 ref={heading} tabIndex={-1}>Choose a new password</h2>
                  <p className="recovery-note">Code accepted. Use at least 10 characters. You will be signed out everywhere and can sign in with the new password.</p>
                  {error && <div className="login-error" role="alert">{error}</div>}
                  <div className="form-field">
                    <label htmlFor="recovery-password">New password</label>
                    <div style={{ position: "relative" }}>
                      <input id="recovery-password" type={showPassword ? "text" : "password"} autoComplete="new-password" minLength={10} maxLength={128} value={password}
                        onChange={(event) => setPassword(event.target.value)} required style={{ paddingRight: 42 }} autoFocus />
                      <button type="button" aria-label={showPassword ? "Hide password" : "Show password"} onClick={() => setShowPassword((value) => !value)}
                        style={{ position: "absolute", top: "50%", right: 12, display: "grid", transform: "translateY(-50%)", border: 0, background: "transparent", color: "#8b95a5" }}>
                        {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                  </div>
                  <div className="form-field">
                    <label htmlFor="recovery-confirm">Confirm new password</label>
                    <input id="recovery-confirm" type={showPassword ? "text" : "password"} autoComplete="new-password" minLength={10} maxLength={128} value={confirm} onChange={(event) => setConfirm(event.target.value)} required />
                  </div>
                  <button className="button-primary" type="submit" disabled={busy || password.length < 10} style={{ width: "100%", marginTop: 8 }}>
                    <KeyRound size={15} /> {busy ? "Saving…" : "Change password"}
                  </button>
                </form>
              )}

              {step === "done" && (
                <div className="recovery-success" role="status">
                  <CheckCircle2 size={44} />
                  <h2 ref={heading} tabIndex={-1}>Password changed</h2>
                  <p className="recovery-note">You were signed out on all devices. Sign in with your new password.</p>
                  <Link className="button-primary" href="/login"><ShieldCheck size={15} /> Go to sign in</Link>
                </div>
              )}
            </>
          )}
          <div className="login-footer">Protected access · {BRAND_NAME}</div>
        </div>
      </section>
    </main>
  );
}
