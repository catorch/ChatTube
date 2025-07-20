// Backend API response types

export interface ApiResponse<T> {
  status: "OK" | "ERROR";
  message?: string;
  error?: string;
}

// New Source types for generic sources
export interface Source {
  _id: string;
  userId: string;
  chatId: string;
  kind: "youtube" | "pdf" | "web" | "file";
  title?: string;
  url?: string;
  fileId?: string;
  metadata: {
    processingStatus?: "pending" | "processing" | "completed" | "failed";
    isProcessed?: boolean;
    errorMessage?: string;
    // YouTube specific metadata
    videoId?: string;
    channelName?: string;
    channelId?: string;
    duration?: number;
    uploadDate?: string;
    thumbnailUrl?: string;
    viewCount?: number;
    description?: string;
    // Processing metadata
    chunksCount?: number;
    embeddingsGenerated?: number;
    audioProcessingTime?: number;
    embeddingProcessingTime?: number;
    totalProcessingTime?: number;
    createdAt?: string;
    startedAt?: string;
    completedAt?: string;
    failedAt?: string;
    [key: string]: any;
  };
  createdAt: string;
  updatedAt: string;
}

// Legacy Video type (kept for backward compatibility if needed)
export interface Video {
  _id: string;
  videoId: string;
  title: string;
  description?: string;
  duration: number;
  uploadDate: string;
  channelName: string;
  channelId: string;
  thumbnailUrl?: string;
  viewCount: number;
  processingStatus: "processing" | "completed" | "failed";
  createdAt: string;
  updatedAt: string;
}

export interface VideosResponse extends ApiResponse<Video[]> {
  videos: Video[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
}

export interface VideoResponse extends ApiResponse<Video> {
  video: Video;
}

export interface VideosQuery {
  page?: number;
  limit?: number;
  status?: "processing" | "completed" | "failed";
}

// New Source-related types
export interface SourceCreateRequest {
  kind: "youtube" | "pdf" | "web" | "file";
  url?: string;
  title?: string;
  fileId?: string;
  metadata?: Record<string, any>;
}

export interface SourcesResponse extends ApiResponse<Source[]> {
  sources: Source[];
  message?: string;
  added?: number;
  existing?: number;
  processingNote?: string;
}

export interface SourceStatusResponse extends ApiResponse<any> {
  sourceStatus: {
    status: string;
    attempts: number;
    nextRunAt?: string;
    lastError?: string;
  };
}

// Auth types
export interface User {
  _id: string;
  id?: string; // For compatibility
  email: string;
  firstName?: string;
  lastName?: string;
  createdAt: string;
  updatedAt: string;
}

export interface AuthResponse extends ApiResponse<User> {
  user: User;
  token: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface SignupRequest {
  email: string;
  password: string;
  firstName?: string;
  lastName?: string;
}

export interface GoogleAuthRequest {
  token: string;
}

export interface AuthCheckResponse {
  status: string;
  isAuthenticated: boolean;
  user?: User;
}
