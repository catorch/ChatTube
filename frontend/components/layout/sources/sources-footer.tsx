import { motion, AnimatePresence } from "framer-motion";

interface SourcesFooterProps {
  chatId: string | null;
  totalCount: number;
  completedCount: number;
}

export function SourcesFooter({
  chatId,
  totalCount,
  completedCount,
}: SourcesFooterProps) {
  if (!chatId || totalCount === 0) {
    return null;
  }

  return (
    <AnimatePresence>
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
              <span className="text-sm font-medium text-muted-foreground">
                {totalCount} total
              </span>
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
    </AnimatePresence>
  );
}
