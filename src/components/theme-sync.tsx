"use client";
import { useEffect } from "react";
import { applyTheme, type Theme } from "./theme";

/** Keeps the local theme in sync with the server-stored preference. */
export function ThemeSync({ theme }: { theme: string }) {
  useEffect(() => {
    let local: string | null = null;
    try {
      local = localStorage.getItem("efl-theme");
    } catch {
      /* ignore */
    }
    if (local !== theme) applyTheme(theme as Theme);
  }, [theme]);
  return null;
}
