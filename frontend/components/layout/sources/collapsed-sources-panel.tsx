import { motion, AnimatePresence } from "framer-motion";
import { Plus, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface CollapsedSourcesPanelProps {
  chatId: string | null;
  completedCount: number;
  processingCount: number;
  onAddSource: () => void;
}

export function CollapsedSourcesPanel({
  chatId,
  completedCount,
  processingCount,
  onAddSource,
}: CollapsedSourcesPanelProps) {
  return (
    <motion.div
      className="w-14 h-full bg-gradient-to-b from-surface-1 to-surface-2/50 border-r border-border/70 flex flex-col items-center py-6 gap-3 backdrop-blur-sm"
      initial={{ width: 0, opacity: 0 }}
      animate={{ width: 56, opacity: 1 }}
      transition={{ duration: 0.3, ease: "easeOut" }}
    >
      <motion.div whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.95 }}>
        <Button
          size="icon"
          variant="default"
          onClick={onAddSource}
          className="h-9 w-9 lux-gradient shadow-lg hover:shadow-xl transition-all duration-200"
          disabled={!chatId}
          title="Add Source"
        >
          <Plus className="h-4 w-4 text-white" />
        </Button>
      </motion.div>

      <AnimatePresence>
        {completedCount > 0 && (
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
