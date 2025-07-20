import mongoose from "mongoose";
import Source from "../models/Source";
import SourceChunk from "../models/SourceChunk";
import Chat from "../models/Chat";
import { getProcessor } from "./registry";
import { IngestionResult } from "./types";
import { summarizeSource } from "../services/summarizationService";
import chalk from "chalk";

/**
 * Process a source by its ID using the appropriate processor
 */
export async function processSource(sourceId: string): Promise<void> {
  console.log(
    chalk.blue.bold(
      `🚀 [INGESTION] Starting processing for source: ${sourceId}`
    )
  );

  const source = await Source.findById(sourceId);
  if (!source) {
    console.log(chalk.red.bold(`❌ [INGESTION] Source not found: ${sourceId}`));
    throw new Error(`Source not found: ${sourceId}`);
  }

  console.log(chalk.cyan(`📋 [INGESTION] Source details:`));
  console.log(chalk.gray(`   • Type: ${source.kind}`));
  console.log(chalk.gray(`   • Title: ${source.title || "Untitled"}`));
  console.log(chalk.gray(`   • URL: ${source.url || "N/A"}`));
  console.log(chalk.gray(`   • Chat ID: ${source.chatId}`));

  // Update status to processing
  console.log(
    chalk.yellow(`⏳ [INGESTION] Updating source status to 'processing'...`)
  );
  await Source.findByIdAndUpdate(sourceId, {
    $set: {
      "metadata.processingStatus": "processing",
      "metadata.startedAt": new Date(),
    },
  });
  console.log(chalk.green(`✅ [INGESTION] Status updated to processing`));

  try {
    console.log(
      chalk.blue(`🔧 [PROCESSOR] Getting processor for type: ${source.kind}`)
    );

    // Get the appropriate processor for this source type
    const processor = getProcessor(source.kind);
    console.log(
      chalk.green(`✅ [PROCESSOR] Found processor for ${source.kind}`)
    );

    console.log(
      chalk.blue.bold(
        `🎬 [PROCESSOR] Starting ${source.kind.toUpperCase()} processing...`
      )
    );
    const processingStartTime = Date.now();

    // Process the source
    const result: IngestionResult = await processor.ingest(source);

    const processingDuration = Date.now() - processingStartTime;
    console.log(
      chalk.green.bold(
        `🎉 [PROCESSOR] Processing completed in ${processingDuration}ms`
      )
    );
    console.log(
      chalk.cyan(`📊 [PROCESSOR] Generated ${result.chunks.length} chunks`)
    );

    console.log(
      chalk.blue(`💾 [DATABASE] Preparing to save chunks to database...`)
    );

    // Save the chunks to the database
    const sourceChunks = result.chunks.map((chunk, index) => ({
      sourceId: source._id,
      chunkIndex: index,
      text: chunk.text,
      startTime: chunk.startTime,
      endTime: chunk.endTime,
      embedding: chunk.metadata?.embedding,
      tokenCount: chunk.metadata?.tokenCount || chunk.text.split(" ").length,
      metadata: {
        ...chunk.metadata,
        embedding: undefined, // Remove embedding from metadata since it's a separate field
      },
    }));

    console.log(
      chalk.yellow(
        `💾 [DATABASE] Inserting ${sourceChunks.length} chunks in batch...`
      )
    );
    const dbStartTime = Date.now();

    // Insert all chunks in batch
    const insertedChunks = await SourceChunk.insertMany(sourceChunks);

    const dbDuration = Date.now() - dbStartTime;
    console.log(
      chalk.green(
        `✅ [DATABASE] Inserted ${insertedChunks.length} chunks in ${dbDuration}ms`
      )
    );

    console.log(
      chalk.blue(`📝 [DATABASE] Updating source with completion status...`)
    );

    // Update source with processing results
    await Source.findByIdAndUpdate(sourceId, {
      $set: {
        ...result.metadata,
        "metadata.processingStatus": "completed",
        "metadata.isProcessed": true,
        "metadata.completedAt": new Date(),
        "metadata.chunksCount": insertedChunks.length,
        "metadata.totalProcessingTime":
          Date.now() -
          new Date(source.metadata?.startedAt || new Date()).getTime(),
      },
    });

    const totalDuration =
      Date.now() - new Date(source.metadata?.startedAt || new Date()).getTime();
    console.log(
      chalk.green.bold(
        `🎯 [INGESTION] Successfully completed processing source ${sourceId}`
      )
    );
    console.log(chalk.cyan(`📈 [INGESTION] Final stats:`));
    console.log(chalk.gray(`   • Total processing time: ${totalDuration}ms`));
    console.log(chalk.gray(`   • Chunks created: ${insertedChunks.length}`));
    console.log(chalk.gray(`   • Source type: ${source.kind}`));

    // Auto-populate chat metadata if this is the first source
    try {
      const chat = await Chat.findById(source.chatId);

      if (
        chat &&
        chat.sourceIds.length === 1 &&
        (!chat.title || chat.title === "New Chat")
      ) {
        console.log(
          chalk.blue(
            `🎨 [AUTO-SUMMARIZATION] Generating title and summary for first source...`
          )
        );

        const { title, summary, emoji } = await summarizeSource(sourceId);

        await Chat.findByIdAndUpdate(chat.id, {
          $set: { title, summary, emoji },
        });

        // Also store on source
        await Source.findByIdAndUpdate(sourceId, {
          $set: {
            "metadata.autoSummary": summary,
            "metadata.autoTitle": title,
            "metadata.autoEmoji": emoji,
          },
        });

        console.log(
          chalk.green.bold(
            `📝 [AUTO-SUMMARIZATION] Auto-named chat "${title}" ${emoji}`
          )
        );
      } else {
        console.log(
          chalk.gray(
            `📝 [AUTO-SUMMARIZATION] Skipping - not first source or chat already has title`
          )
        );
      }
    } catch (error) {
      // Don't fail the entire ingestion if summarization fails
      console.log(
        chalk.yellow(
          `⚠️ [AUTO-SUMMARIZATION] Failed to generate summary: ${error}`
        )
      );
    }
  } catch (error: any) {
    const errorDuration =
      Date.now() - new Date(source.metadata?.startedAt || new Date()).getTime();
    console.log(
      chalk.red.bold(
        `💥 [INGESTION] Error processing source ${sourceId} after ${errorDuration}ms:`
      )
    );
    console.log(chalk.red(`   Error: ${error.message}`));
    console.log(chalk.gray(`   Stack: ${error.stack}`));

    console.log(
      chalk.yellow(`📝 [DATABASE] Updating source with error status...`)
    );

    // Update source with error status
    await Source.findByIdAndUpdate(sourceId, {
      $set: {
        "metadata.processingStatus": "failed",
        "metadata.errorMessage": error.message,
        "metadata.failedAt": new Date(),
        "metadata.totalProcessingTime": errorDuration,
      },
    });

    console.log(
      chalk.red(`❌ [INGESTION] Source ${sourceId} marked as failed`)
    );
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
    status: source.metadata?.processingStatus || "pending",
    message: source.metadata?.message,
    progress: source.metadata?.progress,
    error: source.metadata?.errorMessage,
  };
}

/**
 * Queue a source for processing
 */
export async function queueSourceForProcessing(
  sourceId: string
): Promise<void> {
  const source = await Source.findById(sourceId);
  if (!source) {
    throw new Error(`Source not found: ${sourceId}`);
  }

  const { ingestionQueue } = await import("./queue");

  await ingestionQueue.addJob({
    sourceId,
    type: "ingest",
    kind: source.kind,
  });
}

/**
 * Process source synchronously (for testing or immediate processing)
 */
export async function processSourceSync(sourceId: string): Promise<void> {
  await processSource(sourceId);
}
