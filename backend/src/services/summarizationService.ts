import { createLLMClient } from "./llm/factory";
import {
  LLMMessage,
  parseStructuredLLMResponse,
  validateAndSanitizeFields,
} from "./llm";
import Source from "../models/Source";
import SourceChunk from "../models/SourceChunk";
import mongoose from "mongoose";
import { createSummarizationPrompt } from "@/prompts/summarization";

export interface SummarizationResult {
  title: string;
  summary: string;
  emoji: string;
}

/**
 * Generate a title, summary, and emoji for a chat based on its first source
 */
export async function summarizeSource(
  sourceId: string,
  provider: string = "openai"
): Promise<SummarizationResult> {
  console.log(
    `📝 [SUMMARIZATION] Starting summarization for source: ${sourceId}`
  );

  // Get the source details
  const source = await Source.findById(sourceId);
  if (!source) {
    throw new Error(`Source not found: ${sourceId}`);
  }

  // Get the first ~2K tokens of transcript from the source chunks
  const chunks = await SourceChunk.find({
    sourceId: new mongoose.Types.ObjectId(sourceId),
  })
    .sort({ chunkIndex: 1 })
    .limit(25); // Get first 25 chunks to have enough context

  if (chunks.length === 0) {
    throw new Error(`No chunks found for source: ${sourceId}`);
  }

  // Combine the first chunks to get transcript content
  const transcriptContent = chunks
    .map((chunk) => chunk.text)
    .join(" ")
    .substring(0, 8000); // Limit to ~2K tokens (roughly 8K characters)

  console.log(
    `📝 [SUMMARIZATION] Processing ${transcriptContent.length} characters from ${chunks.length} chunks`
  );

  // Create the prompt for summarization
  const prompt = createSummarizationPrompt(transcriptContent);

  const messages: LLMMessage[] = [
    { role: "system", content: prompt },
    {
      role: "user",
      content:
        "Please analyze this content and provide the title, summary, and emoji as requested.",
    },
  ];

  // Use LLM client to generate the response
  const llmClient = createLLMClient(provider as any);
  let response = "";

  await llmClient.streamChat(
    messages,
    (delta: string) => {
      response += delta;
    },
    {
      temperature: 0.3,
      stream: false,
    }
  );

  console.log(`📝 [SUMMARIZATION] Generated response: ${response}`);

  // Parse the structured response
  const fallbackData: Partial<SummarizationResult> = {
    title: "Untitled Content",
    summary: "Content summary not available.",
    emoji: "📄",
  };

  const parseResult = parseStructuredLLMResponse<SummarizationResult>(
    response,
    fallbackData
  );

  if (!parseResult.success) {
    console.warn(
      `📝 [SUMMARIZATION] Failed to parse response, using fallback data`
    );
  }

  console.log(`📝 [SUMMARIZATION] Final result:`, parseResult);

  return parseResult.data!;
}
