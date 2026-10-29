"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { BookOpen, Headphones, Library, Loader2, MessagesSquare, Mic, PenLine, Sparkles, Layers } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StartSession } from "@/components/app/start-session";
import { useL, usePrefs } from "@/components/app/ui-context";
import { api, ApiError } from "@/lib/client/api";
import { errorText, SKILL_NAMES, TOPIC_NAMES } from "@/i18n";
import { cn } from "@/lib/utils";

const SKILL_CARDS = [
  { skill: "listening", icon: Headphones, th: "บทสนทนา ฟังจับใจความ ฟังแล้วพิมพ์", en: "Dialogues, gist, detail, listen & type" },
  { skill: "speaking", icon: Mic, th: "ตอบคำถาม พูดตาม Shadowing", en: "Answer questions, repeat, shadowing" },
  { skill: "reading", icon: BookOpen, th: "เรื่องสั้น บทความ แตะคำเพื่อดูความหมาย", en: "Stories & articles with tap-to-define" },
  { skill: "writing", icon: PenLine, th: "แก้ประโยค เขียนย่อหน้า อีเมล", en: "Sentence correction, paragraphs, emails" },
  { skill: "vocabulary", icon: Library, th: "จำคำ จับคู่ เติมคำ", en: "Recall, matching, fill in the blank" },
];

export function PracticeClient({ languages, aiEnabled, defaultTopics }: { languages: { language: string; placed: boolean; due: number }[]; aiEnabled: boolean; defaultTopics: string[] }) {
  const L = useL();
  const router = useRouter();
  const { uiLang } = usePrefs();
  const [language, setLanguage] = useState(languages[0]!.language);
  const [topic, setTopic] = useState(defaultTopics[0] ?? "daily");
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const current = languages.find((l) => l.language === language)!;

  async function post(key: string, url: string, body: unknown) {
    setBusy(key);
    setErr(null);
    try {
      const r = await api<{ id: string }>(url, { body, timeoutMs: 90_000 });
      router.push(key === "conv" ? `/conversation/${r.id}` : `/session/${r.id}`);
    } catch (e) {
      setErr(errorText((e as ApiError).code, uiLang));
      setBusy(null);
    }
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{L("ฝึกฝนเพิ่มเติม", "Practice")}</h1>
          <p className="text-sm text-muted-foreground">{L("ฝึกภาษาและทักษะใดก็ได้ โดยไม่เปลี่ยนตารางเรียน", "Practise any language and skill without changing your schedule.")}</p>
        </div>
        {languages.length > 1 && (
          <div role="radiogroup" aria-label={L("ภาษา", "Language")} className="inline-flex rounded-xl bg-secondary p-1">
            {languages.map((l) => (
              <button key={l.language} type="button" role="radio" aria-checked={l.language === language} onClick={() => setLanguage(l.language)} className={cn("rounded-lg px-3 py-1.5 text-sm font-medium", l.language === language ? "bg-background shadow-sm" : "text-muted-foreground")}>
                {l.language === "en" ? L("อังกฤษ", "English") : L("จีน", "Chinese")}
              </button>
            ))}
          </div>
        )}
      </header>

      {!current.placed ? (
        <Card>
          <CardContent className="space-y-3 text-sm">
            <p>{L("ทำแบบทดสอบวัดระดับก่อน เพื่อให้แบบฝึกตรงกับระดับของคุณ", "Take the placement test first so practice matches your level.")}</p>
            <Button asChild>
              <Link href={`/placement/${language}`}>{L("ไปที่แบบทดสอบวัดระดับ", "Go to placement")}</Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2">
            {SKILL_CARDS.map(({ skill, icon: Icon, th, en }) => (
              <Card key={skill} className="gap-3">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Icon className="size-5 text-primary" /> {L(SKILL_NAMES[skill]!.th, SKILL_NAMES[skill]!.en)}
                  </CardTitle>
                  <CardDescription>{L(th, en)}</CardDescription>
                </CardHeader>
                <CardContent>
                  <StartSession language={language} skills={[skill]} kind="practice" defaultMinutes={15} label={L("เริ่มฝึก", "Practise")} variant="outline" />
                </CardContent>
              </Card>
            ))}
            <Card className="gap-3">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Layers className="size-5 text-primary" /> {L("ทบทวนคำศัพท์ (SRS)", "Vocabulary review (SRS)")}
                </CardTitle>
                <CardDescription>{L(`ถึงกำหนดทบทวน ${current.due} คำ`, `${current.due} words due`)}</CardDescription>
              </CardHeader>
              <CardContent>
                <Button asChild variant="outline">
                  <Link href={`/review?lang=${language}`}>{L("เริ่มทบทวน", "Review")}</Link>
                </Button>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MessagesSquare className="size-5 text-primary" /> {L("สนทนาอิสระกับครู AI", "Free conversation with the AI tutor")}
              </CardTitle>
              <CardDescription>{L("ครูถามทีละคำถาม คุณตอบด้วยเสียงหรือพิมพ์ แล้วรับการแก้ไขตามที่ตั้งค่าไว้", "One question at a time — answer by voice or text and get corrections the way you prefer.")}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex flex-wrap gap-2" role="radiogroup" aria-label={L("หัวข้อ", "Topic")}>
                {Object.entries(TOPIC_NAMES).map(([id, n]) => (
                  <button key={id} type="button" role="radio" aria-checked={topic === id} onClick={() => setTopic(id)} className={cn("rounded-full border px-3 py-1.5 text-sm", topic === id ? "border-primary bg-accent text-accent-foreground" : "hover:bg-secondary")}>
                    {L(n.th, n.en)}
                  </button>
                ))}
              </div>
              <Button onClick={() => post("conv", "/api/conversations", { language, topic })} disabled={busy !== null}>
                {busy === "conv" && <Loader2 className="animate-spin" />} {L("เริ่มสนทนา", "Start conversation")}
              </Button>
            </CardContent>
          </Card>

          {aiEnabled ? (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Sparkles className="size-5 text-primary" /> {L("แบบฝึกเพิ่มจาก AI", "Extra AI-generated practice")}
                </CardTitle>
                <CardDescription>{L("สร้างแบบฝึกใหม่ตามหน่วยปัจจุบันและจุดอ่อน ทุกข้อถูกตรวจรูปแบบและคำตอบก่อนแสดง", "New exercises for your current unit and weaknesses — every item is validated before you see it.")}</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-wrap gap-2">
                {(["reading", "writing", "vocabulary"] as const).map((s) => (
                  <Button key={s} variant="outline" onClick={() => post(`gen-${s}`, "/api/practice/generate", { language, skill: s })} disabled={busy !== null}>
                    {busy === `gen-${s}` && <Loader2 className="animate-spin" />} {L(SKILL_NAMES[s]!.th, SKILL_NAMES[s]!.en)}
                  </Button>
                ))}
              </CardContent>
            </Card>
          ) : (
            <p className="text-xs text-muted-foreground">{L("แบบฝึกที่สร้างโดย AI จะเปิดใช้เมื่อตั้งค่าผู้ให้บริการ AI (ตอนนี้ใช้คลังแบบฝึกของหลักสูตร)", "AI-generated practice is available once an AI provider is configured (the curriculum bank is used now).")}</p>
          )}
          {err && <p role="alert" className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{err}</p>}
        </>
      )}
    </div>
  );
}
