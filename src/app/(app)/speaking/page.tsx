import { topicBanks } from "@/content/topics";
import { PageHeader } from "@/components/layout/page-header";
import { SpeakingRoom } from "./room";

export const metadata = { title: "AI Speaking Partner" };

export default function SpeakingPage() {
  return (
    <div>
      <PageHeader back="/dashboard" title="AI Speaking Partner" subtitle="Have a natural conversation. Get feedback after every answer." />
      <SpeakingRoom topics={topicBanks.map((t) => ({ id: t.id, label: t.label, first: t.questions[0]! }))} />
    </div>
  );
}
