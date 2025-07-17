import { apiClient } from "../client";
import { VideosResponse, VideoResponse, VideosQuery } from "../types";

export const videosApi = {
  /**
   * Get all videos with pagination and filtering
   */
  async getVideos(query: VideosQuery = {}): Promise<VideosResponse> {
    const searchParams = new URLSearchParams();

    if (query.page) searchParams.append("page", query.page.toString());
    if (query.limit) searchParams.append("limit", query.limit.toString());
    if (query.status) searchParams.append("status", query.status);

    const queryString = searchParams.toString();
    const endpoint = `/videos${queryString ? `?${queryString}` : ""}`;

    return apiClient.get<VideosResponse>(endpoint);
  },

  /**
   * Get a specific video by videoId
   */
  async getVideo(videoId: string): Promise<VideoResponse> {
    return apiClient.get<VideoResponse>(`/videos/${videoId}`);
  },

  /**
   * Process a new video from YouTube URL
   */
  async processVideo(videoUrl: string): Promise<VideoResponse> {
    return apiClient.post<VideoResponse>("/videos/process", { videoUrl });
  },

  /**
   * Search video chunks for RAG
   */
  async searchVideoChunks(query: string, videoId?: string, limit?: number) {
    return apiClient.post("/videos/search", {
      query,
      videoId,
      limit,
    });
  },
};
