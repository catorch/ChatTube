import { Schema, model, Document, Types } from "mongoose";

export interface IMessage extends Document {
  chatId: Types.ObjectId;
  role: "user" | "assistant" | "system";
  content: string;
  metadata?: {
    videoReferences?: {
      videoId: Types.ObjectId;
      chunkIds: Types.ObjectId[];
      timestamps?: number[];
    }[];
    tokenCount?: number;
    model?: string;
    temperature?: number;
  };
  isVisible: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const MessageSchema = new Schema<IMessage>(
  {
    chatId: {
      type: Schema.Types.ObjectId,
      ref: "Chat",
      required: true,
      index: true,
    },
    role: {
      type: String,
      enum: ["user", "assistant", "system"],
      required: true,
    },
    content: {
      type: String,
      required: true,
      trim: true,
    },
    metadata: {
      videoReferences: [
        {
          videoId: {
            type: Schema.Types.ObjectId,
            ref: "Video",
          },
          chunkIds: [
            {
              type: Schema.Types.ObjectId,
              ref: "VideoChunk",
            },
          ],
          timestamps: [Number],
        },
      ],
      tokenCount: Number,
      model: String,
      temperature: Number,
    },
    isVisible: {
      type: Boolean,
      default: true,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes for efficient querying
MessageSchema.index({ chatId: 1, createdAt: 1 });
MessageSchema.index({ chatId: 1, isVisible: 1, createdAt: 1 });

export default model<IMessage>("Message", MessageSchema);
