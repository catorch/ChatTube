import { createSlice, PayloadAction, createAsyncThunk } from "@reduxjs/toolkit";
import { videosApi } from "../../api/services/videos";
import { mapVideosToSources } from "../../api/mappers";
import { resetStore } from "../../store";

export interface Source {
  id: string;
  name: string;
  type: "youtube" | "podcast" | "document" | "website";
  url: string;
  thumbnail?: string;
  description?: string;
  isSelected: boolean;
  lastUpdated: string;
  status: "active" | "processing" | "error" | "inactive";
}

interface SourcesState {
  sources: Source[];
  selectedSources: string[];
  isAllSelected: boolean;
  isLoading: boolean;
  isPolling: boolean;
  error: string | null;
}

// Async thunks
export const fetchSources = createAsyncThunk(
  "sources/fetchSources",
  async (
    params: {
      page?: number;
      limit?: number;
      status?: "processing" | "completed" | "failed";
    } = {}
  ) => {
    const response = await videosApi.getVideos(params);
    return mapVideosToSources(response.videos);
  }
);

export const addSourceFromUrl = createAsyncThunk(
  "sources/addSourceFromUrl",
  async (videoUrl: string) => {
    const response = await videosApi.processVideo(videoUrl);
    return mapVideosToSources([response.video])[0];
  }
);

// New polling async thunk
export const pollProcessingVideos = createAsyncThunk(
  "sources/pollProcessingVideos",
  async (_, { getState, dispatch }) => {
    const state = getState() as any;
    const processingSources = state.sources.sources.filter(
      (source: Source) => source.status === "processing"
    );

    if (processingSources.length === 0) {
      return null; // No processing videos to poll
    }

    // Fetch only processing videos to check their status
    const response = await videosApi.getVideos({
      status: "processing",
      limit: 50,
    });

    // Also fetch completed videos to catch any that just finished
    const completedResponse = await videosApi.getVideos({
      status: "completed",
      limit: 50,
    });

    // Combine and map all videos
    const allVideos = [...response.videos, ...completedResponse.videos];
    return mapVideosToSources(allVideos);
  }
);

const initialState: SourcesState = {
  sources: [],
  selectedSources: [],
  isAllSelected: false,
  isLoading: false,
  isPolling: false,
  error: null,
};

const sourcesSlice = createSlice({
  name: "sources",
  initialState,
  reducers: {
    setSources: (state, action: PayloadAction<Source[]>) => {
      state.sources = action.payload;
    },
    addSource: (state, action: PayloadAction<Source>) => {
      state.sources.push(action.payload);
    },
    updateSource: (state, action: PayloadAction<Source>) => {
      const index = state.sources.findIndex((s) => s.id === action.payload.id);
      if (index !== -1) {
        state.sources[index] = action.payload;
      }
    },
    removeSource: (state, action: PayloadAction<string>) => {
      state.sources = state.sources.filter(
        (source) => source.id !== action.payload
      );
      state.selectedSources = state.selectedSources.filter(
        (id) => id !== action.payload
      );
    },
    toggleSourceSelection: (state, action: PayloadAction<string>) => {
      const sourceId = action.payload;
      const source = state.sources.find((s) => s.id === sourceId);

      if (source) {
        source.isSelected = !source.isSelected;

        if (source.isSelected) {
          state.selectedSources.push(sourceId);
        } else {
          state.selectedSources = state.selectedSources.filter(
            (id) => id !== sourceId
          );
        }
      }

      state.isAllSelected =
        state.sources.length > 0 &&
        state.selectedSources.length === state.sources.length;
    },
    toggleAllSources: (state) => {
      state.isAllSelected = !state.isAllSelected;

      if (state.isAllSelected) {
        state.selectedSources = state.sources.map((source) => source.id);
        state.sources.forEach((source) => {
          source.isSelected = true;
        });
      } else {
        state.selectedSources = [];
        state.sources.forEach((source) => {
          source.isSelected = false;
        });
      }
    },
    setLoading: (state, action: PayloadAction<boolean>) => {
      state.isLoading = action.payload;
    },
    setPolling: (state, action: PayloadAction<boolean>) => {
      state.isPolling = action.payload;
    },
    setError: (state, action: PayloadAction<string | null>) => {
      state.error = action.payload;
    },
  },
  extraReducers: (builder) => {
    // Fetch sources
    builder
      .addCase(fetchSources.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(fetchSources.fulfilled, (state, action) => {
        state.isLoading = false;
        state.sources = action.payload;
        state.error = null;
      })
      .addCase(fetchSources.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.error.message || "Failed to fetch sources";
      })
      // Add source from URL
      .addCase(addSourceFromUrl.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(addSourceFromUrl.fulfilled, (state, action) => {
        state.isLoading = false;
        state.sources.unshift(action.payload); // Add to beginning of list
        state.error = null;
      })
      .addCase(addSourceFromUrl.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.error.message || "Failed to add source";
      })
      // Poll processing videos
      .addCase(pollProcessingVideos.pending, (state) => {
        state.isPolling = true;
      })
      .addCase(pollProcessingVideos.fulfilled, (state, action) => {
        state.isPolling = false;
        if (action.payload) {
          // Update existing sources with new status information
          action.payload.forEach((updatedSource) => {
            const existingIndex = state.sources.findIndex(
              (s) => s.id === updatedSource.id
            );
            if (existingIndex !== -1) {
              // Preserve selection state when updating
              const wasSelected = state.sources[existingIndex].isSelected;
              state.sources[existingIndex] = {
                ...updatedSource,
                isSelected: wasSelected,
              };
            }
          });
        }
      })
      .addCase(pollProcessingVideos.rejected, (state, action) => {
        state.isPolling = false;
        console.error("Polling failed:", action.error.message);
        // Don't set error for polling failures to avoid UI disruption
      })
      // Handle global store reset
      .addCase(resetStore, () => {
        return initialState;
      });
  },
});

export const {
  setSources,
  addSource,
  updateSource,
  removeSource,
  toggleSourceSelection,
  toggleAllSources,
  setLoading,
  setPolling,
  setError,
} = sourcesSlice.actions;

export default sourcesSlice.reducer;
