import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { asUser } from "@/db";
import { getLearner } from "@/server/learner";
import { learnOverview } from "@/server/learn";
import { getUnit } from "@/content";
import { isLanguage } from "@/languages";
import { makeL, SKILL_NAMES } from "@/i18n";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { UNIT_PRACTICE_MIN_ACCURACY, UNIT_PRACTICE_MIN_ITEMS } from "@/engine/progression";
import { AssessmentButton } from "../assessment-button";

export default async function UnitPage({ params }: { params: Promise<{ lang: string; unitId: string }> }) {
  const { lang, unitId } = await params;
  const unit = getUnit(unitId);
  if (!isLanguage(lang) || !unit || unit.language !== lang) notFound();
  const learner = await getLearner();
  const L = makeL(learner.profile.uiLanguage === "en" ? "en" : "th");
  const o = await asUser(learner.id, (tx) => learnOverview(tx, learner.id, lang));
  const u = o.units.find((x) => x.id === unitId)!;
  if (!u.unlocked) notFound();
  const zh = lang === "zh";
  const showPinyin = learner.profile.showPinyin;
  const sk = (s: string) => L(SKILL_NAMES[s]!.th, SKILL_NAMES[s]!.en);

  return (
    <div className="space-y-6">
      <Button asChild variant="ghost" size="sm">
        <Link href={`/learn/${lang}`}>
          <ArrowLeft /> {L("หลักสูตร", "Curriculum")}
        </Link>
      </Button>
      <header>
        <p className="text-sm text-muted-foreground">
          {unit.level} · {L(`หน่วยที่ ${unit.order}`, `Unit ${unit.order}`)}
        </p>
        <h1 className={cn("text-2xl font-semibold tracking-tight", zh && "zh")}>{unit.title}</h1>
        <p className="text-muted-foreground">{unit.titleTh}</p>
      </header>

      <section aria-labelledby="skills" className="space-y-3">
        <h2 id="skills" className="text-sm font-medium text-muted-foreground">{L("ความคืบหน้าแต่ละทักษะ", "Progress by skill")}</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          {u.perSkill.map((p) => (
            <Card key={p.skill} className="gap-3 py-4">
              <CardContent className="space-y-3">
                <div className="flex items-center justify-between">
                  <p className="font-medium">{sk(p.skill)}</p>
                  <Badge variant={p.status === "completed" ? "success" : p.status === "ready" ? "warning" : p.status === "locked" ? "secondary" : "default"}>
                    {p.status === "completed" ? L("ผ่านแล้ว", "Completed") : p.status === "ready" ? L("พร้อมทดสอบ", "Test ready") : p.status === "locked" ? L("ล็อก", "Locked") : L("กำลังเรียน", "In progress")}
                  </Badge>
                </div>
                {p.status !== "locked" && (
                  <>
                    <div className="space-y-1">
                      <Progress value={Math.min(100, (p.practiceAttempts / UNIT_PRACTICE_MIN_ITEMS) * 100)} aria-label={L("ฝึกแล้ว", "Practised")} />
                      <p className="text-xs text-muted-foreground">
                        {L(`ฝึกแล้ว ${p.practiceAttempts} ข้อ · ถูก ${Math.round(p.practiceAccuracy * 100)}%`, `${p.practiceAttempts} practised · ${Math.round(p.practiceAccuracy * 100)}% correct`)}
                        {p.status === "active" && L(` (ทดสอบได้เมื่อฝึก ≥ ${UNIT_PRACTICE_MIN_ITEMS} ข้อ และถูก ≥ ${UNIT_PRACTICE_MIN_ACCURACY * 100}%)`, ` (test unlocks at ≥ ${UNIT_PRACTICE_MIN_ITEMS} items and ≥ ${UNIT_PRACTICE_MIN_ACCURACY * 100}%)`)}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <AssessmentButton body={{ kind: "practice", language: lang, skills: [p.skill], minutes: 15, unitId: unit.id }} label={L("ฝึกทักษะนี้", "Practise")} variant="outline" />
                      {(p.status === "ready" || p.status === "completed") && <AssessmentButton body={{ kind: "unit_assessment", unitId: unit.id, skill: p.skill }} label={p.status === "completed" ? L("ทดสอบอีกครั้ง", "Retake test") : L("ทำแบบทดสอบประจำหน่วย", "Take unit test")} />}
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <Card>
        <CardHeader>
          <CardTitle>{L("เป้าหมายของหน่วยนี้", "Learning objectives")}</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2 text-sm">
            {unit.objectives.map((ob) => (
              <li key={ob.id} className="flex gap-2">
                <Badge variant="secondary" className="shrink-0">{sk(ob.skill)}</Badge>
                <span>{L(ob.textTh, ob.textEn)}</span>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      {unit.grammar.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>{L("ไวยากรณ์", "Grammar")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            {unit.grammar.map((g) => (
              <div key={g.id} className="space-y-2">
                <p className={cn("font-medium", zh && "zh")}>{g.title}</p>
                <p className="text-sm text-muted-foreground">{L(g.explanationTh, g.explanationEn)}</p>
                <ul className="space-y-1.5 rounded-xl bg-secondary/60 p-3 text-sm">
                  {g.examples.map((ex, i) => (
                    <li key={i}>
                      {zh && showPinyin && ex.pinyin && <p className="text-xs text-muted-foreground">{ex.pinyin}</p>}
                      <p className={cn(zh && "zh")}>{ex.text}</p>
                      {ex.th && <p className="text-xs text-muted-foreground">{ex.th}</p>}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>{L("คำศัพท์", "Vocabulary")}</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="divide-y text-sm">
            {unit.vocabulary.map((v) => (
              <li key={v.word} className="grid gap-1 py-3 sm:grid-cols-[1fr_1.4fr]">
                <div>
                  <p className={cn("font-medium", zh && "zh text-base")}>{v.word}</p>
                  {v.pronunciation && (!zh || showPinyin) && <p className="text-xs text-muted-foreground">{v.pronunciation}</p>}
                </div>
                <div>
                  <p>{v.meaningTh}</p>
                  <p className={cn("text-muted-foreground", zh && "zh")}>{v.example}</p>
                </div>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
