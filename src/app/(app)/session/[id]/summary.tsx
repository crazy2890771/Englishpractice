"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ArrowRight, CheckCircle2, Loader2, Trophy, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { useL, usePrefs } from "@/components/app/ui-context";
import { SKILL_NAMES, errorText } from "@/i18n";
import { api, ApiError } from "@/lib/client/api";

interface ExamSummary {
  resultId: string;
  overall: number;
  passed: boolean;
  sections: { sectionId: string; score: number; required: boolean; passed: boolean; performanceCompleted: boolean }[];
  criteria: { overall: boolean; sections: boolean; performance: boolean };
  remediation: { failedSections: string[]; focusTags: string[]; requiredSessions: number } | null;
  advanced: { nextLevel: string; hasContent: boolean } | null;
  sectionTitles: Record<string, { th: string; en: string }>;
}

export function SessionSummary({ languageId, summary }: { kind: string; languageId: string; summary: Record<string, unknown> }) {
  const L = useL();
  const router = useRouter();
  const { uiLang } = usePrefs();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const pct = (n: unknown) => `${Math.round(Number(n ?? 0) * 100)}%`;
  const bySkill = (summary.bySkill ?? {}) as Record<string, number>;
  const exam = summary.exam as ExamSummary | undefined;
  const unit = summary.assessment as { score: number; passed: boolean; unlocked: { next: string | null; levelUnitsDone: boolean } | null } | undefined;
  const remediation = summary.remediation as { counted: boolean; completed?: number; required?: number } | undefined;

  async function startRemediation(resultId: string) {
    setBusy(true);
    try {
      const r = await api<{ id: string }>("/api/sessions", { body: { kind: "remediation", language: languageId, resultId } });
      router.push(`/session/${r.id}`);
    } catch (e) {
      setErr(errorText((e as ApiError).code, uiLang));
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-5 py-2">
      <div className="text-center">
        {exam ? (exam.passed ? <Trophy className="mx-auto size-10 text-amber-500" /> : <XCircle className="mx-auto size-10 text-muted-foreground" />) : <CheckCircle2 className="mx-auto size-10 text-emerald-600" />}
        <h1 className="mt-3 text-2xl font-semibold tracking-tight">
          {exam ? (exam.passed ? L("สอบผ่าน!", "Exam passed!") : L("ยังไม่ผ่านครั้งนี้", "Not passed this time")) : unit ? (unit.passed ? L("ผ่านแบบทดสอบประจำหน่วย", "Unit assessment passed") : L("ยังไม่ผ่านแบบทดสอบประจำหน่วย", "Unit assessment not passed")) : L("จบบทเรียนแล้ว", "Session complete")}
        </h1>
      </div>

      <Card>
        <CardContent className="grid grid-cols-3 gap-3 text-center">
          <div>
            <p className="text-2xl font-semibold">{pct(exam?.overall ?? unit?.score ?? summary.accuracy)}</p>
            <p className="text-xs text-muted-foreground">{exam || unit ? L("คะแนน", "Score") : L("ความถูกต้อง", "Accuracy")}</p>
          </div>
          <div>
            <p className="text-2xl font-semibold">{String(summary.answered ?? 0)}</p>
            <p className="text-xs text-muted-foreground">{L("ข้อที่ทำ", "Answered")}</p>
          </div>
          <div>
            <p className="text-2xl font-semibold">{String(summary.minutes ?? 0)}</p>
            <p className="text-xs text-muted-foreground">{L("นาที", "Minutes")}</p>
          </div>
        </CardContent>
      </Card>

      {exam && (
        <Card>
          <CardHeader>
            <CardTitle>{L("ผลแต่ละส่วน", "Section results")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            {exam.sections.map((s) => (
              <div key={s.sectionId} className="space-y-1">
                <div className="flex justify-between">
                  <span>{L(exam.sectionTitles[s.sectionId]?.th ?? s.sectionId, exam.sectionTitles[s.sectionId]?.en ?? s.sectionId)}</span>
                  <span className={s.passed && s.performanceCompleted ? "text-emerald-700" : "text-red-700"}>{pct(s.score)}</span>
                </div>
                <Progress value={s.score * 100} indicatorClassName={s.passed ? "bg-emerald-600" : "bg-red-500"} />
                {!s.performanceCompleted && <p className="text-xs text-red-700">{L("งานภาคปฏิบัติยังไม่ครบตามความยาวขั้นต่ำ", "Performance task not completed (minimum length).")}</p>}
              </div>
            ))}
            <ul className="space-y-1 border-t pt-3 text-xs text-muted-foreground">
              <li>{exam.criteria.overall ? "✓" : "✗"} {L("คะแนนรวมอย่างน้อย 80%", "Overall score at least 80%")}</li>
              <li>{exam.criteria.sections ? "✓" : "✗"} {L("ทุกส่วนที่บังคับอย่างน้อย 70%", "Every required section at least 70%")}</li>
              <li>{exam.criteria.performance ? "✓" : "✗"} {L("ทำงานภาคปฏิบัติครบ", "Mandatory performance tasks completed")}</li>
              <li>{L("เกณฑ์ภายในของแอป ไม่ใช่มาตรฐานการรับรอง CEFR/HSK", "Internal app criteria — not official CEFR/HSK standards.")}</li>
            </ul>
            {exam.passed && exam.advanced && (
              <p className="rounded-xl bg-emerald-50 px-3 py-2 text-emerald-800">
                {L(`ปลดล็อกระดับ ${exam.advanced.nextLevel} แล้ว`, `Level ${exam.advanced.nextLevel} unlocked`)}
                {!exam.advanced.hasContent && L(" (เนื้อหาระดับนี้กำลังจะมา)", " (content for this level is coming soon)")}
              </p>
            )}
            {!exam.passed && exam.remediation && (
              <div className="space-y-2 rounded-xl bg-secondary p-3">
                <p className="font-medium">{L("แผนทบทวนก่อนสอบใหม่", "Your remediation plan")}</p>
                <p className="text-muted-foreground">
                  {L(`ทำบทเรียนทบทวนที่เน้นส่วนที่ยังไม่ผ่าน ${exam.remediation.requiredSessions} ครั้ง (ได้ 70% ขึ้นไป) แล้วจึงสอบใหม่ได้`, `Complete ${exam.remediation.requiredSessions} focused review session(s) with at least 70%, then retake the exam.`)}
                </p>
                <Button size="sm" onClick={() => startRemediation(exam.resultId)} disabled={busy}>
                  {busy && <Loader2 className="animate-spin" />} {L("เริ่มบทเรียนทบทวน", "Start remediation")}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {unit && (
        <Card>
          <CardContent className="space-y-2 text-sm">
            <p>{unit.passed ? (unit.unlocked?.next ? L("ปลดล็อกหน่วยถัดไปแล้ว", "Next unit unlocked.") : L("ผ่านทุกหน่วยในระดับนี้แล้ว — พร้อมสอบเลื่อนระดับ", "All units in this level done — the level exam is available.")) : L("ต้องได้อย่างน้อย 70% ฝึกเพิ่มแล้วลองใหม่ได้", "You need at least 70%. Practise more and try again.")}</p>
          </CardContent>
        </Card>
      )}

      {remediation && (
        <p className="rounded-xl bg-secondary px-4 py-3 text-sm">
          {remediation.counted ? L(`นับเป็นบทเรียนทบทวน ${remediation.completed}/${remediation.required}`, `Counted as remediation ${remediation.completed}/${remediation.required}`) : L("ต้องได้ 70% ขึ้นไปจึงนับเป็นบทเรียนทบทวน", "You need at least 70% for this to count.")}
        </p>
      )}

      {Object.keys(bySkill).length > 0 && !exam && (
        <Card>
          <CardHeader>
            <CardTitle>{L("ตามทักษะ", "By skill")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            {Object.entries(bySkill).map(([s, v]) => (
              <div key={s} className="space-y-1">
                <div className="flex justify-between">
                  <span>{L(SKILL_NAMES[s]!.th, SKILL_NAMES[s]!.en)}</span>
                  <span>{pct(v)}</span>
                </div>
                <Progress value={v * 100} />
              </div>
            ))}
            {Number(summary.retries ?? 0) > 0 && <p className="text-muted-foreground">{L(`แก้ไขถูกในรอบ "ลองใหม่" ${summary.retriesFixed}/${summary.retries} ข้อ`, `Fixed ${summary.retriesFixed}/${summary.retries} in "corrections & retry".`)}</p>}
            <p className="text-xs text-muted-foreground">{L("คะแนนฝึกหัด ไม่ใช่ระดับความสามารถทางภาษาอย่างเป็นทางการ", "Practice scores — not a standardised proficiency level.")}</p>
          </CardContent>
        </Card>
      )}
      {err && <p role="alert" className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{err}</p>}
      <div className="flex flex-wrap gap-2">
        <Button asChild>
          <Link href="/today">{L("กลับหน้าวันนี้", "Back to Today")} <ArrowRight /></Link>
        </Button>
        <Button asChild variant="outline">
          <Link href="/progress">{L("ดูพัฒนาการ", "See progress")}</Link>
        </Button>
      </div>
    </div>
  );
}
