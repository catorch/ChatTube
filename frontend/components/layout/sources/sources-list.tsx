import { motion, AnimatePresence } from "framer-motion";
import { Plus, Globe, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FrontendSource } from "@/lib/api/types";
import { SourceItem } from "./source-item";

interface SourcesListProps {
  chatId: string | null;
  sources: FrontendSource[];
  selectedSourceIds: string[];
  isLoading: boolean;
  error: string | null;
  onSourceToggle: (sourceId: string) => void;
  onSourceRemove: (sourceId: string) => void;
  onAddSource: () => void;
  onRefresh: () => void;
}

function LoadingSkeleton() {
  return (
    <div className="h-full overflow-y-auto p-4 space-y-2">
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
  );
}

function EmptySourcesState({ onAddSource }: { onAddSource: () => void }) {
  return (
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
        <h3 className="text-xl font-bold mb-3 text-foreground">
          No sources yet
        </h3>
        <p className="text-sm text-muted-foreground mb-6 leading-relaxed max-w-xs">
          Add YouTube videos, PDFs, web pages, or other sources to unlock
          AI-powered insights
        </p>
        <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
          <Button
            onClick={onAddSource}
            className="lux-gradient shadow-lg hover:shadow-xl transition-all duration-200 px-6"
          >
            <Plus className="h-4 w-4 mr-2" />
            Add First Source
          </Button>
        </motion.div>
      </div>
    </motion.div>
  );
}

function NoSelectionsState() {
  return (
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
        <h3 className="text-lg font-semibold mb-2 text-foreground">
          Ready to Add Sources
        </h3>
        <p className="text-sm text-muted-foreground leading-relaxed">
          Create or select a chat to start adding your content sources
        </p>
      </div>
    </motion.div>
  );
}

function ErrorState({
  error,
  onRefresh,
}: {
  error: string;
  onRefresh: () => void;
}) {
  return (
    <div className="h-full flex items-center justify-center p-4">
      <div className="text-center">
        <AlertCircle className="h-8 w-8 mx-auto mb-2 text-red-500" />
        <p className="text-sm text-red-600 mb-2">Failed to load sources</p>
        <Button size="sm" variant="outline" onClick={onRefresh}>
          Try Again
        </Button>
      </div>
    </div>
  );
}

export function SourcesList({
  chatId,
  sources,
  selectedSourceIds,
  isLoading,
  error,
  onSourceToggle,
  onSourceRemove,
  onAddSource,
  onRefresh,
}: SourcesListProps) {
  // No chat selected
  if (!chatId) {
    return <NoSelectionsState />;
  }

  // Loading state (only show if no sources yet)
  if (isLoading && sources.length === 0) {
    return <LoadingSkeleton />;
  }

  // Error state
  if (error) {
    return <ErrorState error={error} onRefresh={onRefresh} />;
  }

  // Empty state
  if (sources.length === 0) {
    return <EmptySourcesState onAddSource={onAddSource} />;
  }

  // Sources list
  return (
    <div className="h-full overflow-y-auto p-4 space-y-3 scrollbar-visible">
      <AnimatePresence>
        {sources.map((source, index) => (
          <SourceItem
            key={source.id}
            source={source}
            isSelected={selectedSourceIds.includes(source.id)}
            onToggle={onSourceToggle}
            onRemove={onSourceRemove}
            animationDelay={index * 0.05}
          />
        ))}
      </AnimatePresence>
    </div>
  );
}
