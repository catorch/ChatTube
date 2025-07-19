import { Request, Response } from 'express';
import mongoose from 'mongoose';
import Source from '../models/Source';
import SourceChunk from '../models/SourceChunk';
import Chat from '../models/Chat';
import OpenAI from "openai";
import { queueSourceForProcessing, getProcessingStatus } from '../ingestion/service';
import { isSourceTypeSupported, getSupportedSourceTypes } from '../ingestion/registry';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// List all sources for a specific chat
export async function listSources(req: Request, res: Response) {
  const { chatId } = req.params;
  const userId = res.locals.user?.id;

  if (!userId) {
    return res.status(401).json({ 
      status: 'ERROR', 
      message: 'User not authenticated' 
    });
  }

  try {
    // Verify chat belongs to user
    const chat = await Chat.findOne({ _id: chatId, userId });
    if (!chat) {
      return res.status(404).json({ 
        status: 'ERROR', 
        message: 'Chat not found' 
      });
    }

    // Get all sources for this chat
    const sources = await Source.find({ chatId })
      .sort({ createdAt: 1 });

    return res.status(200).json({ 
      status: 'OK', 
      sources 
    });
  } catch (error) {
    console.error('Error listing sources:', error);
    return res.status(500).json({ 
      status: 'ERROR', 
      message: 'Failed to list sources' 
    });
  }
}

// Add sources to a specific chat
export async function addSources(req: Request, res: Response) {
  const { chatId } = req.params;
  const { sources = [] } = req.body as { 
    sources: Array<{
      kind: 'youtube' | 'pdf' | 'web' | 'file';
      url?: string;
      title?: string;
      fileId?: string;
      metadata?: Record<string, any>;
    }>
  };
  const userId = res.locals.user?.id;

  if (!userId) {
    return res.status(401).json({ 
      status: 'ERROR', 
      message: 'User not authenticated' 
    });
  }

  if (!sources.length) {
    return res.status(400).json({ 
      status: 'ERROR', 
      message: 'No sources provided' 
    });
  }

  try {
    // Verify chat belongs to user
    const chat = await Chat.findOne({ _id: chatId, userId });
    if (!chat) {
      return res.status(404).json({ 
        status: 'ERROR', 
        message: 'Chat not found' 
      });
    }

    // Validate source types
    const supportedTypes = getSupportedSourceTypes();
    const unsupportedSources = sources.filter(s => !isSourceTypeSupported(s.kind));
    if (unsupportedSources.length > 0) {
      return res.status(400).json({
        status: 'ERROR',
        message: `Unsupported source types: ${unsupportedSources.map(s => s.kind).join(', ')}. Supported types: ${supportedTypes.join(', ')}`,
        supportedTypes
      });
    }

    // Check for existing sources to avoid duplicates (by URL where applicable)
    const urlsToCheck = sources.filter(s => s.url).map(s => s.url);
    const existingSources = await Source.find({ 
      chatId, 
      url: { $in: urlsToCheck }
    });
    const existingUrls = existingSources.map(s => s.url);

    // Filter out sources that already exist
    const newSources = sources.filter(source => 
      !source.url || !existingUrls.includes(source.url)
    );

    if (newSources.length === 0) {
      return res.status(200).json({
        status: 'OK',
        message: 'All sources already exist in this chat',
        sources: existingSources
      });
    }

    // Create Source documents with pending status
    const sourceDocs = newSources.map(source => ({
      userId,
      chatId,
      kind: source.kind,
      title: source.title || `${source.kind} source`,
      url: source.url,
      fileId: source.fileId,
      metadata: {
        ...source.metadata,
        processingStatus: 'pending',
        isProcessed: false,
        createdAt: new Date(),
      }
    }));

    const createdSources = await Source.insertMany(sourceDocs);

    // Queue sources for processing
    const processingPromises = createdSources.map(async (source) => {
      try {
        // Only queue YouTube sources for now since others aren't implemented
        if (source.kind === 'youtube') {
          await queueSourceForProcessing((source._id as any).toString());
        } else {
          // Mark non-YouTube sources as failed for now
          await Source.findByIdAndUpdate(source._id, {
            $set: {
              'metadata.processingStatus': 'failed',
              'metadata.errorMessage': `${source.kind} processing not yet implemented`,
              'metadata.failedAt': new Date(),
            },
          });
        }
      } catch (error) {
        console.error(`Error queuing source ${source._id}:`, error);
      }
    });

    // Don't wait for processing, queue in background
    Promise.all(processingPromises).catch(error => {
      console.error('Error queuing sources for processing:', error);
    });

    // Update chat with new source IDs
    await Chat.findByIdAndUpdate(chatId, {
      $addToSet: { 
        sourceIds: { $each: createdSources.map(s => s._id) }
      },
      lastActivity: new Date()
    });

    // Return all sources including existing ones
    const allSources = [...existingSources, ...createdSources];

    return res.status(201).json({
      status: 'OK',
      message: `Added ${createdSources.length} new sources to chat. Processing has been queued.`,
      sources: allSources,
      added: createdSources.length,
      existing: existingSources.length,
      processingNote: 'Sources are being processed in the background. Check their status using the source ID.'
    });

  } catch (error: any) {
    console.error('Error adding sources:', error);
    return res.status(500).json({
      status: 'ERROR',
      message: 'Failed to add sources',
      error: error.message
    });
  }
}


// Remove a specific source from a chat
export async function removeSource(req: Request, res: Response) {
  const { chatId, sourceId } = req.params;
  const userId = res.locals.user?.id;

  if (!userId) {
    return res.status(401).json({ 
      status: 'ERROR', 
      message: 'User not authenticated' 
    });
  }

  try {
    // Find and remove the source
    const source = await Source.findOneAndDelete({ 
      _id: sourceId, 
      chatId, 
      userId 
    });
    
    if (!source) {
      return res.status(404).json({ 
        status: 'ERROR', 
        message: 'Source not found' 
      });
    }

    // Update chat to remove source reference
    await Chat.findByIdAndUpdate(chatId, {
      $pull: { sourceIds: source._id },
      lastActivity: new Date()
    });

    return res.status(200).json({
      status: 'OK',
      message: 'Source removed successfully',
      removedSourceId: sourceId
    });

  } catch (error) {
    console.error('Error removing source:', error);
    return res.status(500).json({ 
      status: 'ERROR', 
      message: 'Failed to remove source' 
    });
  }
}

// Get all processed sources (admin/global view)
export async function getSources(req: Request, res: Response) {
  const { page = 1, limit = 10, kind } = req.query;

  try {
    const query: any = {};
    if (kind) {
      query.kind = kind;
    }

    const sources = await Source.find(query)
      .sort({ createdAt: -1 })
      .limit(Number(limit))
      .skip((Number(page) - 1) * Number(limit));

    const total = await Source.countDocuments(query);

    return res.status(200).json({
      status: "OK",
      sources,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        pages: Math.ceil(total / Number(limit)),
      },
    });
  } catch (error) {
    console.error("Error fetching sources:", error);
    return res
      .status(500)
      .json({ status: "ERROR", message: "Failed to fetch sources" });
  }
}

// Get source details and processing status
export async function getSource(req: Request, res: Response) {
  const { sourceId } = req.params;

  try {
    const source = await Source.findById(sourceId);
    if (!source) {
      return res
        .status(404)
        .json({ status: "ERROR", message: "Source not found" });
    }

    // Get processing status
    const processingStatus = await getProcessingStatus(sourceId);

    // Get chunk count if processed
    let chunkCount = 0;
    if (source.metadata?.isProcessed) {
      chunkCount = await SourceChunk.countDocuments({ sourceId: source._id });
    }

    return res.status(200).json({ 
      status: "OK", 
      source: {
        ...source.toObject(),
        processingStatus,
        chunkCount
      }
    });
  } catch (error) {
    console.error("Error fetching source:", error);
    return res
      .status(500)
      .json({ status: "ERROR", message: "Failed to fetch source" });
  }
}

// Get processing status for a source
export async function getSourceStatus(req: Request, res: Response) {
  const { sourceId } = req.params;

  try {
    const processingStatus = await getProcessingStatus(sourceId);
    return res.status(200).json({ 
      status: "OK", 
      processingStatus 
    });
  } catch (error) {
    console.error("Error fetching source status:", error);
    return res
      .status(500)
      .json({ status: "ERROR", message: "Failed to fetch source status" });
  }
}

// Search source chunks using MongoDB Vector Search
export async function searchSourceChunks(req: Request, res: Response) {
  const { query, sourceId, limit = 5 } = req.body;

  if (!query) {
    return res
      .status(400)
      .json({ status: "ERROR", message: "Search query is required" });
  }

  try {
    // Generate embedding for search query
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
          numCandidates: 100,
          limit: Number(limit),
        },
      },
      {
        $addFields: {
          score: { $meta: "vectorSearchScore" },
        },
      },
    ];

    // Add source filter if specified
    if (sourceId) {
      const source = await Source.findById(sourceId);
      if (source) {
        pipeline.unshift({
          $match: { sourceId: source._id },
        });
      }
    }

    // Add population stage
    pipeline.push({
      $lookup: {
        from: "sources",
        localField: "sourceId",
        foreignField: "_id",
        as: "source",
      },
    });

    pipeline.push({
      $unwind: "$source",
    });

    // Exclude embedding field from response
    pipeline.push({
      $project: {
        embedding: 0,
      },
    });

    // Execute vector search
    const chunks = await SourceChunk.aggregate(pipeline);

    return res.status(200).json({
      status: "OK",
      chunks,
      query,
    });
  } catch (error: any) {
    console.error("Error searching source chunks:", error);
    return res.status(500).json({
      status: "ERROR",
      message: "Failed to search source chunks",
      error: error.message,
    });
  }
} 