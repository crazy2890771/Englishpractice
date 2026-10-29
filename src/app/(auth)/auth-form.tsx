"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Loader2 } from "lucide-react";
import { supabaseBrowser } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Logo } from "@/components/app/logo";

function friendly(msg: string) {
  if (/invalid login/i.test(msg)) return "อีเมลหรือรหัสผ่านไม่ถูกต้อง · Incorrect email or password.";
  if (/already registered|already exists/i.test(msg)) return "อีเมลนี้มีบัญชีแล้ว · This email already has an account.";
  if (/password/i.test(msg)) return "รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร · Password must be at least 8 characters.";
  if (/rate limit/i.test(msg)) return "ลองบ่อยเกินไป กรุณารอสักครู่ · Too many attempts, please wait.";
  return msg;
}

export function AuthForm({ mode }: { mode: "login" | "register" }) {
  const router = useRouter();
  const [busy, setBusy] = useState<"form" | "guest" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const register = mode === "register";

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const email = String(f.get("email") ?? "").trim();
    const password = String(f.get("password") ?? "");
    setBusy("form");
    setError(null);
    const supabase = supabaseBrowser();
    const res = register
      ? await supabase.auth.signUp({ email, password, options: { data: { name: String(f.get("name") ?? "").trim() }, emailRedirectTo: `${location.origin}/auth/callback` } })
      : await supabase.auth.signInWithPassword({ email, password });
    setBusy(null);
    if (res.error) return setError(friendly(res.error.message));
    if (register && !res.data.session) {
      setNotice("ตรวจสอบอีเมลเพื่อยืนยันบัญชี · Check your email to confirm your account.");
      return;
    }
    router.replace("/today");
    router.refresh();
  }

  async function guest() {
    setBusy("guest");
    setError(null);
    const { error: err } = await supabaseBrowser().auth.signInAnonymously();
    setBusy(null);
    if (err) return setError(friendly(err.message));
    router.replace("/onboarding");
    router.refresh();
  }

  return (
    <div className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center px-5 py-10">
      <div className="mb-8">
        <Logo />
      </div>
      <h1 className="text-2xl font-semibold tracking-tight">{register ? "สร้างบัญชี" : "เข้าสู่ระบบ"}</h1>
      <p className="mt-1 text-sm text-muted-foreground">{register ? "Create your account — your progress is saved securely." : "Sign in to continue your lessons."}</p>
      <form onSubmit={submit} className="mt-6 space-y-4">
        {register && (
          <div className="space-y-2">
            <Label htmlFor="name">ชื่อ · Name</Label>
            <Input id="name" name="name" autoComplete="given-name" required maxLength={60} />
          </div>
        )}
        <div className="space-y-2">
          <Label htmlFor="email">อีเมล · Email</Label>
          <Input id="email" name="email" type="email" autoComplete="email" required />
        </div>
        <div className="space-y-2">
          <Label htmlFor="password">รหัสผ่าน · Password</Label>
          <Input id="password" name="password" type="password" autoComplete={register ? "new-password" : "current-password"} minLength={register ? 8 : 1} required />
        </div>
        {error && (
          <p role="alert" className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </p>
        )}
        {notice && (
          <p role="status" className="rounded-xl bg-accent px-3 py-2 text-sm text-accent-foreground">
            {notice}
          </p>
        )}
        <Button type="submit" size="lg" className="w-full" disabled={busy !== null}>
          {busy === "form" && <Loader2 className="animate-spin" />}
          {register ? "สร้างบัญชี · Create account" : "เข้าสู่ระบบ · Sign in"}
        </Button>
      </form>
      <div className="my-6 flex items-center gap-3 text-xs text-muted-foreground">
        <span className="h-px flex-1 bg-border" /> หรือ · or <span className="h-px flex-1 bg-border" />
      </div>
      <Button variant="outline" size="lg" onClick={guest} disabled={busy !== null}>
        {busy === "guest" && <Loader2 className="animate-spin" />}
        ลองใช้โดยไม่สมัคร · Try without an account
      </Button>
      <p className="mt-2 text-center text-xs text-muted-foreground">บัญชีทดลองบันทึกความคืบหน้าในเบราว์เซอร์นี้ · Guest progress stays on this browser.</p>
      <p className="mt-8 text-center text-sm text-muted-foreground">
        {register ? "มีบัญชีแล้ว? " : "ยังไม่มีบัญชี? "}
        <Link href={register ? "/login" : "/register"} className="font-medium text-primary hover:underline">
          {register ? "เข้าสู่ระบบ · Sign in" : "สร้างบัญชี · Create one"}
        </Link>
      </p>
    </div>
  );
}
