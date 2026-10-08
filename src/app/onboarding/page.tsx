import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { Onboarding } from "./onboarding";

export const metadata = { title: "Get started" };
export const dynamic = "force-dynamic";

export default async function OnboardingPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/welcome");
  if (user.onboarded) redirect("/dashboard");
  return <Onboarding name={user.isDemo ? "" : user.name} />;
}
