'use client';

import { useState, useRef, useEffect } from 'react';
import { useAppSelector, useAppDispatch } from '@/lib/hooks';
import { 
  sendMessage, 
  setCurrentInput, 
  setSelectedProvider,
  clearMessages,
  setCurrentChatId,
  startStreaming,
  stopStreaming,
  handleStreamEvent
} from '@/lib/features/chat/chatSlice';
import { chatApi } from '@/lib/api/services/chat';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { 
  Send, 
  Mic, 
  Paperclip, 
  Settings, 
  Trash2,
  Copy,
  ThumbsUp,
  ThumbsDown,
  Sparkles,
  MessageCircle,
  ChevronDown
} from 'lucide-react';

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
    activeStream
  } = useAppSelector((state) => state.chat);
  const { selectedSources } = useAppSelector((state) => state.sources);
  const [inputValue, setInputValue] = useState('');
  const [isProviderDropdownOpen, setIsProviderDropdownOpen] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Initialize chat on component mount
  useEffect(() => {
    const initializeChat = async () => {
      if (!currentChatId) {
        try {
          const response = await chatApi.createChat('New Chat');
          dispatch(setCurrentChatId(response.chat._id));
        } catch (error) {
          console.error('Failed to create chat:', error);
        }
      }
    };

    initializeChat();
  }, [currentChatId, dispatch]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputValue.trim() || isLoading || !currentChatId) return;

    const content = inputValue.trim();
    setInputValue('');

    try {
      // Use streaming instead of regular send
      const eventSource = chatApi.streamMessage(
        currentChatId,
        {
          content,
          videoIds: selectedSources,
          provider: selectedProvider,
        },
        (event) => {
          dispatch(handleStreamEvent(event));
        }
      );

      dispatch(startStreaming({ messageId: 'temp', stream: eventSource }));

      // Clean up event source when complete or error
      eventSource.addEventListener('message', (event) => {
        const data = JSON.parse(event.data);
        if (data.type === 'complete' || data.type === 'error') {
          dispatch(stopStreaming());
        }
      });

    } catch (error) {
      console.error('Failed to send message:', error);
      setInputValue(content);
      dispatch(stopStreaming());
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  const adjustTextareaHeight = () => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  };

  useEffect(() => {
    adjustTextareaHeight();
  }, [inputValue]);

  return (
    <div className="flex-1 flex flex-col h-full bg-background">
      {/* Header */}
      <div className="p-4 sm:p-6 border-b border-border bg-card/50">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="flex items-center gap-2">
              <MessageCircle className="h-4 w-4 sm:h-5 sm:w-5 text-primary" />
              <h1 className="text-lg sm:text-xl font-semibold tracking-tight">ChatTube</h1>
            </div>
            <Badge variant="secondary" className="text-xs hidden xs:inline-flex">
              {selectedSources.length} sources selected
            </Badge>
          </div>
          <div className="flex items-center gap-2">
            {/* LLM Provider Selector */}
            <div className="relative">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsProviderDropdownOpen(!isProviderDropdownOpen)}
                className="text-xs capitalize"
              >
                {selectedProvider}
                <ChevronDown className="h-3 w-3 ml-1" />
              </Button>
              
              {isProviderDropdownOpen && (
                <div className="absolute right-0 top-full mt-1 bg-popover border border-border rounded-lg shadow-lg z-50 min-w-[100px]">
                  {(['openai', 'anthropic', 'google'] as const).map((provider) => (
                    <button
                      key={provider}
                      onClick={() => {
                        dispatch(setSelectedProvider(provider));
                        setIsProviderDropdownOpen(false);
                      }}
                      className={`w-full text-left px-3 py-2 text-xs capitalize hover:bg-accent first:rounded-t-lg last:rounded-b-lg ${
                        selectedProvider === provider ? 'bg-accent' : ''
                      }`}
                    >
                      {provider}
                    </button>
                  ))}
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
          <div className="mt-3 p-3 bg-destructive/10 border border-destructive/20 rounded-lg">
            <p className="text-sm text-destructive">{error}</p>
          </div>
        )}
      </div>

      {/* Messages */}
      <ScrollArea className="flex-1 p-4 sm:p-6">
        <div className="max-w-4xl mx-auto space-y-4 sm:space-y-6">
          {messages.length === 0 ? (
            <div className="text-center py-12">
              <div className="inline-flex items-center justify-center w-16 h-16 lux-gradient rounded-full mb-4 shadow-[var(--elev-2)]">
                <Sparkles className="h-8 w-8 text-white" />
              </div>
              <h3 className="text-lg font-semibold mb-2">Welcome to ChatTube</h3>
              <p className="text-muted-foreground max-w-md mx-auto">
                Start a conversation by asking questions about your selected sources. 
                I&apos;ll help you explore and understand your content.
              </p>
            </div>
          ) : (
            messages.map((message) => (
              <div
                key={message.id}
                className={`flex gap-4 ${message.isUser ? 'justify-end' : 'justify-start'}`}
              >
                {!message.isUser && (
                  <div className="flex-shrink-0 w-8 h-8 lux-gradient rounded-full flex items-center justify-center shadow-[var(--elev-1)]">
                    <Sparkles className="h-4 w-4 text-white" />
                  </div>
                )}
                
                <div className={`max-w-[70%] ${message.isUser ? 'order-first' : ''}`}>
                  <div
                    className={`p-4 max-w-fit rounded-3xl shadow-[var(--elev-1)] animate-chat-in ${
                      message.isUser
                        ? 'lux-gradient text-white ml-auto'
                        : 'card-soft'
                    } break-words`}
                  >
                    <p className="text-sm leading-relaxed whitespace-pre-wrap">
                      {message.content}
                      {message.isStreaming && (
                        <span className="inline-block w-2 h-4 bg-current ml-1 animate-pulse" />
                      )}
                    </p>
                  </div>
                  
                  <div className={`flex items-center gap-2 mt-2 text-xs text-muted-foreground ${
                    message.isUser ? 'justify-end' : 'justify-start'
                  }`}>
                    <span>{message.timestamp.toLocaleTimeString()}</span>
                    {message.sources && message.sources.length > 0 && (
                      <Badge variant="outline" className="text-xs">
                        {message.sources.length} sources
                      </Badge>
                    )}
                    {!message.isUser && (
                      <div className="flex items-center gap-1 ml-2">
                        <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
                          <Copy className="h-3 w-3" />
                        </Button>
                        <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
                          <ThumbsUp className="h-3 w-3" />
                        </Button>
                        <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
                          <ThumbsDown className="h-3 w-3" />
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
          
          {isLoading && (
            <div className="flex gap-4 justify-start animate-chat-in">
              <div className="flex-shrink-0 w-8 h-8 lux-gradient rounded-full flex items-center justify-center shadow-[var(--elev-1)]">
                <Sparkles className="h-4 w-4 text-white animate-pulse" />
              </div>
              <div className="card-soft p-4 rounded-3xl">
                <div className="flex items-center gap-2">
                  <div className="flex gap-1">
                    <div className="w-2 h-2 bg-[var(--accent)] rounded-full animate-bounce" />
                    <div className="w-2 h-2 bg-[var(--accent)] rounded-full animate-bounce" style={{ animationDelay: '0.1s' }} />
                    <div className="w-2 h-2 bg-[var(--accent)] rounded-full animate-bounce" style={{ animationDelay: '0.2s' }} />
                  </div>
                  <span className="text-sm text-muted-foreground">Thinking...</span>
                </div>
              </div>
            </div>
          )}
          
          <div ref={messagesEndRef} />
        </div>
      </ScrollArea>

      {/* Input Area */}
      <div className="p-4 sm:p-6 border-t border-border bg-card/50">
        <form onSubmit={handleSubmit} className="max-w-4xl mx-auto">
          <div className="relative">
            <textarea
              ref={textareaRef}
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask me anything about your sources..."
              className="w-full min-h-[56px] max-h-32 p-4 pr-24 bg-background border border-border rounded-xl focus:outline-none focus-lux resize-none"
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
                className="h-8 w-8 p-0 lux-gradient"
                disabled={!inputValue.trim() || isLoading}
              >
                <Send className="h-4 w-4" />
              </Button>
            </div>
          </div>
          
          <div className="flex items-center justify-between mt-3 text-xs text-muted-foreground">
            <div className="flex items-center gap-2 sm:gap-4">
              <span className="hidden sm:inline">Press Enter to send, Shift+Enter for new line</span>
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