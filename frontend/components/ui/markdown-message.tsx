"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeHighlight from "rehype-highlight";
import { cn } from "@/lib/utils";
import { VideoReference } from "./video-reference";
import { CitationTooltip, CitationData } from "./citation-tooltip";

interface MarkdownMessageProps {
  content: string;
  isUser?: boolean;
  isStreaming?: boolean;
  className?: string;
  citationMap?: Record<string, CitationData>;
}

export function MarkdownMessage({
  content,
  isUser = false,
  isStreaming = false,
  className,
  citationMap = {},
}: MarkdownMessageProps) {
  const renderMarkdown = (md: string, key: number) => (
    <ReactMarkdown
      key={key}
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
              "bg-muted/50 border border-border rounded-[var(--r-1)] p-3 my-2 overflow-x-auto text-xs",
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
                    "bg-muted/50 border border-border rounded-[var(--r-1)] px-1 py-0.5 text-xs font-mono",
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
          <h1 className="text-lg font-semibold mb-2 mt-3 first:mt-0" {...props}>
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
          <h3 className="text-sm font-semibold mb-1 mt-2 first:mt-0" {...props}>
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
              "border border-border px-2 py-1 text-left font-medium bg-muted/50",
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

        // Enhanced links with video reference detection and citation handling
        a: ({ children, href, ...props }) => {
          // Check if this is a video reference URL
          if (href && href.startsWith("video://")) {
            console.log("Video reference detected:", href);
            return (
              <VideoReference href={href} isUser={isUser}>
                {children}
              </VideoReference>
            );
          }

          // Regular link with enhanced accessibility
          return (
            <a
              className={cn(
                "underline underline-offset-2 hover:no-underline transition-colors duration-200",
                isUser
                  ? "text-white hover:text-white/80"
                  : "text-primary hover:text-primary/80"
              )}
              target="_blank"
              rel="noopener noreferrer"
              href={href}
              // Enhanced accessibility
              aria-label={`Open link: ${href} (opens in new tab)`}
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
      {md}
    </ReactMarkdown>
  );

  // Parse citations and create mixed content with better text handling
  const parts: React.ReactNode[] = [];
  const regex = /\[(\^\d+)\](?:\((video:\/\/[^)]+)\))?/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let keyIndex = 0;
  
  while ((match = regex.exec(content)) !== null) {
    // Add text before citation using a simplified markdown approach
    if (match.index > lastIndex) {
      const textBefore = content.slice(lastIndex, match.index);
      // Process basic markdown without wrapping in paragraphs
      const processedText = textBefore
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        .replace(/\*(.*?)\*/g, '<em>$1</em>')
        .replace(/`(.*?)`/g, '<code class="bg-muted/50 border border-border rounded px-1 py-0.5 text-xs font-mono">$1</code>');
      
      parts.push(
        <span 
          key={`text-${keyIndex++}`} 
          className="text-sm leading-relaxed"
          dangerouslySetInnerHTML={{ __html: processedText }}
        />
      );
    }
    
    const label = match[1];
    const href = match[2];
    parts.push(
      <CitationTooltip
        key={`c-${keyIndex++}`}
        label={label}
        href={href}
        citation={citationMap[label]}
        isUser={isUser}
      />
    );
    lastIndex = regex.lastIndex;
  }
  
  // Add remaining text
  if (lastIndex < content.length) {
    const remainingText = content.slice(lastIndex);
    const processedText = remainingText
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      .replace(/`(.*?)`/g, '<code class="bg-muted/50 border border-border rounded px-1 py-0.5 text-xs font-mono">$1</code>');
    
    parts.push(
      <span 
        key={`text-${keyIndex++}`} 
        className="text-sm leading-relaxed"
        dangerouslySetInnerHTML={{ __html: processedText }}
      />
    );
  }

  // If no citations found, render normally with full markdown
  if (parts.length === 0) {
    return (
      <div className={cn("prose prose-sm max-w-none", className)}>
        {renderMarkdown(content, 0)}
        {isStreaming && (
          <div
            className="inline-flex items-center gap-2 mt-1"
            role="status"
            aria-live="polite"
            aria-label="Assistant is typing"
          >
            <span className="streaming-reveal text-sm">●</span>
            <span className="sr-only">Message is being generated</span>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className={cn("prose prose-sm max-w-none", className)}>
      <div className="text-sm leading-relaxed whitespace-pre-wrap">
        {parts}
      </div>
      {isStreaming && (
        <div
          className="inline-flex items-center gap-2 mt-1"
          role="status"
          aria-live="polite"
          aria-label="Assistant is typing"
        >
          <span className="streaming-reveal text-sm">●</span>
          <span className="sr-only">Message is being generated</span>
        </div>
      )}
    </div>
  );
}
