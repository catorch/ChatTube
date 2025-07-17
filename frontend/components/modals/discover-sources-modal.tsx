"use client";

import { useState } from "react";
import { useAppDispatch } from "@/lib/hooks";
import { addSource } from "@/lib/features/sources/sourcesSlice";
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
  Mic,
  Plus,
  ExternalLink,
  Clock,
  Eye,
} from "lucide-react";

interface DiscoverSourcesModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const mockDiscoverSources = [
  {
    id: "d1",
    name: "The Complete Guide to React Server Components",
    type: "youtube" as const,
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
    name: "Advanced TypeScript Patterns",
    type: "podcast" as const,
    url: "https://podcast.com/episode/advanced-ts",
    description: "Deep dive into advanced TypeScript patterns and techniques",
    views: "45K listens",
    duration: "52:15",
    channel: "TypeScript Weekly",
    trending: false,
  },
  {
    id: "d3",
    name: "Web Performance Optimization 2024",
    type: "website" as const,
    url: "https://web.dev/performance-2024",
    description: "Latest techniques for optimizing web performance",
    views: "89K reads",
    duration: "15 min read",
    channel: "web.dev",
    trending: true,
  },
  {
    id: "d4",
    name: "Modern CSS Layout Techniques",
    type: "document" as const,
    url: "https://css-tricks.com/modern-layout",
    description: "Comprehensive guide to modern CSS layout methods",
    views: "67K reads",
    duration: "20 min read",
    channel: "CSS-Tricks",
    trending: false,
  },
];

const categories = [
  { id: "trending", name: "Trending", icon: TrendingUp },
  { id: "youtube", name: "YouTube", icon: Youtube },
  { id: "podcasts", name: "Podcasts", icon: Mic },
  { id: "articles", name: "Articles", icon: FileText },
  { id: "websites", name: "Websites", icon: Globe },
];

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

export function DiscoverSourcesModal({
  isOpen,
  onClose,
}: DiscoverSourcesModalProps) {
  const dispatch = useAppDispatch();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("trending");
  const [isLoading, setIsLoading] = useState(false);

  const filteredSources = mockDiscoverSources.filter((source) => {
    const matchesSearch =
      source.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      source.description.toLowerCase().includes(searchQuery.toLowerCase());

    if (selectedCategory === "trending") {
      return matchesSearch && source.trending;
    }

    return (
      matchesSearch &&
      ((selectedCategory === "youtube" && source.type === "youtube") ||
        (selectedCategory === "podcasts" && source.type === "podcast") ||
        (selectedCategory === "articles" && source.type === "document") ||
        (selectedCategory === "websites" && source.type === "website"))
    );
  });

  const handleAddSource = (source: (typeof mockDiscoverSources)[0]) => {
    setIsLoading(true);

    // Simulate API call
    setTimeout(() => {
      const newSource = {
        id: Date.now().toString(),
        name: source.name,
        type: source.type,
        url: source.url,
        description: source.description,
        isSelected: false,
        lastUpdated: new Date().toISOString(),
        status: "processing" as const,
      };

      dispatch(addSource(newSource));
      setIsLoading(false);
    }, 500);
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
            Browse and add popular sources from across the web
          </DialogDescription>
        </DialogHeader>

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
                        {getSourceIcon(source.type)}
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
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleAddSource(source)}
                              disabled={isLoading}
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
      </DialogContent>
    </Dialog>
  );
}
