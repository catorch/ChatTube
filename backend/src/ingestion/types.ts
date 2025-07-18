import { ISource, SourceType } from '../models/Source';

export interface SourceProcessor {
  /** Pull raw bytes or text, then return { chunks, metadata } */
  ingest(source: ISource): Promise<{
    chunks: {
      text: string;
      startTime?: number;
      endTime?: number;
      metadata?: Record<string, any>;
    }[];
    metadata: Record<string, any>;      // updated source-level metadata
  }>;
}

export interface ChunkData {
  text: string;
  startTime?: number;
  endTime?: number;
  metadata?: Record<string, any>;
}

export interface IngestionResult {
  chunks: ChunkData[];
  metadata: Record<string, any>;
}

export interface ProcessingJob {
  sourceId: string;
  type: 'ingest';
  attempts?: number;
  maxAttempts?: number;
}

export interface ProcessingStatus {
  status: 'pending' | 'processing' | 'completed' | 'failed';
  progress?: number;
  message?: string;
  error?: string;
  startedAt?: Date;
  completedAt?: Date;
} 