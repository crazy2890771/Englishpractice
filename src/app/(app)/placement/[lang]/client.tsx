"use client";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { ArrowLeft, CheckCircle2, Clock, Headphones, Loader2, Mic, BookOpen, PenLine, Library, SkipForward } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { ExercisePlayer } from "@/components/learn/exercise-player";
import { useL, usePrefs } from "@/components/app/ui-context";
import { api, ApiError } from "@/lib/client/api";
import { errorText, SKILL_NAMES } from "@/i18n";
import type { ClientDialogue, ClientExercise, ClientPassage } from "@/server/dto";
import type { Response } from "@/engine/scoring";

const ICONS = { listening: Headphones, speaking: Mic, reading: BookOpen, writing: PenLine, vocabulary: Library } as const;
const ORDER = ["vocabulary", "reading", "listening", "writing", "speaking"] as const;

interface Item {
  exercise: ClientExercise;
  material: ClientDialogue | ClientPassage | null;
  progress: { answered: number; max: number };
}

export function PlacementClient({ language, languageName, ttsLang, sttLang, assessmentId: initialId, skills: initialSkills }: { language: string; languageName: string; ttsLang: string; sttLang: string; assessmentId: string | null; skills: { skill: string; status: string }[] }) {
  const L = useL();
  const { uiLang } = usePrefs();
  const router = useRouter();
  const [assessmentId, setAssessmentId] = useState(initialId);
  const [skills, setSkills] = useState(initialSkills);
  const [active, setActive] = useState<string | null>(null);
  const [item, setItem] = useState<Item | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const status = (s: string) => skills.find((x) => x.skill === s)?.status ?? "not_started";
  const allDone = skills.length === 5 && skills.every((s) => s.status === "completed" || s.status === "skipped");

  useEffect(() => {
    if (allDone) router.refresh();
  }, [allDone, router]);

  const [self, setSelf] = useState<string | null>(null);
  const SELF: [string, string, string][] = [
    ["none", "ไม่เคยเรียน / รู้น้อยมาก", "Never studied / very little"],
    ["basic", "พื้นฐาน — ประโยคง่าย ๆ ได้", "Basics — simple sentences"],
    ["conversational", "พอสื่อสารเรื่องทั่วไปได้", "Can handle everyday conversation"],
    ["confident", "ใช้งานได้คล่อง", "Confident user"],
  ];

  async function start() {
    setBusy(true);
    try {
      const r = await api<{ id: string }>(`/api/placement/${language}/start`, { body: { self } });
      setAssessmentId(r.id);
      setSkills(ORDER.map((s) => ({ skill: s, status: "not_started" })));
    } catch (e) {
      setError(errorText((e as ApiError).code, uiLang));
    } finally {
      setBusy(false);
    }
  }

  async function beginner() {
    setBusy(true);
    try {
      await api(`/api/placement/${language}/beginner`, { method: "POST" });
      router.push("/today");
      router.refresh();
    } catch (e) {
      setError(errorText((e as ApiError).code, uiLang));
      setBusy(false);
    }
  }

  const loadNext = useCallback(
    async (skill: string) => {
      setError(null);
      setItem(null);
      try {
        const r = await api<{ done: boolean } & Partial<Item>>(`/api/placement/a/${assessmentId}/next?skill=${skill}`, { method: "POST" });
        if (r.done) {
          setSkills((list) => list.map((s) => (s.skill === skill ? { ...s, status: "completed" } : s)));
          setActive(null);
          return;
        }
        setSkills((list) => list.map((s) => (s.skill === skill ? { ...s, status: "in_progress" } : s)));
        setItem({ exercise: r.exercise!, material: r.material ?? null, progress: r.progress! });
      } catch (e) {
        setError(errorText((e as ApiError).code, uiLang));
      }
    },
    [assessmentId, uiLang],
  );

  async function answer(response: Response, meta: { durationMs?: number }) {
    if (!item || !active) return;
    try {
      await api(`/api/placement/a/${assessmentId}/answer`, { body: { skill: active, exerciseId: item.exercise.id, response, durationMs: meta.durationMs }, timeoutMs: 90_000 });
      await loadNext(active);
    } catch (e) {
      const code = (e as ApiError).code;
      if (code === "stale_item") return loadNext(active);
      setError(errorText(code, uiLang));
      throw e;
    }
  }

  async function skip(skill: string) {
    await api(`/api/placement/a/${assessmentId}/skip`, { body: { skill } });
    setSkills((list) => list.map((s) => (s.skill === skill ? { ...s, status: "skipped" } : s)));
    setActive(null);
  }

  if (!assessmentId) {
    return (
      <div className="mx-auto max-w-xl space-y-6 py-4">
        <h1 className="text-2xl font-semibold tracking-tight">{L(`แบบทดสอบวัดระดับ${languageName}`, `${languageName} placement test`)}</h1>
        <p className="text-muted-foreground">
          {L(
            "เราวัด 5 ทักษะแยกกัน: การฟัง การพูด การอ่าน การเขียน และคำศัพท์ คำถามปรับยากง่ายตามคำตอบของคุณ ทำทีละทักษะ หยุดแล้วกลับมาทำต่อได้",
            "We assess five skills separately: listening, speaking, reading, writing and vocabulary. Questions adapt to your answers. Do one skill at a time — you can pause and resume.",
          )}
        </p>
        <ul className="space-y-2 text-sm">
          <li className="flex items-center gap-2"><Clock className="size-4 text-muted-foreground" /> {L("ประมาณ 25–35 นาที", "About 25–35 minutes")}</li>
          <li className="flex items-center gap-2"><Mic className="size-4 text-muted-foreground" /> {L("ส่วนการพูดใช้ไมโครโฟน (หรือพิมพ์แทนได้)", "Speaking uses your microphone (typing is possible too)")}</li>
        </ul>
        <p className="rounded-xl bg-secondary px-4 py-3 text-sm text-muted-foreground">{L("ผลที่ได้เป็นการประเมินโดยประมาณของแอป ไม่ใช่ผลสอบ CEFR หรือ HSK อย่างเป็นทางการ", "Results are unofficial app estimates — not certified CEFR or HSK results.")}</p>
        <fieldset className="space-y-2">
          <legend className="mb-2 font-medium">{L(`ตอนนี้${languageName}ของคุณประมาณไหน?`, `How would you describe your ${languageName} now?`)}</legend>
          <div role="radiogroup" className="grid gap-2 sm:grid-cols-2">
            {SELF.map(([id, th, en]) => (
              <button key={id} type="button" role="radio" aria-checked={self === id} onClick={() => setSelf(id)} className={cn("rounded-xl border px-4 py-3 text-left text-sm", self === id ? "border-primary bg-accent font-medium" : "hover:bg-secondary")}>
                {L(th, en)}
              </button>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">{L("ใช้เลือกคำถามข้อแรกเท่านั้น หลังจากนั้นระบบปรับระดับตามคำตอบจริง", "Only used to pick the first question — after that, your answers decide.")}</p>
        </fieldset>
        {error && <p role="alert" className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
        <div className="flex flex-col gap-2 sm:flex-row">
          <Button size="lg" onClick={start} disabled={busy || !self}>
            {busy && <Loader2 className="animate-spin" />} {L("เริ่มทำแบบทดสอบ", "Start the test")}
          </Button>
          <Button size="lg" variant="outline" onClick={beginner} disabled={busy}>
            {L("ข้าม — เริ่มเรียนจากพื้นฐาน", "Skip — start from the beginning")}
          </Button>
        </div>
      </div>
    );
  }

  if (active) {
    const Icon = ICONS[active as keyof typeof ICONS];
    return (
      <div className="mx-auto max-w-2xl space-y-5 py-2">
        <div className="flex items-center justify-between gap-3">
          <Button variant="ghost" size="sm" onClick={() => setActive(null)}>
            <ArrowLeft /> {L("ทักษะทั้งหมด", "All skills")}
          </Button>
          <Badge variant="secondary">
            <Icon /> {L(SKILL_NAMES[active]!.th, SKILL_NAMES[active]!.en)}
          </Badge>
        </div>
        {item ? (
          <>
            <Progress value={(item.progress.answered / item.progress.max) * 100} aria-label={L("ความคืบหน้า", "Progress")} />
            <p className="text-xs text-muted-foreground">{L("ไม่แสดงเฉลยระหว่างทดสอบ เพื่อให้ผลแม่นยำ", "Answers aren't shown during the test, so results stay accurate.")}</p>
            <ExercisePlayer key={item.exercise.id} exercise={item.exercise} material={item.material} languageId={language} ttsLang={ttsLang} sttLang={sttLang} onSubmit={answer} hideFeedback />
          </>
        ) : error ? null : (
          <div className="grid min-h-40 place-items-center">
            <Loader2 className="animate-spin text-muted-foreground" aria-label={L("กำลังโหลด", "Loading")} />
          </div>
        )}
        {error && (
          <div role="alert" className="flex items-center justify-between gap-3 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
            <Button size="sm" variant="outline" onClick={() => loadNext(active)}>{L("ลองใหม่", "Retry")}</Button>
          </div>
        )}
        <div className="flex justify-end">
          <Button variant="ghost" size="sm" onClick={() => skip(active)}>
            <SkipForward /> {L("ข้ามทักษะนี้", "Skip this skill")}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-xl space-y-5 py-2">
      <h1 className="text-2xl font-semibold tracking-tight">{L(`วัดระดับ${languageName}`, `${languageName} placement`)}</h1>
      <p className="text-sm text-muted-foreground">{L("เลือกทักษะเพื่อเริ่มหรือทำต่อ ความคืบหน้าบันทึกอัตโนมัติ", "Pick a skill to start or continue. Progress is saved automatically.")}</p>
      <div className="grid gap-3">
        {ORDER.map((s) => {
          const Icon = ICONS[s];
          const st = status(s);
          const done = st === "completed" || st === "skipped";
          return (
            <Card key={s} className="py-4">
              <CardContent className="flex items-center gap-4">
                <span className="grid size-10 place-items-center rounded-xl bg-accent text-accent-foreground"><Icon className="size-5" /></span>
                <div className="flex-1">
                  <p className="font-medium">{L(SKILL_NAMES[s]!.th, SKILL_NAMES[s]!.en)}</p>
                  <p className="text-xs text-muted-foreground">{st === "completed" ? L("เสร็จแล้ว", "Done") : st === "skipped" ? L("ข้ามแล้ว", "Skipped") : st === "in_progress" ? L("กำลังทำ", "In progress") : L("ยังไม่เริ่ม", "Not started")}</p>
                </div>
                {done ? (
                  <CheckCircle2 className="size-5 text-emerald-600" aria-label={L("เสร็จแล้ว", "Done")} />
                ) : (
                  <Button size="sm" onClick={() => (setActive(s), loadNext(s))}>{st === "in_progress" ? L("ทำต่อ", "Continue") : L("เริ่ม", "Start")}</Button>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
      {allDone && <p className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="size-4 animate-spin" /> {L("กำลังสรุปผล…", "Preparing your results…")}</p>}
    </div>
  );
}
