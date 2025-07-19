const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000/api";

// Helper function to get auth token from Redux store
const getAuthToken = (): string | null => {
  if (typeof window === "undefined") return null;

  try {
    const { store } = require("../../store");
    const state = store.getState();
    return state.auth.token;
  } catch (error) {
    console.warn("Failed to get token from store:", error);
    return null;
  }
};

// Helper function to get headers with JWT token
const getAuthHeaders = (
  additionalHeaders: Record<string, string> = {}
): Record<string, string> => {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...additionalHeaders,
  };

  const token = getAuthToken();
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  return headers;
};

export interface SendMessageRequest {
  content: string;
  sourceIds?: string[]; // Changed from videoIds to sourceIds
  provider?: "openai" | "anthropic" | "google";
}

export interface Message {
  _id: string;
  chatId: string;
  role: "user" | "assistant";
  content: string;
  metadata?: {
    videoReferences?: any[];
    model?: string;
    tokenCount?: number;
  };
  isVisible: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Chat {
  _id: string;
  userId: string;
  title: string;
  sourceIds: string[]; // Changed from videoIds to sourceIds
  lastActivity: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
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

export const chatApi = {
  async createChat(
    title?: string
  ): Promise<{ status: string; chat: Chat; message?: string }> {
    const response = await fetch(`${API_BASE_URL}/chats`, {
      method: "POST",
      headers: getAuthHeaders(),
      body: JSON.stringify({ title }),
    });

    if (!response.ok) {
      throw new Error("Failed to create chat");
    }

    return response.json();
  },

  async getUserChats(page = 1, limit = 20): Promise<ChatsResponse> {
    const response = await fetch(
      `${API_BASE_URL}/chats?page=${page}&limit=${limit}`,
      {
        headers: getAuthHeaders(),
      }
    );

    if (!response.ok) {
      throw new Error("Failed to fetch chats");
    }

    return response.json();
  },

  async getChatMessages(
    chatId: string,
    page = 1,
    limit = 50
  ): Promise<MessagesResponse> {
    const response = await fetch(
      `${API_BASE_URL}/chats/${chatId}/messages?page=${page}&limit=${limit}`,
      {
        headers: getAuthHeaders(),
      }
    );

    if (!response.ok) {
      throw new Error("Failed to fetch messages");
    }

    return response.json();
  },

  async sendMessage(
    chatId: string,
    request: SendMessageRequest
  ): Promise<ChatResponse> {
    const response = await fetch(`${API_BASE_URL}/chats/${chatId}/messages`, {
      method: "POST",
      headers: getAuthHeaders(),
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      throw new Error("Failed to send message");
    }

    return response.json();
  },

  async deleteChat(
    chatId: string
  ): Promise<{ status: string; message: string }> {
    const response = await fetch(`${API_BASE_URL}/chats/${chatId}`, {
      method: "DELETE",
      headers: getAuthHeaders(),
    });

    if (!response.ok) {
      throw new Error("Failed to delete chat");
    }

    return response.json();
  },

  async updateChatTitle(
    chatId: string,
    title: string
  ): Promise<{ status: string; chat: Chat }> {
    const response = await fetch(`${API_BASE_URL}/chats/${chatId}`, {
      method: "PUT",
      headers: getAuthHeaders(),
      body: JSON.stringify({ title }),
    });

    if (!response.ok) {
      throw new Error("Failed to update chat title");
    }

    return response.json();
  },

  async streamMessage(
    chatId: string,
    request: SendMessageRequest,
    onEvent: (event: StreamEvent) => void
  ): Promise<{ close: () => void }> {
    try {
      // Get auth token from Redux store
      const token = getAuthToken();
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };

      if (token) {
        headers.Authorization = `Bearer ${token}`;
      }

      // Send POST request to initiate streaming
      const response = await fetch(`${API_BASE_URL}/chats/${chatId}/stream`, {
        method: "POST",
        headers,
        body: JSON.stringify(request),
        // Removed credentials: "include" - no longer needed
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      if (!response.body) {
        throw new Error("No response body received");
      }

      // Process the streaming response
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let isClosed = false;

      const processStream = async () => {
        try {
          let buffer = "";

          while (!isClosed) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split("\n");
            buffer = lines.pop() || ""; // Keep incomplete line in buffer

            for (const line of lines) {
              if (line.startsWith("data: ")) {
                const dataStr = line.slice(6).trim();
                if (dataStr) {
                  try {
                    const data = JSON.parse(dataStr);
                    onEvent(data);
                  } catch (error) {
                    console.error(
                      "Failed to parse stream data:",
                      dataStr,
                      error
                    );
                  }
                }
              }
            }
          }
        } catch (error) {
          if (!isClosed) {
            console.error("Stream processing error:", error);
            onEvent({ type: "error", message: "Stream processing failed" });
          }
        }
      };

      // Start processing the stream
      processStream();

      // Return an object with a close method for compatibility
      return {
        close: () => {
          isClosed = true;
          try {
            reader.cancel();
          } catch (error) {
            console.error("Error closing stream:", error);
          }
        },
      };
    } catch (error) {
      console.error("Failed to initiate stream:", error);
      onEvent({ type: "error", message: "Failed to connect to stream" });
      throw error;
    }
  },
};

export interface StreamEvent {
  type: "user_message" | "context" | "start" | "delta" | "complete" | "error";
  message?: Message | string;
  messageId?: string;
  content?: string;
  chunks?: number;
  videoReferences?: any[];
  model?: string;
  tokenCount?: number;
}
