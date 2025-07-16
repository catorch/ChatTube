import fs from "fs";
import path from "path";
import { promisify } from "util";
import { exec } from "child_process";
import ffmpeg from "fluent-ffmpeg";
import OpenAI from "openai";
import FormData from "form-data";

const mkdir = promisify(fs.mkdir);
const unlink = promisify(fs.unlink);
const stat = promisify(fs.stat);
const execAsync = promisify(exec);

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
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
    console.log(`Target output path: ${outputPath}`);

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

      console.log(`Executing command: ${command}`);

      const { stdout, stderr } = await execAsync(command, {
        cwd: this.tempDir,
        timeout: 120000, // 2 minute timeout
      });

      if (
        stderr &&
        !stderr.includes("[download]") &&
        !stderr.includes("[ExtractAudio]")
      ) {
        console.log(`yt-dlp stderr: ${stderr}`);
      }

      // Verify file was created
      if (fs.existsSync(outputPath)) {
        const stats = fs.statSync(outputPath);
        console.log(
          `✅ File created successfully: ${outputPath} (${(
            stats.size /
            1024 /
            1024
          ).toFixed(2)} MB)`
        );
        return outputPath;
      } else {
        // List files in temp directory for debugging
        const files = fs.readdirSync(this.tempDir);
        console.log(`Files in temp directory: ${files.join(", ")}`);
        throw new Error(
          `Download completed but file not found at expected path: ${outputPath}`
        );
      }
    } catch (error) {
      console.error(`yt-dlp download error:`, error);
      throw new Error(`Failed to download video ${videoId}: ${error}`);
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
    try {
      const fileStream = fs.createReadStream(chunk.filePath);

      const transcription = await openai.audio.transcriptions.create({
        file: fileStream,
        model: "whisper-1",
        language: "en", // You can make this configurable
        response_format: "verbose_json",
        timestamp_granularities: ["segment"],
      });

      // Normalize segment timestamps to original video timeline
      const normalizedSegments: WhisperSegment[] = (
        transcription.segments || []
      ).map((segment) => ({
        ...segment,
        start: segment.start + chunk.startTime, // Add chunk offset
        end: segment.end + chunk.startTime, // Add chunk offset
      }));

      return {
        text: transcription.text,
        startTime: chunk.startTime,
        endTime: chunk.endTime,
        chunkIndex: chunk.chunkIndex,
        segments: normalizedSegments,
        language: transcription.language,
        duration: transcription.duration,
      };
    } catch (error) {
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
    const transcriptionPromises = chunks.map((chunk) =>
      this.transcribeAudioChunk(chunk)
    );

    try {
      const transcriptions = await Promise.all(transcriptionPromises);
      return transcriptions.sort((a, b) => a.chunkIndex - b.chunkIndex);
    } catch (error) {
      throw new Error(`Failed to transcribe audio chunks: ${error}`);
    }
  }

  /**
   * Clean up temporary files
   */
  async cleanup(filePaths: string[]): Promise<void> {
    const deletePromises = filePaths.map(async (filePath) => {
      try {
        await unlink(filePath);
      } catch (error) {
        console.warn(`Failed to delete file ${filePath}:`, error);
      }
    });

    await Promise.all(deletePromises);
  }

  /**
   * Full pipeline: download, chunk (if needed), and transcribe
   */
  async processVideo(videoId: string): Promise<{
    transcriptions: TranscriptionResult[];
    tempFiles: string[];
  }> {
    let tempFiles: string[] = [];

    try {
      // Download video as MP3
      console.log(`Downloading video ${videoId}...`);
      const audioFilePath = await this.downloadVideoAsMP3(videoId);
      tempFiles.push(audioFilePath);

      // Check file size - if under 25MB, process directly without chunking
      const fs = await import("fs");
      const stats = fs.statSync(audioFilePath);
      const fileSizeMB = stats.size / (1024 * 1024);
      console.log(`Audio file size: ${fileSizeMB.toFixed(2)} MB`);

      let transcriptions: TranscriptionResult[];

      if (fileSizeMB < 25) {
        console.log(
          `File is under 25MB, processing directly without chunking...`
        );
        // Process the entire file as a single chunk
        const audioDuration = await this.getAudioDuration(audioFilePath);
        const singleChunk: AudioChunk = {
          filePath: audioFilePath,
          startTime: 0,
          endTime: audioDuration,
          duration: audioDuration,
          chunkIndex: 0,
        };

        const transcription = await this.transcribeAudioChunk(singleChunk);
        transcriptions = [transcription];
      } else {
        console.log(
          `File is over 25MB, chunking audio for video ${videoId}...`
        );
        // Chunk audio into segments
        const chunks = await this.chunkAudio(audioFilePath);
        tempFiles.push(...chunks.map((chunk) => chunk.filePath));

        // Transcribe all chunks
        console.log(
          `Transcribing ${chunks.length} chunks for video ${videoId}...`
        );
        transcriptions = await this.transcribeAllChunks(chunks);
      }

      return {
        transcriptions,
        tempFiles,
      };
    } catch (error) {
      // Clean up on error
      await this.cleanup(tempFiles);
      throw error;
    }
  }
}

export default AudioProcessor;
