import { createSlice, PayloadAction } from "@reduxjs/toolkit";

export interface Message {
  id: string;
  content: string;
  isUser: boolean;
  timestamp: Date;
  sources?: string[];
}

interface ChatState {
  messages: Message[];
  isLoading: boolean;
  error: string | null;
  currentInput: string;
}

const initialState: ChatState = {
  messages: [],
  isLoading: false,
  error: null,
  currentInput: "",
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
  },
});

export const {
  addMessage,
  clearMessages,
  setLoading,
  setError,
  setCurrentInput,
} = chatSlice.actions;

export default chatSlice.reducer;
