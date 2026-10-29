import type { LanguageModule } from "./types";

export const chinese: LanguageModule = {
  id: "zh",
  nameEn: "Mandarin Chinese",
  nameTh: "ภาษาจีนกลาง",
  nativeName: "中文",
  framework: "HSK 3.0",
  frameworkNoteTh: "อ้างอิงกรอบ HSK 3.0 ระดับ 1–9 (ผลจากแอปเป็นการประเมินโดยประมาณ ไม่ใช่ผลสอบ HSK)",
  levels: [
    { code: "HSK1", nameTh: "HSK 1 · เริ่มต้น", descriptionTh: "ทักทาย แนะนำตัว และประโยคสั้นที่สุด" },
    { code: "HSK2", nameTh: "HSK 2 · พื้นฐาน", descriptionTh: "เรื่องในชีวิตประจำวันแบบง่าย" },
    { code: "HSK3", nameTh: "HSK 3 · พื้นฐานสูง", descriptionTh: "สื่อสารเรื่องงาน การเดินทาง และการแก้ปัญหาเบื้องต้น" },
    { code: "HSK4", nameTh: "HSK 4 · กลาง", descriptionTh: "แสดงความคิดเห็นและเล่าประสบการณ์ได้" },
    { code: "HSK5", nameTh: "HSK 5 · กลางค่อนสูง", descriptionTh: "อ่านและฟังเนื้อหาทั่วไปได้คล่องขึ้น" },
    { code: "HSK6", nameTh: "HSK 6 · สูง", descriptionTh: "สื่อสารเรื่องซับซ้อนได้" },
    { code: "HSK7", nameTh: "HSK 7 · สูงมาก (7–9)", descriptionTh: "ระดับสูงสำหรับงานวิชาชีพ" },
    { code: "HSK8", nameTh: "HSK 8", descriptionTh: "ระดับสูงสำหรับงานวิชาชีพ" },
    { code: "HSK9", nameTh: "HSK 9", descriptionTh: "ใกล้เคียงเจ้าของภาษา" },
  ],
  skills: ["listening", "speaking", "reading", "writing", "vocabulary"],
  placementStart: "HSK2",
  ttsLang: "zh-CN",
  sttLang: "zh-CN",
  writingSystem: "hanzi",
  lengthUnit: "characters",
  supportsPinyin: true,
  tutorNotes:
    "Teach Mandarin Chinese with simplified characters. Always provide pinyin with tone marks for new or difficult words. Explanations may be in Thai. Pay attention to word order (time/place before the verb), measure words, 了, and tones.",
  rubricNotes:
    "For Chinese, assess word order, measure words and particle use. Tones cannot be assessed from a text transcript — do not score pronunciation or tones from text.",
};
