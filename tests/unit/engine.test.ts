import { describe, expect, it } from "vitest";
import { extractJson, mockTurn } from "@/lib/ai/engine";
import { chatTurnSchema } from "@/lib/ai/schemas";
import { roleplays } from "@/content/roleplays";

const ctx = { kind: "speaking" as const, topic: "Daily routines", questions: ["Q0?", "Q1?", "Q2?"], targetWords: ["commute"], level: "B1" };

describe("demo conversation engine", () => {
  it("asks the next scripted question, one at a time", () => {
    const t = mockTurn({ ctx, history: [{ role: "assistant", content: "Q0?" }], userText: "I usually wake up at seven and take the train to work." });
    expect(chatTurnSchema.safeParse(t).success).toBe(true);
    expect(t.reply).toContain("Q1?");
    expect((t.reply.match(/\?/g) ?? []).length).toBe(1);
  });

  it("asks for elaboration on very short answers, then moves on", () => {
    const t1 = mockTurn({ ctx, history: [{ role: "assistant", content: "Q0?" }], userText: "Yes." });
    expect(t1.reply).toMatch(/tell me a little more/);
    const t2 = mockTurn({
      ctx,
      history: [{ role: "assistant", content: "Q0?" }, { role: "user", content: "Yes." }, { role: "assistant", content: t1.reply }],
      userText: "Okay.",
    });
    expect(t2.reply).toContain("Q1?");
  });

  it("finishes after the last question", () => {
    const t = mockTurn({
      ctx,
      history: [
        { role: "assistant", content: "Q0?" }, { role: "user", content: "A long enough answer here." },
        { role: "assistant", content: "Q1?" }, { role: "user", content: "Another long enough answer here." },
        { role: "assistant", content: "Q2?" },
      ],
      userText: "My final answer is quite detailed.",
    });
    expect(t.scenarioComplete).toBe(true);
  });

  it("roleplay stays in character and closes after scripted turns", () => {
    const sc = roleplays[0]!;
    const rctx = { kind: "roleplay" as const, scenario: sc, level: "B1" };
    expect(mockTurn({ ctx: rctx, history: [{ role: "assistant", content: sc.opening }], userText: "Hello, thank you for having me." }).reply).toBe(sc.demoTurns[0]);
    const history = [{ role: "assistant" as const, content: sc.opening }];
    for (let i = 0; i < sc.demoTurns.length; i++) history.push({ role: "user" as never, content: "answer" }, { role: "assistant", content: sc.demoTurns[i]! });
    const last = mockTurn({ ctx: rctx, history, userText: "Thank you!" });
    expect(last.reply).toBe(sc.closing);
    expect(last.scenarioComplete).toBe(true);
  });
});

describe("JSON extraction from model output", () => {
  it("handles code fences and surrounding text", () => {
    expect(extractJson('Sure!\n```json\n{"a": 1}\n```')).toEqual({ a: 1 });
  });
  it("throws when there is no JSON", () => {
    expect(() => extractJson("no json")).toThrow();
  });
});
