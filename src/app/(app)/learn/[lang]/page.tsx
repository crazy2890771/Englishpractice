import Link from "next/link";
import { notFound } from "next/navigation";
import { Lock, CheckCircle2, CircleDot, GraduationCap, ClipboardCheck, RotateCcw } from "lucide-react";
import { and, eq } from "drizzle-orm";
import { asUser, schema } from "@/db";
import { getLearner } from "@/server/learner";
import { learnOverview } from "@/server/learn";
import { isLanguage, lang as langModule } from "@/languages";
import { makeL, SKILL_NAMES } from "@/i18n";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { AssessmentButton } from "./assessment-button";

export const metadata = { title: "บทเรียน" };

const STATUS_STYLE: Record<string, string> = {
  completed: "bg-emerald-50 text-emerald-700",
  ready: "bg-amber-50 text-amber-800",
  active: "bg-accent text-accent-foreground",
  locked: "bg-secondary text-muted-foreground",
};

export default async function LearnPage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  if (!isLanguage(lang)) notFound();
  const learner = await getLearner();
  const L = makeL(learner.profile.uiLanguage === "en" ? "en" : "th");
  const m = langModule(lang);
  const { o, active } = await asUser(learner.id, async (tx) => ({
    o: await learnOverview(tx, learner.id, lang),
    active: (await tx.select().from(schema.userLanguages).where(and(eq(schema.userLanguages.userId, learner.id), eq(schema.userLanguages.active, true)))).map((r) => r.languageId),
  }));
  const sk = (s: string) => L(SKILL_NAMES[s]!.th, SKILL_NAMES[s]!.en);

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{L("หลักสูตรของคุณ", "Your curriculum")}</h1>
          <p className="text-sm text-muted-foreground">{L(`${m.framework} · ระดับแยกตามทักษะ`, `${m.framework} · levels tracked per skill`)}</p>
        </div>
        <nav aria-label={L("ภาษา", "Language")} className="inline-flex rounded-xl bg-secondary p-1">
          {(["en", "zh"] as const)
            .filter((l) => active.includes(l) || l === lang)
            .map((l) => (
              <Link key={l} href={`/learn/${l}`} aria-current={l === lang ? "page" : undefined} className={cn("rounded-lg px-3 py-1.5 text-sm font-medium", l === lang ? "bg-background shadow-sm" : "text-muted-foreground")}>
                {L(langModule(l).nameTh, langModule(l).nameEn)}
              </Link>
            ))}
        </nav>
      </header>

      {!o.hasPlacement ? (
        <Card>
          <CardContent className="space-y-3">
            <p>{L("ทำแบบทดสอบวัดระดับเพื่อสร้างหลักสูตรที่เหมาะกับคุณ", "Take the placement test to build your personalised curriculum.")}</p>
            <Button asChild>
              <Link href={`/placement/${lang}`}>{L("ไปที่แบบทดสอบวัดระดับ", "Go to placement")}</Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <>
          <section aria-labelledby="tracks" className="space-y-3">
            <h2 id="tracks" className="text-sm font-medium text-muted-foreground">{L("ระดับปัจจุบันแต่ละทักษะ", "Current level by skill")}</h2>
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
              {o.tracks.map((t) => (
                <div key={t.skill} className="rounded-xl border bg-card px-3 py-2.5" title={t.unit ? L(t.unit.titleTh, t.unit.title) : undefined}>
                  <p className="text-[11px] text-muted-foreground">{sk(t.skill)}</p>
                  <p className="text-lg font-semibold leading-tight">{t.level ?? "—"}</p>
                </div>
              ))}
            </div>
          </section>

          {(o.readyUnitTests.length > 0 || o.exams.some((e) => e.eligible) || o.remediation.length > 0) && (
            <section aria-labelledby="upcoming" className="space-y-3">
              <h2 id="upcoming" className="text-sm font-medium text-muted-foreground">{L("การทดสอบที่พร้อมให้ทำ", "Upcoming assessments")}</h2>
              <div className="grid gap-2">
                {o.readyUnitTests.map((u) => (
                  <Card key={`${u.unitId}-${u.skill}`} className="py-4">
                    <CardContent className="flex flex-wrap items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <ClipboardCheck className="size-5 text-amber-700" />
                        <div className="text-sm">
                          <p className="font-medium">{L("แบบทดสอบประจำหน่วย", "Unit assessment")} · {sk(u.skill)}</p>
                          <p className="text-muted-foreground">{u.level} · {L(u.titleTh, u.title)}</p>
                        </div>
                      </div>
                      <AssessmentButton body={{ kind: "unit_assessment", unitId: u.unitId, skill: u.skill }} label={L("เริ่มทดสอบ", "Start test")} />
                    </CardContent>
                  </Card>
                ))}
                {o.exams.filter((e) => e.eligible).map((e) => (
                  <Card key={`exam-${e.skill}`} className="py-4">
                    <CardContent className="flex flex-wrap items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <GraduationCap className="size-5 text-primary" />
                        <div className="text-sm">
                          <p className="font-medium">{L("สอบเลื่อนระดับ", "Level exam")} · {sk(e.skill)} · {e.level}</p>
                          <p className="text-muted-foreground">{L("ผ่านเมื่อ: รวม ≥ 80% · ทุกส่วน ≥ 70% · ทำงานภาคปฏิบัติครบ", "Pass: overall ≥ 80% · each section ≥ 70% · performance tasks done")}</p>
                        </div>
                      </div>
                      <AssessmentButton body={{ kind: "level_exam", language: lang, skill: e.skill }} label={L("เริ่มสอบ", "Start exam")} />
                    </CardContent>
                  </Card>
                ))}
                {o.remediation.map((r) => (
                  <Card key={r.id} className="py-4">
                    <CardContent className="flex flex-wrap items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <RotateCcw className="size-5 text-muted-foreground" />
                        <div className="text-sm">
                          <p className="font-medium">{L("แผนทบทวนก่อนสอบใหม่", "Remediation plan")} · {sk(r.skill)} · {r.level}</p>
                          <p className="text-muted-foreground">{L(`คะแนนครั้งก่อน ${Math.round(r.score * 100)}%`, `Last score ${Math.round(r.score * 100)}%`)}</p>
                        </div>
                      </div>
                      <AssessmentButton body={{ kind: "remediation", language: lang, resultId: r.id }} label={L("ทบทวน", "Review")} variant="outline" />
                    </CardContent>
                  </Card>
                ))}
              </div>
            </section>
          )}

          {o.levels.map((level) => {
            const levelUnits = o.units.filter((u) => u.level === level);
            // Only the learner's current level(s) are expanded; others stay folded to keep the page short.
            const current = o.tracks.some((t) => t.level === level);
            const unlocked = levelUnits.filter((u) => u.unlocked).length;
            const title = m.levels.find((l) => l.code === level)?.nameTh ? L(m.levels.find((l) => l.code === level)!.nameTh, level) : level;
            const grid = (
              <div className="grid gap-3 sm:grid-cols-2">
                {o.units
                  .filter((u) => u.level === level)
                  .map((u) => {
                    const body = (
                      <Card className={cn("h-full gap-3 transition-colors", u.unlocked ? "hover:border-primary/40" : "opacity-60")}>
                        <CardHeader>
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-xs text-muted-foreground">{L(`หน่วยที่ ${u.order}`, `Unit ${u.order}`)}</span>
                            {!u.unlocked && <Lock className="size-4 text-muted-foreground" aria-label={L("ล็อก", "Locked")} />}
                          </div>
                          <CardTitle className={cn(lang === "zh" && "zh")}>{u.title}</CardTitle>
                          <p className="text-sm text-muted-foreground">{u.titleTh}</p>
                        </CardHeader>
                        <CardContent className="flex flex-wrap gap-1.5">
                          {u.perSkill.map((p) => (
                            <span key={p.skill} className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium", STATUS_STYLE[p.status])}>
                              {p.status === "completed" ? <CheckCircle2 className="size-3" /> : p.status === "locked" ? <Lock className="size-3" /> : <CircleDot className="size-3" />}
                              {sk(p.skill)}
                            </span>
                          ))}
                        </CardContent>
                      </Card>
                    );
                    return u.unlocked ? (
                      <Link key={u.id} href={`/learn/${lang}/${u.id}`} className="rounded-2xl focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none">
                        {body}
                      </Link>
                    ) : (
                      <div key={u.id} aria-disabled>
                        {body}
                      </div>
                    );
                  })}
              </div>
            );
            return current ? (
              <section key={level} aria-labelledby={`lv-${level}`} className="space-y-3">
                <h2 id={`lv-${level}`} className="text-lg font-semibold">{title}</h2>
                {grid}
              </section>
            ) : (
              <details key={level} className="group rounded-2xl border bg-card/60">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3">
                  <span className="font-medium">{title}</span>
                  <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    {unlocked === 0 && <Lock className="size-3.5" aria-hidden />}
                    {L(`${levelUnits.length} หน่วย`, `${levelUnits.length} units`)}
                  </span>
                </summary>
                <div className="px-3 pb-3">{grid}</div>
              </details>
            );
          })}
          <p className="text-xs text-muted-foreground">{L("ระดับที่สูงกว่านี้จะเพิ่มเนื้อหาในอนาคต", "Higher levels will get content in future updates.")}</p>
        </>
      )}
    </div>
  );
}
