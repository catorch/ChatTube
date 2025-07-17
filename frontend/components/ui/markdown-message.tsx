"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeHighlight from "rehype-highlight";
import { cn } from "@/lib/utils";
import { VideoReference } from "./video-reference";

interface MarkdownMessageProps {
  content: string;
  isUser?: boolean;
  isStreaming?: boolean;
  className?: string;
}

export function MarkdownMessage({
  content,
  isUser = false,
  isStreaming = false,
  className,
}: MarkdownMessageProps) {
  return (
    <div className={cn("prose prose-sm max-w-none", className)}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeHighlight]}
        urlTransform={(url) => {
          // Allow our custom video:// protocol
          if (url.startsWith("video://")) {
            console.log("urlTransform preserving video URL:", url);
            return url;
          }
          // Default behavior for other URLs
          return url;
        }}
        components={{
          // Customize elements to match our design
          p: ({ children, ...props }) => (
            <p className="text-sm leading-relaxed mb-2 last:mb-0" {...props}>
              {children}
            </p>
          ),

          // Code blocks
          pre: ({ children, ...props }) => (
            <pre
              className={cn(
                "bg-muted/50 border border-border rounded-lg p-3 my-2 overflow-x-auto text-xs",
                isUser ? "bg-white/10 border-white/20" : ""
              )}
              {...props}
            >
              {children}
            </pre>
          ),

          // Inline code
          code: ({ children, className, ...props }) => {
            const isInlineCode = !className;
            return (
              <code
                className={cn(
                  isInlineCode &&
                    cn(
                      "bg-muted/50 border border-border rounded px-1 py-0.5 text-xs font-mono",
                      isUser ? "bg-white/10 border-white/20" : ""
                    ),
                  className
                )}
                {...props}
              >
                {children}
              </code>
            );
          },

          // Lists
          ul: ({ children, ...props }) => (
            <ul className="list-disc pl-4 my-2 space-y-1" {...props}>
              {children}
            </ul>
          ),

          ol: ({ children, ...props }) => (
            <ol className="list-decimal pl-4 my-2 space-y-1" {...props}>
              {children}
            </ol>
          ),

          li: ({ children, ...props }) => (
            <li className="text-sm leading-relaxed" {...props}>
              {children}
            </li>
          ),

          // Headings
          h1: ({ children, ...props }) => (
            <h1
              className="text-lg font-semibold mb-2 mt-3 first:mt-0"
              {...props}
            >
              {children}
            </h1>
          ),

          h2: ({ children, ...props }) => (
            <h2
              className="text-base font-semibold mb-2 mt-3 first:mt-0"
              {...props}
            >
              {children}
            </h2>
          ),

          h3: ({ children, ...props }) => (
            <h3
              className="text-sm font-semibold mb-1 mt-2 first:mt-0"
              {...props}
            >
              {children}
            </h3>
          ),

          // Blockquotes
          blockquote: ({ children, ...props }) => (
            <blockquote
              className={cn(
                "border-l-4 border-border pl-4 my-2 italic",
                isUser ? "border-white/20" : ""
              )}
              {...props}
            >
              {children}
            </blockquote>
          ),

          // Tables
          table: ({ children, ...props }) => (
            <div className="overflow-x-auto my-2">
              <table
                className={cn(
                  "min-w-full border-collapse border border-border text-xs",
                  isUser ? "border-white/20" : ""
                )}
                {...props}
              >
                {children}
              </table>
            </div>
          ),

          th: ({ children, ...props }) => (
            <th
              className={cn(
                "border border-border px-2 py-1 bg-muted/30 font-medium text-left",
                isUser ? "border-white/20 bg-white/10" : ""
              )}
              {...props}
            >
              {children}
            </th>
          ),

          td: ({ children, ...props }) => (
            <td
              className={cn(
                "border border-border px-2 py-1",
                isUser ? "border-white/20" : ""
              )}
              {...props}
            >
              {children}
            </td>
          ),

          // Links (with special handling for video references)
          a: ({ children, href, ...props }) => {
            // Debug logging
            console.log("Link detected:", { href, children, props });

            // Check if this is a video reference
            if (href && href.startsWith("video://")) {
              console.log("Video reference detected:", href);
              return (
                <VideoReference href={href} isUser={isUser} className="mx-0.5">
                  {children}
                </VideoReference>
              );
            }

            // Fallback: Check if this looks like a video reference by content (📺 followed by number)
            const childrenText =
              typeof children === "string"
                ? children
                : Array.isArray(children)
                ? children.join("")
                : String(children);
            const videoRefPattern = /^📺\s*\d+$/;
            if (videoRefPattern.test(childrenText.trim())) {
              console.log(
                "Video reference detected by pattern:",
                childrenText,
                "href:",
                href
              );
              // Since href might be stripped, show debug info
              return (
                <span
                  className={cn(
                    "inline-flex items-center gap-1 rounded-md px-2 py-1 text-sm font-medium bg-red-100 text-red-800",
                    "border border-red-200"
                  )}
                >
                  {children} (href: {href || "undefined"})
                </span>
              );
            }

            // Regular link
            return (
              <a
                className={cn(
                  "underline underline-offset-2 hover:no-underline",
                  isUser
                    ? "text-white hover:text-white/80"
                    : "text-primary hover:text-primary/80"
                )}
                target="_blank"
                rel="noopener noreferrer"
                href={href}
                {...props}
              >
                {children}
              </a>
            );
          },

          // Horizontal rule
          hr: ({ ...props }) => (
            <hr
              className={cn(
                "my-3 border-border",
                isUser ? "border-white/20" : ""
              )}
              {...props}
            />
          ),
        }}
      >
        {content}
      </ReactMarkdown>

      {isStreaming && (
        <span className="inline-block w-2 h-4 bg-current ml-1 animate-pulse" />
      )}
    </div>
  );
}
