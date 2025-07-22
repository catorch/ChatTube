import { StreamEvent, SendMessageRequest } from "./chatSlice";

/**
 * Streaming service for chat functionality
 * This handles Server-Sent Events (SSE) for real-time chat streaming
 * Works with the modern RTK Query chat slice
 */

interface StreamingOptions {
  onEvent: (event: StreamEvent) => void;
  onError?: (error: Error) => void;
  signal?: AbortSignal;
}

class ChatStreamingService {
  private baseUrl: string;

  constructor() {
    this.baseUrl =
      process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000/api";
  }

  /**
   * Get auth token from Redux store
   */
  private getAuthToken(): string | null {
    if (typeof window === "undefined") return null;

    try {
      const { store } = require("../../store");
      const state = store.getState();
      return state.auth.token;
    } catch (error) {
      console.warn("Failed to get token from store:", error);
      return null;
    }
  }

  /**
   * Create headers with authentication
   */
  private getHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };

    const token = this.getAuthToken();
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }

    return headers;
  }

  /**
   * Stream a message to a chat
   */
  async streamMessage(
    chatId: string,
    request: SendMessageRequest,
    options: StreamingOptions
  ): Promise<{ close: () => void }> {
    const { onEvent, onError, signal } = options;

    try {
      // Send POST request to initiate streaming
      const response = await fetch(`${this.baseUrl}/chats/${chatId}/stream`, {
        method: "POST",
        headers: this.getHeaders(),
        body: JSON.stringify(request),
        signal,
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

          while (!isClosed && !signal?.aborted) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split("\n");
            buffer = lines.pop() || ""; // Keep incomplete line in buffer

            for (const line of lines) {
              if (line.startsWith("data: ")) {
                const dataStr = line.slice(6).trim();
                if (dataStr && dataStr !== "[DONE]") {
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
          if (!isClosed && !signal?.aborted) {
            console.error("Stream processing error:", error);
            onEvent({ type: "error", message: "Stream processing failed" });
            onError?.(error as Error);
          }
        }
      };

      // Start processing the stream
      processStream();

      // Return close function
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
      onError?.(error as Error);
      throw error;
    }
  }

  /**
   * Create an AbortController for canceling streams
   */
  createAbortController(): AbortController {
    return new AbortController();
  }
}

// Export singleton instance
export const chatStreamingService = new ChatStreamingService();

// Export class for testing
export { ChatStreamingService };
