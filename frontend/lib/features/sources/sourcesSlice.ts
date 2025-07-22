import {
  createSlice,
  PayloadAction,
  createAsyncThunk,
  createEntityAdapter,
  EntityState,
  createSelector,
} from "@reduxjs/toolkit";
import {
  sourcesApi,
  SourceCreateRequest,
  SourcesResponse,
  SourceStatusResponse,
  SearchSourceChunksRequest,
  SearchSourceChunksResponse,
  convertBackendSource,
} from "../../api/services/sources";
import { FrontendSource } from "../../api/types";
import { resetStore } from "../../types";

// Create entity adapter for normalized state management
export const sourcesAdapter = createEntityAdapter<FrontendSource>({
  sortComparer: (a: FrontendSource, b: FrontendSource) =>
    new Date(b.lastUpdated).getTime() - new Date(a.lastUpdated).getTime(),
});

interface SourcesState {
  // Normalized entity state
  sources: EntityState<FrontendSource, string>;

  // UI state
  isLoading: boolean;
  error: string | null;

  // Source operations
  isAdding: boolean;
  addError: string | null;
  isRemoving: string | null; // sourceId being removed
  removeError: string | null;

  // Search state
  isSearching: boolean;
  searchResults: any[];
  searchError: string | null;

  // Status checking
  statusLoading: { [sourceId: string]: boolean };
  statusErrors: { [sourceId: string]: string | null };
}

// Async thunks
export const loadChatSources = createAsyncThunk(
  "sources/loadChatSources",
  async (chatId: string) => {
    const response = await sourcesApi.getChatSources(chatId);
    return response;
  }
);

export const addSources = createAsyncThunk(
  "sources/addSources",
  async ({
    chatId,
    sources,
  }: {
    chatId: string;
    sources: SourceCreateRequest[];
  }) => {
    const response = await sourcesApi.addSources(chatId, sources);
    return response;
  }
);

export const removeSource = createAsyncThunk(
  "sources/removeSource",
  async ({ chatId, sourceId }: { chatId: string; sourceId: string }) => {
    const response = await sourcesApi.removeSource(chatId, sourceId);
    return { sourceId, response };
  }
);

export const getSourceStatus = createAsyncThunk(
  "sources/getSourceStatus",
  async (sourceId: string) => {
    const response = await sourcesApi.getSourceStatus(sourceId);
    return { sourceId, status: response };
  }
);

export const searchSourceChunks = createAsyncThunk(
  "sources/searchSourceChunks",
  async (request: SearchSourceChunksRequest) => {
    const response = await sourcesApi.searchSourceChunks(request);
    return response;
  }
);

const initialState: SourcesState = {
  // Initialize normalized entity state
  sources: sourcesAdapter.getInitialState(),

  // UI state
  isLoading: false,
  error: null,

  // Source operations
  isAdding: false,
  addError: null,
  isRemoving: null,
  removeError: null,

  // Search state
  isSearching: false,
  searchResults: [],
  searchError: null,

  // Status checking
  statusLoading: {},
  statusErrors: {},
};

const sourcesSlice = createSlice({
  name: "sources",
  initialState,
  reducers: {
    // Direct source management
    addSource: (state, action: PayloadAction<FrontendSource>) => {
      sourcesAdapter.addOne(state.sources, action.payload);
    },
    updateSource: (
      state,
      action: PayloadAction<{ id: string; changes: Partial<FrontendSource> }>
    ) => {
      sourcesAdapter.updateOne(state.sources, action.payload);
    },
    removeSourceById: (state, action: PayloadAction<string>) => {
      sourcesAdapter.removeOne(state.sources, action.payload);
    },
    setSources: (state, action: PayloadAction<FrontendSource[]>) => {
      sourcesAdapter.setAll(state.sources, action.payload);
    },
    clearSources: (state) => {
      sourcesAdapter.removeAll(state.sources);
    },

    // UI state management
    setError: (state, action: PayloadAction<string | null>) => {
      state.error = action.payload;
    },
    clearError: (state) => {
      state.error = null;
    },

    // Search results
    setSearchResults: (state, action: PayloadAction<any[]>) => {
      state.searchResults = action.payload;
    },
    clearSearchResults: (state) => {
      state.searchResults = [];
      state.searchError = null;
    },
  },

  extraReducers: (builder) => {
    // Load chat sources
    builder
      .addCase(loadChatSources.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(loadChatSources.fulfilled, (state, action) => {
        state.isLoading = false;
        const frontendSources =
          action.payload.sources.map(convertBackendSource);
        sourcesAdapter.setAll(state.sources, frontendSources);
        state.error = null;
      })
      .addCase(loadChatSources.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.error.message || "Failed to load sources";
      });

    // Add sources
    builder
      .addCase(addSources.pending, (state) => {
        state.isAdding = true;
        state.addError = null;
      })
      .addCase(addSources.fulfilled, (state, action) => {
        state.isAdding = false;
        // Add new sources to the normalized state
        const frontendSources =
          action.payload.sources.map(convertBackendSource);
        sourcesAdapter.addMany(state.sources, frontendSources);
        state.addError = null;
      })
      .addCase(addSources.rejected, (state, action) => {
        state.isAdding = false;
        state.addError = action.error.message || "Failed to add sources";
      });

    // Remove source
    builder
      .addCase(removeSource.pending, (state, action) => {
        state.isRemoving = action.meta.arg.sourceId;
        state.removeError = null;
      })
      .addCase(removeSource.fulfilled, (state, action) => {
        state.isRemoving = null;
        // Remove source from normalized state
        sourcesAdapter.removeOne(state.sources, action.payload.sourceId);
        state.removeError = null;
      })
      .addCase(removeSource.rejected, (state, action) => {
        state.isRemoving = null;
        state.removeError = action.error.message || "Failed to remove source";
      });

    // Get source status
    builder
      .addCase(getSourceStatus.pending, (state, action) => {
        const sourceId = action.meta.arg;
        state.statusLoading[sourceId] = true;
        state.statusErrors[sourceId] = null;
      })
      .addCase(getSourceStatus.fulfilled, (state, action) => {
        const { sourceId, status } = action.payload;
        state.statusLoading[sourceId] = false;

        // Update source status in normalized state
        const existingSource = state.sources.entities[sourceId];
        if (existingSource) {
          sourcesAdapter.updateOne(state.sources, {
            id: sourceId,
            changes: {
              status: status.sourceStatus.status as any,
              metadata: {
                ...existingSource.metadata,
                lastError: status.sourceStatus.lastError,
                attempts: status.sourceStatus.attempts,
                nextRunAt: status.sourceStatus.nextRunAt,
              },
            },
          });
        }
        state.statusErrors[sourceId] = null;
      })
      .addCase(getSourceStatus.rejected, (state, action) => {
        const sourceId = action.meta.arg;
        state.statusLoading[sourceId] = false;
        state.statusErrors[sourceId] =
          action.error.message || "Failed to get source status";
      });

    // Search source chunks
    builder
      .addCase(searchSourceChunks.pending, (state) => {
        state.isSearching = true;
        state.searchError = null;
      })
      .addCase(searchSourceChunks.fulfilled, (state, action) => {
        state.isSearching = false;
        state.searchResults = action.payload.chunks || [];
        state.searchError = null;
      })
      .addCase(searchSourceChunks.rejected, (state, action) => {
        state.isSearching = false;
        state.searchError = action.error.message || "Failed to search sources";
      });

    // Handle global store reset
    builder.addCase(resetStore, () => {
      return initialState;
    });
  },
});

export const {
  addSource,
  updateSource,
  removeSourceById,
  setSources,
  clearSources,
  setError,
  clearError,
  setSearchResults,
  clearSearchResults,
} = sourcesSlice.actions;

// Export entity adapter selectors
export const {
  selectAll: selectAllSources,
  selectById: selectSourceById,
  selectIds: selectSourceIds,
  selectEntities: selectSourceEntities,
  selectTotal: selectTotalSources,
} = sourcesAdapter.getSelectors(
  (state: { sources: SourcesState }) => state.sources.sources
);

// Enhanced memoized selectors
export const selectSourcesForChat = createSelector(
  [
    (state: { sources: SourcesState }) => selectAllSources(state),
    (state: { sources: SourcesState }, chatId: string) => chatId,
  ],
  (allSources, chatId) =>
    allSources.filter((source) => source.chatId === chatId)
);

export const selectSourcesByStatus = createSelector(
  [
    (state: { sources: SourcesState }) => selectAllSources(state),
    (state: { sources: SourcesState }, status: string) => status,
  ],
  (allSources, status) =>
    allSources.filter((source) => source.status === status)
);

export const selectIsSourceLoading = (
  state: { sources: SourcesState },
  sourceId: string
) => {
  return state.sources.statusLoading[sourceId] || false;
};

export const selectSourceError = (
  state: { sources: SourcesState },
  sourceId: string
) => {
  return state.sources.statusErrors[sourceId] || null;
};

// Selector factory for creating memoized chat-specific selectors
export const makeSelectSourcesForChat = () =>
  createSelector(
    [
      (state: { sources: SourcesState }) => selectAllSources(state),
      (state: { sources: SourcesState }, chatId: string) => chatId,
    ],
    (allSources, chatId) =>
      allSources.filter((source) => source.chatId === chatId)
  );

export default sourcesSlice.reducer;
