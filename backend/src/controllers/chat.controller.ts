import { Request, Response } from "express";
import Chat from "../models/Chat";
import Message from "../models/Message";
import Video from "../models/Video";
import VideoChunk from "../models/VideoChunk";
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
  const { title, videoId } = req.body;
  const userId = res.locals.user?.id;

  if (!userId) {
    return res
      .status(401)
      .json({ status: "ERROR", message: "User not authenticated" });
  }

  try {
    let videoObjectId;
    if (videoId) {
      const video = await Video.findOne({ videoId });
      if (!video) {
        return res
          .status(404)
          .json({ status: "ERROR", message: "Video not found" });
      }
      videoObjectId = video._id;
    }

    const chat = await Chat.create({
      userId,
      title: title || "New Chat",
      videoIds: videoObjectId ? [videoObjectId] : [],
      lastActivity: new Date(),
    });

    return res.status(201).json({
      status: "OK",
      message: "Chat created successfully",
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
      .populate("videoIds", "title channelName videoId thumbnailUrl")
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
      .populate("metadata.videoReferences.videoId", "title channelName videoId")
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
  const { content, videoIds, provider } = req.body;
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
    // Verify chat belongs to user
    const chat = await Chat.findOne({ _id: chatId, userId });
    if (!chat) {
      return res
        .status(404)
        .json({ status: "ERROR", message: "Chat not found" });
    }

    // Save user message
    const userMessage = await Message.create({
      chatId,
      role: "user",
      content,
      isVisible: true,
    });

    // Get relevant video chunks for RAG using MongoDB Vector Search
    const relevantChunks = await getRelevantChunks(content, videoIds);

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
        videoReferences: aiResponse.videoReferences,
        model: aiResponse.model,
        tokenCount: aiResponse.tokenCount,
      },
      isVisible: true,
    });

    // Update chat activity and add video references
    const updateData: any = { lastActivity: new Date() };
    if (videoIds && videoIds.length > 0) {
      const videos = await Video.find({ videoId: { $in: videoIds } });
      const videoObjectIds = videos.map((v) => v._id);
      const newVideoIds = videoObjectIds.filter(
        (id) =>
          !chat.videoIds.some(
            (existingId) => existingId.toString() === (id as any).toString()
          )
      );
      if (newVideoIds.length > 0) {
        updateData.$addToSet = { videoIds: { $each: newVideoIds } };
      }
    }
    await Chat.findByIdAndUpdate(chatId, updateData);

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
  const { content, videoIds, provider } = req.body;
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
    // Verify chat belongs to user
    const chat = await Chat.findOne({ _id: chatId, userId });
    if (!chat) {
      return res
        .status(404)
        .json({ status: "ERROR", message: "Chat not found" });
    }

    // Set up SSE headers
    res.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "Cache-Control",
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

    // Get relevant video chunks
    const relevantChunks = await getRelevantChunks(content, videoIds);

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

    // Update chat activity
    const updateData: any = { lastActivity: new Date() };
    if (videoIds && videoIds.length > 0) {
      const videos = await Video.find({ videoId: { $in: videoIds } });
      const videoObjectIds = videos.map((v) => v._id);
      const newVideoIds = videoObjectIds.filter(
        (id) =>
          !chat.videoIds.some(
            (existingId) => existingId.toString() === (id as any).toString()
          )
      );
      if (newVideoIds.length > 0) {
        updateData.$addToSet = { videoIds: { $each: newVideoIds } };
      }
    }
    await Chat.findByIdAndUpdate(chatId, updateData);

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

// Helper function to get relevant video chunks using MongoDB Vector Search
async function getRelevantChunks(
  query: string,
  videoIds?: string[]
): Promise<any[]> {
  try {
    // Generate embedding for search query using OpenAI
    const embedding = await openai.embeddings.create({
      model: "text-embedding-3-small",
      input: query,
    });

    const queryEmbedding = embedding.data[0].embedding;

    // Build aggregation pipeline for vector search
    const pipeline: any[] = [
      {
        $vectorSearch: {
          index: "vector_index",
          path: "embedding",
          queryVector: queryEmbedding,
          numCandidates: 50,
          limit: 3,
        },
      },
      {
        $addFields: {
          score: { $meta: "vectorSearchScore" },
        },
      },
    ];

    // Add video filter if specified
    if (videoIds && videoIds.length > 0) {
      const videos = await Video.find({ videoId: { $in: videoIds } });
      const videoObjectIds = videos.map((v) => v._id);
      if (videoObjectIds.length > 0) {
        pipeline.unshift({
          $match: { videoId: { $in: videoObjectIds } },
        });
      }
    }

    // Add population stage for video details
    pipeline.push(
      {
        $lookup: {
          from: "videos",
          localField: "videoId",
          foreignField: "_id",
          as: "video",
        },
      },
      {
        $unwind: "$video",
      },
      {
        $project: {
          embedding: 0, // Exclude embedding field from response
        },
      }
    );

    // Execute vector search
    const chunks = await VideoChunk.aggregate(pipeline);
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

    // Build context from relevant chunks with precise timestamps
    const context = relevantChunks
      .map((chunk, index) => {
        const timestampFormatted = formatTimestamp(chunk.startTime);
        const youtubeUrl = createYouTubeTimestampUrl(
          chunk.video.videoId,
          chunk.startTime
        );

        return `[Segment ${index + 1}] From video "${chunk.video.title}" (${
          chunk.video.channelName
        }) at ${timestampFormatted} (${youtubeUrl}) - Relevance: ${(
          chunk.score * 100
        ).toFixed(1)}%${
          chunk.noSpeechProb
            ? ` - Confidence: ${((1 - chunk.noSpeechProb) * 100).toFixed(1)}%`
            : ""
        }: ${chunk.text}`;
      })
      .join("\n\n");

    // Build conversation history
    const conversationHistory = recentMessages.reverse().map((msg: any) => ({
      role: msg.role,
      content: msg.content,
    }));

    // Create enhanced system prompt
    const systemPrompt = `You are a helpful AI assistant that answers questions about YouTube videos using the provided context from video transcripts.

Context from relevant video segments:
${context}

Instructions:
- Answer the user's question based on the provided video context from precise Whisper transcription segments
- Reference specific video titles and exact timestamps (HH:MM:SS format) when relevant
- Include YouTube URLs with timestamps when citing specific moments
- If the context doesn't contain sufficient information, acknowledge this limitation
- Be concise but informative in your responses
- When referencing multiple videos, distinguish between them clearly
- Include relevance scores and transcription confidence when citing sources
- Use the precise timestamps provided rather than approximate times
- If asked about topics not covered in the context, suggest what additional videos might be helpful`;

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

    // Prepare video references with precise timestamps and confidence metrics
    const videoReferences = relevantChunks.map((chunk) => ({
      videoId: chunk.video._id,
      chunkIds: [chunk._id],
      timestamps: [chunk.startTime],
      timestampFormatted: formatTimestamp(chunk.startTime),
      youtubeUrl: createYouTubeTimestampUrl(
        chunk.video.videoId,
        chunk.startTime
      ),
      relevanceScore: chunk.score,
      confidenceMetrics: {
        avgLogProb: chunk.avgLogProb,
        noSpeechProb: chunk.noSpeechProb,
        compressionRatio: chunk.compressionRatio,
      },
    }));

    return {
      content,
      videoReferences,
      tokenCount: responseContent.length, // Estimate token count
      model: provider || "openai",
    };
  } catch (error) {
    console.error("Error generating AI response:", error);
    return {
      content: "Sorry, I encountered an error while processing your request.",
      videoReferences: [],
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

    // Build context from relevant chunks
    const context = relevantChunks
      .map((chunk, index) => {
        const timestampFormatted = formatTimestamp(chunk.startTime);
        const youtubeUrl = createYouTubeTimestampUrl(
          chunk.video.videoId,
          chunk.startTime
        );

        return `[Segment ${index + 1}] From video "${chunk.video.title}" (${
          chunk.video.channelName
        }) at ${timestampFormatted} (${youtubeUrl}) - Relevance: ${(
          chunk.score * 100
        ).toFixed(1)}%${
          chunk.noSpeechProb
            ? ` - Confidence: ${((1 - chunk.noSpeechProb) * 100).toFixed(1)}%`
            : ""
        }: ${chunk.text}`;
      })
      .join("\n\n");

    // Build conversation history
    const conversationHistory = recentMessages.reverse().map((msg: any) => ({
      role: msg.role,
      content: msg.content,
    }));

    // Create enhanced system prompt
    const systemPrompt = `You are a helpful AI assistant that answers questions about YouTube videos using the provided context from video transcripts.

Context from relevant video segments:
${context}

Instructions:
- Answer the user's question based on the provided video context from precise Whisper transcription segments
- Reference specific video titles and exact timestamps (HH:MM:SS format) when relevant
- Include YouTube URLs with timestamps when citing specific moments
- If the context doesn't contain sufficient information, acknowledge this limitation
- Be concise but informative in your responses
- When referencing multiple videos, distinguish between them clearly
- Include relevance scores and transcription confidence when citing sources
- Use the precise timestamps provided rather than approximate times
- If asked about topics not covered in the context, suggest what additional videos might be helpful`;

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

    // Prepare video references
    const videoReferences = relevantChunks.map((chunk) => ({
      videoId: chunk.video._id,
      chunkIds: [chunk._id],
      timestamps: [chunk.startTime],
      timestampFormatted: formatTimestamp(chunk.startTime),
      youtubeUrl: createYouTubeTimestampUrl(
        chunk.video.videoId,
        chunk.startTime
      ),
      relevanceScore: chunk.score,
      confidenceMetrics: {
        avgLogProb: chunk.avgLogProb,
        noSpeechProb: chunk.noSpeechProb,
        compressionRatio: chunk.compressionRatio,
      },
    }));

    // Update message with final content and metadata
    await Message.findByIdAndUpdate(tempAiMessage._id, {
      content: fullContent,
      metadata: {
        videoReferences,
        model: provider,
        tokenCount: fullContent.length,
      },
    });

    // Send completion event
    res.write(
      `data: ${JSON.stringify({
        type: "complete",
        messageId: tempAiMessage._id,
        videoReferences,
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
