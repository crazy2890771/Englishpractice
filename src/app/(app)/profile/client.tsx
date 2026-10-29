"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { CalendarPlus, Download, Loader2, LogOut, Plus, Save, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { api, type ApiError } from "@/lib/client/api";
import { supabaseBrowser } from "@/lib/supabase/client";
import { errorText, formatDate, makeL, SKILL_NAMES, TOPIC_NAMES, WEEKDAY_NAMES } from "@/i18n";
import { DURATIONS } from "@/engine/schedule";

type Lang = "en" | "zh";
type Skill = "listening" | "speaking" | "reading" | "writing" | "vocabulary";
const SKILLS: Skill[] = ["listening", "speaking", "reading", "writing", "vocabulary"];

export interface Prefs {
  displayName: string;
  uiLanguage: "th" | "en";
  explanationLanguage: "th" | "en";
  timezone: string;
  dailyMinutes: number;
  correctionMode: "immediate" | "after_each" | "end";
  showPinyin: boolean;
  playbackSpeed: number;
  reviewNewPerDay: number;
  reviewMaxPerDay: number;
  reminderEnabled: boolean;
  reminderTime: string;
  topics: string[];
  goals: string[];
  aiProvider: "auto" | "anthropic" | "openai" | "none";
  saveRecordings: boolean;
  recordingRetentionDays: number;
  languages: Lang[];
}

interface SlotIn {
  weekday: number;
  languageId: string;
  skills: string[];
}

function Seg<T extends string | number>({ value, options, onChange, label }: { value: T; options: { v: T; label: string }[]; onChange: (v: T) => void; label: string }) {
  return (
    <div role="radiogroup" aria-label={label} className="flex flex-wrap gap-1.5">
      {options.map((o) => (
        <button key={String(o.v)} type="button" role="radio" aria-checked={value === o.v} onClick={() => onChange(o.v)} className={cn("rounded-lg border px-3 py-1.5 text-sm", value === o.v ? "border-primary bg-accent font-medium text-accent-foreground" : "hover:bg-secondary")}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

function Row({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <p className="text-sm font-medium">{title}</p>
        {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

export function ProfileClient(props: {
  email: string | null;
  isGuest: boolean;
  prefs: Prefs;
  schedule: SlotIn[];
  providers: string[];
  serverSpeech: boolean;
  placements: { id: string; language: string; completedAt: string | null; skills: { skill: string; level: string | null; confidence: string | null }[] }[];
  recordingCount: number;
}) {
  const router = useRouter();
  const [p, setP] = useState<Prefs>(props.prefs);
  const [saving, setSaving] = useState(false);
  const [slots, setSlots] = useState<SlotIn[]>(props.schedule);
  const [savingSchedule, setSavingSchedule] = useState(false);
  const [recCount, setRecCount] = useState(props.recordingCount);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [upgrade, setUpgrade] = useState({ email: "", password: "" });
  const L = makeL(p.uiLanguage);
  const set = <K extends keyof Prefs>(k: K, v: Prefs[K]) => setP((x) => ({ ...x, [k]: v }));
  const dirty = JSON.stringify(p) !== JSON.stringify(props.prefs);
  const fail = (e: unknown) => toast.error(errorText((e as ApiError).code, p.uiLanguage));

  async function save() {
    setSaving(true);
    try {
      await api("/api/profile", { method: "PATCH", body: p });
      toast.success(L("บันทึกแล้ว", "Saved"));
      router.refresh();
    } catch (e) {
      fail(e);
    } finally {
      setSaving(false);
    }
  }

  async function saveSchedule() {
    setSavingSchedule(true);
    try {
      await api("/api/profile/schedule", { method: "PUT", body: { slots: slots.filter((s) => s.skills.length) } });
      toast.success(L("บันทึกตารางเรียนแล้ว", "Schedule saved"));
      router.refresh();
    } catch (e) {
      fail(e);
    } finally {
      setSavingSchedule(false);
    }
  }

  function toggleSkill(i: number, s: string) {
    setSlots((list) => list.map((x, j) => (j === i ? { ...x, skills: x.skills.includes(s) ? x.skills.filter((k) => k !== s) : [...x.skills, s] } : x)));
  }

  function addSlot(weekday: number) {
    const used = slots.filter((s) => s.weekday === weekday).map((s) => s.languageId);
    const languageId = (["en", "zh"] as const).find((l) => !used.includes(l));
    if (languageId) setSlots((list) => [...list, { weekday, languageId, skills: ["vocabulary"] }]);
  }

  async function retake(lang: string) {
    setBusy(`retake-${lang}`);
    try {
      await api(`/api/placement/${lang}/start`, { body: {} });
      router.push(`/placement/${lang}`);
    } catch (e) {
      fail(e);
      setBusy(null);
    }
  }

  async function deleteRecordings() {
    setBusy("recordings");
    try {
      await api("/api/profile/recordings", { method: "DELETE" });
      setRecCount(0);
      toast.success(L("ลบเสียงบันทึกทั้งหมดแล้ว", "All recordings deleted"));
    } catch (e) {
      fail(e);
    } finally {
      setBusy(null);
    }
  }

  async function deleteAccount() {
    setBusy("account");
    try {
      await api("/api/account", { method: "DELETE", body: { confirm: "DELETE" } });
      window.location.href = "/login";
    } catch (e) {
      fail(e);
      setBusy(null);
    }
  }

  async function signOut() {
    await supabaseBrowser().auth.signOut();
    window.location.href = "/login";
  }

  async function upgradeGuest() {
    setBusy("upgrade");
    const { error } = await supabaseBrowser().auth.updateUser({ email: upgrade.email, password: upgrade.password });
    setBusy(null);
    if (error) toast.error(error.message);
    else {
      toast.success(L("บันทึกบัญชีแล้ว — ตรวจอีเมลหากระบบขอให้ยืนยัน", "Account saved — check your inbox if confirmation is required"));
      router.refresh();
    }
  }

  const sk = (s: string) => L(SKILL_NAMES[s]!.th, SKILL_NAMES[s]!.en);
  const langName = (l: string) => (l === "en" ? L("อังกฤษ", "English") : L("จีน", "Chinese"));

  return (
    <div className="space-y-6 pb-24">
      <header className="flex items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{L("โปรไฟล์และการตั้งค่า", "Profile & settings")}</h1>
          <p className="text-sm text-muted-foreground">{props.isGuest ? L("บัญชีทดลอง (ไม่มีอีเมล)", "Guest account (no email)") : props.email}</p>
        </div>
        <Button variant="outline" size="sm" onClick={signOut}>
          <LogOut /> {L("ออกจากระบบ", "Sign out")}
        </Button>
      </header>

      {props.isGuest && (
        <Card className="border-amber-200 bg-amber-50/60">
          <CardHeader>
            <CardTitle>{L("เก็บความคืบหน้าไว้ถาวร", "Keep your progress")}</CardTitle>
            <CardDescription>{L("บัญชีทดลองจะหายถ้าออกจากระบบหรือล้างข้อมูลเบราว์เซอร์ ใส่อีเมลและรหัสผ่านเพื่อบันทึกบัญชี", "A guest account is lost if you sign out or clear browser data. Add an email and password to keep it.")}</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
            <Input type="email" autoComplete="email" placeholder="email@example.com" value={upgrade.email} onChange={(e) => setUpgrade({ ...upgrade, email: e.target.value })} aria-label={L("อีเมล", "Email")} />
            <Input type="password" autoComplete="new-password" placeholder={L("รหัสผ่าน (อย่างน้อย 8 ตัว)", "Password (8+ characters)")} value={upgrade.password} onChange={(e) => setUpgrade({ ...upgrade, password: e.target.value })} aria-label={L("รหัสผ่าน", "Password")} />
            <Button onClick={upgradeGuest} disabled={busy === "upgrade" || !upgrade.email.includes("@") || upgrade.password.length < 8}>
              {busy === "upgrade" ? <Loader2 className="animate-spin" /> : <Save />} {L("บันทึกบัญชี", "Save account")}
            </Button>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>{L("การเรียน", "Learning")}</CardTitle>
        </CardHeader>
        <CardContent className="divide-y">
          <Row title={L("ชื่อที่แสดง", "Display name")}>
            <Input value={p.displayName} maxLength={60} onChange={(e) => set("displayName", e.target.value)} className="w-56" aria-label={L("ชื่อที่แสดง", "Display name")} />
          </Row>
          <Row title={L("ภาษาที่เรียน", "Languages")} hint={L("ปิดภาษาได้โดยไม่ลบความคืบหน้า", "Turning a language off keeps its progress")}>
            <div className="flex gap-1.5">
              {(["en", "zh"] as const).map((l) => (
                <button
                  key={l}
                  type="button"
                  aria-pressed={p.languages.includes(l)}
                  onClick={() => set("languages", p.languages.includes(l) ? (p.languages.length > 1 ? p.languages.filter((x) => x !== l) : p.languages) : [...p.languages, l])}
                  className={cn("rounded-lg border px-3 py-1.5 text-sm", p.languages.includes(l) ? "border-primary bg-accent font-medium" : "text-muted-foreground hover:bg-secondary")}
                >
                  {langName(l)}
                </button>
              ))}
            </div>
          </Row>
          <Row title={L("เวลาเรียนต่อครั้ง", "Lesson length")}>
            <Seg label={L("เวลาเรียนต่อครั้ง", "Lesson length")} value={p.dailyMinutes} onChange={(v) => set("dailyMinutes", v)} options={DURATIONS.map((d) => ({ v: d as number, label: `${d}` }))} />
          </Row>
          <Row title={L("เวลาแสดงการแก้ไข", "When to show corrections")}>
            <Seg
              label={L("เวลาแสดงการแก้ไข", "When to show corrections")}
              value={p.correctionMode}
              onChange={(v) => set("correctionMode", v)}
              options={[
                { v: "immediate", label: L("ทันที", "Immediately") },
                { v: "after_each", label: L("หลังแต่ละข้อ", "After each answer") },
                { v: "end", label: L("ตอนจบบทเรียน", "At the end") },
              ]}
            />
          </Row>
          <Row title={L("หัวข้อที่สนใจ", "Topics")}>
            <div className="flex max-w-md flex-wrap gap-1.5">
              {Object.entries(TOPIC_NAMES).map(([k, t]) => (
                <button key={k} type="button" aria-pressed={p.topics.includes(k)} onClick={() => set("topics", p.topics.includes(k) ? (p.topics.length > 1 ? p.topics.filter((x) => x !== k) : p.topics) : [...p.topics, k])} className={cn("rounded-full border px-3 py-1 text-xs", p.topics.includes(k) ? "border-primary bg-accent font-medium" : "text-muted-foreground hover:bg-secondary")}>
                  {L(t.th, t.en)}
                </button>
              ))}
            </div>
          </Row>
          <Row title={L("คำศัพท์ใหม่ต่อวัน", "New words per day")} hint={L("จำนวนสูงสุดที่เพิ่มเข้ารอบทบทวน", "Max new cards added to review")}>
            <Input type="number" min={0} max={50} value={p.reviewNewPerDay} onChange={(e) => set("reviewNewPerDay", Math.max(0, Math.min(50, Number(e.target.value) || 0)))} className="w-24" aria-label={L("คำศัพท์ใหม่ต่อวัน", "New words per day")} />
          </Row>
          <Row title={L("ทบทวนสูงสุดต่อวัน", "Max reviews per day")}>
            <Input type="number" min={5} max={300} value={p.reviewMaxPerDay} onChange={(e) => set("reviewMaxPerDay", Math.max(5, Math.min(300, Number(e.target.value) || 5)))} className="w-24" aria-label={L("ทบทวนสูงสุดต่อวัน", "Max reviews per day")} />
          </Row>
          <Row title={L("เตือนให้เรียน", "Study reminder")} hint={L("เพิ่มตารางเรียนลงปฏิทินของมือถือ แล้วปฏิทินจะเตือนตามเวลาที่ตั้งไว้ในวันที่มีเรียน", "Add your schedule to your phone's calendar — it will alert you at this time on study days")}>
            <div className="flex flex-wrap items-center gap-2">
              <Input type="time" value={p.reminderTime} onChange={(e) => set("reminderTime", e.target.value)} className="w-32" aria-label={L("เวลาเตือน", "Reminder time")} />
              {dirty ? (
                <span className="text-xs text-muted-foreground">{L("บันทึกก่อน แล้วจึงเพิ่มลงปฏิทิน", "Save first, then add to calendar")}</span>
              ) : (
                <Button variant="outline" size="sm" asChild>
                  <a href="/api/profile/calendar" download>
                    <CalendarPlus /> {L("เพิ่มลงปฏิทิน", "Add to calendar")}
                  </a>
                </Button>
              )}
            </div>
          </Row>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{L("ภาษาและการแสดงผล", "Language & display")}</CardTitle>
        </CardHeader>
        <CardContent className="divide-y">
          <Row title={L("ภาษาของแอป", "App language")}>
            <Seg label={L("ภาษาของแอป", "App language")} value={p.uiLanguage} onChange={(v) => set("uiLanguage", v)} options={[{ v: "th", label: "ไทย" }, { v: "en", label: "English" }]} />
          </Row>
          <Row title={L("ภาษาที่ใช้อธิบาย", "Explanation language")} hint={L("ภาษาของคำอธิบายไวยากรณ์และคำติชม", "Language of grammar notes and feedback")}>
            <Seg label={L("ภาษาที่ใช้อธิบาย", "Explanation language")} value={p.explanationLanguage} onChange={(v) => set("explanationLanguage", v)} options={[{ v: "th", label: "ไทย" }, { v: "en", label: "English" }]} />
          </Row>
          <Row title={L("แสดงพินอิน", "Show pinyin")}>
            <Switch checked={p.showPinyin} onCheckedChange={(v) => set("showPinyin", v)} aria-label={L("แสดงพินอิน", "Show pinyin")} />
          </Row>
          <Row title={L("ความเร็วเสียง", "Playback speed")}>
            <Seg label={L("ความเร็วเสียง", "Playback speed")} value={p.playbackSpeed} onChange={(v) => set("playbackSpeed", v)} options={[0.75, 0.9, 1, 1.15].map((v) => ({ v, label: `${v}×` }))} />
          </Row>
          <Row title={L("เขตเวลา", "Time zone")} hint={L("ใช้กำหนดว่า “วันนี้” คือวันไหน", "Decides which day counts as “today”")}>
            <Input value={p.timezone} onChange={(e) => set("timezone", e.target.value)} className="w-56" aria-label={L("เขตเวลา", "Time zone")} />
          </Row>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{L("AI และเสียง", "AI & audio")}</CardTitle>
          <CardDescription>
            {props.providers.length
              ? L("เซิร์ฟเวอร์ตั้งค่า AI ไว้แล้ว เลือกผู้ให้บริการหรือปิด AI (ใช้โหมดสาธิตที่ตรวจด้วยกฎ)", "AI is configured on the server. Choose a provider or switch to rule-based demo mode.")
              : L("เซิร์ฟเวอร์ยังไม่ได้ใส่ API key — การตรวจงานเขียน/พูดจะใช้โหมดสาธิต (ตรวจด้วยกฎ ไม่ใช่ AI)", "No AI key is configured on the server — writing/speaking use labelled demo mode (rules, not AI).")}
          </CardDescription>
        </CardHeader>
        <CardContent className="divide-y">
          <Row title={L("ผู้ให้บริการ AI", "AI provider")}>
            <Seg
              label={L("ผู้ให้บริการ AI", "AI provider")}
              value={p.aiProvider}
              onChange={(v) => set("aiProvider", v)}
              options={[
                { v: "auto" as const, label: L("อัตโนมัติ", "Auto") },
                ...(props.providers.includes("anthropic") ? [{ v: "anthropic" as const, label: "Claude" }] : []),
                ...(props.providers.includes("openai") ? [{ v: "openai" as const, label: "OpenAI" }] : []),
                { v: "none" as const, label: L("ปิด (สาธิต)", "Off (demo)") },
              ]}
            />
          </Row>
          <Row title={L("เสียงพูดและการถอดเสียง", "Speech")} hint={props.serverSpeech ? L("ใช้เสียงและการถอดเสียงจากเซิร์ฟเวอร์", "Server text-to-speech and transcription") : L("ใช้เสียงและการรู้จำเสียงของเบราว์เซอร์ (คุณภาพขึ้นกับอุปกรณ์)", "Uses the browser's built-in voices and recognition (device-dependent)")}>
            <Badge variant="secondary">{props.serverSpeech ? L("เซิร์ฟเวอร์", "Server") : L("เบราว์เซอร์", "Browser")}</Badge>
          </Row>
        </CardContent>
      </Card>

      <Card id="schedule" className="scroll-mt-20">
        <CardHeader>
          <CardTitle>{L("ตารางเรียนรายสัปดาห์", "Weekly schedule")}</CardTitle>
          <CardDescription>{L("เลือกภาษาและทักษะของแต่ละวัน บทเรียนที่พลาดชดเชยได้โดยไม่เสียคะแนน", "Pick the language and skills for each day. Missed lessons can be made up without penalty.")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {WEEKDAY_NAMES.map((w, day) => {
            const daySlots = slots.map((s, i) => ({ s, i })).filter((x) => x.s.weekday === day);
            return (
              <div key={day} className="rounded-xl border p-3">
                <div className="mb-2 flex items-center justify-between">
                  <p className="text-sm font-medium">{L(w.th, w.en)}</p>
                  {daySlots.length < 2 && (
                    <Button variant="ghost" size="sm" onClick={() => addSlot(day)}>
                      <Plus /> {L("เพิ่มภาษา", "Add language")}
                    </Button>
                  )}
                </div>
                {daySlots.length === 0 && <p className="text-xs text-muted-foreground">{L("วันพัก", "Rest day")}</p>}
                <div className="space-y-2">
                  {daySlots.map(({ s, i }) => (
                    <div key={i} className="flex flex-wrap items-center gap-1.5">
                      <select
                        value={s.languageId}
                        onChange={(e) => setSlots((list) => list.map((x, j) => (j === i ? { ...x, languageId: e.target.value } : x)))}
                        className="h-8 rounded-lg border bg-background px-2 text-sm"
                        aria-label={L("ภาษา", "Language")}
                      >
                        {(["en", "zh"] as const).filter((l) => l === s.languageId || !daySlots.some((d) => d.s.languageId === l)).map((l) => (
                          <option key={l} value={l}>
                            {langName(l)}
                          </option>
                        ))}
                      </select>
                      {SKILLS.map((k) => (
                        <button key={k} type="button" aria-pressed={s.skills.includes(k)} onClick={() => toggleSkill(i, k)} className={cn("rounded-full border px-2.5 py-1 text-xs", s.skills.includes(k) ? "border-primary bg-accent font-medium" : "text-muted-foreground hover:bg-secondary")}>
                          {sk(k)}
                        </button>
                      ))}
                      <Button variant="ghost" size="icon" className="size-8" onClick={() => setSlots((list) => list.filter((_, j) => j !== i))} aria-label={L("ลบ", "Remove")}>
                        <X />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
          <div className="flex justify-end">
            <Button onClick={saveSchedule} disabled={savingSchedule || JSON.stringify(slots) === JSON.stringify(props.schedule)}>
              {savingSchedule ? <Loader2 className="animate-spin" /> : <Save />} {L("บันทึกตาราง", "Save schedule")}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{L("ผลวัดระดับ", "Placement history")}</CardTitle>
          <CardDescription>{L("ผลประเมินโดยแอป ไม่ใช่ผลสอบ CEFR/HSK อย่างเป็นทางการ การสอบใหม่จะตั้งระดับเริ่มต้นตามผลใหม่", "App estimates, not official CEFR/HSK results. Retaking resets your starting levels to the new result.")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {props.placements.length === 0 && <p className="text-sm text-muted-foreground">{L("ยังไม่มีผลวัดระดับ", "No placement results yet.")}</p>}
          {props.placements.map((a) => (
            <div key={a.id} className="rounded-xl border p-3 text-sm">
              <p className="font-medium">
                {langName(a.language)} · {a.completedAt ? formatDate(a.completedAt, p.uiLanguage) : "—"}
              </p>
              <div className="mt-1 flex flex-wrap gap-1.5">
                {a.skills.map((s) => (
                  <Badge key={s.skill} variant="secondary">
                    {sk(s.skill)}: {s.level ?? "—"}
                  </Badge>
                ))}
              </div>
            </div>
          ))}
          <div className="flex flex-wrap gap-2">
            {p.languages.map((l) => (
              <Button key={l} variant="outline" size="sm" onClick={() => retake(l)} disabled={busy === `retake-${l}`}>
                {busy === `retake-${l}` && <Loader2 className="animate-spin" />} {L(`สอบวัดระดับ${langName(l)}ใหม่`, `Retake ${langName(l)} placement`)}
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{L("ความเป็นส่วนตัวและข้อมูล", "Privacy & data")}</CardTitle>
        </CardHeader>
        <CardContent className="divide-y">
          <Row title={L("บันทึกเสียงพูดของฉัน", "Save my speaking recordings")} hint={L("ใช้เปรียบเทียบพัฒนาการ เก็บแบบส่วนตัว ค่าเริ่มต้นคือปิด", "Used to compare progress. Private; off by default.")}>
            <Switch checked={p.saveRecordings} onCheckedChange={(v) => set("saveRecordings", v)} aria-label={L("บันทึกเสียงพูด", "Save recordings")} />
          </Row>
          <Row title={L("เก็บเสียงไว้นาน", "Keep recordings for")}>
            <Seg label={L("เก็บเสียงไว้นาน", "Keep recordings for")} value={p.recordingRetentionDays} onChange={(v) => set("recordingRetentionDays", v)} options={[30, 90, 180, 365].map((d) => ({ v: d, label: L(`${d} วัน`, `${d} days`) }))} />
          </Row>
          <Row title={L(`เสียงที่บันทึกไว้: ${recCount}`, `Saved recordings: ${recCount}`)}>
            <Button variant="outline" size="sm" onClick={deleteRecordings} disabled={!recCount || busy === "recordings"}>
              {busy === "recordings" ? <Loader2 className="animate-spin" /> : <Trash2 />} {L("ลบเสียงทั้งหมด", "Delete all")}
            </Button>
          </Row>
          <Row title={L("ส่งออกข้อมูลของฉัน", "Export my data")} hint="JSON">
            <Button variant="outline" size="sm" asChild>
              <a href="/api/profile/export" download>
                <Download /> {L("ดาวน์โหลด", "Download")}
              </a>
            </Button>
          </Row>
          <Row title={L("ลบบัญชี", "Delete account")} hint={L("ลบข้อมูลการเรียนทั้งหมดอย่างถาวร", "Permanently deletes all learning data")}>
            <Button variant="destructive" size="sm" onClick={() => setDeleteOpen(true)}>
              <Trash2 /> {L("ลบบัญชี", "Delete account")}
            </Button>
          </Row>
        </CardContent>
      </Card>

      <p className="text-center text-xs text-muted-foreground">
        <Link href="/progress" className="hover:underline">
          {L("ดูพัฒนาการ", "View progress")}
        </Link>
      </p>

      {dirty && (
        <div className="fixed inset-x-0 bottom-20 z-40 flex justify-center px-4 md:bottom-6">
          <div className="flex items-center gap-3 rounded-2xl border bg-background/95 px-4 py-2.5 shadow-lg backdrop-blur">
            <span className="text-sm">{L("มีการเปลี่ยนแปลงที่ยังไม่บันทึก", "Unsaved changes")}</span>
            <Button size="sm" variant="ghost" onClick={() => setP(props.prefs)}>
              {L("ยกเลิก", "Discard")}
            </Button>
            <Button size="sm" onClick={save} disabled={saving || !p.displayName.trim()}>
              {saving ? <Loader2 className="animate-spin" /> : <Save />} {L("บันทึก", "Save")}
            </Button>
          </div>
        </div>
      )}

      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{L("ลบบัญชีอย่างถาวร?", "Delete your account permanently?")}</DialogTitle>
            <DialogDescription>{L("ความคืบหน้า คำศัพท์ ผลสอบ และเสียงที่บันทึกทั้งหมดจะถูกลบและกู้คืนไม่ได้ พิมพ์ DELETE เพื่อยืนยัน", "All progress, vocabulary, results and recordings will be deleted and cannot be recovered. Type DELETE to confirm.")}</DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor="confirm-delete">DELETE</Label>
            <Input id="confirm-delete" value={confirmText} onChange={(e) => setConfirmText(e.target.value)} autoComplete="off" />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDeleteOpen(false)}>
              {L("ยกเลิก", "Cancel")}
            </Button>
            <Button variant="destructive" onClick={deleteAccount} disabled={confirmText !== "DELETE" || busy === "account"}>
              {busy === "account" && <Loader2 className="animate-spin" />} {L("ลบบัญชี", "Delete account")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
