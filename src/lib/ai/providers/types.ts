export interface LlmMessage {
  role: "user" | "assistant";
  content: string;
}

export interface LlmRequest {
  system: string;
  messages: LlmMessage[];
  maxTokens: number;
  temperature?: number;
  signal?: AbortSignal;
}

export interface LlmResponse {
  text: string;
  inputTokens: number;
  outputTokens: number;
}

export interface LlmProvider {
  name: "anthropic" | "openai";
  complete(req: LlmRequest): Promise<LlmResponse>;
}

export class ProviderError extends Error {
  constructor(
    message: string,
    public retryable: boolean,
    public status?: number,
  ) {
    super(message);
  }
}
