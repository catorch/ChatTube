"use client";

import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { MarkdownMessage } from "./markdown-message";

interface ChatBubbleProps {
  content: string;
  isUser: boolean;
  isStreaming?: boolean;
  className?: string;
  timestamp?: Date;
  sources?: string[];
}

export function ChatBubble({
  content,
  isUser,
  isStreaming = false,
  className,
  timestamp,
  sources,
}: ChatBubbleProps) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.96, y: 10 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{
        type: "spring",
        stiffness: 380,
        damping: 28,
        duration: 0.4,
      }}
      className={cn(
        "group relative flex flex-col",
        isUser ? "items-end" : "items-start"
      )}
    >
      {/* Chat bubble */}
      <div
        className={cn(
          "relative px-4 py-3 shadow-[var(--elev-1)] break-words",
          "transition-all duration-200",
          // Responsive max-width: 80% on desktop, 100% with insets on mobile
          "max-w-full lg:max-w-[80%]",
          "w-fit",
          // Enhanced border radius using CSS variables
          "rounded-[var(--r-3)]",
          // Conditional styling based on sender
          isUser ? "lux-gradient text-white ml-auto" : "card-soft",
          className
        )}
      >
        <MarkdownMessage
          content={content}
          isUser={isUser}
          isStreaming={isStreaming}
          className={isUser ? "text-white" : ""}
        />

        {/* Streaming indicator with gradient reveal */}
        {isStreaming && (
          <div className="mt-2 flex items-center gap-2">
            <div className="flex gap-1">
              <div className="w-2 h-2 bg-current rounded-full opacity-60 animate-bounce" />
              <div
                className="w-2 h-2 bg-current rounded-full opacity-60 animate-bounce"
                style={{ animationDelay: "0.1s" }}
              />
              <div
                className="w-2 h-2 bg-current rounded-full opacity-60 animate-bounce"
                style={{ animationDelay: "0.2s" }}
              />
            </div>
            <span className="text-xs opacity-75 streaming-reveal">
              Generating response...
            </span>
          </div>
        )}
      </div>

      {/* Metadata */}
      {(timestamp || sources) && (
        <div
          className={cn(
            "flex items-center gap-2 mt-2 text-xs text-muted-foreground",
            isUser ? "justify-end" : "justify-start"
          )}
        >
          {timestamp && <span>{timestamp.toLocaleTimeString()}</span>}
          {sources && sources.length > 0 && (
            <span className="bg-muted/50 rounded-full px-2 py-0.5">
              {sources.length} sources
            </span>
          )}
        </div>
      )}
    </motion.div>
  );
}
