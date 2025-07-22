import { createSlice, PayloadAction } from "@reduxjs/toolkit";
import { api } from "../../api/base";
import {
  User,
  LoginRequest,
  SignupRequest,
  GoogleAuthRequest,
} from "../../api/types";
import { resetStore } from "../../types";

// Auth API Response Types
export interface AuthResponse {
  status: string;
  user: User;
  token: string;
  message?: string;
}

export interface AuthCheckResponse {
  status: string;
  user: User | null;
  isAuthenticated: boolean;
}

// Auth state interface
interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isInitialized: boolean;
  error: string | null;
  showAuthModal: boolean;
  authModalMode: "login" | "signup";
}

const initialState: AuthState = {
  user: null,
  token: null,
  isAuthenticated: false,
  isInitialized: false,
  error: null,
  showAuthModal: false,
  authModalMode: "login",
};

// RTK Query API for authentication
export const authApi = api.injectEndpoints({
  endpoints: (build) => ({
    // Login with credentials
    login: build.mutation<AuthResponse, LoginRequest>({
      query: (credentials) => ({
        url: "/auth/login",
        method: "POST",
        body: credentials,
      }),
      invalidatesTags: ["Auth"],
    }),

    // Register new user
    signup: build.mutation<AuthResponse, SignupRequest>({
      query: (userData) => ({
        url: "/auth/signup",
        method: "POST",
        body: userData,
      }),
      invalidatesTags: ["Auth"],
    }),

    // Google OAuth login
    loginWithGoogle: build.mutation<AuthResponse, GoogleAuthRequest>({
      query: (data) => ({
        url: "/auth/google",
        method: "POST",
        body: data,
      }),
      invalidatesTags: ["Auth"],
    }),

    // Logout user
    logout: build.mutation<{ status: string; message: string }, void>({
      query: () => ({
        url: "/auth/logout",
        method: "POST",
      }),
      invalidatesTags: ["Auth"],
    }),

    // Check authentication status
    checkAuth: build.query<AuthCheckResponse, void>({
      query: () => "/auth/me",
      providesTags: ["Auth"],
    }),
  }),
});

// Export RTK Query hooks
export const {
  useLoginMutation,
  useSignupMutation,
  useLoginWithGoogleMutation,
  useLogoutMutation,
  useCheckAuthQuery,
  useLazyCheckAuthQuery,
} = authApi;

// Auth slice for client-side state management
const authSlice = createSlice({
  name: "auth",
  initialState,
  reducers: {
    // Set user and token from successful auth
    setCredentials: (
      state,
      action: PayloadAction<{ user: User; token: string }>
    ) => {
      const { user, token } = action.payload;
      state.user = user;
      state.token = token;
      state.isAuthenticated = true;
      state.error = null;
      state.showAuthModal = false;
    },

    // Clear credentials on logout
    clearCredentials: (state) => {
      state.user = null;
      state.token = null;
      state.isAuthenticated = false;
      state.error = null;
    },

    // Set initialization status
    setInitialized: (state, action: PayloadAction<boolean>) => {
      state.isInitialized = action.payload;
    },

    // Error management
    setError: (state, action: PayloadAction<string | null>) => {
      state.error = action.payload;
    },
    clearError: (state) => {
      state.error = null;
    },

    // Auth modal management
    showAuthModal: (state, action: PayloadAction<"login" | "signup">) => {
      state.showAuthModal = true;
      state.authModalMode = action.payload;
      state.error = null;
    },
    hideAuthModal: (state) => {
      state.showAuthModal = false;
      state.error = null;
    },
    switchAuthMode: (state, action: PayloadAction<"login" | "signup">) => {
      state.authModalMode = action.payload;
      state.error = null;
    },

    // Handle token rehydration from persistence
    setAuthFromToken: (state) => {
      if (state.token && !state.isAuthenticated) {
        state.isAuthenticated = true;
        state.isInitialized = true;
      }
    },
  },
  extraReducers: (builder) => {
    // Handle global store reset
    builder.addCase(resetStore, () => {
      return initialState;
    });

    // Handle redux-persist REHYDRATE action
    builder.addMatcher(
      (action) => action.type === "persist/REHYDRATE",
      (state, action: any) => {
        if (action.payload?.auth?.token && !state.isAuthenticated) {
          state.isAuthenticated = true;
          state.isInitialized = true;
        } else if (!action.payload?.auth?.token) {
          state.isInitialized = true;
        }
      }
    );

    // Handle RTK Query auth mutations
    builder
      .addMatcher(authApi.endpoints.login.matchPending, (state) => {
        state.error = null;
      })
      .addMatcher(authApi.endpoints.login.matchFulfilled, (state, action) => {
        const { user, token } = action.payload;
        state.user = user;
        state.token = token;
        state.isAuthenticated = true;
        state.showAuthModal = false;
        state.error = null;
      })
      .addMatcher(authApi.endpoints.login.matchRejected, (state, action) => {
        state.error = action.error.message || "Login failed";
      })

      .addMatcher(authApi.endpoints.signup.matchPending, (state) => {
        state.error = null;
      })
      .addMatcher(authApi.endpoints.signup.matchFulfilled, (state, action) => {
        const { user, token } = action.payload;
        state.user = user;
        state.token = token;
        state.isAuthenticated = true;
        state.showAuthModal = false;
        state.error = null;
      })
      .addMatcher(authApi.endpoints.signup.matchRejected, (state, action) => {
        state.error = action.error.message || "Signup failed";
      })

      .addMatcher(authApi.endpoints.loginWithGoogle.matchPending, (state) => {
        state.error = null;
      })
      .addMatcher(
        authApi.endpoints.loginWithGoogle.matchFulfilled,
        (state, action) => {
          const { user, token } = action.payload;
          state.user = user;
          state.token = token;
          state.isAuthenticated = true;
          state.showAuthModal = false;
          state.error = null;
        }
      )
      .addMatcher(
        authApi.endpoints.loginWithGoogle.matchRejected,
        (state, action) => {
          state.error = action.error.message || "Google login failed";
        }
      )

      .addMatcher(authApi.endpoints.logout.matchFulfilled, (state) => {
        state.user = null;
        state.token = null;
        state.isAuthenticated = false;
        state.error = null;
      })
      .addMatcher(authApi.endpoints.logout.matchRejected, (state, action) => {
        // Still clear credentials even if API call fails
        state.user = null;
        state.token = null;
        state.isAuthenticated = false;
        state.error = null;
      })

      .addMatcher(
        authApi.endpoints.checkAuth.matchFulfilled,
        (state, action) => {
          state.isInitialized = true;
          if (action.payload.isAuthenticated && action.payload.user) {
            state.user = action.payload.user;
            state.isAuthenticated = true;
            state.error = null;
          } else {
            state.user = null;
            state.token = null;
            state.isAuthenticated = false;
          }
        }
      )
      .addMatcher(authApi.endpoints.checkAuth.matchRejected, (state) => {
        state.isInitialized = true;
        state.user = null;
        state.token = null;
        state.isAuthenticated = false;
        state.error = null;
      });
  },
});

// Export actions
export const {
  setCredentials,
  clearCredentials,
  setInitialized,
  setError,
  clearError,
  showAuthModal,
  hideAuthModal,
  switchAuthMode,
  setAuthFromToken,
} = authSlice.actions;

// Selectors
export const selectCurrentUser = (state: { auth: AuthState }) =>
  state.auth.user;
export const selectAuthToken = (state: { auth: AuthState }) => state.auth.token;
export const selectIsAuthenticated = (state: { auth: AuthState }) =>
  state.auth.isAuthenticated;
export const selectIsInitialized = (state: { auth: AuthState }) =>
  state.auth.isInitialized;
export const selectAuthError = (state: { auth: AuthState }) => state.auth.error;
export const selectShowAuthModal = (state: { auth: AuthState }) =>
  state.auth.showAuthModal;
export const selectAuthModalMode = (state: { auth: AuthState }) =>
  state.auth.authModalMode;

export default authSlice.reducer;
