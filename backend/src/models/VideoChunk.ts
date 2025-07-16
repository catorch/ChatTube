import { Schema, model, Document, Types } from "mongoose";

export interface IVideoChunk extends Document {
  videoId: Types.ObjectId;
  chunkIndex: number; // Global segment index (not audio chunk index)
  startTime: number; // in seconds, normalized to original video timeline
  endTime: number; // in seconds, normalized to original video timeline
  text: string;
  embedding: number[]; // vector embedding for MongoDB Vector Search
  tokenCount: number;
  audioSource?: "whisper" | "youtube-transcript"; // Track the source of transcription
  whisperModel?: string; // Track which Whisper model was used
  // Whisper-specific metadata
  whisperSegmentId?: number; // Original segment ID from Whisper
  avgLogProb?: number; // Average log probability from Whisper
  noSpeechProb?: number; // No speech probability from Whisper
  compressionRatio?: number; // Compression ratio from Whisper
  createdAt: Date;
  updatedAt: Date;
}

const VideoChunkSchema = new Schema<IVideoChunk>(
  {
    videoId: {
      type: Schema.Types.ObjectId,
      ref: "Video",
      required: true,
      index: true,
    },
    chunkIndex: {
      type: Number,
      required: true,
      min: 0,
    },
    startTime: {
      type: Number,
      required: true,
      min: 0,
    },
    endTime: {
      type: Number,
      required: true,
      min: 0,
    },
    text: {
      type: String,
      required: true,
      trim: true,
    },
    embedding: {
      type: [Number],
      required: true,
      validate: {
        validator: function (arr: number[]) {
          return arr.length === 1536; // OpenAI text-embedding-3-small dimension
        },
        message: "Embedding must have exactly 1536 dimensions",
      },
    },
    tokenCount: {
      type: Number,
      required: true,
      min: 0,
    },
    audioSource: {
      type: String,
      enum: ["whisper", "youtube-transcript"],
      default: "whisper",
    },
    whisperModel: {
      type: String,
      default: "whisper-1",
    },
  },
  {
    timestamps: true,
  }
);

// Compound indexes for efficient querying
VideoChunkSchema.index({ videoId: 1, chunkIndex: 1 }, { unique: true });
VideoChunkSchema.index({ videoId: 1, startTime: 1 });

// Text search index for fallback search
VideoChunkSchema.index({ text: "text" });

export default model<IVideoChunk>("VideoChunk", VideoChunkSchema);
