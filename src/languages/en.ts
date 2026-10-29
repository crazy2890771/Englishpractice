import type { LanguageModule } from "./types";

export const english: LanguageModule = {
  id: "en",
  nameEn: "English",
  nameTh: "ภาษาอังกฤษ",
  nativeName: "English",
  framework: "CEFR",
  frameworkNoteTh: "ระดับ CEFR A1–C2 (ผลจากแอปเป็นการประเมินโดยประมาณ ไม่ใช่ผลสอบรับรอง)",
  levels: [
    { code: "A1", nameTh: "A1 · เริ่มต้น", descriptionTh: "เข้าใจและใช้ประโยคพื้นฐานในชีวิตประจำวัน" },
    { code: "A2", nameTh: "A2 · พื้นฐาน", descriptionTh: "สื่อสารเรื่องง่าย ๆ ที่คุ้นเคยได้" },
    { code: "B1", nameTh: "B1 · ระดับกลาง", descriptionTh: "รับมือสถานการณ์ส่วนใหญ่เวลาเดินทางและทำงานได้" },
    { code: "B2", nameTh: "B2 · กลางค่อนสูง", descriptionTh: "สื่อสารได้คล่องและอธิบายความคิดเห็นได้ชัดเจน" },
    { code: "C1", nameTh: "C1 · สูง", descriptionTh: "ใช้ภาษาได้ยืดหยุ่นในงานวิชาชีพ" },
    { code: "C2", nameTh: "C2 · เชี่ยวชาญ", descriptionTh: "ใช้ภาษาได้ใกล้เคียงเจ้าของภาษา" },
  ],
  skills: ["listening", "speaking", "reading", "writing", "vocabulary"],
  placementStart: "B1",
  ttsLang: "en-US",
  sttLang: "en-US",
  writingSystem: "latin",
  lengthUnit: "words",
  supportsPinyin: false,
  tutorNotes: "Use natural, contemporary English. Accept both UK and US spelling and usage.",
  rubricNotes: "Do not penalise accepted regional variants (UK/US).",
};
