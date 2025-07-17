import { apiClient } from "../client";
import {
  AuthResponse,
  AuthCheckResponse,
  LoginRequest,
  SignupRequest,
} from "../types";

export const authApi = {
  /**
   * Login user with email and password
   */
  async login(credentials: LoginRequest): Promise<AuthResponse> {
    return apiClient.post<AuthResponse>("/auth/login", credentials);
  },

  /**
   * Register new user account
   */
  async signup(userData: SignupRequest): Promise<AuthResponse> {
    return apiClient.post<AuthResponse>("/auth/signup", userData);
  },

  /**
   * Logout current user (clears auth cookie)
   */
  async logout(): Promise<{ status: string; message: string }> {
    return apiClient.post("/auth/logout");
  },

  /**
   * Check current authentication status
   */
  async checkAuth(): Promise<AuthCheckResponse> {
    return apiClient.get<AuthCheckResponse>("/auth/me");
  },
};
