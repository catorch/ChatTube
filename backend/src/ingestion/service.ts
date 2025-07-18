import mongoose from 'mongoose';
import Source from '../models/Source';
import SourceChunk from '../models/SourceChunk';
import { getProcessor } from './registry';
import { IngestionResult } from './types';

/**
 * Process a source by its ID using the appropriate processor
 */
export async function processSource(sourceId: string): Promise<void> {
  const source = await Source.findById(sourceId);
  if (!source) {
    throw new Error(`Source not found: ${sourceId}`);
  }

  // Update status to processing
  await Source.findByIdAndUpdate(sourceId, {
    $set: {
      'metadata.processingStatus': 'processing',
      'metadata.startedAt': new Date(),
    },
  });

  try {
    console.log(`Processing source ${sourceId} of type ${source.kind}`);

    // Get the appropriate processor for this source type
    const processor = getProcessor(source.kind);
    
    // Process the source
    const result: IngestionResult = await processor.ingest(source);

    // Save the chunks to the database
    const sourceChunks = result.chunks.map((chunk, index) => ({
      sourceId: source._id,
      chunkIndex: index,
      text: chunk.text,
      startTime: chunk.startTime,
      endTime: chunk.endTime,
      embedding: chunk.metadata?.embedding,
      tokenCount: chunk.metadata?.tokenCount || chunk.text.split(' ').length,
      metadata: {
        ...chunk.metadata,
        embedding: undefined, // Remove embedding from metadata since it's a separate field
      },
    }));

    // Insert all chunks in batch
    const insertedChunks = await SourceChunk.insertMany(sourceChunks);
    console.log(`Inserted ${insertedChunks.length} chunks for source ${sourceId}`);

    // Update source with processing results
    await Source.findByIdAndUpdate(sourceId, {
      $set: {
        ...result.metadata,
        'metadata.processingStatus': 'completed',
        'metadata.isProcessed': true,
        'metadata.completedAt': new Date(),
        'metadata.chunksCount': insertedChunks.length,
      },
    });

    console.log(`Successfully processed source ${sourceId}`);

  } catch (error) {
    console.error(`Error processing source ${sourceId}:`, error);

    // Update source with error status
    await Source.findByIdAndUpdate(sourceId, {
      $set: {
        'metadata.processingStatus': 'failed',
        'metadata.errorMessage': error instanceof Error ? error.message : 'Unknown error',
        'metadata.failedAt': new Date(),
      },
    });

    throw error;
  }
}

/**
 * Get processing status for a source
 */
export async function getProcessingStatus(sourceId: string): Promise<{
  status: string;
  message?: string;
  progress?: number;
  error?: string;
}> {
  const source = await Source.findById(sourceId);
  if (!source) {
    throw new Error(`Source not found: ${sourceId}`);
  }

  return {
    status: source.metadata?.processingStatus || 'pending',
    message: source.metadata?.message,
    progress: source.metadata?.progress,
    error: source.metadata?.errorMessage,
  };
}

/**
 * Queue a source for processing
 */
export async function queueSourceForProcessing(sourceId: string): Promise<void> {
  const source = await Source.findById(sourceId);
  if (!source) {
    throw new Error(`Source not found: ${sourceId}`);
  }

  const { ingestionQueue } = await import('./queue');
  
  await ingestionQueue.addJob({
    sourceId,
    type: 'ingest',
    kind: source.kind,
  });
}

/**
 * Process source synchronously (for testing or immediate processing)
 */
export async function processSourceSync(sourceId: string): Promise<void> {
  await processSource(sourceId);
} 