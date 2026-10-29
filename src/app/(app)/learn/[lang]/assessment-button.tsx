"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { usePrefs } from "@/components/app/ui-context";
import { api, ApiError } from "@/lib/client/api";
import { errorText } from "@/i18n";

/** Starts a unit assessment, level exam, remediation or unit practice session. */
export function AssessmentButton({ body, label, variant = "default" }: { body: Record<string, unknown>; label: string; variant?: "default" | "outline" | "secondary" }) {
  const router = useRouter();
  const { uiLang } = usePrefs();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  return (
    <div className="flex flex-col items-end gap-1">
      <Button
        size="sm"
        variant={variant}
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          setErr(null);
          try {
            const r = await api<{ id: string }>("/api/sessions", { body });
            router.push(`/session/${r.id}`);
          } catch (e) {
            setErr(errorText((e as ApiError).code, uiLang));
            setBusy(false);
          }
        }}
      >
        {busy && <Loader2 className="animate-spin" />} {label}
      </Button>
      {err && <p role="alert" className="text-xs text-red-700">{err}</p>}
    </div>
  );
}
