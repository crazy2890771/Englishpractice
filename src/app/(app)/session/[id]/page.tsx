import { asUser } from "@/db";
import { getLearner } from "@/server/learner";
import { getOwnSession, sessionView } from "@/server/sessions";
import { lang } from "@/languages";
import { SessionPlayer, type SessionViewData } from "./player";

export const metadata = { title: "บทเรียน" };

export default async function SessionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const learner = await getLearner();
  const view = await asUser(learner.id, async (tx) => sessionView(tx, await getOwnSession(tx, learner.id, id)));
  const m = lang(view.session.languageId);
  return <SessionPlayer view={JSON.parse(JSON.stringify(view)) as SessionViewData} ttsLang={m.ttsLang} sttLang={m.sttLang} />;
}
