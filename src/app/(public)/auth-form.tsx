"use client";
import Link from "next/link";
import { useState } from "react";
import { api, errorMessage } from "@/lib/client/api";
import { ErrorBanner, Spinner } from "@/components/ui";
import { Logo } from "@/components/logo";

export function AuthForm({ mode }: { mode: "login" | "register" }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const register = mode === "register";

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setBusy(true);
    setError(null);
    try {
      const res = await api<{ onboarded?: boolean }>(register ? "/api/auth/register" : "/api/auth/login", {
        body: { name: f.get("name") ?? undefined, email: f.get("email"), password: f.get("password") },
      });
      window.location.href = register || !res.onboarded ? "/onboarding" : "/dashboard";
    } catch (err) {
      setError(errorMessage(err));
      setBusy(false);
    }
  }

  return (
    <div className="grid min-h-dvh place-items-center px-4 py-10">
      <div className="w-full max-w-sm">
        <Link href="/welcome" className="mb-8 flex justify-center" aria-label="Back to welcome page"><Logo /></Link>
        <div className="card p-6">
          <h1 className="text-xl font-bold">{register ? "Create your account" : "Welcome back"}</h1>
          <p className="mt-1 text-sm text-muted">{register ? "Start your 30-day fluency journey." : "Sign in to continue learning."}</p>
          <form onSubmit={onSubmit} className="mt-6 space-y-4">
            {register && (
              <div>
                <label className="label" htmlFor="name">Name</label>
                <input id="name" name="name" className="input" required maxLength={60} autoComplete="given-name" />
              </div>
            )}
            <div>
              <label className="label" htmlFor="email">Email</label>
              <input id="email" name="email" type="email" className="input" required autoComplete="email" />
            </div>
            <div>
              <label className="label" htmlFor="password">Password</label>
              <input id="password" name="password" type="password" className="input" required minLength={register ? 8 : 1} autoComplete={register ? "new-password" : "current-password"} />
              {register && <p className="mt-1 text-xs text-muted">At least 8 characters.</p>}
            </div>
            {error && <ErrorBanner message={error} />}
            <button type="submit" className="btn-primary w-full" disabled={busy}>
              {busy && <Spinner />} {register ? "Create account" : "Sign in"}
            </button>
          </form>
        </div>
        <p className="mt-4 text-center text-sm text-muted">
          {register ? "Already have an account? " : "New here? "}
          <Link href={register ? "/login" : "/register"} className="font-semibold text-brand hover:underline">
            {register ? "Sign in" : "Create an account"}
          </Link>
        </p>
      </div>
    </div>
  );
}
