"use client";
import Link from "next/link";
import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useL, usePrefs } from "@/components/app/ui-context";
import { formatDate, SKILL_NAMES } from "@/i18n";
import { cn } from "@/lib/utils";

// Chart tokens (validated: blue series on the light card surface; recessive grid/axes).
const SERIES = "#2a78d6";
const GRID = "oklch(0.91 0.006 80)";
const AXIS = { stroke: "oklch(0.52 0.012 60)", fontSize: 11, tickLine: false, axisLine: false } as const;
const TOOLTIP = { contentStyle: { borderRadius: 12, border: "1px solid oklch(0.91 0.006 80)", fontSize: 12 }, cursor: { fill: "oklch(0.95 0.015 250 / 0.6)" } };

interface Data {
  language: string;
  profile: { skill: string; level: string | null; placement: string | null; recentAccuracy: number | null }[];
  totals: { minutes: number; sessions: number; unitsCompleted: number; vocab: number; vocabMature: number; consistentWeeks: number };
  activity: { date: string; minutes: number }[];
  consistency: { weekStart: string; days: number }[];
  skillSeries: Record<string, { date: string; accuracy: number; attempts: number; level: string }[]>;
  retention: { week: string; rate: number; reviews: number }[];
  familiarity: number[];
  assessments: { id: string; kind: string; skill: string; level: string; unitId: string | null; score: number; passed: boolean; at: string }[];
  weaknesses: { categoryId: string; status: string; mastery: number; occurrences: number; recent: number; firstDetectedAt: string; lastSeenAt: string; history: { date: string; mastery: number }[]; examples: { original: string; corrected: string; explanation: string; at: string }[] }[];
}

interface Rec {
  id: string;
  url: string | null;
  transcript: string | null;
  prompt: string | null;
  at: string;
}

function DataTable({ caption, cols, rows }: { caption: string; cols: string[]; rows: (string | number)[][] }) {
  return (
    <details className="mt-2 text-xs">
      <summary className="cursor-pointer text-muted-foreground">{caption}</summary>
      <table className="mt-2 w-full text-left">
        <thead>
          <tr>{cols.map((c) => <th key={c} className="py-1 pr-3 font-medium">{c}</th>)}</tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="border-t">{r.map((c, j) => <td key={j} className="py-1 pr-3 tabular-nums">{c}</td>)}</tr>
          ))}
        </tbody>
      </table>
    </details>
  );
}

export function ProgressClient({ data, languages, categories, recordings }: { data: Data; languages: string[]; categories: Record<string, { th: string; en: string }>; recordings: { early: Rec[]; late: Rec[] } }) {
  const L = useL();
  const { uiLang } = usePrefs();
  const sk = (s: string) => L(SKILL_NAMES[s]!.th, SKILL_NAMES[s]!.en);
  const cat = (id: string) => (categories[id] ? L(categories[id]!.th, categories[id]!.en) : id);
  const short = (d: string) => d.slice(5).replace("-", "/");
  const statusLabel: Record<string, [string, string]> = { watching: ["เฝ้าดู", "Watching"], active: ["ต้องฝึก", "Active"], improving: ["ดีขึ้น", "Improving"], resolved: ["แก้ได้แล้ว", "Resolved"] };
  const hasActivity = data.activity.some((a) => a.minutes > 0);
  const hasSeries = Object.values(data.skillSeries).some((s) => s.length >= 2);

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{L("พัฒนาการ", "Progress")}</h1>
          <p className="text-sm text-muted-foreground">{L("ข้อมูลจริงจากการเรียนของคุณ คะแนนฝึกหัดไม่ใช่ระดับความสามารถอย่างเป็นทางการ", "Real activity only. Practice scores are not standardised proficiency levels.")}</p>
        </div>
        {languages.length > 1 && (
          <nav aria-label={L("ภาษา", "Language")} className="inline-flex rounded-xl bg-secondary p-1">
            {languages.map((l) => (
              <Link key={l} href={`/progress?lang=${l}`} aria-current={l === data.language ? "page" : undefined} className={cn("rounded-lg px-3 py-1.5 text-sm font-medium", l === data.language ? "bg-background shadow-sm" : "text-muted-foreground")}>
                {l === "en" ? L("อังกฤษ", "English") : L("จีน", "Chinese")}
              </Link>
            ))}
          </nav>
        )}
      </header>

      <section aria-label={L("สรุป", "Summary")} className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {[
          [L("เวลาเรียน", "Study time"), `${Math.floor(data.totals.minutes / 60)}h ${data.totals.minutes % 60}m`],
          [L("บทเรียนที่จบ", "Sessions"), data.totals.sessions],
          [L("หน่วยที่ผ่าน", "Units passed"), data.totals.unitsCompleted],
          [L("คำศัพท์", "Words"), data.totals.vocab],
          [L("จำได้มั่นคง", "Well known"), data.totals.vocabMature],
          [L("สัปดาห์สม่ำเสมอ", "Consistent weeks"), `${data.totals.consistentWeeks}/8`],
        ].map(([k, v]) => (
          <Card key={String(k)} className="gap-1 py-4">
            <CardContent>
              <p className="text-xs text-muted-foreground">{k}</p>
              <p className="text-xl font-semibold tabular-nums">{v}</p>
            </CardContent>
          </Card>
        ))}
      </section>

      <Card>
        <CardHeader>
          <CardTitle>{L("ระดับแยกตามทักษะ", "Proficiency profile")}</CardTitle>
          <CardDescription>{L("ระดับในหลักสูตรของแอป (ไม่ใช่ผลสอบรับรอง) และความถูกต้องใน 30 วันล่าสุด", "Curriculum level in the app (not certified) and accuracy over the last 30 days")}</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-5">
          {data.profile.map((p) => (
            <div key={p.skill} className="rounded-xl bg-secondary/60 p-3">
              <p className="text-xs text-muted-foreground">{sk(p.skill)}</p>
              <p className="text-lg font-semibold">{p.level ?? "—"}</p>
              {p.placement && <p className="text-[11px] text-muted-foreground">{L(`เริ่มจาก ${p.placement}`, `placed at ${p.placement}`)}</p>}
              <Progress className="mt-2 h-1.5" value={p.recentAccuracy ?? 0} aria-label={`${sk(p.skill)} ${p.recentAccuracy ?? 0}%`} />
              <p className="mt-1 text-[11px] text-muted-foreground">{p.recentAccuracy === null ? L("ยังไม่มีข้อมูล", "No data yet") : `${p.recentAccuracy}%`}</p>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{L("เวลาเรียนรายวัน (28 วัน)", "Daily study time (28 days)")}</CardTitle>
        </CardHeader>
        <CardContent>
          {hasActivity ? (
            <>
              <div className="h-44" role="img" aria-label={L("กราฟนาทีที่เรียนต่อวัน", "Minutes studied per day")}>
                <ResponsiveContainer>
                  <BarChart data={data.activity} margin={{ top: 4, right: 4, left: -28, bottom: 0 }} barCategoryGap={2}>
                    <CartesianGrid vertical={false} stroke={GRID} />
                    <XAxis dataKey="date" tickFormatter={short} {...AXIS} interval={6} />
                    <YAxis {...AXIS} allowDecimals={false} />
                    <Tooltip {...TOOLTIP} formatter={(v) => [`${v} ${L("นาที", "min")}`, L("เวลาเรียน", "Study time")]} labelFormatter={(d) => String(d)} />
                    <Bar dataKey="minutes" fill={SERIES} radius={[4, 4, 0, 0]} maxBarSize={18} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <DataTable caption={L("ดูเป็นตาราง", "Show as table")} cols={[L("วันที่", "Date"), L("นาที", "Minutes")]} rows={data.activity.filter((a) => a.minutes > 0).map((a) => [a.date, a.minutes])} />
            </>
          ) : (
            <p className="text-sm text-muted-foreground">{L("ยังไม่มีเวลาเรียนที่บันทึก", "No study time recorded yet.")}</p>
          )}
          <div className="mt-4 flex gap-1.5" aria-label={L("ความสม่ำเสมอรายสัปดาห์", "Weekly consistency")}>
            {data.consistency.map((w) => (
              <div key={w.weekStart} className="flex-1 text-center" title={`${w.weekStart}: ${w.days}`}>
                <div className={cn("h-2 rounded-full", w.days >= 3 ? "bg-primary" : w.days > 0 ? "bg-primary/40" : "bg-secondary")} />
                <span className="text-[10px] text-muted-foreground">{w.days}</span>
              </div>
            ))}
          </div>
          <p className="mt-1 text-xs text-muted-foreground">{L("วันที่เรียนในแต่ละสัปดาห์ (8 สัปดาห์ล่าสุด)", "Active days per week (last 8 weeks)")}</p>
        </CardContent>
      </Card>

      <section aria-labelledby="skills-time" className="space-y-3">
        <h2 id="skills-time" className="font-semibold">{L("ความถูกต้องรายทักษะตามเวลา", "Skill accuracy over time")}</h2>
        {!hasSeries ? (
          <Card className="py-5">
            <CardContent className="text-sm text-muted-foreground">{L("กราฟจะแสดงเมื่อคุณฝึกทักษะเดียวกันครบอย่างน้อย 2 วัน", "Charts appear once you have practised a skill on at least 2 different days.")}</CardContent>
          </Card>
        ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {Object.entries(data.skillSeries).filter(([, series]) => series.length > 0).map(([skill, series]) => (
            <Card key={skill} className="gap-2 py-4">
              <CardHeader>
                <CardTitle className="text-sm">{sk(skill)}</CardTitle>
              </CardHeader>
              <CardContent>
                {series.length >= 2 ? (
                  <div className="h-28" role="img" aria-label={`${sk(skill)}: ${series.map((s) => `${s.date} ${s.accuracy}%`).join(", ")}`}>
                    <ResponsiveContainer>
                      <LineChart data={series} margin={{ top: 6, right: 6, left: -30, bottom: 0 }}>
                        <CartesianGrid vertical={false} stroke={GRID} />
                        <XAxis dataKey="date" tickFormatter={short} {...AXIS} minTickGap={20} />
                        <YAxis domain={[0, 100]} ticks={[0, 50, 100]} {...AXIS} />
                        <Tooltip {...TOOLTIP} formatter={(v, _n, p) => [`${v}% · ${p.payload.attempts} ${L("ข้อ", "items")} · ${p.payload.level}`, L("ความถูกต้อง", "Accuracy")]} />
                        <Line type="monotone" dataKey="accuracy" stroke={SERIES} strokeWidth={2} dot={{ r: 3 }} activeDot={{ r: 5 }} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <p className="py-6 text-center text-xs text-muted-foreground">{series.length === 1 ? L(`วันเดียว: ${series[0]!.accuracy}%`, `One day so far: ${series[0]!.accuracy}%`) : L("ยังไม่มีข้อมูล", "No data yet")}</p>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
        )}
      </section>

      <div className="grid gap-3 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>{L("การจำคำศัพท์", "Vocabulary retention")}</CardTitle>
            <CardDescription>{L("สัดส่วนที่จำได้ในการทบทวนแต่ละสัปดาห์", "Share of successful recalls per week")}</CardDescription>
          </CardHeader>
          <CardContent>
            {data.retention.length ? (
              <>
                <div className="h-40" role="img" aria-label={L("กราฟการจำคำศัพท์", "Retention chart")}>
                  <ResponsiveContainer>
                    <LineChart data={data.retention} margin={{ top: 6, right: 6, left: -28, bottom: 0 }}>
                      <CartesianGrid vertical={false} stroke={GRID} />
                      <XAxis dataKey="week" tickFormatter={short} {...AXIS} />
                      <YAxis domain={[0, 100]} {...AXIS} />
                      <Tooltip {...TOOLTIP} formatter={(v, _n, p) => [`${v}% (${p.payload.reviews})`, L("จำได้", "Recalled")]} />
                      <Line type="monotone" dataKey="rate" stroke={SERIES} strokeWidth={2} dot={{ r: 3 }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
                <DataTable caption={L("ดูเป็นตาราง", "Show as table")} cols={[L("สัปดาห์", "Week"), "%", L("ครั้ง", "Reviews")]} rows={data.retention.map((r) => [r.week, r.rate, r.reviews])} />
              </>
            ) : (
              <p className="text-sm text-muted-foreground">{L("ยังไม่มีการทบทวน", "No reviews yet.")}</p>
            )}
            <div className="mt-4 space-y-1.5">
              <p className="text-xs text-muted-foreground">{L("ระดับความคุ้นเคย (0 = ใหม่ · 5 = จำได้ดีมาก)", "Familiarity (0 = new · 5 = well known)")}</p>
              {data.familiarity.map((n, i) => (
                <div key={i} className="flex items-center gap-2 text-xs">
                  <span className="w-3 tabular-nums">{i}</span>
                  <div className="h-2 flex-1 overflow-hidden rounded-full bg-secondary">
                    <div className="h-full rounded-full" style={{ width: `${data.totals.vocab ? (n / data.totals.vocab) * 100 : 0}%`, background: SERIES }} />
                  </div>
                  <span className="w-8 text-right tabular-nums">{n}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{L("ประวัติการทดสอบ", "Assessment history")}</CardTitle>
          </CardHeader>
          <CardContent>
            {data.assessments.length ? (
              <ul className="divide-y text-sm">
                {data.assessments.map((a) => (
                  <li key={a.id} className="flex items-center justify-between gap-3 py-2.5">
                    <div>
                      <p className="font-medium">
                        {a.kind === "level_exam" ? L("สอบเลื่อนระดับ", "Level exam") : L("แบบทดสอบประจำหน่วย", "Unit test")} · {sk(a.skill)} · {a.level}
                      </p>
                      <p className="text-xs text-muted-foreground">{formatDate(a.at, uiLang)}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="tabular-nums">{Math.round(a.score * 100)}%</span>
                      <Badge variant={a.passed ? "success" : "destructive"}>{a.passed ? L("ผ่าน", "Passed") : L("ไม่ผ่าน", "Not passed")}</Badge>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">{L("ยังไม่มีผลการทดสอบ", "No assessments yet.")}</p>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{L("ติดตามจุดอ่อน", "Weakness tracker")}</CardTitle>
          <CardDescription>{L("จุดอ่อนนับจากหลักฐานซ้ำ ๆ (ผิดอย่างน้อย 3 ครั้งใน 3 สัปดาห์ จาก 2 แบบฝึกขึ้นไป และอย่างน้อย 2 วัน) ไม่ใช่จากความผิดพลาดครั้งเดียว", "A weakness needs repeated evidence (3+ mistakes in 3 weeks, from 2+ exercises, on 2+ days) — never a single slip.")}</CardDescription>
        </CardHeader>
        <CardContent>
          {data.weaknesses.length ? (
            <ul className="space-y-3">
              {data.weaknesses.map((w) => (
                <li key={w.categoryId} className="rounded-xl border p-3">
                  <details>
                    <summary className="flex cursor-pointer list-none flex-wrap items-center justify-between gap-2">
                      <span className="font-medium">{cat(w.categoryId)}</span>
                      <span className="flex items-center gap-2 text-xs">
                        <Badge variant={w.status === "active" ? "destructive" : w.status === "improving" ? "warning" : w.status === "resolved" ? "success" : "secondary"}>{L(...(statusLabel[w.status] ?? [w.status, w.status]))}</Badge>
                        <span className="text-muted-foreground">{L(`ความแม่น ${Math.round(w.mastery * 100)}% · ผิด ${w.recent} ครั้งช่วงนี้`, `mastery ${Math.round(w.mastery * 100)}% · ${w.recent} recent`)}</span>
                      </span>
                    </summary>
                    <div className="mt-3 space-y-2 text-sm">
                      <p className="text-xs text-muted-foreground">
                        {L("พบครั้งแรก", "First detected")} {formatDate(w.firstDetectedAt, uiLang)} · {L("ล่าสุด", "last seen")} {formatDate(w.lastSeenAt, uiLang)} · {L(`ทั้งหมด ${w.occurrences} ครั้ง`, `${w.occurrences} total`)}
                      </p>
                      {w.history.length > 1 && (
                        <p className="text-xs text-muted-foreground">
                          {L("ความแม่นตามเวลา: ", "Mastery over time: ")}
                          {w.history.slice(-6).map((h) => `${short(h.date)} ${Math.round(h.mastery * 100)}%`).join(" → ")}
                        </p>
                      )}
                      {w.examples.map((e, i) => (
                        <div key={i} className="rounded-lg bg-secondary/60 p-2">
                          <p>
                            <span className="text-red-700 line-through decoration-red-300">{e.original}</span> → <span className="font-medium">{e.corrected}</span>
                          </p>
                          <p className="text-xs text-muted-foreground">{e.explanation}</p>
                        </div>
                      ))}
                    </div>
                  </details>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">{L("ยังไม่พบจุดอ่อนที่เกิดซ้ำ", "No recurring weaknesses detected yet.")}</p>
          )}
        </CardContent>
      </Card>

      {(recordings.early.length > 0 || recordings.late.length > 0) && (
        <Card>
          <CardHeader>
            <CardTitle>{L("เทียบเสียงพูด: ช่วงแรก vs ล่าสุด", "Speaking: early vs recent")}</CardTitle>
            <CardDescription>{L("บันทึกเฉพาะเมื่อคุณอนุญาต ลบได้ในโปรไฟล์", "Saved only with your consent — delete any time in Profile.")}</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            {([[L("ช่วงแรก", "Early"), recordings.early], [L("ล่าสุด", "Recent"), recordings.late]] as const).map(([title, list]) => (
              <div key={title} className="space-y-2">
                <p className="text-sm font-medium">{title}</p>
                {list.length === 0 && <p className="text-xs text-muted-foreground">—</p>}
                {list.map((r) => (
                  <div key={r.id} className="space-y-1 rounded-xl border p-2 text-xs">
                    <p className="text-muted-foreground">{formatDate(r.at, uiLang)} · {r.prompt}</p>
                    {r.url && <audio controls preload="none" src={r.url} className="h-8 w-full" />}
                    {r.transcript && <p>“{r.transcript}”</p>}
                  </div>
                ))}
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
