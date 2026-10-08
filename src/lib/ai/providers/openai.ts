import "server-only";
import { env } from "../../env";
import { providerFetch } from "./http";
import type { LlmProvider, LlmRequest, LlmResponse } from "./types";

/** Works with OpenAI and any OpenAI-compatible endpoint (set OPENAI_BASE_URL). */
export const openaiProvider: LlmProvider = {
  name: "openai",
  async complete(req: LlmRequest): Promise<LlmResponse> {
    const res = await providerFetch(
      `${env.openaiBaseUrl}/chat/completions`,
      {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${env.openaiKey}` },
        body: JSON.stringify({
          model: env.openaiChatModel,
          max_tokens: req.maxTokens,
          temperature: req.temperature ?? 0.4,
          response_format: { type: "json_object" },
          messages: [{ role: "system", content: req.system }, ...req.messages],
        }),
      },
      req.signal,
    );
    const data = (await res.json()) as {
      choices: Array<{ message: { content: string } }>;
      usage?: { prompt_tokens: number; completion_tokens: number };
    };
    return {
      text: data.choices[0]?.message.content ?? "",
      inputTokens: data.usage?.prompt_tokens ?? 0,
      outputTokens: data.usage?.completion_tokens ?? 0,
    };
  },
};

export async function openaiTranscribe(audio: Blob, filename: string, signal?: AbortSignal) {
  const form = new FormData();
  form.append("file", audio, filename);
  form.append("model", env.openaiSttModel);
  form.append("language", "en");
  form.append("response_format", "verbose_json");
  const res = await providerFetch(
    `${env.openaiBaseUrl}/audio/transcriptions`,
    { method: "POST", headers: { authorization: `Bearer ${env.openaiKey}` }, body: form },
    signal,
  );
  const data = (await res.json()) as { text: string; duration?: number };
  return { text: (data.text ?? "").trim(), durationSec: data.duration };
}

const VOICES = { female: "nova", male: "onyx", neutral: "alloy" } as const;

export async function openaiSpeak(text: string, voice: keyof typeof VOICES, speed: number, signal?: AbortSignal) {
  const res = await providerFetch(
    `${env.openaiBaseUrl}/audio/speech`,
    {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${env.openaiKey}` },
      body: JSON.stringify({ model: env.openaiTtsModel, voice: VOICES[voice], input: text, speed, response_format: "mp3" }),
    },
    signal,
  );
  return Buffer.from(await res.arrayBuffer());
}
