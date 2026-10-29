import { notFound } from "next/navigation";
import { asUser } from "@/db";
import { getLearner } from "@/server/learner";
import { latestPlacement, recommendations } from "@/server/placement";
import { isLanguage, lang as langModule } from "@/languages";
import { WEAKNESS_CATEGORIES } from "@/content/tags";
import { PlacementClient } from "./client";
import { PlacementResults } from "./results";

export const metadata = { title: "แบบทดสอบวัดระดับ" };

export default async function PlacementPage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  if (!isLanguage(lang)) notFound();
  const learner = await getLearner();
  const latest = await asUser(learner.id, (tx) => latestPlacement(tx, learner.id, lang));
  const m = langModule(lang);
  const uiEn = learner.profile.uiLanguage === "en";

  if (latest?.assessment.status === "completed") {
    const rec = recommendations(lang, latest.skills);
    const tagName = (id: string) => {
      const c = WEAKNESS_CATEGORIES.find((x) => x.id === id);
      return c ? (uiEn ? c.nameEn : c.nameTh) : id;
    };
    return (
      <PlacementResults
        language={lang}
        languageName={uiEn ? m.nameEn : m.nameTh}
        frameworkNote={m.frameworkNoteTh}
        completedAt={latest.assessment.completedAt?.toISOString() ?? null}
        skills={latest.skills.map((s) => ({
          skill: s.skill,
          status: s.status,
          level: s.estimatedLevel,
          levelName: m.levels.find((l) => l.code === s.estimatedLevel)?.nameTh ?? s.estimatedLevel,
          confidence: s.confidence,
          strengths: (s.strengths ?? []).map(tagName),
          weaknesses: (s.weaknesses ?? []).map(tagName),
          limitations: s.limitations ?? [],
          detail: s.detail as { belowFirstLevel?: boolean; atCeiling?: boolean; itemsAnswered?: number } | null,
          evaluator: s.evaluator,
        }))}
        recommendations={rec.recs.map((r) => ({ skill: r.skill, level: r.level, unit: r.unit ? { id: r.unit.id, title: r.unit.title, titleTh: r.unit.titleTh } : null }))}
        priorities={{ skills: rec.priorities.skills, tags: rec.priorities.tags.map(tagName) }}
      />
    );
  }
  return (
    <PlacementClient
      language={lang}
      languageName={uiEn ? m.nameEn : m.nameTh}
      ttsLang={m.ttsLang}
      sttLang={m.sttLang}
      assessmentId={latest?.assessment.status === "in_progress" ? latest.assessment.id : null}
      skills={(latest?.assessment.status === "in_progress" ? latest.skills : []).map((s) => ({ skill: s.skill, status: s.status }))}
    />
  );
}
