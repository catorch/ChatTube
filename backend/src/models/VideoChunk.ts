import { Schema, model, Document, Types } from "mongoose";

export interface IVideoChunk extends Document {
  videoId: Types.ObjectId;
  chunkIndex: number;
  startTime: number; // in seconds
  endTime: number; // in seconds
  text: string;
  embedding: number[]; // vector embedding for MongoDB Vector Search
  tokenCount: number;
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
          return arr.length === 1536; // OpenAI ada-002 embedding dimension
        },
        message: "Embedding must have exactly 1536 dimensions",
      },
    },
    tokenCount: {
      type: Number,
      required: true,
      min: 0,
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

// Vector search index will be created manually in MongoDB Atlas
// Index name: "vector_index"
// Vector field: "embedding"
// Dimensions: 1536
// Similarity: cosine

export default model<IVideoChunk>("VideoChunk", VideoChunkSchema);
