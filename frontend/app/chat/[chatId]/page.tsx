"use client";

import { useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAppDispatch, useAppSelector } from "@/lib/hooks";
import {
  loadChatMessages,
  setCurrentChatId,
} from "@/lib/features/chat/chatSlice";
import { ChatLayout } from "@/components/layout/chat-layout";

export default function ChatPage() {
  const params = useParams();
  const router = useRouter();
  const dispatch = useAppDispatch();
  const { isAuthenticated, isInitialized } = useAppSelector(
    (state) => state.auth
  );
  const chatId = params.chatId as string;

  useEffect(() => {
    // Redirect to login if not authenticated
    if (isInitialized && !isAuthenticated) {
      router.push("/");
      return;
    }

    // Load the chat if we have a valid chatId and user is authenticated
    if (chatId && isAuthenticated) {
      dispatch(setCurrentChatId(chatId));
      dispatch(loadChatMessages(chatId));
    }
  }, [chatId, isAuthenticated, isInitialized, dispatch, router]);

  // Show loading while checking authentication
  if (!isInitialized) {
    return (
      <div className="h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  // Redirect if not authenticated
  if (!isAuthenticated) {
    return null;
  }

  return <ChatLayout chatId={chatId} />;
}
