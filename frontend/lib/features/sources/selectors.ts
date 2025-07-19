import { createSelector } from "@reduxjs/toolkit";
import { sourcesApi } from "@/lib/api/services/sources";

// Selector to check if any sources are still processing for a given chat
export const makeSelectIsProcessing = (chatId: string) =>
  createSelector(
    sourcesApi.endpoints.listSources.select(chatId),
    (queryResult) =>
      queryResult.data?.some(
        (s) => s.status === "pending" || s.status === "processing"
      ) ?? false
  );

// Selector to get processing count for a chat
export const makeSelectProcessingCount = (chatId: string) =>
  createSelector(
    sourcesApi.endpoints.listSources.select(chatId),
    (queryResult) =>
      queryResult.data?.filter(
        (s) => s.status === "pending" || s.status === "processing"
      ).length ?? 0
  );

// Selector to get completed count for a chat
export const makeSelectCompletedCount = (chatId: string) =>
  createSelector(
    sourcesApi.endpoints.listSources.select(chatId),
    (queryResult) =>
      queryResult.data?.filter((s) => s.status === "completed").length ?? 0
  );
