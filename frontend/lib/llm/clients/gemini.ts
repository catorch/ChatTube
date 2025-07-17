import { GoogleGenAI } from "@google/genai";
import type { LLMClient, LLMMessage, ChunkHandler, LLMConfig } from "../types";

export class GeminiClient implements LLMClient {
  private genAI = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });

  async streamChat(
    messages: LLMMessage[],
    onDelta: ChunkHandler,
    config: LLMConfig = {}
  ) {
    const { temperature = 1.0, stream = true, maxTokens } = config;

    // 1️⃣ Convert LLM messages to Gemini format
    const systemMessage =
      messages.find((m) => m.role === "system")?.content || "";
    const conversationMessages = messages.filter((m) => m.role !== "system");

    // Build generation config
    const generationConfig: any = { temperature };
    if (maxTokens !== undefined) {
      generationConfig.maxOutputTokens = maxTokens;
    }

    // Prepare the request with system instruction and content
    const requestConfig: any = {
      model: "gemini-2.5-pro-preview-06-05",
      contents: conversationMessages.map((msg) => ({
        role: msg.role === "assistant" ? "model" : "user",
        parts: [{ text: msg.content }],
      })),
      config: {
        generationConfig,
      },
    };

    if (systemMessage) {
      requestConfig.systemInstruction = systemMessage;
    }

    if (stream) {
      const response = await this.genAI.models.generateContentStream(
        requestConfig
      );

      for await (const chunk of response) {
        const text = chunk.text || "";
        if (text) onDelta(text);
      }
    } else {
      const response = await this.genAI.models.generateContent(requestConfig);
      const text = response.text || "";
      if (text) onDelta(text);
    }
  }
}
