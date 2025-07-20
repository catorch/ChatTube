"use client";

import { useState, useMemo } from "react";
import { useAppSelector, useAppDispatch } from "@/lib/hooks";
import {
  useListSourcesQuery,
  useRemoveSourceMutation,
} from "@/lib/api/services/sources";
import {
  makeSelectIsProcessing,
  makeSelectProcessingCount,
  makeSelectCompletedCount,
} from "@/lib/features/sources/selectors";
import { FrontendSource } from "@/lib/api/types";
import {
  toggleSourceSelection,
  selectAllSources,
  clearSourceSelection,
} from "@/lib/features/chat/chatSlice";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { AddSourceModal } from "@/components/modals/add-source-modal";
import { DiscoverSourcesModal } from "@/components/modals/discover-sources-modal";
import {
  Plus,
  Search,
  CheckSquare,
  Square,
  Youtube,
  FileText,
  Globe,
  Upload,
  MoreVertical,
  Filter,
  ChevronDown,
  ChevronUp,
  Loader2,
  Clock,
  CheckCircle,
  AlertCircle,
  Trash2,
  RefreshCw,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const getSourceIcon = (kind: string) => {
  switch (kind) {
    case "youtube":
      return <Youtube className="h-4 w-4" />;
    case "pdf":
      return <FileText className="h-4 w-4" />;
    case "web":
      return <Globe className="h-4 w-4" />;
    case "file":
      return <Upload className="h-4 w-4" />;
    default:
      return <FileText className="h-4 w-4" />;
  }
};

const getStatusIcon = (status: string) => {
  switch (status) {
    case "pending":
    case "processing":
      return <Loader2 className="h-3 w-3 animate-spin text-blue-500" />;
    case "completed":
      return <CheckCircle className="h-3 w-3 text-green-500" />;
    case "failed":
      return <AlertCircle className="h-3 w-3 text-red-500" />;
    default:
      return <Clock className="h-3 w-3 text-gray-400" />;
  }
};

const getStatusText = (status: string) => {
  switch (status) {
    case "pending":
      return "Queued";
    case "processing":
      return "Processing...";
    case "completed":
      return "Ready";
    case "failed":
      return "Failed";
    default:
      return status;
  }
};

interface SourcesPanelProps {
  isCollapsed?: boolean;
}

export function SourcesPanel({ isCollapsed = false }: SourcesPanelProps) {
  const dispatch = useAppDispatch();
  const { currentChatId, selectedSourceIds } = useAppSelector(
    (state) => state.chat
  );

  // Create memoized selectors for this chat
  const selectIsProcessing = useMemo(
    () => (currentChatId ? makeSelectIsProcessing(currentChatId) : () => false),
    [currentChatId]
  );
  const selectProcessingCount = useMemo(
    () => (currentChatId ? makeSelectProcessingCount(currentChatId) : () => 0),
    [currentChatId]
  );
  const selectCompletedCount = useMemo(
    () => (currentChatId ? makeSelectCompletedCount(currentChatId) : () => 0),
    [currentChatId]
  );

  // Get processing status from selectors
  const isProcessing = useAppSelector(selectIsProcessing);
  const processingCount = useAppSelector(selectProcessingCount);
  const completedCount = useAppSelector(selectCompletedCount);

  // 🟢 RTK Query with automatic polling - one line does it all!
  const {
    data: sources = [],
    isLoading: isInitialLoading, // Only true for initial load
    isFetching, // True during polling, but don't hide UI
    error: sourcesError,
  } = useListSourcesQuery(currentChatId!, {
    skip: !currentChatId, // wait until we have a chat
    pollingInterval: isProcessing ? 5_000 : 0, // 5s while needed, stop when done
    refetchOnFocus: true, // nice-to-have
    refetchOnReconnect: true, // nice-to-have
  });

  const [removeSource] = useRemoveSourceMutation();

  const [searchQuery, setSearchQuery] = useState("");
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isDiscoverModalOpen, setIsDiscoverModalOpen] = useState(false);
  const [isFiltersExpanded, setIsFiltersExpanded] = useState(false);

  const filteredSources = sources.filter(
    (source: FrontendSource) =>
      source.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      source.metadata.description
        ?.toLowerCase()
        .includes(searchQuery.toLowerCase())
  );

  const handleSelectAll = () => {
    const allSourceIds = filteredSources.map((s: FrontendSource) => s.id);
    if (selectedSourceIds.length === allSourceIds.length) {
      dispatch(clearSourceSelection());
    } else {
      dispatch(selectAllSources(allSourceIds));
    }
  };

  const handleSourceToggle = (sourceId: string) => {
    dispatch(toggleSourceSelection(sourceId));
  };

  const handleRemoveSource = async (sourceId: string) => {
    if (!currentChatId) return;

    try {
      await removeSource({ chatId: currentChatId, sourceId }).unwrap();
    } catch (error) {
      console.error("Failed to remove source:", error);
    }
  };

  const handleRefreshSources = () => {
    // RTK Query will automatically refetch when needed, but we can manually trigger
    // Note: refetch is handled automatically by the polling mechanism
    // If manual refresh is needed, we could add a refetch() call here
  };

  const isAllSelected =
    selectedSourceIds.length === filteredSources.length &&
    filteredSources.length > 0;

  if (isCollapsed) {
    return (
      <div className="w-12 h-full bg-surface-1 border-r border-border flex flex-col items-center py-4 gap-2">
        <Button
          size="icon"
          variant="default"
          onClick={() => setIsAddModalOpen(true)}
          className="h-8 w-8"
          disabled={!currentChatId}
        >
          <Plus className="h-4 w-4" />
        </Button>
        {sources.length > 0 && (
          <Badge variant="secondary" className="text-xs">
            {completedCount}
          </Badge>
        )}
        {processingCount > 0 && (
          <Loader2 className="h-3 w-3 animate-spin text-blue-500" />
        )}
      </div>
    );
  }

  return (
    <div className="w-80 h-full bg-surface-1 border-r border-border flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-border">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-semibold">Sources</h2>
            {processingCount > 0 && (
              <Badge variant="secondary" className="text-xs">
                {processingCount} processing
              </Badge>
            )}
          </div>
          <Button
            size="icon"
            variant="ghost"
            onClick={handleRefreshSources}
            disabled={isInitialLoading}
            className="h-8 w-8"
          >
            <RefreshCw
              className={`h-4 w-4 ${isFetching ? "animate-spin" : ""}`}
            />
          </Button>
        </div>

        {!currentChatId ? (
          <div className="text-center py-4">
            <p className="text-sm text-muted-foreground">
              Select a chat to view sources
            </p>
          </div>
        ) : (
          <>
            {/* Search */}
            <div className="relative mb-3">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search sources..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 text-sm border border-border rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary bg-background"
              />
            </div>

            {/* Action Buttons */}
            <div className="flex gap-2 mb-3">
              <Button
                variant="default"
                className="flex-1 text-sm font-medium"
                onClick={() => setIsAddModalOpen(true)}
                disabled={!currentChatId}
              >
                <Plus className="h-4 w-4 mr-1 sm:mr-2" />
                <span className="hidden xs:inline">Add</span>
                <span className="xs:hidden">+</span>
              </Button>
              <Button
                variant="outline"
                className="flex-1 text-sm"
                onClick={() => setIsDiscoverModalOpen(true)}
                disabled={!currentChatId}
              >
                <Search className="h-4 w-4 mr-1 sm:mr-2" />
                <span className="hidden xs:inline">Discover</span>
                <span className="xs:hidden">🔍</span>
              </Button>
            </div>

            {/* Select All */}
            {filteredSources.length > 0 && (
              <div className="flex items-center justify-between">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleSelectAll}
                  className="text-xs h-7"
                >
                  {isAllSelected ? (
                    <CheckSquare className="h-3 w-3 mr-1" />
                  ) : (
                    <Square className="h-3 w-3 mr-1" />
                  )}
                  {isAllSelected ? "Deselect All" : "Select All"}
                </Button>
                {selectedSourceIds.length > 0 && (
                  <Badge variant="outline" className="text-xs">
                    {selectedSourceIds.length} selected
                  </Badge>
                )}
              </div>
            )}
          </>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden">
        {!currentChatId ? (
          <div className="h-full flex items-center justify-center">
            <div className="text-center">
              <Globe className="h-12 w-12 mx-auto mb-3 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                Create or select a chat to add sources
              </p>
            </div>
          </div>
        ) : isInitialLoading ? (
          <div className="h-full flex items-center justify-center">
            <div className="text-center">
              <Loader2 className="h-8 w-8 mx-auto mb-2 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">
                Loading sources...
              </p>
            </div>
          </div>
        ) : sourcesError ? (
          <div className="h-full flex items-center justify-center p-4">
            <div className="text-center">
              <AlertCircle className="h-8 w-8 mx-auto mb-2 text-red-500" />
              <p className="text-sm text-red-600 mb-2">
                Failed to load sources
              </p>
              <Button
                size="sm"
                variant="outline"
                onClick={handleRefreshSources}
              >
                Try Again
              </Button>
            </div>
          </div>
        ) : filteredSources.length === 0 ? (
          <div className="h-full flex items-center justify-center p-4">
            <div className="text-center">
              <Globe className="h-12 w-12 mx-auto mb-3 text-muted-foreground" />
              <h3 className="font-medium mb-2">No sources yet</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Add YouTube videos, PDFs, or other sources to start chatting
              </p>
              <Button onClick={() => setIsAddModalOpen(true)} className="gap-2">
                <Plus className="h-4 w-4" />
                Add Source
              </Button>
            </div>
          </div>
        ) : (
          <div className="h-full overflow-y-auto p-4 space-y-2">
            {filteredSources.map((source: FrontendSource) => (
              <div
                key={source.id}
                className={`p-3 rounded-lg border cursor-pointer transition-all ${
                  selectedSourceIds.includes(source.id)
                    ? "border-primary bg-primary/5"
                    : "border-border hover:border-primary/50"
                }`}
                onClick={() => handleSourceToggle(source.id)}
              >
                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0 mt-0.5">
                    {selectedSourceIds.includes(source.id) ? (
                      <CheckSquare className="h-4 w-4 text-primary" />
                    ) : (
                      <Square className="h-4 w-4 text-muted-foreground" />
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        {getSourceIcon(source.kind)}
                        <span className="font-medium text-sm truncate">
                          {source.title}
                        </span>
                      </div>

                      <div className="flex items-center gap-1">
                        {getStatusIcon(source.status)}
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-6 w-6"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <MoreVertical className="h-3 w-3" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem
                              onClick={(e) => {
                                e.stopPropagation();
                                handleRemoveSource(source.id);
                              }}
                              className="text-red-600"
                            >
                              <Trash2 className="h-4 w-4 mr-2" />
                              Remove
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>

                    <div className="flex items-center justify-between mt-1">
                      <span className="text-xs text-muted-foreground capitalize">
                        {source.kind} • {getStatusText(source.status)}
                      </span>
                      {source.metadata.chunksCount && (
                        <Badge variant="outline" className="text-xs">
                          {source.metadata.chunksCount} chunks
                        </Badge>
                      )}
                    </div>

                    {source.metadata.errorMessage && (
                      <p className="text-xs text-red-600 mt-1 truncate">
                        Error: {source.metadata.errorMessage}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Footer */}
      {currentChatId && sources.length > 0 && (
        <div className="p-4 border-t border-border">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>{sources.length} total sources</span>
            <span>{completedCount} ready for chat</span>
          </div>
        </div>
      )}

      {/* Modals */}
      <AddSourceModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
      />
      <DiscoverSourcesModal
        isOpen={isDiscoverModalOpen}
        onClose={() => setIsDiscoverModalOpen(false)}
      />
    </div>
  );
}
