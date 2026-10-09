import { requireUser, ensureSettings } from "@/lib/auth";
import { db } from "@/lib/db";
import { availableLlms, availableSpeech, resolveProviders } from "@/lib/ai/config";
import { usageSummary } from "@/lib/usage";
import { env } from "@/lib/env";
import { lessonOverview } from "@/lib/progress";
import { PageHeader } from "@/components/layout/page-header";
import { SettingsForm } from "./form";

export const metadata = { title: "Settings" };

export default async function SettingsPage() {
  const user = await requireUser();
  const settings = await ensureSettings(user.id);
  const [usage, recordings, ov] = await Promise.all([
    usageSummary(user.id),
    db.recording.findMany({ where: { userId: user.id, expiresAt: { gte: new Date() } }, orderBy: { createdAt: "desc" }, take: 50, select: { id: true, mode: true, label: true, durationMs: true, createdAt: true, expiresAt: true, sizeBytes: true } }),
    lessonOverview(user.id),
  ]);
  const { updatedAt: _u, ...s } = settings;
  void _u;
  return (
    <div>
      <PageHeader back="/dashboard" title="Settings" subtitle="Appearance, audio, AI providers, privacy and usage limits." />
      <SettingsForm
        initial={s}
        profile={{ name: user.name, email: user.isDemo ? null : user.email, level: user.level, isDemo: user.isDemo }}
        providers={{ resolved: resolveProviders(settings), llm: availableLlms(), speech: availableSpeech() }}
        caps={{ dailyRequests: env.maxDailyRequests, monthlyCostCents: env.maxMonthlyCostCents }}
        usage={usage}
        lessonDays={ov.days.filter((d) => d.status !== "locked").map((d) => d.day)}
        recordings={recordings.map((r) => ({ ...r, createdAt: r.createdAt.toISOString(), expiresAt: r.expiresAt.toISOString() }))}
      />
    </div>
  );
}
