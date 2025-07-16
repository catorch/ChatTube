import { Schema, model, Document } from "mongoose";

export interface IVideo extends Document {
  videoId: string;
  title: string;
  description?: string;
  duration: number; // in seconds
  uploadDate: Date;
  channelName: string;
  channelId: string;
  thumbnailUrl?: string;
  language?: string;
  viewCount?: number;
  isProcessed: boolean;
  processingStatus: "pending" | "processing" | "completed" | "failed";
  errorMessage?: string;
  createdAt: Date;
  updatedAt: Date;
}

const VideoSchema = new Schema<IVideo>(
  {
    videoId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      trim: true,
    },
    duration: {
      type: Number,
      required: true,
      min: 0,
    },
    uploadDate: {
      type: Date,
      required: true,
    },
    channelName: {
      type: String,
      required: true,
      trim: true,
    },
    channelId: {
      type: String,
      required: true,
      index: true,
    },
    thumbnailUrl: {
      type: String,
      trim: true,
    },
    language: {
      type: String,
      trim: true,
      default: "en",
    },
    viewCount: {
      type: Number,
      min: 0,
    },
    isProcessed: {
      type: Boolean,
      default: false,
      index: true,
    },
    processingStatus: {
      type: String,
      enum: ["pending", "processing", "completed", "failed"],
      default: "pending",
      index: true,
    },
    errorMessage: {
      type: String,
      trim: true,
    },
  },
  {
    timestamps: true,
  }
);

// Index for efficient querying
VideoSchema.index({ channelId: 1, uploadDate: -1 });
VideoSchema.index({ isProcessed: 1, processingStatus: 1 });

export default model<IVideo>("Video", VideoSchema);
