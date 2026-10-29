"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Loader2, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useL, usePrefs } from "./ui-context";
import { api, ApiError } from "@/lib/client/api";
import { errorText } from "@/i18n";
import { DURATIONS } from "@/engine/schedule";

/** Creates a session (scheduled / practice / makeup / review) and opens it. */
export function StartSession({ language, skills, kind, scheduledDate, defaultMinutes, minutes: fixedMinutes, label, variant = "default", showDuration = true, size }: { language: string; skills: string[]; kind: "scheduled" | "practice" | "makeup" | "review"; scheduledDate?: string; defaultMinutes: number; /** Controlled duration (hides the selector). */ minutes?: number; label?: string; variant?: "default" | "outline" | "secondary"; showDuration?: boolean; size?: "default" | "sm" }) {
  const L = useL();
  const router = useRouter();
  const { uiLang } = usePrefs();
  const [chosen, setMinutes] = useState(defaultMinutes);
  const minutes = fixedMinutes ?? chosen;
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function start() {
    setBusy(true);
    setError(null);
    try {
      const r = await api<{ id: string }>("/api/sessions", { body: { kind, language, skills, minutes, scheduledDate } });
      router.push(`/session/${r.id}`);
    } catch (e) {
      const code = (e as ApiError).code;
      if (code === "needs_placement") return router.push(`/placement/${language}`);
      setError(errorText(code, uiLang));
      setBusy(false);
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <Button onClick={start} disabled={busy} variant={variant} size={size}>
          {busy ? <Loader2 className="animate-spin" /> : <Play />} {label ?? L("เริ่มเรียน", "Start learning")}
        </Button>
        {showDuration && fixedMinutes === undefined && (
          <>
            <label htmlFor={`dur-${language}-${skills.join()}`} className="sr-only">
              {L("ระยะเวลา", "Duration")}
            </label>
            <select id={`dur-${language}-${skills.join()}`} value={minutes} onChange={(e) => setMinutes(Number(e.target.value))} className="h-10 rounded-xl border bg-background px-3 text-sm">
              {DURATIONS.map((d) => (
                <option key={d} value={d}>
                  {d} {L("นาที", "min")}
                </option>
              ))}
            </select>
          </>
        )}
      </div>
      {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
    </div>
  );
}
