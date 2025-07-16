import { Request, Response } from "express";
import Video from "../models/Video";
import VideoChunk from "../models/VideoChunk";
import { YoutubeTranscript } from "youtube-transcript";
import OpenAI from "openai";
import AudioProcessor from "../utils/audioProcessor";
const ytdl = require("@distube/ytdl-core");

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Extract video ID from YouTube URL
function extractVideoId(url: string): string | null {
  const regex =
    /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/;
  const match = url.match(regex);
  return match ? match[1] : null;
}

// Process video: extract metadata, transcript, and create embeddings
export async function processVideo(req: Request, res: Response) {
  const { videoUrl } = req.body;

  if (!videoUrl) {
    return res
      .status(400)
      .json({ status: "ERROR", message: "Video URL is required" });
  }

  const videoId = extractVideoId(videoUrl);
  if (!videoId) {
    return res
      .status(400)
      .json({ status: "ERROR", message: "Invalid YouTube URL" });
  }

  try {
    // Check if video already exists
    let video = await Video.findOne({ videoId });
    if (video) {
      return res.status(200).json({
        status: "OK",
        message: "Video already processed",
        video,
      });
    }

    // Get video metadata
    const videoInfo = await ytdl.getInfo(videoId);
    const details = videoInfo.videoDetails;

    // Create video record
    video = await Video.create({
      videoId,
      title: details.title,
      description: details.description,
      duration: parseInt(details.lengthSeconds),
      uploadDate: new Date(details.uploadDate),
      channelName: details.author.name,
      channelId: details.author.id,
      thumbnailUrl: details.thumbnails[0]?.url,
      viewCount: parseInt(details.viewCount),
      processingStatus: "processing",
    });

    // Process transcript in background
    processTranscriptAsync((video._id as any).toString(), videoId);

    return res.status(201).json({
      status: "OK",
      message: "Video processing started",
      video,
    });
  } catch (error: any) {
    console.error("Error processing video:", error);
    return res.status(500).json({
      status: "ERROR",
      message: "Failed to process video",
      error: error.message,
    });
  }
}

// Get video details and processing status
export async function getVideo(req: Request, res: Response) {
  const { videoId } = req.params;

  try {
    const video = await Video.findOne({ videoId });
    if (!video) {
      return res
        .status(404)
        .json({ status: "ERROR", message: "Video not found" });
    }

    return res.status(200).json({ status: "OK", video });
  } catch (error) {
    console.error("Error fetching video:", error);
    return res
      .status(500)
      .json({ status: "ERROR", message: "Failed to fetch video" });
  }
}

// Get all processed videos
export async function getVideos(req: Request, res: Response) {
  const { page = 1, limit = 10, status } = req.query;

  try {
    const query: any = {};
    if (status) {
      query.processingStatus = status;
    }

    const videos = await Video.find(query)
      .sort({ createdAt: -1 })
      .limit(Number(limit))
      .skip((Number(page) - 1) * Number(limit));

    const total = await Video.countDocuments(query);

    return res.status(200).json({
      status: "OK",
      videos,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        pages: Math.ceil(total / Number(limit)),
      },
    });
  } catch (error) {
    console.error("Error fetching videos:", error);
    return res
      .status(500)
      .json({ status: "ERROR", message: "Failed to fetch videos" });
  }
}

// Search video chunks using MongoDB Vector Search
export async function searchVideoChunks(req: Request, res: Response) {
  const { query, videoId, limit = 5 } = req.body;

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

    // Add video filter if specified
    if (videoId) {
      const video = await Video.findOne({ videoId });
      if (video) {
        pipeline.unshift({
          $match: { videoId: video._id },
        });
      }
    }

    // Add population stage
    pipeline.push({
      $lookup: {
        from: "videos",
        localField: "videoId",
        foreignField: "_id",
        as: "video",
      },
    });

    pipeline.push({
      $unwind: "$video",
    });

    // Exclude embedding field from response
    pipeline.push({
      $project: {
        embedding: 0,
      },
    });

    // Execute vector search
    const chunks = await VideoChunk.aggregate(pipeline);

    return res.status(200).json({
      status: "OK",
      chunks,
      query,
    });
  } catch (error: any) {
    console.error("Error searching video chunks:", error);
    return res.status(500).json({
      status: "ERROR",
      message: "Failed to search video chunks",
      error: error.message,
    });
  }
}

// Helper function to process transcript asynchronously using Whisper API
async function processTranscriptAsync(videoObjectId: string, videoId: string) {
  const audioProcessor = new AudioProcessor();
  let tempFiles: string[] = [];

  try {
    console.log(`Starting audio processing for video ${videoId}...`);

    // Process video: download, chunk, and transcribe using Whisper API
    const { transcriptions, tempFiles: processingTempFiles } =
      await audioProcessor.processVideo(videoId);
    tempFiles = processingTempFiles;

    console.log(
      `Generated ${transcriptions.length} transcription chunks for video ${videoId}`
    );

    // Create embeddings for each transcribed segment
    let segmentCounter = 0;
    for (let i = 0; i < transcriptions.length; i++) {
      const transcription = transcriptions[i];

      // Process each segment within the transcription
      for (let j = 0; j < transcription.segments.length; j++) {
        const segment = transcription.segments[j];

        // Skip empty or very short segments
        if (!segment.text.trim() || segment.text.trim().length < 3) {
          continue;
        }

        const embedding = await openai.embeddings.create({
          model: "text-embedding-3-small",
          input: segment.text,
        });

        await VideoChunk.create({
          videoId: videoObjectId,
          chunkIndex: segmentCounter, // Global segment index across all chunks
          startTime: segment.start, // Already normalized to video timeline
          endTime: segment.end, // Already normalized to video timeline
          text: segment.text,
          embedding: embedding.data[0].embedding,
          tokenCount: segment.text.split(" ").length,
          audioSource: "whisper",
          whisperModel: "whisper-1",
          // Store Whisper-specific metadata for quality tracking
          whisperSegmentId: segment.id,
          avgLogProb: segment.avg_logprob,
          noSpeechProb: segment.no_speech_prob,
          compressionRatio: segment.compression_ratio,
        });

        segmentCounter++;
      }
    }

    // Update video status
    await Video.findByIdAndUpdate(videoObjectId, {
      processingStatus: "completed",
      isProcessed: true,
    });

    console.log(
      `Successfully processed video ${videoId} with ${segmentCounter} segments from ${transcriptions.length} audio chunks`
    );
  } catch (error) {
    console.error("Error processing video with Whisper API:", error);
    await Video.findByIdAndUpdate(videoObjectId, {
      processingStatus: "failed",
      errorMessage: error instanceof Error ? error.message : "Unknown error",
    });
  } finally {
    // Clean up temporary audio files
    if (tempFiles.length > 0) {
      console.log(`Cleaning up ${tempFiles.length} temporary files...`);
      await audioProcessor.cleanup(tempFiles);
    }
  }
}
