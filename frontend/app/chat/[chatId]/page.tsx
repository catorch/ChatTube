"use client";

import { useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAppDispatch, useAppSelector } from "@/lib/hooks";
import {
  setCurrentChatId,
  useGetChatMessagesQuery,
} from "@/lib/features/chat/chatSlice";
import {
  selectIsAuthenticated,
  selectIsInitialized,
} from "@/lib/features/auth/authSlice";
import { ChatLayout } from "@/components/layout/chat-layout";

export default function ChatPage() {
  const params = useParams();
  const router = useRouter();
  const dispatch = useAppDispatch();

  // Use modern selectors
  const isAuthenticated = useAppSelector(selectIsAuthenticated);
  const isInitialized = useAppSelector(selectIsInitialized);

  const chatId = params.chatId as string;

  // RTK Query hook for loading chat messages
  const {
    data: chatData,
    isLoading,
    error,
  } = useGetChatMessagesQuery(
    { chatId },
    {
      skip: !chatId || !isAuthenticated,
      refetchOnMountOrArgChange: true,
    }
  );

  useEffect(() => {
    // Set current chat ID when component mounts
    if (chatId && isAuthenticated) {
      dispatch(setCurrentChatId(chatId));
    }
  }, [chatId, isAuthenticated, dispatch]);

  useEffect(() => {
    // Redirect to home if not authenticated after initialization
    if (isInitialized && !isAuthenticated) {
      router.push("/");
      return;
    }
  }, [isAuthenticated, isInitialized, router]);

  // Let auth provider handle initialization loading
  if (!isInitialized) {
    return null;
  }

  // Redirect if not authenticated (auth provider should handle this, but just in case)
  if (!isAuthenticated) {
    return null;
  }

  // Show loading state while fetching chat data
  if (isLoading) {
    return (
      <div className="h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-primary/20 border-t-primary rounded-full animate-spin mx-auto"></div>
          <p className="mt-4 text-sm text-muted-foreground">Loading chat...</p>
        </div>
      </div>
    );
  }

  // Show error state if chat failed to load
  if (error) {
    return (
      <div className="h-screen flex items-center justify-center bg-background">
        <div className="text-center max-w-md">
          <div className="w-12 h-12 rounded-full bg-destructive/10 flex items-center justify-center mx-auto mb-4">
            <svg
              className="w-6 h-6 text-destructive"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.082 16.5c-.77.833.192 2.5 1.732 2.5z"
              />
            </svg>
          </div>
          <h3 className="text-lg font-semibold mb-2">Chat Not Found</h3>
          <p className="text-muted-foreground mb-4">
            The chat you're looking for doesn't exist or you don't have access
            to it.
          </p>
          <button
            onClick={() => router.push("/")}
            className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
          >
            Go Back Home
          </button>
        </div>
      </div>
    );
  }

  // Chat not found but no error (shouldn't happen with proper error handling)
  if (!chatData) {
    return (
      <div className="h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <p className="text-muted-foreground">Chat not found</p>
        </div>
      </div>
    );
  }

  return <ChatLayout chatId={chatId} />;
}
