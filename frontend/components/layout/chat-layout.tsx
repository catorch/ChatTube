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
      <header className="sticky top-0 z-30 glass-effect h-16 sm:h-16 flex items-center justify-between px-4 sm:px-6 transition-all duration-200 border-b border-border/50">
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
            <div className="relative w-9 h-9 sm:w-10 sm:h-10 lux-gradient rounded-xl shadow-[var(--elev-2)] flex items-center justify-center hover:scale-105 transition-all duration-200">
              <span className="text-white font-bold text-sm sm:text-base relative z-10">
                CT
              </span>
              <div className="absolute inset-0 rounded-xl bg-gradient-to-r from-transparent via-white/20 to-transparent opacity-0 hover:opacity-100 transition-opacity duration-300" />
            </div>
            <div className="flex flex-col">
              <span className="font-bold text-lg sm:text-xl bg-gradient-to-r from-foreground to-foreground/80 bg-clip-text text-transparent">ChatTube</span>
              <span className="text-xs text-muted-foreground/80 font-medium">AI Video Analysis</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <ThemeToggle />
          <Button 
            variant="ghost" 
            size="sm" 
            className="h-9 w-9 p-0 rounded-lg hover:bg-primary/10 transition-all duration-200 hover:scale-105"
            title="Settings"
          >
            <Settings className="h-4 w-4" />
          </Button>

          {/* User Dropdown Menu */}
          {isAuthenticated ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-9 w-9 p-0 relative rounded-lg hover:scale-105 transition-all duration-200"
                  title={`Signed in as ${getUserDisplayName()}`}
                >
                  <div className="w-7 h-7 rounded-full bg-gradient-to-br from-primary/20 to-primary/10 flex items-center justify-center text-sm font-semibold border-2 border-primary/30 text-primary shadow-sm">
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
