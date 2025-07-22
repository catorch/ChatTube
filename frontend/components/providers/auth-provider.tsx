"use client";

import { useEffect } from "react";
import { useAppDispatch, useAppSelector } from "@/lib/hooks";
import {
  useLazyCheckAuthQuery,
  showAuthModal,
  selectIsAuthenticated,
  selectIsInitialized,
  setInitialized,
} from "@/lib/features/auth/authSlice";
import { AuthModal } from "@/components/auth/auth-modal";

interface AuthProviderProps {
  children: React.ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const dispatch = useAppDispatch();
  const isAuthenticated = useAppSelector(selectIsAuthenticated);
  const isInitialized = useAppSelector(selectIsInitialized);

  // RTK Query lazy hook for auth checking
  const [checkAuth, { isLoading: isCheckingAuth }] = useLazyCheckAuthQuery();

  useEffect(() => {
    // Check authentication status when app loads
    const initializeAuth = async () => {
      if (!isInitialized) {
        try {
          await checkAuth().unwrap();
        } catch (error) {
          // Auth check failed - user is not authenticated
          console.log("Auth check failed, user not authenticated");
        } finally {
          // Mark as initialized regardless of auth result
          dispatch(setInitialized(true));
        }
      }
    };

    initializeAuth();
  }, [checkAuth, dispatch, isInitialized]);

  useEffect(() => {
    // Show auth modal if user is not authenticated after initialization
    if (isInitialized && !isAuthenticated && !isCheckingAuth) {
      dispatch(showAuthModal("login"));
    }
  }, [dispatch, isInitialized, isAuthenticated, isCheckingAuth]);

  // Show loading state while checking authentication
  if (!isInitialized || isCheckingAuth) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-primary/20 border-t-primary rounded-full animate-spin mx-auto"></div>
          <p className="mt-4 text-sm text-muted-foreground">
            {!isInitialized ? "Initializing..." : "Checking authentication..."}
          </p>
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
