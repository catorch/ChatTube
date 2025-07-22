import { motion, AnimatePresence } from "framer-motion";
import {
  Plus,
  Search,
  CheckSquare,
  Square,
  Globe,
  RefreshCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface SourcesHeaderProps {
  chatId: string | null;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  onAddSource: () => void;
  onDiscoverSources: () => void;
  onRefresh: () => void;
  onSelectAll: () => void;
  isLoading: boolean;
  processingCount: number;
  selectedCount: number;
  totalCount: number;
  isAllSelected: boolean;
}

export function SourcesHeader({
  chatId,
  searchQuery,
  onSearchChange,
  onAddSource,
  onDiscoverSources,
  onRefresh,
  onSelectAll,
  isLoading,
  processingCount,
  selectedCount,
  totalCount,
  isAllSelected,
}: SourcesHeaderProps) {
  return (
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
                <Badge
                  variant="secondary"
                  className="text-xs bg-blue-50 border-blue-200 text-blue-700 dark:bg-blue-950 dark:border-blue-800 dark:text-blue-300"
                >
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
        <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
          <Button
            size="icon"
            variant="ghost"
            onClick={onRefresh}
            disabled={isLoading}
            className="h-9 w-9 rounded-lg hover:bg-primary/10 transition-all duration-200"
            title="Refresh sources"
          >
            <motion.div
              animate={isLoading ? { rotate: 360 } : {}}
              transition={
                isLoading
                  ? { duration: 1, repeat: Infinity, ease: "linear" }
                  : {}
              }
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
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground/70 group-focus-within:text-primary transition-colors duration-200 z-10" />
            <input
              type="text"
              placeholder="Search sources..."
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              className="w-full pl-10 pr-4 py-3 text-sm border-2 border-border/50 rounded-xl focus:outline-none focus:border-primary/50 bg-background/95 backdrop-blur-sm transition-all duration-200 relative z-10 placeholder:text-muted-foreground/60"
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
                onClick={onAddSource}
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
                className="w-full text-sm font-medium border-2 border-primary/20 hover:border-primary/40 hover:bg-primary/5 transition-all duration-200"
                onClick={onDiscoverSources}
                disabled={!chatId}
              >
                <Search className="h-4 w-4 mr-2" />
                <span>Discover</span>
              </Button>
            </motion.div>
          </div>

          {/* Enhanced Select All */}
          <AnimatePresence>
            {totalCount > 0 && (
              <motion.div
                className="flex items-center justify-between"
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
              >
                <motion.div
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={onSelectAll}
                    className="text-xs h-8 px-3 rounded-lg hover:bg-primary/10 transition-all duration-200"
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
                  {selectedCount > 0 && (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.8 }}
                    >
                      <Badge
                        variant="secondary"
                        className="text-xs bg-primary/10 border-primary/20 text-primary shadow-sm"
                      >
                        <span className="w-1.5 h-1.5 bg-primary rounded-full mr-1.5" />
                        {selectedCount} selected
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
  );
}
