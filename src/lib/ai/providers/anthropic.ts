import "server-only";
import { env } from "../../env";
import { providerFetch } from "./http";
import type { LlmProvider, LlmRequest, LlmResponse } from "./types";

export const anthropicProvider: LlmProvider = {
  name: "anthropic",
  async complete(req: LlmRequest): Promise<LlmResponse> {
    const res = await providerFetch(
      "https://api.anthropic.com/v1/messages",
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-api-key": env.anthropicKey,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: env.anthropicModel,
          max_tokens: req.maxTokens,
          temperature: req.temperature ?? 0.4,
          system: req.system,
          messages: req.messages,
        }),
      },
      req.signal,
    );
    const data = (await res.json()) as {
      content: Array<{ type: string; text?: string }>;
      usage?: { input_tokens: number; output_tokens: number };
    };
    const text = data.content.filter((c) => c.type === "text").map((c) => c.text ?? "").join("");
    return { text, inputTokens: data.usage?.input_tokens ?? 0, outputTokens: data.usage?.output_tokens ?? 0 };
  },
};
