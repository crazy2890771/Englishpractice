"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { BarChart3, BookOpen, Dumbbell, Sun, UserRound } from "lucide-react";
import { cn } from "@/lib/utils";
import { useL, usePrefs } from "./ui-context";
import { Logo } from "./logo";

const TABS = [
  { href: "/today", icon: Sun, th: "วันนี้", en: "Today" },
  { href: "/learn", icon: BookOpen, th: "บทเรียน", en: "Learn" },
  { href: "/practice", icon: Dumbbell, th: "ฝึกฝน", en: "Practice" },
  { href: "/progress", icon: BarChart3, th: "พัฒนาการ", en: "Progress" },
  { href: "/profile", icon: UserRound, th: "โปรไฟล์", en: "Profile" },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const L = useL();
  const { aiMode } = usePrefs();
  const active = (href: string) => pathname === href || pathname.startsWith(`${href}/`);
  const focusMode = pathname.startsWith("/session/") || pathname.startsWith("/placement/") || pathname.startsWith("/conversation/");

  return (
    <div className="min-h-dvh md:flex">
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:rounded-lg focus:bg-primary focus:px-3 focus:py-2 focus:text-primary-foreground">
        {L("ข้ามไปยังเนื้อหา", "Skip to content")}
      </a>
      <aside className="sticky top-0 hidden h-dvh w-60 shrink-0 flex-col border-r bg-card/60 px-3 py-6 md:flex">
        <Link href="/today" className="mb-8 px-3">
          <Logo />
        </Link>
        <nav aria-label={L("เมนูหลัก", "Main")} className="flex flex-col gap-1">
          {TABS.map(({ href, icon: Icon, th, en }) => (
            <Link
              key={href}
              href={href}
              aria-current={active(href) ? "page" : undefined}
              className={cn("flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors", active(href) ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:bg-secondary hover:text-foreground")}
            >
              <Icon className="size-[18px]" aria-hidden />
              {L(th, en)}
            </Link>
          ))}
        </nav>
        {aiMode === "demo" && (
          <p className="mt-auto rounded-xl bg-secondary px-3 py-2 text-xs leading-relaxed text-muted-foreground">
            {L("โหมดเดโม: ข้อสอบปรนัยตรวจได้จริง ส่วนการพูด/เขียนใช้ฟีดแบ็กแบบกฎ (ไม่ใช่ AI)", "Demo mode: objective questions are scored for real; speaking/writing feedback is rule-based (not AI).")}
          </p>
        )}
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <main id="main" className={cn("mx-auto w-full max-w-5xl flex-1 px-4 pt-safe sm:px-6 lg:px-10", focusMode ? "pb-10 pt-4" : "pb-28 pt-6 md:pb-12 md:pt-10")}>
          {children}
        </main>
      </div>

      {!focusMode && (
        <nav aria-label={L("เมนูหลัก", "Main")} className="pb-safe fixed inset-x-0 bottom-0 z-40 grid grid-cols-5 border-t bg-background/95 backdrop-blur md:hidden">
          {TABS.map(({ href, icon: Icon, th, en }) => (
            <Link key={href} href={href} aria-current={active(href) ? "page" : undefined} className={cn("flex flex-col items-center gap-1 pt-2.5 pb-2 text-[11px] font-medium", active(href) ? "text-primary" : "text-muted-foreground")}>
              <Icon className="size-5" aria-hidden />
              {L(th, en)}
            </Link>
          ))}
        </nav>
      )}
    </div>
  );
}
