import { createSlice, PayloadAction, createAsyncThunk } from "@reduxjs/toolkit";
import {
  sourcesApi,
  Source,
  SourceCreateRequest,
  SourcesResponse,
} from "../../api/services/sources";
import { resetStore } from "../../types";

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

// Simplified state - RTK Query handles most of the data management
interface SourcesState {
  // Just keeping minimal UI state that RTK Query doesn't handle
}

const initialState: SourcesState = {};

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

// Note: Sources data is now managed by RTK Query
// This slice only handles UI state that's not covered by RTK Query

const sourcesSlice = createSlice({
  name: "sources",
  initialState,
  reducers: {
    // RTK Query handles all the state management now
    // This slice is kept minimal for future UI-only state if needed
  },

  extraReducers: (builder) => {
    // Handle global store reset
    builder.addCase(resetStore, () => {
      return initialState;
    });
  },
});

// No actions exported - RTK Query handles all data management
export const {} = sourcesSlice.actions;

export default sourcesSlice.reducer;

// Legacy selectors - these are deprecated, use RTK Query hooks instead
// Kept for backward compatibility but will be removed in future versions
