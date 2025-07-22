"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAppDispatch, useAppSelector } from "@/lib/hooks";
import { logout } from "@/lib/features/auth/authSlice";
import { clearStoreAndPersist } from "@/lib/store";
import { SourcesPanel } from "./sources-panel";
import ChatPanel from "./chat-panel";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Settings, Menu, X, ArrowLeft, LogOut, UserCircle } from "lucide-react";

interface ChatLayoutProps {
  chatId: string;
}

export function ChatLayout({ chatId }: ChatLayoutProps) {
  const router = useRouter();
  const dispatch = useAppDispatch();
  const { user, isAuthenticated } = useAppSelector((state) => state.auth);
  const [isMobileSourcesOpen, setIsMobileSourcesOpen] = useState(false);
  const [isSourcesPanelCollapsed, setIsSourcesPanelCollapsed] = useState(false);

  const handleBackToHome = () => {
    router.push("/");
  };

  const handleLogout = async () => {
    try {
      // First call the logout API
      await dispatch(logout()).unwrap();
    } catch (error) {
      // Even if logout API fails, we still want to clear local state
      console.warn("Logout API failed, but clearing local state:", error);
    } finally {
      // Always clear the store and persisted data
      await clearStoreAndPersist();
      // Redirect to home after logout
      router.push("/");
    }
  };

  // Get user initials for display
  const getUserInitials = () => {
    if (!user) return "?";
    if (user.firstName && user.lastName) {
      return `${user.firstName[0]}${user.lastName[0]}`.toUpperCase();
    }
    if (user.firstName) {
      return user.firstName[0].toUpperCase();
    }
    if (user.email) {
      return user.email[0].toUpperCase();
    }
    return "?";
  };

  const getUserDisplayName = () => {
    if (!user) return "Guest";
    if (user.firstName && user.lastName) {
      return `${user.firstName} ${user.lastName}`;
    }
    if (user.firstName) {
      return user.firstName;
    }
    return user.email;
  };

  return (
    <div className="h-screen flex flex-col bg-background">
      {/* Enhanced Glassmorphic Top Bar */}
      <header className="sticky top-0 z-30 glass-effect h-14 sm:h-14 flex items-center justify-between px-4 sm:px-6 transition-all duration-200">
        <div className="flex items-center gap-3">
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

          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleBackToHome}
              className="h-8 w-8 p-0 mr-2"
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div className="w-8 h-8 sm:w-9 sm:h-9 lux-gradient rounded-xl shadow-[var(--elev-2)] flex items-center justify-center">
              <span className="text-white font-bold text-xs sm:text-sm relative z-10">
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

          {/* User Dropdown Menu */}
          {isAuthenticated ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 w-8 p-0 relative"
                >
                  <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center text-xs font-medium border border-primary/20">
                    {getUserInitials()}
                  </div>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-56" align="end" forceMount>
                <DropdownMenuLabel className="font-normal">
                  <div className="flex flex-col space-y-1">
                    <p className="text-sm font-medium leading-none">
                      {getUserDisplayName()}
                    </p>
                    <p className="text-xs leading-none text-muted-foreground">
                      {user?.email}
                    </p>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem className="cursor-pointer">
                  <UserCircle className="mr-2 h-4 w-4" />
                  <span>Profile</span>
                </DropdownMenuItem>
                <DropdownMenuItem className="cursor-pointer">
                  <Settings className="mr-2 h-4 w-4" />
                  <span>Settings</span>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className="cursor-pointer text-red-600 focus:text-red-600 focus:bg-red-50 dark:focus:bg-red-950"
                  onClick={handleLogout}
                >
                  <LogOut className="mr-2 h-4 w-4" />
                  <span>Logout</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : null}
        </div>
      </header>

      {/* Main Chat Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Sources Panel */}
        <div
          className={`${
            isSourcesPanelCollapsed ? "w-0" : "w-80"
          } transition-all duration-300 hidden sm:flex flex-col`}
        >
          <SourcesPanel chatId={chatId} isCollapsed={isSourcesPanelCollapsed} />
        </div>

        {/* Mobile Sources Panel Overlay */}
        {isMobileSourcesOpen && (
          <>
            <div
              className="fixed inset-0 bg-black/50 z-40 sm:hidden backdrop-blur-sm"
              onClick={() => setIsMobileSourcesOpen(false)}
            />
            <div className="fixed left-0 top-0 bottom-0 w-80 z-50 sm:hidden bg-background border-r border-border shadow-xl">
              <SourcesPanel chatId={chatId} isCollapsed={false} />
            </div>
          </>
        )}

        {/* Chat Panel */}
        <div className="flex-1 flex flex-col">
          <ChatPanel chatId={chatId} />
        </div>
      </div>
    </div>
  );
}
