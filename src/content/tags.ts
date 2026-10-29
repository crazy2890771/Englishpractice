import type { LanguageId, Skill } from "./types";

/** Weakness / error categories per language. Exercises and mistakes are tagged with these ids. */
export interface WeaknessCategory {
  id: string;
  language: LanguageId;
  skill: Skill | "any";
  nameEn: string;
  nameTh: string;
}

export const WEAKNESS_CATEGORIES: WeaknessCategory[] = [
  // English
  { id: "en.past_simple", language: "en", skill: "any", nameEn: "Past simple", nameTh: "อดีตกาล (Past Simple)" },
  { id: "en.present_perfect", language: "en", skill: "any", nameEn: "Present perfect", nameTh: "Present Perfect" },
  { id: "en.future_forms", language: "en", skill: "any", nameEn: "Future forms", nameTh: "รูปอนาคต" },
  { id: "en.articles", language: "en", skill: "any", nameEn: "Articles (a/an/the)", nameTh: "คำนำหน้านาม a/an/the" },
  { id: "en.prepositions", language: "en", skill: "any", nameEn: "Prepositions", nameTh: "คำบุพบท" },
  { id: "en.subject_verb", language: "en", skill: "any", nameEn: "Subject–verb agreement", nameTh: "ความสอดคล้องประธาน–กริยา" },
  { id: "en.word_order", language: "en", skill: "any", nameEn: "Word order / sentence structure", nameTh: "การเรียงคำและโครงสร้างประโยค" },
  { id: "en.questions", language: "en", skill: "any", nameEn: "Question forms", nameTh: "การสร้างประโยคคำถาม" },
  { id: "en.plurals_countables", language: "en", skill: "any", nameEn: "Plurals & countable nouns", nameTh: "พหูพจน์และนามนับได้/ไม่ได้" },
  { id: "en.comparatives", language: "en", skill: "any", nameEn: "Comparatives & superlatives", nameTh: "ขั้นกว่าและขั้นสุด" },
  { id: "en.modals", language: "en", skill: "any", nameEn: "Modal verbs", nameTh: "กริยาช่วย (can, should, must…)" },
  { id: "en.conditionals", language: "en", skill: "any", nameEn: "Conditionals", nameTh: "ประโยคเงื่อนไข (If)" },
  { id: "en.passive", language: "en", skill: "any", nameEn: "Passive voice", nameTh: "ประโยค Passive" },
  { id: "en.relative_clauses", language: "en", skill: "any", nameEn: "Relative clauses", nameTh: "Relative clause (who/which/that)" },
  { id: "en.gerund_infinitive", language: "en", skill: "any", nameEn: "Gerunds & infinitives", nameTh: "Gerund และ Infinitive" },
  { id: "en.collocations", language: "en", skill: "any", nameEn: "Collocations", nameTh: "คำที่ใช้คู่กัน (Collocation)" },
  { id: "en.vocabulary_range", language: "en", skill: "vocabulary", nameEn: "Vocabulary range & recall", nameTh: "คลังคำศัพท์และการนึกคำ" },
  { id: "en.spelling", language: "en", skill: "writing", nameEn: "Spelling", nameTh: "การสะกดคำ" },
  { id: "en.linking_words", language: "en", skill: "writing", nameEn: "Linking words & coherence", nameTh: "คำเชื่อมและความต่อเนื่อง" },
  { id: "en.register_politeness", language: "en", skill: "any", nameEn: "Register & politeness", nameTh: "ระดับภาษาและความสุภาพ" },
  { id: "en.listening_detail", language: "en", skill: "listening", nameEn: "Listening for detail", nameTh: "ฟังจับรายละเอียด" },
  { id: "en.listening_gist", language: "en", skill: "listening", nameEn: "Listening for gist", nameTh: "ฟังจับใจความหลัก" },
  { id: "en.reading_main_idea", language: "en", skill: "reading", nameEn: "Reading for main idea", nameTh: "อ่านจับใจความสำคัญ" },
  { id: "en.reading_inference", language: "en", skill: "reading", nameEn: "Reading inference", nameTh: "การอนุมานจากบทอ่าน" },
  { id: "en.pronunciation", language: "en", skill: "speaking", nameEn: "Pronunciation (recognition-based)", nameTh: "การออกเสียง (จากการรู้จำเสียง)" },
  { id: "en.fluency_hesitation", language: "en", skill: "speaking", nameEn: "Speaking hesitation / fluency", nameTh: "ความลื่นไหลในการพูด" },
  // Chinese
  { id: "zh.tones", language: "zh", skill: "any", nameEn: "Tones", nameTh: "วรรณยุกต์" },
  { id: "zh.pinyin", language: "zh", skill: "any", nameEn: "Pinyin", nameTh: "พินอิน" },
  { id: "zh.word_order", language: "zh", skill: "any", nameEn: "Word order", nameTh: "การเรียงคำ" },
  { id: "zh.time_place_order", language: "zh", skill: "any", nameEn: "Time & place word order", nameTh: "ตำแหน่งคำบอกเวลาและสถานที่" },
  { id: "zh.measure_words", language: "zh", skill: "any", nameEn: "Measure words", nameTh: "ลักษณนาม" },
  { id: "zh.le_aspect", language: "zh", skill: "any", nameEn: "了 / aspect", nameTh: "การใช้ 了 และการแสดงการณ์ลักษณะ" },
  { id: "zh.question_forms", language: "zh", skill: "any", nameEn: "Question forms (吗, 呢, question words)", nameTh: "การสร้างคำถาม (吗 呢 คำแสดงคำถาม)" },
  { id: "zh.negation", language: "zh", skill: "any", nameEn: "Negation (不 / 没)", nameTh: "การปฏิเสธ 不 / 没" },
  { id: "zh.de_particles", language: "zh", skill: "any", nameEn: "的 / 得 / 地", nameTh: "การใช้ 的 得 地" },
  { id: "zh.comparison", language: "zh", skill: "any", nameEn: "Comparison (比)", nameTh: "การเปรียบเทียบ (比)" },
  { id: "zh.ba_construction", language: "zh", skill: "any", nameEn: "把 construction", nameTh: "โครงสร้าง 把" },
  { id: "zh.complements", language: "zh", skill: "any", nameEn: "Result & direction complements", nameTh: "ส่วนเติมเต็มบอกผลและทิศทาง" },
  { id: "zh.character_recognition", language: "zh", skill: "reading", nameEn: "Character recognition", nameTh: "การจำอักษรจีน" },
  { id: "zh.character_writing", language: "zh", skill: "writing", nameEn: "Character writing", nameTh: "การเขียนอักษรจีน" },
  { id: "zh.vocabulary_recall", language: "zh", skill: "vocabulary", nameEn: "Vocabulary recall", nameTh: "การนึกคำศัพท์" },
  { id: "zh.politeness", language: "zh", skill: "any", nameEn: "Politeness & register", nameTh: "ความสุภาพและระดับภาษา" },
  { id: "zh.listening_detail", language: "zh", skill: "listening", nameEn: "Listening for detail", nameTh: "ฟังจับรายละเอียด" },
  { id: "zh.listening_gist", language: "zh", skill: "listening", nameEn: "Listening for gist", nameTh: "ฟังจับใจความหลัก" },
  { id: "zh.reading_main_idea", language: "zh", skill: "reading", nameEn: "Reading for main idea", nameTh: "อ่านจับใจความสำคัญ" },
  { id: "zh.reading_inference", language: "zh", skill: "reading", nameEn: "Reading inference", nameTh: "การอนุมานจากบทอ่าน" },
  { id: "zh.pronunciation", language: "zh", skill: "speaking", nameEn: "Pronunciation (recognition-based)", nameTh: "การออกเสียง (จากการรู้จำเสียง)" },
  { id: "zh.fluency_hesitation", language: "zh", skill: "speaking", nameEn: "Speaking hesitation / fluency", nameTh: "ความลื่นไหลในการพูด" },
];

export const TAG_IDS = new Set(WEAKNESS_CATEGORIES.map((c) => c.id));
