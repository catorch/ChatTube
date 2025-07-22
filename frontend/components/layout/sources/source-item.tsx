import { motion, AnimatePresence } from "framer-motion";
import {
  CheckSquare,
  Square,
  MoreVertical,
  Clock,
  AlertCircle,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { FrontendSource } from "@/lib/api/types";
import { getSourceIcon, getStatusIcon, getStatusText } from "./utils";

interface SourceItemProps {
  source: FrontendSource;
  isSelected: boolean;
  onToggle: (sourceId: string) => void;
  onRemove: (sourceId: string) => void;
  animationDelay?: number;
}

export function SourceItem({
  source,
  isSelected,
  onToggle,
  onRemove,
  animationDelay = 0,
}: SourceItemProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10, scale: 0.98 }}
      transition={{
        duration: 0.2,
        delay: animationDelay,
        ease: "easeOut",
      }}
      whileHover={{
        y: -1,
        transition: { duration: 0.1 }
      }}
      className={`p-3 rounded-lg border cursor-pointer transition-all duration-150 group relative ${
        isSelected
          ? "border-primary/50 bg-primary/5 shadow-sm"
          : "border-border/40 hover:border-border hover:bg-muted/20"
      }`}
      onClick={() => onToggle(source.id)}
    >

      <div className="flex items-start gap-3">
        <div className="flex-shrink-0 mt-0.5">
          {isSelected ? (
            <CheckSquare className="h-4 w-4 text-primary" />
          ) : (
            <Square className="h-4 w-4 text-muted-foreground group-hover:text-foreground transition-colors" />
          )}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0 flex-1">
              {getSourceIcon(source.kind, "h-4 w-4")}
              <div className="min-w-0 flex-1">
                <h4 className="font-medium text-sm text-foreground truncate">
                  {source.title}
                </h4>
                <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                  <span className="capitalize">{source.kind}</span>
                  <span className="text-muted-foreground/60">•</span>
                  <span
                    className={`${
                      source.status === "completed"
                        ? "text-green-600 dark:text-green-400"
                        : source.status === "failed"
                        ? "text-red-600 dark:text-red-400"
                        : "text-blue-600 dark:text-blue-400"
                    }`}
                  >
                    {getStatusText(source.status)}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-1">
              <div className="flex items-center justify-center w-5 h-5">
                {getStatusIcon(source.status)}
              </div>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <MoreVertical className="h-3 w-3" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem
                    onClick={(e) => {
                      e.stopPropagation();
                      onRemove(source.id);
                    }}
                    className="text-red-600 focus:text-red-600"
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Remove
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>

          <div className="flex items-center justify-between mt-2">
            <div className="flex items-center gap-2">
              {source.metadata.chunksCount && (
                <Badge variant="secondary" className="text-xs">
                  {source.metadata.chunksCount} chunks
                </Badge>
              )}
              {source.metadata.duration && (
                <Badge variant="outline" className="text-xs">
                  <Clock className="w-3 h-3 mr-1" />
                  {Math.round(source.metadata.duration / 60)}m
                </Badge>
              )}
            </div>
          </div>

          {source.metadata.errorMessage && (
            <div className="mt-2 p-2 bg-red-50 border border-red-200 rounded dark:bg-red-950 dark:border-red-800">
              <div className="flex items-start gap-2">
                <AlertCircle className="h-3 w-3 text-red-600 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-red-700 dark:text-red-300">
                  {source.metadata.errorMessage}
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}
