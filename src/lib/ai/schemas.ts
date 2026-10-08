import { z } from "zod";

/** All AI outputs are validated against these schemas before use. */

export const categorySchema = z.enum(["grammar", "vocabulary", "pronunciation", "expression"]);
export type FeedbackCategory = z.infer<typeof categorySchema>;

const band = z.number().int().min(1).max(5);

export const feedbackItemSchema = z.object({
  original: z.string().min(1).max(400),
  corrected: z.string().min(1).max(400),
  natural: z.string().max(400).optional().default(""),
  category: categorySchema,
  explanation: z.string().min(1).max(400),
});
export type FeedbackItem = z.infer<typeof feedbackItemSchema>;

export const speakingScoresSchema = z.object({
  grammar: band,
  vocabulary: band,
  fluency: band,
  taskCompletion: band,
});
export type SpeakingScores = z.infer<typeof speakingScoresSchema>;

export const turnFeedbackSchema = z.object({
  original: z.string(),
  corrected: z.string(),
  natural: z.string(),
  items: z.array(feedbackItemSchema).max(6),
  suggestedVocabulary: z.array(z.string().max(80)).max(6),
  followUpExercise: z.string().max(400),
  scores: speakingScoresSchema,
});
export type TurnFeedback = z.infer<typeof turnFeedbackSchema>;

export const chatTurnSchema = z.object({
  reply: z.string().min(1).max(1200),
  feedback: turnFeedbackSchema,
  /** Roleplay: true when the character wraps up the scenario. */
  scenarioComplete: z.boolean().optional().default(false),
});
export type ChatTurn = z.infer<typeof chatTurnSchema>;

export const writingScoresSchema = z.object({
  grammar: band,
  vocabulary: band,
  clarity: band,
  coherence: band,
  taskCompletion: band,
});
export type WritingScores = z.infer<typeof writingScoresSchema>;

export const writingFeedbackSchema = z.object({
  overall: z.string().min(1).max(800),
  corrected: z.string().min(1),
  natural: z.string().min(1),
  items: z.array(feedbackItemSchema).max(12),
  scores: writingScoresSchema,
  weaknesses: z.array(z.string().max(120)).max(5),
  suggestedVocabulary: z.array(z.string().max(80)).max(6),
  followUpExercise: z.string().max(400),
  tip: z.string().max(300),
});
export type WritingFeedback = z.infer<typeof writingFeedbackSchema>;

export const roleplaySummarySchema = z.object({
  appropriateness: band,
  clarity: band,
  naturalness: band,
  objectivesMet: z.array(z.boolean()),
  comments: z.string().max(800),
  betterPhrases: z.array(z.object({ original: z.string(), better: z.string() })).max(5),
});
export type RoleplaySummary = z.infer<typeof roleplaySummarySchema>;

/** Rubrics shown in the UI and embedded in every scoring prompt so scores stay comparable. */
export const RUBRICS: Record<string, { label: string; bands: Record<1 | 2 | 3 | 4 | 5, string> }> = {
  grammar: {
    label: "Grammar",
    bands: {
      1: "Frequent errors that block meaning.",
      2: "Many errors; meaning often unclear.",
      3: "Some errors in complex structures; meaning clear.",
      4: "Occasional minor slips; good control.",
      5: "Accurate, with a range of structures.",
    },
  },
  vocabulary: {
    label: "Vocabulary",
    bands: {
      1: "Very limited, repetitive words.",
      2: "Basic words; frequent gaps.",
      3: "Adequate for everyday topics; some repetition.",
      4: "Varied and mostly precise; some collocations.",
      5: "Wide, precise and natural word choice.",
    },
  },
  fluency: {
    label: "Fluency",
    bands: {
      1: "Single words or very short fragments.",
      2: "Short, simple sentences; little development.",
      3: "Connected answers with some development.",
      4: "Extended, well-linked answers.",
      5: "Effortless, extended, well-organised speech.",
    },
  },
  taskCompletion: {
    label: "Task completion",
    bands: {
      1: "Does not address the task.",
      2: "Partly addresses the task.",
      3: "Addresses the task with limited detail.",
      4: "Fully addresses the task with relevant detail.",
      5: "Fully addresses the task with rich, well-chosen detail.",
    },
  },
  clarity: {
    label: "Clarity",
    bands: {
      1: "Hard to follow.",
      2: "Often unclear sentences.",
      3: "Mostly clear; some awkward sentences.",
      4: "Clear and easy to read.",
      5: "Very clear, concise and well-phrased.",
    },
  },
  appropriateness: {
    label: "Appropriateness",
    bands: {
      1: "Wrong register; may sound rude.",
      2: "Often too direct or too informal.",
      3: "Mostly suitable; some abrupt phrases.",
      4: "Polite and suitable for the situation.",
      5: "Perfectly judged tone and politeness.",
    },
  },
  naturalness: {
    label: "Naturalness",
    bands: {
      1: "Word-by-word translation.",
      2: "Understandable but unnatural.",
      3: "Some natural phrases; some awkward ones.",
      4: "Mostly natural and idiomatic.",
      5: "Sounds like a fluent speaker.",
    },
  },
  coherence: {
    label: "Coherence",
    bands: {
      1: "No logical order.",
      2: "Weak organisation; few linking words.",
      3: "Logical order; basic linking words.",
      4: "Well organised with varied linking.",
      5: "Smooth, logical flow throughout.",
    },
  },
};

export function bandToPercent(b: number) {
  return Math.round((b / 5) * 100);
}

export function rubricText(keys: string[]) {
  return keys
    .map((k) => {
      const r = RUBRICS[k]!;
      return `${k} (${r.label}): ` + Object.entries(r.bands).map(([n, t]) => `${n}=${t}`).join(" ");
    })
    .join("\n");
}
