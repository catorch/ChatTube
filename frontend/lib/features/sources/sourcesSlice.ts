import { createApi, fetchBaseQuery } from "@reduxjs/toolkit/query/react";
import {
  createEntityAdapter,
  createSlice,
  EntityState,
} from "@reduxjs/toolkit";
import { api } from "../../api/base";

// Source entity interface
export interface Source {
  id: string; // Using 'id' for entity adapter normalization
  _id: string; // Backend MongoDB ID
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

// Request/Response types
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
  processingStatus: {
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
  sourceId?: string;
  limit?: number;
}

export interface SearchSourceChunksResponse {
  status: "OK" | "ERROR";
  chunks: any[];
  query: string;
}

// Entity adapter for normalized state management
export const sourcesAdapter = createEntityAdapter<Source, string>({
  // Use 'id' field for normalization (we'll map _id to id)
  selectId: (source: Source) => source.id,
  // Sort by creation date, newest first
  sortComparer: (a, b) =>
    new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
});

// Helper function to transform backend source to normalized entity
const transformBackendSource = (backendSource: any): Source => ({
  ...backendSource,
  id: backendSource._id, // Map MongoDB _id to id for normalization
});

// Helper function to transform response sources
const transformSourcesResponse = (response: SourcesResponse): Source[] => {
  return response.sources.map(transformBackendSource);
};

// RTK Query API with entity normalization
export const sourcesApi = api.injectEndpoints({
  endpoints: (build) => ({
    // List sources for a specific chat
    getChatSources: build.query<EntityState<Source, string>, string>({
      query: (chatId) => `/chats/${chatId}/sources`,
      transformResponse: (response: SourcesResponse) => {
        const sources = transformSourcesResponse(response);
        return sourcesAdapter.setAll(sourcesAdapter.getInitialState(), sources);
      },
      providesTags: (result) => [
        { type: "Source", id: "LIST" },
        ...(result?.ids.map((id) => ({ type: "Source" as const, id })) || []),
      ],
    }),

    // Add sources to a specific chat
    addChatSources: build.mutation<
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

    // Remove source from a chat
    removeChatSource: build.mutation<
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

    // Get all sources (global/admin view)
    getAllSources: build.query<
      EntityState<Source, string>,
      { page?: number; limit?: number; kind?: string }
    >({
      query: ({ page = 1, limit = 10, kind }) => {
        const params = new URLSearchParams({
          page: page.toString(),
          limit: limit.toString(),
        });
        if (kind) params.append("kind", kind);
        return `/sources?${params}`;
      },
      transformResponse: (response: SourcesResponse) => {
        const sources = transformSourcesResponse(response);
        return sourcesAdapter.setAll(sourcesAdapter.getInitialState(), sources);
      },
      providesTags: (result) => [
        { type: "Source", id: "GLOBAL_LIST" },
        ...(result?.ids.map((id) => ({ type: "Source" as const, id })) || []),
      ],
    }),

    // Get specific source details
    getSource: build.query<Source, string>({
      query: (sourceId) => `/sources/${sourceId}`,
      transformResponse: (response: { status: string; source: any }) => {
        return transformBackendSource(response.source);
      },
      providesTags: (result, error, sourceId) => [
        { type: "Source", id: sourceId },
      ],
    }),

    // Get source processing status
    getSourceStatus: build.query<SourceStatusResponse, string>({
      query: (sourceId) => `/sources/${sourceId}/status`,
      providesTags: (result, error, sourceId) => [
        { type: "Source", id: `${sourceId}_STATUS` },
      ],
    }),

    // Search source chunks
    searchSourceChunks: build.mutation<
      SearchSourceChunksResponse,
      SearchSourceChunksRequest
    >({
      query: ({ query, sourceId, limit }) => ({
        url: "/sources/search",
        method: "POST",
        body: { query, sourceId, limit },
      }),
    }),
  }),
});

// Export RTK Query hooks
export const {
  useGetChatSourcesQuery,
  useAddChatSourcesMutation,
  useRemoveChatSourceMutation,
  useGetAllSourcesQuery,
  useGetSourceQuery,
  useGetSourceStatusQuery,
  useSearchSourceChunksMutation,
} = sourcesApi;

// Additional slice for client-side source state management
interface SourcesState {
  selectedSourceIds: string[];
  filter: {
    kind?: "youtube" | "pdf" | "web" | "file";
    status?: "pending" | "processing" | "completed" | "failed";
  };
  searchQuery: string;
}

const initialState: SourcesState = {
  selectedSourceIds: [],
  filter: {},
  searchQuery: "",
};

const sourcesSlice = createSlice({
  name: "sources",
  initialState,
  reducers: {
    // Source selection management
    setSelectedSourceIds: (state, action) => {
      state.selectedSourceIds = action.payload;
    },
    toggleSourceSelection: (state, action) => {
      const sourceId = action.payload;
      if (state.selectedSourceIds.includes(sourceId)) {
        state.selectedSourceIds = state.selectedSourceIds.filter(
          (id) => id !== sourceId
        );
      } else {
        state.selectedSourceIds.push(sourceId);
      }
    },
    selectAllSources: (state, action) => {
      state.selectedSourceIds = action.payload;
    },
    clearSourceSelection: (state) => {
      state.selectedSourceIds = [];
    },

    // Filter management
    setFilter: (state, action) => {
      state.filter = { ...state.filter, ...action.payload };
    },
    clearFilter: (state) => {
      state.filter = {};
    },

    // Search management
    setSearchQuery: (state, action) => {
      state.searchQuery = action.payload;
    },
    clearSearch: (state) => {
      state.searchQuery = "";
    },
  },
});

// Export slice actions
export const {
  setSelectedSourceIds,
  toggleSourceSelection,
  selectAllSources,
  clearSourceSelection,
  setFilter,
  clearFilter,
  setSearchQuery,
  clearSearch,
} = sourcesSlice.actions;

// Export entity adapter selectors
export const {
  selectAll: selectAllSourcesFromAdapter,
  selectById: selectSourceById,
  selectIds: selectSourceIds,
  selectEntities: selectSourceEntities,
  selectTotal: selectSourcesTotal,
} = sourcesAdapter.getSelectors();

// Custom selectors that work with the normalized state
export const createSourcesSelectors = (
  selectSourcesState: (state: any) => EntityState<Source, string>
) => ({
  selectAllSources: (state: any) =>
    selectAllSourcesFromAdapter(selectSourcesState(state)),
  selectSourceById: (state: any, id: string) =>
    selectSourceById(selectSourcesState(state), id),
  selectSourceIds: (state: any) => selectSourceIds(selectSourcesState(state)),
  selectSourceEntities: (state: any) =>
    selectSourceEntities(selectSourcesState(state)),
  selectSourcesTotal: (state: any) =>
    selectSourcesTotal(selectSourcesState(state)),
});

// Filtered selectors
export const selectFilteredSources = (
  sourcesState: EntityState<Source, string>,
  filter: SourcesState["filter"],
  searchQuery: string
) => {
  const allSources = selectAllSourcesFromAdapter(sourcesState);

  return allSources.filter((source) => {
    // Apply kind filter
    if (filter.kind && source.kind !== filter.kind) {
      return false;
    }

    // Apply status filter
    if (filter.status && source.metadata.processingStatus !== filter.status) {
      return false;
    }

    // Apply search query
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      return (
        source.title?.toLowerCase().includes(query) ||
        source.url?.toLowerCase().includes(query) ||
        source.metadata.channelName?.toLowerCase().includes(query)
      );
    }

    return true;
  });
};

// Export the reducer
export default sourcesSlice.reducer;
