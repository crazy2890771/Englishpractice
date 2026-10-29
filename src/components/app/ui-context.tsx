"use client";
import { createContext, useContext, type ReactNode } from "react";
import { makeL, type UiLang } from "@/i18n";

export interface UiPrefs {
  uiLang: UiLang;
  explanationLang: "th" | "en";
  showPinyin: boolean;
  playbackSpeed: number;
  correctionMode: string;
  ttsServer: boolean;
  sttServer: boolean;
  aiMode: "live" | "demo";
  saveRecordings: boolean;
  userId: string;
}

const Ctx = createContext<UiPrefs | null>(null);

export function UiProvider({ value, children }: { value: UiPrefs; children: ReactNode }) {
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function usePrefs() {
  const v = useContext(Ctx);
  if (!v) throw new Error("UiProvider missing");
  return v;
}

export function useL() {
  return makeL(usePrefs().uiLang);
}
