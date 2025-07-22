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
  citationMap?: Record<string, any>;
}

export function ChatBubble({
  content,
  isUser,
  isStreaming = false,
  className,
  timestamp,
  sources,
  citationMap,
}: ChatBubbleProps) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.94, y: 20 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.94, y: -10 }}
      transition={{
        type: "spring",
        stiffness: 400,
        damping: 30,
        mass: 0.8,
      }}
      whileHover={{ 
        scale: 1.005,
        transition: { duration: 0.2 }
      }}
      className={cn(
        "group relative flex flex-col cursor-default",
        isUser ? "items-end" : "items-start"
      )}
    >
      {/* Chat bubble */}
      <motion.div
        className={cn(
          "relative px-5 py-4 shadow-[var(--elev-1)] break-words",
          "transition-all duration-300 hover:shadow-[var(--elev-2)]",
          // Responsive max-width: 85% on desktop, 100% with insets on mobile
          "max-w-full lg:max-w-[85%]",
          "w-fit select-text",
          // Enhanced border radius using CSS variables
          "rounded-[var(--r-3)]",
          // Conditional styling based on sender
          isUser 
            ? "lux-gradient text-white ml-auto hover:shadow-primary/20" 
            : "card-soft hover:bg-surface-2/30 hover:border-primary/10",
          className
        )}
        whileHover={{
          y: -1,
          transition: { duration: 0.15 }
        }}
      >
        <MarkdownMessage
          content={content}
          isUser={isUser}
          isStreaming={isStreaming}
          className={isUser ? "text-white" : ""}
          citationMap={citationMap}
        />

        {/* Enhanced streaming indicator */}
        {isStreaming && (
          <motion.div 
            className="mt-3 flex items-center gap-3"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.1 }}
          >
            <div className="flex gap-1">
              <motion.div 
                className="w-2.5 h-2.5 bg-current rounded-full"
                animate={{ 
                  scale: [1, 1.3, 1],
                  opacity: [0.4, 1, 0.4]
                }}
                transition={{
                  duration: 1.2,
                  repeat: Infinity,
                  ease: "easeInOut"
                }}
              />
              <motion.div 
                className="w-2.5 h-2.5 bg-current rounded-full"
                animate={{ 
                  scale: [1, 1.3, 1],
                  opacity: [0.4, 1, 0.4]
                }}
                transition={{
                  duration: 1.2,
                  delay: 0.2,
                  repeat: Infinity,
                  ease: "easeInOut"
                }}
              />
              <motion.div 
                className="w-2.5 h-2.5 bg-current rounded-full"
                animate={{ 
                  scale: [1, 1.3, 1],
                  opacity: [0.4, 1, 0.4]
                }}
                transition={{
                  duration: 1.2,
                  delay: 0.4,
                  repeat: Infinity,
                  ease: "easeInOut"
                }}
              />
            </div>
            <span className="text-xs opacity-75 streaming-reveal font-medium">
              AI is thinking...
            </span>
          </motion.div>
        )}
      </motion.div>

      {/* Enhanced metadata with better styling */}
      {(timestamp || sources) && (
        <motion.div
          className={cn(
            "flex items-center gap-2 mt-3 text-xs text-muted-foreground/70",
            "opacity-0 group-hover:opacity-100 transition-all duration-200",
            isUser ? "justify-end" : "justify-start"
          )}
          initial={{ opacity: 0 }}
          animate={{ opacity: 0 }}
          whileHover={{ opacity: 1 }}
        >
          {timestamp && (
            <span className="bg-background/70 backdrop-blur-sm px-2 py-1 rounded-md border border-border/30 text-xs font-medium">
              {timestamp.toLocaleTimeString([], {
                hour: '2-digit',
                minute: '2-digit'
              })}
            </span>
          )}
          {sources && sources.length > 0 && (
            <span className="bg-primary/5 text-primary border border-primary/20 rounded-full px-2.5 py-1 text-xs font-medium">
              <span className="w-1.5 h-1.5 bg-primary rounded-full inline-block mr-1.5" />
              {sources.length} sources
            </span>
          )}
        </motion.div>
      )}
    </motion.div>
  );
}
