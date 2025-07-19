export type LLMRole = "system" | "user" | "assistant";

export interface LLMMessage {
  role: LLMRole;
  content: string;
}

export type ChunkHandler = (delta: string) => void;

export interface LLMConfig {
  temperature?: number;
  stream?: boolean;
  maxTokens?: number;
}

export interface LLMClient {
  /** Stream a reply. `messages` is the full chat log so far. */
  streamChat(
    messages: LLMMessage[],
    onDelta: ChunkHandler,
    config?: LLMConfig
  ): Promise<void>;
}

export type LLMProvider = "openai" | "gemini" | "claude";
