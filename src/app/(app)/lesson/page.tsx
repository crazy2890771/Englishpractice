import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { lessonOverview } from "@/lib/progress";

export default async function TodayLesson() {
  const user = await requireUser();
  const ov = await lessonOverview(user.id);
  redirect(`/lesson/${ov.currentDay}`);
}
