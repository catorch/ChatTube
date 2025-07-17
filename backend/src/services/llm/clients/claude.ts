import Anthropic from "@anthropic-ai/sdk";
import type { LLMClient, LLMMessage, ChunkHandler, LLMConfig } from "../types";

export class ClaudeClient implements LLMClient {
  private anthropic = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY,
  });

  async streamChat(
    messages: LLMMessage[],
    onDelta: ChunkHandler,
    config: LLMConfig = {}
  ) {
    const { temperature = 1.0, stream = true, maxTokens } = config;

    // 1️⃣ Extract system message (Claude supports one system message)
    const systemMessageIdx = messages.findIndex((m) => m.role === "system");
    const systemMessage =
      systemMessageIdx >= 0 ? messages[systemMessageIdx].content : "";

    // 2️⃣ Convert remaining messages to Claude format
    const conversationMessages = messages
      .filter((_, i) => i !== systemMessageIdx)
      .map((msg) => ({
        role: msg.role as "user" | "assistant",
        content: msg.content,
      }));

    // Ensure we have at least one message and it's not from assistant
    if (conversationMessages.length === 0) {
      throw new Error("At least one non-system message is required");
    }

    const messageParams: any = {
      model: "claude-sonnet-4-20250514",
      temperature,
      system: systemMessage || undefined,
      messages: conversationMessages,
    };

    // Only set max_tokens if explicitly provided
    if (maxTokens !== undefined) {
      messageParams.max_tokens = maxTokens;
    } else {
      // Claude requires max_tokens, so we set a high default if not specified
      messageParams.max_tokens = 8192;
    }

    if (stream) {
      const streamResponse = await this.anthropic.messages.create({
        ...messageParams,
        stream: true,
      });

      for await (const chunk of streamResponse as any) {
        if (
          chunk.type === "content_block_delta" &&
          chunk.delta.type === "text_delta"
        ) {
          const delta = chunk.delta.text ?? "";
          if (delta) onDelta(delta);
        }
      }
    } else {
      const response = await this.anthropic.messages.create({
        ...messageParams,
        stream: false,
      });

      // Extract text content from Claude's response format
      const contentBlocks = Array.isArray(response.content)
        ? response.content
        : [response.content];
      const content = contentBlocks
        .filter((block: any) => block.type === "text")
        .map((block: any) => block.text)
        .join("");

      if (content) onDelta(content);
    }
  }
}
