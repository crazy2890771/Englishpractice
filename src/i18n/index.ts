/**
 * UI language: Thai (default) or English. Strings are written inline as pairs so every
 * screen stays readable in both languages: L("วันนี้", "Today").
 */
export type UiLang = "th" | "en";

export function makeL(lang: UiLang) {
  return (th: string, en: string) => (lang === "en" ? en : th);
}

export const SKILL_NAMES: Record<string, { th: string; en: string }> = {
  listening: { th: "การฟัง", en: "Listening" },
  speaking: { th: "การพูด", en: "Speaking" },
  reading: { th: "การอ่าน", en: "Reading" },
  writing: { th: "การเขียน", en: "Writing" },
  vocabulary: { th: "คำศัพท์", en: "Vocabulary" },
};

export const WEEKDAY_NAMES: { th: string; en: string; short: { th: string; en: string } }[] = [
  { th: "วันอาทิตย์", en: "Sunday", short: { th: "อา.", en: "Sun" } },
  { th: "วันจันทร์", en: "Monday", short: { th: "จ.", en: "Mon" } },
  { th: "วันอังคาร", en: "Tuesday", short: { th: "อ.", en: "Tue" } },
  { th: "วันพุธ", en: "Wednesday", short: { th: "พ.", en: "Wed" } },
  { th: "วันพฤหัสบดี", en: "Thursday", short: { th: "พฤ.", en: "Thu" } },
  { th: "วันศุกร์", en: "Friday", short: { th: "ศ.", en: "Fri" } },
  { th: "วันเสาร์", en: "Saturday", short: { th: "ส.", en: "Sat" } },
];

export const TOPIC_NAMES: Record<string, { th: string; en: string }> = {
  daily: { th: "สนทนาในชีวิตประจำวัน", en: "Daily conversation" },
  travel: { th: "การเดินทาง", en: "Travel" },
  business: { th: "ธุรกิจและการทำงาน", en: "Business" },
  aviation: { th: "การบิน", en: "Aviation" },
  interviews: { th: "สัมภาษณ์งาน", en: "Interviews" },
  news: { th: "ข่าวและความรู้ทั่วไป", en: "News & general knowledge" },
  mixed: { th: "หลากหลายหัวข้อ", en: "Mixed topics" },
};

/** Machine error codes from the API → learner-friendly messages. */
export const ERRORS: Record<string, { th: string; en: string }> = {
  unauthorized: { th: "กรุณาเข้าสู่ระบบอีกครั้ง", en: "Please sign in again." },
  needs_placement: { th: "กรุณาทำแบบทดสอบวัดระดับ (หรือเลือกเริ่มจากพื้นฐาน) ก่อน", en: "Take the placement test (or start from the beginning) first." },
  unit_not_ready: { th: "ฝึกในหน่วยนี้เพิ่มอีกนิดก่อนทำแบบทดสอบประจำหน่วย", en: "Practise this unit a little more before its unit test." },
  units_incomplete: { th: "ต้องผ่านทุกหน่วยในระดับนี้ก่อนสอบเลื่อนระดับ", en: "Complete every unit in this level before the level exam." },
  remediation_pending: { th: "ทำบทเรียนทบทวนตามแผนให้เสร็จก่อนสอบใหม่", en: "Finish your review plan before retaking the exam." },
  unit_locked: { th: "หน่วยนี้ยังล็อกอยู่", en: "This unit is still locked." },
  ai_required: { th: "ต้องตั้งค่า AI ก่อนจึงสร้างแบบฝึกเพิ่มได้", en: "An AI provider is required to generate exercises." },
  no_consent: { th: "ยังไม่ได้อนุญาตให้บันทึกเสียง (ตั้งค่าได้ในโปรไฟล์)", en: "Recording storage is off (enable it in Profile)." },
  no_content: { th: "ระดับนี้ยังไม่มีเนื้อหา", en: "This level has no content yet." },
  rate_limited: { th: "ส่งคำขอถี่เกินไป รอสักครู่แล้วลองใหม่", en: "Too many requests. Please wait a moment." },
  daily_limit: { th: "ใช้ AI ครบโควตาวันนี้แล้ว", en: "Daily AI limit reached." },
  ai_unavailable: { th: "บริการ AI ไม่พร้อมใช้งานชั่วคราว ลองใหม่อีกครั้ง", en: "The AI service is temporarily unavailable. Please retry." },
  ai_error: { th: "บริการ AI ตอบกลับผิดพลาด", en: "The AI service returned an error." },
  empty_answer: { th: "ยังไม่มีคำตอบ", en: "Please answer first." },
  stale_item: { th: "คำถามนี้หมดอายุแล้ว กำลังโหลดข้อถัดไป", en: "This question expired; loading the next one." },
  session_completed: { th: "บทเรียนนี้จบแล้ว", en: "This session is already finished." },
  already_answered: { th: "ตอบข้อนี้ไปแล้ว", en: "Already answered." },
  network: { th: "เชื่อมต่ออินเทอร์เน็ตไม่ได้ ลองใหม่อีกครั้ง", en: "Network error. Please try again." },
  timeout: { th: "ใช้เวลานานเกินไป ลองใหม่อีกครั้ง", en: "That took too long. Please try again." },
  not_found: { th: "ไม่พบข้อมูล", en: "Not found." },
  server_error: { th: "เกิดข้อผิดพลาด ลองใหม่อีกครั้ง", en: "Something went wrong. Please try again." },
  invalid_input: { th: "ข้อมูลไม่ถูกต้อง", en: "Invalid input." },
};

export function errorText(code: string | undefined, lang: UiLang) {
  const e = ERRORS[code ?? ""] ?? ERRORS.server_error!;
  return lang === "en" ? e.en : e.th;
}

/**
 * Deterministic date label (same output on the server and in the browser, avoiding hydration
 * mismatches from differing default locales / time zones).
 */
export function formatDate(iso: string | Date, lang: UiLang, timeZone = "Asia/Bangkok") {
  return new Date(iso).toLocaleDateString(lang === "en" ? "en-GB" : "th-TH", { day: "numeric", month: "short", year: "numeric", timeZone });
}
