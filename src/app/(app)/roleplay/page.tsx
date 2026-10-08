import { roleplays } from "@/content/roleplays";
import { PageHeader } from "@/components/layout/page-header";
import { RoleplaySimulator } from "./simulator";

export const metadata = { title: "Roleplay Simulator" };

export default function RoleplayPage() {
  return (
    <div>
      <PageHeader back="/dashboard" title="Real-Life Roleplay" subtitle="Practise real situations with AI characters who stay in role until the scenario ends." />
      <RoleplaySimulator scenarios={roleplays} />
    </div>
  );
}
