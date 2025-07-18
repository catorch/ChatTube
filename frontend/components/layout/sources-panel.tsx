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
      className={`flex flex-col h-full bg-surface-1 border-r border-border transition-all duration-300 ${
        isCollapsed ? "w-16" : "w-80"
      }`}
    >
      {!isCollapsed && (
        <>
          {/* Enhanced Header with Better Typography */}
          <div className="shrink-0 border-b border-border">
            <div className="p-4">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <h2 className="font-semibold text-lg text-foreground">
                    Sources
                  </h2>
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
                {/* Enhanced Search */}
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <input
                    type="text"
                    placeholder="Search sources..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 bg-background border border-border rounded-lg focus:outline-none focus-lux text-sm transition-all duration-300"
                  />
                </div>

                {/* Enhanced Action Buttons */}
                <div className="flex gap-2">
                  <Button
                    variant="brand"
                    className="flex-1 text-sm lux-gradient text-white font-medium"
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

            {/* Enhanced Select All */}
            <div className="p-4 border-t border-border">
              <button
                onClick={handleSelectAll}
                className="flex items-center gap-2 text-sm hover:text-primary transition-colors font-medium"
              >
                {isAllSelected ? (
                  <CheckSquare className="h-4 w-4 text-primary" />
                ) : (
                  <Square className="h-4 w-4" />
                )}
                Select All ({selectedSources.length})
              </button>
            </div>
          </div>

          {/* Enhanced Scrollable Sources List - Rich Source Cards */}
          <div className="flex-1 overflow-hidden">
            <div className="h-full overflow-y-auto scrollbar-visible">
              <div className="p-4 space-y-3">
                {filteredSources.map((source) => (
                  <div
                    key={source.id}
                    className={`
                      p-3 rounded-lg border transition-all duration-200 cursor-pointer hover-lift
                      ${
                        source.isSelected
                          ? "border-primary bg-primary/5 shadow-sm"
                          : "border-border hover:bg-muted/40 hover:border-border/80"
                      }
                    `}
                    onClick={() => handleSourceToggle(source.id)}
                  >
                    {/* Header Row: Title and Selection Checkbox */}
                    <div className="flex justify-between items-start gap-3 mb-2">
                      <h3 className="font-semibold text-foreground leading-snug line-clamp-2 flex-1">
                        {source.name}
                      </h3>
                      <div className="flex-shrink-0 flex items-center gap-2">
                        {getStatusIcon(source.status)}
                        {source.isSelected ? (
                          <CheckSquare className="h-4 w-4 text-primary" />
                        ) : (
                          <Square className="h-4 w-4 text-muted-foreground" />
                        )}
                      </div>
                    </div>

                    {/* Author/Channel Line */}
                    {(source as any).channelName && (
                      <p className="text-xs text-muted-foreground mb-2">
                        By {(source as any).channelName}
                      </p>
                    )}

                    {/* Description */}
                    {source.description && (
                      <p className="text-xs text-muted-foreground mb-3 line-clamp-2 leading-relaxed">
                        {source.description}
                      </p>
                    )}

                    {/* Metadata Row */}
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <div className="flex items-center gap-1">
                        {getSourceIcon(source.type)}
                        <span className="capitalize">{source.type}</span>
                      </div>
                      <span>•</span>
                      <span>
                        {new Date(source.lastUpdated).toLocaleDateString(
                          "en-US",
                          {
                            month: "short",
                            day: "numeric",
                          }
                        )}
                      </span>
                      {source.status !== "active" && (
                        <>
                          <span>•</span>
                          <span
                            className={`font-medium ${
                              source.status === "processing"
                                ? "text-blue-500"
                                : source.status === "error"
                                ? "text-red-500"
                                : "text-gray-500"
                            }`}
                          >
                            {getStatusText(source.status)}
                          </span>
                        </>
                      )}
                    </div>

                    {/* Optional Actions Menu */}
                    <div className="absolute top-3 right-10 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 w-6 p-0 hover:bg-primary/10"
                        onClick={(e) => {
                          e.stopPropagation();
                          // Handle more options
                        }}
                      >
                        <MoreVertical className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                ))}

                {filteredSources.length === 0 && (
                  <div className="text-center py-12 text-muted-foreground">
                    <div className="w-12 h-12 mx-auto mb-4 bg-muted/20 rounded-lg flex items-center justify-center">
                      <Search className="h-6 w-6" />
                    </div>
                    <p className="text-sm">
                      {searchQuery
                        ? "No sources match your search"
                        : sources.length === 0
                        ? "No sources added yet"
                        : "No sources match your search"}
                    </p>
                    {!searchQuery && sources.length === 0 && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="mt-3"
                        onClick={() => setIsAddModalOpen(true)}
                      >
                        <Plus className="h-4 w-4 mr-2" />
                        Add your first source
                      </Button>
                    )}
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
