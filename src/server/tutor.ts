import "server-only";
import { and, asc, eq } from "drizzle-orm";
import { schema, type Tx } from "@/db";
import type { LanguageId, Topic } from "@/content/types";
import { getUnit, unitsFor } from "@/content";
import { tutorTurn, type CorrectionMode } from "@/ai/teacher";
import { getSkillProgress } from "./curriculum";
import { HttpError } from "./http";
import { assertAiAllowed, usageRecorder } from "./ai-usage";
import { explanationLang, providerFor, type Learner } from "./learner";

const OPENERS: Record<LanguageId, Record<Topic, string[]>> = {
  en: {
    daily: ["What does a normal weekday look like for you?", "What did you do last weekend?", "What do you usually eat for breakfast?"],
    travel: ["Where would you like to travel next, and why?", "Tell me about a memorable trip.", "What do you always pack when you travel?"],
    business: ["What do you enjoy most about your job?", "How do you prepare for an important meeting?", "Tell me about a challenge at work you solved."],
    aviation: ["What is a typical day like for airline staff?", "How would you calm down a nervous passenger?", "What makes a good crew briefing?"],
    interviews: ["Tell me about yourself.", "What is your greatest strength?", "Why do you want this job?"],
    news: ["What news story caught your attention recently?", "Do you think technology makes us happier?", "How do you check if news is true?"],
    mixed: ["How was your day?", "What are you learning at the moment?", "What would you like to improve this month?"],
  },
  zh: {
    daily: ["你每天几点起床？", "你周末喜欢做什么？", "你早饭一般吃什么？"],
    travel: ["你去过中国吗？", "你最想去哪儿旅行？为什么？", "你喜欢坐飞机还是坐火车？"],
    business: ["你做什么工作？", "你的工作忙不忙？", "你喜欢你的同事吗？"],
    aviation: ["你在机场工作过吗？", "坐飞机的时候你喜欢做什么？", "你觉得空姐的工作怎么样？"],
    interviews: ["请你介绍一下你自己。", "你为什么想做这个工作？", "你有什么优点？"],
    news: ["你每天看新闻吗？", "你觉得手机对生活有什么影响？", "最近有什么有意思的新闻？"],
    mixed: ["你今天怎么样？", "你为什么学习中文？", "你周末有什么计划？"],
  },
};

function questionsFor(language: LanguageId, topic: Topic, levelCode: string) {
  const unitPrompts = unitsFor(language, levelCode)
    .filter((u) => topic === "mixed" || u.topics.includes(topic))
    .flatMap((u) => u.exercises.filter((e) => e.type === "speaking_response").map((e) => e.prompt));
  return [...OPENERS[language][topic], ...unitPrompts].slice(0, 12);
}

export async function startConversation(tx: Tx, learner: Learner, language: LanguageId, topic: Topic, sessionId?: string) {
  const progress = await getSkillProgress(tx, learner.id, language);
  const levelCode = progress.find((p) => p.skill === "speaking")?.levelCode ?? (language === "zh" ? "HSK1" : "A2");
  const provider = providerFor(learner.profile);
  const opener = questionsFor(language, topic, levelCode)[0]!;
  const [c] = await tx
    .insert(schema.conversations)
    .values({ userId: learner.id, languageId: language, topic, levelCode, correctionMode: learner.profile.correctionMode, sessionId: sessionId ?? null, evaluator: provider ? "ai" : "demo_rules" })
    .returning();
  await tx.insert(schema.conversationMessages).values({ conversationId: c!.id, userId: learner.id, role: "tutor", content: opener });
  return c!;
}

export async function conversationView(tx: Tx, userId: string, id: string) {
  if (!/^[0-9a-f-]{36}$/i.test(id)) throw new HttpError(404, "not_found");
  const [c] = await tx.select().from(schema.conversations).where(and(eq(schema.conversations.id, id), eq(schema.conversations.userId, userId)));
  if (!c) throw new HttpError(404, "not_found");
  const messages = await tx.select().from(schema.conversationMessages).where(eq(schema.conversationMessages.conversationId, c.id)).orderBy(asc(schema.conversationMessages.createdAt));
  return { conversation: c, messages };
}

export async function conversationTurn(tx: Tx, learner: Learner, id: string, input: { text: string; inputMode: "voice" | "text"; durationMs?: number; signal?: AbortSignal }) {
  const { conversation: c, messages } = await conversationView(tx, learner.id, id);
  if (c.status !== "active") throw new HttpError(409, "conversation_ended");
  const provider = providerFor(learner.profile);
  if (provider) await assertAiAllowed(tx, learner.id);
  const usage = provider ? usageRecorder(tx, learner.id, "llm", provider) : null;
  const turn = await tutorTurn({
    language: c.languageId as LanguageId,
    level: c.levelCode,
    topic: c.topic,
    questions: questionsFor(c.languageId as LanguageId, c.topic as Topic, c.levelCode),
    correctionMode: c.correctionMode as CorrectionMode,
    explanationLanguage: explanationLang(learner.profile),
    history: messages.map((m) => ({ role: m.role === "tutor" ? ("assistant" as const) : ("user" as const), content: m.content })),
    text: input.text,
    durationSec: input.durationMs ? input.durationMs / 1000 : undefined,
    provider,
    signal: input.signal,
    onUsage: usage?.onUsage,
  });
  await usage?.flush();
  const [learnerMsg] = await tx
    .insert(schema.conversationMessages)
    .values({ conversationId: c.id, userId: learner.id, role: "learner", content: input.text, inputMode: input.inputMode, feedback: turn.feedback })
    .returning();
  const [tutorMsg] = await tx.insert(schema.conversationMessages).values({ conversationId: c.id, userId: learner.id, role: "tutor", content: turn.reply }).returning();
  if (turn.feedback.mistakes.length) {
    await tx.insert(schema.mistakeRecords).values(
      turn.feedback.mistakes.slice(0, 6).map((m) => ({ userId: learner.id, languageId: c.languageId, skill: "speaking", categoryId: m.tag, original: m.original.slice(0, 500), corrected: m.corrected.slice(0, 500), explanation: m.explanation.slice(0, 600) })),
    );
  }
  await tx.update(schema.conversations).set({ updatedAt: new Date() }).where(eq(schema.conversations.id, c.id));
  return { learnerMessage: learnerMsg!, tutorMessage: tutorMsg!, feedback: turn.feedback, askRetry: turn.askRetry, correctionMode: c.correctionMode };
}

export async function endConversation(tx: Tx, userId: string, id: string) {
  const { conversation: c, messages } = await conversationView(tx, userId, id);
  const learnerMsgs = messages.filter((m) => m.role === "learner");
  const scores = learnerMsgs.map((m) => (m.feedback as { score?: number } | null)?.score ?? 0);
  const summary = {
    turns: learnerMsgs.length,
    average: scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : 0,
    mistakes: learnerMsgs.flatMap((m) => ((m.feedback as { mistakes?: unknown[] } | null)?.mistakes ?? []) as unknown[]).slice(0, 20),
  };
  await tx.update(schema.conversations).set({ status: "ended", summary, updatedAt: new Date() }).where(eq(schema.conversations.id, c.id));
  return summary;
}

export { getUnit };
