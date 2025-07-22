import { apiClient } from "../client";
import { FrontendSource } from "../types";

// Keep existing types for compatibility
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
  status: string;
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

export interface SearchSourceChunksRequest {
  query: string;
  sourceIds?: string[];
  limit?: number;
}

export interface SearchSourceChunksResponse {
  status: string;
  chunks: any[];
  message?: string;
}

// Helper function to convert backend source to frontend source
export const convertBackendSource = (
  backendSource: Source
): FrontendSource => ({
  id: backendSource._id,
  chatId: backendSource.chatId,
  kind: backendSource.kind,
  title: backendSource.title || `${backendSource.kind} source`,
  url: backendSource.url,
  thumbnail: backendSource.metadata.thumbnailUrl,
  description: backendSource.metadata.description,
  status: (backendSource.metadata.processingStatus as any) || "pending",
  lastUpdated: backendSource.updatedAt,
  metadata: backendSource.metadata,
});

// Pure API service functions
export const sourcesApi = {
  /**
   * Get sources for a specific chat
   */
  async getChatSources(chatId: string): Promise<SourcesResponse> {
    return apiClient.get<SourcesResponse>(`/chats/${chatId}/sources`);
  },

  /**
   * Add sources to a chat
   */
  async addSources(
    chatId: string,
    sources: SourceCreateRequest[]
  ): Promise<SourcesResponse> {
    return apiClient.post<SourcesResponse>(`/chats/${chatId}/sources`, {
      sources,
    });
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
    request: SearchSourceChunksRequest
  ): Promise<SearchSourceChunksResponse> {
    return apiClient.post<SearchSourceChunksResponse>(
      "/sources/search",
      request
    );
  },
};
