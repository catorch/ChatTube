"use client";

import { useState, useRef, useEffect } from "react";
import { useAppSelector, useAppDispatch } from "@/lib/hooks";
import {
  sendMessage,
  setCurrentInput,
  setSelectedProvider,
  clearMessages,
  setCurrentChatId,
  startStreaming,
  stopStreaming,
  handleStreamEvent,
  selectCurrentChat,
  renameChatTitle,
  updateChatTitleOptimistic,
  selectAllMessages,
  Message,
} from "@/lib/features/chat/chatSlice";
import {
  loadChatSources,
  makeSelectSourcesForChat,
} from "@/lib/features/sources/sourcesSlice";
import { chatApi } from "@/lib/api/services/chat";
import { Button } from "@/components/ui/button";
import { useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ChatBubble } from "@/components/ui/chat-bubble";
import { MarkdownMessage } from "@/components/ui/markdown-message";
import {
  Send,
  Mic,
  Paperclip,
  Settings,
  Trash2,
  Copy,
  Check,
  Sparkles,
  MessageCircle,
  ChevronDown,
  Edit2,
} from "lucide-react";
import { useDebouncedCallback } from "use-debounce";
import { useParams } from "next/navigation";

const AIAvatar = ({ isThinking = false }: { isThinking?: boolean }) => (
  <div className={`flex-shrink-0 w-10 h-10 lux-gradient rounded-full flex items-center justify-center shadow-[var(--elev-1)] ring-2 ring-[var(--brand)]/10 transition-all duration-300 ${
    isThinking ? "animate-pulse ring-4 ring-[var(--brand)]/20" : ""
  }`}>
    <Sparkles className={`h-5 w-5 text-white relative z-10 transition-all duration-300 ${
      isThinking ? "animate-spin" : ""
    }`} />
  </div>
);

const UserAvatar = ({ initials }: { initials: string }) => (
  <div className="flex-shrink-0 w-10 h-10 bg-gradient-to-br from-primary/10 to-primary/5 border-2 border-primary/20 rounded-full flex items-center justify-center text-sm font-semibold text-primary shadow-[var(--elev-1)] transition-all duration-200 hover:shadow-[var(--elev-2)] hover:scale-105">
    {initials}
  </div>
);

interface MessageGroup {
  isUser: boolean;
  messages: Message[];
}

const groupMessages = (messages: Message[]): MessageGroup[] => {
  if (messages.length === 0) return [];

  const groups: MessageGroup[] = [];
  let currentGroup: MessageGroup = {
    isUser: messages[0].isUser,
    messages: [messages[0]],
  };

  for (let i = 1; i < messages.length; i++) {
    const currentMessage = messages[i];
    if (currentMessage.isUser === currentGroup.isUser) {
      // Same sender, add to current group
      currentGroup.messages.push(currentMessage);
    } else {
      // Different sender, start new group
      groups.push(currentGroup);
      currentGroup = {
        isUser: currentMessage.isUser,
        messages: [currentMessage],
      };
    }
  }

  // Don't forget the last group
  groups.push(currentGroup);
  return groups;
};

const getMessageRadius = (
  position: "first" | "middle" | "last" | "single",
  isUser: boolean
) => {
  const baseRadius = "rounded-xl";

  if (position === "single") return baseRadius;

  if (isUser) {
    // User messages (right side)
    switch (position) {
      case "first":
        return "rounded-xl rounded-br-md";
      case "middle":
        return "rounded-xl rounded-br-md rounded-tr-md";
      case "last":
        return "rounded-xl rounded-tr-md";
      default:
        return baseRadius;
    }
  } else {
    // AI messages (left side)
    switch (position) {
      case "first":
        return "rounded-xl rounded-bl-md";
      case "middle":
        return "rounded-xl rounded-bl-md rounded-tl-md";
      case "last":
        return "rounded-xl rounded-tl-md";
      default:
        return baseRadius;
    }
  }
};

interface ChatPanelProps {
  chatId: string;
}

export default function ChatPanel({ chatId }: ChatPanelProps) {
  const dispatch = useAppDispatch();
  const messages = useAppSelector(selectAllMessages);
  const {
    isLoading,
    currentInput,
    selectedProvider,
    error,
    streamingMessageId,
    selectedSourceIds,
  } = useAppSelector((state) => state.chat);
  const { isAuthenticated, user } = useAppSelector((state) => state.auth);
  const currentChat = useAppSelector(selectCurrentChat);

  // Create a memoized selector instance for this component
  const selectChatSources = useMemo(() => makeSelectSourcesForChat(), []);
  const chatSources = useAppSelector((state) =>
    chatId ? selectChatSources(state, chatId) : []
  );
  const [inputValue, setInputValue] = useState("");
  const [isProviderDropdownOpen, setIsProviderDropdownOpen] = useState(false);
  const [copiedMessageId, setCopiedMessageId] = useState<string | null>(null);
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [editingTitle, setEditingTitle] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const activeStreamRef = useRef<{ close: () => void } | null>(null);
  const params = useParams();
  const routeChatId = (params?.chatId as string) || null;
  // Check if there are any sources available in the chat
  const hasAvailableSources = chatSources.length > 0;

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

  const scrollToBottom = () => {
    // Use requestAnimationFrame to ensure DOM is updated before scrolling
    requestAnimationFrame(() => {
      messagesEndRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "end",
      });
    });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Also scroll when streaming starts/stops
  useEffect(() => {
    if (streamingMessageId) {
      // Small delay to ensure loading indicator is rendered
      setTimeout(scrollToBottom, 100);
    }
  }, [streamingMessageId]);

  // Cleanup stream on unmount
  useEffect(() => {
    return () => {
      if (activeStreamRef.current) {
        activeStreamRef.current.close();
        activeStreamRef.current = null;
      }
    };
  }, []);

  // Initialize chat on component mount (only when no chatId is provided)
  useEffect(() => {
    const initializeChat = async () => {
      if (!isAuthenticated || !user) {
        // Don't initialize chat if user is not authenticated
        return;
      }

      if (!chatId && !routeChatId) {
        try {
          const response = await chatApi.createChat("New Chat");
          dispatch(setCurrentChatId(response.chat._id));
        } catch (error) {
          console.error("Failed to create chat:", error);
        }
      }
    };

    initializeChat();
  }, [chatId, dispatch, isAuthenticated, user, routeChatId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (
      !inputValue.trim() ||
      isLoading ||
      !chatId ||
      !isAuthenticated ||
      !hasAvailableSources
    )
      return;

    const content = inputValue.trim();
    setInputValue("");

    // Close any existing stream before starting a new one
    if (activeStreamRef.current) {
      activeStreamRef.current.close();
      activeStreamRef.current = null;
    }

    try {
      // Use streaming instead of regular send
      const streamController = await chatApi.streamMessage(
        chatId,
        {
          content,
          sourceIds: selectedSourceIds,
          provider: selectedProvider,
        },
        (event) => {
          console.log("Stream event received:", event); // Debug log
          dispatch(handleStreamEvent(event));

          // Clean up when stream completes or errors
          if (event.type === "complete" || event.type === "error") {
            if (activeStreamRef.current) {
              activeStreamRef.current.close();
              activeStreamRef.current = null;
            }
            dispatch(stopStreaming());
          }
        }
      );

      // Store stream controller locally for cleanup
      activeStreamRef.current = streamController;

      // Don't start streaming here - wait for the "start" event
      // The streaming will be started when we receive the actual messageId from the server
    } catch (error) {
      console.error("Failed to send message:", error);
      setInputValue(content);
      dispatch(stopStreaming());
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  const adjustTextareaHeight = () => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  };

  useEffect(() => {
    adjustTextareaHeight();
  }, [inputValue]);

  const copyMessage = async (messageId: string, content: string) => {
    try {
      await navigator.clipboard.writeText(content);
      setCopiedMessageId(messageId);
      setTimeout(() => setCopiedMessageId(null), 2000);
    } catch (err) {
      console.error("Failed to copy message:", err);
      // Fallback for older browsers
      const textArea = document.createElement("textarea");
      textArea.value = content;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand("copy");
      document.body.removeChild(textArea);
      setCopiedMessageId(messageId);
      setTimeout(() => setCopiedMessageId(null), 2000);
    }
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

  const handleTitleEdit = () => {
    if (currentChat) {
      setEditingTitle(currentChat.title);
      setIsEditingTitle(true);
    }
  };

  const handleTitleChange = (newTitle: string) => {
    // Only update local input state immediately for responsive typing
    setEditingTitle(newTitle);

    if (chatId && currentChat) {
      // Debounced optimistic update (200ms) for UI feedback
      debouncedOptimisticUpdate(chatId, newTitle, currentChat.title);

      // Debounced API call (1000ms) to persist the change
      debouncedSaveTitle(chatId, newTitle, currentChat.title);
    }
  };

  const handleTitleSave = () => {
    // Force immediate save and exit editing mode
    if (
      chatId &&
      editingTitle.trim() &&
      editingTitle.trim() !== currentChat?.title
    ) {
      dispatch(renameChatTitle({ chatId, title: editingTitle.trim() }));
    }
    setIsEditingTitle(false);
    setEditingTitle("");
  };

  const handleTitleCancel = () => {
    setIsEditingTitle(false);
    setEditingTitle("");
  };

  const handleTitleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleTitleSave();
    } else if (e.key === "Escape") {
      e.preventDefault();
      handleTitleCancel();
    }
  };

  // Group messages for rendering
  const messageGroups = groupMessages(messages);

  // Show login prompt if not authenticated
  if (!isAuthenticated) {
    return (
      <div 
        className="flex-1 flex flex-col h-full bg-background items-center justify-center"
        role="main"
        aria-label="Login required"
      >
        <div className="text-center py-16 px-4">
          <div 
            className="inline-flex items-center justify-center w-20 h-20 lux-gradient rounded-full mb-6 shadow-[var(--elev-2)] floating"
            aria-hidden="true"
          >
            <MessageCircle className="h-10 w-10 text-white relative z-10" />
          </div>
          <h1 className="text-2xl font-bold mb-4 text-foreground">Chat with Your Videos</h1>
          <p className="text-muted-foreground max-w-lg mx-auto mb-6 text-lg leading-relaxed">
            Please sign in to start chatting with your video content and
            unlock AI-powered insights from your sources.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col h-full bg-background relative">
      {/* Enhanced Header with Context */}
      <div 
        className="shrink-0 p-4 sm:p-6 border-b border-border bg-surface-1/80 backdrop-blur-sm"
        role="banner"
        aria-label="Chat header"
      >
        {/* Chat Title Section */}
        {currentChat && (
          <div className="mb-4">
            {isEditingTitle ? (
              <div className="flex items-center gap-2">
                {currentChat.emoji && (
                  <span className="text-xl">{currentChat.emoji}</span>
                )}
                <input
                  type="text"
                  value={editingTitle}
                  onChange={(e) => handleTitleChange(e.target.value)}
                  onKeyDown={handleTitleKeyDown}
                  onBlur={handleTitleSave}
                  className="flex-1 text-lg font-semibold bg-transparent border-none outline-none focus:outline-none text-foreground"
                  autoFocus
                  placeholder="Chat title..."
                />
              </div>
            ) : (
              <button
                onClick={handleTitleEdit}
                className="flex items-center gap-2 text-lg font-semibold text-foreground hover:text-primary transition-colors group cursor-pointer"
              >
                {currentChat.emoji && (
                  <span className="text-xl">{currentChat.emoji}</span>
                )}
                <span className="group-hover:underline">
                  {currentChat.title}
                </span>
                <Edit2 className="h-4 w-4 opacity-0 group-hover:opacity-100 transition-opacity" />
              </button>
            )}
          </div>
        )}

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-2 h-2 bg-emerald-500 rounded-full" />
            <span className="text-sm text-muted-foreground">
              {selectedSourceIds.length} sources selected
            </span>
            {selectedSourceIds.length > 0 && (
              <Badge variant="outline" className="text-xs">
                Ready for analysis
              </Badge>
            )}
          </div>

          <div className="flex items-center gap-2">
            <div className="relative">
              <Button
                variant="ghost"
                size="sm"
                className="gap-2 text-xs capitalize"
                onClick={() =>
                  setIsProviderDropdownOpen(!isProviderDropdownOpen)
                }
              >
                {selectedProvider}
                <ChevronDown className="h-3 w-3" />
              </Button>

              {isProviderDropdownOpen && (
                <div className="absolute top-full right-0 mt-1 bg-background border border-border rounded-[var(--r-2)] shadow-[var(--elev-2)] z-10 min-w-24">
                  {(["openai", "anthropic", "google"] as const).map(
                    (provider) => (
                      <button
                        key={provider}
                        onClick={() => {
                          dispatch(setSelectedProvider(provider));
                          setIsProviderDropdownOpen(false);
                        }}
                        className={`w-full text-left px-3 py-2 text-xs capitalize hover:bg-accent first:rounded-t-[var(--r-2)] last:rounded-b-[var(--r-2)] ${
                          selectedProvider === provider ? "bg-accent" : ""
                        }`}
                      >
                        {provider}
                      </button>
                    )
                  )}
                </div>
              )}
            </div>

            <Button
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0"
              onClick={() => dispatch(clearMessages())}
              title="Clear chat"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Error Display */}
        {error && (
          <div className="mt-3 p-3 bg-destructive/10 border border-destructive/20 rounded-[var(--r-2)]">
            <p className="text-sm text-destructive">{error}</p>
          </div>
        )}
      </div>

      {/* Enhanced Messages with Grouping */}
      <div
        className="flex-1 overflow-y-auto overflow-x-hidden scroll-smooth scrollbar-visible"
        style={{ scrollbarGutter: "stable" }}
        role="main"
        aria-label="Chat messages"
        tabIndex={0}
      >
        <div className="p-4 sm:p-6">
          <div className="max-w-4xl mx-auto space-y-8">
            {messageGroups.length === 0 ? (
              <div className="text-center py-20 px-4">
                <div 
                  className="relative inline-flex items-center justify-center w-24 h-24 lux-gradient rounded-full mb-8 shadow-[var(--elev-2)] floating"
                  aria-hidden="true"
                >
                  <Sparkles className="h-12 w-12 text-white relative z-10" />
                  <div className="absolute inset-0 rounded-full bg-gradient-to-r from-transparent via-white/20 to-transparent animate-pulse"></div>
                </div>
                <h2 className="text-2xl sm:text-3xl font-bold mb-6 text-foreground bg-gradient-to-r from-primary to-primary/70 bg-clip-text text-transparent">
                  Welcome to ChatTube
                </h2>
                {!hasAvailableSources ? (
                  <div>
                    <p className="text-muted-foreground text-base sm:text-lg leading-relaxed max-w-lg mx-auto mb-4">
                      Add sources to your chat to start analyzing and asking
                      questions about your content.
                    </p>
                    <Badge
                      variant="outline"
                      className="bg-orange-50 border-orange-200 text-orange-700 dark:bg-orange-950 dark:border-orange-800 dark:text-orange-300"
                    >
                      No sources added yet
                    </Badge>
                  </div>
                ) : (
                  <div>
                    <p className="text-muted-foreground text-base sm:text-lg leading-relaxed max-w-lg mx-auto mb-4">
                      Start a conversation by asking questions about your
                      sources. I&apos;ll help you explore and understand your
                      content with intelligent AI analysis.
                    </p>
                    <Badge
                      variant="outline"
                      className="bg-primary/5 border-primary/20 text-primary"
                    >
                      {chatSources.length} sources ready for analysis
                    </Badge>
                  </div>
                )}
              </div>
            ) : (
              messageGroups.map((group, groupIndex) => (
                <div
                  key={`group-${groupIndex}`}
                  className={`flex gap-4 animate-chat-in ${
                    group.isUser ? "justify-end" : "justify-start"
                  }`}
                  style={{ animationDelay: `${groupIndex * 50}ms` }}
                >
                  {/* Avatar - only shown for first message in group */}
                  {!group.isUser && <AIAvatar />}

                  {/* Message Stack */}
                  <div
                    className={`flex flex-col gap-1 ${
                      group.isUser ? "items-end" : "items-start"
                    } flex-1 min-w-0 max-w-[80%]`}
                  >
                    {group.messages.map((message, messageIndex) => {
                      const isFirst = messageIndex === 0;
                      const isLast = messageIndex === group.messages.length - 1;
                      const position =
                        group.messages.length === 1
                          ? "single"
                          : isFirst
                          ? "first"
                          : isLast
                          ? "last"
                          : "middle";

                      return (
                        <div key={message.id} className="w-full">
                          {/* Message Bubble */}
                          <div
                            className={`
                              p-4 break-words transition-all duration-300 hover:shadow-[var(--elev-2)] ${getMessageRadius(
                                position,
                                group.isUser
                              )}
                              ${
                                group.isUser
                                  ? "lux-gradient text-white shadow-lg ml-auto max-w-fit hover:scale-[1.01]"
                                  : "card-soft shadow-[var(--elev-1)] max-w-fit hover:bg-surface-2/50"
                              }
                            `}
                          >
                            <MarkdownMessage
                              content={message.content}
                              isUser={message.isUser}
                              isStreaming={message.isStreaming}
                              className={message.isUser ? "text-white" : ""}
                              citationMap={message.metadata?.citationMap}
                            />
                          </div>

                          {/* Message Metadata */}
                          <div
                            className={`flex items-center gap-3 mt-2 text-xs text-muted-foreground/80 opacity-0 group-hover:opacity-100 transition-all duration-200 ${
                              group.isUser ? "justify-end" : "justify-start"
                            }`}
                          >
                            <span className="bg-background/50 backdrop-blur-sm px-2 py-1 rounded-md border border-border/30">
                              {new Date(message.timestamp).toLocaleTimeString(
                                [],
                                {
                                  hour: "2-digit",
                                  minute: "2-digit",
                                }
                              )}
                            </span>
                            {message.sources && message.sources.length > 0 && (
                              <Badge variant="secondary" className="text-xs bg-primary/10 text-primary border-primary/20">
                                {message.sources.length} sources
                              </Badge>
                            )}
                            {!message.isUser && (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-6 w-6 p-0 hover:bg-primary/10 rounded-md transition-all duration-200 hover:scale-110"
                                onClick={() =>
                                  copyMessage(message.id, message.content)
                                }
                                title={
                                  copiedMessageId === message.id
                                    ? "Copied!"
                                    : "Copy message"
                                }
                              >
                                {copiedMessageId === message.id ? (
                                  <Check className="h-3 w-3 text-emerald-500" />
                                ) : (
                                  <Copy className="h-3 w-3" />
                                )}
                              </Button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* User Avatar - positioned after messages */}
                  {group.isUser && <UserAvatar initials={getUserInitials()} />}
                </div>
              ))
            )}

            {/* Enhanced Thinking Indicator */}
            {isLoading && (
              <div className="flex gap-4 justify-start animate-chat-in">
                <AIAvatar isThinking={true} />
                <div className="card-soft p-4 rounded-xl rounded-tl-md shadow-[var(--elev-1)] max-w-fit relative overflow-hidden">
                  <div className="streaming-reveal text-sm mb-1">Analyzing your sources...</div>
                  <div className="flex items-center gap-2 mt-2">
                    <div className="flex gap-1">
                      <div className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{animationDelay: '0ms'}} />
                      <div className="w-2 h-2 bg-primary/70 rounded-full animate-bounce" style={{animationDelay: '150ms'}} />
                      <div className="w-2 h-2 bg-primary/40 rounded-full animate-bounce" style={{animationDelay: '300ms'}} />
                    </div>
                    <span className="text-xs text-muted-foreground">AI thinking</span>
                  </div>
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-primary/5 to-transparent animate-pulse" />
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>
        </div>
      </div>

      {/* Enhanced Input Area with Premium Dock Styling */}
      <div 
        className="shrink-0 p-4 sm:p-6 border-t border-border bg-gradient-to-t from-background via-surface-1/90 to-surface-1/80 backdrop-blur-sm input-dock"
        role="complementary"
        aria-label="Message input area"
      >
        <form onSubmit={handleSubmit} className="max-w-4xl mx-auto" role="form">
          <div className="relative group">
            <div className="absolute inset-0 bg-gradient-to-r from-primary/10 via-primary/5 to-primary/10 rounded-xl opacity-0 group-focus-within:opacity-100 transition-all duration-300 blur-sm" />
            <textarea
              ref={textareaRef}
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={
                !hasAvailableSources
                  ? "Add sources to start chatting..."
                  : "Ask me anything about your sources..."
              }
              className="w-full min-h-[64px] max-h-40 p-5 pr-28 bg-background/95 backdrop-blur-sm border-2 border-border/50 rounded-xl focus:outline-none focus:border-primary/50 focus:shadow-[0_0_0_0_var(--primary),0_0_20px_-5px_hsl(var(--primary)/20%)] resize-none transition-all duration-300 overflow-hidden [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none] relative z-10 placeholder:text-muted-foreground/60"
              rows={1}
              disabled={isLoading || !hasAvailableSources}
              aria-label={!hasAvailableSources ? "Add sources to start chatting" : "Type your message"}
              aria-describedby="input-help-text"
            />

            <div className="absolute right-4 bottom-4 flex items-center gap-2 z-10">
              <div className="hidden sm:flex items-center gap-1 mr-2">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-9 w-9 p-0 rounded-lg hover:bg-primary/10 transition-all duration-200 hover:scale-105"
                  disabled={isLoading || !hasAvailableSources}
                  title="Attach files"
                >
                  <Paperclip className="h-4 w-4" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-9 w-9 p-0 rounded-lg hover:bg-primary/10 transition-all duration-200 hover:scale-105"
                  disabled={isLoading || !hasAvailableSources}
                  title="Voice input"
                >
                  <Mic className="h-4 w-4" />
                </Button>
              </div>
              <Button
                type="submit"
                size="sm"
                variant="brand"
                className={`h-10 w-10 p-0 lux-gradient text-white shadow-lg hover:shadow-xl transition-all duration-200 rounded-lg relative overflow-hidden ${
                  !inputValue.trim() || isLoading || !hasAvailableSources
                    ? "opacity-50 cursor-not-allowed"
                    : "hover:scale-105 active:scale-95"
                }`}
                disabled={
                  !inputValue.trim() || isLoading || !hasAvailableSources
                }
                title="Send message"
              >
                {isLoading ? (
                  <div className="animate-spin h-4 w-4 border-2 border-white/30 border-t-white rounded-full" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>

          <div className="flex items-center justify-between mt-4 text-xs text-muted-foreground" id="input-help-text">
            <div className="flex items-center gap-3 flex-wrap">
              <div className="hidden sm:flex items-center gap-1 text-muted-foreground/70" role="note" aria-label="Keyboard shortcuts">
                <kbd className="px-2 py-1 bg-muted/30 rounded text-xs font-mono border border-border/50" aria-label="Enter key">⏎</kbd>
                <span>send</span>
                <span className="mx-1" aria-hidden="true">•</span>
                <kbd className="px-2 py-1 bg-muted/30 rounded text-xs font-mono border border-border/50" aria-label="Shift plus Enter">⇧⏎</kbd>
                <span>new line</span>
              </div>
              <div className="flex items-center gap-2">
                {!hasAvailableSources ? (
                  <Badge
                    variant="outline"
                    className="text-xs bg-orange-50 border-orange-200 text-orange-700 dark:bg-orange-950 dark:border-orange-800 dark:text-orange-300"
                  >
                    No sources available
                  </Badge>
                ) : (
                  <Badge variant="secondary" className="text-xs bg-emerald-50 border-emerald-200 text-emerald-700 dark:bg-emerald-950 dark:border-emerald-800 dark:text-emerald-300">
                    <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full mr-1.5" />
                    <span className="hidden sm:inline">Vector search: </span>
                    {selectedSourceIds.length} sources selected
                  </Badge>
                )}
                <Badge variant="outline" className="text-xs capitalize bg-primary/5 border-primary/20 text-primary">
                  <div className="w-1.5 h-1.5 bg-primary rounded-full mr-1.5 animate-pulse" />
                  {selectedProvider}
                </Badge>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <div className="flex items-center gap-1.5">
                <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse shadow-[0_0_8px_hsl(var(--emerald-500)/50%)]" />
                <span className="text-emerald-600 dark:text-emerald-400 font-medium">Connected</span>
              </div>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
