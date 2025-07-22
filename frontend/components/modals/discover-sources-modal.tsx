"use client";

import { useState } from "react";
import { useAppSelector } from "@/lib/hooks";
import { useAddSourcesMutation } from "@/lib/features/sources/sourcesSlice";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Search,
  TrendingUp,
  Youtube,
  FileText,
  Globe,
  Upload,
  Plus,
  ExternalLink,
  Clock,
  Eye,
  AlertCircle,
} from "lucide-react";

interface DiscoverSourcesModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const mockDiscoverSources = [
  {
    id: "d1",
    name: "The Complete Guide to React Server Components",
    kind: "youtube" as const,
    url: "https://youtube.com/watch?v=xyz789",
    thumbnail: "https://i.ytimg.com/vi/xyz789/maxresdefault.jpg",
    description:
      "Learn everything about React Server Components with practical examples",
    views: "125K views",
    duration: "45:30",
    channel: "React Conf",
    trending: true,
  },
  {
    id: "d2",
    name: "Understanding Microservices Architecture",
    kind: "youtube" as const,
    url: "https://youtube.com/watch?v=abc123",
    thumbnail: "https://i.ytimg.com/vi/abc123/maxresdefault.jpg",
    description: "Deep dive into microservices patterns and best practices",
    views: "89K views",
    duration: "32:15",
    channel: "Tech Insights",
    trending: true,
  },
  {
    id: "d3",
    name: "Modern CSS Layout Techniques",
    kind: "web" as const,
    url: "https://css-tricks.com/modern-css-layouts",
    description:
      "Comprehensive guide to CSS Grid, Flexbox, and Container Queries",
    views: "45K views",
    duration: "15 min read",
    channel: "CSS-Tricks",
    trending: false,
  },
  {
    id: "d4",
    name: "TypeScript Best Practices 2024",
    kind: "pdf" as const,
    url: "https://typescript-handbook.com/best-practices.pdf",
    description: "Essential TypeScript patterns for modern applications",
    views: "23K downloads",
    duration: "28 pages",
    channel: "TS Community",
    trending: false,
  },
  {
    id: "d5",
    name: "Project Documentation Template",
    kind: "file" as const,
    url: "https://example.com/project-template.docx",
    description: "Professional project documentation template for teams",
    views: "15K downloads",
    duration: "12 pages",
    channel: "PM Tools",
    trending: false,
  },
];

const categories = [
  { id: "trending", name: "Trending", icon: TrendingUp },
  { id: "youtube", name: "YouTube", icon: Youtube },
  { id: "web", name: "Articles", icon: Globe },
  { id: "pdf", name: "Documents", icon: FileText },
  { id: "file", name: "Files", icon: Upload },
];

const getSourceIcon = (kind: string) => {
  switch (kind) {
    case "youtube":
      return <Youtube className="h-4 w-4" />;
    case "pdf":
      return <FileText className="h-4 w-4" />;
    case "web":
      return <Globe className="h-4 w-4" />;
    case "file":
      return <Upload className="h-4 w-4" />;
    default:
      return <FileText className="h-4 w-4" />;
  }
};

export function DiscoverSourcesModal({
  isOpen,
  onClose,
}: DiscoverSourcesModalProps) {
  const { currentChatId } = useAppSelector((state) => state.chat);
  const [addSources, { isLoading: isAddingSource }] = useAddSourcesMutation();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("trending");

  const filteredSources = mockDiscoverSources.filter((source) => {
    const matchesSearch =
      source.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      source.description.toLowerCase().includes(searchQuery.toLowerCase());

    if (selectedCategory === "trending") {
      return matchesSearch && source.trending;
    }

    return (
      matchesSearch &&
      ((selectedCategory === "youtube" && source.kind === "youtube") ||
        (selectedCategory === "web" && source.kind === "web") ||
        (selectedCategory === "pdf" && source.kind === "pdf") ||
        (selectedCategory === "file" && source.kind === "file"))
    );
  });

  const handleAddSource = async (source: (typeof mockDiscoverSources)[0]) => {
    if (!currentChatId) {
      alert("Please select a chat first before adding sources.");
      return;
    }

    // Allow YouTube videos and web pages for now
    const supportedTypes = ["youtube", "web"] as const;
    if (!supportedTypes.includes(source.kind as any)) {
      const kindName =
        source.kind.charAt(0).toUpperCase() + source.kind.slice(1);
      alert(
        `${kindName} sources are not yet implemented. Only YouTube videos and websites are currently supported.`
      );
      return;
    }

    try {
      const result = await addSources({
        chatId: currentChatId,
        sources: [
          {
            kind: source.kind,
            url: source.url,
            title: source.name,
            metadata: {
              description: source.description,
              channel: source.channel,
              views: source.views,
              duration: source.duration,
            },
          },
        ],
      });

      if ("error" in result) {
        throw new Error("Failed to add source");
      }

      // Close modal on success
      onClose();
    } catch (error) {
      console.error("Failed to add source:", error);
      // Error is handled by Redux and will show in UI
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[800px] h-[600px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Search className="h-5 w-5" />
            Discover Sources
          </DialogTitle>
          <DialogDescription>
            {currentChatId
              ? "Browse and add popular sources to your current chat"
              : "Please select a chat to add sources"}
          </DialogDescription>
        </DialogHeader>

        {!currentChatId ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <AlertCircle className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <h3 className="font-medium mb-2">No Chat Selected</h3>
              <p className="text-sm text-muted-foreground">
                Please create or select a chat to discover and add sources.
              </p>
            </div>
          </div>
        ) : (
          <div className="flex flex-1 overflow-hidden">
            {/* Sidebar */}
            <div className="w-48 border-r border-border pr-4">
              <div className="space-y-2">
                {categories.map((category) => (
                  <button
                    key={category.id}
                    onClick={() => setSelectedCategory(category.id)}
                    className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left transition-colors ${
                      selectedCategory === category.id
                        ? "bg-primary/10 text-primary"
                        : "text-muted-foreground hover:text-foreground hover:bg-muted"
                    }`}
                  >
                    <category.icon className="h-4 w-4" />
                    <span className="text-sm font-medium">{category.name}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Main Content */}
            <div className="flex-1 pl-4">
              {/* Search */}
              <div className="relative mb-4">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  type="text"
                  placeholder="Search sources..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>

              {/* Sources Grid */}
              <ScrollArea className="h-[400px]">
                <div className="space-y-4">
                  {filteredSources.map((source) => (
                    <div
                      key={source.id}
                      className="group p-4 rounded-lg border border-border hover:border-primary/50 transition-colors"
                    >
                      <div className="flex items-start gap-4">
                        <div className="flex-shrink-0 w-10 h-10 bg-gradient-to-br from-gray-100 to-gray-200 dark:from-gray-800 dark:to-gray-700 rounded-lg flex items-center justify-center">
                          {getSourceIcon(source.kind)}
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between mb-2">
                            <h3 className="font-medium text-sm line-clamp-1">
                              {source.name}
                            </h3>
                            <div className="flex items-center gap-2">
                              {source.trending && (
                                <Badge className="bg-gradient-to-r from-orange-500 to-red-500 text-white text-xs">
                                  Trending
                                </Badge>
                              )}
                              {source.kind !== "youtube" &&
                                source.kind !== "web" && (
                                  <Badge
                                    variant="secondary"
                                    className="text-xs"
                                  >
                                    Soon
                                  </Badge>
                                )}
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => handleAddSource(source)}
                                disabled={
                                  isAddingSource ||
                                  (source.kind !== "youtube" &&
                                    source.kind !== "web")
                                }
                                className="opacity-0 group-hover:opacity-100 transition-opacity"
                              >
                                <Plus className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>

                          <p className="text-xs text-muted-foreground line-clamp-2 mb-3">
                            {source.description}
                          </p>

                          <div className="flex items-center gap-4 text-xs text-muted-foreground">
                            <div className="flex items-center gap-1">
                              <Eye className="h-3 w-3" />
                              {source.views}
                            </div>
                            <div className="flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {source.duration}
                            </div>
                            <div className="flex items-center gap-1">
                              <span>{source.channel}</span>
                              <ExternalLink className="h-3 w-3" />
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}

                  {filteredSources.length === 0 && (
                    <div className="text-center py-8 text-muted-foreground">
                      <Search className="h-12 w-12 mx-auto mb-4 opacity-50" />
                      <p>No sources found matching your criteria</p>
                    </div>
                  )}
                </div>
              </ScrollArea>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
