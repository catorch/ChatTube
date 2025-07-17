// Backend API response types

export interface ApiResponse<T> {
  status: "OK" | "ERROR";
  message?: string;
  error?: string;
}

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

export interface AuthResponse extends ApiResponse<User> {
  user: User;
  message: string;
  token?: string; // Optional since login includes it but signup doesn't
}

export interface AuthCheckResponse extends ApiResponse<User> {
  user: User;
  authenticated: boolean;
}
