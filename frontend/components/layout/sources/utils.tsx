import { motion } from "framer-motion";
import {
  Youtube,
  FileText,
  Globe,
  Upload,
  Loader2,
  Clock,
  CheckCircle,
  AlertCircle,
} from "lucide-react";

export const getSourceIcon = (kind: string, className?: string) => {
  const iconClass = className || "h-4 w-4";
  const iconProps = { className: iconClass };

  switch (kind) {
    case "youtube":
      return <Youtube {...iconProps} className={`${iconClass} text-red-500`} />;
    case "pdf":
      return (
        <FileText {...iconProps} className={`${iconClass} text-red-600`} />
      );
    case "web":
      return <Globe {...iconProps} className={`${iconClass} text-blue-500`} />;
    case "file":
      return (
        <Upload {...iconProps} className={`${iconClass} text-purple-500`} />
      );
    default:
      return (
        <FileText {...iconProps} className={`${iconClass} text-gray-500`} />
      );
  }
};

export const getStatusIcon = (status: string) => {
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

export const getStatusText = (status: string) => {
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
