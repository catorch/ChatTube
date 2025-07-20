import { createSlice, PayloadAction, createAsyncThunk } from "@reduxjs/toolkit";
import {
  chatApi,
  SendMessageRequest,
  Message as ApiMessage,
  StreamEvent,
  Chat as ApiChat,
} from "../../api/services/chat";
import { resetStore } from "../../types";

export interface Message {
  id: string;
  content: string;
  isUser: boolean;
  timestamp: string;
  sources?: string[];
  metadata?: {
    sourceReferences?: any[];
    citationMap?: {
      [label: string]: {
        sourceId: string;
        chunkId: string;
        text: string;
        startTime?: number;
      };
    };
    model?: string;
    tokenCount?: number;
  };
  isStreaming?: boolean;
}

export interface Chat {
  id: string;
  title: string;
  emoji?: string;
  summary?: string;
  lastMessage: string;
  timestamp: string; // Changed from Date to string (ISO format)
  messageCount: number;
  isActive: boolean;
  sourceIds: string[]; // Changed from videoIds to sourceIds
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
  // Source selection for messaging
  selectedSourceIds: string[];
}

// Async thunks
export const sendMessage = createAsyncThunk(
  "chat/sendMessage",
  async (
    {
      chatId,
      content,
      selectedSourceIds,
    }: {
      chatId: string;
      content: string;
      selectedSourceIds: string[];
    },
    { getState }
  ) => {
    const state = getState() as any;
    const provider = state.chat.selectedProvider;

    const request: SendMessageRequest = {
      content,
      sourceIds: selectedSourceIds, // Changed from videoIds to sourceIds
      provider,
    };

    const response = await chatApi.sendMessage(chatId, request);
    return response;
  }
);

export const loadChatMessages = createAsyncThunk(
  "chat/loadChatMessages",
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
  sources: [], // We'll populate this from source references if needed
  metadata: {
    ...apiMessage.metadata,
    sourceReferences: apiMessage.metadata?.videoReferences, // Map videoReferences to sourceReferences for backward compatibility
  },
});

// Helper function to convert API chat to our format
const convertApiChat = (apiChat: ApiChat): Chat => ({
  id: apiChat._id,
  title: apiChat.title,
  emoji: apiChat.emoji,
  summary: apiChat.summary,
  lastMessage: "", // We'll calculate this from messages if needed
  timestamp: apiChat.lastActivity || apiChat.updatedAt,
  messageCount: 0, // We'll calculate this from messages if needed
  isActive: apiChat.isActive,
  sourceIds: apiChat.sourceIds || [], // Use sourceIds instead of videoIds
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
  // Source selection
  selectedSourceIds: [],
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
      const oldChatId = state.currentChatId;
      state.currentChatId = action.payload;
      // Clear selected sources when switching chats
      if (action.payload !== oldChatId) {
        state.selectedSourceIds = [];
      }
    },
    setSelectedProvider: (
      state,
      action: PayloadAction<"openai" | "anthropic" | "google">
    ) => {
      state.selectedProvider = action.payload;
    },

    // Source selection management
    setSelectedSourceIds: (state, action: PayloadAction<string[]>) => {
      state.selectedSourceIds = action.payload;
    },
    toggleSourceSelection: (state, action: PayloadAction<string>) => {
      const sourceId = action.payload;
      if (state.selectedSourceIds.includes(sourceId)) {
        state.selectedSourceIds = state.selectedSourceIds.filter(
          (id) => id !== sourceId
        );
      } else {
        state.selectedSourceIds.push(sourceId);
      }
    },
    selectAllSources: (state, action: PayloadAction<string[]>) => {
      state.selectedSourceIds = action.payload;
    },
    clearSourceSelection: (state) => {
      state.selectedSourceIds = [];
    },

    // Optimistic title update without API call
    updateChatTitleOptimistic: (
      state,
      action: PayloadAction<{ chatId: string; title: string }>
    ) => {
      const { chatId, title } = action.payload;

      // Update in chat list
      const chatIndex = state.chatList.findIndex((chat) => chat.id === chatId);
      if (chatIndex !== -1) {
        state.chatList[chatIndex].title = title;
      }
    },

    // Streaming management
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

      switch (event.type) {
        case "user_message":
          if (event.message) {
            // Handle both Message object and string types
            const userMessage =
              typeof event.message === "string"
                ? ({
                    id: `temp-${Date.now()}`,
                    content: event.message,
                    isUser: true,
                    timestamp: new Date().toISOString(),
                  } as Message)
                : convertApiMessage(event.message as ApiMessage);

            // Check if message already exists to avoid duplicates
            const existingMessage = state.messages.find(
              (m) => m.id === userMessage.id
            );
            if (!existingMessage) {
              state.messages.push(userMessage);
            }
          }
          break;

        case "start":
          if (event.messageId) {
            state.streamingMessageId = event.messageId;
            state.isLoading = true;

            // Add placeholder message for streaming
            const placeholderMessage: Message = {
              id: event.messageId,
              content: "",
              isUser: false,
              timestamp: new Date().toISOString(),
              isStreaming: true,
            };
            state.messages.push(placeholderMessage);
          }
          break;

        case "delta":
          if (state.streamingMessageId && event.content) {
            const messageIndex = state.messages.findIndex(
              (m) => m.id === state.streamingMessageId
            );
            if (messageIndex !== -1) {
              state.messages[messageIndex].content += event.content;
            }
          }
          break;

        case "complete":
          if (state.streamingMessageId && event.message) {
            // Handle both Message object and string types
            const finalMessage =
              typeof event.message === "string"
                ? ({
                    id: state.streamingMessageId,
                    content: event.message,
                    isUser: false,
                    timestamp: new Date().toISOString(),
                    metadata: {
                      sourceReferences: event.videoReferences,
                      citationMap: event.citationMap,
                      model: event.model,
                      tokenCount: event.tokenCount,
                    },
                  } as Message)
                : {
                    ...convertApiMessage(event.message as ApiMessage),
                    metadata: {
                      ...convertApiMessage(event.message as ApiMessage).metadata,
                      citationMap: event.citationMap,
                      model: event.model,
                      tokenCount: event.tokenCount,
                    },
                  };

            const messageIndex = state.messages.findIndex(
              (m) => m.id === state.streamingMessageId
            );
            if (messageIndex !== -1) {
              state.messages[messageIndex] = {
                ...finalMessage,
                isStreaming: false,
              };
            }
          }
          state.streamingMessageId = null;
          state.isLoading = false;
          state.error = null;
          break;

        case "error":
          state.streamingMessageId = null;
          state.isLoading = false;
          state.error =
            typeof event.message === "string"
              ? event.message
              : "An error occurred during streaming";
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
          state.selectedSourceIds = [];
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
  setSelectedSourceIds,
  toggleSourceSelection,
  selectAllSources,
  clearSourceSelection,
  updateChatTitleOptimistic,
  startStreaming,
  stopStreaming,
  handleStreamEvent,
} = chatSlice.actions;

// Selectors
export const selectCurrentChat = (state: { chat: ChatState }) => {
  if (!state.chat.currentChatId) return null;
  return (
    state.chat.chatList.find((chat) => chat.id === state.chat.currentChatId) ||
    null
  );
};

export { loadChatList, deleteChat, renameChatTitle };
export default chatSlice.reducer;
