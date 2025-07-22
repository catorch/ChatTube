import { createSelector } from "@reduxjs/toolkit";
import { sourcesApi, selectAllSourcesFromAdapter } from "./sourcesSlice";

// Selector to check if any sources are still processing for a given chat
export const makeSelectIsProcessing = (chatId: string) =>
  createSelector(
    [sourcesApi.endpoints.getChatSources.select(chatId)],
    (result) => {
      if (!result.data) return false;
      const sources = selectAllSourcesFromAdapter(result.data);
      return sources.some((s) => s.metadata.processingStatus === "processing");
    }
  );

// Selector to count processing sources for a given chat
export const makeSelectProcessingCount = (chatId: string) =>
  createSelector(
    [sourcesApi.endpoints.getChatSources.select(chatId)],
    (result) => {
      if (!result.data) return 0;
      const sources = selectAllSourcesFromAdapter(result.data);
      return sources.filter((s) => s.metadata.processingStatus === "processing")
        .length;
    }
  );

// Selector to count completed sources for a given chat
export const makeSelectCompletedCount = (chatId: string) =>
  createSelector(
    [sourcesApi.endpoints.getChatSources.select(chatId)],
    (result) => {
      if (!result.data) return 0;
      const sources = selectAllSourcesFromAdapter(result.data);
      return sources.filter((s) => s.metadata.processingStatus === "completed")
        .length;
    }
  );
