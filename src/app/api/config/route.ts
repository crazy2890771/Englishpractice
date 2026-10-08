import { NextResponse } from "next/server";
import { withUser } from "@/lib/api";
import { availableLlms, availableSpeech, resolveProviders } from "@/lib/ai/config";

/** Public provider configuration for the client. Never includes secrets. */
export const GET = withUser(async (_req, user) => {
  return NextResponse.json({
    resolved: resolveProviders(user.settings),
    available: { llm: availableLlms(), speech: availableSpeech() },
  });
});
