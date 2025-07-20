import { Schema, model, Document, Types } from "mongoose";

export interface IMessage extends Document {
  chatId: Types.ObjectId;
  role: "user" | "assistant" | "system";
  content: string;
  metadata?: {
    sourceReferences?: {
      sourceId: Types.ObjectId;
      chunkIds: Types.ObjectId[];
      timestamps?: number[];
    }[];
    citationMap?: {
      [label: string]: {
        // e.g. "^1"
        sourceId: Types.ObjectId;
        chunkId: Types.ObjectId;
        text: string; // full chunk text for tooltip
        startTime?: number; // keeps YT/AV support
      };
    };
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
      required: function (this: IMessage) {
        // Allow empty content for assistant messages (used for streaming)
        return this.role !== "assistant";
      },
      trim: true,
    },
    metadata: {
      sourceReferences: [
        {
          sourceId: {
            type: Schema.Types.ObjectId,
            ref: "Source",
          },
          chunkIds: [
            {
              type: Schema.Types.ObjectId,
              ref: "SourceChunk",
            },
          ],
          timestamps: [Number],
        },
      ],
      citationMap: {
        type: Map,
        of: {
          sourceId: {
            type: Schema.Types.ObjectId,
            ref: "Source",
          },
          chunkId: {
            type: Schema.Types.ObjectId,
            ref: "SourceChunk",
          },
          text: String,
          startTime: Number,
        },
      },
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
