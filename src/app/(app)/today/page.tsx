import Link from "next/link";
import { ArrowRight, CalendarClock, CheckCircle2, Flame, Layers, Sparkles } from "lucide-react";
import { and, eq } from "drizzle-orm";
import { asUser, schema } from "@/db";
import { getLearner } from "@/server/learner";
import { todayView } from "@/server/today";
import { makeL, SKILL_NAMES, WEEKDAY_NAMES } from "@/i18n";
import { lang } from "@/languages";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { StartSession } from "@/components/app/start-session";

export const metadata = { title: "วันนี้" };

export default async function TodayPage() {
  const learner = await getLearner();
  const L = makeL(learner.profile.uiLanguage === "en" ? "en" : "th");
  const { view, active } = await asUser(learner.id, async (tx) => ({
    view: await todayView(tx, learner),
    active: (await tx.select().from(schema.userLanguages).where(and(eq(schema.userLanguages.userId, learner.id), eq(schema.userLanguages.active, true)))).map((r) => r.languageId),
  }));
  const hour = view.day.hour;
  const greeting = hour < 12 ? L("สวัสดีตอนเช้า", "Good morning") : hour < 17 ? L("สวัสดีตอนบ่าย", "Good afternoon") : L("สวัสดีตอนเย็น", "Good evening");
  const weekday = WEEKDAY_NAMES[view.day.weekday]!;
  const items = view.items.filter((i) => active.includes(i.slot.languageId));
  const skillNames = (skills: string[]) => skills.map((s) => L(SKILL_NAMES[s]!.th, SKILL_NAMES[s]!.en)).join(" + ");
  const langName = (id: string) => L(lang(id).nameTh, lang(id).nameEn);
  const dateLabel = new Date(`${view.day.date}T12:00:00Z`).toLocaleDateString(learner.profile.uiLanguage === "en" ? "en-GB" : "th-TH", { day: "numeric", month: "long", timeZone: "UTC" });

  return (
    <div className="space-y-6">
      <header>
        <p className="text-sm text-muted-foreground">
          {L(weekday.th, weekday.en)} · {dateLabel}
        </p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight sm:text-3xl">
          {greeting}, {learner.profile.displayName || L("นักเรียน", "learner")}
        </h1>
        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
          <div className="flex min-w-48 flex-1 items-center gap-2">
            <Progress className="h-2 max-w-56" value={Math.min(100, (view.goal.doneMinutes / Math.max(1, view.goal.minutes)) * 100)} aria-label={L("เป้าหมายวันนี้", "Today's goal")} />
            <span className="whitespace-nowrap text-muted-foreground">
              {view.goal.doneMinutes >= view.goal.minutes ? L("ครบเป้าวันนี้แล้ว ✓", "Today's goal done ✓") : L(`วันนี้ ${view.goal.doneMinutes}/${view.goal.minutes} นาที`, `Today ${view.goal.doneMinutes}/${view.goal.minutes} min`)}
            </span>
          </div>
          {view.goal.streak > 0 && (
            <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-800">
              <Flame className="size-3.5" aria-hidden /> {L(`เรียนต่อเนื่อง ${view.goal.streak} วัน`, `${view.goal.streak}-day streak`)}
            </span>
          )}
        </div>
      </header>

      {view.resume && (
        <Link href={`/session/${view.resume.id}`} className="flex items-center justify-between gap-3 rounded-2xl border border-primary/30 bg-accent px-4 py-3 text-accent-foreground hover:border-primary">
          <span className="min-w-0">
            <span className="block text-sm font-medium">{L("เรียนต่อจากที่ค้างไว้", "Continue where you left off")}</span>
            <span className="block truncate text-xs opacity-80">
              {langName(view.resume.languageId)} · {skillNames(view.resume.skills)} · {L(`ทำไปแล้ว ${view.resume.answered} ข้อ`, `${view.resume.answered} answered`)}
            </span>
          </span>
          <ArrowRight className="size-5 shrink-0" aria-hidden />
        </Link>
      )}

      <section aria-labelledby="today-heading" className="space-y-3">
        <h2 id="today-heading" className="text-sm font-medium text-muted-foreground">
          {L("บทเรียนตามตารางวันนี้", "Scheduled for today")}
        </h2>
        {items.length === 0 && (
          <Card>
            <CardContent className="text-sm text-muted-foreground">{L("วันนี้ไม่มีบทเรียนตามตาราง — ฝึกเพิ่มเติมได้ที่แท็บ “ฝึกฝน”", "Nothing scheduled today — try the Practice tab.")}</CardContent>
          </Card>
        )}
        {items.map((it) => {
          const review = it.slot.skills.length === 1 && it.slot.skills[0] === "vocabulary";
          return (
            <Card key={`${it.slot.languageId}-${it.slot.skills.join()}`} className="overflow-hidden">
              <CardHeader>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge>{langName(it.slot.languageId)}</Badge>
                  <Badge variant="secondary">{review ? L("คำศัพท์ + ทบทวน", "Vocabulary + review") : skillNames(it.slot.skills)}</Badge>
                  {it.completedSessionId && (
                    <Badge variant="success">
                      <CheckCircle2 /> {L("เรียนแล้ววันนี้", "Done today")}
                    </Badge>
                  )}
                </div>
                <CardTitle className="mt-2 text-xl">
                  {review
                    ? L("วันทบทวนคำศัพท์และจุดอ่อน", "Vocabulary & weakness review")
                    : it.units[0]?.unit
                      ? `${it.units[0].level} · ${L(it.units[0].unit.titleTh, it.units[0].unit.title)}`
                      : L("เริ่มต้นหลักสูตร", "Start your curriculum")}
                </CardTitle>
                {!review && it.units.length > 1 && it.units[1]?.unit && it.units[1].unit.id !== it.units[0]?.unit?.id && (
                  <CardDescription>
                    {L(SKILL_NAMES[it.units[1].skill]!.th, SKILL_NAMES[it.units[1].skill]!.en)}: {it.units[1].level} · {L(it.units[1].unit.titleTh, it.units[1].unit.title)}
                  </CardDescription>
                )}
                <CardDescription>
                  {L(`ประมาณ ${learner.profile.dailyMinutes} นาที`, `About ${learner.profile.dailyMinutes} minutes`)} ·{" "}
                  {review ? L("ทบทวนคำที่ถึงกำหนดและจุดอ่อนที่พบบ่อย", "Due words and recurring weaknesses") : L("วอร์มอัพ · ฝึกทักษะ · แก้ไขและลองใหม่ · แบบทดสอบย่อย", "Warm-up · skills · corrections & retry · mini assessment")}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {it.needsPlacement ? (
                  <Button asChild>
                    <Link href={`/placement/${it.slot.languageId}`}>
                      {L("ทำแบบทดสอบวัดระดับก่อน", "Take the placement test first")} <ArrowRight />
                    </Link>
                  </Button>
                ) : it.openSessionId ? (
                  <Button asChild>
                    <Link href={`/session/${it.openSessionId}`}>
                      {L("เรียนต่อจากที่ค้างไว้", "Continue where you left off")} <ArrowRight />
                    </Link>
                  </Button>
                ) : (
                  <StartSession language={it.slot.languageId} skills={it.slot.skills} kind={review ? "review" : "scheduled"} defaultMinutes={learner.profile.dailyMinutes} label={it.completedSessionId ? L("เรียนอีกรอบ", "Study again") : L("เริ่มเรียน", "Start learning")} variant={it.completedSessionId ? "outline" : "default"} />
                )}
              </CardContent>
            </Card>
          );
        })}
      </section>

      <div className="grid gap-3 sm:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <CalendarClock className="size-4 text-muted-foreground" /> {L("สัปดาห์นี้", "This week")}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <Progress value={(view.week.done / Math.max(1, view.week.planned)) * 100} aria-label={L("ความคืบหน้าสัปดาห์นี้", "Weekly progress")} />
            <p className="text-muted-foreground">
              {L(`เรียนตามตารางแล้ว ${view.week.done}/${view.week.planned} · เรียน ${view.week.activeDays} วัน`, `${view.week.done}/${view.week.planned} scheduled lessons · ${view.week.activeDays} active day(s)`)}
            </p>
            <Link href="/profile#schedule" className="text-sm font-medium text-primary hover:underline">
              {L("ดู/แก้ไขตารางเรียน", "View or edit schedule")}
            </Link>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Layers className="size-4 text-muted-foreground" /> {L("คำศัพท์รอทบทวน", "Vocabulary due")}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex gap-4">
              {active.includes("en") && <p><span className="text-xl font-semibold">{view.due.en}</span> <span className="text-muted-foreground">{L("อังกฤษ", "English")}</span></p>}
              {active.includes("zh") && <p><span className="text-xl font-semibold">{view.due.zh}</span> <span className="text-muted-foreground">{L("จีน", "Chinese")}</span></p>}
            </div>
            <Button asChild size="sm" variant="outline" disabled={view.due.en + view.due.zh === 0}>
              <Link href="/review">{L("ทบทวนตอนนี้", "Review now")}</Link>
            </Button>
          </CardContent>
        </Card>
      </div>

      {view.missed.filter((m) => active.includes(m.slot.languageId)).length > 0 && (
        <section aria-labelledby="missed" className="space-y-3">
          <h2 id="missed" className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
            <Sparkles className="size-4" /> {L("บทเรียนที่พลาดไป (เรียนชดเชยได้ถ้าต้องการ)", "Missed lessons (make them up if you like)")}
          </h2>
          <div className="grid gap-2">
            {view.missed
              .filter((m) => active.includes(m.slot.languageId))
              .slice(0, 3)
              .map((m) => (
                <Card key={`${m.date}-${m.slot.languageId}-${m.slot.skills.join()}`} className="py-4">
                  <CardContent className="flex flex-wrap items-center justify-between gap-3">
                    <div className="text-sm">
                      <p className="font-medium">
                        {langName(m.slot.languageId)} · {skillNames(m.slot.skills)}
                      </p>
                      <p className="text-muted-foreground">{new Date(`${m.date}T12:00:00Z`).toLocaleDateString(learner.profile.uiLanguage === "en" ? "en-GB" : "th-TH", { weekday: "long", day: "numeric", month: "short", timeZone: "UTC" })}</p>
                    </div>
                    <StartSession language={m.slot.languageId} skills={m.slot.skills} kind="makeup" scheduledDate={m.date} defaultMinutes={Math.min(20, learner.profile.dailyMinutes)} label={L("เรียนชดเชย", "Make up")} variant="outline" showDuration={false} />
                  </CardContent>
                </Card>
              ))}
          </div>
        </section>
      )}
    </div>
  );
}
