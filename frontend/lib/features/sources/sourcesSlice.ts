import { api } from "../../api/base";
import {
  SourcesResponse,
  SourceCreateRequest,
  SourceStatusResponse,
  SearchSourceChunksRequest,
  SearchSourceChunksResponse,
  convertBackendSource,
} from "../../api/services/sources";
import { FrontendSource } from "../../api/types";

// RTK Query API endpoints for sources
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
      SearchSourceChunksResponse,
      SearchSourceChunksRequest
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
