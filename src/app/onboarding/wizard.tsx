"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ArrowLeft, ArrowRight, Check, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Logo } from "@/components/app/logo";
import { cn } from "@/lib/utils";
import { makeL, TOPIC_NAMES, WEEKDAY_NAMES, SKILL_NAMES, errorText, type UiLang } from "@/i18n";
import { DEFAULT_SCHEDULE, DURATIONS } from "@/engine/schedule";
import { api } from "@/lib/client/api";

const GOALS = [
  { th: "สื่อสารในชีวิตประจำวัน", en: "Everyday communication" },
  { th: "ใช้ในการทำงาน", en: "Work" },
  { th: "เดินทางท่องเที่ยว", en: "Travel" },
  { th: "สัมภาษณ์งาน", en: "Job interviews" },
  { th: "งานด้านการบิน", en: "Aviation career" },
  { th: "สอบวัดระดับ", en: "Prepare for an exam" },
];

function Choice({ selected, onClick, children }: { selected: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick} aria-pressed={selected} className={cn("flex items-center justify-between gap-3 rounded-xl border px-4 py-3 text-left text-sm transition-colors", selected ? "border-primary bg-accent text-accent-foreground" : "hover:bg-secondary")}>
      <span>{children}</span>
      {selected && <Check className="size-4 shrink-0 text-primary" aria-hidden />}
    </button>
  );
}

export function Onboarding({ defaultName }: { defaultName: string }) {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [ui, setUi] = useState<UiLang>("th");
  const [explain, setExplain] = useState<"th" | "en">("th");
  const [name, setName] = useState(defaultName);
  const [languages, setLanguages] = useState<("en" | "zh")[]>(["en", "zh"]);
  const [goals, setGoals] = useState<string[]>([]);
  const [topics, setTopics] = useState<string[]>(["daily", "travel"]);
  const [minutes, setMinutes] = useState(30);
  const [correction, setCorrection] = useState<"immediate" | "after_each" | "end">("after_each");
  const [pinyin, setPinyin] = useState(true);
  const [tz] = useState(() => {
    try {
      return typeof window === "undefined" ? "Asia/Bangkok" : Intl.DateTimeFormat().resolvedOptions().timeZone || "Asia/Bangkok";
    } catch {
      return "Asia/Bangkok";
    }
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const L = makeL(ui);

  const toggle = <T,>(list: T[], v: T) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);
  const steps = [L("เกี่ยวกับคุณ", "About you"), L("เป้าหมาย", "Goals"), L("วิธีเรียน", "How you learn"), L("ตารางเรียน", "Schedule")];
  const canNext = step === 0 ? name.trim().length > 0 : step === 1 ? languages.length > 0 && topics.length > 0 : true;

  async function finish() {
    setBusy(true);
    setError(null);
    try {
      const r = await api<{ next: string }>("/api/onboarding", {
        body: { displayName: name.trim(), uiLanguage: ui, explanationLanguage: explain, languages, goals, topics, dailyMinutes: minutes, correctionMode: correction, showPinyin: pinyin, timezone: tz },
      });
      router.replace(r.next);
      router.refresh();
    } catch (e) {
      setError(errorText((e as { code?: string }).code, ui));
      setBusy(false);
    }
  }

  const schedule = DEFAULT_SCHEDULE.filter((s) => (languages.length === 1 ? !(s.weekday === 6 && s.languageId !== languages[0]) : true)).map((s) => (languages.length === 1 ? { ...s, languageId: languages[0]! } : s));

  return (
    <div className="mx-auto flex min-h-dvh max-w-xl flex-col px-5 py-8">
      <Logo />
      <ol className="mt-8 grid grid-cols-4 gap-2" aria-label={L("ขั้นตอน", "Steps")}>
        {steps.map((s, i) => (
          <li key={s}>
            <div className={cn("h-1 rounded-full", i <= step ? "bg-primary" : "bg-secondary")} />
            <span className={cn("mt-1.5 block text-xs", i === step ? "text-foreground" : "text-muted-foreground")}>{s}</span>
          </li>
        ))}
      </ol>

      <section className="mt-8 flex-1 space-y-6">
        {step === 0 && (
          <>
            <h1 className="text-2xl font-semibold tracking-tight">{L("ยินดีต้อนรับสู่ Fluency Lab", "Welcome to Fluency Lab")}</h1>
            <div className="space-y-2">
              <Label htmlFor="name">{L("ชื่อที่ให้เราเรียก", "What should we call you?")}</Label>
              <Input id="name" value={name} onChange={(e) => setName(e.target.value)} maxLength={60} autoFocus />
            </div>
            <fieldset className="space-y-2">
              <legend className="text-sm font-medium">{L("ภาษาของแอป", "App language")}</legend>
              <div className="grid grid-cols-2 gap-2">
                <Choice selected={ui === "th"} onClick={() => setUi("th")}>ไทย</Choice>
                <Choice selected={ui === "en"} onClick={() => setUi("en")}>English</Choice>
              </div>
            </fieldset>
            <fieldset className="space-y-2">
              <legend className="text-sm font-medium">{L("ภาษาที่ใช้อธิบายคำตอบ", "Explanations in")}</legend>
              <div className="grid grid-cols-2 gap-2">
                <Choice selected={explain === "th"} onClick={() => setExplain("th")}>{L("ภาษาไทย", "Thai")}</Choice>
                <Choice selected={explain === "en"} onClick={() => setExplain("en")}>{L("ภาษาอังกฤษ", "English")}</Choice>
              </div>
            </fieldset>
          </>
        )}
        {step === 1 && (
          <>
            <h1 className="text-2xl font-semibold tracking-tight">{L("คุณอยากเรียนอะไร", "What do you want to learn?")}</h1>
            <fieldset className="space-y-2">
              <legend className="text-sm font-medium">{L("ภาษา", "Languages")}</legend>
              <div className="grid grid-cols-2 gap-2">
                <Choice selected={languages.includes("en")} onClick={() => setLanguages(toggle(languages, "en"))}>{L("ภาษาอังกฤษ", "English")}</Choice>
                <Choice selected={languages.includes("zh")} onClick={() => setLanguages(toggle(languages, "zh"))}>{L("ภาษาจีนกลาง", "Mandarin Chinese")}</Choice>
              </div>
            </fieldset>
            <fieldset className="space-y-2">
              <legend className="text-sm font-medium">{L("เป้าหมาย", "Goals")}</legend>
              <div className="grid gap-2 sm:grid-cols-2">
                {GOALS.map((g) => (
                  <Choice key={g.en} selected={goals.includes(g.en)} onClick={() => setGoals(toggle(goals, g.en))}>{L(g.th, g.en)}</Choice>
                ))}
              </div>
            </fieldset>
            <fieldset className="space-y-2">
              <legend className="text-sm font-medium">{L("หัวข้อที่สนใจ", "Preferred topics")}</legend>
              <p className="text-xs text-muted-foreground">{L("ใช้เลือกเนื้อหาให้ตรงความสนใจ โดยไม่ข้ามระดับความยากที่เหมาะกับคุณ", "Used to personalise content — never to skip your level.")}</p>
              <div className="grid gap-2 sm:grid-cols-2">
                {Object.entries(TOPIC_NAMES).map(([id, n]) => (
                  <Choice key={id} selected={topics.includes(id)} onClick={() => setTopics(toggle(topics, id))}>{L(n.th, n.en)}</Choice>
                ))}
              </div>
            </fieldset>
          </>
        )}
        {step === 2 && (
          <>
            <h1 className="text-2xl font-semibold tracking-tight">{L("รูปแบบการเรียน", "How you like to learn")}</h1>
            <fieldset className="space-y-2">
              <legend className="text-sm font-medium">{L("เวลาเรียนต่อวัน", "Daily study time")}</legend>
              <div className="grid grid-cols-3 gap-2">
                {DURATIONS.map((d) => (
                  <Choice key={d} selected={minutes === d} onClick={() => setMinutes(d)}>{d} {L("นาที", "min")}</Choice>
                ))}
              </div>
            </fieldset>
            <fieldset className="space-y-2">
              <legend className="text-sm font-medium">{L("เวลาที่อยากให้แก้คำผิด (ตอนฝึกพูด)", "When should the tutor correct you?")}</legend>
              <div className="grid gap-2">
                <Choice selected={correction === "immediate"} onClick={() => setCorrection("immediate")}>{L("ทันที และให้พูดใหม่ก่อนไปต่อ", "Immediately, and ask me to retry")}</Choice>
                <Choice selected={correction === "after_each"} onClick={() => setCorrection("after_each")}>{L("หลังตอบแต่ละครั้ง", "After each answer")}</Choice>
                <Choice selected={correction === "end"} onClick={() => setCorrection("end")}>{L("สรุปตอนจบบทสนทนา", "At the end of the session")}</Choice>
              </div>
            </fieldset>
            {languages.includes("zh") && (
              <div className="flex items-center justify-between rounded-xl border px-4 py-3">
                <Label htmlFor="pinyin">{L("แสดงพินอินในภาษาจีน", "Show pinyin for Chinese")}</Label>
                <Switch id="pinyin" checked={pinyin} onCheckedChange={setPinyin} />
              </div>
            )}
          </>
        )}
        {step === 3 && (
          <>
            <h1 className="text-2xl font-semibold tracking-tight">{L("ตารางเรียนประจำสัปดาห์", "Your weekly schedule")}</h1>
            <p className="text-sm text-muted-foreground">
              {L("เปลี่ยนได้ทุกเมื่อในหน้าโปรไฟล์ ถ้าพลาดวันไหนก็เรียนชดเชยได้ ไม่มีบทลงโทษ", "You can change it any time in Profile. Missed a day? Make it up later — no penalties.")}
            </p>
            <ul className="divide-y rounded-2xl border bg-card">
              {WEEKDAY_NAMES.map((d, i) => (
                <li key={d.en} className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
                  <span className="font-medium">{L(d.th, d.en)}</span>
                  <span className="text-right text-muted-foreground">
                    {schedule
                      .filter((s) => s.weekday === i)
                      .map((s) => `${s.languageId === "en" ? L("อังกฤษ", "English") : L("จีน", "Chinese")} · ${s.skills.map((k) => L(SKILL_NAMES[k]!.th, SKILL_NAMES[k]!.en)).join(" + ")}`)
                      .join(" / ")}
                  </span>
                </li>
              ))}
            </ul>
            <p className="text-xs text-muted-foreground">
              {L("เขตเวลา", "Timezone")}: {tz}
            </p>
            {error && <p role="alert" className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
          </>
        )}
      </section>

      <div className="mt-8 flex justify-between gap-3">
        <Button variant="ghost" onClick={() => setStep((s) => Math.max(0, s - 1))} disabled={step === 0 || busy}>
          <ArrowLeft /> {L("ย้อนกลับ", "Back")}
        </Button>
        {step < 3 ? (
          <Button onClick={() => setStep((s) => s + 1)} disabled={!canNext}>
            {L("ถัดไป", "Next")} <ArrowRight />
          </Button>
        ) : (
          <Button onClick={finish} disabled={busy}>
            {busy && <Loader2 className="animate-spin" />} {L("เริ่มทดสอบวัดระดับ", "Start placement test")} <ArrowRight />
          </Button>
        )}
      </div>
    </div>
  );
}
