"use client";
import { createContext, useContext, type ReactNode } from "react";

export interface ClientConfig {
  user: { id: string; name: string; level: string; isDemo: boolean; email: string };
  settings: {
    theme: string;
    speechRate: number;
    accent: string;
    saveRecordings: boolean;
    interruptionFree: boolean;
  };
  providers: { llm: string; stt: "openai" | "browser"; tts: "openai" | "browser"; mode: "live" | "demo" };
}

const Ctx = createContext<ClientConfig | null>(null);

export function AppConfigProvider({ value, children }: { value: ClientConfig; children: ReactNode }) {
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAppConfig() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useAppConfig must be used inside AppConfigProvider");
  return v;
}
