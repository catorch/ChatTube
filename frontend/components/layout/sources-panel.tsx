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

const getStatusColor = (status: string) => {
  switch (status) {
    case "active":
      return "bg-emerald-500/20 text-emerald-700 dark:text-emerald-300";
    case "processing":
      return "bg-amber-500/20 text-amber-700 dark:text-amber-300";
    case "error":
      return "bg-rose-500/20 text-rose-700 dark:text-rose-300";
    case "inactive":
      return "bg-gray-500/20 text-gray-700 dark:text-gray-300";
    default:
      return "bg-gray-500/20 text-gray-700 dark:text-gray-300";
  }
};

export function SourcesPanel() {
  const dispatch = useAppDispatch();
  const { sources, selectedSources, isAllSelected } = useAppSelector(
    (state) => state.sources
  );
  const [searchQuery, setSearchQuery] = useState("");
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isDiscoverModalOpen, setIsDiscoverModalOpen] = useState(false);

  const filteredSources = sources.filter(
    (source) =>
      source.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      source.description?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleSourceToggle = (sourceId: string) => {
    dispatch(toggleSourceSelection(sourceId));
  };

  const handleSelectAll = () => {
    dispatch(toggleAllSources());
  };

  return (
    <div className="w-full sm:w-80 md:w-96 lg:w-80 xl:w-96 h-full bg-card border-r border-border flex flex-col">
      {/* Header */}
      <div className="p-4 sm:p-6 border-b border-border">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg sm:text-xl font-semibold tracking-tight">
            Sources
          </h2>
          <Button variant="ghost" size="sm" className="shrink-0">
            <Filter className="h-4 w-4" />
          </Button>
        </div>

        {/* Search */}
        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search sources..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-background border border-border rounded-lg focus:outline-none focus-lux text-sm"
          />
        </div>

        {/* Action Buttons */}
        <div className="flex gap-2 mb-4">
          <Button
            className="flex-1 lux-gradient text-sm"
            onClick={() => setIsAddModalOpen(true)}
          >
            <Plus className="h-4 w-4 mr-1 sm:mr-2" />
            <span className="hidden xs:inline">Add</span>
            <span className="xs:hidden">+</span>
          </Button>
          <Button
            variant="outline"
            className="flex-1 text-sm"
            onClick={() => setIsDiscoverModalOpen(true)}
          >
            <Search className="h-4 w-4 mr-1 sm:mr-2" />
            <span className="hidden xs:inline">Discover</span>
            <span className="xs:hidden">🔍</span>
          </Button>
        </div>

        {/* Select All */}
        <div className="flex items-center justify-between">
          <button
            onClick={handleSelectAll}
            className="flex items-center gap-2 text-sm font-medium text-foreground hover:text-primary transition-colors"
          >
            {isAllSelected ? (
              <CheckSquare className="h-4 w-4" />
            ) : (
              <Square className="h-4 w-4" />
            )}
            Select All ({selectedSources.length})
          </button>
          <Badge variant="secondary" className="text-xs">
            {sources.length} sources
          </Badge>
        </div>
      </div>

      {/* Sources List */}
      <div className="flex-1 overflow-y-auto px-3 py-2 sm:px-4 sm:py-3">
        <div className="space-y-2">
          {filteredSources.map((source) => (
            <div
              key={source.id}
              className={`group relative p-3 rounded-lg border transition-[border,box-shadow,transform] duration-200 hover:shadow-sm hover:-translate-y-0.5 cursor-pointer ${
                source.isSelected
                  ? "border-blue-500 bg-blue-500/10 shadow-lg dark:border-blue-400 dark:bg-blue-400/15 dark:shadow-blue-400/20"
                  : "border-border bg-background hover:border-blue-400/60 dark:hover:border-blue-400 dark:hover:bg-blue-400/8 dark:hover:shadow-md dark:hover:shadow-blue-400/10"
              }`}
              onClick={() => handleSourceToggle(source.id)}
            >
              <div className="flex items-start gap-3">
                {/* Selection Checkbox */}
                <div className="mt-0.5 shrink-0">
                  {source.isSelected ? (
                    <CheckSquare className="h-4 w-4 text-blue-500 dark:text-blue-400" />
                  ) : (
                    <Square className="h-4 w-4 text-muted-foreground group-hover:text-blue-500 dark:group-hover:text-blue-400" />
                  )}
                </div>

                {/* Source Info */}
                <div className="flex-1 min-w-0 pr-2">
                  <div className="flex items-center gap-2 mb-1">
                    <div className="shrink-0 text-muted-foreground">
                      {getSourceIcon(source.type)}
                    </div>
                    <h3 className="font-medium text-sm truncate flex-1">
                      {source.name}
                    </h3>
                  </div>

                  {source.description && (
                    <p className="text-xs text-muted-foreground line-clamp-2 mb-2 leading-relaxed">
                      {source.description}
                    </p>
                  )}

                  <div className="flex items-center justify-between gap-2">
                    <Badge
                      className={`text-xs px-2 py-0.5 shrink-0 ${getStatusColor(
                        source.status
                      )}`}
                    >
                      {source.status}
                    </Badge>
                    <span className="text-xs text-muted-foreground truncate ml-auto">
                      {new Date(source.lastUpdated).toLocaleDateString(
                        "en-US",
                        {
                          month: "short",
                          day: "numeric",
                        }
                      )}
                    </span>
                  </div>
                </div>

                {/* More Options */}
                <Button
                  variant="ghost"
                  size="sm"
                  className="opacity-0 group-hover:opacity-100 transition-opacity shrink-0 h-6 w-6 p-0 mt-0.5"
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
            <div className="text-center py-8 text-muted-foreground">
              {searchQuery
                ? "No sources match your search"
                : "No sources added yet"}
            </div>
          )}
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
    </div>
  );
}
