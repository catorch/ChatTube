"use client";

import { useEffect } from "react";
import { useAppDispatch, useAppSelector } from "@/lib/hooks";
import { fetchSources } from "@/lib/features/sources/sourcesSlice";

interface SourcesProviderProps {
  children: React.ReactNode;
}

export function SourcesProvider({ children }: SourcesProviderProps) {
  const dispatch = useAppDispatch();
  const { isAuthenticated, isInitialized } = useAppSelector(
    (state) => state.auth
  );

  useEffect(() => {
    // Only fetch sources when user is authenticated and auth check is complete
    if (isAuthenticated && isInitialized) {
      dispatch(fetchSources({ limit: 50 })); // Fetch first 50 sources
    }
  }, [dispatch, isAuthenticated, isInitialized]);

  return <>{children}</>;
}
