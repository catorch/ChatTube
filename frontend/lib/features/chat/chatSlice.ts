import { createSlice, PayloadAction, createAsyncThunk } from "@reduxjs/toolkit";
import { chatApi, SendMessageRequest, Message as ApiMessage, StreamEvent } from "../../api/services/chat";

export interface Message {
  id: string;
  content: string;
  isUser: boolean;
  timestamp: Date;
  sources?: string[];
  metadata?: {
    videoReferences?: any[];
    model?: string;
    tokenCount?: number;
  };
  isStreaming?: boolean;
}

interface ChatState {
  messages: Message[];
  isLoading: boolean;
  error: string | null;
  currentInput: string;
  currentChatId: string | null;
  selectedProvider: 'openai' | 'anthropic' | 'google';
  streamingMessageId: string | null;
  activeStream: EventSource | null;
}

// Async thunks
export const sendMessage = createAsyncThunk(
  'chat/sendMessage',
  async (
    { 
      chatId, 
      content, 
      selectedSources 
    }: { 
      chatId: string; 
      content: string; 
      selectedSources: string[] 
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
  'chat/loadMessages',
  async (chatId: string) => {
    const response = await chatApi.getChatMessages(chatId);
    return response;
  }
);

// Helper function to convert API message to our format
const convertApiMessage = (apiMessage: ApiMessage): Message => ({
  id: apiMessage._id,
  content: apiMessage.content,
  isUser: apiMessage.role === 'user',
  timestamp: new Date(apiMessage.createdAt),
  sources: [], // We'll populate this from video references if needed
  metadata: apiMessage.metadata,
});

const initialState: ChatState = {
  messages: [],
  isLoading: false,
  error: null,
  currentInput: "",
  currentChatId: null,
  selectedProvider: 'openai',
  streamingMessageId: null,
  activeStream: null,
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
    setSelectedProvider: (state, action: PayloadAction<'openai' | 'anthropic' | 'google'>) => {
      state.selectedProvider = action.payload;
    },
    startStreaming: (state, action: PayloadAction<{ messageId: string; stream: EventSource }>) => {
      state.streamingMessageId = action.payload.messageId;
      state.activeStream = action.payload.stream;
      state.isLoading = true;
    },
    stopStreaming: (state) => {
      if (state.activeStream) {
        state.activeStream.close();
      }
      state.streamingMessageId = null;
      state.activeStream = null;
      state.isLoading = false;
    },
    handleStreamEvent: (state, action: PayloadAction<StreamEvent>) => {
      const event = action.payload;
      
      switch (event.type) {
        case 'user_message':
          if (event.message && typeof event.message === 'object') {
            const userMessage = convertApiMessage(event.message as ApiMessage);
            state.messages.push(userMessage);
          }
          break;
          
        case 'start':
          if (event.messageId) {
            const aiMessage: Message = {
              id: event.messageId,
              content: "",
              isUser: false,
              timestamp: new Date(),
              isStreaming: true,
            };
            state.messages.push(aiMessage);
          }
          break;
          
        case 'delta':
          if (event.messageId && event.content) {
            const messageIndex = state.messages.findIndex(msg => msg.id === event.messageId);
            if (messageIndex !== -1) {
              state.messages[messageIndex].content += event.content;
            }
          }
          break;
          
        case 'complete':
          if (event.messageId) {
            const messageIndex = state.messages.findIndex(msg => msg.id === event.messageId);
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
          
        case 'error':
          state.error = typeof event.message === 'string' ? event.message : 'Stream error occurred';
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

export default chatSlice.reducer;
