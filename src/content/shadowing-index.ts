import type { ShadowingSentence } from "./types";
import { lessons } from "./curriculum";

export function shadowingId(day: number, index: number) {
  return `d${day}-sh${index + 1}`;
}

const index = new Map<string, ShadowingSentence & { day: number }>();
for (const l of lessons) l.shadowing.forEach((s, i) => index.set(shadowingId(l.day, i), { ...s, day: l.day }));

export function findShadowingSentence(id: string) {
  return index.get(id);
}
