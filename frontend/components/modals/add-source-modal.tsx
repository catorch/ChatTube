"use client";

import { useState } from "react";
import { useAppSelector } from "@/lib/hooks";
import { useAddSourcesMutation } from "@/lib/api/services/sources";
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
  Upload,
  Link,
  Sparkles,
  AlertCircle,
  Loader2,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";

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
    placeholder: "https://www.youtube.com/watch?v=...",
    available: true,
  },
  {
    id: "pdf",
    name: "PDF Document",
    icon: FileText,
    description: "Add a PDF document URL",
    placeholder: "https://example.com/document.pdf",
    available: false,
  },
  {
    id: "web",
    name: "Website",
    icon: Globe,
    description: "Add a website URL",
    placeholder: "https://example.com/article",
    available: true,
  },
  {
    id: "file",
    name: "File Upload",
    icon: Upload,
    description: "Upload a file",
    placeholder: "Select a file to upload",
    available: false,
  },
];

export function AddSourceModal({ isOpen, onClose }: AddSourceModalProps) {
  const { currentChatId } = useAppSelector((state) => state.chat);
  const [addSources, { isLoading: isAddingSource, error: addSourceError }] =
    useAddSourcesMutation();

  const [selectedType, setSelectedType] = useState<string>("youtube");
  const [url, setUrl] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");

  const selectedSourceType = sourceTypes.find(
    (type) => type.id === selectedType
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!currentChatId) {
      alert("No chat selected. Please create or select a chat first.");
      return;
    }

    if (!url.trim() && selectedType !== "file") {
      return;
    }

    try {
      const sourceRequest = {
        kind: selectedType as "youtube" | "pdf" | "web" | "file",
        url: url.trim() || undefined,
        title: title.trim() || undefined,
        metadata: description.trim()
          ? { description: description.trim() }
          : undefined,
      };

      await addSources({
        chatId: currentChatId,
        sources: [sourceRequest],
      }).unwrap();

      // Reset form and close modal on success
      setUrl("");
      setTitle("");
      setDescription("");
      setSelectedType("youtube");
      onClose();
    } catch (error) {
      // Error is handled by Redux and displayed in the UI
      console.error("Failed to add source:", error);
    }
  };

  const resetForm = () => {
    setUrl("");
    setTitle("");
    setDescription("");
    setSelectedType("youtube");
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const isFormValid = () => {
    if (selectedType === "file") {
      return false; // File upload not implemented yet
    }
    return url.trim().length > 0;
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Add Source to Chat
          </DialogTitle>
          <DialogDescription>
            {currentChatId
              ? "Add a new source to this chat conversation"
              : "Please create or select a chat first"}
          </DialogDescription>
        </DialogHeader>

        {!currentChatId ? (
          <div className="flex items-center gap-3 p-4 rounded-lg bg-yellow-50 border border-yellow-200 text-yellow-800">
            <AlertCircle className="h-5 w-5 flex-shrink-0" />
            <div>
              <p className="font-medium">No Chat Selected</p>
              <p className="text-sm">
                Please create a new chat or select an existing one before adding
                sources.
              </p>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Source Type Selection */}
            <div className="space-y-3">
              <Label className="text-sm font-medium">Source Type</Label>
              <div className="grid grid-cols-2 gap-3">
                {sourceTypes.map((type) => {
                  const Icon = type.icon;
                  const isSelected = selectedType === type.id;

                  return (
                    <div
                      key={type.id}
                      className={`relative p-3 rounded-lg border-2 cursor-pointer transition-all ${
                        isSelected
                          ? "border-primary bg-primary/5"
                          : "border-border hover:border-primary/50"
                      } ${
                        !type.available ? "opacity-50 cursor-not-allowed" : ""
                      }`}
                      onClick={() => type.available && setSelectedType(type.id)}
                    >
                      <div className="flex items-center gap-3">
                        <Icon
                          className={`h-5 w-5 ${
                            isSelected
                              ? "text-primary"
                              : "text-muted-foreground"
                          }`}
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p
                              className={`font-medium text-sm ${
                                isSelected ? "text-primary" : ""
                              }`}
                            >
                              {type.name}
                            </p>
                            {!type.available && (
                              <Badge variant="secondary" className="text-xs">
                                Soon
                              </Badge>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground mt-1">
                            {type.description}
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* URL Input */}
            {selectedSourceType && selectedType !== "file" && (
              <div className="space-y-2">
                <Label htmlFor="url" className="text-sm font-medium">
                  {selectedType === "youtube" ? "YouTube URL" : "URL"}
                </Label>
                <div className="relative">
                  <Link className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="url"
                    type="url"
                    placeholder={selectedSourceType.placeholder}
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    className="pl-10"
                    disabled={!selectedSourceType.available}
                    required
                  />
                </div>
              </div>
            )}

            {/* Title Input (Optional) */}
            <div className="space-y-2">
              <Label htmlFor="title" className="text-sm font-medium">
                Title (Optional)
              </Label>
              <Input
                id="title"
                placeholder="Custom title for this source"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                disabled={!selectedSourceType?.available}
              />
            </div>

            {/* Description Input (Optional) */}
            <div className="space-y-2">
              <Label htmlFor="description" className="text-sm font-medium">
                Description (Optional)
              </Label>
              <Textarea
                id="description"
                placeholder="Add a description or notes about this source"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                disabled={!selectedSourceType?.available}
              />
            </div>

            {/* Error Display */}
            {addSourceError && (
              <div className="flex items-start gap-3 p-3 rounded-lg bg-red-50 border border-red-200 text-red-800">
                <AlertCircle className="h-5 w-5 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium text-sm">Failed to add source</p>
                  <p className="text-sm">
                    {(() => {
                      if (!addSourceError) return "An error occurred";
                      if ("data" in addSourceError) {
                        return (
                          (addSourceError.data as any)?.message ||
                          "An error occurred"
                        );
                      }
                      if ("message" in addSourceError) {
                        return addSourceError.message || "An error occurred";
                      }
                      if ("error" in addSourceError) {
                        return addSourceError.error || "An error occurred";
                      }
                      return "An error occurred";
                    })()}
                  </p>
                </div>
              </div>
            )}

            {/* Not Available Notice */}
            {selectedSourceType && !selectedSourceType.available && (
              <div className="flex items-start gap-3 p-3 rounded-lg bg-blue-50 border border-blue-200 text-blue-800">
                <AlertCircle className="h-5 w-5 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium text-sm">Coming Soon</p>
                  <p className="text-sm">
                    {selectedSourceType.name} sources are not yet available.
                    Currently only YouTube videos and websites are supported.
                  </p>
                </div>
              </div>
            )}
          </form>
        )}

        <DialogFooter className="gap-3">
          <Button
            variant="outline"
            onClick={handleClose}
            disabled={isAddingSource}
          >
            Cancel
          </Button>
          {currentChatId && (
            <Button
              type="submit"
              onClick={handleSubmit}
              disabled={
                !isFormValid() ||
                isAddingSource ||
                !selectedSourceType?.available
              }
              className="min-w-[100px]"
            >
              {isAddingSource ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Adding...
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4 mr-2" />
                  Add Source
                </>
              )}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
