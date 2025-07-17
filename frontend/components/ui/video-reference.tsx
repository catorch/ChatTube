"use client";

import { cn } from "@/lib/utils";
import { ExternalLink, Play } from "lucide-react";

interface VideoReferenceProps {
  href: string; // Format: video://videoId/timestamp
  children: React.ReactNode;
  className?: string;
  isUser?: boolean;
}

export function VideoReference({
  href,
  children,
  className,
  isUser = false,
}: VideoReferenceProps) {
  // Parse the video:// URL to extract info
  const parseVideoRef = () => {
    const match = href.match(/^video:\/\/([^\/]+)\/(\d+)$/);
    if (!match) {
      console.error("Invalid video reference format:", href);
      return null;
    }
    return {
      videoId: match[1],
      timestamp: parseInt(match[2], 10),
    };
  };

  const videoInfo = parseVideoRef();

  // Format timestamp for display
  const formatTime = (seconds: number) => {
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
  };

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();

    if (!videoInfo) return;

    // Create YouTube URL with timestamp
    const youtubeUrl = `https://www.youtube.com/watch?v=${videoInfo.videoId}&t=${videoInfo.timestamp}s`;

    // Open directly without confirmation for smoother UX
    window.open(youtubeUrl, "_blank", "noopener,noreferrer");
  };

  if (!videoInfo) {
    // Fallback for invalid video references
    return (
      <span className="text-red-500 text-sm">[Invalid video reference]</span>
    );
  }

  const timeFormatted = formatTime(videoInfo.timestamp);

  return (
    <button
      onClick={handleClick}
      className={cn(
        // Base styles for interactive video reference
        "inline-flex items-center gap-1 rounded-md px-2 py-1 text-sm font-medium",
        "transition-all duration-200 hover:scale-105",
        "border border-transparent hover:border-current/20",
        "focus:outline-none focus:ring-2 focus:ring-current/20 focus:ring-offset-1",

        // Theme-specific colors
        isUser
          ? "bg-white/10 text-white hover:bg-white/20 hover:text-white"
          : "bg-primary/10 text-primary hover:bg-primary/20 hover:text-primary",

        className
      )}
      title={`Click to open video at ${timeFormatted} - Opens YouTube in new tab`}
    >
      <Play className="h-3 w-3 flex-shrink-0" />
      <span className="flex items-center gap-1">
        <span>{children}</span>
        <span className="opacity-75 font-mono text-xs">({timeFormatted})</span>
      </span>
      <ExternalLink className="h-3 w-3 flex-shrink-0 opacity-60" />
    </button>
  );
}
