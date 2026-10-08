"use client";
import { useState } from "react";
import { ArrowRight } from "lucide-react";
import { api, errorMessage } from "@/lib/client/api";
import { Spinner } from "@/components/ui";

export function DemoButton() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <div>
      <button
        type="button"
        className="btn-primary w-full px-6 py-3 text-base sm:w-auto"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          setError(null);
          try {
            await api("/api/auth/demo", { method: "POST" });
            window.location.href = "/onboarding";
          } catch (e) {
            setError(errorMessage(e));
            setBusy(false);
          }
        }}
      >
        {busy ? <Spinner /> : null} Try the demo <ArrowRight className="h-4 w-4" aria-hidden />
      </button>
      {error && <p role="alert" className="mt-2 text-sm text-red-300">{error}</p>}
    </div>
  );
}
