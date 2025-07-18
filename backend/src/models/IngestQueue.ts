import { Schema, model, Document, Types } from "mongoose";
import { SourceType } from './Source';

export interface IIngestQueue extends Document {
  kind: SourceType;               // source type to determine processor
  sourceId: Types.ObjectId;       // FK to Source
  status: 'pending' | 'processing' | 'done' | 'failed';
  attempts: number;               // retry counter
  nextRunAt: Date;                // when this job should be processed
  lockedAt?: Date;                // timestamp when worker claimed the job
  payload?: Record<string, any>;  // extra info for the processor
  lastError?: string;             // debugging info for failed jobs
  createdAt: Date;
  updatedAt: Date;
}

const IngestQueueSchema = new Schema<IIngestQueue>(
  {
    kind: {
      type: String,
      enum: ['youtube', 'pdf', 'web', 'file'],
      required: true,
      index: true,
    },
    sourceId: {
      type: Schema.Types.ObjectId,
      ref: "Source",
      required: true,
      index: true,
    },
    status: {
      type: String,
      enum: ['pending', 'processing', 'done', 'failed'],
      default: 'pending',
      required: true,
      index: true,
    },
    attempts: {
      type: Number,
      default: 0,
      min: 0,
    },
    nextRunAt: {
      type: Date,
      required: true,
      index: true,
    },
    lockedAt: {
      type: Date,
      index: { expireAfterSeconds: 600 }, // Auto-unlock orphaned jobs after 10 minutes
    },
    payload: {
      type: Schema.Types.Mixed,
      default: {},
    },
    lastError: {
      type: String,
      trim: true,
    },
  },
  {
    timestamps: true,
  }
);

// Compound indexes for efficient job claiming
IngestQueueSchema.index({ status: 1, nextRunAt: 1 });
IngestQueueSchema.index({ status: 1, kind: 1 });

// Prevent duplicate jobs for the same source
IngestQueueSchema.index({ sourceId: 1, status: 1 }, { 
  unique: true, 
  partialFilterExpression: { 
    status: { $in: ['pending', 'processing'] } 
  }
});

export default model<IIngestQueue>("IngestQueue", IngestQueueSchema); 