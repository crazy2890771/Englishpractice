import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { getLesson } from "@/content/curriculum";
import { lessonOverview } from "@/lib/progress";
import { FREE_WRITING_PROMPTS } from "@/content/writing-prompts";
import { PageHeader } from "@/components/layout/page-header";
import { WritingCoach } from "./coach";

export const metadata = { title: "Writing Studio" };

export default async function WritingPage() {
  const user = await requireUser();
  const ov = await lessonOverview(user.id);
  const lesson = getLesson(ov.currentDay)!;
  const history = await db.writingSubmission.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    take: 20,
    select: { id: true, prompt: true, text: true, natural: true, scores: true, createdAt: true, day: true, live: true },
  });
  return (
    <div>
      <PageHeader back="/dashboard" title="Writing Coach" subtitle="Write, get feedback, and improve." />
      <WritingCoach
        lessonPrompt={{ day: lesson.day, title: lesson.title, prompt: { id: `d${lesson.day}-writing`, ...lesson.writing } }}
        prompts={FREE_WRITING_PROMPTS}
        history={history.map((h) => ({ ...h, createdAt: h.createdAt.toISOString(), scores: h.scores as Record<string, number> }))}
      />
    </div>
  );
}
