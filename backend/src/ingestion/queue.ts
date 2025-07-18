import { EventEmitter } from "events";
import IngestQueue from "../models/IngestQueue";
import { ProcessingJob, ProcessingStatus } from "./types";
import { SourceType } from "../models/Source";
import chalk from "chalk";

/**
 * MongoDB-based queue implementation for reliable job processing
 */
export class IngestionQueue extends EventEmitter {
  private isRunning = false;
  private maxParallelJobs = 2;
  private pollInterval = 2000; // 2 seconds

  constructor(options?: { maxParallelJobs?: number; pollInterval?: number }) {
    super();
    if (options?.maxParallelJobs)
      this.maxParallelJobs = options.maxParallelJobs;
    if (options?.pollInterval) this.pollInterval = options.pollInterval;
  }

  /**
   * Add a job to the queue
   */
  async addJob(job: ProcessingJob & { kind: SourceType }): Promise<string> {
    try {
      console.log(chalk.blue(`➕ [QUEUE] Adding new job to queue`));
      console.log(chalk.gray(`   • Source ID: ${job.sourceId}`));
      console.log(chalk.gray(`   • Type: ${job.kind}`));

      const queueItem = await IngestQueue.create({
        kind: job.kind,
        sourceId: job.sourceId,
        status: "pending",
        attempts: 0,
        nextRunAt: new Date(),
        payload: job,
      });

      this.emit("job-added", (queueItem._id as any).toString(), job);
      console.log(
        chalk.green(
          `✅ [QUEUE] Added job ${queueItem._id} for source ${job.sourceId}`
        )
      );

      return (queueItem._id as any).toString();
    } catch (error: any) {
      // Handle duplicate job error gracefully
      if (error.code === 11000) {
        console.log(
          chalk.yellow(
            `⚠️  [QUEUE] Job already exists for source ${job.sourceId}`
          )
        );
        const existingJob = await IngestQueue.findOne({
          sourceId: job.sourceId,
          status: { $in: ["pending", "processing"] },
        });
        return existingJob ? (existingJob._id as any).toString() : "";
      }
      console.log(chalk.red(`❌ [QUEUE] Failed to add job: ${error.message}`));
      throw error;
    }
  }

  /**
   * Start the worker process
   */
  async startWorker(): Promise<void> {
    if (this.isRunning) {
      console.log(chalk.yellow("⚠️  [WORKER] Worker is already running"));
      return;
    }

    this.isRunning = true;
    console.log(
      chalk.green.bold(
        `🚀 [WORKER] Starting ingestion worker with ${this.maxParallelJobs} parallel jobs`
      )
    );
    console.log(chalk.gray(`   • Poll interval: ${this.pollInterval}ms`));

    while (this.isRunning) {
      try {
        await this.processAvailableJobs();
      } catch (error) {
        console.log(chalk.red("💥 [WORKER] Error in worker loop:"), error);
      }

      // Wait before next polling cycle
      await new Promise((resolve) => setTimeout(resolve, this.pollInterval));
    }
  }

  /**
   * Stop the worker process
   */
  stopWorker(): void {
    this.isRunning = false;
    console.log(chalk.yellow("🛑 [WORKER] Stopping ingestion worker"));
  }

  /**
   * Process available jobs with concurrency limit
   */
  private async processAvailableJobs(): Promise<void> {
    // Create an array of promises to claim jobs concurrently up to the max parallel limit
    // Array.from creates an array with 'maxParallelJobs' elements, each calling claimJob()
    // Promise.all executes all claimJob() calls simultaneously for better performance
    const jobs = await Promise.all(
      Array.from({ length: this.maxParallelJobs }, () => this.claimJob())
    );

    // Filter out null/undefined values - claimJob() returns null when no jobs are available
    // Boolean filter removes falsy values (null, undefined, false, 0, etc.)
    const validJobs = jobs.filter(Boolean);

    // Early return if no jobs were successfully claimed - nothing to process
    if (validJobs.length === 0) return;

    // Log how many jobs we're about to process for monitoring/debugging
    console.log(
      chalk.blue.bold(
        `⚡ [WORKER] Processing ${validJobs.length} jobs concurrently`
      )
    );

    // Process all claimed jobs concurrently using Promise.all
    // Map each job to a processJob() promise, then wait for all to complete
    // The ! operator tells TypeScript that job is definitely not null (we filtered above)
    await Promise.all(validJobs.map((job) => this.processJob(job!)));
  }

  /**
   * Atomically claim a job for processing
   */
  private async claimJob(): Promise<any> {
    const now = new Date();

    return await IngestQueue.findOneAndUpdate(
      {
        status: "pending",
        nextRunAt: { $lte: now },
      },
      {
        $set: {
          status: "processing",
          lockedAt: now,
        },
      },
      {
        sort: { nextRunAt: 1 },
        new: true,
      }
    ).lean();
  }

  /**
   * Process a single job
   */
  private async processJob(job: any): Promise<void> {
    const jobId = job._id.toString();
    const startTime = Date.now();

    try {
      this.emit("job-started", jobId, job);
      console.log(chalk.blue.bold(`🔄 [JOB] Processing job ${jobId}`));
      console.log(chalk.cyan(`📋 [JOB] Job details:`));
      console.log(chalk.gray(`   • Source ID: ${job.sourceId}`));
      console.log(chalk.gray(`   • Type: ${job.kind}`));
      console.log(chalk.gray(`   • Attempt: ${(job.attempts || 0) + 1}`));

      // Import and call the processing service
      const { processSource } = await import("../ingestion/service");
      await processSource(job.sourceId.toString());

      const processingDuration = Date.now() - startTime;

      // Mark job as completed
      await IngestQueue.findByIdAndUpdate(job._id, {
        status: "done",
        $unset: { lockedAt: 1 }, // Remove lock
      });

      this.emit("job-completed", jobId, job);
      console.log(
        chalk.green.bold(
          `🎉 [JOB] Completed job ${jobId} in ${processingDuration}ms`
        )
      );
      console.log(chalk.gray(`   • Source: ${job.sourceId}`));
    } catch (error: any) {
      const processingDuration = Date.now() - startTime;
      console.log(
        chalk.red.bold(
          `💥 [JOB] Error processing job ${jobId} after ${processingDuration}ms:`
        )
      );
      console.log(chalk.red(`   Error: ${error.message}`));

      const attempts = (job.attempts || 0) + 1;
      const maxAttempts = 5;
      const shouldFail = attempts >= maxAttempts;

      if (shouldFail) {
        await IngestQueue.findByIdAndUpdate(job._id, {
          status: "failed",
          attempts,
          lastError: error.message,
          $unset: { lockedAt: 1 },
        });
        this.emit("job-failed", jobId, job, error);
        console.log(
          chalk.red.bold(
            `❌ [JOB] Failed job ${jobId} after ${attempts} attempts`
          )
        );
        console.log(chalk.gray(`   • Source: ${job.sourceId}`));
        console.log(chalk.gray(`   • Final error: ${error.message}`));
      } else {
        // Exponential backoff: retry in 1min, 2min, 4min, 8min
        const delayMs = Math.min(
          1000 * 60 * Math.pow(2, attempts - 1),
          1000 * 60 * 30
        ); // Max 30 min
        const nextRunAt = new Date(Date.now() + delayMs);

        await IngestQueue.findByIdAndUpdate(job._id, {
          status: "pending",
          attempts,
          nextRunAt,
          lastError: error.message,
          $unset: { lockedAt: 1 },
        });
        this.emit("job-retry", jobId, job, error);
        console.log(
          chalk.yellow.bold(
            `🔄 [JOB] Retrying job ${jobId} in ${Math.round(
              delayMs / 1000 / 60
            )} minutes`
          )
        );
        console.log(chalk.gray(`   • Attempt: ${attempts}/${maxAttempts}`));
        console.log(chalk.gray(`   • Source: ${job.sourceId}`));
        console.log(chalk.gray(`   • Error: ${error.message}`));
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
      IngestQueue.countDocuments({ status: "pending" }),
      IngestQueue.countDocuments({ status: "processing" }),
      IngestQueue.countDocuments({ status: "done" }),
      IngestQueue.countDocuments({ status: "failed" }),
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
    const cutoffDate = new Date(
      Date.now() - olderThanDays * 24 * 60 * 60 * 1000
    );

    const result = await IngestQueue.deleteMany({
      status: { $in: ["done", "failed"] },
      updatedAt: { $lt: cutoffDate },
    });

    console.log(`Cleaned up ${result.deletedCount} old jobs`);
    return result.deletedCount;
  }
}

// Singleton instance
export const ingestionQueue = new IngestionQueue();
