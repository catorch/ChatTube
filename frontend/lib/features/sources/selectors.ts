import { createSelector } from "@reduxjs/toolkit";
import { selectSourcesForChat } from "./sourcesSlice";
import { RootState } from "../../store";

// Selector to check if any sources are still processing for a given chat
export const makeSelectIsProcessing = (chatId: string) =>
  createSelector(
    (state: RootState) => selectSourcesForChat(state, chatId),
    (sources) =>
      sources.some((s) => s.status === "pending" || s.status === "processing")
  );

// Selector to get processing count for a chat
export const makeSelectProcessingCount = (chatId: string) =>
  createSelector(
    (state: RootState) => selectSourcesForChat(state, chatId),
    (sources) =>
      sources.filter((s) => s.status === "pending" || s.status === "processing")
        .length
  );

// Selector to get completed count for a chat
export const makeSelectCompletedCount = (chatId: string) =>
  createSelector(
    (state: RootState) => selectSourcesForChat(state, chatId),
    (sources) => sources.filter((s) => s.status === "completed").length
  );

// Additional selectors for convenience
export const selectIsProcessing = (state: RootState, chatId: string) =>
  makeSelectIsProcessing(chatId)(state);

export const selectProcessingCount = (state: RootState, chatId: string) =>
  makeSelectProcessingCount(chatId)(state);

export const selectCompletedCount = (state: RootState, chatId: string) =>
  makeSelectCompletedCount(chatId)(state);
