import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { resolveProviders } from "@/lib/ai/config";
import { AppConfigProvider } from "@/components/providers";
import { AppShell } from "@/components/layout/app-shell";
import { ThemeSync } from "@/components/theme-sync";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  if (!user.onboarded) redirect("/onboarding");
  const s = user.settings;
  const providers = resolveProviders(s);
  return (
    <AppConfigProvider
      value={{
        user: { id: user.id, name: user.name, level: user.level, isDemo: user.isDemo, email: user.email },
        settings: {
          theme: s?.theme ?? "dark",
          speechRate: s?.speechRate ?? 1,
          accent: s?.accent ?? "US",
          saveRecordings: s?.saveRecordings ?? false,
          interruptionFree: s?.interruptionFree ?? false,
        },
        providers,
      }}
    >
      <ThemeSync theme={s?.theme ?? "dark"} />
      <AppShell>{children}</AppShell>
    </AppConfigProvider>
  );
}
