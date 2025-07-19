import { api } from "../base";
import { FrontendSource } from "../../features/sources/sourcesSlice";

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

// Helper function to convert backend source to frontend source
const convertBackendSource = (backendSource: Source): FrontendSource => ({
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

// RTK Query API endpoints
export const sourcesApi = api.injectEndpoints({
  endpoints: (build) => ({
    // Main endpoint for listing sources with polling support
    listSources: build.query<FrontendSource[], string>({
      query: (chatId) => `/chats/${chatId}/sources`,
      transformResponse: (response: SourcesResponse) =>
        response.sources.map(convertBackendSource),
      providesTags: (result) =>
        result
          ? [
              // One tag per source so a single source can be invalidated
              ...result.map((s) => ({ type: "Source" as const, id: s.id })),
              { type: "Source", id: "LIST" },
            ]
          : [{ type: "Source", id: "LIST" }],
    }),

    // Add sources to chat
    addSources: build.mutation<
      SourcesResponse,
      { chatId: string; sources: SourceCreateRequest[] }
    >({
      query: ({ chatId, sources }) => ({
        url: `/chats/${chatId}/sources`,
        method: "POST",
        body: { sources },
      }),
      invalidatesTags: [{ type: "Source", id: "LIST" }],
    }),

    // Remove source from chat
    removeSource: build.mutation<
      { status: string; message: string },
      { chatId: string; sourceId: string }
    >({
      query: ({ chatId, sourceId }) => ({
        url: `/chats/${chatId}/sources/${sourceId}`,
        method: "DELETE",
      }),
      invalidatesTags: (result, error, { sourceId }) => [
        { type: "Source", id: sourceId },
        { type: "Source", id: "LIST" },
      ],
    }),

    // Get source status (less needed now due to polling)
    getSourceStatus: build.query<SourceStatusResponse, string>({
      query: (sourceId) => `/sources/${sourceId}/status`,
      providesTags: (result, error, sourceId) => [
        { type: "Source", id: sourceId },
      ],
    }),

    // Search source chunks
    searchSourceChunks: build.mutation<
      any,
      { query: string; sourceIds?: string[]; limit?: number }
    >({
      query: ({ query, sourceIds, limit }) => ({
        url: "/sources/search",
        method: "POST",
        body: { query, sourceIds, limit },
      }),
    }),
  }),
});

// Export hooks
export const {
  useListSourcesQuery,
  useAddSourcesMutation,
  useRemoveSourceMutation,
  useGetSourceStatusQuery,
  useSearchSourceChunksMutation,
} = sourcesApi;

// Legacy API object for backward compatibility (can be removed later)
export const sourcesApi_legacy = {
  async getChatSources(chatId: string): Promise<SourcesResponse> {
    // This is now handled by useListSourcesQuery
    throw new Error("Use useListSourcesQuery instead");
  },
  // ... other legacy methods can be removed gradually
};
