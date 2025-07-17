"use client";

import { useEffect, useRef } from "react";
import { useAppDispatch, useAppSelector } from "@/lib/hooks";
import {
  fetchSources,
  pollProcessingVideos,
} from "@/lib/features/sources/sourcesSlice";

interface SourcesProviderProps {
  children: React.ReactNode;
}

export function SourcesProvider({ children }: SourcesProviderProps) {
  const dispatch = useAppDispatch();
  const { isAuthenticated, isInitialized } = useAppSelector(
    (state) => state.auth
  );
  const { sources } = useAppSelector((state) => state.sources);
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Initial fetch when authenticated
  useEffect(() => {
    // Only fetch sources when user is authenticated and auth check is complete
    if (isAuthenticated && isInitialized) {
      dispatch(fetchSources({ limit: 50 })); // Fetch first 50 sources
    }
  }, [dispatch, isAuthenticated, isInitialized]);

  // Start/stop polling based on processing videos
  useEffect(() => {
    const processingVideos = sources.filter(
      (source) => source.status === "processing"
    );

    if (processingVideos.length > 0 && isAuthenticated) {
      // Start polling if we have processing videos and user is authenticated
      if (!pollingIntervalRef.current) {
        console.log(
          `Starting status polling for ${processingVideos.length} processing videos`
        );

        // Poll immediately, then every 5 seconds
        dispatch(pollProcessingVideos());

        pollingIntervalRef.current = setInterval(() => {
          dispatch(pollProcessingVideos());
        }, 5000); // Poll every 5 seconds
      }
    } else {
      // Stop polling if no processing videos or user not authenticated
      if (pollingIntervalRef.current) {
        console.log("Stopping status polling - no processing videos");
        clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
      }
    }

    // Cleanup on unmount
    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
      }
    };
  }, [sources, isAuthenticated, dispatch]);

  // Cleanup polling on component unmount
  useEffect(() => {
    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
      }
    };
  }, []);

  return <>{children}</>;
}
