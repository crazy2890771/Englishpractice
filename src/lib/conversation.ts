import "server-only";
import { getLesson } from "@/content/curriculum";
import { roleplays } from "@/content/roleplays";
import { topicBanks } from "@/content/topics";
import type { RoleplayContext, SpeakingContext } from "./ai/engine";
import { ApiError } from "./api";

/** Conversation "topic" keys: lesson:<day> | topic:<bankId> | roleplay:<scenarioId> */
export function buildContext(topicKey: string, level: string): (SpeakingContext | RoleplayContext) & { opening: string; title: string } {
  const [kind, id] = topicKey.split(":");
  if (kind === "lesson") {
    const lesson = getLesson(Number(id));
    if (!lesson) throw new ApiError(404, "Lesson not found.");
    return {
      kind: "speaking",
      title: `Day ${lesson.day}: ${lesson.speaking.topic}`,
      topic: lesson.speaking.topic,
      goal: lesson.speaking.goal,
      questions: [lesson.speaking.openingQuestion, ...lesson.speaking.followUps],
      targetWords: lesson.vocabulary.map((v) => v.word),
      level,
      opening: `Hi! Today we're talking about ${lesson.speaking.topic.toLowerCase()}. ${lesson.speaking.openingQuestion}`,
    };
  }
  if (kind === "topic") {
    const bank = topicBanks.find((b) => b.id === id);
    if (!bank) throw new ApiError(404, "Topic not found.");
    return {
      kind: "speaking",
      title: bank.label,
      topic: bank.label,
      questions: bank.questions,
      targetWords: [],
      level,
      opening: `Hi! Let's chat about ${bank.label.toLowerCase()}. ${bank.questions[0]}`,
    };
  }
  if (kind === "roleplay") {
    const scenario = roleplays.find((r) => r.id === id);
    if (!scenario) throw new ApiError(404, "Scenario not found.");
    return { kind: "roleplay", scenario, level, title: scenario.title, opening: scenario.opening };
  }
  throw new ApiError(400, "Unknown conversation type.");
}
