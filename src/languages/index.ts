import type { LanguageId } from "@/content/types";
import type { LanguageModule } from "./types";
import { english } from "./en";
import { chinese } from "./zh";

export const LANGUAGES: Record<LanguageId, LanguageModule> = { en: english, zh: chinese };
export const LANGUAGE_IDS = Object.keys(LANGUAGES) as LanguageId[];

export function lang(id: string): LanguageModule {
  const m = LANGUAGES[id as LanguageId];
  if (!m) throw new Error(`Unknown language ${id}`);
  return m;
}

export function isLanguage(id: string): id is LanguageId {
  return id in LANGUAGES;
}

export function levelIndex(id: LanguageId, code: string) {
  return LANGUAGES[id].levels.findIndex((l) => l.code === code);
}

export type { LanguageModule } from "./types";
