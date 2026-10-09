"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { CloudOff, RefreshCw } from "lucide-react";
import { flushOutbox, onOutboxChange, readOutbox } from "@/lib/client/outbox";
import { useAppConfig } from "./providers";

/** Syncs offline work when the connection returns and shows how much is waiting. */
export function OutboxSync() {
  const { user } = useAppConfig();
  const router = useRouter();
  const [pending, setPending] = useState(0);
  const [syncing, setSyncing] = useState(false);
  const [justSynced, setJustSynced] = useState(0);

  useEffect(() => {
    const update = () => setPending(readOutbox(user.id).length);
    update();
    const off = onOutboxChange(update);
    const sync = async () => {
      if (!navigator.onLine || readOutbox(user.id).length === 0) return;
      setSyncing(true);
      const r = await flushOutbox(user.id);
      setSyncing(false);
      update();
      if (r.synced > 0) {
        setJustSynced(r.synced);
        setTimeout(() => setJustSynced(0), 4000);
        router.refresh();
      }
    };
    void sync();
    window.addEventListener("online", sync);
    const t = setInterval(sync, 30_000);
    return () => {
      off();
      window.removeEventListener("online", sync);
      clearInterval(t);
    };
  }, [user.id, router]);

  if (!pending && !justSynced) return null;
  return (
    <div role="status" className="bg-brand-soft px-4 py-1.5 text-center text-xs font-medium text-fg">
      {justSynced && !pending ? (
        <>✓ Synced {justSynced} offline {justSynced === 1 ? "answer" : "answers"}.</>
      ) : syncing ? (
        <span className="inline-flex items-center gap-1.5"><RefreshCw className="h-3.5 w-3.5 animate-spin" aria-hidden /> Syncing {pending} offline {pending === 1 ? "answer" : "answers"}…</span>
      ) : (
        <span className="inline-flex items-center gap-1.5"><CloudOff className="h-3.5 w-3.5" aria-hidden /> {pending} offline {pending === 1 ? "answer is" : "answers are"} saved on this device and will sync when you&apos;re back online.</span>
      )}
    </div>
  );
}
