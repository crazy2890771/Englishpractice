import "server-only";

function num(name: string, fallback: number): number {
  const v = Number(process.env[name]);
  return Number.isFinite(v) && v > 0 ? v : fallback;
}
function str(name: string, fallback = ""): string {
  return (process.env[name] ?? fallback).trim();
}

/** Server-only configuration. Never import from client components. */
export const env = {
  sessionSecret: str("SESSION_SECRET", "insecure-dev-secret"),
  llmProvider: str("AI_LLM_PROVIDER", "auto"),
  sttProvider: str("AI_STT_PROVIDER", "auto"),
  ttsProvider: str("AI_TTS_PROVIDER", "auto"),
  anthropicKey: str("ANTHROPIC_API_KEY"),
  anthropicModel: str("ANTHROPIC_MODEL", "claude-sonnet-5-5"),
  openaiKey: str("OPENAI_API_KEY"),
  openaiBaseUrl: str("OPENAI_BASE_URL", "https://api.openai.com/v1").replace(/\/$/, ""),
  openaiChatModel: str("OPENAI_CHAT_MODEL", "gpt-4o-mini"),
  openaiSttModel: str("OPENAI_STT_MODEL", "whisper-1"),
  openaiTtsModel: str("OPENAI_TTS_MODEL", "tts-1"),
  timeoutMs: num("AI_REQUEST_TIMEOUT_MS", 30000),
  maxDailyRequests: num("AI_MAX_DAILY_REQUESTS", 300),
  maxMonthlyCostCents: num("AI_MAX_MONTHLY_COST_CENTS", 1000),
  rateLimitPerMinute: num("AI_RATE_LIMIT_PER_MINUTE", 20),
  maxAudioBytes: num("MAX_AUDIO_BYTES", 10 * 1024 * 1024),
  // Rough cost estimates (US cents) used for budget enforcement only.
  llmInputCentsPer1k: num("LLM_INPUT_CENTS_PER_1K", 0.3),
  llmOutputCentsPer1k: num("LLM_OUTPUT_CENTS_PER_1K", 1.5),
  sttCentsPerMinute: num("STT_CENTS_PER_MINUTE", 0.6),
  ttsCentsPer1kChars: num("TTS_CENTS_PER_1K_CHARS", 1.5),
};
