/**
 * Structural validator for Fluency Lab content files.
 * Usage: node --experimental-strip-types scripts/check-content.mts <file.ts> [<file.ts> ...]
 * Each file may export Unit[] (any export name), LevelExam[] or a PlacementBank.
 */
import { pathToFileURL } from "node:url";
import { resolve } from "node:path";
import { TAG_IDS } from "../src/content/tags.ts";

const errors: string[] = [];
const seen = new Set<string>();
const err = (where: string, msg: string) => errors.push(`${where}: ${msg}`);
const HAN = /[㐀-鿿]/;

function checkLine(where: string, l: any, zh: boolean) {
  if (!l || typeof l.text !== "string" || !l.text.trim()) err(where, "line without text");
  if (zh && HAN.test(l.text)) {
    if (!l.pinyin) err(where, `missing pinyin for "${l.text}"`);
    if (!l.th) err(where, `missing Thai translation for "${l.text}"`);
  }
}

function checkExercise(where: string, e: any, zh: boolean, sources: Set<string>) {
  const w = `${where} ${e?.id}`;
  if (!e.id) return err(where, "exercise without id");
  if (seen.has(e.id)) err(w, "duplicate id");
  seen.add(e.id);
  if (!["listening", "speaking", "reading", "writing", "vocabulary"].includes(e.skill)) err(w, `bad skill ${e.skill}`);
  if (!e.objective) err(w, "missing objective");
  if (!Array.isArray(e.tags) || e.tags.length === 0) err(w, "needs at least one tag");
  for (const t of e.tags ?? []) if (!TAG_IDS.has(t)) err(w, `unknown tag ${t}`);
  if (!e.prompt || !String(e.prompt).trim()) err(w, "missing prompt");
  if (!e.explanationTh) err(w, "missing explanationTh");
  if (zh && HAN.test(e.prompt ?? "") && !e.promptPinyin && e.type !== "listen_type") err(w, "Chinese prompt needs promptPinyin");
  if (e.source && !sources.has(e.source)) err(w, `unknown source ${e.source}`);
  switch (e.type) {
    case "mcq":
      if (!Array.isArray(e.options) || e.options.length < 3 || e.options.length > 5) err(w, "mcq needs 3–5 options");
      if (!Number.isInteger(e.answer) || e.answer < 0 || e.answer >= (e.options?.length ?? 0)) err(w, "mcq answer index out of range");
      if (new Set(e.options).size !== e.options?.length) err(w, "duplicate options");
      break;
    case "true_false":
      if (typeof e.answer !== "boolean") err(w, "true_false answer must be boolean");
      break;
    case "fill_blank":
      if (!String(e.prompt).includes("___")) err(w, 'fill_blank prompt needs "___"');
    // falls through
    case "word_recall":
    case "sentence_correction":
      if (!Array.isArray(e.answers) || e.answers.length === 0 || e.answers.some((a: string) => !a.trim())) err(w, "needs non-empty answers");
      break;
    case "listen_type":
      if (!e.audio) err(w, "listen_type needs audio");
      if (zh && !e.audioPinyin) err(w, "Chinese listen_type needs audioPinyin");
      break;
    case "sentence_order":
      if (!Array.isArray(e.tokens) || e.tokens.length < 3) err(w, "sentence_order needs ≥3 tokens");
      break;
    case "match_pairs":
      if (!Array.isArray(e.pairs) || e.pairs.length < 3) err(w, "match_pairs needs ≥3 pairs");
      if (new Set(e.pairs?.map((p: string[]) => p[0])).size !== e.pairs?.length || new Set(e.pairs?.map((p: string[]) => p[1])).size !== e.pairs?.length) err(w, "match_pairs sides must be unique");
      break;
    case "open_writing":
    case "speaking_response":
      if (!(e.minLength > 0)) err(w, "minLength required");
      if (!Array.isArray(e.requirements) || !e.requirements.length) err(w, "requirements required");
      if (!e.modelAnswer) err(w, "modelAnswer required");
      if (e.type === "open_writing" && !(e.maxLength >= e.minLength)) err(w, "maxLength must be ≥ minLength");
      break;
    case "repeat_sentence":
      if (!e.text) err(w, "repeat_sentence needs text");
      if (zh && !e.pinyin) err(w, "Chinese repeat_sentence needs pinyin");
      break;
    default:
      err(w, `unknown type ${e.type}`);
  }
}

function checkUnit(u: any) {
  const zh = u.language === "zh";
  const w = u.id;
  if (!/^(en|zh)-[a-z0-9]+-u\d+$/.test(u.id)) err(w, "unit id must look like en-b1-u2 / zh-hsk2-u1");
  for (const k of ["title", "titleTh", "level"]) if (!u[k]) err(w, `missing ${k}`);
  const objIds = new Set((u.objectives ?? []).map((o: any) => o.id));
  const skillsWithObj = new Set((u.objectives ?? []).map((o: any) => o.skill));
  for (const s of ["listening", "speaking", "reading", "writing", "vocabulary"]) if (!skillsWithObj.has(s)) err(w, `no objective for ${s}`);
  if ((u.vocabulary ?? []).length < 8) err(w, "needs ≥8 vocabulary entries");
  const words = new Set<string>();
  for (const v of u.vocabulary ?? []) {
    if (words.has(v.word)) err(w, `duplicate vocab ${v.word}`);
    words.add(v.word);
    if (!v.meaningTh || !v.meaningEn || !v.example || !v.exampleTh) err(w, `vocab ${v.word} incomplete`);
    if (zh && (!v.pronunciation || !v.examplePinyin)) err(w, `vocab ${v.word} needs pinyin`);
  }
  for (const g of u.grammar ?? []) for (const ex of g.examples ?? []) checkLine(`${w} grammar ${g.id}`, ex, zh);
  const sources = new Set<string>();
  for (const d of u.dialogues ?? []) { sources.add(d.id); for (const l of d.lines) checkLine(`${w} ${d.id}`, l, zh); }
  for (const p of u.passages ?? []) {
    sources.add(p.id);
    for (const l of p.lines) checkLine(`${w} ${p.id}`, l, zh);
    if (zh) for (const g of p.glossary ?? []) if (!g.pronunciation) err(`${w} ${p.id}`, `glossary ${g.word} needs pinyin`);
  }
  const count = (list: any[], s: string) => list.filter((e) => e.skill === s).length;
  for (const s of ["listening", "speaking", "reading", "writing", "vocabulary"]) {
    if (count(u.exercises ?? [], s) < 5) err(w, `practice bank needs ≥5 ${s} exercises`);
    if (count(u.assessment ?? [], s) < 2) err(w, `assessment needs ≥2 ${s} items`);
  }
  for (const e of [...(u.exercises ?? []), ...(u.assessment ?? [])]) {
    checkExercise(w, e, zh, sources);
    if (!objIds.has(e.objective)) err(`${w} ${e.id}`, `objective ${e.objective} not in unit`);
  }
}

function checkExam(x: any) {
  const zh = x.language === "zh";
  const sources = new Set<string>([...(x.dialogues ?? []).map((d: any) => d.id), ...(x.passages ?? []).map((p: any) => p.id)]);
  for (const d of x.dialogues ?? []) for (const l of d.lines) checkLine(`${x.id} ${d.id}`, l, zh);
  for (const p of x.passages ?? []) for (const l of p.lines) checkLine(`${x.id} ${p.id}`, l, zh);
  if (!x.sections?.length) err(x.id, "no sections");
  for (const s of x.sections ?? []) {
    if (!(s.pool?.length > s.draw) && !(s.pool?.length >= 2 && s.draw === 1)) err(`${x.id} ${s.id}`, "pool must be larger than draw (fresh questions on retake)");
    for (const e of s.pool ?? []) {
      checkExercise(`${x.id} ${s.id}`, e, zh, sources);
      if (e.skill !== x.skill) err(`${x.id} ${e.id}`, `skill must be ${x.skill}`);
    }
  }
}

function checkPlacement(b: any) {
  const zh = b.language === "zh";
  const sources = new Set<string>([...(b.dialogues ?? []).map((d: any) => d.id), ...(b.passages ?? []).map((p: any) => p.id)]);
  for (const d of b.dialogues ?? []) for (const l of d.lines) checkLine(`placement ${d.id}`, l, zh);
  for (const p of b.passages ?? []) for (const l of p.lines) checkLine(`placement ${p.id}`, l, zh);
  for (const it of b.items ?? []) {
    checkExercise("placement", it, zh, sources);
    if (!it.level) err(`placement ${it.id}`, "missing level");
  }
}

for (const file of process.argv.slice(2)) {
  const mod = await import(pathToFileURL(resolve(file)).href);
  for (const [name, value] of Object.entries(mod)) {
    const list = Array.isArray(value) ? value : [value];
    for (const v of list as any[]) {
      if (!v || typeof v !== "object") continue;
      if (v.objectives && v.exercises) checkUnit(v);
      else if (v.sections && v.skill) checkExam(v);
      else if (v.items && v.language) checkPlacement(v);
      else console.warn(`(skipped export ${name})`);
    }
  }
}

if (errors.length) {
  console.error(errors.join("\n"));
  console.error(`\n✗ ${errors.length} problem(s)`);
  process.exit(1);
}
console.log(`✓ content OK (${seen.size} exercises checked)`);
