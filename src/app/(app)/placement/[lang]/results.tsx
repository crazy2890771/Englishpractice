"use client";
import Link from "next/link";
import { ArrowRight, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useL } from "@/components/app/ui-context";
import { SKILL_NAMES } from "@/i18n";

const LIMIT_TEXT: Record<string, [string, string]> = {
  unofficial: ["เป็นการประเมินโดยประมาณ ไม่ใช่ผลสอบรับรอง", "Unofficial estimate, not a certified result"],
  item_limit: ["ครบจำนวนข้อสูงสุดก่อนหาระดับได้ชัดเจน", "Reached the item limit before a clear result"],
  ceiling: ["ผ่านระดับสูงสุดที่ทดสอบ ระดับจริงอาจสูงกว่านี้", "Passed the highest level tested — real level may be higher"],
  floor: ["ยังไม่ผ่านระดับแรก — เริ่มจากพื้นฐาน", "Below the first level tested — start from basics"],
  few_items: ["ตอบจำนวนข้อน้อย ความแม่นยำต่ำ", "Few items answered — lower precision"],
  open_task_estimate: ["ประเมินจากงานพูด/เขียน 2 ชิ้น", "Based on two speaking/writing tasks"],
  demo_evaluator: ["ใช้ตัวตรวจแบบกฎในโหมดเดโม (ไม่ใช่ AI) ความแม่นยำจำกัด", "Rule-based demo evaluator (not AI) — limited accuracy"],
  no_pronunciation_assessment: ["ไม่ได้ประเมินการออกเสียง", "Pronunciation not assessed"],
  skipped: ["ข้ามทักษะนี้ — ไม่ได้วัดจริง สอบใหม่ได้ในหน้าโปรไฟล์", "Skipped — not measured; you can retake it from Profile"],
};

export function PlacementResults(props: {
  language: string;
  languageName: string;
  frameworkNote: string;
  completedAt: string | null;
  skills: { skill: string; status: string; level: string | null; levelName: string | null; confidence: string | null; strengths: string[]; weaknesses: string[]; limitations: string[]; detail: { belowFirstLevel?: boolean } | null; evaluator: string | null }[];
  recommendations: { skill: string; level: string; fromOtherSkills: boolean; unit: { id: string; title: string; titleTh: string } | null }[];
  priorities: { skills: string[]; tags: string[] };
}) {
  const L = useL();
  const conf = (c: string | null) => (c === "high" ? L("ความเชื่อมั่นสูง", "High confidence") : c === "medium" ? L("ความเชื่อมั่นปานกลาง", "Medium confidence") : L("ความเชื่อมั่นต่ำ", "Low confidence"));
  return (
    <div className="mx-auto max-w-3xl space-y-6 py-2">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{L(`ผลวัดระดับ${props.languageName}`, `${props.languageName} placement results`)}</h1>
        <p className="mt-1 flex items-start gap-2 text-sm text-muted-foreground"><Info className="mt-0.5 size-4 shrink-0" />{L(props.frameworkNote, "Unofficial app estimate — not a certified CEFR or HSK result.")}</p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {props.skills.map((s) => {
          const rec = props.recommendations.find((r) => r.skill === s.skill);
          return (
            <Card key={s.skill}>
              <CardHeader>
                <div className="flex items-center justify-between gap-2">
                  <CardTitle>{L(SKILL_NAMES[s.skill]!.th, SKILL_NAMES[s.skill]!.en)}</CardTitle>
                  {s.status === "skipped" ? <Badge variant="secondary">{L("ข้าม", "Skipped")}</Badge> : <Badge variant={s.confidence === "high" ? "success" : s.confidence === "medium" ? "default" : "warning"}>{conf(s.confidence)}</Badge>}
                </div>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <p className="text-2xl font-semibold">
                  {s.level ?? rec?.level ?? "—"}
                  {s.detail?.belowFirstLevel && <span className="ml-2 text-sm font-normal text-muted-foreground">{L("(เริ่มต้น)", "(beginner)")}</span>}
                  {s.status === "skipped" && rec && <span className="ml-2 text-sm font-normal text-muted-foreground">{rec.fromOtherSkills ? L("(อ้างอิงจากทักษะอื่น)", "(from your other skills)") : L("(เริ่มจากพื้นฐาน)", "(from the basics)")}</span>}
                </p>
                {s.strengths.length > 0 && <p><span className="text-muted-foreground">{L("จุดแข็ง: ", "Strengths: ")}</span>{s.strengths.join(", ")}</p>}
                {s.weaknesses.length > 0 && <p><span className="text-muted-foreground">{L("ควรพัฒนา: ", "To improve: ")}</span>{s.weaknesses.join(", ")}</p>}
                {rec?.unit && <p><span className="text-muted-foreground">{L("เริ่มที่: ", "Start with: ")}</span>{rec.level} · {L(rec.unit.titleTh, rec.unit.title)}</p>}
                <ul className="space-y-0.5 text-xs text-muted-foreground">
                  {s.limitations.filter((x) => x !== "unofficial").map((x) => (
                    <li key={x}>• {LIMIT_TEXT[x] ? L(...LIMIT_TEXT[x]!) : x}</li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          );
        })}
      </div>
      {(props.priorities.skills.length > 0 || props.priorities.tags.length > 0) && (
        <Card>
          <CardHeader><CardTitle>{L("ลำดับความสำคัญในการเรียน", "Your learning priorities")}</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            {props.priorities.skills.length > 0 && <p>{L("ทักษะที่ควรเน้น: ", "Focus skills: ")}{props.priorities.skills.map((s) => L(SKILL_NAMES[s]!.th, SKILL_NAMES[s]!.en)).join(", ")}</p>}
            {props.priorities.tags.length > 0 && <p>{L("หัวข้อที่ควรฝึก: ", "Topics to work on: ")}{props.priorities.tags.join(", ")}</p>}
          </CardContent>
        </Card>
      )}
      <Button asChild size="lg">
        <Link href="/today">{L("เริ่มเรียนวันนี้", "Start learning")} <ArrowRight /></Link>
      </Button>
    </div>
  );
}
