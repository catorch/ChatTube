import { Schema, model, Document, Types } from "mongoose";

export interface ISourceChunk extends Document {
  sourceId: Types.ObjectId;        // FK to Source
  chunkIndex: number;              // sequence within source
  startTime?: number;              // only for AV content (seconds)
  endTime?: number;                // only for AV content (seconds)
  text: string;                    // the actual content
  embedding: number[];             // vector for similarity search
  tokenCount: number;              // approximate token count
  metadata: Record<string, any>;   // e.g. page #, PDF heading, confidence scores
  createdAt: Date;
  updatedAt: Date;
}

const SourceChunkSchema = new Schema<ISourceChunk>(
  {
    sourceId: {
      type: Schema.Types.ObjectId,
      ref: "Source",
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
      min: 0,
    },
    endTime: {
      type: Number,
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
    metadata: {
      type: Schema.Types.Mixed,
      default: {},
    },
  },
  {
    timestamps: true,
  }
);

// Compound indexes for efficient querying
SourceChunkSchema.index({ sourceId: 1, chunkIndex: 1 }, { unique: true });
SourceChunkSchema.index({ sourceId: 1, startTime: 1 }); // for AV content

// Text search index for fallback search
SourceChunkSchema.index({ text: "text" });

export default model<ISourceChunk>("SourceChunk", SourceChunkSchema); 