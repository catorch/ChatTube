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
    <div className="flex-1 flex flex-col h-full bg-background">
      {/* Header */}
      <div className="shrink-0 p-4 sm:p-6 border-b border-border bg-card/50 backdrop-blur-sm">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="flex items-center gap-2">
              <MessageCircle className="h-4 w-4 sm:h-5 sm:w-5 text-primary" />
              <h1 className="text-lg sm:text-xl font-semibold tracking-tight">
                ChatTube
              </h1>
            </div>
            <Badge
              variant="secondary"
              className="text-xs hidden xs:inline-flex"
            >
              {selectedSources.length} sources selected
            </Badge>
          </div>
          <div className="flex items-center gap-2">
            {/* LLM Provider Selector */}
            <div className="relative">
              <Button
                variant="surface"
                size="sm"
                onClick={() =>
                  setIsProviderDropdownOpen(!isProviderDropdownOpen)
                }
                className="text-xs capitalize"
              >
                {selectedProvider}
                <ChevronDown className="h-3 w-3 ml-1" />
              </Button>

              {isProviderDropdownOpen && (
                <div className="absolute right-0 top-full mt-1 bg-popover border border-border rounded-[var(--r-2)] shadow-[var(--elev-2)] z-50 min-w-[100px]">
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

      {/* Messages - Enhanced with better sizing */}
      <div
        className="flex-1 overflow-y-auto overflow-x-hidden scroll-smooth scrollbar-visible"
        style={{ scrollbarGutter: "stable" }}
      >
        <div className="p-4 sm:p-6">
          {/* Enhanced container with proper max-width handling */}
          <div className="max-w-4xl mx-auto space-y-4 sm:space-y-6">
            {messages.length === 0 ? (
              <div className="text-center py-12">
                <div className="inline-flex items-center justify-center w-16 h-16 lux-gradient rounded-full mb-4 shadow-[var(--elev-2)]">
                  <Sparkles className="h-8 w-8 text-white relative z-10" />
                </div>
                <h3 className="text-lg font-semibold mb-2">
                  Welcome to ChatTube
                </h3>
                <p className="text-muted-foreground max-w-md mx-auto">
                  Start a conversation by asking questions about your selected
                  sources. I&apos;ll help you explore and understand your
                  content.
                </p>
              </div>
            ) : (
              messages.map((message) => (
                <div
                  key={message.id}
                  className={`flex gap-4 ${
                    message.isUser ? "justify-end" : "justify-start"
                  }`}
                >
                  {!message.isUser && (
                    <div className="flex-shrink-0 w-8 h-8 lux-gradient rounded-full flex items-center justify-center shadow-[var(--elev-1)]">
                      <Sparkles className="h-4 w-4 text-white relative z-10" />
                    </div>
                  )}

                  <div className={`${message.isUser ? "order-first" : ""}`}>
                    {/* Enhanced ChatBubble with improved responsive sizing */}
                    <div
                      className={`p-4 shadow-[var(--elev-1)] break-words rounded-[var(--r-3)] transition-all duration-200 ${
                        // Enhanced responsive max-width: 80% on ≥1024px, full width with padding on smaller
                        message.isUser
                          ? "max-w-[85%] sm:max-w-[75%] lg:max-w-[80%] ml-auto"
                          : "max-w-[90%] sm:max-w-[85%] lg:max-w-[80%]"
                      } ${
                        message.isUser ? "lux-gradient text-white" : "card-soft"
                      }`}
                    >
                      <MarkdownMessage
                        content={message.content}
                        isUser={message.isUser}
                        isStreaming={message.isStreaming}
                        className={message.isUser ? "text-white" : ""}
                      />
                    </div>

                    <div
                      className={`flex items-center gap-2 mt-2 text-xs text-muted-foreground ${
                        message.isUser ? "justify-end" : "justify-start"
                      }`}
                    >
                      <span>
                        {new Date(message.timestamp).toLocaleTimeString()}
                      </span>
                      {message.sources && message.sources.length > 0 && (
                        <Badge variant="outline" className="text-xs">
                          {message.sources.length} sources
                        </Badge>
                      )}
                      {!message.isUser && (
                        <div className="flex items-center gap-1 ml-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 w-6 p-0 cursor-pointer"
                            onClick={async () => {
                              try {
                                await navigator.clipboard.writeText(
                                  message.content
                                );
                                setCopiedMessageId(message.id);
                                console.log("Message copied to clipboard");
                                // Reset the check mark after 2 seconds
                                setTimeout(() => {
                                  setCopiedMessageId(null);
                                }, 2000);
                              } catch (err) {
                                console.error("Failed to copy message:", err);
                                // Fallback for older browsers
                                const textArea =
                                  document.createElement("textarea");
                                textArea.value = message.content;
                                document.body.appendChild(textArea);
                                textArea.select();
                                document.execCommand("copy");
                                document.body.removeChild(textArea);
                                setCopiedMessageId(message.id);
                                setTimeout(() => {
                                  setCopiedMessageId(null);
                                }, 2000);
                              }
                            }}
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
                        </div>
                      )}
                    </div>
                  </div>

                  {message.isUser && (
                    <div className="flex-shrink-0 w-8 h-8 bg-gradient-to-br from-gray-600 to-gray-700 rounded-full flex items-center justify-center">
                      <span className="text-white text-sm font-medium">Y</span>
                    </div>
                  )}
                </div>
              ))
            )}

            {/* Enhanced loading indicator with gradient reveal */}
            {isLoading && (
              <div className="flex gap-4 justify-start">
                <div className="flex-shrink-0 w-8 h-8 lux-gradient rounded-full flex items-center justify-center shadow-[var(--elev-1)]">
                  <Sparkles className="h-4 w-4 text-white animate-pulse relative z-10" />
                </div>
                <div className="card-soft p-4 rounded-[var(--r-3)]">
                  <div className="flex items-center gap-2">
                    <div className="flex gap-1">
                      <div className="w-2 h-2 bg-[var(--brand)] rounded-full animate-bounce" />
                      <div
                        className="w-2 h-2 bg-[var(--brand)] rounded-full animate-bounce"
                        style={{ animationDelay: "0.1s" }}
                      />
                      <div
                        className="w-2 h-2 bg-[var(--brand)] rounded-full animate-bounce"
                        style={{ animationDelay: "0.2s" }}
                      />
                    </div>
                    <span className="text-sm text-muted-foreground streaming-reveal">
                      Thinking...
                    </span>
                  </div>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>
        </div>
      </div>

      {/* Enhanced Input Area with Dock Shadow */}
      <div className="shrink-0 p-4 sm:p-6 border-t border-border bg-card/50 backdrop-blur-sm input-dock">
        <form onSubmit={handleSubmit} className="max-w-4xl mx-auto">
          <div className="relative">
            <textarea
              ref={textareaRef}
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask me anything about your sources..."
              className="w-full min-h-[56px] max-h-32 p-4 pr-24 bg-background border border-border rounded-[var(--r-2)] focus:outline-none focus-lux resize-none shadow-[var(--elev-1)] transition-all duration-200"
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
                className="h-8 w-8 p-0"
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
