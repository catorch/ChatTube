import { Source } from "../features/sources/sourcesSlice";
import { Video } from "./types";

/**
 * Converts a backend Video to a frontend Source
 */
export function mapVideoToSource(video: Video): Source {
  // Determine source status based on processing status
  let status: Source["status"];
  switch (video.processingStatus) {
    case "completed":
      status = "active";
      break;
    case "processing":
      status = "processing";
      break;
    case "failed":
      status = "error";
      break;
    default:
      status = "inactive";
  }

  return {
    id: video._id,
    name: video.title,
    type: "youtube",
    url: `https://www.youtube.com/watch?v=${video.videoId}`,
    thumbnail: video.thumbnailUrl,
    description:
      video.description ||
      `${video.channelName} • ${formatDuration(video.duration)}`,
    isSelected: false,
    lastUpdated: video.updatedAt,
    status,
  };
}

/**
 * Converts an array of backend Videos to frontend Sources
 */
export function mapVideosToSources(videos: Video[]): Source[] {
  return videos.map(mapVideoToSource);
}

/**
 * Formats duration in seconds to a readable string (e.g., "5:32" or "1:23:45")
 */
function formatDuration(seconds: number): string {
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
