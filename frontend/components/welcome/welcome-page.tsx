"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAppDispatch, useAppSelector } from "@/lib/hooks";
import {
  loadChatList,
  deleteChat,
  renameChatTitle,
} from "@/lib/features/chat/chatSlice";
import { showAuthModal } from "@/lib/features/auth/authSlice";
import {
  Plus,
  Search,
  Grid3X3,
  List,
  SortAsc,
  SortDesc,
  Calendar,
  MessageCircle,
  Clock,
  MoreHorizontal,
  Edit2,
  Trash2,
  Check,
  X,
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

interface Chat {
  id: string;
  title: string;
  lastMessage: string;
  timestamp: Date;
  messageCount: number;
}

type SortBy = "date" | "title" | "messages";
type SortOrder = "asc" | "desc";
type ViewMode = "grid" | "list";

interface WelcomePageProps {
  onCreateNewChat?: () => void;
  onChatClick?: (chatId: string) => void;
  onRenameChat?: (chatId: string, newTitle: string) => void;
  onDeleteChat?: (chatId: string) => void;
}

export function WelcomePage({
  onCreateNewChat,
  onChatClick,
  onRenameChat,
  onDeleteChat,
}: WelcomePageProps) {
  const dispatch = useAppDispatch();
  const { chatList, chatListLoading, chatListError } = useAppSelector(
    (state) => state.chat
  );
  const { isAuthenticated } = useAppSelector((state) => state.auth);

  const [searchQuery, setSearchQuery] = useState("");
  const [viewMode, setViewMode] = useState<ViewMode>("grid");
  const [sortBy, setSortBy] = useState<SortBy>("date");
  const [sortOrder, setSortOrder] = useState<SortOrder>("desc");
  const [editingChatId, setEditingChatId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState("");
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [chatToDelete, setChatToDelete] = useState<string | null>(null);

  // Load chat list on component mount only if authenticated
  useEffect(() => {
    if (isAuthenticated) {
      dispatch(loadChatList({}));
    }
  }, [dispatch, isAuthenticated]);

  const filteredAndSortedChats = chatList
    .filter(
      (chat) =>
        chat.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        chat.lastMessage.toLowerCase().includes(searchQuery.toLowerCase())
    )
    .sort((a, b) => {
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

  const handleCreateNewChat = () => {
    if (onCreateNewChat) {
      onCreateNewChat();
    } else {
      console.log("Creating new chat...");
    }
  };

  const handleChatClick = (chatId: string) => {
    if (onChatClick) {
      onChatClick(chatId);
    } else {
      console.log("Opening chat:", chatId);
    }
  };

  const handleRenameStart = (chatId: string, currentTitle: string) => {
    setEditingChatId(chatId);
    setEditingTitle(currentTitle);
  };

  const handleRenameConfirm = () => {
    if (editingChatId && editingTitle.trim()) {
      dispatch(
        renameChatTitle({ chatId: editingChatId, title: editingTitle.trim() })
      );
      if (onRenameChat) {
        onRenameChat(editingChatId, editingTitle.trim());
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
      if (onDeleteChat) {
        onDeleteChat(chatToDelete);
      }
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
    <div className="h-full flex flex-col bg-background">
      {/* Welcome Header */}
      <div className="text-center py-8 px-4">
        <h1 className="text-4xl font-bold mb-2 bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
          Welcome to ChatTube
        </h1>
        <p className="text-muted-foreground text-lg">
          Chat with your videos using AI-powered analysis
        </p>
      </div>

      {/* Show authentication prompt if not authenticated */}
      {!isAuthenticated ? (
        <div className="flex-1 flex items-center justify-center px-4">
          <div className="text-center py-12 max-w-md">
            <div className="w-16 h-16 mx-auto mb-4 bg-muted rounded-full flex items-center justify-center">
              <MessageCircle className="h-8 w-8 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-semibold mb-2">
              Sign in to get started
            </h3>
            <p className="text-muted-foreground mb-4">
              Sign in to access your chat history and start conversations with
              your videos
            </p>
            <Button
              onClick={() => dispatch(showAuthModal("login"))}
              className="gap-2"
            >
              Sign In
            </Button>
          </div>
        </div>
      ) : (
        <>
          {/* Controls */}
          <div className="px-4 mb-6">
            <div className="flex flex-col sm:flex-row gap-4 items-center justify-between">
              <div className="flex gap-2 flex-1 max-w-md">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                  <Input
                    placeholder="Search chats..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>

              <div className="flex items-center gap-2">
                {/* Sort Dropdown */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm">
                      {sortOrder === "asc" ? (
                        <SortAsc className="h-4 w-4 mr-2" />
                      ) : (
                        <SortDesc className="h-4 w-4 mr-2" />
                      )}
                      Sort
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent>
                    <DropdownMenuItem
                      onClick={() => setSortBy("date")}
                      className={sortBy === "date" ? "bg-accent" : ""}
                    >
                      <Calendar className="h-4 w-4 mr-2" />
                      Date
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => setSortBy("title")}
                      className={sortBy === "title" ? "bg-accent" : ""}
                    >
                      <MessageCircle className="h-4 w-4 mr-2" />
                      Title
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => setSortBy("messages")}
                      className={sortBy === "messages" ? "bg-accent" : ""}
                    >
                      <Clock className="h-4 w-4 mr-2" />
                      Messages
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>

                {/* Sort Order Toggle */}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    setSortOrder(sortOrder === "asc" ? "desc" : "asc")
                  }
                >
                  {sortOrder === "asc" ? (
                    <SortAsc className="h-4 w-4" />
                  ) : (
                    <SortDesc className="h-4 w-4" />
                  )}
                </Button>

                {/* View Mode Toggle */}
                <div className="flex border rounded-md">
                  <Button
                    variant={viewMode === "grid" ? "default" : "ghost"}
                    size="sm"
                    onClick={() => setViewMode("grid")}
                    className="rounded-r-none"
                  >
                    <Grid3X3 className="h-4 w-4" />
                  </Button>
                  <Button
                    variant={viewMode === "list" ? "default" : "ghost"}
                    size="sm"
                    onClick={() => setViewMode("list")}
                    className="rounded-l-none border-l"
                  >
                    <List className="h-4 w-4" />
                  </Button>
                </div>

                {/* Create New Chat Button */}
                <Button onClick={handleCreateNewChat} className="gap-2">
                  <Plus className="h-4 w-4" />
                  New Chat
                </Button>
              </div>
            </div>
          </div>

          {/* Chat List */}
          <div className="flex-1 px-4 pb-4">
            {chatListError && (
              <div className="text-center py-8">
                <div className="text-destructive mb-2">Error loading chats</div>
                <p className="text-sm text-muted-foreground mb-4">
                  {chatListError}
                </p>
                <Button
                  onClick={() => dispatch(loadChatList({}))}
                  variant="outline"
                >
                  Try Again
                </Button>
              </div>
            )}

            {chatListLoading ? (
              <div className="text-center py-12">
                <div className="w-16 h-16 mx-auto mb-4 bg-muted rounded-full flex items-center justify-center animate-pulse">
                  <MessageCircle className="h-8 w-8 text-muted-foreground" />
                </div>
                <p className="text-muted-foreground">Loading chats...</p>
              </div>
            ) : filteredAndSortedChats.length === 0 ? (
              <div className="text-center py-12">
                <div className="w-16 h-16 mx-auto mb-4 bg-muted rounded-full flex items-center justify-center">
                  <MessageCircle className="h-8 w-8 text-muted-foreground" />
                </div>
                <h3 className="text-lg font-semibold mb-2">No chats found</h3>
                <p className="text-muted-foreground mb-4">
                  {searchQuery
                    ? "Try adjusting your search"
                    : "Create your first chat to get started"}
                </p>
                <Button onClick={handleCreateNewChat} className="gap-2">
                  <Plus className="h-4 w-4" />
                  Create New Chat
                </Button>
              </div>
            ) : (
              <div
                className={
                  viewMode === "grid"
                    ? "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"
                    : "space-y-3"
                }
              >
                {filteredAndSortedChats.map((chat) => (
                  <div
                    key={chat.id}
                    className={`
                  relative group transition-all duration-200 hover:shadow-lg
                  ${
                    viewMode === "grid"
                      ? "bg-card border rounded-lg p-4 hover:border-primary/50"
                      : "bg-card border rounded-lg p-4 hover:border-primary/50"
                  }
                `}
                  >
                    <div className="flex items-start justify-between mb-2">
                      {editingChatId === chat.id ? (
                        <div className="flex items-center gap-2 flex-1">
                          <Input
                            value={editingTitle}
                            onChange={(e) => setEditingTitle(e.target.value)}
                            className="h-8 text-sm font-semibold"
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
                            className="h-8 w-8 p-0"
                          >
                            <Check className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={handleRenameCancel}
                            className="h-8 w-8 p-0"
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      ) : (
                        <div className="flex items-center justify-between w-full">
                          <h3
                            className="font-semibold text-sm line-clamp-1 cursor-pointer"
                            onClick={() => handleChatClick(chat.id)}
                          >
                            {chat.title}
                          </h3>
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-muted-foreground whitespace-nowrap">
                              {formatDate(chat.timestamp)}
                            </span>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-8 w-8 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                                >
                                  <MoreHorizontal className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem
                                  onClick={() =>
                                    handleRenameStart(chat.id, chat.title)
                                  }
                                >
                                  <Edit2 className="h-4 w-4 mr-2" />
                                  Rename
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  onClick={() => handleDeleteStart(chat.id)}
                                  className="text-destructive focus:text-destructive"
                                >
                                  <Trash2 className="h-4 w-4 mr-2" />
                                  Delete
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        </div>
                      )}
                    </div>
                    <div
                      className="cursor-pointer"
                      onClick={() => handleChatClick(chat.id)}
                    >
                      <p className="text-sm text-muted-foreground line-clamp-2 mb-3">
                        {chat.lastMessage}
                      </p>
                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <MessageCircle className="h-3 w-3" />
                          {chat.messageCount} messages
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {formatDate(chat.timestamp)}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Chat</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this chat? This action cannot be
              undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={handleDeleteCancel}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDeleteConfirm}>
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
