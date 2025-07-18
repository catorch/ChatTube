import { SourceProcessor, IngestionResult } from "../types";
import { ISource } from "../../models/Source";
import AudioProcessor from "../../utils/audioProcessor";
import OpenAI from "openai";
import mongoose from "mongoose";
import chalk from "chalk";

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
    if (source.kind !== "youtube") {
      throw new Error(
        `YoutubeProcessor can only process 'youtube' sources, got '${source.kind}'`
      );
    }

    if (!source.url) {
      throw new Error("YouTube source must have a URL");
    }

    console.log(
      chalk.blue.bold(`🎬 [YOUTUBE] Starting YouTube video processing`)
    );
    console.log(chalk.gray(`   • URL: ${source.url}`));

    const videoId = this.extractVideoId(source.url);
    if (!videoId) {
      console.log(
        chalk.red(`❌ [YOUTUBE] Invalid YouTube URL format: ${source.url}`)
      );
      throw new Error("Invalid YouTube URL format");
    }

    console.log(chalk.green(`✅ [YOUTUBE] Extracted video ID: ${videoId}`));

    try {
      // Get video metadata if not already present
      let metadata = { ...source.metadata };

      if (!metadata.videoId || !metadata.title) {
        console.log(
          chalk.blue(`📋 [YOUTUBE] Fetching video metadata from YouTube API...`)
        );
        const metadataStartTime = Date.now();

        const videoInfo = await ytdl.getInfo(videoId);
        const details = videoInfo.videoDetails;

        const metadataDuration = Date.now() - metadataStartTime;
        console.log(
          chalk.green(`✅ [YOUTUBE] Metadata fetched in ${metadataDuration}ms`)
        );

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

        console.log(chalk.cyan(`📊 [YOUTUBE] Video details:`));
        console.log(chalk.gray(`   • Title: ${details.title}`));
        console.log(chalk.gray(`   • Channel: ${details.author.name}`));
        console.log(
          chalk.gray(
            `   • Duration: ${Math.floor(
              parseInt(details.lengthSeconds) / 60
            )}:${(parseInt(details.lengthSeconds) % 60)
              .toString()
              .padStart(2, "0")}`
          )
        );
        console.log(
          chalk.gray(
            `   • Views: ${parseInt(details.viewCount).toLocaleString()}`
          )
        );
        console.log(chalk.gray(`   • Upload Date: ${details.uploadDate}`));
      } else {
        console.log(
          chalk.yellow(
            `⚡ [YOUTUBE] Using cached metadata for video ${videoId}`
          )
        );
      }

      // Process audio and get transcription
      console.log(
        chalk.blue.bold(
          `🎵 [YOUTUBE] Starting audio processing and transcription...`
        )
      );
      const audioStartTime = Date.now();

      const { transcriptions, tempFiles } =
        await this.audioProcessor.processVideo(videoId);

      const audioDuration = Date.now() - audioStartTime;
      console.log(
        chalk.green.bold(
          `🎉 [YOUTUBE] Audio processing completed in ${audioDuration}ms`
        )
      );
      console.log(
        chalk.cyan(
          `📝 [YOUTUBE] Generated ${transcriptions.length} transcription chunks`
        )
      );

      // Create chunks with embeddings
      console.log(
        chalk.blue(
          `🔗 [YOUTUBE] Processing transcription segments and generating embeddings...`
        )
      );
      const chunks = [];
      let segmentCounter = 0;
      let embeddingCounter = 0;
      const embeddingStartTime = Date.now();

      for (let i = 0; i < transcriptions.length; i++) {
        const transcription = transcriptions[i];
        console.log(
          chalk.yellow(
            `📄 [YOUTUBE] Processing transcription chunk ${i + 1}/${
              transcriptions.length
            } (${transcription.segments.length} segments)`
          )
        );

        // Process each segment within the transcription
        for (let j = 0; j < transcription.segments.length; j++) {
          const segment = transcription.segments[j];

          // Skip empty or very short segments
          if (!segment.text.trim() || segment.text.trim().length < 3) {
            console.log(
              chalk.gray(
                `⏭️  [YOUTUBE] Skipping empty/short segment ${
                  segment.id
                }: "${segment.text.trim()}"`
              )
            );
            continue;
          }

          console.log(
            chalk.blue(
              `🧠 [YOUTUBE] Creating embedding for segment ${
                segmentCounter + 1
              }: "${segment.text.substring(0, 50)}..."`
            )
          );

          try {
            // Create embedding for the segment
            const embeddingCallStart = Date.now();
            const embedding = await openai.embeddings.create({
              model: "text-embedding-3-small",
              input: segment.text,
            });
            const embeddingCallDuration = Date.now() - embeddingCallStart;
            embeddingCounter++;

            console.log(
              chalk.green(
                `✅ [YOUTUBE] Embedding ${embeddingCounter} created in ${embeddingCallDuration}ms (${embedding.data[0].embedding.length} dimensions)`
              )
            );

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
          } catch (embeddingError) {
            console.log(
              chalk.red(
                `❌ [YOUTUBE] Failed to create embedding for segment ${segmentCounter}: ${embeddingError}`
              )
            );
            // Continue with next segment rather than failing entire process
          }
        }
      }

      const embeddingDuration = Date.now() - embeddingStartTime;
      console.log(
        chalk.green.bold(
          `🎯 [YOUTUBE] Embedding generation completed in ${embeddingDuration}ms`
        )
      );
      console.log(chalk.cyan(`📊 [YOUTUBE] Embedding stats:`));
      console.log(
        chalk.gray(`   • Total embeddings created: ${embeddingCounter}`)
      );
      console.log(
        chalk.gray(
          `   • Average time per embedding: ${Math.round(
            embeddingDuration / embeddingCounter
          )}ms`
        )
      );
      console.log(chalk.gray(`   • Final chunks: ${chunks.length}`));

      // Clean up temporary files
      if (tempFiles.length > 0) {
        console.log(
          chalk.yellow(
            `🧹 [YOUTUBE] Cleaning up ${tempFiles.length} temporary files...`
          )
        );
        const cleanupStartTime = Date.now();
        await this.audioProcessor.cleanup(tempFiles);
        const cleanupDuration = Date.now() - cleanupStartTime;
        console.log(
          chalk.green(`✅ [YOUTUBE] Cleanup completed in ${cleanupDuration}ms`)
        );
      }

      // Update metadata with processing results
      metadata.processingStatus = "completed";
      metadata.isProcessed = true;
      metadata.chunksGenerated = chunks.length;
      metadata.processedAt = new Date();
      metadata.embeddingsGenerated = embeddingCounter;
      metadata.audioProcessingTime = audioDuration;
      metadata.embeddingProcessingTime = embeddingDuration;

      console.log(
        chalk.green.bold(
          `🎉 [YOUTUBE] Successfully processed YouTube video ${videoId}`
        )
      );
      console.log(chalk.cyan.bold(`📈 [YOUTUBE] Final processing summary:`));
      console.log(chalk.gray(`   • Video ID: ${videoId}`));
      console.log(chalk.gray(`   • Segments processed: ${segmentCounter}`));
      console.log(chalk.gray(`   • Embeddings created: ${embeddingCounter}`));
      console.log(chalk.gray(`   • Audio processing time: ${audioDuration}ms`));
      console.log(chalk.gray(`   • Embedding time: ${embeddingDuration}ms`));
      console.log(chalk.gray(`   • Temp files cleaned: ${tempFiles.length}`));

      return {
        chunks: chunks.map((chunk) => ({
          text: chunk.text,
          startTime: chunk.startTime,
          endTime: chunk.endTime,
          metadata: {
            ...chunk.metadata,
            chunkIndex: chunk.chunkIndex,
            tokenCount: chunk.tokenCount,
            embedding: chunk.embedding,
          },
        })),
        metadata,
      };
    } catch (error) {
      console.log(
        chalk.red.bold(
          `💥 [YOUTUBE] Error processing YouTube video ${videoId}:`
        )
      );
      console.log(
        chalk.red(
          `   Error: ${
            error instanceof Error ? error.message : "Unknown error"
          }`
        )
      );
      console.log(
        chalk.gray(
          `   Stack: ${error instanceof Error ? error.stack : "No stack trace"}`
        )
      );

      // Update metadata with error status
      const errorMetadata = {
        ...source.metadata,
        processingStatus: "failed",
        errorMessage: error instanceof Error ? error.message : "Unknown error",
        failedAt: new Date(),
      };

      throw new Error(
        `Failed to process YouTube video: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }

  private extractVideoId(url: string): string | null {
    const regex =
      /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/;
    const match = url.match(regex);
    return match ? match[1] : null;
  }
}
