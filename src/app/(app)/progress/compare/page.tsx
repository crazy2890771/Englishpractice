import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { lessonOverview } from "@/lib/progress";
import type { AssessmentScores } from "@/lib/assessment";
import { RUBRICS } from "@/lib/ai/schemas";
import { PageHeader } from "@/components/layout/page-header";
import { CompareRadar } from "@/components/charts";
import { Badge, EmptyState, Notice } from "@/components/ui";

export const metadata = { title: "Day 1 vs Day 30" };

interface Responses {
  speaking: { id: string; text: string }[];
  writing: string;
}

export default async function ComparePage() {
  const user = await requireUser();
  const [baseline, final, ov] = await Promise.all([
    db.assessment.findUnique({ where: { userId_kind: { userId: user.id, kind: "BASELINE" } } }),
    db.assessment.findUnique({ where: { userId_kind: { userId: user.id, kind: "FINAL" } } }),
    lessonOverview(user.id),
  ]);

  if (!baseline) {
    return (
      <div>
        <PageHeader back="/progress" title="Day 1 vs Day 30" />
        <EmptyState title="No baseline yet" action={<Link href="/assessment" className="btn-primary">Take the baseline assessment</Link>}>
          The comparison uses the same assessment on Day 1 and Day 30.
        </EmptyState>
      </div>
    );
  }
  const b = baseline.scores as unknown as AssessmentScores;
  const f = final ? (final.scores as unknown as AssessmentScores) : null;
  const sections = [
    { key: "speaking", label: "Speaking" },
    { key: "listening", label: "Listening" },
    { key: "writing", label: "Writing" },
  ] as const;
  const radar = [
    { skill: "Speaking", day1: b.sections.speaking, day30: f?.sections.speaking ?? null },
    { skill: "Listening", day1: b.sections.listening, day30: f?.sections.listening ?? null },
    { skill: "Writing", day1: b.sections.writing, day30: f?.sections.writing ?? null },
    { skill: "Grammar", day1: Math.round(((b.speaking.grammar + b.writing.grammar) / 10) * 100), day30: f ? Math.round(((f.speaking.grammar + f.writing.grammar) / 10) * 100) : null },
    { skill: "Vocabulary", day1: Math.round(((b.speaking.vocabulary + b.writing.vocabulary) / 10) * 100), day30: f ? Math.round(((f.speaking.vocabulary + f.writing.vocabulary) / 10) * 100) : null },
    { skill: "Fluency", day1: Math.round((b.speaking.fluency / 5) * 100), day30: f ? Math.round((f.speaking.fluency / 5) * 100) : null },
  ];
  const br = baseline.responses as unknown as Responses;
  const fr = final ? (final.responses as unknown as Responses) : null;
  const scorerMismatch = final && final.live !== baseline.live;
  const versionMismatch = final && final.version !== baseline.version;

  return (
    <div className="space-y-6">
      <PageHeader back="/progress" title="Day 1 vs Day 30" subtitle="Same tasks, same rubric, same scorer — so the comparison is fair." />
      {!final && (
        <Notice>
          {ov.completed >= 29 ? (
            <>Your final assessment is unlocked. <Link href="/assessment?kind=FINAL" className="font-semibold text-brand underline">Take it now</Link> to complete the comparison.</>
          ) : (
            <>The final assessment unlocks on Day 30 ({ov.completed}/30 lessons completed). Your Day 1 baseline is shown below.</>
          )}
        </Notice>
      )}
      {scorerMismatch && <Notice tone="warn">Day 1 and Day 30 were scored by different engines (demo vs AI), so differences may partly reflect the scorer.</Notice>}
      {versionMismatch && <Notice tone="warn">The two assessments used different versions, so they are not directly comparable.</Notice>}

      <div className="grid gap-4 lg:grid-cols-[1fr_1.2fr]">
        <section className="card p-5">
          <h2 className="mb-2 font-semibold">Skill profile</h2>
          <CompareRadar data={radar} />
        </section>
        <section className="card p-5">
          <h2 className="mb-4 font-semibold">Results</h2>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide text-muted">
                <th className="pb-2 font-medium">Section</th><th className="pb-2 font-medium">Day 1</th><th className="pb-2 font-medium">Day 30</th><th className="pb-2 font-medium">Change</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {sections.map((s) => {
                const d1 = b.sections[s.key];
                const d30 = f?.sections[s.key];
                const delta = d30 !== undefined ? d30 - d1 : null;
                return (
                  <tr key={s.key}>
                    <td className="py-2.5 font-medium">{s.label}</td>
                    <td className="py-2.5 tabular-nums">{d1}%</td>
                    <td className="py-2.5 tabular-nums">{d30 !== undefined ? `${d30}%` : "—"}</td>
                    <td className="py-2.5">{delta === null ? "—" : <Badge tone={delta > 0 ? "success" : delta < 0 ? "danger" : "default"}>{delta > 0 ? "+" : ""}{delta}</Badge>}</td>
                  </tr>
                );
              })}
              <tr className="font-semibold">
                <td className="py-2.5">Overall</td>
                <td className="py-2.5 tabular-nums">{Math.round(baseline.overall)}% <span className="text-xs font-normal text-muted">({baseline.level} est.)</span></td>
                <td className="py-2.5 tabular-nums">{final ? <>{Math.round(final.overall)}% <span className="text-xs font-normal text-muted">({final.level} est.)</span></> : "—"}</td>
                <td className="py-2.5">{final ? <Badge tone={final.overall >= baseline.overall ? "success" : "danger"}>{final.overall >= baseline.overall ? "+" : ""}{Math.round(final.overall - baseline.overall)}</Badge> : "—"}</td>
              </tr>
            </tbody>
          </table>
          <div className="mt-4 grid gap-3 text-xs sm:grid-cols-2">
            {(["grammar", "vocabulary", "fluency", "taskCompletion"] as const).map((k) => (
              <div key={k} className="flex justify-between rounded-lg bg-surface-2 px-3 py-2">
                <span className="text-muted">Speaking · {RUBRICS[k]!.label}</span>
                <span className="font-semibold tabular-nums">{b.speaking[k].toFixed(1)} → {f ? f.speaking[k].toFixed(1) : "—"}</span>
              </div>
            ))}
          </div>
          <p className="mt-4 text-xs text-muted">Levels are rough self-study estimates, not certified CEFR results. Listening uses the same 8 questions both times.</p>
        </section>
      </div>

      <section className="grid gap-4 md:grid-cols-2" aria-label="Writing samples">
        <Sample title={`Day 1 writing · ${new Date(baseline.completedAt).toLocaleDateString()}`} text={br.writing} />
        <Sample title={final ? `Day 30 writing · ${new Date(final.completedAt).toLocaleDateString()}` : "Day 30 writing"} text={fr?.writing ?? null} />
      </section>
      <section className="card p-5" aria-label="Speaking responses">
        <h2 className="mb-3 font-semibold">Speaking responses</h2>
        <div className="space-y-4">
          {br.speaking.map((s, i) => (
            <div key={s.id} className="grid gap-3 text-sm md:grid-cols-2">
              <div className="rounded-xl bg-surface-2 p-3"><p className="mb-1 text-xs font-semibold text-muted">Day 1 · Task {i + 1}</p>{s.text}</div>
              <div className="rounded-xl bg-surface-2 p-3"><p className="mb-1 text-xs font-semibold text-muted">Day 30 · Task {i + 1}</p>{fr?.speaking[i]?.text ?? <span className="text-muted">Not taken yet</span>}</div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function Sample({ title, text }: { title: string; text: string | null }) {
  return (
    <div className="card p-5 text-sm">
      <h2 className="mb-2 font-semibold">{title}</h2>
      {text ? <p className="whitespace-pre-wrap text-muted">{text}</p> : <p className="text-muted">Not taken yet.</p>}
    </div>
  );
}
