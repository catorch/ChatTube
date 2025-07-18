import { EventEmitter } from 'events';
import IngestQueue from '../models/IngestQueue';
import { ProcessingJob, ProcessingStatus } from './types';
import { SourceType } from '../models/Source';

/**
 * MongoDB-based queue implementation for reliable job processing
 */
export class IngestionQueue extends EventEmitter {
  private isRunning = false;
  private maxParallelJobs = 2;
  private pollInterval = 2000; // 2 seconds

  constructor(options?: { maxParallelJobs?: number; pollInterval?: number }) {
    super();
    if (options?.maxParallelJobs) this.maxParallelJobs = options.maxParallelJobs;
    if (options?.pollInterval) this.pollInterval = options.pollInterval;
  }

  /**
   * Add a job to the queue
   */
  async addJob(job: ProcessingJob & { kind: SourceType }): Promise<string> {
    try {
      const queueItem = await IngestQueue.create({
        kind: job.kind,
        sourceId: job.sourceId,
        status: 'pending',
        attempts: 0,
        nextRunAt: new Date(),
        payload: job,
      });

      this.emit('job-added', (queueItem._id as any).toString(), job);
      console.log(`Added job ${queueItem._id} for source ${job.sourceId}`);
      
      return (queueItem._id as any).toString();
    } catch (error: any) {
      // Handle duplicate job error gracefully
      if (error.code === 11000) {
        console.log(`Job already exists for source ${job.sourceId}`);
        const existingJob = await IngestQueue.findOne({ 
          sourceId: job.sourceId, 
          status: { $in: ['pending', 'processing'] } 
        });
        return existingJob ? (existingJob._id as any).toString() : '';
      }
      throw error;
    }
  }

  /**
   * Start the worker process
   */
  async startWorker(): Promise<void> {
    if (this.isRunning) {
      console.log('Worker is already running');
      return;
    }

    this.isRunning = true;
    console.log(`Starting ingestion worker with ${this.maxParallelJobs} parallel jobs`);

    while (this.isRunning) {
      try {
        await this.processAvailableJobs();
      } catch (error) {
        console.error('Error in worker loop:', error);
      }
      
      // Wait before next polling cycle
      await new Promise(resolve => setTimeout(resolve, this.pollInterval));
    }
  }

  /**
   * Stop the worker process
   */
  stopWorker(): void {
    this.isRunning = false;
    console.log('Stopping ingestion worker');
  }

  /**
   * Process available jobs with concurrency limit
   */
  private async processAvailableJobs(): Promise<void> {
    const jobs = await Promise.all(
      Array.from({ length: this.maxParallelJobs }, () => this.claimJob())
    );

    const validJobs = jobs.filter(Boolean);
    if (validJobs.length === 0) return;

    console.log(`Processing ${validJobs.length} jobs`);
    await Promise.all(validJobs.map(job => this.processJob(job!)));
  }

  /**
   * Atomically claim a job for processing
   */
  private async claimJob(): Promise<any> {
    const now = new Date();
    
    return await IngestQueue.findOneAndUpdate(
      { 
        status: 'pending', 
        nextRunAt: { $lte: now } 
      },
      { 
        $set: { 
          status: 'processing', 
          lockedAt: now 
        } 
      },
      { 
        sort: { nextRunAt: 1 }, 
        new: true 
      }
    ).lean();
  }

  /**
   * Process a single job
   */
  private async processJob(job: any): Promise<void> {
    const jobId = job._id.toString();
    
    try {
      this.emit('job-started', jobId, job);
      console.log(`Processing job ${jobId} for source ${job.sourceId}`);

      // Import and call the processing service
      const { processSource } = await import('../ingestion/service');
      await processSource(job.sourceId.toString());

      // Mark job as completed
      await IngestQueue.findByIdAndUpdate(job._id, {
        status: 'done',
        $unset: { lockedAt: 1 } // Remove lock
      });

      this.emit('job-completed', jobId, job);
      console.log(`Completed job ${jobId} for source ${job.sourceId}`);

    } catch (error: any) {
      console.error(`Error processing job ${jobId}:`, error);
      
      const attempts = (job.attempts || 0) + 1;
      const maxAttempts = 5;
      const shouldFail = attempts >= maxAttempts;

      if (shouldFail) {
        await IngestQueue.findByIdAndUpdate(job._id, {
          status: 'failed',
          attempts,
          lastError: error.message,
          $unset: { lockedAt: 1 }
        });
        this.emit('job-failed', jobId, job, error);
        console.log(`Failed job ${jobId} after ${attempts} attempts`);
      } else {
        // Exponential backoff: retry in 1min, 2min, 4min, 8min
        const delayMs = Math.min(1000 * 60 * Math.pow(2, attempts - 1), 1000 * 60 * 30); // Max 30 min
        const nextRunAt = new Date(Date.now() + delayMs);
        
        await IngestQueue.findByIdAndUpdate(job._id, {
          status: 'pending',
          attempts,
          nextRunAt,
          lastError: error.message,
          $unset: { lockedAt: 1 }
        });
        this.emit('job-retry', jobId, job, error);
        console.log(`Retrying job ${jobId} in ${Math.round(delayMs / 1000 / 60)} minutes (attempt ${attempts})`);
      }
    }
  }

  /**
   * Get queue status and statistics
   */
  async getQueueStatus(): Promise<{
    totalJobs: number;
    pendingJobs: number;
    processingJobs: number;
    completedJobs: number;
    failedJobs: number;
  }> {
    const [pending, processing, completed, failed] = await Promise.all([
      IngestQueue.countDocuments({ status: 'pending' }),
      IngestQueue.countDocuments({ status: 'processing' }),
      IngestQueue.countDocuments({ status: 'done' }),
      IngestQueue.countDocuments({ status: 'failed' }),
    ]);

    const total = pending + processing + completed + failed;

    return {
      totalJobs: total,
      pendingJobs: pending,
      processingJobs: processing,
      completedJobs: completed,
      failedJobs: failed,
    };
  }

  /**
   * Get job status by source ID
   */
  async getJobStatus(sourceId: string): Promise<{
    status: string;
    attempts: number;
    nextRunAt?: Date;
    lastError?: string;
  } | null> {
    const job = await IngestQueue.findOne({ sourceId });
    if (!job) return null;

    return {
      status: job.status,
      attempts: job.attempts,
      nextRunAt: job.nextRunAt,
      lastError: job.lastError,
    };
  }

  /**
   * Clean up old completed/failed jobs
   */
  async cleanupOldJobs(olderThanDays = 7): Promise<number> {
    const cutoffDate = new Date(Date.now() - olderThanDays * 24 * 60 * 60 * 1000);
    
    const result = await IngestQueue.deleteMany({
      status: { $in: ['done', 'failed'] },
      updatedAt: { $lt: cutoffDate }
    });

    console.log(`Cleaned up ${result.deletedCount} old jobs`);
    return result.deletedCount;
  }
}

// Singleton instance
export const ingestionQueue = new IngestionQueue(); 