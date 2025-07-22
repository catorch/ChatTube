"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useAppDispatch, useAppSelector } from "@/lib/hooks";
import {
  loadChatList,
  deleteChat,
  renameChatTitle,
  updateChatTitleOptimistic,
  clearMessages,
  setCurrentChatId,
  selectAllChats,
  Chat as ChatType,
} from "@/lib/features/chat/chatSlice";
import { showAuthModal } from "@/lib/features/auth/authSlice";
import { chatApi } from "@/lib/api/services/chat";
import {
  Plus,
  Search,
  Grid3X3,
  List,
  SortAsc,
  SortDesc,
  Calendar,
  MessageCircle,
  MessageSquare,
  CalendarDays,
  Clock,
  MoreHorizontal,
  Edit2,
  Trash2,
  Check,
  X,
  AlertCircle,
  Sparkles,
  Video,
  Zap,
  Cpu,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useDebouncedCallback } from "use-debounce";

type SortBy = "date" | "title" | "messages";
type SortOrder = "asc" | "desc";
type ViewMode = "grid" | "list";

interface WelcomePageProps {}

export function WelcomePage({}: WelcomePageProps = {}) {
  const router = useRouter();
  const dispatch = useAppDispatch();
  const chatList = useAppSelector(selectAllChats);
  const { chatListLoading, chatListError } = useAppSelector(
    (state) => state.chat
  );
  const { isAuthenticated } = useAppSelector((state) => state.auth);

  const [searchQuery, setSearchQuery] = useState("");
  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const [sortBy, setSortBy] = useState<SortBy>("date");
  const [sortOrder, setSortOrder] = useState<SortOrder>("desc");
  const [editingChatId, setEditingChatId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState("");
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [chatToDelete, setChatToDelete] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(10);

  // Load chat list on component mount only if authenticated
  useEffect(() => {
    if (isAuthenticated) {
      dispatch(loadChatList({}));
    }
  }, [dispatch, isAuthenticated]);

  const filteredAndSortedChats = chatList
    .filter(
      (chat: ChatType) =>
        chat.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        chat.lastMessage.toLowerCase().includes(searchQuery.toLowerCase())
    )
    .sort((a: ChatType, b: ChatType) => {
      let comparison = 0;

      switch (sortBy) {
        case "date":
          comparison =
            new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime();
          break;
        case "title":
          comparison = a.title.localeCompare(b.title);
          break;
        case "messages":
          comparison = a.messageCount - b.messageCount;
          break;
      }

      return sortOrder === "asc" ? comparison : -comparison;
    });

  // Pagination calculations
  const totalChats = filteredAndSortedChats.length;
  const totalPages = Math.ceil(totalChats / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedChats = filteredAndSortedChats.slice(startIndex, endIndex);

  // Reset to first page when search changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, sortBy, sortOrder]);

  const [isCreatingChat, setIsCreatingChat] = useState(false);
  const creatingRef = useRef(false);
  const lastCallRef = useRef(0);

  const handleCreateNewChat = useCallback(
    async (event?: React.MouseEvent) => {
      // Prevent default behavior and stop propagation
      if (event) {
        event.preventDefault();
        event.stopPropagation();
      }

      const now = Date.now();
      console.log(
        "🚀 handleCreateNewChat called, isCreatingChat:",
        isCreatingChat,
        "creatingRef:",
        creatingRef.current
      );

      // Debounce: prevent calls within 1 second
      if (now - lastCallRef.current < 1000) {
        console.log("🛑 Debounce: too soon since last call");
        return;
      }

      // Check both state and ref to prevent race conditions
      if (isCreatingChat || creatingRef.current) {
        console.log("🛑 Already creating chat, returning early");
        return;
      }

      console.log("✅ Setting creation flags to true");
      lastCallRef.current = now;
      creatingRef.current = true;
      setIsCreatingChat(true);

      try {
        console.log("📡 Making API call to create chat...");
        const response = await chatApi.createChat();
        const newChatId = response.chat._id;
        console.log("✅ Chat created successfully:", newChatId);

        // Navigate to the new chat
        router.push(`/chat/${newChatId}`);
      } catch (error) {
        console.error("❌ Failed to create new chat:", error);
      } finally {
        console.log("🔄 Setting creation flags to false");
        creatingRef.current = false;
        setIsCreatingChat(false);
      }
    },
    [isCreatingChat, router]
  );

  const handleChatClick = (chatId: string) => {
    // Navigate to the specific chat
    router.push(`/chat/${chatId}`);
  };

  // Debounced function for optimistic updates (faster feedback)
  const debouncedOptimisticUpdate = useDebouncedCallback(
    (chatId: string, title: string, originalTitle: string) => {
      if (title.trim() && title.trim() !== originalTitle) {
        dispatch(
          updateChatTitleOptimistic({
            chatId,
            title: title.trim(),
          })
        );
      }
    },
    200 // 200ms delay for UI updates
  );

  // Debounced function to save title changes to API
  const debouncedSaveTitle = useDebouncedCallback(
    (chatId: string, title: string, originalTitle: string) => {
      if (title.trim() && title.trim() !== originalTitle) {
        dispatch(renameChatTitle({ chatId, title: title.trim() }));
      }
    },
    1000 // 1 second delay for API calls
  );

  const handleRenameStart = (chatId: string, currentTitle: string) => {
    setEditingChatId(chatId);
    setEditingTitle(currentTitle);
  };

  const handleTitleChange = (newTitle: string, originalTitle: string) => {
    // Only update local input state immediately for responsive typing
    setEditingTitle(newTitle);

    if (editingChatId) {
      // Debounced optimistic update (200ms) for UI feedback
      debouncedOptimisticUpdate(editingChatId, newTitle, originalTitle);

      // Debounced API call (1000ms) to persist the change
      debouncedSaveTitle(editingChatId, newTitle, originalTitle);
    }
  };

  const handleRenameConfirm = () => {
    // Force immediate save and exit editing mode
    if (editingChatId && editingTitle.trim()) {
      const currentChat = chatList.find((chat) => chat.id === editingChatId);
      if (currentChat && editingTitle.trim() !== currentChat.title) {
        dispatch(
          renameChatTitle({ chatId: editingChatId, title: editingTitle.trim() })
        );
      }
    }
    setEditingChatId(null);
    setEditingTitle("");
  };

  const handleRenameCancel = () => {
    setEditingChatId(null);
    setEditingTitle("");
  };

  const handleDeleteStart = (chatId: string) => {
    setChatToDelete(chatId);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = () => {
    if (chatToDelete) {
      dispatch(deleteChat(chatToDelete));
    }
    setDeleteDialogOpen(false);
    setChatToDelete(null);
  };

  const handleDeleteCancel = () => {
    setDeleteDialogOpen(false);
    setChatToDelete(null);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  return (
    <div className="h-full flex flex-col relative">
      {/* Enhanced Background with Subtle Gradient */}
      <div className="absolute inset-0 bg-gradient-to-br from-background via-primary/[0.008] to-background" />
      <div className="absolute top-0 left-1/3 w-[600px] h-[600px] bg-gradient-to-br from-primary/[0.03] to-transparent rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 right-1/4 w-[500px] h-[500px] bg-gradient-to-br from-secondary/[0.025] to-transparent rounded-full blur-3xl pointer-events-none" />

      {/* Scrollable Content Container */}
      <div className="flex-1 overflow-y-auto relative z-10">
        {/* Two-Column Hero Section */}
        <div className="pt-12 pb-8 px-4 sm:px-6">
          <div className="max-w-7xl mx-auto">
            <div className="grid lg:grid-cols-2 gap-12 lg:gap-20 items-center">
              {/* Left Column: Hero Content */}
              <div className="space-y-8">
                <div className="space-y-6">
                  <h1 className="text-4xl sm:text-5xl lg:text-6xl xl:text-7xl font-light tracking-tight leading-none">
                    <span className="text-foreground">Welcome to</span>
                    <br />
                    <span className="font-medium text-primary">ChatTube</span>
                  </h1>
                  <p className="text-muted-foreground text-lg sm:text-xl lg:text-2xl font-light leading-relaxed max-w-2xl">
                    Transform your video content into intelligent conversations
                    with our advanced AI analysis platform
                  </p>
                </div>

                {/* Feature Tags with Badge Components */}
                <div className="flex flex-wrap gap-3">
                  <Badge
                    variant="outline"
                    className="text-sm py-2 px-4 bg-background/50 backdrop-blur-sm"
                  >
                    <Video className="h-4 w-4 text-primary" />
                    Video Analysis
                  </Badge>
                  <Badge
                    variant="outline"
                    className="text-sm py-2 px-4 bg-background/50 backdrop-blur-sm"
                  >
                    <Cpu className="h-4 w-4 text-primary" />
                    AI Powered
                  </Badge>
                  <Badge
                    variant="outline"
                    className="text-sm py-2 px-4 bg-background/50 backdrop-blur-sm"
                  >
                    <Sparkles className="h-4 w-4 text-primary" />
                    Smart Insights
                  </Badge>
                </div>
              </div>

              {/* Right Column: Decorative Visual Element */}
              <div className="hidden lg:flex items-center justify-center relative">
                <div className="relative">
                  {/* Main decorative shape with floating animation */}
                  <div className="w-80 h-80 bg-gradient-to-br from-primary/10 via-primary/5 to-secondary/10 rounded-[3rem] backdrop-blur-sm border border-primary/10 shadow-2xl floating">
                    <div className="absolute inset-4 bg-gradient-to-br from-background/80 to-background/40 rounded-[2.5rem] backdrop-blur-sm">
                      <div className="absolute inset-6 bg-gradient-to-br from-primary/5 to-secondary/5 rounded-[2rem] flex items-center justify-center">
                        <MessageCircle className="h-20 w-20 text-primary/60" />
                      </div>
                    </div>
                  </div>
                  {/* Floating accent elements */}
                  <div
                    className="absolute -top-4 -right-4 w-16 h-16 bg-gradient-to-br from-secondary/20 to-primary/20 rounded-2xl backdrop-blur-sm border border-secondary/20 floating"
                    style={{ animationDelay: "1s" }}
                  />
                  <div
                    className="absolute -bottom-6 -left-6 w-20 h-20 bg-gradient-to-br from-primary/15 to-secondary/15 rounded-3xl backdrop-blur-sm border border-primary/20 floating"
                    style={{ animationDelay: "2s" }}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Authentication Content or Main Content */}
        {!isAuthenticated ? (
          <div className="flex items-center justify-center px-4 min-h-[50vh]">
            <div className="text-center py-16 max-w-md">
              <div className="w-20 h-20 mx-auto mb-8 bg-gradient-to-br from-primary/10 to-secondary/10 rounded-2xl flex items-center justify-center backdrop-blur-sm border border-primary/10">
                <MessageCircle className="h-10 w-10 text-primary" />
              </div>
              <h3 className="text-2xl font-light mb-4 text-foreground">
                Begin your journey
              </h3>
              <p className="text-muted-foreground mb-8 text-lg leading-relaxed">
                Sign in to unlock the full potential of AI-powered video
                conversations and access your personal chat history
              </p>
              <Button
                onClick={() => dispatch(showAuthModal("login"))}
                className="lux-gradient gap-3 px-8 py-6 text-lg font-medium rounded-xl transition-all duration-300 shadow-lg hover:shadow-xl text-white"
              >
                <MessageCircle className="h-5 w-5" />
                Get Started
              </Button>
            </div>
          </div>
        ) : (
          <>
            {/* Main Content Block - Unified Container */}
            <div className="mt-8 px-4 sm:px-6 pb-8">
              <div className="w-full max-w-7xl mx-auto">
                {chatListError ? (
                  <div className="text-center py-16">
                    <div className="w-20 h-20 mx-auto mb-6 bg-gradient-to-br from-destructive/10 to-destructive/5 rounded-2xl flex items-center justify-center backdrop-blur-sm border border-destructive/10">
                      <AlertCircle className="h-10 w-10 text-destructive" />
                    </div>
                    <h3 className="text-xl font-light mb-2 text-foreground">
                      Unable to load conversations
                    </h3>
                    <p className="text-muted-foreground mb-6 leading-relaxed">
                      {chatListError}
                    </p>
                    <Button
                      onClick={() => dispatch(loadChatList({}))}
                      variant="outline"
                      className="px-6 py-3 rounded-xl border-border/50 bg-background/50 backdrop-blur-sm hover:bg-background/80 transition-all duration-300 hover-lift"
                    >
                      Try Again
                    </Button>
                  </div>
                ) : chatListLoading && (!chatList || chatList.length === 0) ? (
                  <div className="text-center py-20">
                    <div className="w-20 h-20 mx-auto mb-6 bg-gradient-to-br from-primary/10 to-secondary/10 rounded-2xl flex items-center justify-center backdrop-blur-sm border border-primary/10 animate-pulse">
                      <MessageCircle className="h-10 w-10 text-primary" />
                    </div>
                    <p className="text-muted-foreground text-lg">
                      Loading your conversations...
                    </p>
                  </div>
                ) : chatList.length === 0 ? (
                  <div className="text-center py-20">
                    <div className="w-20 h-20 mx-auto mb-6 bg-gradient-to-br from-primary/10 to-secondary/10 rounded-2xl flex items-center justify-center backdrop-blur-sm border border-primary/10">
                      <MessageCircle className="h-10 w-10 text-primary" />
                    </div>
                    <h3 className="text-2xl font-light mb-4 text-foreground">
                      Your conversation space awaits
                    </h3>
                    <p className="text-muted-foreground mb-8 text-lg leading-relaxed max-w-md mx-auto">
                      Start your first intelligent conversation with video
                      content
                    </p>
                    <Button
                      onClick={(e) => handleCreateNewChat(e)}
                      disabled={isCreatingChat}
                      className="lux-gradient gap-3 px-8 py-6 text-lg font-medium rounded-xl transition-all duration-300 shadow-lg hover:shadow-xl text-white hover-lift disabled:opacity-60 disabled:cursor-not-allowed"
                    >
                      <Plus className="h-5 w-5" />
                      {isCreatingChat
                        ? "Creating Chat..."
                        : "Create Your First Chat"}
                    </Button>
                  </div>
                ) : (
                  <div className="rounded-xl border border-border bg-surface-1 shadow-[var(--elev-1)] overflow-hidden">
                    {/* Integrated Action Bar */}
                    <div className="p-4 border-b border-border bg-surface-1">
                      <div className="flex flex-col lg:flex-row gap-4 items-start lg:items-center">
                        {/* Primary Action */}
                        <div className="flex items-center gap-4">
                          <Button
                            onClick={(e) => handleCreateNewChat(e)}
                            disabled={isCreatingChat}
                            className="lux-gradient gap-3 px-6 py-3 text-base font-medium rounded-xl transition-all duration-300 shadow-lg hover:shadow-xl text-white hover-lift disabled:opacity-60 disabled:cursor-not-allowed"
                          >
                            <Plus className="h-5 w-5" />
                            {isCreatingChat ? "Creating..." : "New Chat"}
                          </Button>
                          <div className="hidden sm:block w-px h-10 bg-border/50" />
                        </div>

                        {/* Search and Controls */}
                        <div className="flex-1 flex flex-col sm:flex-row gap-4 items-stretch sm:items-center w-full lg:w-auto">
                          <div className="relative flex-1 max-w-lg">
                            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                            <Input
                              placeholder="Search conversations..."
                              value={searchQuery}
                              onChange={(e) => setSearchQuery(e.target.value)}
                              className="pl-10 pr-4 py-2.5 bg-background border-border/50 rounded-lg focus-lux transition-all duration-300"
                            />
                          </div>

                          <div className="flex items-center gap-2">
                            {/* Sort Controls */}
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="gap-2 px-3 py-2 rounded-lg hover-lift"
                                >
                                  {sortOrder === "asc" ? (
                                    <SortAsc className="h-4 w-4" />
                                  ) : (
                                    <SortDesc className="h-4 w-4" />
                                  )}
                                  <span className="hidden sm:inline">Sort</span>
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent className="rounded-xl border-border/50 bg-background/95 backdrop-blur-sm">
                                <DropdownMenuItem
                                  onClick={() => setSortBy("date")}
                                  className={`rounded-lg ${
                                    sortBy === "date" ? "bg-accent" : ""
                                  }`}
                                >
                                  <Calendar className="h-4 w-4 mr-2" />
                                  Date
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={() => setSortBy("title")}
                                  className={`rounded-lg ${
                                    sortBy === "title" ? "bg-accent" : ""
                                  }`}
                                >
                                  <MessageCircle className="h-4 w-4 mr-2" />
                                  Title
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={() => setSortBy("messages")}
                                  className={`rounded-lg ${
                                    sortBy === "messages" ? "bg-accent" : ""
                                  }`}
                                >
                                  <Clock className="h-4 w-4 mr-2" />
                                  Messages
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>

                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() =>
                                setSortOrder(
                                  sortOrder === "asc" ? "desc" : "asc"
                                )
                              }
                              className="rounded-lg hover-lift"
                            >
                              {sortOrder === "asc" ? (
                                <SortAsc className="h-4 w-4" />
                              ) : (
                                <SortDesc className="h-4 w-4" />
                              )}
                            </Button>

                            {/* View Mode Toggle */}
                            <div className="flex border border-border/50 rounded-lg overflow-hidden">
                              <Button
                                variant={
                                  viewMode === "list" ? "default" : "ghost"
                                }
                                size="sm"
                                onClick={() => setViewMode("list")}
                                className="rounded-none px-3"
                              >
                                <List className="h-4 w-4" />
                              </Button>
                              <Button
                                variant={
                                  viewMode === "grid" ? "default" : "ghost"
                                }
                                size="sm"
                                onClick={() => setViewMode("grid")}
                                className="rounded-none border-l px-3"
                              >
                                <Grid3X3 className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Chat Data Table */}
                    {viewMode === "list" ? (
                      <table className="w-full text-sm">
                        {/* Table Headers */}
                        <thead className="text-xs text-muted-foreground bg-muted/20">
                          <tr>
                            <th className="p-4 font-medium text-left">
                              Chat Title
                            </th>
                            <th className="p-4 font-medium text-right">
                              Messages
                            </th>
                            <th className="p-4 font-medium text-right">
                              Last Updated
                            </th>
                          </tr>
                        </thead>

                        {/* Table Body */}
                        <tbody>
                          {paginatedChats.length === 0 ? (
                            <tr>
                              <td colSpan={3} className="p-8 text-center">
                                <div className="space-y-4">
                                  <div className="w-16 h-16 mx-auto bg-gradient-to-br from-muted/20 to-muted/10 rounded-2xl flex items-center justify-center backdrop-blur-sm border border-muted/20">
                                    <Search className="h-8 w-8 text-muted-foreground" />
                                  </div>
                                  <div>
                                    <h3 className="text-lg font-medium mb-2 text-foreground">
                                      No conversations match your search
                                    </h3>
                                    <p className="text-muted-foreground">
                                      Try adjusting your search terms to find
                                      what you're looking for
                                    </p>
                                  </div>
                                </div>
                              </td>
                            </tr>
                          ) : (
                            paginatedChats.map(
                              (chat: ChatType, index: number) => (
                                <tr
                                  key={chat.id}
                                  className={`
                                 group border-t border-border hover:bg-muted/50 cursor-pointer transition-colors
                                 ${
                                   index === paginatedChats.length - 1
                                     ? ""
                                     : "border-b border-border/30"
                                 }
                               `}
                                >
                                  {editingChatId === chat.id ? (
                                    <td colSpan={3} className="p-4">
                                      <div className="flex items-center gap-3">
                                        <Input
                                          value={editingTitle}
                                          onChange={(e) => {
                                            const currentChat =
                                              paginatedChats.find(
                                                (c: ChatType) =>
                                                  c.id === editingChatId
                                              );
                                            handleTitleChange(
                                              e.target.value,
                                              currentChat?.title || ""
                                            );
                                          }}
                                          className="flex-1 h-9 text-sm bg-background border-border/50 rounded-lg focus-lux"
                                          autoFocus
                                          onKeyDown={(e) => {
                                            if (e.key === "Enter") {
                                              handleRenameConfirm();
                                            } else if (e.key === "Escape") {
                                              handleRenameCancel();
                                            }
                                          }}
                                        />
                                        <Button
                                          variant="ghost"
                                          size="sm"
                                          onClick={handleRenameConfirm}
                                          className="h-9 w-9 p-0 hover:bg-green-50 hover:text-green-600 rounded-lg"
                                        >
                                          <Check className="h-4 w-4" />
                                        </Button>
                                        <Button
                                          variant="ghost"
                                          size="sm"
                                          onClick={handleRenameCancel}
                                          className="h-9 w-9 p-0 hover:bg-red-50 hover:text-red-600 rounded-lg"
                                        >
                                          <X className="h-4 w-4" />
                                        </Button>
                                      </div>
                                    </td>
                                  ) : (
                                    <>
                                      <td
                                        className="p-4 font-medium text-foreground group-hover:text-primary transition-colors"
                                        onClick={() => handleChatClick(chat.id)}
                                      >
                                        <div className="flex items-center justify-between">
                                          <span className="line-clamp-1 flex items-center gap-2">
                                            {chat.emoji && (
                                              <span className="text-lg">
                                                {chat.emoji}
                                              </span>
                                            )}
                                            {chat.title}
                                          </span>
                                          <DropdownMenu>
                                            <DropdownMenuTrigger asChild>
                                              <Button
                                                variant="ghost"
                                                size="sm"
                                                className="h-8 w-8 p-0 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-primary/10 rounded-lg ml-2"
                                                onClick={(e) =>
                                                  e.stopPropagation()
                                                }
                                              >
                                                <MoreHorizontal className="h-4 w-4" />
                                              </Button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent
                                              align="end"
                                              className="rounded-xl border-border/50 bg-background/95 backdrop-blur-sm"
                                            >
                                              <DropdownMenuItem
                                                onClick={(e) => {
                                                  e.stopPropagation();
                                                  handleRenameStart(
                                                    chat.id,
                                                    chat.title
                                                  );
                                                }}
                                                className="rounded-lg"
                                              >
                                                <Edit2 className="h-4 w-4 mr-2" />
                                                Rename
                                              </DropdownMenuItem>
                                              <DropdownMenuSeparator />
                                              <DropdownMenuItem
                                                onClick={(e) => {
                                                  e.stopPropagation();
                                                  handleDeleteStart(chat.id);
                                                }}
                                                className="text-destructive focus:text-destructive rounded-lg"
                                              >
                                                <Trash2 className="h-4 w-4 mr-2" />
                                                Delete
                                              </DropdownMenuItem>
                                            </DropdownMenuContent>
                                          </DropdownMenu>
                                        </div>
                                      </td>
                                      <td
                                        className="p-4 text-muted-foreground text-right"
                                        onClick={() => handleChatClick(chat.id)}
                                      >
                                        <div className="flex items-center justify-end gap-2">
                                          <MessageSquare className="h-3.5 w-3.5" />
                                          <span>{chat.messageCount}</span>
                                        </div>
                                      </td>
                                      <td
                                        className="p-4 text-muted-foreground text-right"
                                        onClick={() => handleChatClick(chat.id)}
                                      >
                                        <div className="flex items-center justify-end gap-2">
                                          <CalendarDays className="h-3.5 w-3.5" />
                                          <span>
                                            {formatDate(chat.timestamp)}
                                          </span>
                                        </div>
                                      </td>
                                    </>
                                  )}
                                </tr>
                              )
                            )
                          )}
                        </tbody>
                      </table>
                    ) : (
                      // Grid Layout (Legacy support)
                      <div className="p-6">
                        {paginatedChats.length === 0 ? (
                          <div className="text-center py-16">
                            <div className="w-20 h-20 mx-auto mb-6 bg-gradient-to-br from-muted/20 to-muted/10 rounded-2xl flex items-center justify-center backdrop-blur-sm border border-muted/20">
                              <Search className="h-10 w-10 text-muted-foreground" />
                            </div>
                            <h3 className="text-xl font-medium mb-4 text-foreground">
                              No conversations match your search
                            </h3>
                            <p className="text-muted-foreground">
                              Try adjusting your search terms to find what
                              you're looking for
                            </p>
                          </div>
                        ) : (
                          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                            {paginatedChats.map((chat: ChatType) => (
                              <div
                                key={chat.id}
                                className="group card-soft p-6 aspect-square flex flex-col justify-between cursor-pointer hover-lift"
                              >
                                {editingChatId === chat.id ? (
                                  <div className="flex items-center gap-3 flex-1">
                                    <Input
                                      value={editingTitle}
                                      onChange={(e) => {
                                        const currentChat = paginatedChats.find(
                                          (c: ChatType) =>
                                            c.id === editingChatId
                                        );
                                        handleTitleChange(
                                          e.target.value,
                                          currentChat?.title || ""
                                        );
                                      }}
                                      className="h-10 text-base font-medium bg-background/80 border-border/50 rounded-lg focus-lux"
                                      autoFocus
                                      onKeyDown={(e) => {
                                        if (e.key === "Enter") {
                                          handleRenameConfirm();
                                        } else if (e.key === "Escape") {
                                          handleRenameCancel();
                                        }
                                      }}
                                    />
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={handleRenameConfirm}
                                      className="h-10 w-10 p-0 hover:bg-green-50 hover:text-green-600 rounded-lg"
                                    >
                                      <Check className="h-4 w-4" />
                                    </Button>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={handleRenameCancel}
                                      className="h-10 w-10 p-0 hover:bg-red-50 hover:text-red-600 rounded-lg"
                                    >
                                      <X className="h-4 w-4" />
                                    </Button>
                                  </div>
                                ) : (
                                  <>
                                    <div className="space-y-4">
                                      <div className="flex items-start justify-between w-full">
                                        <h3
                                          className="font-medium text-lg line-clamp-2 text-foreground hover:text-primary transition-colors cursor-pointer leading-snug flex items-start gap-2"
                                          onClick={() =>
                                            handleChatClick(chat.id)
                                          }
                                        >
                                          {chat.emoji && (
                                            <span className="text-xl flex-shrink-0 mt-0.5">
                                              {chat.emoji}
                                            </span>
                                          )}
                                          <span className="flex-1">
                                            {chat.title}
                                          </span>
                                        </h3>
                                        <DropdownMenu>
                                          <DropdownMenuTrigger asChild>
                                            <Button
                                              variant="ghost"
                                              size="sm"
                                              className="h-8 w-8 p-0 opacity-0 group-hover:opacity-100 transition-all duration-200 hover:bg-primary/10 rounded-lg"
                                            >
                                              <MoreHorizontal className="h-4 w-4" />
                                            </Button>
                                          </DropdownMenuTrigger>
                                          <DropdownMenuContent
                                            align="end"
                                            className="rounded-xl border-border/50 bg-background/95 backdrop-blur-sm"
                                          >
                                            <DropdownMenuItem
                                              onClick={() =>
                                                handleRenameStart(
                                                  chat.id,
                                                  chat.title
                                                )
                                              }
                                              className="rounded-lg"
                                            >
                                              <Edit2 className="h-4 w-4 mr-2" />
                                              Rename
                                            </DropdownMenuItem>
                                            <DropdownMenuSeparator />
                                            <DropdownMenuItem
                                              onClick={() =>
                                                handleDeleteStart(chat.id)
                                              }
                                              className="text-destructive focus:text-destructive rounded-lg"
                                            >
                                              <Trash2 className="h-4 w-4 mr-2" />
                                              Delete
                                            </DropdownMenuItem>
                                          </DropdownMenuContent>
                                        </DropdownMenu>
                                      </div>
                                      <p
                                        className="text-muted-foreground line-clamp-3 leading-relaxed cursor-pointer"
                                        onClick={() => handleChatClick(chat.id)}
                                      >
                                        {chat.lastMessage}
                                      </p>
                                    </div>
                                    <div className="flex items-center justify-between pt-4 border-t border-border/30">
                                      <span className="flex items-center gap-2 text-sm text-muted-foreground">
                                        <MessageCircle className="h-4 w-4" />
                                        {chat.messageCount} messages
                                      </span>
                                      <span className="flex items-center gap-2 text-sm text-muted-foreground">
                                        <Clock className="h-4 w-4" />
                                        {formatDate(chat.timestamp)}
                                      </span>
                                    </div>
                                  </>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Pagination Controls */}
                    {totalPages > 1 && (
                      <div className="p-4 border-t border-border bg-surface-1/50">
                        <div className="flex items-center justify-between">
                          <div className="text-sm text-muted-foreground">
                            Showing {startIndex + 1} to{" "}
                            {Math.min(endIndex, totalChats)} of {totalChats}{" "}
                            conversations
                          </div>
                          <div className="flex items-center gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setCurrentPage(1)}
                              disabled={currentPage === 1}
                              className="h-8 w-8 p-0 rounded-lg border-border/50 hover:bg-background/80"
                            >
                              <ChevronsLeft className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setCurrentPage(currentPage - 1)}
                              disabled={currentPage === 1}
                              className="h-8 w-8 p-0 rounded-lg border-border/50 hover:bg-background/80"
                            >
                              <ChevronLeft className="h-4 w-4" />
                            </Button>

                            {/* Page Numbers */}
                            <div className="flex items-center gap-1">
                              {Array.from(
                                { length: Math.min(5, totalPages) },
                                (_, i) => {
                                  let pageNumber;
                                  if (totalPages <= 5) {
                                    pageNumber = i + 1;
                                  } else if (currentPage <= 3) {
                                    pageNumber = i + 1;
                                  } else if (currentPage >= totalPages - 2) {
                                    pageNumber = totalPages - 4 + i;
                                  } else {
                                    pageNumber = currentPage - 2 + i;
                                  }

                                  return (
                                    <Button
                                      key={pageNumber}
                                      variant={
                                        currentPage === pageNumber
                                          ? "default"
                                          : "outline"
                                      }
                                      size="sm"
                                      onClick={() => setCurrentPage(pageNumber)}
                                      className="h-8 w-8 p-0 rounded-lg border-border/50 hover:bg-background/80"
                                    >
                                      {pageNumber}
                                    </Button>
                                  );
                                }
                              )}
                            </div>

                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setCurrentPage(currentPage + 1)}
                              disabled={currentPage === totalPages}
                              className="h-8 w-8 p-0 rounded-lg border-border/50 hover:bg-background/80"
                            >
                              <ChevronRight className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setCurrentPage(totalPages)}
                              disabled={currentPage === totalPages}
                              className="h-8 w-8 p-0 rounded-lg border-border/50 hover:bg-background/80"
                            >
                              <ChevronsRight className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </div>

      {/* Enhanced Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent className="rounded-2xl border-border/50 glass-effect">
          <DialogHeader className="space-y-4">
            <div className="w-16 h-16 mx-auto bg-gradient-to-br from-destructive/10 to-destructive/5 rounded-2xl flex items-center justify-center border border-destructive/10">
              <Trash2 className="h-8 w-8 text-destructive" />
            </div>
            <DialogTitle className="text-xl font-light text-center">
              Delete Conversation
            </DialogTitle>
            <DialogDescription className="text-center text-muted-foreground leading-relaxed">
              Are you sure you want to permanently delete this conversation?
              This action cannot be undone and all messages will be lost.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-3 mt-6">
            <Button
              variant="outline"
              onClick={handleDeleteCancel}
              className="flex-1 rounded-xl border-border/50 bg-background/50 backdrop-blur-sm hover:bg-background/80 transition-all duration-300"
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeleteConfirm}
              className="flex-1 rounded-xl bg-gradient-to-r from-destructive to-destructive/90 hover:from-destructive/90 hover:to-destructive/80 transition-all duration-300"
            >
              Delete Forever
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
