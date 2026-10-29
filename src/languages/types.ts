import type { LanguageId, Skill } from "@/content/types";

export interface LevelDef {
  code: string;
  nameTh: string;
  descriptionTh: string;
}

/**
 * Everything the app needs to teach a language. Adding a language = adding a module
 * (levels, speech codes, tutor instructions, rubric notes) plus content files.
 */
export interface LanguageModule {
  id: LanguageId;
  nameEn: string;
  nameTh: string;
  nativeName: string;
  framework: string;
  frameworkNoteTh: string;
  levels: LevelDef[];
  skills: Skill[];
  /** Placement starts here ("moderate difficulty"). */
  placementStart: string;
  /** BCP-47 codes for speech. */
  ttsLang: string;
  sttLang: string;
  writingSystem: "latin" | "hanzi";
  /** Length unit for open tasks. */
  lengthUnit: "words" | "characters";
  supportsPinyin: boolean;
  /** Extra instructions for the AI tutor/evaluator in this language. */
  tutorNotes: string;
  /** Extra rubric criteria (e.g. tones for Chinese). */
  rubricNotes: string;
}
