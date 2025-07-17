import type { LLMClient, LLMProvider } from "./types";
import { OpenAIClient } from "./clients/openai";
import { GeminiClient } from "./clients/gemini";
import { ClaudeClient } from "./clients/claude";

export function createLLMClient(
  provider: LLMProvider = (process.env.LLM_PROVIDER as LLMProvider) || "openai"
): LLMClient {
  switch (provider) {
    case "openai":
      return new OpenAIClient();

    case "gemini":
      return new GeminiClient();

    case "claude":
      return new ClaudeClient();

    default:
      throw new Error(`Unsupported LLM provider: ${provider}`);
  }
}
