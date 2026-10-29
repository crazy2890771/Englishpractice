import { redirect } from "next/navigation";
import { getLearner } from "@/server/learner";
import { Onboarding } from "./wizard";

export const metadata = { title: "เริ่มต้น" };

export default async function OnboardingPage() {
  const learner = await getLearner();
  if (learner.profile.onboarded) redirect("/today");
  return <Onboarding defaultName={learner.profile.displayName} />;
}
