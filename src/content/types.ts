/**
 * Fluency Lab content model.
 * Curriculum hierarchy: Language → Skill → Level → Unit → Lesson → Exercise.
 * All static content is plain data, validated by tests (see tests/unit/content.test.ts).
 */

export type LanguageId = "en" | "zh";
export type Skill = "listening" | "speaking" | "reading" | "writing" | "vocabulary";
export const SKILLS: Skill[] = ["listening", "speaking", "reading", "writing", "vocabulary"];

/** Topic categories that personalise content (never override proficiency). */
export type Topic = "daily" | "travel" | "business" | "aviation" | "interviews" | "news" | "mixed";

export interface Speaker {
  name: string;
  voice: "female" | "male";
}

/** A line of spoken text. For Chinese, `pinyin` (tone marks) and `th` (Thai translation) are required. */
export interface Line {
  speaker?: string;
  text: string;
  pinyin?: string;
  th?: string;
}

/** Listening material, played with text-to-speech. Text is hidden until the learner answers. */
export interface Dialogue {
  id: string;
  title: string;
  speakers: Speaker[];
  lines: Line[];
}

/** Glossary entry used for tap-to-define in reading passages. */
export interface GlossaryEntry {
  word: string;
  meaningTh: string;
  meaningEn?: string;
  pronunciation?: string; // IPA-ish for English (optional), pinyin for Chinese (required)
  example?: string;
}

/** Reading material. Chinese passages provide per-sentence pinyin and Thai translation in `lines`. */
export interface Passage {
  id: string;
  title: string;
  /** Sentences/paragraphs in order. */
  lines: Line[];
  glossary: GlossaryEntry[];
}

export interface VocabEntry {
  word: string;
  /** Pinyin (Chinese, required) or a simple pronunciation guide (English, optional). */
  pronunciation?: string;
  partOfSpeech?: string;
  meaningTh: string;
  meaningEn: string;
  example: string;
  examplePinyin?: string;
  exampleTh: string;
  /** 1 (easy) – 5 (hard) relative to the unit level. */
  difficulty: 1 | 2 | 3 | 4 | 5;
}

export interface GrammarPoint {
  id: string;
  title: string;
  /** Short explanation in Thai. */
  explanationTh: string;
  /** Short explanation in English. */
  explanationEn: string;
  examples: Line[];
}

export interface Objective {
  id: string;
  skill: Skill;
  textTh: string;
  textEn: string;
}

/* ───────────────────────── Exercises ───────────────────────── */

interface ExerciseBase {
  /** Globally unique, e.g. "en-b1-u2-p07". */
  id: string;
  skill: Skill;
  /** Objective id within the unit (or exam section id). */
  objective: string;
  /** Weakness categories this exercise trains (ids from the language module, e.g. "en.articles"). */
  tags: string[];
  /** Dialogue id (listening) or passage id (reading) this exercise refers to. */
  source?: string;
  /** Prompt in the target language. Use "___" for blanks. */
  prompt: string;
  promptPinyin?: string;
  /** Thai translation/clarification of the prompt (required for Chinese HSK 1–3; optional otherwise). */
  promptTh?: string;
  /** Shown after answering. Thai first; English optional. */
  explanationTh: string;
  explanationEn?: string;
}

/** Choose one option. Used for detail, main idea, inference, vocabulary-in-context, tones… */
export interface McqExercise extends ExerciseBase {
  type: "mcq";
  subtype?: "detail" | "main_idea" | "inference" | "vocab_in_context" | "grammar" | "tone" | "character" | "meaning";
  options: string[];
  answer: number;
}

export interface TrueFalseExercise extends ExerciseBase {
  type: "true_false";
  answer: boolean;
}

/** Type the missing word(s). All accepted answers listed (case/punctuation-insensitive). */
export interface FillBlankExercise extends ExerciseBase {
  type: "fill_blank";
  answers: string[];
}

/** Listen to `audio` and type it. Scored by word (en) or character (zh) match. `prompt` is an instruction. */
export interface ListenTypeExercise extends ExerciseBase {
  type: "listen_type";
  audio: string;
  audioPinyin?: string;
}

/** Put tokens in the right order. `tokens` is the CORRECT order; the app shuffles them. */
export interface SentenceOrderExercise extends ExerciseBase {
  type: "sentence_order";
  tokens: string[];
}

/** Match left items to right items. `pairs` is the correct matching. */
export interface MatchPairsExercise extends ExerciseBase {
  type: "match_pairs";
  pairs: [string, string][];
}

/** Recall a word from a definition/translation in `prompt`. */
export interface WordRecallExercise extends ExerciseBase {
  type: "word_recall";
  answers: string[];
}

/** Find and fix the error in `prompt` (a sentence with one mistake). */
export interface CorrectionExercise extends ExerciseBase {
  type: "sentence_correction";
  answers: string[];
}

/** Open writing task, evaluated by rubric (AI or clearly-labelled demo rules). */
export interface OpenWritingExercise extends ExerciseBase {
  type: "open_writing";
  /** Minimum length: words for English, characters for Chinese. */
  minLength: number;
  maxLength: number;
  /** Things the answer must contain (used in rubric "task completion"). */
  requirements: string[];
  modelAnswer: string;
}

/** Spoken answer to a question (record → transcribe → evaluate). */
export interface SpeakingResponseExercise extends ExerciseBase {
  type: "speaking_response";
  minLength: number;
  requirements: string[];
  modelAnswer: string;
}

/** Listen and repeat / shadowing. Compared by recognised words/characters, not phonemes. */
export interface RepeatSentenceExercise extends ExerciseBase {
  type: "repeat_sentence";
  /** = prompt; kept separate for clarity */
  text: string;
  pinyin?: string;
}

export type Exercise =
  | McqExercise
  | TrueFalseExercise
  | FillBlankExercise
  | ListenTypeExercise
  | SentenceOrderExercise
  | MatchPairsExercise
  | WordRecallExercise
  | CorrectionExercise
  | OpenWritingExercise
  | SpeakingResponseExercise
  | RepeatSentenceExercise;

export type ExerciseType = Exercise["type"];
export const OPEN_TYPES: ExerciseType[] = ["open_writing", "speaking_response"];

/* ───────────────────────── Units, levels, exams ───────────────────────── */

export interface Unit {
  /** e.g. "en-b1-u2" */
  id: string;
  language: LanguageId;
  /** Level id from the language framework, e.g. "B1" or "HSK2". */
  level: string;
  /** 1-based order within the level. */
  order: number;
  title: string;
  titleTh: string;
  topics: Topic[];
  objectives: Objective[];
  grammar: GrammarPoint[];
  vocabulary: VocabEntry[];
  dialogues: Dialogue[];
  passages: Passage[];
  /** Practice bank (all five skills). */
  exercises: Exercise[];
  /** Unit assessment bank (all five skills, NOT reused in practice). */
  assessment: Exercise[];
}

export interface ExamSection {
  id: string;
  titleTh: string;
  titleEn: string;
  /** Every required section must reach the section pass mark. */
  required: boolean;
  /** Pool to draw from (larger than `draw` so retakes get fresh questions). */
  pool: Exercise[];
  draw: number;
}

/** Level examination for one skill at one level. */
export interface LevelExam {
  id: string; // "en-B1-reading"
  language: LanguageId;
  level: string;
  skill: Skill;
  sections: ExamSection[];
  dialogues: Dialogue[];
  passages: Passage[];
}

/** Placement item: an exercise tagged with the level it discriminates. */
export type PlacementItem = Exercise & { level: string };

export interface PlacementBank {
  language: LanguageId;
  dialogues: Dialogue[];
  passages: Passage[];
  items: PlacementItem[];
}
