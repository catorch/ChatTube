"use client";

import { useEffect } from "react";
import { useAppDispatch, useAppSelector } from "@/lib/hooks";
import { checkAuth, showAuthModal } from "@/lib/features/auth/authSlice";
import { AuthModal } from "@/components/auth/auth-modal";

interface AuthProviderProps {
  children: React.ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const dispatch = useAppDispatch();
  const { isAuthenticated, isInitialized, isLoading } = useAppSelector(
    (state) => state.auth
  );

  useEffect(() => {
    // Check authentication status when app loads
    if (!isInitialized) {
      dispatch(checkAuth());
    }
  }, [dispatch, isInitialized]);

  useEffect(() => {
    // Show auth modal if user is not authenticated and initialization is complete
    if (isInitialized && !isAuthenticated && !isLoading) {
      dispatch(showAuthModal("login"));
    }
  }, [dispatch, isInitialized, isAuthenticated, isLoading]);

  // Show loading state while checking authentication
  if (!isInitialized && isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600 dark:text-gray-400">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <>
      {children}
      <AuthModal />
    </>
  );
}
