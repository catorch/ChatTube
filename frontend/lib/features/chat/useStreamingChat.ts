import React, { useCallback, useRef } from "react";
import { useAppDispatch, useAppSelector } from "../../hooks";
import { chatStreamingService } from "./streamingService";
import {
  SendMessageRequest,
  handleStreamEvent,
  startStreaming,
  stopStreaming,
  setStreamError,
  selectStreamingState,
  selectSelectedSourceIds,
  selectSelectedProvider,
  useGetChatMessagesQuery,
} from "./chatSlice";

/**
 * Custom hook for streaming chat functionality
 * Integrates streaming service with RTK Query chat slice
 */
export function useStreamingChat(chatId: string | null) {
  const dispatch = useAppDispatch();
  const streamingState = useAppSelector(selectStreamingState);
  const selectedSourceIds = useAppSelector(selectSelectedSourceIds);
  const selectedProvider = useAppSelector(selectSelectedProvider);

  // Keep reference to abort controller for cleanup
  const abortControllerRef = useRef<AbortController | null>(null);
  const streamRef = useRef<{ close: () => void } | null>(null);

  // Refetch messages when streaming completes
  const { refetch: refetchMessages } = useGetChatMessagesQuery(
    { chatId: chatId! },
    { skip: !chatId }
  );

  /**
   * Start streaming a message
   */
  const startStreamingMessage = useCallback(
    async (content: string) => {
      if (!chatId) {
        dispatch(setStreamError("No chat selected"));
        return;
      }

      // Create abort controller for this stream
      abortControllerRef.current = chatStreamingService.createAbortController();

      const request: SendMessageRequest = {
        content,
        sourceIds: selectedSourceIds,
        provider: selectedProvider,
      };

      try {
        const stream = await chatStreamingService.streamMessage(
          chatId,
          request,
          {
            onEvent: (event) => {
              dispatch(handleStreamEvent(event));

              // If streaming starts, update the state
              if (event.type === "start" && event.messageId) {
                dispatch(startStreaming({ messageId: event.messageId }));
              }

              // If streaming completes, stop and refetch
              if (event.type === "complete") {
                dispatch(stopStreaming());
                refetchMessages();
              }
            },
            onError: (error) => {
              dispatch(setStreamError(error.message));
            },
            signal: abortControllerRef.current.signal,
          }
        );

        streamRef.current = stream;
      } catch (error) {
        dispatch(setStreamError((error as Error).message));
      }
    },
    [chatId, selectedSourceIds, selectedProvider, dispatch, refetchMessages]
  );

  /**
   * Stop streaming
   */
  const stopStreamingMessage = useCallback(() => {
    // Cancel the request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }

    // Close the stream
    if (streamRef.current) {
      streamRef.current.close();
      streamRef.current = null;
    }

    // Update Redux state
    dispatch(stopStreaming());
  }, [dispatch]);

  /**
   * Cleanup function
   */
  const cleanup = useCallback(() => {
    stopStreamingMessage();
  }, [stopStreamingMessage]);

  return {
    // State
    streamingState,

    // Actions
    startStreamingMessage,
    stopStreamingMessage,
    cleanup,

    // Computed state
    isStreaming: streamingState.isStreaming,
    streamingContent: streamingState.content,
    streamError: streamingState.error,
    streamingMessageId: streamingState.messageId,
  };
}

/**
 * Hook for managing stream lifecycle in components
 * Automatically cleans up on unmount
 */
export function useStreamingChatWithCleanup(chatId: string | null) {
  const streaming = useStreamingChat(chatId);

  // Cleanup on unmount or chat change
  React.useEffect(() => {
    return () => {
      streaming.cleanup();
    };
  }, [chatId, streaming.cleanup]);

  return streaming;
}

// Re-export for convenience
export { chatStreamingService } from "./streamingService";
