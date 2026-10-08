import Link from "next/link";
import { WifiOff } from "lucide-react";

export const metadata = { title: "Offline" };

export default function Offline() {
  return (
    <div className="grid min-h-dvh place-items-center px-4">
      <div className="card max-w-md p-8 text-center">
        <WifiOff className="mx-auto h-10 w-10 text-muted" aria-hidden />
        <h1 className="mt-4 text-xl font-bold">You&apos;re offline</h1>
        <p className="mt-2 text-sm text-muted">
          Pages you&apos;ve opened before (lessons, notebook, vocabulary) and your saved writing drafts are still available. AI feedback, speech recognition and new voices need an internet connection.
        </p>
        <Link href="/dashboard" className="btn-primary mt-6">Try again</Link>
      </div>
    </div>
  );
}
