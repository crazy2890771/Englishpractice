import type { ListeningExercise } from "./types";
import { lessons } from "./curriculum";
import { assessment } from "./assessment";

const index = new Map<string, ListeningExercise>();
for (const l of lessons) {
  index.set(l.listening.standard.id, l.listening.standard);
  index.set(l.listening.challenge.id, l.listening.challenge);
}
index.set(assessment.listening.id, assessment.listening);

export function findListeningExercise(id: string) {
  return index.get(id);
}

/** Library for free practice: every lesson exercise, with its lesson day. */
export const listeningLibrary = lessons.flatMap((l) => [
  { day: l.day, variant: "standard" as const, exercise: l.listening.standard },
  { day: l.day, variant: "challenge" as const, exercise: l.listening.challenge },
]);
