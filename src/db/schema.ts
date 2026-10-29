/**
 * Fluency Lab database schema (PostgreSQL / Supabase).
 *
 * Source of truth for tables AND row-level security policies: `npm run db:generate`
 * turns this file into SQL migrations under supabase/migrations.
 *
 * Security model:
 * - Every user-owned row has `user_id` referencing auth.users and an RLS policy
 *   `user_id = auth.uid()` for the `authenticated` role.
 * - The server never queries user data as the table owner: it runs each request inside a
 *   transaction with `set local role authenticated` + the verified JWT claims (see src/db/index.ts),
 *   so RLS applies even if a query forgets a `where user_id = …` filter.
 * - Curriculum content tables are read-only for authenticated users and written only by the seed script.
 */
import { sql } from "drizzle-orm";
import {
  boolean,
  date,
  doublePrecision,
  index,
  integer,
  jsonb,
  pgPolicy,
  pgTable,
  primaryKey,
  smallint,
  text,
  timestamp,
  unique,
  uuid,
  type AnyPgColumn,
} from "drizzle-orm/pg-core";
import { authenticatedRole, authUid, authUsers } from "drizzle-orm/supabase";

const createdAt = () => timestamp("created_at", { withTimezone: true }).notNull().defaultNow();
const updatedAt = () => timestamp("updated_at", { withTimezone: true }).notNull().defaultNow();
const userId = () =>
  uuid("user_id")
    .notNull()
    .references(() => authUsers.id, { onDelete: "cascade" });

/** RLS: a user can only see and change their own rows. */
function own(name: string, col: AnyPgColumn) {
  return pgPolicy(`${name}_own`, {
    as: "permissive",
    to: authenticatedRole,
    for: "all",
    using: sql`${col} = ${authUid}`,
    withCheck: sql`${col} = ${authUid}`,
  });
}

/** RLS: curriculum content is readable by any signed-in user. */
function readable(name: string) {
  return pgPolicy(`${name}_read`, { as: "permissive", to: authenticatedRole, for: "select", using: sql`true` });
}

/* ───────────────────────── Curriculum content (seeded) ───────────────────────── */

export const languages = pgTable(
  "languages",
  {
    id: text("id").primaryKey(), // "en", "zh"
    nameEn: text("name_en").notNull(),
    nameTh: text("name_th").notNull(),
    framework: text("framework").notNull(), // "CEFR", "HSK 3.0"
    levels: text("levels").array().notNull(), // ordered level codes
    enabled: boolean("enabled").notNull().default(true),
  },
  () => [readable("languages")],
);

export const curriculumLevels = pgTable(
  "curriculum_levels",
  {
    id: text("id").primaryKey(), // "en:B1"
    languageId: text("language_id").notNull().references(() => languages.id),
    code: text("code").notNull(), // "B1"
    ord: smallint("ord").notNull(),
    nameTh: text("name_th").notNull(),
    hasContent: boolean("has_content").notNull().default(false),
  },
  (t) => [unique().on(t.languageId, t.code), readable("curriculum_levels")],
);

export const weaknessCategories = pgTable(
  "weakness_categories",
  {
    id: text("id").primaryKey(), // "en.articles"
    languageId: text("language_id").notNull().references(() => languages.id),
    skill: text("skill").notNull(),
    nameEn: text("name_en").notNull(),
    nameTh: text("name_th").notNull(),
  },
  () => [readable("weakness_categories")],
);

export const units = pgTable(
  "units",
  {
    id: text("id").primaryKey(), // "en-b1-u2"
    languageId: text("language_id").notNull().references(() => languages.id),
    levelCode: text("level_code").notNull(),
    ord: smallint("ord").notNull(),
    title: text("title").notNull(),
    titleTh: text("title_th").notNull(),
    topics: text("topics").array().notNull(),
    /** objectives, grammar, vocabulary, dialogues, passages */
    data: jsonb("data").notNull(),
  },
  (t) => [index().on(t.languageId, t.levelCode, t.ord), readable("units")],
);

/** One lesson per unit and skill (the unit's skill track). */
export const lessons = pgTable(
  "lessons",
  {
    id: text("id").primaryKey(), // "en-b1-u2:listening"
    unitId: text("unit_id").notNull().references(() => units.id, { onDelete: "cascade" }),
    skill: text("skill").notNull(),
    title: text("title").notNull(),
  },
  () => [readable("lessons")],
);

export const exercises = pgTable(
  "exercises",
  {
    id: text("id").primaryKey(),
    languageId: text("language_id").notNull().references(() => languages.id),
    unitId: text("unit_id").references(() => units.id, { onDelete: "cascade" }),
    levelCode: text("level_code").notNull(),
    skill: text("skill").notNull(),
    type: text("type").notNull(),
    objective: text("objective").notNull(),
    /** practice | unit_assessment | placement | level_exam | generated */
    purpose: text("purpose").notNull(),
    tags: text("tags").array().notNull(),
    content: jsonb("content").notNull(),
    /** AI-generated exercises belong to the learner they were generated for. */
    ownerId: uuid("owner_id").references(() => authUsers.id, { onDelete: "cascade" }),
    validated: boolean("validated").notNull().default(true),
    createdAt: createdAt(),
  },
  (t) => [
    index().on(t.languageId, t.skill, t.levelCode),
    pgPolicy("exercises_read", { as: "permissive", to: authenticatedRole, for: "select", using: sql`${t.ownerId} is null or ${t.ownerId} = ${authUid}` }),
    pgPolicy("exercises_insert_generated", {
      as: "permissive",
      to: authenticatedRole,
      for: "insert",
      withCheck: sql`${t.purpose} = 'generated' and ${t.ownerId} = ${authUid}`,
    }),
  ],
);

/** Listening dialogues and reading passages referenced by exercises (shared by units, placement and exams). */
export const materials = pgTable(
  "materials",
  {
    id: text("id").primaryKey(),
    languageId: text("language_id").notNull().references(() => languages.id),
    kind: text("kind").notNull(), // dialogue | passage
    data: jsonb("data").notNull(),
  },
  () => [readable("materials")],
);

export const levelExams = pgTable(
  "level_exams",
  {
    id: text("id").primaryKey(), // "en-B1-reading"
    languageId: text("language_id").notNull().references(() => languages.id),
    levelCode: text("level_code").notNull(),
    skill: text("skill").notNull(),
    /** sections: [{ id, titleTh, titleEn, required, draw, pool: exerciseId[] }] */
    sections: jsonb("sections").notNull(),
  },
  () => [readable("level_exams")],
);

/* ───────────────────────── User profile & preferences ───────────────────────── */

export const profiles = pgTable(
  "profiles",
  {
    id: uuid("id")
      .primaryKey()
      .references(() => authUsers.id, { onDelete: "cascade" }),
    displayName: text("display_name").notNull().default(""),
    uiLanguage: text("ui_language").notNull().default("th"),
    explanationLanguage: text("explanation_language").notNull().default("th"),
    timezone: text("timezone").notNull().default("Asia/Bangkok"),
    dailyMinutes: smallint("daily_minutes").notNull().default(30),
    correctionMode: text("correction_mode").notNull().default("after_each"), // immediate | after_each | end
    showPinyin: boolean("show_pinyin").notNull().default(true),
    playbackSpeed: doublePrecision("playback_speed").notNull().default(1),
    reviewNewPerDay: smallint("review_new_per_day").notNull().default(10),
    reviewMaxPerDay: smallint("review_max_per_day").notNull().default(60),
    reminderEnabled: boolean("reminder_enabled").notNull().default(false),
    reminderTime: text("reminder_time").notNull().default("19:00"),
    topics: text("topics").array().notNull().default(sql`'{mixed}'::text[]`),
    goals: text("goals").array().notNull().default(sql`'{}'::text[]`),
    aiProvider: text("ai_provider").notNull().default("auto"),
    saveRecordings: boolean("save_recordings").notNull().default(false),
    recordingRetentionDays: smallint("recording_retention_days").notNull().default(90),
    onboarded: boolean("onboarded").notNull().default(false),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [own("profiles", t.id)],
);

/** Weekly schedule: what to study on each weekday (0 = Sunday … 6 = Saturday). */
export const scheduleSlots = pgTable(
  "schedule_slots",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: userId(),
    weekday: smallint("weekday").notNull(),
    languageId: text("language_id").notNull().references(() => languages.id),
    skills: text("skills").array().notNull(),
    position: smallint("position").notNull().default(0),
  },
  (t) => [unique().on(t.userId, t.weekday, t.languageId), own("schedule_slots", t.userId)],
);

export const userLanguages = pgTable(
  "user_languages",
  {
    userId: userId(),
    languageId: text("language_id").notNull().references(() => languages.id),
    active: boolean("active").notNull().default(true),
    goal: text("goal"),
    startedAt: createdAt(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.languageId] }), own("user_languages", t.userId)],
);

/** Formal level per language AND per skill (tracked independently). */
export const skillProgress = pgTable(
  "skill_progress",
  {
    userId: userId(),
    languageId: text("language_id").notNull().references(() => languages.id),
    skill: text("skill").notNull(),
    levelCode: text("level_code").notNull(),
    placementLevel: text("placement_level"),
    currentUnitId: text("current_unit_id").references(() => units.id),
    updatedAt: updatedAt(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.languageId, t.skill] }), own("skill_progress", t.userId)],
);

/** Unit completion per skill: practice → unit assessment → completed. */
export const unitProgress = pgTable(
  "unit_progress",
  {
    userId: userId(),
    unitId: text("unit_id").notNull().references(() => units.id),
    skill: text("skill").notNull(),
    status: text("status").notNull().default("active"), // active | ready | completed
    practiceAttempts: integer("practice_attempts").notNull().default(0),
    practiceCorrect: doublePrecision("practice_correct").notNull().default(0),
    bestAssessment: doublePrecision("best_assessment"),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    updatedAt: updatedAt(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.unitId, t.skill] }), own("unit_progress", t.userId)],
);

/* ───────────────────────── Placement ───────────────────────── */

export const placementAssessments = pgTable(
  "placement_assessments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: userId(),
    languageId: text("language_id").notNull().references(() => languages.id),
    status: text("status").notNull().default("in_progress"), // in_progress | completed
    version: text("version").notNull().default("1"),
    startedAt: createdAt(),
    completedAt: timestamp("completed_at", { withTimezone: true }),
  },
  (t) => [index().on(t.userId, t.languageId), own("placement_assessments", t.userId)],
);

export const placementSkillResults = pgTable(
  "placement_skill_results",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    assessmentId: uuid("assessment_id")
      .notNull()
      .references(() => placementAssessments.id, { onDelete: "cascade" }),
    userId: userId(),
    skill: text("skill").notNull(),
    status: text("status").notNull().default("not_started"), // not_started | in_progress | completed | skipped
    /** Adaptive engine state: answered items, current level, etc. */
    state: jsonb("state").notNull().default(sql`'{}'::jsonb`),
    estimatedLevel: text("estimated_level"),
    confidence: text("confidence"), // low | medium | high
    detail: jsonb("detail"),
    strengths: text("strengths").array(),
    weaknesses: text("weaknesses").array(),
    limitations: text("limitations").array(),
    evaluator: text("evaluator"),
    completedAt: timestamp("completed_at", { withTimezone: true }),
  },
  (t) => [unique().on(t.assessmentId, t.skill), own("placement_skill_results", t.userId)],
);

/* ───────────────────────── Sessions & attempts ───────────────────────── */

export const studySessions = pgTable(
  "study_sessions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: userId(),
    languageId: text("language_id").notNull().references(() => languages.id),
    /** scheduled | practice | makeup | review | unit_assessment | level_exam | remediation */
    kind: text("kind").notNull(),
    /** Local date this session was scheduled for (scheduled / makeup sessions). */
    scheduledDate: date("scheduled_date"),
    skills: text("skills").array().notNull(),
    durationMinutes: smallint("duration_minutes").notNull(),
    /** Activities and exercise ids — fixed when the session is created. */
    plan: jsonb("plan").notNull(),
    /** Current position, drafts, retry queue. */
    state: jsonb("state").notNull().default(sql`'{}'::jsonb`),
    status: text("status").notNull().default("planned"), // planned | in_progress | completed | abandoned
    unitId: text("unit_id").references(() => units.id),
    levelExamId: text("level_exam_id").references(() => levelExams.id),
    remediationFor: uuid("remediation_for"),
    activeSeconds: integer("active_seconds").notNull().default(0),
    summary: jsonb("summary"),
    startedAt: timestamp("started_at", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [index().on(t.userId, t.languageId, t.createdAt), own("study_sessions", t.userId)],
);

export const exerciseAttempts = pgTable(
  "exercise_attempts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: userId(),
    sessionId: uuid("session_id").references(() => studySessions.id, { onDelete: "cascade" }),
    exerciseId: text("exercise_id")
      .notNull()
      .references(() => exercises.id),
    languageId: text("language_id").notNull(),
    skill: text("skill").notNull(),
    response: jsonb("response").notNull(),
    /** 0..1 */
    score: doublePrecision("score").notNull(),
    isCorrect: boolean("is_correct").notNull(),
    feedback: jsonb("feedback"),
    /** deterministic | ai | demo_rules */
    evaluator: text("evaluator").notNull(),
    aiProvider: text("ai_provider"),
    isRetry: boolean("is_retry").notNull().default(false),
    createdAt: createdAt(),
  },
  (t) => [index().on(t.userId, t.languageId, t.skill, t.createdAt), index().on(t.sessionId), own("exercise_attempts", t.userId)],
);

/* ───────────────────────── Vocabulary & SRS ───────────────────────── */

export const vocabularyItems = pgTable(
  "vocabulary_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: userId(),
    languageId: text("language_id").notNull().references(() => languages.id),
    word: text("word").notNull(),
    pronunciation: text("pronunciation"),
    meaningTh: text("meaning_th").notNull(),
    meaningEn: text("meaning_en").notNull().default(""),
    example: text("example").notNull().default(""),
    exampleTranslation: text("example_translation").notNull().default(""),
    difficulty: smallint("difficulty").notNull().default(3),
    sourceUnitId: text("source_unit_id"),
    easeFactor: doublePrecision("ease_factor").notNull().default(2.5),
    intervalDays: doublePrecision("interval_days").notNull().default(0),
    repetitions: integer("repetitions").notNull().default(0),
    lapses: integer("lapses").notNull().default(0),
    dueAt: timestamp("due_at", { withTimezone: true }).notNull().defaultNow(),
    lastReviewedAt: timestamp("last_reviewed_at", { withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [unique().on(t.userId, t.languageId, t.word), index().on(t.userId, t.dueAt), own("vocabulary_items", t.userId)],
);

export const vocabularyReviews = pgTable(
  "vocabulary_reviews",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: userId(),
    itemId: uuid("item_id")
      .notNull()
      .references(() => vocabularyItems.id, { onDelete: "cascade" }),
    quality: smallint("quality").notNull(),
    correct: boolean("correct").notNull(),
    mode: text("mode").notNull(), // flashcard | recall | choice | listening
    intervalDays: doublePrecision("interval_days").notNull(),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index().on(t.itemId), own("vocabulary_reviews", t.userId)],
);

/* ───────────────────────── Mistakes & weaknesses ───────────────────────── */

export const mistakeRecords = pgTable(
  "mistake_records",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: userId(),
    languageId: text("language_id").notNull(),
    skill: text("skill").notNull(),
    categoryId: text("category_id")
      .notNull()
      .references(() => weaknessCategories.id),
    exerciseId: text("exercise_id"),
    attemptId: uuid("attempt_id").references(() => exerciseAttempts.id, { onDelete: "cascade" }),
    original: text("original").notNull(),
    corrected: text("corrected").notNull(),
    explanation: text("explanation").notNull(),
    createdAt: createdAt(),
  },
  (t) => [index().on(t.userId, t.categoryId, t.createdAt), own("mistake_records", t.userId)],
);

export const userWeaknesses = pgTable(
  "user_weaknesses",
  {
    userId: userId(),
    categoryId: text("category_id")
      .notNull()
      .references(() => weaknessCategories.id),
    languageId: text("language_id").notNull(),
    /** watching | active | improving | resolved */
    status: text("status").notNull(),
    firstDetectedAt: timestamp("first_detected_at", { withTimezone: true }).notNull(),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true }).notNull(),
    occurrences: integer("occurrences").notNull().default(0),
    recentOccurrences: integer("recent_occurrences").notNull().default(0),
    /** 0..1 estimated mastery from recent tagged attempts */
    mastery: doublePrecision("mastery").notNull().default(0),
    /** [{ date, mastery, occurrences }] */
    history: jsonb("history").notNull().default(sql`'[]'::jsonb`),
    updatedAt: updatedAt(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.categoryId] }), own("user_weaknesses", t.userId)],
);

/* ───────────────────────── Assessments & progress ───────────────────────── */

export const assessmentResults = pgTable(
  "assessment_results",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: userId(),
    languageId: text("language_id").notNull(),
    skill: text("skill").notNull(),
    kind: text("kind").notNull(), // unit | level_exam
    unitId: text("unit_id"),
    levelCode: text("level_code").notNull(),
    sessionId: uuid("session_id").references(() => studySessions.id, { onDelete: "set null" }),
    score: doublePrecision("score").notNull(),
    sectionScores: jsonb("section_scores").notNull(),
    passed: boolean("passed").notNull(),
    /** The rules that were applied and which ones passed. */
    criteria: jsonb("criteria").notNull(),
    remediation: jsonb("remediation"),
    remediationDone: boolean("remediation_done").notNull().default(false),
    createdAt: createdAt(),
  },
  (t) => [index().on(t.userId, t.languageId, t.createdAt), own("assessment_results", t.userId)],
);

export const progressSnapshots = pgTable(
  "progress_snapshots",
  {
    userId: userId(),
    languageId: text("language_id").notNull(),
    skill: text("skill").notNull(),
    snapshotDate: date("snapshot_date").notNull(),
    accuracy: doublePrecision("accuracy").notNull(),
    attempts: integer("attempts").notNull(),
    levelCode: text("level_code").notNull(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.languageId, t.skill, t.snapshotDate] }), own("progress_snapshots", t.userId)],
);

export const studyLog = pgTable(
  "study_log",
  {
    userId: userId(),
    logDate: date("log_date").notNull(),
    languageId: text("language_id").notNull(),
    seconds: integer("seconds").notNull().default(0),
  },
  (t) => [primaryKey({ columns: [t.userId, t.logDate, t.languageId] }), own("study_log", t.userId)],
);

/* ───────────────────────── AI tutor conversations ───────────────────────── */

export const conversations = pgTable(
  "conversations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: userId(),
    languageId: text("language_id").notNull(),
    topic: text("topic").notNull(),
    levelCode: text("level_code").notNull(),
    correctionMode: text("correction_mode").notNull(),
    sessionId: uuid("session_id").references(() => studySessions.id, { onDelete: "set null" }),
    status: text("status").notNull().default("active"),
    evaluator: text("evaluator").notNull(),
    summary: jsonb("summary"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index().on(t.userId, t.createdAt), own("conversations", t.userId)],
);

export const conversationMessages = pgTable(
  "conversation_messages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    conversationId: uuid("conversation_id")
      .notNull()
      .references(() => conversations.id, { onDelete: "cascade" }),
    userId: userId(),
    role: text("role").notNull(), // tutor | learner
    content: text("content").notNull(),
    inputMode: text("input_mode"), // voice | text
    feedback: jsonb("feedback"),
    recordingId: uuid("recording_id"),
    createdAt: createdAt(),
  },
  (t) => [index().on(t.conversationId, t.createdAt), own("conversation_messages", t.userId)],
);

/* ───────────────────────── Recordings, usage ───────────────────────── */

/** Speaking recordings (audio stored in the private "recordings" Storage bucket). Only saved with consent. */
export const recordings = pgTable(
  "recordings",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: userId(),
    languageId: text("language_id").notNull(),
    storagePath: text("storage_path").notNull(),
    mimeType: text("mime_type").notNull(),
    durationMs: integer("duration_ms"),
    transcript: text("transcript"),
    exerciseId: text("exercise_id"),
    prompt: text("prompt"),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: createdAt(),
  },
  (t) => [index().on(t.userId, t.createdAt), own("recordings", t.userId)],
);

export const aiUsage = pgTable(
  "ai_usage",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: userId(),
    kind: text("kind").notNull(), // llm | stt | tts
    provider: text("provider").notNull(),
    units: integer("units").notNull().default(0),
    costCents: doublePrecision("cost_cents").notNull().default(0),
    createdAt: createdAt(),
  },
  (t) => [index().on(t.userId, t.createdAt), own("ai_usage", t.userId)],
);
