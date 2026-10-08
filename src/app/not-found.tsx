import Link from "next/link";

export default function NotFound() {
  return (
    <div className="grid min-h-[60vh] place-items-center px-4">
      <div className="text-center">
        <p className="text-sm font-semibold text-brand">404</p>
        <h1 className="mt-2 text-2xl font-bold">Page not found</h1>
        <p className="mt-2 text-sm text-muted">That page doesn&apos;t exist. Let&apos;s get you back to learning.</p>
        <Link href="/dashboard" className="btn-primary mt-6">Go to dashboard</Link>
      </div>
    </div>
  );
}
