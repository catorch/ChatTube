import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Video reference utilities
export function parseVideoReference(href: string) {
  const match = href.match(/^video:\/\/([^\/]+)\/(\d+)$/);
  if (!match) {
    return null;
  }
  return {
    videoId: match[1],
    timestamp: parseInt(match[2], 10),
  };
}

export function createYouTubeUrl(videoId: string, timestamp: number): string {
  return `https://www.youtube.com/watch?v=${videoId}&t=${timestamp}s`;
}

export function formatTimestamp(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, "0")}:${secs
      .toString()
      .padStart(2, "0")}`;
  } else {
    return `${minutes}:${secs.toString().padStart(2, "0")}`;
  }
}

// Test video reference parsing (for debugging)
export function testVideoReference(href: string) {
  const parsed = parseVideoReference(href);
  if (!parsed) {
    console.log(`❌ Invalid video reference: ${href}`);
    return null;
  }

  const youtubeUrl = createYouTubeUrl(parsed.videoId, parsed.timestamp);
  const timeFormatted = formatTimestamp(parsed.timestamp);

  console.log(`✅ Video Reference Parsed:
    📹 Video ID: ${parsed.videoId}
    ⏰ Timestamp: ${parsed.timestamp}s (${timeFormatted})
    🔗 YouTube URL: ${youtubeUrl}`);

  return {
    ...parsed,
    youtubeUrl,
    timeFormatted,
  };
}
