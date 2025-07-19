import { Request, Response } from "express";
import mongoose from "mongoose";
import Chat from "../models/Chat";
import Message from "../models/Message";
import Source from "../models/Source";
import SourceChunk from "../models/SourceChunk";
import { createLLMClient, LLMMessage } from "../services/llm";
import {
  formatTimestamp,
  createYouTubeTimestampUrl,
} from "../utils/timestampUtils";
import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Create a new chat session
export async function createChat(req: Request, res: Response) {
  const { title } = req.body;
  const userId = res.locals.user?.id;

  if (!userId) {
    return res
      .status(401)
      .json({ status: "ERROR", message: "User not authenticated" });
  }

  try {
    const chat = await Chat.create({
      userId,
      title: title || "New Chat",
      sourceIds: [],
      lastActivity: new Date(),
    });

    return res.status(201).json({
      status: "OK",
      message: "Chat created successfully. Add sources to start chatting.",
      chat,
    });
  } catch (error) {
    console.error("Error creating chat:", error);
    return res
      .status(500)
      .json({ status: "ERROR", message: "Failed to create chat" });
  }
}

// Get user's chats
export async function getUserChats(req: Request, res: Response) {
  const userId = res.locals.user?.id;
  const { page = 1, limit = 20 } = req.query;

  if (!userId) {
    return res
      .status(401)
      .json({ status: "ERROR", message: "User not authenticated" });
  }

  try {
    const chats = await Chat.find({ userId, isActive: true })
      .populate("sourceIds", "title kind url")
      .sort({ lastActivity: -1 })
      .limit(Number(limit))
      .skip((Number(page) - 1) * Number(limit));

    const total = await Chat.countDocuments({ userId, isActive: true });

    return res.status(200).json({
      status: "OK",
      chats,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        pages: Math.ceil(total / Number(limit)),
      },
    });
  } catch (error) {
    console.error("Error fetching chats:", error);
    return res
      .status(500)
      .json({ status: "ERROR", message: "Failed to fetch chats" });
  }
}

// Get chat messages
export async function getChatMessages(req: Request, res: Response) {
  const { chatId } = req.params;
  const userId = res.locals.user?.id;
  const { page = 1, limit = 50 } = req.query;

  if (!userId) {
    return res
      .status(401)
      .json({ status: "ERROR", message: "User not authenticated" });
  }

  try {
    // Verify chat belongs to user
    const chat = await Chat.findOne({ _id: chatId, userId });
    if (!chat) {
      return res
        .status(404)
        .json({ status: "ERROR", message: "Chat not found" });
    }

    const messages = await Message.find({ chatId, isVisible: true })
      .populate("metadata.sourceReferences.sourceId", "title kind url")
      .sort({ createdAt: 1 })
      .limit(Number(limit))
      .skip((Number(page) - 1) * Number(limit));

    return res.status(200).json({
      status: "OK",
      messages,
      chat,
    });
  } catch (error) {
    console.error("Error fetching messages:", error);
    return res
      .status(500)
      .json({ status: "ERROR", message: "Failed to fetch messages" });
  }
}

// Send a message and get AI response
export async function sendMessage(req: Request, res: Response) {
  const { chatId } = req.params;
  const { content, provider, sourceIds } = req.body;
  const userId = res.locals.user?.id;

  if (!userId) {
    return res
      .status(401)
      .json({ status: "ERROR", message: "User not authenticated" });
  }

  if (!content) {
    return res
      .status(400)
      .json({ status: "ERROR", message: "Message content is required" });
  }

  try {
    // Verify chat belongs to user and populate sources
    const chat = await Chat.findOne({ _id: chatId, userId }).populate(
      "sourceIds"
    );
    if (!chat) {
      return res
        .status(404)
        .json({ status: "ERROR", message: "Chat not found" });
    }

    // Require sources before allowing messages
    if (!chat.sourceIds.length) {
      return res.status(400).json({
        status: "ERROR",
        message:
          "This chat has no sources yet. Add at least one source to start chatting.",
      });
    }

    // If sourceIds are provided, validate they belong to this chat
    if (sourceIds && sourceIds.length > 0) {
      const chatSourceIdStrings = chat.sourceIds.map((id: any) =>
        typeof id === "object" && id._id ? id._id.toString() : id.toString()
      );
      const invalidIds = sourceIds.filter(
        (id: string) => !chatSourceIdStrings.includes(id)
      );
      if (invalidIds.length > 0) {
        return res.status(400).json({
          status: "ERROR",
          message:
            "Some of the provided source IDs do not belong to this chat.",
        });
      }
    }

    // Save user message
    const userMessage = await Message.create({
      chatId,
      role: "user",
      content,
      isVisible: true,
    });

    // Get relevant source chunks for RAG using MongoDB Vector Search
    // Convert ObjectIds to strings for the RAG function
    const sourceIdStrings = chat.sourceIds.map((id: any) => id.toString());
    const relevantChunks = await getRelevantChunks(content, sourceIdStrings);

    // Generate AI response
    const aiResponse = await generateAIResponse(
      content,
      relevantChunks,
      chatId,
      provider
    );

    // Save AI message
    const aiMessage = await Message.create({
      chatId,
      role: "assistant",
      content: aiResponse.content,
      metadata: {
        sourceReferences: aiResponse.sourceReferences,
        model: aiResponse.model,
        tokenCount: aiResponse.tokenCount,
      },
      isVisible: true,
    });

    // Update chat activity (no need to add videoIds since they're managed by sources)
    await Chat.findByIdAndUpdate(chatId, { lastActivity: new Date() });

    return res.status(201).json({
      status: "OK",
      userMessage,
      aiMessage,
    });
  } catch (error: any) {
    console.error("Error sending message:", error);
    return res.status(500).json({
      status: "ERROR",
      message: "Failed to send message",
      error: error.message,
    });
  }
}

// Stream AI response with real-time updates
export async function streamMessage(req: Request, res: Response) {
  const { chatId } = req.params;
  const { content, provider, sourceIds } = req.body;
  const userId = res.locals.user?.id;

  if (!userId) {
    return res
      .status(401)
      .json({ status: "ERROR", message: "User not authenticated" });
  }

  if (!content) {
    return res
      .status(400)
      .json({ status: "ERROR", message: "Message content is required" });
  }

  try {
    // Verify chat belongs to user and populate sources
    const chat = await Chat.findOne({ _id: chatId, userId }).populate(
      "sourceIds"
    );
    if (!chat) {
      return res
        .status(404)
        .json({ status: "ERROR", message: "Chat not found" });
    }

    // Require sources before allowing messages
    if (!chat.sourceIds.length) {
      return res.status(400).json({
        status: "ERROR",
        message:
          "This chat has no sources yet. Add at least one source to start chatting.",
      });
    }

    // If sourceIds are provided, validate they belong to this chat
    if (sourceIds && sourceIds.length > 0) {
      const chatSourceIdStrings = chat.sourceIds.map((id: any) =>
        typeof id === "object" && id._id ? id._id.toString() : id.toString()
      );
      const invalidIds = sourceIds.filter(
        (id: string) => !chatSourceIdStrings.includes(id)
      );
      if (invalidIds.length > 0) {
        return res.status(400).json({
          status: "ERROR",
          message:
            "Some of the provided source IDs do not belong to this chat.",
        });
      }
    }

    // Set up SSE headers
    res.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers":
        "Content-Type, Authorization, Cache-Control",
    });

    // Save user message
    const userMessage = await Message.create({
      chatId,
      role: "user",
      content,
      isVisible: true,
    });

    // Send user message event
    res.write(
      `data: ${JSON.stringify({
        type: "user_message",
        message: userMessage,
      })}\n\n`
    );

    // Get relevant source chunks
    // Use sourceIds from request if provided, otherwise use all chat sources
    const sourceIdStrings =
      sourceIds && sourceIds.length > 0
        ? sourceIds // Frontend already sends string IDs
        : chat.sourceIds.map((id: any) => {
            // Handle both populated Source objects and ObjectIds for fallback
            return typeof id === "object" && id._id
              ? id._id.toString()
              : id.toString();
          });
    const relevantChunks = await getRelevantChunks(content, sourceIdStrings);

    // Send context event
    res.write(
      `data: ${JSON.stringify({
        type: "context",
        chunks: relevantChunks.length,
      })}\n\n`
    );

    // Stream AI response
    await streamAIResponse(
      content,
      relevantChunks,
      chatId,
      provider,
      res,
      userMessage._id
    );

    // Update chat activity (no need to add videoIds since they're managed by sources)
    await Chat.findByIdAndUpdate(chatId, { lastActivity: new Date() });

    res.end();
  } catch (error: any) {
    console.error("Error streaming message:", error);
    res.write(
      `data: ${JSON.stringify({
        type: "error",
        message: "Failed to generate response",
      })}\n\n`
    );
    res.end();
  }
}

// Delete a chat
export async function deleteChat(req: Request, res: Response) {
  const { chatId } = req.params;
  const userId = res.locals.user?.id;

  if (!userId) {
    return res
      .status(401)
      .json({ status: "ERROR", message: "User not authenticated" });
  }

  try {
    const chat = await Chat.findOne({ _id: chatId, userId });
    if (!chat) {
      return res
        .status(404)
        .json({ status: "ERROR", message: "Chat not found" });
    }

    // Soft delete the chat
    await Chat.findByIdAndUpdate(chatId, { isActive: false });

    // Optionally, also hide all messages in the chat
    await Message.updateMany({ chatId }, { isVisible: false });

    return res.status(200).json({
      status: "OK",
      message: "Chat deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting chat:", error);
    return res
      .status(500)
      .json({ status: "ERROR", message: "Failed to delete chat" });
  }
}

// Helper function to get relevant source chunks using MongoDB Vector Search
async function getRelevantChunks(
  query: string,
  sourceIds?: string[]
): Promise<any[]> {
  try {
    // Generate embedding for search query using OpenAI
    const embedding = await openai.embeddings.create({
      model: "text-embedding-3-small",
      input: query,
    });

    const queryEmbedding = embedding.data[0].embedding;

    // Build aggregation pipeline for vector search with conditional filter
    const vectorSearchStage: any = {
      $vectorSearch: {
        index: "vector_index",
        path: "embedding",
        queryVector: queryEmbedding,
        numCandidates: 500,
        limit: 10,
      },
    };

    // Only add source filter if sourceIds array has content
    if (sourceIds && sourceIds.length > 0) {
      // Convert string IDs to ObjectIds with validation
      const validIds = sourceIds.filter((id: string) => {
        // Check if the ID is a valid ObjectId string (24 hex characters)
        return id && typeof id === "string" && /^[0-9a-fA-F]{24}$/.test(id);
      });

      if (validIds.length > 0) {
        const objectIds = validIds.map(
          (id: string) => new mongoose.Types.ObjectId(id)
        );
        vectorSearchStage.$vectorSearch.filter = {
          sourceId: { $in: objectIds },
        };
      }
    }

    const pipeline: any[] = [
      vectorSearchStage,
      {
        $addFields: {
          score: { $meta: "vectorSearchScore" },
        },
      },
    ];

    // Add population stage for source details
    pipeline.push(
      {
        $lookup: {
          from: "sources",
          localField: "sourceId",
          foreignField: "_id",
          as: "source",
        },
      },
      {
        $unwind: "$source",
      },
      {
        $project: {
          embedding: 0, // Exclude embedding field from response
        },
      }
    );

    // Execute vector search
    const chunks = await SourceChunk.aggregate(pipeline);

    return chunks;
  } catch (error) {
    console.error("Error getting relevant chunks:", error);
    return [];
  }
}

// Helper function to generate AI response using RAG
async function generateAIResponse(
  userQuery: string,
  relevantChunks: any[],
  chatId: string,
  provider?: string
) {
  try {
    // Get recent chat history for context
    const recentMessages = await Message.find({ chatId, isVisible: true })
      .sort({ createdAt: -1 })
      .limit(10);

    // Build context from relevant chunks with timestamps for AV content
    const context = relevantChunks
      .map((chunk, index) => {
        let contextInfo = `[Segment ${index + 1}] From ${
          chunk.source.kind
        } source "${chunk.source.title || "Untitled"}"`;

        // Add timestamp info for YouTube content
        if (chunk.source.kind === "youtube" && chunk.startTime !== undefined) {
          const timestampFormatted = formatTimestamp(chunk.startTime);
          const videoId =
            chunk.source.metadata?.videoId ||
            chunk.source.url?.split("v=")[1]?.split("&")[0];
          if (videoId) {
            const youtubeUrl = createYouTubeTimestampUrl(
              videoId,
              chunk.startTime
            );
            contextInfo += ` at ${timestampFormatted} (${youtubeUrl})`;
          }
        }

        contextInfo += ` - Relevance: ${(chunk.score * 100).toFixed(1)}%`;

        // Add confidence info if available
        if (chunk.metadata?.noSpeechProb !== undefined) {
          contextInfo += ` - Confidence: ${(
            (1 - chunk.metadata.noSpeechProb) *
            100
          ).toFixed(1)}%`;
        }

        return `${contextInfo}: ${chunk.text}`;
      })
      .join("\n\n");

    // Build conversation history
    const conversationHistory = recentMessages.reverse().map((msg: any) => ({
      role: msg.role,
      content: msg.content,
    }));

    // Build reference examples from actual chunks
    const referenceExamples = relevantChunks
      .map((chunk, index) => {
        if (chunk.source.kind === "youtube" && chunk.startTime !== undefined) {
          const videoId =
            chunk.source.metadata?.videoId ||
            chunk.source.url?.split("v=")[1]?.split("&")[0];
          if (videoId) {
            return `[📺 ${index + 1}](video://${videoId}/${Math.floor(
              chunk.startTime
            )})`;
          }
        }
        return `[📄 ${index + 1}](source://${chunk.source._id})`;
      })
      .slice(0, 2)
      .join(" and ");

    // Create enhanced system prompt
    const systemPrompt = `You are a helpful AI assistant that answers questions about YouTube videos using the provided context from video transcripts.

Context from relevant video segments:
${context}

Instructions:
- Answer the user's question based on the provided video context from precise Whisper transcription segments
- When referencing specific video segments, use this EXACT format for clickable video references:
  [📺 X](video://VIDEO_ID/TIMESTAMP_IN_SECONDS)
  Where X is just the segment number (1, 2, 3, etc.), VIDEO_ID is the YouTube video ID, and TIMESTAMP_IN_SECONDS is the start time in seconds
- For example: [📺 2](video://dQw4w9WgXcQ/84) for a reference at 1:24
- Always include the video emoji (📺) and just the number for clean, minimal references
- You can also mention the formatted timestamp in text for clarity: "at 14:31" or "(14:31)"
- Include relevance scores and transcription confidence when citing sources
- If the context doesn't contain sufficient information, acknowledge this limitation
- Be concise but informative in your responses
- When referencing multiple videos, distinguish between them clearly
- Use the precise timestamps provided rather than approximate times
- If asked about topics not covered in the context, suggest what additional videos might be helpful

Example reference format for this query:
"The video discusses topics at ${referenceExamples}."`;

    const messages: LLMMessage[] = [
      { role: "system", content: systemPrompt },
      ...conversationHistory.slice(-8), // Keep last 8 messages for context
      { role: "user", content: userQuery },
    ];

    // Use the moved LLM implementation
    const llmClient = createLLMClient(provider as any);
    let responseContent = "";

    await llmClient.streamChat(
      messages,
      (delta: string) => {
        responseContent += delta;
      },
      {
        temperature: 0.7,
        // maxTokens: 500,
        stream: false,
      }
    );

    const content = responseContent;

    // Prepare source references with precise timestamps and confidence metrics
    const sourceReferences = relevantChunks.map((chunk) => ({
      sourceId: chunk.source._id,
      chunkIds: [chunk._id],
      timestamps: chunk.startTime !== undefined ? [chunk.startTime] : [],
      timestampFormatted:
        chunk.startTime !== undefined ? formatTimestamp(chunk.startTime) : "",
      youtubeUrl:
        chunk.source.kind === "youtube" && chunk.startTime !== undefined
          ? createYouTubeTimestampUrl(
              chunk.source.metadata?.videoId ||
                chunk.source.url?.split("v=")[1]?.split("&")[0],
              chunk.startTime
            )
          : "",
      relevanceScore: chunk.score,
      confidenceMetrics: {
        avgLogProb: chunk.metadata?.avgLogProb,
        noSpeechProb: chunk.metadata?.noSpeechProb,
        compressionRatio: chunk.metadata?.compressionRatio,
      },
    }));

    return {
      content,
      sourceReferences,
      tokenCount: responseContent.length, // Estimate token count
      model: provider || "openai",
    };
  } catch (error) {
    console.error("Error generating AI response:", error);
    return {
      content: "Sorry, I encountered an error while processing your request.",
      sourceReferences: [],
      tokenCount: 0,
      model: "unknown",
    };
  }
}

// Helper function to stream AI response with real-time updates
async function streamAIResponse(
  userQuery: string,
  relevantChunks: any[],
  chatId: string,
  provider: string = "openai",
  res: Response,
  userMessageId: any
) {
  try {
    // Get recent chat history for context
    const recentMessages = await Message.find({ chatId, isVisible: true })
      .sort({ createdAt: -1 })
      .limit(10);

    // Build context from relevant chunks with timestamps for AV content
    const context = relevantChunks
      .map((chunk, index) => {
        let contextInfo = `[Segment ${index + 1}] From ${
          chunk.source.kind
        } source "${chunk.source.title || "Untitled"}"`;

        // Add timestamp info for YouTube content
        if (chunk.source.kind === "youtube" && chunk.startTime !== undefined) {
          const timestampFormatted = formatTimestamp(chunk.startTime);
          const videoId =
            chunk.source.metadata?.videoId ||
            chunk.source.url?.split("v=")[1]?.split("&")[0];
          if (videoId) {
            const youtubeUrl = createYouTubeTimestampUrl(
              videoId,
              chunk.startTime
            );
            contextInfo += ` at ${timestampFormatted} (${youtubeUrl})`;
          }
        }

        contextInfo += ` - Relevance: ${(chunk.score * 100).toFixed(1)}%`;

        // Add confidence info if available
        if (chunk.metadata?.noSpeechProb !== undefined) {
          contextInfo += ` - Confidence: ${(
            (1 - chunk.metadata.noSpeechProb) *
            100
          ).toFixed(1)}%`;
        }

        return `${contextInfo}: ${chunk.text}`;
      })
      .join("\n\n");

    // Build conversation history
    const conversationHistory = recentMessages.reverse().map((msg: any) => ({
      role: msg.role,
      content: msg.content,
    }));

    // Build reference examples from actual chunks
    const referenceExamples = relevantChunks
      .map((chunk, index) => {
        if (chunk.source.kind === "youtube" && chunk.startTime !== undefined) {
          const videoId =
            chunk.source.metadata?.videoId ||
            chunk.source.url?.split("v=")[1]?.split("&")[0];
          if (videoId) {
            return `[📺 ${index + 1}](video://${videoId}/${Math.floor(
              chunk.startTime
            )})`;
          }
        }
        return `[📄 ${index + 1}](source://${chunk.source._id})`;
      })
      .slice(0, 2)
      .join(" and ");

    // Create enhanced system prompt
    const systemPrompt = `You are a helpful AI assistant that answers questions about YouTube videos using the provided context from video transcripts.

Context from relevant video segments:
${context}

Instructions:
- Answer the user's question based on the provided video context from precise Whisper transcription segments
- When referencing specific video segments, use this EXACT format for clickable video references:
  [📺 X](video://VIDEO_ID/TIMESTAMP_IN_SECONDS)
  Where X is just the segment number (1, 2, 3, etc.), VIDEO_ID is the YouTube video ID, and TIMESTAMP_IN_SECONDS is the start time in seconds
- For example: [📺 2](video://dQw4w9WgXcQ/84) for a reference at 1:24
- Always include the video emoji (📺) and just the number for clean, minimal references
- You can also mention the formatted timestamp in text for clarity: "at 14:31" or "(14:31)"
- Include relevance scores and transcription confidence when citing sources
- If the context doesn't contain sufficient information, acknowledge this limitation
- Be concise but informative in your responses
- When referencing multiple videos, distinguish between them clearly
- Use the precise timestamps provided rather than approximate times
- If asked about topics not covered in the context, suggest what additional videos might be helpful

Example reference format for this query:
"The video discusses topics at ${referenceExamples}."`;

    const messages: LLMMessage[] = [
      { role: "system", content: systemPrompt },
      ...conversationHistory.slice(-8),
      { role: "user", content: userQuery },
    ];

    // Create temporary AI message
    const tempAiMessage = await Message.create({
      chatId,
      role: "assistant",
      content: "",
      isVisible: true,
    });

    // Send start event
    res.write(
      `data: ${JSON.stringify({
        type: "start",
        messageId: tempAiMessage._id,
      })}\n\n`
    );

    // Use LLM client for streaming
    const llmClient = createLLMClient(provider as any);
    let fullContent = "";

    await llmClient.streamChat(
      messages,
      (delta: string) => {
        fullContent += delta;

        // Send delta event
        res.write(
          `data: ${JSON.stringify({
            type: "delta",
            content: delta,
            messageId: tempAiMessage._id,
          })}\n\n`
        );
      },
      {
        temperature: 0.7,
        stream: true,
      }
    );

    // Prepare source references
    const sourceReferences = relevantChunks.map((chunk) => ({
      sourceId: chunk.source._id,
      chunkIds: [chunk._id],
      timestamps: chunk.startTime !== undefined ? [chunk.startTime] : [],
      timestampFormatted:
        chunk.startTime !== undefined ? formatTimestamp(chunk.startTime) : "",
      youtubeUrl:
        chunk.source.kind === "youtube" && chunk.startTime !== undefined
          ? createYouTubeTimestampUrl(
              chunk.source.metadata?.videoId ||
                chunk.source.url?.split("v=")[1]?.split("&")[0],
              chunk.startTime
            )
          : "",
      relevanceScore: chunk.score,
      confidenceMetrics: {
        avgLogProb: chunk.metadata?.avgLogProb,
        noSpeechProb: chunk.metadata?.noSpeechProb,
        compressionRatio: chunk.metadata?.compressionRatio,
      },
    }));

    // Update message with final content and metadata
    await Message.findByIdAndUpdate(tempAiMessage._id, {
      content: fullContent,
      metadata: {
        sourceReferences,
        model: provider,
        tokenCount: fullContent.length,
      },
    });

    // Get the updated message to send with completion event
    const finalMessage = await Message.findById(tempAiMessage._id);

    // Send completion event
    res.write(
      `data: ${JSON.stringify({
        type: "complete",
        message: finalMessage,
        messageId: tempAiMessage._id,
        sourceReferences,
        model: provider,
        tokenCount: fullContent.length,
      })}\n\n`
    );
  } catch (error) {
    console.error("Error streaming AI response:", error);
    res.write(
      `data: ${JSON.stringify({
        type: "error",
        message: "Failed to generate response",
      })}\n\n`
    );
  }
}
