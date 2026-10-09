"use client";
import { useEffect, useRef, useState } from "react";
import { CheckCircle2, Download, X } from "lucide-react";
import { downloadOfflinePack, offlineSupported, readPackMeta, type PackMeta } from "@/lib/client/offline-pack";
import { errorMessage } from "@/lib/client/api";
import { ErrorBanner, ProgressBar } from "./ui";

/**
 * Pre-downloads lessons and practice pages for offline use.
 * `lessonDays`: the lessons the learner can open now (completed + current).
 */
export function OfflineDownload({ lessonDays, compact = false }: { lessonDays: number[]; compact?: boolean }) {
  const [supported, setSupported] = useState(true);
  const [meta, setMeta] = useState<PackMeta | null>(null);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    setSupported(offlineSupported());
    setMeta(readPackMeta());
    return () => abortRef.current?.abort();
  }, []);

  async function start() {
    setError(null);
    abortRef.current = new AbortController();
    setProgress({ done: 0, total: 1 });
    try {
      const m = await downloadOfflinePack(lessonDays, (done, total) => setProgress({ done, total }), abortRef.current.signal);
      setMeta(m);
    } catch (e) {
      if ((e as DOMException).name !== "AbortError") setError(errorMessage(e));
    } finally {
      setProgress(null);
    }
  }

  if (!supported) return <p className="text-sm text-muted">This browser doesn&apos;t support offline mode.</p>;

  const busy = progress !== null;
  return (
    <div className="space-y-3">
      {!compact && (
        <ul className="list-disc space-y-1 pl-5 text-sm text-muted">
          <li>Downloads your open lessons (Day {Math.min(...lessonDays)}–{Math.max(...lessonDays)}), all 60 listening exercises for the 30 days, your flashcards and mistake review.</li>
          <li>Offline, listening answers and reviews are checked on your device and sync automatically when you&apos;re back online.</li>
          <li>Speaking, writing feedback and speech recognition still need a connection.</li>
        </ul>
      )}
      <div className="flex flex-wrap items-center gap-3">
        {busy ? (
          <>
            <div className="min-w-[10rem] flex-1">
              <ProgressBar value={(progress.done / Math.max(1, progress.total)) * 100} label="Download progress" />
              <p className="mt-1 text-xs text-muted" aria-live="polite">Downloading… {progress.done}/{progress.total}</p>
            </div>
            <button type="button" className="btn-ghost" onClick={() => abortRef.current?.abort()}><X className="h-4 w-4" aria-hidden /> Cancel</button>
          </>
        ) : (
          <button type="button" className={meta ? "btn-secondary" : "btn-primary"} onClick={start}>
            <Download className="h-4 w-4" aria-hidden /> {meta ? "Update offline download" : "Download for offline"}
          </button>
        )}
        {meta && !busy && (
          <p className="inline-flex items-center gap-1.5 text-xs text-muted">
            <CheckCircle2 className="h-4 w-4 text-success" aria-hidden />
            Ready offline · Days {Math.min(...meta.lessons)}–{Math.max(...meta.lessons)} · {new Date(meta.downloadedAt).toLocaleString()}
          </p>
        )}
      </div>
      {error && <ErrorBanner message={error} onRetry={start} />}
    </div>
  );
}
