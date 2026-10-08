export type Accent = "US" | "UK" | "AU" | "IN";
export type Level = "B1" | "B2";
export type WritingType = "diary" | "opinion" | "email" | "story" | "professional";

export interface DialogueLine {
  speaker: string;
  /** Used to choose a TTS voice. */
  voice: "female" | "male";
  text: string;
}

export interface ListeningQuestion {
  id: string;
  type: "mcq" | "fill" | "comprehension";
  prompt: string;
  /** mcq / comprehension: options; answer is the index of the correct option. */
  options?: string[];
  /** mcq/comprehension: index into options. fill: the expected word/phrase. */
  answer: number | string;
  /** fill only: additional accepted answers (case-insensitive). */
  accept?: string[];
  explanation: string;
}

export interface ListeningExercise {
  id: string;
  title: string;
  scenario: string;
  accent: Accent;
  level: Level;
  lines: DialogueLine[];
  questions: ListeningQuestion[];
}

export interface VocabTarget {
  word: string;
  definition: string;
  example: string;
}

export interface ShadowingSentence {
  text: string;
  /** What to pay attention to: stress, linking, intonation… */
  focus: string;
}

export interface Lesson {
  day: number;
  week: 1 | 2 | 3 | 4;
  title: string;
  theme: string;
  summary: string;
  objectives: string[];
  speaking: {
    topic: string;
    goal: string;
    openingQuestion: string;
    followUps: string[];
    usefulPhrases: string[];
    /** Number of learner turns needed to complete the speaking step. */
    targetTurns: number;
    /** Week 4: seconds allowed per answer (timed responses). */
    timedResponseSec?: number;
  };
  listening: {
    /** Default exercise. */
    standard: ListeningExercise;
    /** Harder variant used when recent accuracy is high (adaptive). */
    challenge: ListeningExercise;
  };
  writing: {
    type: WritingType;
    prompt: string;
    tips: string[];
    minWords: number;
    maxWords: number;
  };
  shadowing: ShadowingSentence[];
  vocabulary: VocabTarget[];
  review: string[];
  completion: {
    speakingTurns: number;
    listeningMinPercent: number;
    writingMinWords: number;
    shadowingSentences: number;
    reviewItems: number;
  };
}

export interface RoleplayScenario {
  id: string;
  title: string;
  category: "interview" | "hotel" | "airport" | "workplace" | "customer-service" | "aviation";
  setting: string;
  character: { name: string; role: string; personality: string };
  learnerRole: string;
  objectives: string[];
  opening: string;
  /** Scripted character lines used in demo mode, in order. */
  demoTurns: string[];
  closing: string;
  usefulPhrases: string[];
  level: Level;
}

export interface TopicBank {
  id: "daily-life" | "hobbies" | "travel" | "work" | "aviation" | "interviews";
  label: string;
  questions: string[];
}
