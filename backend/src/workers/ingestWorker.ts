#!/usr/bin/env node

/**
 * Standalone ingestion worker process
 * 
 * This worker polls the MongoDB queue for pending ingestion jobs
 * and processes them using the appropriate processor for each source type.
 * 
 * Usage:
 *   npm run worker
 *   node dist/workers/ingestWorker.js
 * 
 * Environment variables:
 *   WORKER_CONCURRENCY - Max parallel jobs (default: 2)
 *   WORKER_POLL_INTERVAL - Poll interval in milliseconds (default: 2000)
 *   MONGODB_URI - MongoDB connection string
 */

import mongoose from 'mongoose';
import { config } from 'dotenv';
import { ingestionQueue } from '../ingestion/queue';

// Load environment variables
config();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/chattube';
const WORKER_CONCURRENCY = parseInt(process.env.WORKER_CONCURRENCY || '2');
const WORKER_POLL_INTERVAL = parseInt(process.env.WORKER_POLL_INTERVAL || '2000');

async function connectDatabase() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('Connected to MongoDB');
  } catch (error) {
    console.error('Failed to connect to MongoDB:', error);
    process.exit(1);
  }
}

async function startWorker() {
  console.log('Starting ingestion worker...');
  console.log(`Configuration:`);
  console.log(`  - Concurrency: ${WORKER_CONCURRENCY}`);
  console.log(`  - Poll Interval: ${WORKER_POLL_INTERVAL}ms`);
  console.log(`  - MongoDB URI: ${MONGODB_URI}`);

  // Configure the queue
  const queue = new (await import('../ingestion/queue')).IngestionQueue({
    maxParallelJobs: WORKER_CONCURRENCY,
    pollInterval: WORKER_POLL_INTERVAL,
  });

  // Set up event listeners for monitoring
  queue.on('job-added', (jobId, job) => {
    console.log(`[QUEUE] Job added: ${jobId} (source: ${job.sourceId})`);
  });

  queue.on('job-started', (jobId, job) => {
    console.log(`[WORKER] Processing job: ${jobId} (source: ${job.sourceId})`);
  });

  queue.on('job-completed', (jobId, job) => {
    console.log(`[WORKER] Completed job: ${jobId} (source: ${job.sourceId})`);
  });

  queue.on('job-retry', (jobId, job, error) => {
    console.log(`[WORKER] Retrying job: ${jobId} (attempt: ${job.attempts + 1}, error: ${error.message})`);
  });

  queue.on('job-failed', (jobId, job, error) => {
    console.error(`[WORKER] Failed job: ${jobId} (source: ${job.sourceId}, error: ${error.message})`);
  });

  // Handle graceful shutdown
  process.on('SIGINT', async () => {
    console.log('\nReceived SIGINT. Stopping worker gracefully...');
    queue.stopWorker();
    await mongoose.disconnect();
    console.log('Worker stopped. Goodbye!');
    process.exit(0);
  });

  process.on('SIGTERM', async () => {
    console.log('\nReceived SIGTERM. Stopping worker gracefully...');
    queue.stopWorker();
    await mongoose.disconnect();
    console.log('Worker stopped. Goodbye!');
    process.exit(0);
  });

  // Start the worker
  await queue.startWorker();
}

async function showQueueStatus() {
  const status = await ingestionQueue.getQueueStatus();
  console.log('\nQueue Status:');
  console.log(`  - Total Jobs: ${status.totalJobs}`);
  console.log(`  - Pending: ${status.pendingJobs}`);
  console.log(`  - Processing: ${status.processingJobs}`);
  console.log(`  - Completed: ${status.completedJobs}`);
  console.log(`  - Failed: ${status.failedJobs}`);
}

async function main() {
  const command = process.argv[2];

  await connectDatabase();

  switch (command) {
    case 'status':
      await showQueueStatus();
      process.exit(0);
      break;
    
    case 'cleanup':
      const days = parseInt(process.argv[3]) || 7;
      console.log(`Cleaning up jobs older than ${days} days...`);
      const cleaned = await ingestionQueue.cleanupOldJobs(days);
      console.log(`Cleaned up ${cleaned} old jobs`);
      process.exit(0);
      break;
    
    case 'start':
    default:
      await startWorker();
      break;
  }
}

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception thrown:', error);
  process.exit(1);
});

// Start the worker
main().catch((error) => {
  console.error('Worker failed to start:', error);
  process.exit(1);
}); 