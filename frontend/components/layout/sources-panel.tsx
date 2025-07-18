"use client";

import { useState } from "react";
import { useAppSelector, useAppDispatch } from "@/lib/hooks";
import {
  toggleSourceSelection,
  toggleAllSources,
} from "@/lib/features/sources/sourcesSlice";
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
  Mic,
  MoreVertical,
  Filter,
  ChevronDown,
  ChevronUp,
  Loader2,
  Clock,
  CheckCircle,
  AlertCircle,
} from "lucide-react";

const getSourceIcon = (type: string) => {
  switch (type) {
    case "youtube":
      return <Youtube className="h-4 w-4" />;
    case "podcast":
      return <Mic className="h-4 w-4" />;
    case "document":
      return <FileText className="h-4 w-4" />;
    case "website":
      return <Globe className="h-4 w-4" />;
    default:
      return <FileText className="h-4 w-4" />;
  }
};

const getStatusIcon = (status: string) => {
  switch (status) {
    case "processing":
      return <Loader2 className="h-3 w-3 animate-spin text-blue-500" />;
    case "active":
      return <CheckCircle className="h-3 w-3 text-green-500" />;
    case "error":
      return <AlertCircle className="h-3 w-3 text-red-500" />;
    case "inactive":
      return <Clock className="h-3 w-3 text-gray-400" />;
    default:
      return null;
  }
};

const getStatusText = (status: string) => {
  switch (status) {
    case "processing":
      return "Processing...";
    case "active":
      return "Ready";
    case "error":
      return "Failed";
    case "inactive":
      return "Inactive";
    default:
      return status;
  }
};

interface SourcesPanelProps {
  isCollapsed?: boolean;
}

export function SourcesPanel({ isCollapsed = false }: SourcesPanelProps) {
  const dispatch = useAppDispatch();
  const { sources, selectedSources, isAllSelected, isPolling } = useAppSelector(
    (state) => state.sources
  );
  const [searchQuery, setSearchQuery] = useState("");
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isDiscoverModalOpen, setIsDiscoverModalOpen] = useState(false);
  const [isFiltersExpanded, setIsFiltersExpanded] = useState(false);

  const filteredSources = sources.filter(
    (source) =>
      source.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      source.description?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const processingCount = sources.filter(
    (s) => s.status === "processing"
  ).length;

  const handleSourceToggle = (sourceId: string) => {
    dispatch(toggleSourceSelection(sourceId));
  };

  const handleSelectAll = () => {
    dispatch(toggleAllSources());
  };

  return (
    <div
      className={`flex flex-col h-full bg-card border-r border-border transition-all duration-300 ${
        isCollapsed ? "w-16" : "w-80"
      }`}
    >
      {!isCollapsed && (
        <>
          {/* Static Header - No scrolling */}
          <div className="shrink-0 border-b border-border">
            <div className="p-4">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <h2 className="font-semibold text-lg">Sources</h2>
                  {processingCount > 0 && (
                    <div className="flex items-center gap-1">
                      <Loader2 className="h-3 w-3 animate-spin text-blue-500" />
                      <span className="text-xs text-blue-600 font-medium">
                        {processingCount} processing
                      </span>
                    </div>
                  )}
                  {isPolling && (
                    <div
                      className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"
                      title="Checking for updates..."
                    />
                  )}
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="sm:hidden"
                  onClick={() => setIsFiltersExpanded(!isFiltersExpanded)}
                >
                  <Filter className="h-4 w-4" />
                  {isFiltersExpanded ? (
                    <ChevronUp className="h-4 w-4 ml-1" />
                  ) : (
                    <ChevronDown className="h-4 w-4 ml-1" />
                  )}
                </Button>
              </div>

              {/* Progressive disclosure: accordion on mobile */}
              <div
                className={`space-y-4 transition-all duration-200 ${
                  isFiltersExpanded ? "block" : "hidden sm:block"
                }`}
              >
                {/* Search */}
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <input
                    type="text"
                    placeholder="Search sources..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 bg-background border border-border rounded-[var(--r-1)] focus:outline-none focus-lux text-sm"
                  />
                </div>

                {/* Action Buttons */}
                <div className="flex gap-2">
                  <Button
                    variant="brand"
                    className="flex-1 text-sm"
                    onClick={() => setIsAddModalOpen(true)}
                  >
                    <Plus className="h-4 w-4 mr-1 sm:mr-2" />
                    <span className="hidden xs:inline">Add</span>
                    <span className="xs:hidden">+</span>
                  </Button>
                  <Button
                    variant="surface"
                    className="flex-1 text-sm"
                    onClick={() => setIsDiscoverModalOpen(true)}
                  >
                    <Search className="h-4 w-4 mr-1 sm:mr-2" />
                    <span className="hidden xs:inline">Discover</span>
                    <span className="xs:hidden">🔍</span>
                  </Button>
                </div>
              </div>
            </div>

            {/* Select All - Always visible */}
            <div className="p-4 border-t border-border">
              <button
                onClick={handleSelectAll}
                className="flex items-center gap-2 text-sm hover:text-primary transition-colors"
              >
                {isAllSelected ? (
                  <CheckSquare className="h-4 w-4" />
                ) : (
                  <Square className="h-4 w-4" />
                )}
                Select All ({selectedSources.length})
              </button>
            </div>
          </div>

          {/* Scrollable Sources List */}
          <div className="flex-1 overflow-hidden">
            <div className="h-full overflow-y-auto scrollbar-visible">
              <div className="p-4 space-y-2">
                {filteredSources.map((source) => (
                  <div
                    key={source.id}
                    className={`group relative px-3 py-2.5 rounded-[var(--r-1)] transition-all cursor-pointer hover:bg-muted/40 ${
                      source.isSelected
                        ? "bg-primary/8 ring-1 ring-primary/20"
                        : "hover:ring-1 hover:ring-border"
                    }`}
                    onClick={() => handleSourceToggle(source.id)}
                  >
                    <div className="flex items-center gap-3">
                      {/* Icon - subtle */}
                      <div className="flex-shrink-0 w-8 h-8 rounded-md bg-muted/60 flex items-center justify-center">
                        {getSourceIcon(source.type)}
                      </div>

                      {/* Content - streamlined */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <h3 className="font-medium text-sm line-clamp-1 text-foreground">
                            {source.name}
                          </h3>
                          
                          {/* Status indicator - minimal */}
                          <div className="flex items-center gap-1.5">
                            {getStatusIcon(source.status)}
                            {source.isSelected && (
                              <CheckSquare className="h-3.5 w-3.5 text-primary" />
                            )}
                          </div>
                        </div>
                        
                        {/* Meta info - condensed */}
                        <div className="flex items-center gap-1.5 mt-0.5 text-xs text-muted-foreground">
                          <span className="capitalize">{source.type}</span>
                          <span>•</span>
                          <span>{new Date(source.lastUpdated).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</span>
                          {source.status !== "active" && (
                            <>
                              <span>•</span>
                              <span className={`${
                                source.status === "processing" ? "text-blue-500" :
                                source.status === "error" ? "text-red-500" : "text-gray-500"
                              }`}>
                                {getStatusText(source.status)}
                              </span>
                            </>
                          )}
                        </div>
                      </div>

                      {/* Actions - minimal */}
                      <div className="flex-shrink-0">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="opacity-0 group-hover:opacity-100 transition-opacity h-7 w-7 p-0"
                          onClick={(e) => {
                            e.stopPropagation();
                            // Handle more options
                          }}
                        >
                          <MoreVertical className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}

                {filteredSources.length === 0 && (
                  <div className="text-center py-8 text-muted-foreground">
                    {searchQuery
                      ? "No sources match your search"
                      : sources.length === 0
                      ? "No sources added yet"
                      : "No sources match your search"}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Modals */}
          <AddSourceModal
            isOpen={isAddModalOpen}
            onClose={() => setIsAddModalOpen(false)}
          />
          <DiscoverSourcesModal
            isOpen={isDiscoverModalOpen}
            onClose={() => setIsDiscoverModalOpen(false)}
          />
        </>
      )}
    </div>
  );
}
