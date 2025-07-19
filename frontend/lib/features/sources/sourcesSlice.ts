import { createSlice, PayloadAction, createAsyncThunk } from "@reduxjs/toolkit";
import {
  sourcesApi,
  Source,
  SourceCreateRequest,
  SourcesResponse,
} from "../../api/services/sources";
import { resetStore } from "../../store";

// Updated Source interface for frontend
export interface FrontendSource {
  id: string;
  chatId: string;
  kind: "youtube" | "pdf" | "web" | "file";
  title: string;
  url?: string;
  thumbnail?: string;
  description?: string;
  status: "pending" | "processing" | "completed" | "failed";
  lastUpdated: string;
  metadata: {
    processingStatus?: string;
    errorMessage?: string;
    videoId?: string;
    channelName?: string;
    duration?: number;
    chunksCount?: number;
    [key: string]: any;
  };
}

interface SourcesState {
  // Chat-specific sources - keyed by chatId
  sourcesByChat: Record<string, FrontendSource[]>;
  // Loading states - keyed by chatId
  loadingByChat: Record<string, boolean>;
  // Error states - keyed by chatId
  errorsByChat: Record<string, string | null>;
  // Adding source states
  isAddingSource: boolean;
  addSourceError: string | null;
  // Source status polling
  pollingSourceIds: string[];
}

const initialState: SourcesState = {
  sourcesByChat: {},
  loadingByChat: {},
  errorsByChat: {},
  isAddingSource: false,
  addSourceError: null,
  pollingSourceIds: [],
};

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

// Async thunks
export const fetchChatSources = createAsyncThunk(
  "sources/fetchChatSources",
  async (chatId: string) => {
    const response = await sourcesApi.getChatSources(chatId);
    return {
      chatId,
      sources: response.sources.map(convertBackendSource),
    };
  }
);

export const addSourceToChat = createAsyncThunk(
  "sources/addSourceToChat",
  async ({
    chatId,
    source,
  }: {
    chatId: string;
    source: SourceCreateRequest;
  }) => {
    const response = await sourcesApi.addSourceToChat(chatId, source);
    return {
      chatId,
      sources: response.sources.map(convertBackendSource),
      message: response.message,
      added: response.added,
      existing: response.existing,
    };
  }
);

export const addMultipleSourcesToChat = createAsyncThunk(
  "sources/addMultipleSourcesToChat",
  async ({
    chatId,
    sources,
  }: {
    chatId: string;
    sources: SourceCreateRequest[];
  }) => {
    const response = await sourcesApi.addSourcesToChat(chatId, sources);
    return {
      chatId,
      sources: response.sources.map(convertBackendSource),
      message: response.message,
      added: response.added,
      existing: response.existing,
    };
  }
);

export const removeSourceFromChat = createAsyncThunk(
  "sources/removeSourceFromChat",
  async ({ chatId, sourceId }: { chatId: string; sourceId: string }) => {
    await sourcesApi.removeSource(chatId, sourceId);
    return { chatId, sourceId };
  }
);

export const pollSourceStatus = createAsyncThunk(
  "sources/pollSourceStatus",
  async (sourceId: string) => {
    const response = await sourcesApi.getSourceStatus(sourceId);
    return {
      sourceId,
      status: response.sourceStatus,
    };
  }
);

const sourcesSlice = createSlice({
  name: "sources",
  initialState,
  reducers: {
    clearChatSources: (state, action: PayloadAction<string>) => {
      const chatId = action.payload;
      delete state.sourcesByChat[chatId];
      delete state.loadingByChat[chatId];
      delete state.errorsByChat[chatId];
    },

    clearAllSources: (state) => {
      state.sourcesByChat = {};
      state.loadingByChat = {};
      state.errorsByChat = {};
    },

    startPollingSource: (state, action: PayloadAction<string>) => {
      const sourceId = action.payload;
      if (!state.pollingSourceIds.includes(sourceId)) {
        state.pollingSourceIds.push(sourceId);
      }
    },

    stopPollingSource: (state, action: PayloadAction<string>) => {
      const sourceId = action.payload;
      state.pollingSourceIds = state.pollingSourceIds.filter(
        (id) => id !== sourceId
      );
    },

    updateSourceStatus: (
      state,
      action: PayloadAction<{
        sourceId: string;
        status: string;
        metadata?: any;
      }>
    ) => {
      const { sourceId, status, metadata } = action.payload;

      // Find and update the source across all chats
      Object.values(state.sourcesByChat).forEach((sources) => {
        const source = sources.find((s) => s.id === sourceId);
        if (source) {
          source.status = status as any;
          if (metadata) {
            source.metadata = { ...source.metadata, ...metadata };
          }
          source.lastUpdated = new Date().toISOString();
        }
      });
    },
  },

  extraReducers: (builder) => {
    // Fetch chat sources
    builder
      .addCase(fetchChatSources.pending, (state, action) => {
        const chatId = action.meta.arg;
        state.loadingByChat[chatId] = true;
        state.errorsByChat[chatId] = null;
      })
      .addCase(fetchChatSources.fulfilled, (state, action) => {
        const { chatId, sources } = action.payload;
        state.loadingByChat[chatId] = false;
        state.sourcesByChat[chatId] = sources;
        state.errorsByChat[chatId] = null;
      })
      .addCase(fetchChatSources.rejected, (state, action) => {
        const chatId = action.meta.arg;
        state.loadingByChat[chatId] = false;
        state.errorsByChat[chatId] =
          action.error.message || "Failed to fetch sources";
      });

    // Add single source to chat
    builder
      .addCase(addSourceToChat.pending, (state) => {
        state.isAddingSource = true;
        state.addSourceError = null;
      })
      .addCase(addSourceToChat.fulfilled, (state, action) => {
        const { chatId, sources } = action.payload;
        state.isAddingSource = false;
        state.sourcesByChat[chatId] = sources;
        state.addSourceError = null;

        // Start polling for any pending/processing sources
        sources.forEach((source) => {
          if (source.status === "pending" || source.status === "processing") {
            if (!state.pollingSourceIds.includes(source.id)) {
              state.pollingSourceIds.push(source.id);
            }
          }
        });
      })
      .addCase(addSourceToChat.rejected, (state, action) => {
        state.isAddingSource = false;
        state.addSourceError = action.error.message || "Failed to add source";
      });

    // Add multiple sources to chat
    builder
      .addCase(addMultipleSourcesToChat.pending, (state) => {
        state.isAddingSource = true;
        state.addSourceError = null;
      })
      .addCase(addMultipleSourcesToChat.fulfilled, (state, action) => {
        const { chatId, sources } = action.payload;
        state.isAddingSource = false;
        state.sourcesByChat[chatId] = sources;
        state.addSourceError = null;

        // Start polling for any pending/processing sources
        sources.forEach((source) => {
          if (source.status === "pending" || source.status === "processing") {
            if (!state.pollingSourceIds.includes(source.id)) {
              state.pollingSourceIds.push(source.id);
            }
          }
        });
      })
      .addCase(addMultipleSourcesToChat.rejected, (state, action) => {
        state.isAddingSource = false;
        state.addSourceError = action.error.message || "Failed to add sources";
      });

    // Remove source from chat
    builder.addCase(removeSourceFromChat.fulfilled, (state, action) => {
      const { chatId, sourceId } = action.payload;
      if (state.sourcesByChat[chatId]) {
        state.sourcesByChat[chatId] = state.sourcesByChat[chatId].filter(
          (source) => source.id !== sourceId
        );
      }
      // Stop polling for removed source
      state.pollingSourceIds = state.pollingSourceIds.filter(
        (id) => id !== sourceId
      );
    });

    // Poll source status
    builder.addCase(pollSourceStatus.fulfilled, (state, action) => {
      const { sourceId, status } = action.payload;

      // Update source status across all chats
      Object.values(state.sourcesByChat).forEach((sources) => {
        const source = sources.find((s) => s.id === sourceId);
        if (source) {
          source.status = status.status as any;
          source.lastUpdated = new Date().toISOString();

          // If processing completed or failed, stop polling
          if (status.status === "completed" || status.status === "failed") {
            state.pollingSourceIds = state.pollingSourceIds.filter(
              (id) => id !== sourceId
            );
          }

          // Update metadata with error if failed
          if (status.status === "failed" && status.lastError) {
            source.metadata = {
              ...source.metadata,
              errorMessage: status.lastError,
            };
          }
        }
      });
    });

    // Handle global store reset
    builder.addCase(resetStore, () => {
      return initialState;
    });
  },
});

export const {
  clearChatSources,
  clearAllSources,
  startPollingSource,
  stopPollingSource,
  updateSourceStatus,
} = sourcesSlice.actions;

export default sourcesSlice.reducer;

// Selectors
export const selectChatSources = (state: any, chatId: string) =>
  state.sources.sourcesByChat[chatId] || [];

export const selectChatSourcesLoading = (state: any, chatId: string) =>
  state.sources.loadingByChat[chatId] || false;

export const selectChatSourcesError = (state: any, chatId: string) =>
  state.sources.errorsByChat[chatId] || null;

export const selectIsAddingSource = (state: any) =>
  state.sources.isAddingSource;

export const selectAddSourceError = (state: any) =>
  state.sources.addSourceError;

export const selectPollingSourceIds = (state: any) =>
  state.sources.pollingSourceIds;
