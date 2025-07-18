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
} from "@/lib/features/chat/chatSlice";
import { chatApi } from "@/lib/api/services/chat";
import { Button } from "@/components/ui/button";
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
} from "lucide-react";

const AIAvatar = () => (
  <div className="flex-shrink-0 w-10 h-10 lux-gradient rounded-full flex items-center justify-center shadow-[var(--elev-1)] ring-2 ring-primary/10">
    <Sparkles className="h-5 w-5 text-white relative z-10" />
  </div>
);

const UserAvatar = ({ initials }: { initials: string }) => (
  <div className="flex-shrink-0 w-10 h-10 bg-muted/20 border border-border/50 rounded-full flex items-center justify-center text-sm font-medium text-foreground">
    {initials}
  </div>
);

interface MessageGroup {
  isUser: boolean;
  messages: any[];
}

const groupMessages = (messages: any[]): MessageGroup[] => {
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

export function ChatPanel() {
  const dispatch = useAppDispatch();
  const {
    messages,
    isLoading,
    currentInput,
    currentChatId,
    selectedProvider,
    error,
    streamingMessageId,
  } = useAppSelector((state) => state.chat);
  const { selectedSources } = useAppSelector((state) => state.sources);
  const { isAuthenticated, user } = useAppSelector((state) => state.auth);
  const [inputValue, setInputValue] = useState("");
  const [isProviderDropdownOpen, setIsProviderDropdownOpen] = useState(false);
  const [copiedMessageId, setCopiedMessageId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const activeStreamRef = useRef<{ close: () => void } | null>(null);

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

  // Initialize chat on component mount (only when authenticated)
  useEffect(() => {
    const initializeChat = async () => {
      if (!isAuthenticated || !user) {
        // Don't initialize chat if user is not authenticated
        return;
      }

      if (!currentChatId) {
        try {
          const response = await chatApi.createChat("New Chat");
          dispatch(setCurrentChatId(response.chat._id));
        } catch (error) {
          console.error("Failed to create chat:", error);
        }
      }
    };

    initializeChat();
  }, [currentChatId, dispatch, isAuthenticated, user]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputValue.trim() || isLoading || !currentChatId || !isAuthenticated)
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
        currentChatId,
        {
          content,
          videoIds: selectedSources,
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

  // Group messages for rendering
  const messageGroups = groupMessages(messages);

  // Show login prompt if not authenticated
  if (!isAuthenticated) {
    return (
      <div className="flex-1 flex flex-col h-full bg-background items-center justify-center">
        <div className="text-center py-12">
          <div className="inline-flex items-center justify-center w-16 h-16 lux-gradient rounded-full mb-4 shadow-[var(--elev-2)]">
            <MessageCircle className="h-8 w-8 text-white relative z-10" />
          </div>
          <h3 className="text-lg font-semibold mb-2">Chat with Your Videos</h3>
          <p className="text-muted-foreground max-w-md mx-auto mb-4">
            Please sign in to start chatting with your video content and
            sources.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col h-full bg-background relative">
      {/* Enhanced Header with Context */}
      <div className="shrink-0 p-4 sm:p-6 border-b border-border bg-surface-1/80 backdrop-blur-sm">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-2 h-2 bg-emerald-500 rounded-full" />
            <span className="text-sm text-muted-foreground">
              {selectedSources.length} sources selected
            </span>
            {selectedSources.length > 0 && (
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
      >
        <div className="p-4 sm:p-6">
          <div className="max-w-4xl mx-auto space-y-6">
            {messageGroups.length === 0 ? (
              <div className="text-center py-16">
                <div className="inline-flex items-center justify-center w-20 h-20 lux-gradient rounded-full mb-6 shadow-[var(--elev-2)] floating">
                  <Sparkles className="h-10 w-10 text-white relative z-10" />
                </div>
                <h3 className="text-xl font-semibold mb-4 text-foreground">
                  Welcome to ChatTube
                </h3>
                <p className="text-muted-foreground text-lg leading-relaxed max-w-lg mx-auto">
                  Start a conversation by asking questions about your selected
                  sources. I&apos;ll help you explore and understand your
                  content with intelligent AI analysis.
                </p>
                {selectedSources.length > 0 && (
                  <div className="mt-6">
                    <Badge
                      variant="outline"
                      className="bg-primary/5 border-primary/20 text-primary"
                    >
                      {selectedSources.length} sources ready for analysis
                    </Badge>
                  </div>
                )}
              </div>
            ) : (
              messageGroups.map((group, groupIndex) => (
                <div
                  key={`group-${groupIndex}`}
                  className={`flex gap-4 ${
                    group.isUser ? "justify-end" : "justify-start"
                  }`}
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
                              p-4 break-words transition-all duration-200 ${getMessageRadius(
                                position,
                                group.isUser
                              )}
                              ${
                                group.isUser
                                  ? "lux-gradient text-white shadow-lg ml-auto max-w-fit"
                                  : "card-soft shadow-[var(--elev-1)] max-w-fit"
                              }
                            `}
                          >
                            <MarkdownMessage
                              content={message.content}
                              isUser={message.isUser}
                              isStreaming={message.isStreaming}
                              className={message.isUser ? "text-white" : ""}
                            />
                          </div>

                          {/* Message Metadata */}
                          <div
                            className={`flex items-center gap-2 mt-1 text-xs text-muted-foreground ${
                              group.isUser ? "justify-end" : "justify-start"
                            }`}
                          >
                            <span>
                              {new Date(message.timestamp).toLocaleTimeString(
                                [],
                                {
                                  hour: "2-digit",
                                  minute: "2-digit",
                                }
                              )}
                            </span>
                            {message.sources && message.sources.length > 0 && (
                              <Badge variant="outline" className="text-xs">
                                {message.sources.length} sources
                              </Badge>
                            )}
                            {!message.isUser && (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-5 w-5 p-0 hover:bg-primary/10"
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
                                  <Check className="h-3 w-3 text-green-500" />
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
              <div className="flex gap-4 justify-start">
                <AIAvatar />
                <div className="card-soft p-4 rounded-xl rounded-tl-md shadow-[var(--elev-1)] max-w-fit">
                  <div className="streaming-reveal text-sm">Thinking...</div>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>
        </div>
      </div>

      {/* Enhanced Input Area with Premium Dock Styling */}
      <div className="shrink-0 p-4 sm:p-6 border-t border-border bg-surface-1/80 backdrop-blur-sm input-dock">
        <form onSubmit={handleSubmit} className="max-w-4xl mx-auto">
          <div className="relative">
            <textarea
              ref={textareaRef}
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask me anything about your sources..."
              className="w-full min-h-[56px] max-h-32 p-4 pr-24 bg-background border border-border rounded-xl focus:outline-none focus-lux resize-none shadow-[var(--elev-1)] transition-all duration-200 hide-scrollbar"
              rows={1}
              disabled={isLoading}
            />

            <div className="absolute right-3 bottom-3 flex items-center gap-1 sm:gap-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0 hidden sm:flex"
                disabled={isLoading}
              >
                <Paperclip className="h-4 w-4" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0 hidden sm:flex"
                disabled={isLoading}
              >
                <Mic className="h-4 w-4" />
              </Button>
              <Button
                type="submit"
                size="sm"
                variant="brand"
                className="h-8 w-8 p-0 lux-gradient text-white shadow-lg hover:shadow-xl transition-all duration-200"
                disabled={!inputValue.trim() || isLoading}
              >
                <Send className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <div className="flex items-center justify-between mt-3 text-xs text-muted-foreground">
            <div className="flex items-center gap-2 sm:gap-4">
              <span className="hidden sm:inline">
                Press Enter to send, Shift+Enter for new line
              </span>
              <span className="sm:hidden">Enter to send</span>
              {selectedSources.length > 0 && (
                <Badge variant="outline" className="text-xs">
                  <span className="hidden sm:inline">Vector search: </span>
                  {selectedSources.length} sources
                </Badge>
              )}
              <Badge variant="outline" className="text-xs capitalize">
                {selectedProvider}
              </Badge>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <div className="w-2 h-2 bg-emerald-500 rounded-full" />
              <span>Connected</span>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
