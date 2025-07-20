import OpenAI from "openai";
import type { LLMClient, LLMMessage, ChunkHandler, LLMConfig } from "../types";

export class OpenAIClient implements LLMClient {
  private openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  async streamChat(
    messages: LLMMessage[],
    onDelta: ChunkHandler,
    config: LLMConfig = {}
  ) {
    const { temperature = 1.0, stream = true, maxTokens } = config;

    // ↳ messages already match OpenAI's schema 1-for-1
    const completionParams: any = {
      model: "gpt-4o",
      messages,
      temperature,
      stream,
    };

    // Only set max_tokens if explicitly provided
    if (maxTokens !== undefined) {
      completionParams.max_tokens = maxTokens;
    }

    const completion = await this.openai.chat.completions.create(
      completionParams
    );

    if (stream) {
      for await (const chunk of completion as any) {
        const delta = chunk.choices?.[0]?.delta?.content ?? "";
        if (delta) onDelta(delta);
      }
    } else {
      const response = completion as any;
      const content = response.choices?.[0]?.message?.content ?? "";
      if (content) onDelta(content);
    }
  }
}
