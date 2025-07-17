import { createSlice, PayloadAction, createAsyncThunk } from "@reduxjs/toolkit";
import { videosApi } from "../../api/services/videos";
import { mapVideosToSources } from "../../api/mappers";

export interface Source {
  id: string;
  name: string;
  type: "youtube" | "podcast" | "document" | "website";
  url: string;
  thumbnail?: string;
  description?: string;
  isSelected: boolean;
  lastUpdated: Date;
  status: "active" | "processing" | "error" | "inactive";
}

interface SourcesState {
  sources: Source[];
  selectedSources: string[];
  isAllSelected: boolean;
  isLoading: boolean;
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

const initialState: SourcesState = {
  sources: [],
  selectedSources: [],
  isAllSelected: false,
  isLoading: false,
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
      });
  },
});

export const {
  setSources,
  addSource,
  removeSource,
  toggleSourceSelection,
  toggleAllSources,
  setLoading,
  setError,
} = sourcesSlice.actions;

export default sourcesSlice.reducer;
