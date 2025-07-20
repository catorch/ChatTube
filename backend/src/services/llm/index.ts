// Main exports
export { createLLMClient } from "./factory";

// Types
export type {
  LLMRole,
  LLMMessage,
  ChunkHandler,
  LLMConfig,
  LLMClient,
  LLMProvider,
} from "./types";

// Utilities
export {
  parseStructuredLLMResponse,
  validateAndSanitizeFields,
  type ParsedJSONResult,
} from "./utils";

export { OpenAIClient } from "./clients/openai";
export { GeminiClient } from "./clients/gemini";
export { ClaudeClient } from "./clients/claude";
