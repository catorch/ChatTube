import { apiClient } from "../client";

// API Types for Sources
export interface Source {
  _id: string;
  userId: string;
  chatId: string;
  kind: "youtube" | "pdf" | "web" | "file";
  title?: string;
  url?: string;
  fileId?: string;
  metadata: {
    processingStatus?: "pending" | "processing" | "completed" | "failed";
    isProcessed?: boolean;
    errorMessage?: string;
    videoId?: string;
    channelName?: string;
    duration?: number;
    uploadDate?: string;
    thumbnailUrl?: string;
    viewCount?: number;
    chunksCount?: number;
    createdAt?: string;
    startedAt?: string;
    completedAt?: string;
    failedAt?: string;
    [key: string]: any;
  };
  createdAt: string;
  updatedAt: string;
}

export interface SourceCreateRequest {
  kind: "youtube" | "pdf" | "web" | "file";
  url?: string;
  title?: string;
  fileId?: string;
  metadata?: Record<string, any>;
}

export interface SourcesResponse {
  status: "OK" | "ERROR";
  sources: Source[];
  message?: string;
  added?: number;
  existing?: number;
  processingNote?: string;
}

export interface SourceStatusResponse {
  status: "OK" | "ERROR";
  sourceStatus: {
    status: string;
    attempts: number;
    nextRunAt?: string;
    lastError?: string;
  };
}

export interface AddSourcesRequest {
  sources: SourceCreateRequest[];
}

export const sourcesApi = {
  /**
   * Get all sources for a specific chat
   */
  async getChatSources(chatId: string): Promise<SourcesResponse> {
    return apiClient.get<SourcesResponse>(`/chats/${chatId}/sources`);
  },

  /**
   * Add sources to a specific chat
   */
  async addSourcesToChat(
    chatId: string,
    sources: SourceCreateRequest[]
  ): Promise<SourcesResponse> {
    const request: AddSourcesRequest = { sources };
    return apiClient.post<SourcesResponse>(`/chats/${chatId}/sources`, request);
  },

  /**
   * Add a single source to a chat (convenience method)
   */
  async addSourceToChat(
    chatId: string,
    source: SourceCreateRequest
  ): Promise<SourcesResponse> {
    return this.addSourcesToChat(chatId, [source]);
  },

  /**
   * Remove a source from a chat
   */
  async removeSource(
    chatId: string,
    sourceId: string
  ): Promise<{ status: string; message: string }> {
    return apiClient.delete(`/chats/${chatId}/sources/${sourceId}`);
  },

  /**
   * Get source processing status
   */
  async getSourceStatus(sourceId: string): Promise<SourceStatusResponse> {
    return apiClient.get<SourceStatusResponse>(`/sources/${sourceId}/status`);
  },

  /**
   * Search source chunks for RAG
   */
  async searchSourceChunks(
    query: string,
    sourceIds?: string[],
    limit?: number
  ) {
    return apiClient.post("/sources/search", {
      query,
      sourceIds,
      limit,
    });
  },

  /**
   * Get global sources list (admin/global view)
   */
  async getGlobalSources(page = 1, limit = 10, kind?: string) {
    const params = new URLSearchParams();
    params.append("page", page.toString());
    params.append("limit", limit.toString());
    if (kind) params.append("kind", kind);

    const queryString = params.toString();
    const endpoint = `/sources${queryString ? `?${queryString}` : ""}`;

    return apiClient.get(endpoint);
  },
};
