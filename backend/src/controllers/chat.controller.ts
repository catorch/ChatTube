import { Request, Response } from "express";
import Chat from "../models/Chat";
import Message from "../models/Message";
import Video from "../models/Video";
import VideoChunk from "../models/VideoChunk";
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
  const { content, videoId } = req.body;
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
    const relevantChunks = await getRelevantChunks(content, videoId);

    // Generate AI response
    const aiResponse = await generateAIResponse(
      content,
      relevantChunks,
      chatId
    );

    // Save AI message
    const aiMessage = await Message.create({
      chatId,
      role: "assistant",
      content: aiResponse.content,
      metadata: {
        videoReferences: aiResponse.videoReferences,
        model: "gpt-4",
        tokenCount: aiResponse.tokenCount,
      },
      isVisible: true,
    });

    // Update chat activity and add video references
    const updateData: any = { lastActivity: new Date() };
    if (videoId && !chat.videoIds.includes(videoId)) {
      const video = await Video.findOne({ videoId });
      if (video) {
        updateData.$addToSet = { videoIds: video._id };
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
  videoId?: string
): Promise<any[]> {
  try {
    // Generate embedding for the query
    const embedding = await openai.embeddings.create({
      model: "text-embedding-ada-002",
      input: query,
    });

    const queryEmbedding = embedding.data[0].embedding;

    // Build aggregation pipeline for vector search
    const pipeline: any[] = [
      {
        $vectorSearch: {
          index: "vector_index", // MongoDB Atlas Vector Search index
          path: "embedding",
          queryVector: queryEmbedding,
          numCandidates: 50,
          limit: 3, // Top 3 most relevant chunks
        },
      },
      {
        $addFields: {
          score: { $meta: "vectorSearchScore" },
        },
      },
    ];

    // Add video filter if specified
    if (videoId) {
      const video = await Video.findOne({ videoId });
      if (video) {
        pipeline.unshift({
          $match: { videoId: video._id },
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
  chatId: string
) {
  try {
    // Get recent chat history for context
    const recentMessages = await Message.find({ chatId, isVisible: true })
      .sort({ createdAt: -1 })
      .limit(10);

    // Build context from relevant chunks with scores
    const context = relevantChunks
      .map(
        (chunk, index) =>
          `[Chunk ${index + 1}] From video "${chunk.video.title}" (${
            chunk.video.channelName
          }) at ${Math.floor(chunk.startTime)}s (relevance: ${(
            chunk.score * 100
          ).toFixed(1)}%): ${chunk.text}`
      )
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
- Answer the user's question based on the provided video context
- Reference specific video titles and timestamps when relevant
- If the context doesn't contain sufficient information, acknowledge this limitation
- Be concise but informative in your responses
- When referencing multiple videos, distinguish between them clearly
- Include the relevance scores in parentheses when citing sources
- If asked about topics not covered in the context, suggest what additional videos might be helpful`;

    const messages = [
      { role: "system", content: systemPrompt },
      ...conversationHistory.slice(-8), // Keep last 8 messages for context
      { role: "user", content: userQuery },
    ];

    const completion = await openai.chat.completions.create({
      model: "gpt-4",
      messages: messages as any,
      max_tokens: 500,
      temperature: 0.7,
    });

    const content =
      completion.choices[0]?.message?.content ||
      "Sorry, I could not generate a response.";

    // Prepare video references with scores
    const videoReferences = relevantChunks.map((chunk) => ({
      videoId: chunk.video._id,
      chunkIds: [chunk._id],
      timestamps: [chunk.startTime],
      relevanceScore: chunk.score,
    }));

    return {
      content,
      videoReferences,
      tokenCount: completion.usage?.total_tokens || 0,
    };
  } catch (error) {
    console.error("Error generating AI response:", error);
    return {
      content: "Sorry, I encountered an error while processing your request.",
      videoReferences: [],
      tokenCount: 0,
    };
  }
}
