"use client";
import clsx from "clsx";
import { AlertTriangle, Info, Loader2, RotateCcw } from "lucide-react";
import type { ReactNode } from "react";

export function Card({ className, children, ...rest }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={clsx("card", className)} {...rest}>
      {children}
    </div>
  );
}

export function Spinner({ className, label = "Loading" }: { className?: string; label?: string }) {
  return (
    <span role="status" aria-label={label} className="inline-flex">
      <Loader2 className={clsx("h-4 w-4 animate-spin", className)} aria-hidden />
    </span>
  );
}

export function ProgressBar({ value, className, color = "bg-brand", label }: { value: number; className?: string; color?: string; label?: string }) {
  const v = Math.max(0, Math.min(100, value));
  return (
    <div
      className={clsx("h-2 w-full overflow-hidden rounded-full bg-surface-2", className)}
      role="progressbar"
      aria-valuenow={Math.round(v)}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={label}
    >
      <div className={clsx("h-full rounded-full transition-all duration-500", color)} style={{ width: `${v}%` }} />
    </div>
  );
}

export function ErrorBanner({ message, onRetry, className }: { message: string; onRetry?: () => void; className?: string }) {
  return (
    <div role="alert" className={clsx("flex items-start gap-3 rounded-xl border border-danger/30 bg-danger/10 p-3 text-sm text-fg", className)}>
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-danger" aria-hidden />
      <p className="flex-1">{message}</p>
      {onRetry && (
        <button type="button" onClick={onRetry} className="inline-flex items-center gap-1 font-semibold text-danger hover:underline">
          <RotateCcw className="h-3.5 w-3.5" aria-hidden /> Retry
        </button>
      )}
    </div>
  );
}

export function Notice({ children, className, tone = "info" }: { children: ReactNode; className?: string; tone?: "info" | "warn" }) {
  return (
    <div className={clsx("flex items-start gap-2.5 rounded-xl border p-3 text-sm", tone === "warn" ? "border-warn/30 bg-warn/10" : "border-brand/25 bg-brand-soft/60", className)}>
      <Info className={clsx("mt-0.5 h-4 w-4 shrink-0", tone === "warn" ? "text-warn" : "text-brand")} aria-hidden />
      <div className="flex-1 text-fg/90">{children}</div>
    </div>
  );
}

export function EmptyState({ icon, title, children, action }: { icon?: ReactNode; title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border px-6 py-12 text-center">
      {icon && <div className="mb-3 text-muted">{icon}</div>}
      <h3 className="font-semibold">{title}</h3>
      {children && <div className="mt-1 max-w-sm text-sm text-muted">{children}</div>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function Badge({ children, tone = "default", className }: { children: ReactNode; tone?: "default" | "brand" | "success" | "warn" | "danger"; className?: string }) {
  const tones = {
    default: "bg-surface-2 text-muted border-border",
    brand: "bg-brand/15 text-brand border-brand/30",
    success: "bg-success/15 text-success border-success/30",
    warn: "bg-warn/15 text-warn border-warn/30",
    danger: "bg-danger/15 text-danger border-danger/30",
  };
  return <span className={clsx("inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-semibold", tones[tone], className)}>{children}</span>;
}

export function Tabs<T extends string>({ tabs, value, onChange, className }: { tabs: { id: T; label: string }[]; value: T; onChange: (v: T) => void; className?: string }) {
  return (
    <div role="tablist" className={clsx("flex gap-1 border-b border-border", className)}>
      {tabs.map((t) => (
        <button
          key={t.id}
          role="tab"
          type="button"
          aria-selected={value === t.id}
          onClick={() => onChange(t.id)}
          onKeyDown={(e) => {
            const i = tabs.findIndex((x) => x.id === value);
            if (e.key === "ArrowRight") onChange(tabs[(i + 1) % tabs.length]!.id);
            if (e.key === "ArrowLeft") onChange(tabs[(i - 1 + tabs.length) % tabs.length]!.id);
          }}
          className={clsx(
            "-mb-px border-b-2 px-3 py-2 text-sm font-medium transition-colors",
            value === t.id ? "border-brand text-fg" : "border-transparent text-muted hover:text-fg",
          )}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}

export function SectionTitle({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="mb-3 flex items-center justify-between gap-2">
      <h2 className="text-base font-semibold">{children}</h2>
      {action}
    </div>
  );
}

export function DemoBadge({ live }: { live: boolean }) {
  return live ? (
    <Badge tone="success">AI feedback</Badge>
  ) : (
    <Badge tone="warn" className="whitespace-nowrap">
      Demo · rule-based
    </Badge>
  );
}
