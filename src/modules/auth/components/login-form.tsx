"use client";

import { useEffect, useState, type FormEvent } from "react";
import { Activity, Eye, EyeOff, ShieldCheck, Smile } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";
import { NO_ACCESS_ROLE } from "@/lib/permissions";
import { BRAND_NAME } from "@/lib/brand";

export default function LoginForm({ accessDenied }: { accessDenied: boolean }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState(accessDenied ? "এই অ্যাকাউন্টে ক্লিনিক অ্যাক্সেস নেই।" : "");
  const [loading, setLoading] = useState(false);
  // "Forgot password" is offered only once the clinic has turned e-mail on.
  const [recoveryAvailable, setRecoveryAvailable] = useState(false);

  useEffect(() => {
    let active = true;
    fetch("/api/password-reset/status", { cache: "no-store" })
      .then((response) => response.json() as Promise<{ available?: boolean }>)
      .then((result) => { if (active) setRecoveryAvailable(Boolean(result.available)); })
      .catch(() => undefined);
    return () => { active = false; };
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setLoading(true);
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 15_000);

    try {
      const result = await authClient.signIn.email({
        email,
        password,
        fetchOptions: { signal: controller.signal },
      });

      if (result.error) {
        setError("ইমেইল অথবা পাসওয়ার্ড সঠিক নয়।");
        return;
      }

      const session = await authClient.getSession({
        fetchOptions: { signal: controller.signal },
      });
      if (session.error) {
        throw new Error("Session verification failed.");
      }

      // The server decides what each role may do; here we only stop accounts that have no role at all.
      if (!session.data?.user.role || session.data.user.role === NO_ACCESS_ROLE) {
        await authClient.signOut({
          fetchOptions: { signal: controller.signal },
        });
        setError("এই অ্যাকাউন্টে ক্লিনিক অ্যাক্সেস নেই।");
        return;
      }

      router.replace("/dashboard");
      router.refresh();
    } catch (error) {
      setError(
        error instanceof DOMException && error.name === "AbortError"
          ? "সার্ভার থেকে উত্তর আসতে দেরি হচ্ছে। আবার চেষ্টা করুন।"
          : "সাইন ইন করা যায়নি। সংযোগ পরীক্ষা করে আবার চেষ্টা করুন।",
      );
    } finally {
      window.clearTimeout(timeout);
      setLoading(false);
    }
  }

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
          <h1>Care for every smile, all in one place.</h1>
          <p>Manage appointments and keep your clinic running smoothly from a single workspace.</p>
        </div>
        <div className="clinic-card-copy">A calmer, more connected clinic experience.</div>
      </section>

      <section className="login-form-panel">
        <form className="login-card" onSubmit={handleSubmit}>
          <div className="eyebrow">Admin portal</div>
          <h2>Welcome back</h2>
          <p>Sign in with your administrator account to continue.</p>
          {error && <div className="login-error" id="login-error" role="alert">{error}</div>}
          <div className="form-field">
            <label htmlFor="email">Email address</label>
            <input
              id="email"
              aria-invalid={error ? true : undefined}
              aria-describedby={error ? "login-error" : undefined}
              type="email"
              autoComplete="username"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="admin@clinic.com"
              required
            />
          </div>
          <div className="form-field">
            <label htmlFor="password">Password</label>
            <div style={{ position: "relative" }}>
              <input
                id="password"
              aria-invalid={error ? true : undefined}
              aria-describedby={error ? "login-error" : undefined}
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="Enter your password"
                style={{ paddingRight: 42 }}
                required
              />
              <button
                type="button"
                aria-label={showPassword ? "Hide password" : "Show password"}
                onClick={() => setShowPassword((value) => !value)}
                style={{
                  position: "absolute",
                  top: "50%",
                  right: 12,
                  display: "grid",
                  transform: "translateY(-50%)",
                  border: 0,
                  background: "transparent",
                  color: "#8b95a5",
                }}
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>
          {recoveryAvailable && <Link className="login-forgot recovery-link" href="/forgot-password">Forgot password?</Link>}
          <button className="button-primary" type="submit" disabled={loading} style={{ width: "100%", marginTop: 4 }}>
            <ShieldCheck size={15} />
            {loading ? "Signing in..." : "Sign in securely"}
          </button>
          <div className="login-footer">Protected access · {BRAND_NAME}</div>
        </form>
      </section>
    </main>
  );
}
