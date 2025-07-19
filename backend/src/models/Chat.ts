import { Schema, model, Document, Types } from "mongoose";

export interface IChat extends Document {
  userId: Types.ObjectId;
  title: string;
  sourceIds: Types.ObjectId[];  // sources within this chat
  isActive: boolean;
  lastActivity: Date;
  createdAt: Date;
  updatedAt: Date;
}

const ChatSchema = new Schema<IChat>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 200,
    },
    sourceIds: [
      {
        type: Schema.Types.ObjectId,
        ref: "Source",
      },
    ],
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
    lastActivity: {
      type: Date,
      default: Date.now,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes for efficient querying
ChatSchema.index({ userId: 1, lastActivity: -1 });
ChatSchema.index({ userId: 1, isActive: 1, lastActivity: -1 });

export default model<IChat>("Chat", ChatSchema);
