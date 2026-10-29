/**
 * Lesson planner — builds a session plan from the curriculum and the learner's state.
 *
 * Each activity is filled within a time budget by interleaving four buckets:
 *   new material (current unit, never attempted) ·· weakness correction (exercises tagged with an
 *   active weakness) ·· consolidation (previously wrong, or earlier units not seen for a week) ·· review.
 * Pattern: new, new, weakness, new, consolidation … (empty buckets are skipped), so new material
 * dominates while weaknesses and consolidation are always mixed in.
 *
 * Session templates (share of minutes):
 *   listening + speaking : warm-up 10 · listening 23 · speaking 40 · corrections & retry 17 · mini assessment 10
 *   reading + writing    : warm-up 10 · reading 30 · writing 33 · corrections & retry 17 · mini assessment 10
 *   vocabulary + review  : warm-up 10 · spaced review 40 · weakness review 35 · mini assessment 15
 *   single skill         : warm-up 10 · skill 65 · corrections & retry 15 · mini assessment 10
 * "Corrections & retry" is filled at runtime with the exercises answered wrongly in the session.
 */
import type { Exercise, ExerciseType, LanguageId, Skill, Unit } from "@/content/types";

export type PlanReason = "new" | "weakness" | "consolidation" | "review" | "assessment" | "warmup";

export type PlanItem = { kind: "exercise"; exerciseId: string; reason: PlanReason } | { kind: "vocab"; vocabId: string; reason: "review" };

export type ActivityType = "warmup" | "skill" | "vocab_review" | "weakness_review" | "corrections" | "mini_assessment" | "exam_section" | "unit_assessment";

export interface PlanActivity {
  id: string;
  type: ActivityType;
  skill?: Skill;
  minutes: number;
  items: PlanItem[];
  /** exam/unit assessment: section metadata */
  sectionId?: string;
}

export interface SessionPlan {
  version: 1;
  activities: PlanActivity[];
}

export interface ExerciseStat {
  lastAt: number; // epoch ms
  best: number; // 0..1
  attempts: number;
}

export interface PlannerInput {
  language: LanguageId;
  skills: Skill[];
  minutes: number;
  currentUnit: Partial<Record<Skill, Unit>>;
  /** Earlier units (most recent first) for consolidation. */
  previousUnits: Partial<Record<Skill, Unit[]>>;
  stats: Map<string, ExerciseStat>;
  focusTags: string[];
  dueVocabIds: string[];
  rng: () => number;
  now: number;
  /** remediation: restrict to these tags/sections */
  remediationTags?: string[];
}

const COST: Record<ExerciseType, number> = {
  mcq: 1,
  true_false: 0.8,
  fill_blank: 1,
  word_recall: 0.8,
  match_pairs: 1.5,
  sentence_order: 1.2,
  sentence_correction: 1.5,
  listen_type: 1.5,
  repeat_sentence: 1,
  speaking_response: 3.5,
  open_writing: 7,
};

export function itemCost(e: Exercise) {
  return COST[e.type] * (e.skill === "listening" && e.type !== "listen_type" ? 1.3 : 1);
}

const DAY = 86_400_000;
const CORRECT = 0.75;

function templateFor(skills: Skill[]): { type: ActivityType; skill?: Skill; share: number }[] {
  const has = (s: Skill) => skills.includes(s);
  if (skills.length === 1 && has("vocabulary"))
    return [
      { type: "warmup", share: 0.1 },
      { type: "vocab_review", share: 0.4 },
      { type: "weakness_review", share: 0.35 },
      { type: "mini_assessment", share: 0.15 },
    ];
  if (has("listening") && has("speaking") && skills.length === 2)
    return [
      { type: "warmup", share: 0.1 },
      { type: "skill", skill: "listening", share: 0.23 },
      { type: "skill", skill: "speaking", share: 0.4 },
      { type: "corrections", share: 0.17 },
      { type: "mini_assessment", share: 0.1 },
    ];
  if (has("reading") && has("writing") && skills.length === 2)
    return [
      { type: "warmup", share: 0.1 },
      { type: "skill", skill: "reading", share: 0.3 },
      { type: "skill", skill: "writing", share: 0.33 },
      { type: "corrections", share: 0.17 },
      { type: "mini_assessment", share: 0.1 },
    ];
  const each = 0.65 / skills.length;
  return [{ type: "warmup", share: 0.1 }, ...skills.map((s) => ({ type: "skill" as const, skill: s, share: each })), { type: "corrections", share: 0.15 }, { type: "mini_assessment", share: 0.1 }];
}

function fillBudget(buckets: Record<"new" | "weakness" | "consolidation", Exercise[]>, budget: number, used: Set<string>, opts: { maxOpen: number }) {
  const pattern: ("new" | "weakness" | "consolidation")[] = ["new", "new", "weakness", "new", "consolidation"];
  const out: { e: Exercise; reason: PlanReason }[] = [];
  let spent = 0;
  let open = 0;
  let idle = 0;
  for (let i = 0; idle < pattern.length && spent < budget; i++) {
    const b = pattern[i % pattern.length]!;
    const list = buckets[b];
    const idx = list.findIndex((e) => !used.has(e.id) && (e.type !== "open_writing" && e.type !== "speaking_response" ? true : open < opts.maxOpen));
    if (idx < 0) {
      idle++;
      continue;
    }
    const e = list.splice(idx, 1)[0]!;
    const cost = itemCost(e);
    // Allow the first item even if it exceeds the budget; otherwise stay within ~budget.
    if (out.length > 0 && spent + cost > budget * 1.15) {
      idle++;
      continue;
    }
    idle = 0;
    used.add(e.id);
    out.push({ e, reason: b });
    spent += cost;
    if (e.type === "open_writing" || e.type === "speaking_response") open++;
  }
  return out;
}

function bucketsFor(skill: Skill, input: PlannerInput) {
  const st = (id: string) => input.stats.get(id);
  const unit = input.currentUnit[skill];
  const prev = input.previousUnits[skill] ?? [];
  const jitter = () => input.rng();
  const focus = new Set(input.remediationTags?.length ? input.remediationTags : input.focusTags);

  const ofSkill = (u: Unit) => u.exercises.filter((e) => e.skill === skill);
  const current = unit ? ofSkill(unit) : [];
  const older = prev.flatMap(ofSkill);
  const all = [...current, ...older];

  const isNew = (e: Exercise) => !st(e.id);
  const wasWrong = (e: Exercise) => (st(e.id)?.best ?? 1) < CORRECT;
  const stale = (e: Exercise) => input.now - (st(e.id)?.lastAt ?? 0) > 7 * DAY;
  const notJustDone = (e: Exercise) => input.now - (st(e.id)?.lastAt ?? 0) > DAY;

  const sortRand = (l: Exercise[]) => l.map((e) => ({ e, r: jitter() })).sort((a, b) => a.r - b.r).map((x) => x.e);

  const weakness = sortRand(all.filter((e) => e.tags.some((t) => focus.has(t)) && (isNew(e) || (wasWrong(e) && notJustDone(e)))));
  const fresh = sortRand(current.filter(isNew));
  // Keep the unit's natural order for new material (dialogue → questions) but randomise ties.
  fresh.sort((a, b) => current.indexOf(a) - current.indexOf(b));
  const consolidation = sortRand([
    ...all.filter((e) => !isNew(e) && wasWrong(e) && notJustDone(e)),
    ...older.filter((e) => isNew(e) || stale(e)),
    ...current.filter((e) => !isNew(e) && stale(e)),
  ]);
  if (input.remediationTags?.length) return { new: weakness, weakness: [], consolidation: [...consolidation, ...fresh] };
  return { new: fresh, weakness, consolidation };
}

/** Listening items that share a dialogue are grouped so the dialogue is played once. */
function groupBySource(items: { e: Exercise; reason: PlanReason }[]) {
  const order: string[] = [];
  for (const i of items) {
    const k = i.e.source ?? i.e.id;
    if (!order.includes(k)) order.push(k);
  }
  return order.flatMap((k) => items.filter((i) => (i.e.source ?? i.e.id) === k));
}

export function buildSessionPlan(input: PlannerInput): SessionPlan {
  const tpl = templateFor(input.skills);
  const used = new Set<string>();
  const activities: PlanActivity[] = [];
  const primary = input.skills[0]!;

  // The mini assessment is chosen first so the skill blocks cannot use up the unit's items:
  // objective items from the current unit(s) not yet mastered, then earlier units as a fallback.
  const miniShare = tpl.find((t) => t.type === "mini_assessment")?.share ?? 0;
  const miniMinutes = Math.max(1, Math.round(input.minutes * miniShare));
  let mini: { e: Exercise; reason: PlanReason }[] = [];
  if (miniShare > 0) {
    const objective = (e: Exercise, s: Skill) => e.skill === s && !["open_writing", "speaking_response"].includes(e.type) && (input.stats.get(e.id)?.best ?? 0) < CORRECT;
    const shuffle = (l: Exercise[]) => l.map((e) => ({ e, r: input.rng() })).sort((a, b) => a.r - b.r).map((x) => x.e);
    const current = shuffle(input.skills.flatMap((s) => (input.currentUnit[s]?.exercises ?? []).filter((e) => objective(e, s))));
    const earlier = shuffle(input.skills.flatMap((s) => (input.previousUnits[s] ?? []).flatMap((u) => u.exercises.filter((e) => objective(e, s)))));
    // Leave the unit enough material for its own skill blocks: at most a third of the current pool.
    const fromCurrent = current.slice(0, Math.max(1, Math.floor(current.length / 3)));
    mini = fillBudget({ new: [...fromCurrent, ...earlier], weakness: [], consolidation: [] }, miniMinutes, used, { maxOpen: 0 });
  }

  for (const [i, t] of tpl.entries()) {
    const minutes = Math.max(1, Math.round(input.minutes * t.share));
    const id = `a${i + 1}`;
    if (t.type === "warmup") {
      const unit = input.currentUnit[primary] ?? input.currentUnit.vocabulary;
      const quick = (unit?.exercises ?? []).filter((e) => e.skill === "vocabulary" && ["mcq", "match_pairs", "word_recall", "fill_blank"].includes(e.type));
      const seenFirst = [...quick].sort((a, b) => Number(!!input.stats.get(b.id)) - Number(!!input.stats.get(a.id)) || input.rng() - 0.5);
      const picked = fillBudget({ new: seenFirst, weakness: [], consolidation: [] }, minutes, used, { maxOpen: 0 });
      activities.push({ id, type: "warmup", minutes, items: picked.map((p) => ({ kind: "exercise", exerciseId: p.e.id, reason: "warmup" })) });
    } else if (t.type === "vocab_review") {
      const n = Math.max(3, Math.floor(minutes / 0.4));
      activities.push({ id, type: "vocab_review", minutes, items: input.dueVocabIds.slice(0, n).map((v) => ({ kind: "vocab", vocabId: v, reason: "review" })) });
    } else if (t.type === "weakness_review") {
      const pools = input.skills.length === 1 && input.skills[0] === "vocabulary" ? (["vocabulary", "reading", "listening", "writing"] as Skill[]) : input.skills;
      const merged = { new: [] as Exercise[], weakness: [] as Exercise[], consolidation: [] as Exercise[] };
      for (const s of pools) {
        const b = bucketsFor(s, input);
        merged.weakness.push(...b.weakness.filter((e) => !["open_writing", "speaking_response", "repeat_sentence"].includes(e.type)));
        merged.consolidation.push(...b.consolidation.filter((e) => !["open_writing", "speaking_response", "repeat_sentence"].includes(e.type)));
        if (s === "vocabulary") merged.new.push(...b.new);
      }
      // Weakness first on review day.
      const picked = fillBudget({ new: merged.weakness, weakness: merged.consolidation, consolidation: merged.new }, minutes, used, { maxOpen: 0 });
      activities.push({ id, type: "weakness_review", minutes, items: picked.map((p) => ({ kind: "exercise", exerciseId: p.e.id, reason: p.reason === "new" ? "weakness" : p.reason === "weakness" ? "consolidation" : "new" })) });
    } else if (t.type === "skill") {
      const b = bucketsFor(t.skill!, input);
      const maxOpen = t.skill === "writing" ? (minutes >= 20 ? 2 : 1) : t.skill === "speaking" ? Math.max(1, Math.floor(minutes / 5)) : 0;
      // Writing and speaking blocks always end with a real production task: reserve its time first,
      // fill the rest with controlled practice, then append it (practice → production).
      const isOpen = (e: Exercise) => e.type === "open_writing" || e.type === "speaking_response";
      let production: { e: Exercise; reason: PlanReason } | null = null;
      if (maxOpen > 0) {
        for (const reason of ["new", "weakness", "consolidation"] as const) {
          const idx = b[reason].findIndex((e) => isOpen(e) && !used.has(e.id));
          if (idx >= 0) {
            production = { e: b[reason].splice(idx, 1)[0]!, reason };
            used.add(production.e.id);
            break;
          }
        }
      }
      let picked = fillBudget(b, Math.max(minutes - (production ? itemCost(production.e) : 0), production ? 1 : minutes), used, { maxOpen: production ? maxOpen - 1 : maxOpen });
      if (production) picked = [...picked.filter((p) => !isOpen(p.e)), ...picked.filter((p) => isOpen(p.e)), production];
      if (t.skill === "listening" || t.skill === "reading") picked = groupBySource(picked);
      activities.push({ id, type: "skill", skill: t.skill, minutes, items: picked.map((p) => ({ kind: "exercise", exerciseId: p.e.id, reason: p.reason })) });
    } else if (t.type === "corrections") {
      activities.push({ id, type: "corrections", minutes, items: [] });
    } else if (t.type === "mini_assessment") {
      activities.push({ id, type: "mini_assessment", minutes, items: mini.map((p) => ({ kind: "exercise", exerciseId: p.e.id, reason: "assessment" })) });
    }
  }
  return { version: 1, activities: activities.filter((a) => a.items.length > 0 || a.type === "corrections" || a.type === "vocab_review") };
}

export function planExerciseIds(plan: SessionPlan) {
  return plan.activities.flatMap((a) => a.items.filter((i) => i.kind === "exercise").map((i) => (i as { exerciseId: string }).exerciseId));
}
