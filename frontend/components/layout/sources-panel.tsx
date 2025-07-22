"use client";

import { useState, useMemo, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useAppSelector, useAppDispatch } from "@/lib/hooks";
import {
  loadChatSources,
  removeSource,
  selectSourcesForChat,
} from "@/lib/features/sources/sourcesSlice";
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

const getSourceIcon = (kind: string, className?: string) => {
  const iconClass = className || "h-4 w-4";
  const iconProps = { className: iconClass };
  
  switch (kind) {
    case "youtube":
      return <Youtube {...iconProps} className={`${iconClass} text-red-500`} />;
    case "pdf":
      return <FileText {...iconProps} className={`${iconClass} text-red-600`} />;
    case "web":
      return <Globe {...iconProps} className={`${iconClass} text-blue-500`} />;
    case "file":
      return <Upload {...iconProps} className={`${iconClass} text-purple-500`} />;
    default:
      return <FileText {...iconProps} className={`${iconClass} text-gray-500`} />;
  }
};

const getStatusIcon = (status: string) => {
  switch (status) {
    case "pending":
    case "processing":
      return (
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
        >
          <Loader2 className="h-3.5 w-3.5 text-blue-500" />
        </motion.div>
      );
    case "completed":
      return <CheckCircle className="h-3.5 w-3.5 text-emerald-500" />;
    case "failed":
      return <AlertCircle className="h-3.5 w-3.5 text-red-500" />;
    default:
      return <Clock className="h-3.5 w-3.5 text-muted-foreground" />;
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
  chatId: string;
  isCollapsed?: boolean;
}

export function SourcesPanel({
  chatId,
  isCollapsed = false,
}: SourcesPanelProps) {
  const dispatch = useAppDispatch();
  const { selectedSourceIds } = useAppSelector((state) => state.chat);

  // Create memoized selectors for this chat
  const selectIsProcessing = useMemo(
    () => (chatId ? makeSelectIsProcessing(chatId) : () => false),
    [chatId]
  );
  const selectProcessingCount = useMemo(
    () => (chatId ? makeSelectProcessingCount(chatId) : () => 0),
    [chatId]
  );
  const selectCompletedCount = useMemo(
    () => (chatId ? makeSelectCompletedCount(chatId) : () => 0),
    [chatId]
  );

  // Get processing status from selectors
  const isProcessing = useAppSelector(selectIsProcessing);
  const processingCount = useAppSelector(selectProcessingCount);
  const completedCount = useAppSelector(selectCompletedCount);

  // Get sources from normalized state
  const sources = useAppSelector((state) =>
    chatId ? selectSourcesForChat(state, chatId) : []
  );
  const {
    isLoading: isInitialLoading,
    error: sourcesError,
    isRemoving,
    sources: sourcesEntities,
  } = useAppSelector((state) => state.sources);
  console.log(sourcesEntities);
  const [searchQuery, setSearchQuery] = useState("");
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isDiscoverModalOpen, setIsDiscoverModalOpen] = useState(false);
  const [isFiltersExpanded, setIsFiltersExpanded] = useState(false);

  const filteredSources = Object.values(sourcesEntities.entities).filter(
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
    if (!chatId) return;

    try {
      await dispatch(removeSource({ chatId, sourceId })).unwrap();
    } catch (error) {
      console.error("Failed to remove source:", error);
    }
  };

  const handleRefreshSources = () => {
    if (chatId) {
      dispatch(loadChatSources(chatId));
    }
  };

  // Load sources when chat changes
  useEffect(() => {
    if (chatId) {
      dispatch(loadChatSources(chatId));
    }
  }, [chatId, dispatch]);

  const isAllSelected =
    selectedSourceIds.length === filteredSources.length &&
    filteredSources.length > 0;

  if (isCollapsed) {
    return (
      <motion.div 
        className="w-14 h-full bg-gradient-to-b from-surface-1 to-surface-2/50 border-r border-border/70 flex flex-col items-center py-6 gap-3 backdrop-blur-sm"
        initial={{ width: 0, opacity: 0 }}
        animate={{ width: 56, opacity: 1 }}
        transition={{ duration: 0.3, ease: "easeOut" }}
      >
        <motion.div
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.95 }}
        >
          <Button
            size="icon"
            variant="default"
            onClick={() => setIsAddModalOpen(true)}
            className="h-9 w-9 lux-gradient shadow-lg hover:shadow-xl transition-all duration-200"
            disabled={!chatId}
            title="Add Source"
          >
            <Plus className="h-4 w-4 text-white" />
          </Button>
        </motion.div>
        
        <AnimatePresence>
          {sources.length > 0 && (
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
            >
              <Badge 
                variant="secondary" 
                className="text-xs bg-emerald-50 border-emerald-200 text-emerald-700 dark:bg-emerald-950 dark:border-emerald-800 dark:text-emerald-300 shadow-sm"
              >
                {completedCount}
              </Badge>
            </motion.div>
          )}
        </AnimatePresence>
        
        <AnimatePresence>
          {processingCount > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="relative"
            >
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
              >
                <Loader2 className="h-4 w-4 text-blue-500" />
              </motion.div>
              <Badge 
                variant="outline" 
                className="absolute -top-1 -right-1 h-4 w-4 text-xs p-0 flex items-center justify-center bg-blue-500 text-white border-blue-500"
              >
                {processingCount}
              </Badge>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    );
  }

  return (
    <motion.div 
      className="w-80 h-full bg-gradient-to-b from-surface-1 to-surface-2/30 border-r border-border/70 flex flex-col backdrop-blur-sm"
      initial={{ x: -320, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      transition={{ duration: 0.4, ease: "easeOut" }}
    >
      {/* Enhanced Header */}
      <div className="p-6 border-b border-border/50 bg-gradient-to-r from-surface-1/80 to-surface-1/60 backdrop-blur-sm">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 lux-gradient rounded-lg flex items-center justify-center shadow-md">
              <Globe className="h-4 w-4 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-foreground">Sources</h2>
              <div className="flex items-center gap-2 mt-0.5">
                {processingCount > 0 && (
                  <Badge variant="secondary" className="text-xs bg-blue-50 border-blue-200 text-blue-700 dark:bg-blue-950 dark:border-blue-800 dark:text-blue-300">
                    <motion.div
                      animate={{ scale: [1, 1.2, 1] }}
                      transition={{ duration: 1, repeat: Infinity }}
                      className="w-2 h-2 bg-blue-500 rounded-full mr-1.5"
                    />
                    {processingCount} processing
                  </Badge>
                )}
              </div>
            </div>
          </div>
          <motion.div
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            <Button
              size="icon"
              variant="ghost"
              onClick={handleRefreshSources}
              disabled={isInitialLoading}
              className="h-9 w-9 rounded-lg hover:bg-primary/10 transition-all duration-200"
              title="Refresh sources"
            >
              <motion.div
                animate={isInitialLoading ? { rotate: 360 } : {}}
                transition={isInitialLoading ? { duration: 1, repeat: Infinity, ease: "linear" } : {}}
              >
                <RefreshCw className="h-4 w-4" />
              </motion.div>
            </Button>
          </motion.div>
        </div>

        {!chatId ? (
          <div className="text-center py-4">
            <p className="text-sm text-muted-foreground">
              Select a chat to view sources
            </p>
          </div>
        ) : (
          <>
            {/* Enhanced Search */}
            <div className="relative mb-4 group">
              <div className="absolute inset-0 bg-gradient-to-r from-primary/10 via-primary/5 to-primary/10 rounded-xl opacity-0 group-focus-within:opacity-100 transition-all duration-300 blur-sm" />
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground group-focus-within:text-primary transition-colors duration-200 z-20 pointer-events-none" />
              <input
                type="text"
                placeholder="Search sources..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-3 text-sm border-2 border-border/50 rounded-xl focus:outline-none focus:border-primary/50 bg-background backdrop-blur-sm transition-all duration-200 relative z-10 placeholder:text-muted-foreground/60"
                aria-label="Search sources"
              />
            </div>

            {/* Enhanced Action Buttons */}
            <div className="flex gap-3 mb-4">
              <motion.div
                className="flex-1"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                <Button
                  variant="default"
                  className="w-full text-sm font-semibold lux-gradient shadow-lg hover:shadow-xl transition-all duration-200"
                  onClick={() => setIsAddModalOpen(true)}
                  disabled={!chatId}
                >
                  <Plus className="h-4 w-4 mr-2 text-white" />
                  <span>Add Source</span>
                </Button>
              </motion.div>
              <motion.div
                className="flex-1"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                <Button
                  variant="outline"
                  className="w-full text-sm font-medium border-2 border-primary/20 hover:border-primary/40 hover:bg-primary/10 hover:text-foreground transition-all duration-200"
                  onClick={() => setIsDiscoverModalOpen(true)}
                  disabled={!chatId}
                >
                  <Search className="h-4 w-4 mr-2" />
                  <span>Discover</span>
                </Button>
              </motion.div>
            </div>

            {/* Enhanced Select All */}
            <AnimatePresence>
              {filteredSources.length > 0 && (
                <motion.div 
                  className="flex items-center justify-between"
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                >
                  <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleSelectAll}
                      className="text-xs h-8 px-3 rounded-lg hover:bg-primary/10 hover:text-foreground transition-all duration-200"
                    >
                      <motion.div
                        animate={isAllSelected ? { scale: [1, 1.2, 1] } : {}}
                        transition={{ duration: 0.2 }}
                      >
                        {isAllSelected ? (
                          <CheckSquare className="h-3.5 w-3.5 mr-2 text-primary" />
                        ) : (
                          <Square className="h-3.5 w-3.5 mr-2 text-muted-foreground" />
                        )}
                      </motion.div>
                      {isAllSelected ? "Deselect All" : "Select All"}
                    </Button>
                  </motion.div>
                  <AnimatePresence>
                    {selectedSourceIds.length > 0 && (
                      <motion.div
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.8 }}
                      >
                        <Badge variant="secondary" className="text-xs bg-primary/10 border-primary/20 text-primary shadow-sm">
                          <span className="w-1.5 h-1.5 bg-primary rounded-full mr-1.5" />
                          {selectedSourceIds.length} selected
                        </Badge>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              )}
            </AnimatePresence>
          </>
        )}
      </div>

      {/* Enhanced Content */}
      <div className="flex-1 overflow-hidden relative">
        {!chatId ? (
          <motion.div 
            className="h-full flex items-center justify-center"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <div className="text-center px-6">
              <motion.div
                className="w-16 h-16 mx-auto mb-4 lux-gradient rounded-full flex items-center justify-center floating shadow-lg"
                whileHover={{ scale: 1.05 }}
              >
                <Globe className="h-8 w-8 text-white" />
              </motion.div>
              <h3 className="text-lg font-semibold mb-2 text-foreground">Ready to Add Sources</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Create or select a chat to start adding your content sources
              </p>
            </div>
          </motion.div>
        ) : isInitialLoading &&
          (!filteredSources || filteredSources.length === 0) ? (
          <div className="h-full overflow-y-auto p-4 space-y-2">
            {/* Skeleton items */}
            {Array.from({ length: 4 }).map((_, index) => (
              <div
                key={index}
                className="p-3 rounded-lg border border-border animate-pulse"
              >
                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0 mt-0.5">
                    <div className="h-4 w-4 bg-muted rounded" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        <div className="h-4 w-4 bg-muted rounded" />
                        <div className="h-4 bg-muted rounded flex-1 max-w-32" />
                      </div>
                      <div className="flex items-center gap-1">
                        <div className="h-3 w-3 bg-muted rounded" />
                        <div className="h-6 w-6 bg-muted rounded" />
                      </div>
                    </div>
                    <div className="flex items-center justify-between mt-1">
                      <div className="h-3 w-20 bg-muted rounded" />
                      <div className="h-5 w-16 bg-muted rounded-full" />
                    </div>
                  </div>
                </div>
              </div>
            ))}
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
          <motion.div 
            className="h-full flex items-center justify-center p-6"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <div className="text-center">
              <motion.div
                className="w-20 h-20 mx-auto mb-6 lux-gradient rounded-full flex items-center justify-center floating shadow-lg"
                whileHover={{ scale: 1.05 }}
              >
                <Globe className="h-10 w-10 text-white" />
              </motion.div>
              <h3 className="text-xl font-bold mb-3 text-foreground">No sources yet</h3>
              <p className="text-sm text-muted-foreground mb-6 leading-relaxed max-w-xs">
                Add YouTube videos, PDFs, web pages, or other sources to unlock AI-powered insights
              </p>
              <motion.div
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                <Button 
                  onClick={() => setIsAddModalOpen(true)} 
                  className="lux-gradient shadow-lg hover:shadow-xl transition-all duration-200 px-6"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add First Source
                </Button>
              </motion.div>
            </div>
          </motion.div>
        ) : (
          <div className="h-full overflow-y-auto p-4 space-y-2 scrollbar-visible">
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

      {/* Enhanced Footer */}
      <AnimatePresence>
        {chatId && sources.length > 0 && (
          <motion.div 
            className="p-6 border-t border-border/50 bg-gradient-to-r from-surface-1/80 to-surface-1/60 backdrop-blur-sm"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-muted-foreground rounded-full" />
                  <span className="text-sm font-medium text-muted-foreground">{sources.length} total</span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse shadow-[0_0_8px_hsl(var(--emerald-500)/50%)]" />
                <span className="text-sm font-semibold text-emerald-600 dark:text-emerald-400">
                  {completedCount} ready
                </span>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Modals */}
      <AddSourceModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
      />
      <DiscoverSourcesModal
        isOpen={isDiscoverModalOpen}
        onClose={() => setIsDiscoverModalOpen(false)}
      />
    </motion.div>
  );
}