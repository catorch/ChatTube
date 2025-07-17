import { handleAuthError } from "./auth-interceptor";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000/api";

export class ApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.status = status;
    this.name = "ApiError";
  }
}

interface RequestConfig {
  method?: "GET" | "POST" | "PUT" | "DELETE" | "PATCH";
  headers?: Record<string, string>;
  body?: unknown;
}

class ApiClient {
  private baseUrl: string;

  constructor(baseUrl: string = API_BASE_URL) {
    this.baseUrl = baseUrl;
  }

  private async request<T>(
    endpoint: string,
    config: RequestConfig = {}
  ): Promise<T> {
    const { method = "GET", headers = {}, body } = config;

    const url = `${this.baseUrl}${endpoint}`;

    const requestHeaders: Record<string, string> = {
      "Content-Type": "application/json",
      ...headers,
    };

    const requestConfig: RequestInit = {
      method,
      headers: requestHeaders,
      credentials: "include", // Include cookies for authentication
    };

    if (body && method !== "GET") {
      requestConfig.body = JSON.stringify(body);
    }

    try {
      const response = await fetch(url, requestConfig);

      if (!response.ok) {
        let errorMessage = `HTTP ${response.status}: ${response.statusText}`;
        try {
          const errorData = await response.json();
          errorMessage = errorData.message || errorMessage;
        } catch {
          // If response isn't JSON, use the default error message
        }

        // Handle auth errors
        handleAuthError(response.status);

        throw new ApiError(errorMessage, response.status);
      }

      // Check if response has content
      const contentType = response.headers.get("content-type");
      if (contentType && contentType.includes("application/json")) {
        return await response.json();
      } else {
        return {} as T;
      }
    } catch (error) {
      if (error instanceof ApiError) {
        throw error;
      }
      throw new ApiError(
        error instanceof Error ? error.message : "Network error",
        0
      );
    }
  }

  async get<T>(endpoint: string, headers?: Record<string, string>): Promise<T> {
    return this.request<T>(endpoint, { method: "GET", headers });
  }

  async post<T>(
    endpoint: string,
    body?: unknown,
    headers?: Record<string, string>
  ): Promise<T> {
    return this.request<T>(endpoint, { method: "POST", body, headers });
  }

  async put<T>(
    endpoint: string,
    body?: unknown,
    headers?: Record<string, string>
  ): Promise<T> {
    return this.request<T>(endpoint, { method: "PUT", body, headers });
  }

  async patch<T>(
    endpoint: string,
    body?: unknown,
    headers?: Record<string, string>
  ): Promise<T> {
    return this.request<T>(endpoint, { method: "PATCH", body, headers });
  }

  async delete<T>(
    endpoint: string,
    headers?: Record<string, string>
  ): Promise<T> {
    return this.request<T>(endpoint, { method: "DELETE", headers });
  }
}

export const apiClient = new ApiClient();
