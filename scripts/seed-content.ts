/**
 * Loads the bundled curriculum into the database (idempotent upserts).
 * Run after migrations:  npm run db:seed
 * Uses DATABASE_URL (table owner) — content tables are read-only for app users via RLS.
 */
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { sql } from "drizzle-orm";
import * as schema from "../src/db/schema";
import { EXAMS, PLACEMENT, UNITS } from "../src/content";
import { WEAKNESS_CATEGORIES } from "../src/content/tags";
import { LANGUAGES } from "../src/languages";
import type { Exercise } from "../src/content/types";

const url = process.env.DATABASE_URL ?? "postgresql://postgres:postgres@127.0.0.1:54322/postgres";
const client = postgres(url, { prepare: false, max: 1 });
const db = drizzle(client, { schema });

const upsert = <T extends Record<string, unknown>>(rows: T[], size = 200) => {
  const chunks: T[][] = [];
  for (let i = 0; i < rows.length; i += size) chunks.push(rows.slice(i, i + size));
  return chunks;
};

function exRow(e: Exercise, language: string, level: string, unitId: string | null, purpose: string) {
  return { id: e.id, languageId: language, unitId, levelCode: level, skill: e.skill, type: e.type, objective: e.objective, purpose, tags: e.tags, content: e, validated: true };
}

async function main() {
  const levelsWithContent = new Set(UNITS.map((u) => `${u.language}:${u.level}`));
  for (const m of Object.values(LANGUAGES)) {
    await db
      .insert(schema.languages)
      .values({ id: m.id, nameEn: m.nameEn, nameTh: m.nameTh, framework: m.framework, levels: m.levels.map((l) => l.code) })
      .onConflictDoUpdate({ target: schema.languages.id, set: { nameEn: m.nameEn, nameTh: m.nameTh, framework: m.framework, levels: m.levels.map((l) => l.code) } });
    for (const [i, l] of m.levels.entries()) {
      const id = `${m.id}:${l.code}`;
      await db
        .insert(schema.curriculumLevels)
        .values({ id, languageId: m.id, code: l.code, ord: i, nameTh: l.nameTh, hasContent: levelsWithContent.has(id) })
        .onConflictDoUpdate({ target: schema.curriculumLevels.id, set: { ord: i, nameTh: l.nameTh, hasContent: levelsWithContent.has(id) } });
    }
  }
  for (const c of WEAKNESS_CATEGORIES) {
    await db
      .insert(schema.weaknessCategories)
      .values({ id: c.id, languageId: c.language, skill: c.skill, nameEn: c.nameEn, nameTh: c.nameTh })
      .onConflictDoUpdate({ target: schema.weaknessCategories.id, set: { skill: c.skill, nameEn: c.nameEn, nameTh: c.nameTh } });
  }

  const materials: { id: string; languageId: string; kind: string; data: unknown }[] = [];
  const exercises: ReturnType<typeof exRow>[] = [];
  for (const u of UNITS) {
    await db
      .insert(schema.units)
      .values({ id: u.id, languageId: u.language, levelCode: u.level, ord: u.order, title: u.title, titleTh: u.titleTh, topics: u.topics, data: { objectives: u.objectives, grammar: u.grammar, vocabulary: u.vocabulary } })
      .onConflictDoUpdate({ target: schema.units.id, set: { title: u.title, titleTh: u.titleTh, topics: u.topics, ord: u.order, data: { objectives: u.objectives, grammar: u.grammar, vocabulary: u.vocabulary } } });
    for (const skill of ["listening", "speaking", "reading", "writing", "vocabulary"]) {
      await db.insert(schema.lessons).values({ id: `${u.id}:${skill}`, unitId: u.id, skill, title: `${u.title} — ${skill}` }).onConflictDoNothing();
    }
    for (const d of u.dialogues) materials.push({ id: d.id, languageId: u.language, kind: "dialogue", data: d });
    for (const p of u.passages) materials.push({ id: p.id, languageId: u.language, kind: "passage", data: p });
    for (const e of u.exercises) exercises.push(exRow(e, u.language, u.level, u.id, "practice"));
    for (const e of u.assessment) exercises.push(exRow(e, u.language, u.level, u.id, "unit_assessment"));
  }
  for (const x of EXAMS) {
    for (const d of x.dialogues) materials.push({ id: d.id, languageId: x.language, kind: "dialogue", data: d });
    for (const p of x.passages) materials.push({ id: p.id, languageId: x.language, kind: "passage", data: p });
    for (const s of x.sections) for (const e of s.pool) exercises.push(exRow(e, x.language, x.level, null, "level_exam"));
    const sections = x.sections.map((s) => ({ id: s.id, titleTh: s.titleTh, titleEn: s.titleEn, required: s.required, draw: s.draw, pool: s.pool.map((p) => p.id) }));
    await db
      .insert(schema.levelExams)
      .values({ id: x.id, languageId: x.language, levelCode: x.level, skill: x.skill, sections })
      .onConflictDoUpdate({ target: schema.levelExams.id, set: { sections } });
  }
  for (const b of Object.values(PLACEMENT)) {
    for (const d of b.dialogues) materials.push({ id: d.id, languageId: b.language, kind: "dialogue", data: d });
    for (const p of b.passages) materials.push({ id: p.id, languageId: b.language, kind: "passage", data: p });
    for (const e of b.items) exercises.push(exRow(e, b.language, e.level, null, "placement"));
  }
  for (const chunk of upsert(materials)) {
    await db.insert(schema.materials).values(chunk).onConflictDoUpdate({ target: schema.materials.id, set: { data: sql`excluded.data`, kind: sql`excluded.kind` } });
  }
  for (const chunk of upsert(exercises)) {
    await db
      .insert(schema.exercises)
      .values(chunk)
      .onConflictDoUpdate({
        target: schema.exercises.id,
        set: { content: sql`excluded.content`, tags: sql`excluded.tags`, type: sql`excluded.type`, objective: sql`excluded.objective`, purpose: sql`excluded.purpose`, levelCode: sql`excluded.level_code`, skill: sql`excluded.skill`, unitId: sql`excluded.unit_id` },
      });
  }
  console.log(`✓ Seeded ${UNITS.length} units, ${EXAMS.length} level exams, ${materials.length} materials, ${exercises.length} exercises, ${WEAKNESS_CATEGORIES.length} weakness categories.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => client.end());
