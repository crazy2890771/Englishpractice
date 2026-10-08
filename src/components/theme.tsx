"use client";
import { Moon, Sun } from "lucide-react";
import { useEffect, useState } from "react";

export type Theme = "system" | "light" | "dark";

/** Inline script that applies the theme before first paint (prevents flashing). */
export const themeScript = `(function(){try{var t=localStorage.getItem('efl-theme')||'dark';var d=t==='dark'||(t==='system'&&matchMedia('(prefers-color-scheme: dark)').matches);document.documentElement.classList.toggle('dark',d);}catch(e){document.documentElement.classList.add('dark');}})();`;

export function applyTheme(theme: Theme) {
  try {
    localStorage.setItem("efl-theme", theme);
  } catch {
    /* storage unavailable */
  }
  const dark = theme === "dark" || (theme === "system" && matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.classList.toggle("dark", dark);
}

export function ThemeToggle({ className }: { className?: string }) {
  const [dark, setDark] = useState(true);
  useEffect(() => setDark(document.documentElement.classList.contains("dark")), []);
  return (
    <button
      type="button"
      className={className ?? "btn-ghost h-10 w-10 p-0"}
      aria-label={dark ? "Switch to light mode" : "Switch to dark mode"}
      onClick={() => {
        const next = dark ? "light" : "dark";
        applyTheme(next);
        setDark(!dark);
        fetch("/api/settings", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ theme: next }) }).catch(() => {});
      }}
    >
      {dark ? <Sun className="h-5 w-5" aria-hidden /> : <Moon className="h-5 w-5" aria-hidden />}
    </button>
  );
}
