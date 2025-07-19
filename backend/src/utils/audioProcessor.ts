import fs from "fs";
import path from "path";
import { promisify } from "util";
import { exec } from "child_process";
import ffmpeg from "fluent-ffmpeg";
import OpenAI from "openai";
import FormData from "form-data";
import chalk from "chalk";

const mkdir = promisify(fs.mkdir);
const unlink = promisify(fs.unlink);
const stat = promisify(fs.stat);
const execAsync = promisify(exec);

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  timeout: 120000, // 2 minutes timeout
  maxRetries: 2, // Retry up to 2 times on failure
});

export interface AudioChunk {
  filePath: string;
  startTime: number;
  endTime: number;
  duration: number;
  chunkIndex: number;
}

export interface WhisperSegment {
  id: number;
  seek: number;
  start: number;
  end: number;
  text: string;
  tokens: number[];
  temperature: number;
  avg_logprob: number;
  compression_ratio: number;
  no_speech_prob: number;
}

export interface TranscriptionResult {
  text: string;
  startTime: number; // Normalized to original video timeline
  endTime: number; // Normalized to original video timeline
  chunkIndex: number;
  segments: WhisperSegment[]; // Individual segments with normalized timestamps
  language: string;
  duration: number;
}

export class AudioProcessor {
  private tempDir: string;

  constructor() {
    this.tempDir = path.join(process.cwd(), "temp");
    this.ensureTempDir();

    // Validate OpenAI API key
    if (!process.env.OPENAI_API_KEY) {
      console.log(
        chalk.red.bold(
          `❌ [AUDIO PROCESSOR] Missing OPENAI_API_KEY environment variable`
        )
      );
      throw new Error(
        "OPENAI_API_KEY environment variable is required for audio processing"
      );
    }

    console.log(chalk.green(`✅ [AUDIO PROCESSOR] OpenAI API key configured`));
  }

  private async ensureTempDir(): Promise<void> {
    try {
      await stat(this.tempDir);
    } catch (error) {
      await mkdir(this.tempDir, { recursive: true });
    }
  }

  /**
   * Download YouTube video as MP3
   */
  async downloadVideoAsMP3(videoId: string): Promise<string> {
    const outputPath = path.join(this.tempDir, `${videoId}.mp3`);
    console.log(
      chalk.blue(`⬇️  [AUDIO] Starting download for video ${videoId}`)
    );
    console.log(chalk.gray(`   • Target output path: ${outputPath}`));

    try {
      // Use direct yt-dlp command since the Node.js wrapper has issues
      const command = [
        "yt-dlp",
        `"https://www.youtube.com/watch?v=${videoId}"`,
        "--extract-audio",
        "--audio-format",
        "mp3",
        "--audio-quality",
        "192K",
        "--output",
        `"${outputPath.replace(".mp3", ".%(ext)s")}"`,
        "--no-playlist",
      ].join(" ");

      console.log(chalk.yellow(`🔧 [AUDIO] Executing yt-dlp command`));
      console.log(chalk.gray(`   Command: ${command}`));

      const downloadStartTime = Date.now();
      const { stdout, stderr } = await execAsync(command, {
        cwd: this.tempDir,
        timeout: 120000, // 2 minute timeout
      });

      const downloadDuration = Date.now() - downloadStartTime;

      if (
        stderr &&
        !stderr.includes("[download]") &&
        !stderr.includes("[ExtractAudio]")
      ) {
        console.log(chalk.yellow(`⚠️  [AUDIO] yt-dlp stderr: ${stderr}`));
      }

      // Check if file exists
      try {
        await stat(outputPath);
        const stats = await stat(outputPath);
        const fileSizeMB = stats.size / (1024 * 1024);
        console.log(
          chalk.green(`✅ [AUDIO] Download completed in ${downloadDuration}ms`)
        );
        console.log(chalk.cyan(`📊 [AUDIO] Downloaded file stats:`));
        console.log(chalk.gray(`   • Size: ${fileSizeMB.toFixed(2)} MB`));
        console.log(chalk.gray(`   • Path: ${outputPath}`));
        return outputPath;
      } catch (error) {
        console.log(
          chalk.red(
            `❌ [AUDIO] Downloaded file not found at expected path: ${outputPath}`
          )
        );
        throw new Error(`Downloaded file not found: ${outputPath}`);
      }
    } catch (error: any) {
      console.log(
        chalk.red.bold(`💥 [AUDIO] Download failed for video ${videoId}:`)
      );
      console.log(chalk.red(`   Error: ${error.message}`));
      throw new Error(`Failed to download video ${videoId}: ${error.message}`);
    }
  }

  /**
   * Get audio duration in seconds
   */
  private getAudioDuration(filePath: string): Promise<number> {
    return new Promise((resolve, reject) => {
      ffmpeg.ffprobe(filePath, (err: any, metadata: any) => {
        if (err) {
          console.error(
            `Error getting audio duration for ${filePath}:`,
            err.message
          );
          reject(err);
          return;
        }

        const duration = metadata.format.duration;
        if (duration) {
          console.log(`Audio duration: ${duration} seconds`);
          resolve(duration);
        } else {
          reject(new Error("Could not determine audio duration"));
        }
      });
    });
  }

  /**
   * Split MP3 into chunks of specified duration
   */
  async chunkAudio(
    audioFilePath: string,
    chunkDurationSeconds: number = 300 // 5 minutes default
  ): Promise<AudioChunk[]> {
    const totalDuration = await this.getAudioDuration(audioFilePath);
    const chunks: AudioChunk[] = [];
    const baseFileName = path.basename(audioFilePath, ".mp3");

    let startTime = 0;
    let chunkIndex = 0;

    while (startTime < totalDuration) {
      const endTime = Math.min(startTime + chunkDurationSeconds, totalDuration);
      const duration = endTime - startTime;

      const chunkPath = path.join(
        this.tempDir,
        `${baseFileName}_chunk_${chunkIndex.toString().padStart(3, "0")}.mp3`
      );

      await this.extractAudioSegment(
        audioFilePath,
        chunkPath,
        startTime,
        duration
      );

      chunks.push({
        filePath: chunkPath,
        startTime,
        endTime,
        duration,
        chunkIndex,
      });

      startTime = endTime;
      chunkIndex++;
    }

    return chunks;
  }

  /**
   * Extract audio segment using ffmpeg
   */
  private extractAudioSegment(
    inputPath: string,
    outputPath: string,
    startTime: number,
    duration: number
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      ffmpeg(inputPath)
        .seekInput(startTime)
        .duration(duration)
        .audioCodec("libmp3lame")
        .audioBitrate("192k")
        .output(outputPath)
        .on("end", () => resolve())
        .on("error", (err: any) => reject(err))
        .run();
    });
  }

  /**
   * Transcribe audio chunk using OpenAI Whisper API with segment timestamps
   */
  async transcribeAudioChunk(chunk: AudioChunk): Promise<TranscriptionResult> {
    console.log(
      chalk.blue(`🎤 [WHISPER] Transcribing chunk ${chunk.chunkIndex}`)
    );
    console.log(chalk.gray(`   • File: ${path.basename(chunk.filePath)}`));
    console.log(chalk.gray(`   • Duration: ${chunk.duration.toFixed(2)}s`));
    console.log(
      chalk.gray(
        `   • Time range: ${chunk.startTime.toFixed(
          2
        )}s - ${chunk.endTime.toFixed(2)}s`
      )
    );

    try {
      const transcribeStartTime = Date.now();
      const fileStream = fs.createReadStream(chunk.filePath);

      console.log(
        chalk.yellow(`🔗 [WHISPER] Sending request to OpenAI API...`)
      );

      const transcription = await openai.audio.transcriptions.create({
        file: fileStream,
        model: "whisper-1",
        // language: "en", // You can make this configurable
        response_format: "verbose_json",
        timestamp_granularities: ["segment"],
      });

      const transcribeDuration = Date.now() - transcribeStartTime;

      // Normalize segment timestamps to original video timeline
      const normalizedSegments: WhisperSegment[] = (
        transcription.segments || []
      ).map((segment) => ({
        ...segment,
        start: segment.start + chunk.startTime, // Add chunk offset
        end: segment.end + chunk.startTime, // Add chunk offset
      }));

      console.log(
        chalk.green(
          `✅ [WHISPER] Chunk ${chunk.chunkIndex} transcribed in ${transcribeDuration}ms`
        )
      );
      console.log(chalk.cyan(`📝 [WHISPER] Transcription results:`));
      console.log(
        chalk.gray(`   • Text length: ${transcription.text.length} chars`)
      );
      console.log(chalk.gray(`   • Segments: ${normalizedSegments.length}`));
      console.log(chalk.gray(`   • Language: ${transcription.language}`));
      console.log(
        chalk.gray(
          `   • Text preview: "${transcription.text.substring(0, 100)}..."`
        )
      );

      return {
        text: transcription.text,
        startTime: chunk.startTime,
        endTime: chunk.endTime,
        chunkIndex: chunk.chunkIndex,
        segments: normalizedSegments,
        language: transcription.language,
        duration: transcription.duration,
      };
    } catch (error: any) {
      console.log(
        chalk.red(
          `❌ [WHISPER] Failed to transcribe chunk ${chunk.chunkIndex}: ${error}`
        )
      );

      // Provide more specific error information
      if (error.message?.includes("Connection error")) {
        console.log(chalk.yellow(`🔍 [WHISPER] Possible causes:`));
        console.log(chalk.gray(`   • OpenAI API is experiencing issues`));
        console.log(chalk.gray(`   • Network connectivity problems`));
        console.log(
          chalk.gray(
            `   • Request timeout (chunk duration: ${chunk.duration.toFixed(
              1
            )}s)`
          )
        );
      } else if (
        error.message?.includes("authentication") ||
        error.status === 401
      ) {
        console.log(
          chalk.yellow(
            `🔑 [WHISPER] API key issue - check OPENAI_API_KEY environment variable`
          )
        );
      } else if (error.status === 429) {
        console.log(
          chalk.yellow(
            `🚫 [WHISPER] Rate limit exceeded - will retry automatically`
          )
        );
      }

      throw new Error(
        `Failed to transcribe chunk ${chunk.chunkIndex}: ${error}`
      );
    }
  }

  /**
   * Process all audio chunks for transcription
   */
  async transcribeAllChunks(
    chunks: AudioChunk[]
  ): Promise<TranscriptionResult[]> {
    console.log(
      chalk.blue.bold(
        `🎤 [WHISPER] Starting transcription of ${chunks.length} chunks`
      )
    );

    const transcriptionStartTime = Date.now();
    const transcriptionPromises = chunks.map((chunk) =>
      this.transcribeAudioChunk(chunk)
    );

    try {
      const transcriptions = await Promise.all(transcriptionPromises);
      const transcriptionDuration = Date.now() - transcriptionStartTime;
      const sortedTranscriptions = transcriptions.sort(
        (a, b) => a.chunkIndex - b.chunkIndex
      );

      console.log(
        chalk.green.bold(
          `🎉 [WHISPER] All chunks transcribed in ${transcriptionDuration}ms`
        )
      );
      console.log(chalk.cyan(`📊 [WHISPER] Transcription summary:`));
      console.log(chalk.gray(`   • Chunks processed: ${chunks.length}`));
      console.log(
        chalk.gray(
          `   • Average time per chunk: ${Math.round(
            transcriptionDuration / chunks.length
          )}ms`
        )
      );
      console.log(
        chalk.gray(
          `   • Total segments: ${sortedTranscriptions.reduce(
            (sum, t) => sum + t.segments.length,
            0
          )}`
        )
      );

      return sortedTranscriptions;
    } catch (error) {
      console.log(
        chalk.red.bold(
          `💥 [WHISPER] Failed to transcribe audio chunks: ${error}`
        )
      );
      throw new Error(`Failed to transcribe audio chunks: ${error}`);
    }
  }

  /**
   * Clean up temporary files
   */
  async cleanup(filePaths: string[]): Promise<void> {
    console.log(
      chalk.yellow(
        `🧹 [CLEANUP] Cleaning up ${filePaths.length} temporary files...`
      )
    );

    const cleanupStartTime = Date.now();
    const deletePromises = filePaths.map(async (filePath) => {
      try {
        await unlink(filePath);
        console.log(
          chalk.green(`✅ [CLEANUP] Deleted: ${path.basename(filePath)}`)
        );
      } catch (error) {
        console.log(
          chalk.yellow(
            `⚠️  [CLEANUP] Failed to delete ${path.basename(
              filePath
            )}: ${error}`
          )
        );
      }
    });

    await Promise.all(deletePromises);
    const cleanupDuration = Date.now() - cleanupStartTime;
    console.log(
      chalk.green(`✅ [CLEANUP] Cleanup completed in ${cleanupDuration}ms`)
    );
  }

  /**
   * Full pipeline: download, chunk (if needed), and transcribe
   */
  async processVideo(videoId: string): Promise<{
    transcriptions: TranscriptionResult[];
    tempFiles: string[];
  }> {
    console.log(
      chalk.blue.bold(
        `🎵 [AUDIO PIPELINE] Starting audio processing for video ${videoId}`
      )
    );
    let tempFiles: string[] = [];
    const pipelineStartTime = Date.now();

    try {
      // Download video as MP3
      console.log(
        chalk.blue(`📥 [AUDIO PIPELINE] Step 1: Downloading audio...`)
      );
      const audioFilePath = await this.downloadVideoAsMP3(videoId);
      tempFiles.push(audioFilePath);

      // Check file size - if under 25MB, process directly without chunking
      console.log(
        chalk.blue(`📏 [AUDIO PIPELINE] Step 2: Analyzing file size...`)
      );
      const fs = await import("fs");
      const stats = fs.statSync(audioFilePath);
      const fileSizeMB = stats.size / (1024 * 1024);

      // Get audio duration for chunking decision
      const audioDuration = await this.getAudioDuration(audioFilePath);

      console.log(
        chalk.cyan(
          `📊 [AUDIO PIPELINE] Audio file size: ${fileSizeMB.toFixed(2)} MB`
        )
      );
      console.log(
        chalk.cyan(
          `⏱️  [AUDIO PIPELINE] Audio duration: ${audioDuration.toFixed(
            2
          )}s (${Math.floor(audioDuration / 60)}:${Math.floor(
            audioDuration % 60
          )
            .toString()
            .padStart(2, "0")})`
        )
      );

      let transcriptions: TranscriptionResult[];

      // Decision: Process as single chunk if BOTH conditions are met:
      // 1. File size < 25MB AND
      // 2. Duration < 10 minutes (600 seconds)
      const shouldChunk = fileSizeMB >= 25 || audioDuration >= 600;

      if (!shouldChunk) {
        console.log(
          chalk.green(
            `⚡ [AUDIO PIPELINE] File under limits (25MB and 10min) - processing as single chunk`
          )
        );

        const singleChunk: AudioChunk = {
          filePath: audioFilePath,
          startTime: 0,
          endTime: audioDuration,
          duration: audioDuration,
          chunkIndex: 0,
        };

        console.log(
          chalk.blue(`🎤 [AUDIO PIPELINE] Step 3: Transcribing single chunk...`)
        );
        const transcription = await this.transcribeAudioChunk(singleChunk);
        transcriptions = [transcription];
      } else {
        const reason = fileSizeMB >= 25 ? "file size" : "duration";
        console.log(
          chalk.yellow(
            `✂️  [AUDIO PIPELINE] Chunking required due to ${reason} (${fileSizeMB.toFixed(
              2
            )}MB, ${audioDuration.toFixed(0)}s)`
          )
        );

        // Chunk audio into segments
        console.log(
          chalk.blue(`✂️  [AUDIO PIPELINE] Step 3a: Chunking audio...`)
        );
        const chunks = await this.chunkAudio(audioFilePath);
        tempFiles.push(...chunks.map((chunk) => chunk.filePath));

        console.log(
          chalk.cyan(`📊 [AUDIO PIPELINE] Created ${chunks.length} chunks`)
        );
        for (let i = 0; i < chunks.length; i++) {
          const chunk = chunks[i];
          console.log(
            chalk.gray(
              `   • Chunk ${i}: ${chunk.duration.toFixed(
                2
              )}s (${chunk.startTime.toFixed(2)}-${chunk.endTime.toFixed(2)}s)`
            )
          );
        }

        // Transcribe all chunks
        console.log(
          chalk.blue(
            `🎤 [AUDIO PIPELINE] Step 3b: Transcribing ${chunks.length} chunks...`
          )
        );
        transcriptions = await this.transcribeAllChunks(chunks);
      }

      const pipelineDuration = Date.now() - pipelineStartTime;
      console.log(
        chalk.green.bold(
          `🎉 [AUDIO PIPELINE] Audio processing completed in ${pipelineDuration}ms`
        )
      );
      console.log(chalk.cyan.bold(`📈 [AUDIO PIPELINE] Final results:`));
      console.log(chalk.gray(`   • Video ID: ${videoId}`));
      console.log(chalk.gray(`   • File size: ${fileSizeMB.toFixed(2)} MB`));
      console.log(
        chalk.gray(`   • Transcription chunks: ${transcriptions.length}`)
      );
      console.log(
        chalk.gray(
          `   • Total segments: ${transcriptions.reduce(
            (sum, t) => sum + t.segments.length,
            0
          )}`
        )
      );
      console.log(chalk.gray(`   • Temp files created: ${tempFiles.length}`));
      console.log(chalk.gray(`   • Processing time: ${pipelineDuration}ms`));

      return {
        transcriptions,
        tempFiles,
      };
    } catch (error) {
      const errorDuration = Date.now() - pipelineStartTime;
      console.log(
        chalk.red.bold(
          `💥 [AUDIO PIPELINE] Audio processing failed after ${errorDuration}ms:`
        )
      );
      console.log(chalk.red(`   Error: ${error}`));

      // Clean up on error
      console.log(
        chalk.yellow(`🧹 [AUDIO PIPELINE] Cleaning up due to error...`)
      );
      await this.cleanup(tempFiles);
      throw error;
    }
  }
}

export default AudioProcessor;
