import { requireUser } from "@/lib/auth";
import { lessonOverview } from "@/lib/progress";
import { lessons } from "@/content/curriculum";
import { shadowingId } from "@/content/shadowing-index";
import { PageHeader } from "@/components/layout/page-header";
import { ShadowingStudio } from "./studio";

export const metadata = { title: "Shadowing Studio" };

export default async function ShadowingPage() {
  const user = await requireUser();
  const ov = await lessonOverview(user.id);
  const sets = lessons.map((l) => ({ day: l.day, title: l.title, items: l.shadowing.map((s, i) => ({ ...s, id: shadowingId(l.day, i) })) }));
  return (
    <div>
      <PageHeader back="/dashboard" title="Shadowing Trainer" subtitle="Listen, repeat immediately, and compare. Great for rhythm, linking and confidence." />
      <ShadowingStudio sets={sets} initialDay={ov.currentDay} />
    </div>
  );
}
