import { Schema, model, Types, Document } from 'mongoose';

export type SourceType = 'youtube' | 'pdf' | 'web' | 'file';

export interface ISource extends Document {
  userId: Types.ObjectId;          // owner
  chatId: Types.ObjectId;          // parent chat
  kind: SourceType;                // data type
  title?: string;
  url?: string;                    // used for web, youtube, pdf etc
  fileId?: Types.ObjectId;         // GridFS / S3
  metadata: Record<string, any>;   // channelName, pageCount, etc.
  createdAt: Date;
  updatedAt: Date;
}

const SourceSchema = new Schema<ISource>(
  {
    userId: { 
      type: Schema.Types.ObjectId, 
      ref: 'User', 
      required: true, 
      index: true 
    },
    chatId: { 
      type: Schema.Types.ObjectId, 
      ref: 'Chat', 
      required: true, 
      index: true 
    },
    kind: { 
      type: String, 
      enum: ['youtube', 'pdf', 'web', 'file'], 
      required: true,
      index: true
    },
    title: String,
    url: String,
    fileId: Schema.Types.ObjectId,
    metadata: {
      type: Schema.Types.Mixed,
      default: {}
    }
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
    partialFilterExpression: { url: { $exists: true } }
  }
);

export default model<ISource>('Source', SourceSchema); 