import { formatTimestamp, createYouTubeTimestampUrl } from "./timestampUtils";
import { Types } from "mongoose";

export interface CitationInfo {
  label: string; // "^1", "^2", …
  display: string; // text that goes inside the answer
  chunk: any; // populated chunk with source
}

export function buildCitations(chunks: any[]): {
  contextLines: string[];
  citationInfos: CitationInfo[];
} {
  const contextLines: string[] = [];
  const citationInfos: CitationInfo[] = [];

  chunks.forEach((chunk, i) => {
    const label = `^${i + 1}`;

    // ---- UI display inside answer ----
    let display = `[${label}]`; // default citation format

    // For YouTube videos, provide clickable video link if timestamp available
    if (chunk.source.kind === "youtube") {
      const vid =
        chunk.source.metadata?.videoId ??
        chunk.source.url?.split("v=")[1]?.split("&")[0];
      if (vid && chunk.startTime !== undefined) {
        display = `[${label}](video://${vid}/${Math.floor(chunk.startTime)})`;
      }
    }

    // ---- text for system prompt ----
    let line = `[${label}] From ${getSourceTypeLabel(chunk.source.kind)} "${
      chunk.source.title ?? "Untitled"
    }"`;

    // Add timestamp info for YouTube content
    if (chunk.source.kind === "youtube" && chunk.startTime !== undefined) {
      line += ` at ${formatTimestamp(chunk.startTime)}`;
    }

    // Add relevance score
    if (chunk.score) {
      line += ` (Relevance: ${(chunk.score * 100).toFixed(1)}%)`;
    }

    line += `: ${chunk.text}`;

    contextLines.push(line);

    citationInfos.push({
      label,
      display,
      chunk,
    });
  });

  return { contextLines, citationInfos };
}

function getSourceTypeLabel(kind: string): string {
  switch (kind) {
    case "youtube":
      return "YouTube video";
    case "web":
    case "website":
      return "website";
    case "pdf":
      return "PDF document";
    case "file":
      return "document";
    default:
      return "source";
  }
}
