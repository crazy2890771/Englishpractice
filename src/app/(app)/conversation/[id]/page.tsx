import { asUser } from "@/db";
import { getLearner } from "@/server/learner";
import { conversationView } from "@/server/tutor";
import { lang } from "@/languages";
import { ConversationClient } from "./client";

export const metadata = { title: "สนทนากับครู AI" };

export default async function ConversationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const learner = await getLearner();
  const { conversation, messages } = await asUser(learner.id, (tx) => conversationView(tx, learner.id, id));
  const m = lang(conversation.languageId);
  return (
    <ConversationClient
      id={conversation.id}
      languageId={conversation.languageId}
      topic={conversation.topic}
      level={conversation.levelCode}
      correctionMode={conversation.correctionMode}
      evaluator={conversation.evaluator}
      status={conversation.status}
      ttsLang={m.ttsLang}
      sttLang={m.sttLang}
      initial={JSON.parse(JSON.stringify(messages))}
    />
  );
}
