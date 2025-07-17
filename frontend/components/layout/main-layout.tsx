"use client";

import { useState } from "react";
import { useAppDispatch } from "@/lib/hooks";
import { SourcesPanel } from "./sources-panel";
import { ChatPanel } from "./chat-panel";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { Button } from "@/components/ui/button";
import { Settings, User, Menu, X } from "lucide-react";
import { UserInfo } from "@/components/auth/user-info";

export function MainLayout() {
  const dispatch = useAppDispatch();
  const [isMobileSourcesOpen, setIsMobileSourcesOpen] = useState(false);

  return (
    <div className="h-screen flex flex-col bg-background">
      {/* Top Bar */}
      <div className="h-14 border-b border-border bg-card/50 flex items-center justify-between px-4 sm:px-6">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="sm"
            className="sm:hidden h-8 w-8 p-0"
            onClick={() => setIsMobileSourcesOpen(!isMobileSourcesOpen)}
          >
            {isMobileSourcesOpen ? (
              <X className="h-4 w-4" />
            ) : (
              <Menu className="h-4 w-4" />
            )}
          </Button>

          <div className="flex items-center gap-2">
            <div className="w-8 h-8 sm:w-9 sm:h-9 lux-gradient rounded-xl shadow-[var(--elev-2)] flex items-center justify-center">
              <span className="text-white font-bold text-xs sm:text-sm">
                CT
              </span>
            </div>
            <span className="font-semibold text-base sm:text-lg">ChatTube</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <ThemeToggle />
          <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
            <Settings className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
            <User className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* Desktop Sources Panel */}
        <div className="hidden sm:block">
          <SourcesPanel />
        </div>

        {/* Mobile Sources Panel Overlay */}
        {isMobileSourcesOpen && (
          <>
            <div
              className="fixed inset-0 bg-black/50 z-40 sm:hidden"
              onClick={() => setIsMobileSourcesOpen(false)}
            />
            <div className="fixed left-0 top-14 bottom-0 w-80 z-50 sm:hidden">
              <SourcesPanel />
            </div>
          </>
        )}

        <div className="flex-1 flex flex-col">
          <ChatPanel />
        </div>
      </div>
    </div>
  );
}
