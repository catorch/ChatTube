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
  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();

    // Parse the video:// URL
    const match = href.match(/^video:\/\/([^\/]+)\/(\d+)$/);
    if (!match) {
      console.error("Invalid video reference format:", href);
      return;
    }

    const [, videoId, timestamp] = match;
    const timestampNum = parseInt(timestamp, 10);

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

    // Create YouTube URL with timestamp
    const youtubeUrl = `https://www.youtube.com/watch?v=${videoId}&t=${timestampNum}s`;

    // Show confirmation dialog with details
    const timeFormatted = formatTime(timestampNum);
    const confirmed = window.confirm(
      `Open video at ${timeFormatted}?\n\nThis will open YouTube in a new tab.`
    );

    if (confirmed) {
      window.open(youtubeUrl, "_blank", "noopener,noreferrer");
    }
  };

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
      title="Click to open video at this timestamp"
    >
      <Play className="h-3 w-3 flex-shrink-0" />
      <span>{children}</span>
      <ExternalLink className="h-3 w-3 flex-shrink-0 opacity-60" />
    </button>
  );
}
