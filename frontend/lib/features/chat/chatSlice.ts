import {
  createSlice,
  PayloadAction,
  createEntityAdapter,
  EntityState,
} from "@reduxjs/toolkit";
import { api } from "../../api/base";
import { resetStore } from "../../types";

// ============================================================================
// ENTITY INTERFACES
// ============================================================================

// Message entity for normalization
export interface Message {
  id: string; // Normalized ID (maps from _id)
  _id: string; // Backend MongoDB ID
  chatId: string;
  role: "user" | "assistant";
  content: string;
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
  isVisible: boolean;
  createdAt: string;
  updatedAt: string;
  isStreaming?: boolean; // Client-side flag for UI
}

// Chat entity for normalization
export interface Chat {
  id: string; // Normalized ID (maps from _id)
  _id: string; // Backend MongoDB ID
  userId: string;
  title: string;
  emoji?: string;
  summary?: string;
  sourceIds: string[];
  lastActivity: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  // Computed fields for UI
  lastMessage?: string;
  messageCount?: number;
}

// ============================================================================
// REQUEST/RESPONSE TYPES
// ============================================================================

export interface SendMessageRequest {
  content: string;
  sourceIds?: string[];
  provider?: "openai" | "anthropic" | "google";
}

export interface ChatResponse {
  status: string;
  userMessage: Message;
  aiMessage: Message;
}

export interface ChatsResponse {
  status: string;
  chats: Chat[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
}

export interface MessagesResponse {
  status: string;
  messages: Message[];
  chat: Chat;
}

export interface CreateChatRequest {
  title?: string;
}

export interface CreateChatResponse {
  status: string;
  chat: Chat;
  message?: string;
}

export interface UpdateChatRequest {
  title?: string;
  emoji?: string;
  summary?: string;
}

export interface StreamEvent {
  type: "user_message" | "context" | "start" | "delta" | "complete" | "error";
  message?: Message | string;
  messageId?: string;
  content?: string;
  chunks?: number;
  videoReferences?: any[];
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
}

// ============================================================================
// ENTITY ADAPTERS
// ============================================================================

// Message entity adapter
export const messagesAdapter = createEntityAdapter<Message, string>({
  selectId: (message: Message) => message.id,
  sortComparer: (a, b) =>
    new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
});

// Chat entity adapter
export const chatsAdapter = createEntityAdapter<Chat, string>({
  selectId: (chat: Chat) => chat.id,
  sortComparer: (a, b) =>
    new Date(b.lastActivity).getTime() - new Date(a.lastActivity).getTime(),
});

// ============================================================================
// TRANSFORMATION HELPERS
// ============================================================================

const transformBackendMessage = (backendMessage: any): Message => ({
  ...backendMessage,
  id: backendMessage._id, // Map MongoDB _id to id for normalization
});

const transformBackendChat = (backendChat: any): Chat => ({
  ...backendChat,
  id: backendChat._id, // Map MongoDB _id to id for normalization
});

const transformMessagesResponse = (response: MessagesResponse) => {
  const messages = response.messages.map(transformBackendMessage);
  const chat = transformBackendChat(response.chat);
  return { messages, chat };
};

const transformChatsResponse = (response: ChatsResponse) => {
  return response.chats.map(transformBackendChat);
};

// ============================================================================
// RTK QUERY API
// ============================================================================

export const chatApi = api.injectEndpoints({
  endpoints: (build) => ({
    // Create new chat
    createChat: build.mutation<CreateChatResponse, CreateChatRequest>({
      query: (request) => ({
        url: "/chats",
        method: "POST",
        body: request,
      }),
      transformResponse: (response: CreateChatResponse) => ({
        ...response,
        chat: transformBackendChat(response.chat),
      }),
      invalidatesTags: [{ type: "Chat", id: "LIST" }],
    }),

    // Get user's chats with pagination
    getUserChats: build.query<
      EntityState<Chat, string>,
      { page?: number; limit?: number }
    >({
      query: ({ page = 1, limit = 20 }) => `/chats?page=${page}&limit=${limit}`,
      transformResponse: (response: ChatsResponse) => {
        const chats = transformChatsResponse(response);
        return chatsAdapter.setAll(chatsAdapter.getInitialState(), chats);
      },
      providesTags: (result) => [
        { type: "Chat", id: "LIST" },
        ...(result?.ids.map((id) => ({ type: "Chat" as const, id })) || []),
      ],
    }),

    // Get chat messages
    getChatMessages: build.query<
      {
        messages: EntityState<Message, string>;
        chat: Chat;
      },
      { chatId: string; page?: number; limit?: number }
    >({
      query: ({ chatId, page = 1, limit = 50 }) =>
        `/chats/${chatId}/messages?page=${page}&limit=${limit}`,
      transformResponse: (response: MessagesResponse) => {
        const { messages, chat } = transformMessagesResponse(response);
        return {
          messages: messagesAdapter.setAll(
            messagesAdapter.getInitialState(),
            messages
          ),
          chat,
        };
      },
      providesTags: (result, error, { chatId }) => [
        { type: "Chat", id: chatId },
        { type: "Message", id: "LIST" },
        ...(result?.messages.ids.map((id) => ({
          type: "Message" as const,
          id,
        })) || []),
      ],
    }),

    // Send message (non-streaming)
    sendMessage: build.mutation<
      ChatResponse,
      { chatId: string; request: SendMessageRequest }
    >({
      query: ({ chatId, request }) => ({
        url: `/chats/${chatId}/messages`,
        method: "POST",
        body: request,
      }),
      transformResponse: (response: ChatResponse) => ({
        ...response,
        userMessage: transformBackendMessage(response.userMessage),
        aiMessage: transformBackendMessage(response.aiMessage),
      }),
      invalidatesTags: (result, error, { chatId }) => [
        { type: "Chat", id: chatId },
        { type: "Message", id: "LIST" },
      ],
    }),

    // Update chat details
    updateChat: build.mutation<
      { status: string; chat: Chat },
      { chatId: string; updates: UpdateChatRequest }
    >({
      query: ({ chatId, updates }) => ({
        url: `/chats/${chatId}`,
        method: "PUT",
        body: updates,
      }),
      transformResponse: (response: { status: string; chat: Chat }) => ({
        ...response,
        chat: transformBackendChat(response.chat),
      }),
      invalidatesTags: (result, error, { chatId }) => [
        { type: "Chat", id: chatId },
        { type: "Chat", id: "LIST" },
      ],
    }),

    // Delete chat
    deleteChat: build.mutation<{ status: string; message: string }, string>({
      query: (chatId) => ({
        url: `/chats/${chatId}`,
        method: "DELETE",
      }),
      invalidatesTags: (result, error, chatId) => [
        { type: "Chat", id: chatId },
        { type: "Chat", id: "LIST" },
      ],
    }),
  }),
});

// Export RTK Query hooks
export const {
  useCreateChatMutation,
  useGetUserChatsQuery,
  useGetChatMessagesQuery,
  useSendMessageMutation,
  useUpdateChatMutation,
  useDeleteChatMutation,
} = chatApi;

// ============================================================================
// CLIENT-SIDE STATE SLICE
// ============================================================================

interface ChatClientState {
  // Current context
  currentChatId: string | null;
  currentInput: string;

  // LLM provider selection
  selectedProvider: "openai" | "anthropic" | "google";

  // Source selection for messaging
  selectedSourceIds: string[];

  // Streaming state
  streamingMessageId: string | null;
  streamingContent: string;
  isStreaming: boolean;
  streamError: string | null;

  // UI state
  error: string | null;
}

const initialState: ChatClientState = {
  currentChatId: null,
  currentInput: "",
  selectedProvider: "openai",
  selectedSourceIds: [],
  streamingMessageId: null,
  streamingContent: "",
  isStreaming: false,
  streamError: null,
  error: null,
};

const chatSlice = createSlice({
  name: "chat",
  initialState,
  reducers: {
    // Chat context management
    setCurrentChatId: (state, action: PayloadAction<string | null>) => {
      const oldChatId = state.currentChatId;
      state.currentChatId = action.payload;
      // Clear selected sources when switching chats
      if (action.payload !== oldChatId) {
        state.selectedSourceIds = [];
        state.currentInput = "";
        state.error = null;
      }
    },

    // Input management
    setCurrentInput: (state, action: PayloadAction<string>) => {
      state.currentInput = action.payload;
    },
    clearCurrentInput: (state) => {
      state.currentInput = "";
    },

    // Provider selection
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

    // Streaming management
    startStreaming: (state, action: PayloadAction<{ messageId: string }>) => {
      state.streamingMessageId = action.payload.messageId;
      state.streamingContent = "";
      state.isStreaming = true;
      state.streamError = null;
    },
    appendStreamingContent: (state, action: PayloadAction<string>) => {
      state.streamingContent += action.payload;
    },
    stopStreaming: (state) => {
      state.streamingMessageId = null;
      state.streamingContent = "";
      state.isStreaming = false;
      state.streamError = null;
    },
    setStreamError: (state, action: PayloadAction<string>) => {
      state.streamError = action.payload;
      state.isStreaming = false;
    },

    // Error management
    setError: (state, action: PayloadAction<string | null>) => {
      state.error = action.payload;
    },
    clearError: (state) => {
      state.error = null;
    },

    // Handle stream events (for compatibility)
    handleStreamEvent: (state, action: PayloadAction<StreamEvent>) => {
      const event = action.payload;

      switch (event.type) {
        case "start":
          if (event.messageId) {
            state.streamingMessageId = event.messageId;
            state.streamingContent = "";
            state.isStreaming = true;
            state.streamError = null;
          }
          break;

        case "delta":
          if (event.content) {
            state.streamingContent += event.content;
          }
          break;

        case "complete":
          state.streamingMessageId = null;
          state.streamingContent = "";
          state.isStreaming = false;
          state.streamError = null;
          state.currentInput = "";
          break;

        case "error":
          state.streamError =
            typeof event.message === "string"
              ? event.message
              : "An error occurred during streaming";
          state.isStreaming = false;
          break;
      }
    },
  },

  extraReducers: (builder) => {
    // Handle global store reset
    builder.addCase(resetStore, () => {
      return initialState;
    });
  },
});

// ============================================================================
// ACTIONS & SELECTORS
// ============================================================================

// Export actions
export const {
  setCurrentChatId,
  setCurrentInput,
  clearCurrentInput,
  setSelectedProvider,
  setSelectedSourceIds,
  toggleSourceSelection,
  selectAllSources,
  clearSourceSelection,
  startStreaming,
  appendStreamingContent,
  stopStreaming,
  setStreamError,
  setError,
  clearError,
  handleStreamEvent,
} = chatSlice.actions;

// Entity adapter selectors
export const {
  selectAll: selectAllMessages,
  selectById: selectMessageById,
  selectIds: selectMessageIds,
  selectEntities: selectMessageEntities,
  selectTotal: selectMessagesTotal,
} = messagesAdapter.getSelectors();

export const {
  selectAll: selectAllChats,
  selectById: selectChatById,
  selectIds: selectChatIds,
  selectEntities: selectChatEntities,
  selectTotal: selectChatsTotal,
} = chatsAdapter.getSelectors();

// Custom selectors
export const selectCurrentChat = (state: { chat: ChatClientState }) => {
  return state.chat.currentChatId;
};

export const selectCurrentInput = (state: { chat: ChatClientState }) => {
  return state.chat.currentInput;
};

export const selectSelectedProvider = (state: { chat: ChatClientState }) => {
  return state.chat.selectedProvider;
};

export const selectSelectedSourceIds = (state: { chat: ChatClientState }) => {
  return state.chat.selectedSourceIds;
};

export const selectStreamingState = (state: { chat: ChatClientState }) => ({
  messageId: state.chat.streamingMessageId,
  content: state.chat.streamingContent,
  isStreaming: state.chat.isStreaming,
  error: state.chat.streamError,
});

// Selectors for normalized chat/message data
export const createChatSelectors = (
  selectChatsState: (state: any) => EntityState<Chat, string>
) => ({
  selectAllChats: (state: any) => selectAllChats(selectChatsState(state)),
  selectChatById: (state: any, id: string) =>
    selectChatById(selectChatsState(state), id),
  selectChatIds: (state: any) => selectChatIds(selectChatsState(state)),
  selectChatEntities: (state: any) =>
    selectChatEntities(selectChatsState(state)),
  selectChatsTotal: (state: any) => selectChatsTotal(selectChatsState(state)),
});

export const createMessageSelectors = (
  selectMessagesState: (state: any) => EntityState<Message, string>
) => ({
  selectAllMessages: (state: any) =>
    selectAllMessages(selectMessagesState(state)),
  selectMessageById: (state: any, id: string) =>
    selectMessageById(selectMessagesState(state), id),
  selectMessageIds: (state: any) =>
    selectMessageIds(selectMessagesState(state)),
  selectMessageEntities: (state: any) =>
    selectMessageEntities(selectMessagesState(state)),
  selectMessagesTotal: (state: any) =>
    selectMessagesTotal(selectMessagesState(state)),
});

// Export the reducer
export default chatSlice.reducer;
