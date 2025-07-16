/**
 * Utility functions for handling precise video timestamps
 */

export interface TimestampInfo {
  seconds: number;
  formatted: string; // HH:MM:SS format
  youtubeUrl: string; // YouTube URL with timestamp
}

/**
 * Convert seconds to HH:MM:SS format
 */
export function formatTimestamp(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, "0")}:${secs
      .toString()
      .padStart(2, "0")}`;
  } else {
    return `${minutes}:${secs.toString().padStart(2, "0")}`;
  }
}

/**
 * Create YouTube URL with timestamp
 */
export function createYouTubeTimestampUrl(
  videoId: string,
  seconds: number
): string {
  const timestamp = Math.floor(seconds);
  return `https://www.youtube.com/watch?v=${videoId}&t=${timestamp}s`;
}

/**
 * Get comprehensive timestamp information
 */
export function getTimestampInfo(
  videoId: string,
  seconds: number
): TimestampInfo {
  return {
    seconds,
    formatted: formatTimestamp(seconds),
    youtubeUrl: createYouTubeTimestampUrl(videoId, seconds),
  };
}

/**
 * Format timestamp range for display
 */
export function formatTimestampRange(
  startSeconds: number,
  endSeconds: number
): string {
  return `${formatTimestamp(startSeconds)} - ${formatTimestamp(endSeconds)}`;
}

/**
 * Calculate segment duration
 */
export function getSegmentDuration(
  startSeconds: number,
  endSeconds: number
): number {
  return endSeconds - startSeconds;
}

/**
 * Check if timestamp is within a segment
 */
export function isTimestampInSegment(
  timestamp: number,
  segmentStart: number,
  segmentEnd: number
): boolean {
  return timestamp >= segmentStart && timestamp <= segmentEnd;
}

/**
 * Find the most relevant timestamp for a text match
 * (useful when a segment contains multiple sentences)
 */
export function estimateTextTimestamp(
  segmentStart: number,
  segmentEnd: number,
  fullText: string,
  matchText: string
): number {
  const textIndex = fullText.toLowerCase().indexOf(matchText.toLowerCase());
  if (textIndex === -1) {
    return segmentStart; // Default to segment start if not found
  }

  const textProgress = textIndex / fullText.length;
  const segmentDuration = segmentEnd - segmentStart;

  return segmentStart + segmentDuration * textProgress;
}

/**
 * Format search result with precise timestamp information
 */
export interface SearchResultWithTimestamp {
  text: string;
  startTime: number;
  endTime: number;
  timestamp: TimestampInfo;
  duration: number;
  confidenceMetrics?: {
    avgLogProb?: number;
    noSpeechProb?: number;
    compressionRatio?: number;
  };
}

export function formatSearchResult(
  videoId: string,
  segment: {
    text: string;
    startTime: number;
    endTime: number;
    avgLogProb?: number;
    noSpeechProb?: number;
    compressionRatio?: number;
  }
): SearchResultWithTimestamp {
  return {
    text: segment.text,
    startTime: segment.startTime,
    endTime: segment.endTime,
    timestamp: getTimestampInfo(videoId, segment.startTime),
    duration: getSegmentDuration(segment.startTime, segment.endTime),
    confidenceMetrics: {
      avgLogProb: segment.avgLogProb,
      noSpeechProb: segment.noSpeechProb,
      compressionRatio: segment.compressionRatio,
    },
  };
}
