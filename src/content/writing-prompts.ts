import type { WritingType } from "./types";

export interface FreeWritingPrompt {
  id: string;
  type: WritingType;
  title: string;
  prompt: string;
  minWords: number;
  maxWords: number;
}

/** Extra prompts for free practice in the Writing Studio (lesson prompts live in each lesson). */
export const FREE_WRITING_PROMPTS: FreeWritingPrompt[] = [
  { id: "free-diary-1", type: "diary", title: "Today's highlight", prompt: "Write a diary entry about the best moment of your day. What happened, who were you with, and why was it special?", minWords: 100, maxWords: 150 },
  { id: "free-opinion-1", type: "opinion", title: "Phones at dinner", prompt: "Should people put their phones away during meals? Give your opinion with two reasons and an example.", minWords: 100, maxWords: 150 },
  { id: "free-email-1", type: "email", title: "Hotel request", prompt: "Write an email to a hotel. You arrive late at night next Friday and need an airport shuttle and a quiet room. Ask about prices.", minWords: 100, maxWords: 150 },
  { id: "free-story-1", type: "story", title: "The wrong train", prompt: "Write a short story that begins: “I realised I was on the wrong train when…”", minWords: 100, maxWords: 150 },
  { id: "free-professional-1", type: "professional", title: "Shift swap", prompt: "Write a message to your manager asking to swap a work shift next week. Explain why and suggest a solution.", minWords: 100, maxWords: 150 },
  { id: "free-opinion-2", type: "opinion", title: "Learning languages with AI", prompt: "Can AI replace human teachers for learning languages? Give a balanced opinion with advantages and disadvantages.", minWords: 100, maxWords: 150 },
];
