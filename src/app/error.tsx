"use client";
import { useEffect } from "react";

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => console.error(error), [error]);
  return (
    <div className="grid min-h-[60vh] place-items-center px-4">
      <div className="card max-w-md p-8 text-center">
        <h1 className="text-xl font-bold">Something went wrong</h1>
        <p className="mt-2 text-sm text-muted">Your progress is saved. Please try again — if it keeps happening, reload the page.</p>
        <div className="mt-6 flex justify-center gap-2">
          <button type="button" className="btn-primary" onClick={reset}>Try again</button>
          <a href="/dashboard" className="btn-secondary">Dashboard</a>
        </div>
      </div>
    </div>
  );
}
