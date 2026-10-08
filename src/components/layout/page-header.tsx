import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import type { ReactNode } from "react";

export function PageHeader({ title, subtitle, back, actions }: { title: string; subtitle?: string; back?: string; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
      <div className="flex min-w-0 items-start gap-3">
        {back && (
          <Link href={back} className="btn-ghost mt-0.5 h-10 w-10 shrink-0 rounded-full border border-border p-0" aria-label="Back">
            <ArrowLeft className="h-4 w-4" aria-hidden />
          </Link>
        )}
        <div className="min-w-0">
          <h1 className="h-page">{title}</h1>
          {subtitle && <p className="mt-1 text-sm text-muted">{subtitle}</p>}
        </div>
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}
