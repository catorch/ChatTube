import fs from "fs";
import path from "path";
import { promisify } from "util";

const unlink = promisify(fs.unlink);
const readdir = promisify(fs.readdir);
const stat = promisify(fs.stat);

export class FileCleanupManager {
  private tempDir: string;
  private maxFileAge: number; // in milliseconds

  constructor(tempDir?: string, maxFileAgeHours: number = 24) {
    this.tempDir = tempDir || path.join(process.cwd(), "temp");
    this.maxFileAge = maxFileAgeHours * 60 * 60 * 1000; // Convert hours to milliseconds
  }

  /**
   * Clean up old temporary files
   */
  async cleanupOldFiles(): Promise<void> {
    try {
      const files = await readdir(this.tempDir);
      const now = Date.now();
      const cleanupPromises: Promise<void>[] = [];

      for (const file of files) {
        const filePath = path.join(this.tempDir, file);

        try {
          const stats = await stat(filePath);
          const fileAge = now - stats.mtime.getTime();

          if (fileAge > this.maxFileAge) {
            cleanupPromises.push(this.deleteFile(filePath));
          }
        } catch (error) {
          console.warn(`Failed to check file age for ${filePath}:`, error);
        }
      }

      await Promise.all(cleanupPromises);
      console.log(`Cleaned up ${cleanupPromises.length} old temporary files`);
    } catch (error) {
      console.error("Error during cleanup:", error);
    }
  }

  /**
   * Delete a specific file with error handling
   */
  private async deleteFile(filePath: string): Promise<void> {
    try {
      await unlink(filePath);
      console.log(`Deleted old temp file: ${path.basename(filePath)}`);
    } catch (error) {
      console.warn(`Failed to delete file ${filePath}:`, error);
    }
  }

  /**
   * Start automatic cleanup interval
   */
  startCleanupInterval(intervalHours: number = 6): NodeJS.Timeout {
    const intervalMs = intervalHours * 60 * 60 * 1000;

    console.log(`Starting file cleanup interval: every ${intervalHours} hours`);

    return setInterval(() => {
      this.cleanupOldFiles();
    }, intervalMs);
  }

  /**
   * Clean up files by pattern (e.g., specific video ID)
   */
  async cleanupByPattern(pattern: string): Promise<void> {
    try {
      const files = await readdir(this.tempDir);
      const matchingFiles = files.filter((file) => file.includes(pattern));

      const cleanupPromises = matchingFiles.map((file) =>
        this.deleteFile(path.join(this.tempDir, file))
      );

      await Promise.all(cleanupPromises);
      console.log(
        `Cleaned up ${matchingFiles.length} files matching pattern: ${pattern}`
      );
    } catch (error) {
      console.error(`Error cleaning up files with pattern ${pattern}:`, error);
    }
  }
}

// Singleton instance for global use
export const fileCleanupManager = new FileCleanupManager();

// Auto-start cleanup interval when module is loaded
let cleanupInterval: NodeJS.Timeout | null = null;

export function startGlobalCleanup(): void {
  if (!cleanupInterval) {
    cleanupInterval = fileCleanupManager.startCleanupInterval(6); // Every 6 hours
  }
}

export function stopGlobalCleanup(): void {
  if (cleanupInterval) {
    clearInterval(cleanupInterval);
    cleanupInterval = null;
    console.log("Stopped global file cleanup interval");
  }
}
