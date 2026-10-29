import "server-only";

function str(name: string, fallback = "") {
  return (process.env[name] ?? fallback).trim();
}
function num(name: string, fallback: number) {
  const v = Number(process.env[name]);
  return Number.isFinite(v) && v > 0 ? v : fallback;
}

/** Server-only configuration. Secrets never leave the server. */
export const env = {
  databaseUrl: str("DATABASE_URL", "postgresql://postgres:postgres@127.0.0.1:54322/postgres"),
  aiProvider: str("AI_PROVIDER", "auto"),
  anthropicKey: str("ANTHROPIC_API_KEY"),
  anthropicModel: str("ANTHROPIC_MODEL", "claude-sonnet-5-5"),
  openaiKey: str("OPENAI_API_KEY"),
  openaiBaseUrl: str("OPENAI_BASE_URL", "https://api.openai.com/v1").replace(/\/$/, ""),
  openaiChatModel: str("OPENAI_CHAT_MODEL", "gpt-4o-mini"),
  openaiSttModel: str("OPENAI_STT_MODEL", "whisper-1"),
  openaiTtsModel: str("OPENAI_TTS_MODEL", "tts-1"),
  aiTimeoutMs: num("AI_TIMEOUT_MS", 30000),
  maxDailyRequests: num("AI_MAX_DAILY_REQUESTS", 300),
  rateLimitPerMinute: num("AI_RATE_LIMIT_PER_MINUTE", 20),
};
