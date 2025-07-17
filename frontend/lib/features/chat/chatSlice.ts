import { createSlice, PayloadAction, createAsyncThunk } from "@reduxjs/toolkit";
import {
  chatApi,
  SendMessageRequest,
  Message as ApiMessage,
  StreamEvent,
  Chat as ApiChat,
} from "../../api/services/chat";
import { resetStore } from "../../store";

export interface Message {
  id: string;
  content: string;
  isUser: boolean;
  timestamp: string;
  sources?: string[];
  metadata?: {
    videoReferences?: any[];
    model?: string;
    tokenCount?: number;
  };
  isStreaming?: boolean;
}

export interface Chat {
  id: string;
  title: string;
  lastMessage: string;
  timestamp: string; // Changed from Date to string (ISO format)
  messageCount: number;
  isActive: boolean;
  videoIds: string[];
}

interface ChatState {
  messages: Message[];
  isLoading: boolean;
  error: string | null;
  currentInput: string;
  currentChatId: string | null;
  selectedProvider: "openai" | "anthropic" | "google";
  streamingMessageId: string | null;
  // Chat list management
  chatList: Chat[];
  chatListLoading: boolean;
  chatListError: string | null;
  // Removed activeStream - streams will be handled outside Redux
}

// Async thunks
export const sendMessage = createAsyncThunk(
  "chat/sendMessage",
  async (
    {
      chatId,
      content,
      selectedSources,
    }: {
      chatId: string;
      content: string;
      selectedSources: string[];
    },
    { getState }
  ) => {
    const state = getState() as any;
    const provider = state.chat.selectedProvider;

    const request: SendMessageRequest = {
      content,
      videoIds: selectedSources,
      provider,
    };

    const response = await chatApi.sendMessage(chatId, request);
    return response;
  }
);

export const loadChatMessages = createAsyncThunk(
  "chat/loadMessages",
  async (chatId: string) => {
    const response = await chatApi.getChatMessages(chatId);
    return response;
  }
);

const loadChatList = createAsyncThunk(
  "chat/loadChatList",
  async ({ page = 1, limit = 20 }: { page?: number; limit?: number } = {}) => {
    const response = await chatApi.getUserChats(page, limit);
    return response;
  }
);

const deleteChat = createAsyncThunk(
  "chat/deleteChat",
  async (chatId: string) => {
    const response = await chatApi.deleteChat(chatId);
    return { chatId, response };
  }
);

const renameChatTitle = createAsyncThunk(
  "chat/renameChatTitle",
  async ({ chatId, title }: { chatId: string; title: string }) => {
    const response = await chatApi.updateChatTitle(chatId, title);
    return { chatId, title, response };
  }
);

// Helper function to convert API message to our format
const convertApiMessage = (apiMessage: ApiMessage): Message => ({
  id: apiMessage._id,
  content: apiMessage.content,
  isUser: apiMessage.role === "user",
  timestamp: apiMessage.createdAt, // Keep as ISO string instead of converting to Date
  sources: [], // We'll populate this from video references if needed
  metadata: apiMessage.metadata,
});

// Helper function to convert API chat to our format
const convertApiChat = (apiChat: ApiChat): Chat => ({
  id: apiChat._id,
  title: apiChat.title,
  lastMessage: "", // Will be populated when we have message data
  timestamp: apiChat.lastActivity, // Keep as ISO string instead of converting to Date
  messageCount: 0, // Will be populated when we have message data
  isActive: apiChat.isActive,
  videoIds: apiChat.videoIds,
});

const initialState: ChatState = {
  messages: [],
  isLoading: false,
  error: null,
  currentInput: "",
  currentChatId: null,
  selectedProvider: "openai",
  streamingMessageId: null,
  // Chat list management
  chatList: [],
  chatListLoading: false,
  chatListError: null,
  // Removed activeStream - streams will be handled outside Redux
};

const chatSlice = createSlice({
  name: "chat",
  initialState,
  reducers: {
    addMessage: (state, action: PayloadAction<Message>) => {
      state.messages.push(action.payload);
    },
    clearMessages: (state) => {
      state.messages = [];
    },
    setLoading: (state, action: PayloadAction<boolean>) => {
      state.isLoading = action.payload;
    },
    setError: (state, action: PayloadAction<string | null>) => {
      state.error = action.payload;
    },
    setCurrentInput: (state, action: PayloadAction<string>) => {
      state.currentInput = action.payload;
    },
    setCurrentChatId: (state, action: PayloadAction<string | null>) => {
      state.currentChatId = action.payload;
    },
    setSelectedProvider: (
      state,
      action: PayloadAction<"openai" | "anthropic" | "google">
    ) => {
      state.selectedProvider = action.payload;
    },
    startStreaming: (
      state,
      action: PayloadAction<{
        messageId: string;
      }>
    ) => {
      state.streamingMessageId = action.payload.messageId;
      state.isLoading = true;
    },
    stopStreaming: (state) => {
      state.streamingMessageId = null;
      state.isLoading = false;
    },
    handleStreamEvent: (state, action: PayloadAction<StreamEvent>) => {
      const event = action.payload;
      console.log("Processing stream event in slice:", event); // Debug log

      switch (event.type) {
        case "user_message":
          if (event.message && typeof event.message === "object") {
            const userMessage = convertApiMessage(event.message as ApiMessage);
            state.messages.push(userMessage);
          }
          break;

        case "start":
          // Start the streaming state
          state.streamingMessageId = event.messageId || null;
          state.isLoading = true;

          if (event.message) {
            // Add user message first
            const userMessage = convertApiMessage(event.message as ApiMessage);
            state.messages.push(userMessage);
          }

          // Add empty AI message that will be filled with streaming content
          const aiMessage: Message = {
            id: event.messageId || `temp-${Date.now()}`,
            content: "",
            isUser: false,
            timestamp: new Date().toISOString(),
            isStreaming: true,
          };
          state.messages.push(aiMessage);
          break;

        case "delta":
          if (event.messageId && event.content) {
            const messageIndex = state.messages.findIndex(
              (msg) => msg.id === event.messageId
            );
            if (messageIndex !== -1) {
              state.messages[messageIndex].content += event.content;
            }
          }
          break;

        case "complete":
          if (event.messageId) {
            const messageIndex = state.messages.findIndex(
              (msg) => msg.id === event.messageId
            );
            if (messageIndex !== -1) {
              state.messages[messageIndex].isStreaming = false;
              if (event.videoReferences) {
                state.messages[messageIndex].metadata = {
                  videoReferences: event.videoReferences,
                  model: event.model,
                  tokenCount: event.tokenCount,
                };
              }
            }
          }
          state.streamingMessageId = null;
          state.isLoading = false;
          state.currentInput = "";
          break;

        case "error":
          state.error =
            typeof event.message === "string"
              ? event.message
              : "Stream error occurred";
          state.streamingMessageId = null;
          state.isLoading = false;
          break;
      }
    },
  },
  extraReducers: (builder) => {
    // Send message
    builder
      .addCase(sendMessage.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(sendMessage.fulfilled, (state, action) => {
        state.isLoading = false;
        // Add both user and AI messages
        const userMessage = convertApiMessage(action.payload.userMessage);
        const aiMessage = convertApiMessage(action.payload.aiMessage);
        state.messages.push(userMessage, aiMessage);
        state.currentInput = "";
        state.error = null;
      })
      .addCase(sendMessage.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.error.message || "Failed to send message";
      })
      // Load messages
      .addCase(loadChatMessages.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(loadChatMessages.fulfilled, (state, action) => {
        state.isLoading = false;
        state.messages = action.payload.messages.map(convertApiMessage);
        state.currentChatId = action.payload.chat._id;
        state.error = null;
      })
      .addCase(loadChatMessages.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.error.message || "Failed to load messages";
      })
      // Load chat list
      .addCase(loadChatList.pending, (state) => {
        state.chatListLoading = true;
        state.chatListError = null;
      })
      .addCase(loadChatList.fulfilled, (state, action) => {
        state.chatListLoading = false;
        state.chatList = action.payload.chats.map(convertApiChat);
        state.chatListError = null;
      })
      .addCase(loadChatList.rejected, (state, action) => {
        state.chatListLoading = false;
        state.chatListError =
          action.error.message || "Failed to load chat list";
      })
      // Delete chat
      .addCase(deleteChat.pending, (state) => {
        state.chatListLoading = true;
        state.chatListError = null;
      })
      .addCase(deleteChat.fulfilled, (state, action) => {
        state.chatListLoading = false;
        // Remove chat from list optimistically
        state.chatList = state.chatList.filter(
          (chat) => chat.id !== action.payload.chatId
        );
        state.chatListError = null;
        // Clear current chat if it was deleted
        if (state.currentChatId === action.payload.chatId) {
          state.currentChatId = null;
          state.messages = [];
        }
      })
      .addCase(deleteChat.rejected, (state, action) => {
        state.chatListLoading = false;
        state.chatListError = action.error.message || "Failed to delete chat";
      })
      // Rename chat
      .addCase(renameChatTitle.pending, (state) => {
        state.chatListLoading = true;
        state.chatListError = null;
      })
      .addCase(renameChatTitle.fulfilled, (state, action) => {
        state.chatListLoading = false;
        // Update chat title in list optimistically
        const chatIndex = state.chatList.findIndex(
          (chat) => chat.id === action.payload.chatId
        );
        if (chatIndex !== -1) {
          state.chatList[chatIndex].title = action.payload.title;
        }
        state.chatListError = null;
      })
      .addCase(renameChatTitle.rejected, (state, action) => {
        state.chatListLoading = false;
        state.chatListError = action.error.message || "Failed to rename chat";
      })
      // Handle global store reset
      .addCase(resetStore, () => {
        return initialState;
      });
  },
});

export const {
  addMessage,
  clearMessages,
  setLoading,
  setError,
  setCurrentInput,
  setCurrentChatId,
  setSelectedProvider,
  startStreaming,
  stopStreaming,
  handleStreamEvent,
} = chatSlice.actions;

// Export the async thunks
export { loadChatList, deleteChat, renameChatTitle };

export default chatSlice.reducer;
