import { redirect } from "next/navigation";
import { getLearner } from "@/server/learner";
import { resolveProvider, serverSpeechAvailable } from "@/ai/providers";
import { UiProvider } from "@/components/app/ui-context";
import { AppShell } from "@/components/app/shell";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const learner = await getLearner();
  if (!learner.profile.onboarded) redirect("/onboarding");
  const p = learner.profile;
  return (
    <UiProvider
      value={{
        uiLang: p.uiLanguage === "en" ? "en" : "th",
        explanationLang: p.explanationLanguage === "en" ? "en" : "th",
        showPinyin: p.showPinyin,
        playbackSpeed: p.playbackSpeed,
        correctionMode: p.correctionMode,
        ttsServer: serverSpeechAvailable(),
        sttServer: serverSpeechAvailable(),
        aiMode: resolveProvider(p.aiProvider) ? "live" : "demo",
        saveRecordings: p.saveRecordings,
        userId: learner.id,
      }}
    >
      <AppShell>{children}</AppShell>
    </UiProvider>
  );
}
