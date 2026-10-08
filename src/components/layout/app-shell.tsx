"use client";
import clsx from "clsx";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogOut, Menu, X } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { Logo } from "../logo";
import { ThemeToggle } from "../theme";
import { MOBILE_TABS, NAV_ITEMS, SETTINGS_ITEM } from "./nav-items";
import { useAppConfig } from "../providers";
import { StudyTracker } from "../study-tracker";

function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

function NavLink({ item, pathname, compact, onClick }: { item: (typeof NAV_ITEMS)[number] | typeof SETTINGS_ITEM; pathname: string; compact?: boolean; onClick?: () => void }) {
  const active = isActive(pathname, item.href);
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      onClick={onClick}
      aria-current={active ? "page" : undefined}
      title={compact ? item.label : undefined}
      className={clsx(
        "group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
        compact && "justify-center px-0 xl:justify-start xl:px-3",
        active ? "bg-brand/15 text-fg ring-1 ring-brand/30" : "text-muted hover:bg-surface-2 hover:text-fg",
      )}
    >
      <Icon className={clsx("h-5 w-5 shrink-0", active && "text-brand")} aria-hidden />
      <span className={clsx(compact && "sr-only xl:not-sr-only")}>{item.label}</span>
    </Link>
  );
}

async function signOut() {
  await fetch("/api/auth/logout", { method: "POST" });
  try {
    if ("caches" in window) for (const k of await caches.keys()) if (k.startsWith("efl-pages")) await caches.delete(k);
  } catch {
    /* ignore */
  }
  window.location.href = "/welcome";
}

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { user, providers } = useAppConfig();
  const [open, setOpen] = useState(false);
  const [offline, setOffline] = useState(false);

  useEffect(() => setOpen(false), [pathname]);
  useEffect(() => {
    const update = () => setOffline(!navigator.onLine);
    update();
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const initials = user.name.slice(0, 1).toUpperCase();

  return (
    <div className="min-h-dvh md:flex">
      <StudyTracker active={false} />
      {/* Sidebar: icon rail on tablets, full on desktop */}
      <aside className="sticky top-0 hidden h-dvh w-20 shrink-0 flex-col border-r border-border bg-surface/60 px-3 py-5 backdrop-blur md:flex xl:w-64">
        <Link href="/dashboard" className="mb-6 flex justify-center xl:justify-start xl:px-2" aria-label="English Fluency Lab home">
          <span className="hidden xl:block"><Logo /></span>
          <span className="xl:hidden"><Logo /></span>
        </Link>
        <nav aria-label="Main" className="flex flex-1 flex-col gap-1 overflow-y-auto">
          {NAV_ITEMS.map((item) => (
            <NavLink key={item.href} item={item} pathname={pathname} compact />
          ))}
        </nav>
        <div className="mt-4 space-y-1 border-t border-border pt-4">
          <NavLink item={SETTINGS_ITEM} pathname={pathname} compact />
          <div className="flex items-center gap-3 rounded-xl px-1 py-2 xl:px-2">
            <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-gradient-to-br from-blue-500 to-violet-600 text-sm font-bold text-white" aria-hidden>
              {initials}
            </div>
            <div className="hidden min-w-0 flex-1 xl:block">
              <p className="truncate text-sm font-semibold">{user.name}</p>
              <p className="truncate text-xs text-muted">{user.isDemo ? "Demo account" : `Level ${user.level}`}</p>
            </div>
            <button type="button" onClick={signOut} className="btn-ghost hidden h-8 w-8 p-0 xl:inline-flex" aria-label="Sign out">
              <LogOut className="h-4 w-4" aria-hidden />
            </button>
          </div>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Mobile top bar */}
        <header className="sticky top-0 z-30 flex items-center justify-between border-b border-border bg-bg/80 px-4 py-3 backdrop-blur md:hidden" style={{ paddingTop: "max(0.75rem, env(safe-area-inset-top))" }}>
          <Link href="/dashboard" aria-label="Home"><Logo /></Link>
          <div className="flex items-center gap-1">
            <ThemeToggle />
            <button type="button" className="btn-ghost h-10 w-10 p-0" aria-label="Open menu" aria-expanded={open} onClick={() => setOpen(true)}>
              <Menu className="h-5 w-5" aria-hidden />
            </button>
          </div>
        </header>

        {(offline || providers.mode === "demo") && (
          <div className={clsx("px-4 py-1.5 text-center text-xs font-medium", offline ? "bg-warn/20 text-fg" : "bg-brand-soft text-fg/80")}>
            {offline
              ? "You're offline — cached lessons and saved text are available; AI and audio features need a connection."
              : "Demo mode: feedback is rule-based and speech uses your browser. Add AI keys on the server for full AI feedback."}
          </div>
        )}

        <main id="main" className="mx-auto w-full max-w-7xl flex-1 px-4 pb-28 pt-5 sm:px-6 md:pb-10 lg:px-8">
          {children}
        </main>
      </div>

      {/* Mobile bottom tabs */}
      <nav aria-label="Quick" className="pb-safe fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 border-t border-border bg-surface/95 backdrop-blur md:hidden">
        {MOBILE_TABS.map((href) => {
          const item = NAV_ITEMS.find((n) => n.href === href)!;
          const Icon = item.icon;
          const active = isActive(pathname, href);
          return (
            <Link key={href} href={href} aria-current={active ? "page" : undefined} className={clsx("flex flex-col items-center gap-0.5 py-2 text-[11px] font-medium", active ? "text-brand" : "text-muted")}>
              <Icon className="h-5 w-5" aria-hidden />
              {item.label}
            </Link>
          );
        })}
        <button type="button" onClick={() => setOpen(true)} className="flex flex-col items-center gap-0.5 py-2 text-[11px] font-medium text-muted" aria-label="More navigation">
          <Menu className="h-5 w-5" aria-hidden />
          More
        </button>
      </nav>

      {/* Mobile drawer */}
      {open && (
        <div className="fixed inset-0 z-40 md:hidden" role="dialog" aria-modal="true" aria-label="Navigation">
          <button type="button" className="absolute inset-0 bg-black/60" aria-label="Close menu" onClick={() => setOpen(false)} />
          <div className="absolute inset-y-0 right-0 flex w-72 max-w-[85vw] animate-fade-in flex-col bg-surface p-4" style={{ paddingTop: "max(1rem, env(safe-area-inset-top))" }}>
            <div className="mb-4 flex items-center justify-between">
              <span className="font-semibold">Menu</span>
              <button type="button" className="btn-ghost h-10 w-10 p-0" onClick={() => setOpen(false)} aria-label="Close menu" autoFocus>
                <X className="h-5 w-5" aria-hidden />
              </button>
            </div>
            <nav className="flex flex-1 flex-col gap-1 overflow-y-auto" aria-label="All pages">
              {[...NAV_ITEMS, SETTINGS_ITEM].map((item) => (
                <NavLink key={item.href} item={item} pathname={pathname} onClick={() => setOpen(false)} />
              ))}
            </nav>
            <button type="button" onClick={signOut} className="btn-secondary mt-3 w-full">
              <LogOut className="h-4 w-4" aria-hidden /> Sign out
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
