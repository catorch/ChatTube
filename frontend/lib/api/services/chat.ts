const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export interface SendMessageRequest {
  content: string;
  videoIds?: string[];
  provider?: 'openai' | 'anthropic' | 'google';
}

export interface Message {
  _id: string;
  chatId: string;
  role: 'user' | 'assistant';
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
  videoIds: string[];
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
  async createChat(title?: string, videoId?: string): Promise<{ status: string; chat: Chat }> {
    const response = await fetch(`${API_BASE_URL}/api/chats`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ title, videoId }),
      credentials: 'include',
    });

    if (!response.ok) {
      throw new Error('Failed to create chat');
    }

    return response.json();
  },

  async getUserChats(page = 1, limit = 20): Promise<ChatsResponse> {
    const response = await fetch(
      `${API_BASE_URL}/api/chats?page=${page}&limit=${limit}`,
      {
        credentials: 'include',
      }
    );

    if (!response.ok) {
      throw new Error('Failed to fetch chats');
    }

    return response.json();
  },

  async getChatMessages(chatId: string, page = 1, limit = 50): Promise<MessagesResponse> {
    const response = await fetch(
      `${API_BASE_URL}/api/chats/${chatId}/messages?page=${page}&limit=${limit}`,
      {
        credentials: 'include',
      }
    );

    if (!response.ok) {
      throw new Error('Failed to fetch messages');
    }

    return response.json();
  },

  async sendMessage(chatId: string, request: SendMessageRequest): Promise<ChatResponse> {
    const response = await fetch(`${API_BASE_URL}/api/chats/${chatId}/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(request),
      credentials: 'include',
    });

    if (!response.ok) {
      throw new Error('Failed to send message');
    }

    return response.json();
  },

  async deleteChat(chatId: string): Promise<{ status: string; message: string }> {
    const response = await fetch(`${API_BASE_URL}/api/chats/${chatId}`, {
      method: 'DELETE',
      credentials: 'include',
    });

    if (!response.ok) {
      throw new Error('Failed to delete chat');
    }

    return response.json();
  },

  streamMessage(
    chatId: string, 
    request: SendMessageRequest,
    onEvent: (event: StreamEvent) => void
  ): EventSource {
    const eventSource = new EventSource(
      `${API_BASE_URL}/api/chats/${chatId}/stream`,
      {
        withCredentials: true,
      }
    );

    // Send the message data
    fetch(`${API_BASE_URL}/api/chats/${chatId}/stream`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(request),
      credentials: 'include',
    });

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        onEvent(data);
      } catch (error) {
        console.error('Failed to parse stream event:', error);
      }
    };

    eventSource.onerror = (error) => {
      console.error('Stream error:', error);
      onEvent({ type: 'error', message: 'Connection error' });
    };

    return eventSource;
  },
};

export interface StreamEvent {
  type: 'user_message' | 'context' | 'start' | 'delta' | 'complete' | 'error';
  message?: Message | string;
  messageId?: string;
  content?: string;
  chunks?: number;
  videoReferences?: any[];
  model?: string;
  tokenCount?: number;
}