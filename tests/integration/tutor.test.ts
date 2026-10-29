import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { asUser } from "@/db";
import type { Learner } from "@/server/learner";
import { conversationTurn, conversationView, endConversation, startConversation } from "@/server/tutor";
import { startFromBeginning } from "@/server/placement";
import { createUser, dbAvailable, deleteUser } from "./helpers";

const up = await dbAvailable();

describe.skipIf(!up)("tutor conversation without an AI key (scripted demo tutor)", () => {
  let learner: Learner;
  beforeAll(async () => {
    learner = await createUser();
    await asUser(learner.id, (tx) => startFromBeginning(tx, learner.id, "en"));
  });
  afterAll(async () => {
    if (learner) await deleteUser(learner.id);
  });

  it("starts, replies with labelled demo feedback, and ends with a summary", async () => {
    const c = await asUser(learner.id, (tx) => startConversation(tx, learner, "en", "travel"));
    const turn = await asUser(learner.id, (tx) => conversationTurn(tx, learner, c.id, { text: "I have 25 years old and I go to Japan last year.", inputMode: "text" }));
    expect(JSON.stringify(turn)).toMatch(/demo/i);
    const view = await asUser(learner.id, (tx) => conversationView(tx, learner.id, c.id));
    expect(view.messages.filter((m) => m.role === "learner")).toHaveLength(1);
    expect(view.messages.filter((m) => m.role === "tutor").length).toBeGreaterThanOrEqual(2);
    const end = await asUser(learner.id, (tx) => endConversation(tx, learner.id, c.id));
    expect(end).toBeTruthy();
    await expect(asUser(learner.id, (tx) => conversationTurn(tx, learner, c.id, { text: "hello", inputMode: "text" }))).rejects.toMatchObject({ code: "conversation_ended" });
  });
});
