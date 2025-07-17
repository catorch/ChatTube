"use client";

import { useState } from "react";
import { useAppDispatch, useAppSelector } from "@/lib/hooks";
import { addSourceFromUrl } from "@/lib/features/sources/sourcesSlice";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Youtube,
  FileText,
  Globe,
  Mic,
  Upload,
  Link,
  Sparkles,
  AlertCircle,
} from "lucide-react";

interface AddSourceModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const sourceTypes = [
  {
    id: "youtube",
    name: "YouTube Video",
    icon: Youtube,
    description: "Add a YouTube video URL",
  },
  {
    id: "podcast",
    name: "Podcast",
    icon: Mic,
    description: "Add a podcast episode URL",
  },
  {
    id: "document",
    name: "Document",
    icon: FileText,
    description: "Upload a document file",
  },
  {
    id: "website",
    name: "Website",
    icon: Globe,
    description: "Add a website URL",
  },
];

export function AddSourceModal({ isOpen, onClose }: AddSourceModalProps) {
  const dispatch = useAppDispatch();
  const { isLoading, error } = useAppSelector((state) => state.sources);
  const [selectedType, setSelectedType] = useState<string>("youtube");
  const [url, setUrl] = useState("");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!url.trim()) return;

    try {
      if (selectedType === "youtube") {
        // Use the real backend API for YouTube videos
        await dispatch(addSourceFromUrl(url.trim())).unwrap();

        // Reset form and close modal on success
        setUrl("");
        setName("");
        setDescription("");
        setSelectedType("youtube");
        onClose();
      } else {
        // For other types, show a message that they're not implemented yet
        alert(
          `${selectedType} sources are not implemented yet. Only YouTube videos are supported currently.`
        );
      }
    } catch (error) {
      // Error is handled by Redux and displayed in the UI
      console.error("Failed to add source:", error);
    }
  };

  const resetForm = () => {
    setUrl("");
    setName("");
    setDescription("");
    setSelectedType("youtube");
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <div className="w-8 h-8 lux-gradient rounded-lg flex items-center justify-center shadow-[var(--elev-1)]">
              <Sparkles className="h-4 w-4 text-white" />
            </div>
            Add New Source
          </DialogTitle>
          <DialogDescription>
            Add a new source to your ChatTube library. Currently, only YouTube
            videos are fully supported.
          </DialogDescription>
        </DialogHeader>

        {error && (
          <div className="flex items-center gap-2 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-700 dark:text-red-300 text-sm">
            <AlertCircle className="h-4 w-4 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Source Type Selection */}
          <div className="space-y-3">
            <Label className="text-sm font-medium">Source Type</Label>
            <div className="grid grid-cols-2 gap-3">
              {sourceTypes.map((type) => (
                <button
                  key={type.id}
                  type="button"
                  onClick={() => setSelectedType(type.id)}
                  className={`p-4 rounded-lg border text-left transition-all ${
                    selectedType === type.id
                      ? "border-primary bg-primary/5 shadow-sm"
                      : "border-border hover:border-primary/50"
                  } ${type.id !== "youtube" ? "opacity-50" : ""}`}
                  disabled={type.id !== "youtube"}
                >
                  <div className="flex items-center gap-3">
                    <type.icon className="h-5 w-5 text-primary" />
                    <div>
                      <div className="font-medium text-sm">{type.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {type.description}
                        {type.id !== "youtube" && " (Coming Soon)"}
                      </div>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* URL Input */}
          <div className="space-y-2">
            <Label htmlFor="url" className="text-sm font-medium">
              {selectedType === "document" ? "File Upload" : "YouTube URL"}
            </Label>
            {selectedType === "document" ? (
              <div className="border-2 border-dashed border-border rounded-lg p-8 text-center opacity-50">
                <Upload className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                <p className="text-sm text-muted-foreground mb-2">
                  File upload coming soon
                </p>
                <Button type="button" variant="outline" size="sm" disabled>
                  Choose File
                </Button>
              </div>
            ) : (
              <div className="relative">
                <Link className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="url"
                  type="url"
                  placeholder="https://www.youtube.com/watch?v=..."
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  className="pl-10"
                  required
                  disabled={selectedType !== "youtube"}
                />
              </div>
            )}
          </div>

          {/* Info about YouTube processing */}
          {selectedType === "youtube" && (
            <div className="p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg text-blue-700 dark:text-blue-300 text-sm">
              <p className="font-medium mb-1">YouTube Video Processing</p>
              <p>
                The video will be downloaded, transcribed using Whisper AI, and
                processed for intelligent chat. This may take a few minutes
                depending on video length.
              </p>
            </div>
          )}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={handleClose}
              disabled={isLoading}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              className="lux-gradient"
              disabled={isLoading || !url.trim() || selectedType !== "youtube"}
            >
              {isLoading ? "Processing..." : "Add Source"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
