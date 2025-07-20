import { Schema, model, Types, Document } from "mongoose";

export type SourceType = "youtube" | "pdf" | "web" | "file";

export interface ISource extends Document {
  userId: Types.ObjectId; // owner
  chatId: Types.ObjectId; // parent chat
  kind: SourceType; // data type
  title?: string;
  url?: string; // used for web, youtube, pdf etc
  fileId?: Types.ObjectId; // GridFS / S3
  metadata: {
    // Processing status fields
    processingStatus?: string;
    isProcessed?: boolean;
    startedAt?: Date;
    completedAt?: Date;
    failedAt?: Date;
    errorMessage?: string;
    chunksCount?: number;
    totalProcessingTime?: number;

    // Auto-generated summary fields
    autoSummary?: string; // ≤1,000 chars
    autoTitle?: string; // ≤120 chars
    autoEmoji?: string; // ≤4 chars

    // Source-specific metadata (videoId, channelName, pageCount, etc.)
    [key: string]: any;
  };
  createdAt: Date;
  updatedAt: Date;
}

const SourceSchema = new Schema<ISource>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    chatId: {
      type: Schema.Types.ObjectId,
      ref: "Chat",
      required: true,
      index: true,
    },
    kind: {
      type: String,
      enum: ["youtube", "pdf", "web", "file"],
      required: true,
      index: true,
    },
    title: String,
    url: String,
    fileId: Schema.Types.ObjectId,
    metadata: {
      type: Schema.Types.Mixed,
      default: {},
    },
  },
  { timestamps: true }
);

// Compound indexes for efficient querying
SourceSchema.index({ chatId: 1, kind: 1 });
SourceSchema.index({ userId: 1, chatId: 1 });

// Prevent duplicate sources within the same chat (by URL for most types)
SourceSchema.index(
  { chatId: 1, url: 1 },
  {
    unique: true,
    sparse: true,
    partialFilterExpression: { url: { $exists: true } },
  }
);

export default model<ISource>("Source", SourceSchema);
