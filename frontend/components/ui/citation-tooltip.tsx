"use client";
import { useState, useEffect, useRef } from "react";
import { cn } from "@/lib/utils";
import { VideoReference } from "./video-reference";

export interface CitationData {
  text?: string;
  startTime?: number;
  sourceId?: string;
  chunkId?: string;
}

interface CitationTooltipProps {
  label: string; // "^1"
  citation?: CitationData;
  href?: string; // optional video reference
  isUser?: boolean;
}

export function CitationTooltip({
  label,
  citation,
  href,
  isUser = false,
}: CitationTooltipProps) {
  const [show, setShow] = useState(false);
  const [position, setPosition] = useState({ top: "calc(100% + 8px)", left: "50%", transform: "translateX(-50%)" });
  const tooltipRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLSpanElement>(null);
  const hideTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  // Extract just the number from the label (remove ^ prefix)
  const number = label.replace("^", "");
  const content = number;

  // Mouse handlers
  const handleMouseEnter = () => {
    if (hideTimeoutRef.current) {
      clearTimeout(hideTimeoutRef.current);
      hideTimeoutRef.current = null;
    }
    setShow(true);
  };

  const handleMouseLeave = () => {
    hideTimeoutRef.current = setTimeout(() => {
      setShow(false);
    }, 100); // Small delay to allow moving to tooltip
  };

  // Handle ESC key to close tooltip
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && show) {
        setShow(false);
      }
    };

    if (show) {
      document.addEventListener('keydown', handleEscape);
      return () => document.removeEventListener('keydown', handleEscape);
    }
  }, [show]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (hideTimeoutRef.current) {
        clearTimeout(hideTimeoutRef.current);
      }
    };
  }, []);

  // Calculate smart positioning
  useEffect(() => {
    if (show && triggerRef.current) {
      const trigger = triggerRef.current.getBoundingClientRect();
      const viewport = {
        width: window.innerWidth,
        height: window.innerHeight
      };
      
      const tooltipWidth = 420;
      const tooltipHeight = 210;
      const gap = 8;
      
      let newPosition = {
        top: "calc(100% + 8px)",
        left: "50%",
        transform: "translateX(-50%)"
      };
      
      // Check if tooltip would go off right edge
      if (trigger.left + tooltipWidth / 2 > viewport.width) {
        newPosition.left = "auto";
        newPosition.transform = "none";
        newPosition = { ...newPosition, right: "0" };
      }
      // Check if tooltip would go off left edge
      else if (trigger.left - tooltipWidth / 2 < 0) {
        newPosition.left = "0";
        newPosition.transform = "none";
      }
      
      // Check if tooltip would go off bottom edge
      if (trigger.bottom + tooltipHeight + gap > viewport.height) {
        newPosition.top = `calc(-${tooltipHeight}px - ${gap}px)`;
      }
      
      setPosition(newPosition);
    }
  }, [show]);

  const tooltip = citation?.text ? (
    <>
      {/* Invisible bridge area to prevent tooltip from disappearing during mouse movement */}
      <div 
        className={cn(
          "absolute z-40",
          show ? "block" : "hidden"
        )}
        style={{
          top: "100%",
          left: "50%",
          transform: "translateX(-50%)",
          width: "420px",
          height: "12px", // 8px gap + 4px buffer
        }}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      />
      
      {/* Main tooltip */}
      <div
        ref={tooltipRef}
        className={cn(
          "absolute z-50 w-[420px] h-[210px] rounded-lg shadow-2xl bg-background border border-border text-foreground transition-all duration-200",
          show ? "opacity-100 scale-100" : "opacity-0 scale-95 invisible pointer-events-none"
        )}
        style={position}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      >
        <div className="h-full overflow-y-auto p-4">
          <p className="text-sm leading-relaxed text-foreground whitespace-pre-wrap">
            {citation.text}
          </p>
        </div>
      </div>
    </>
  ) : null;

  const commonProps = {
    onMouseEnter: handleMouseEnter,
    onMouseLeave: handleMouseLeave,
    className: "relative inline-flex cursor-pointer",
  } as const;

  if (href) {
    return (
      <span 
        ref={triggerRef}
        {...commonProps}
        className={cn(
          "relative inline-flex items-center justify-center cursor-pointer font-medium text-xs min-w-[1.25rem] h-5 rounded-full bg-primary text-primary-foreground hover:bg-primary/80 transition-colors",
          isUser && "bg-white/20 text-white hover:bg-white/30"
        )}
      >
        <VideoReference href={href} isUser={isUser} className="px-0 bg-transparent text-inherit hover:bg-transparent">
          {content}
        </VideoReference>
        {tooltip}
      </span>
    );
  }

  return (
    <span
      ref={triggerRef}
      {...commonProps}
      className={cn(
        "relative inline-flex items-center justify-center cursor-pointer font-medium text-xs min-w-[1.25rem] h-5 rounded-full bg-primary text-primary-foreground hover:bg-primary/80 transition-colors",
        isUser && "bg-white/20 text-white hover:bg-white/30"
      )}
    >
      {content}
      {tooltip}
    </span>
  );
}
