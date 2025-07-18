import { SourceProcessor, IngestionResult } from '../types';
import { ISource } from '../../models/Source';
import AudioProcessor from '../../utils/audioProcessor';
import OpenAI from "openai";
import mongoose from 'mongoose';

const ytdl = require("@distube/ytdl-core");

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export class YoutubeProcessor implements SourceProcessor {
  private audioProcessor: AudioProcessor;

  constructor() {
    this.audioProcessor = new AudioProcessor();
  }

  async ingest(source: ISource): Promise<IngestionResult> {
    if (source.kind !== 'youtube') {
      throw new Error(`YoutubeProcessor can only process 'youtube' sources, got '${source.kind}'`);
    }

    if (!source.url) {
      throw new Error('YouTube source must have a URL');
    }

    const videoId = this.extractVideoId(source.url);
    if (!videoId) {
      throw new Error('Invalid YouTube URL format');
    }

    try {
      // Get video metadata if not already present
      let metadata = { ...source.metadata };
      
      if (!metadata.videoId || !metadata.title) {
        const videoInfo = await ytdl.getInfo(videoId);
        const details = videoInfo.videoDetails;
        
        metadata = {
          ...metadata,
          videoId,
          title: details.title,
          description: details.description,
          duration: parseInt(details.lengthSeconds),
          uploadDate: new Date(details.uploadDate),
          channelName: details.author.name,
          channelId: details.author.id,
          thumbnailUrl: details.thumbnails[0]?.url,
          viewCount: parseInt(details.viewCount),
        };
      }

      // Process audio and get transcription
      const { transcriptions, tempFiles } = await this.audioProcessor.processVideo(videoId);

      console.log(`Generated ${transcriptions.length} transcription chunks for video ${videoId}`);

      // Create chunks with embeddings
      const chunks = [];
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

          // Create embedding for the segment
          const embedding = await openai.embeddings.create({
            model: "text-embedding-3-small",
            input: segment.text,
          });

          chunks.push({
            chunkIndex: segmentCounter,
            text: segment.text,
            startTime: segment.start,
            endTime: segment.end,
            embedding: embedding.data[0].embedding,
            tokenCount: segment.text.split(" ").length,
            metadata: {
              audioSource: "whisper",
              whisperModel: "whisper-1",
              whisperSegmentId: segment.id,
              avgLogProb: segment.avg_logprob,
              noSpeechProb: segment.no_speech_prob,
              compressionRatio: segment.compression_ratio,
            },
          });

          segmentCounter++;
        }
      }

      // Clean up temporary files
      if (tempFiles.length > 0) {
        console.log(`Cleaning up ${tempFiles.length} temporary files...`);
        await this.audioProcessor.cleanup(tempFiles);
      }

      // Update metadata with processing results
      metadata.processingStatus = 'completed';
      metadata.isProcessed = true;
      metadata.chunksGenerated = chunks.length;
      metadata.processedAt = new Date();

      console.log(`Successfully processed YouTube video ${videoId} with ${segmentCounter} segments`);

      return {
        chunks: chunks.map(chunk => ({
          text: chunk.text,
          startTime: chunk.startTime,
          endTime: chunk.endTime,
          metadata: {
            ...chunk.metadata,
            chunkIndex: chunk.chunkIndex,
            tokenCount: chunk.tokenCount,
            embedding: chunk.embedding,
          }
        })),
        metadata
      };

    } catch (error) {
      console.error("Error processing YouTube video:", error);
      
      // Update metadata with error status
      const errorMetadata = {
        ...source.metadata,
        processingStatus: 'failed',
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
        failedAt: new Date(),
      };

      throw new Error(`Failed to process YouTube video: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private extractVideoId(url: string): string | null {
    const regex =
      /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/;
    const match = url.match(regex);
    return match ? match[1] : null;
  }
} 