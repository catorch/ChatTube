import { createSlice, PayloadAction, createAsyncThunk } from "@reduxjs/toolkit";
import { authApi } from "../../api/services/auth";
import { User, LoginRequest, SignupRequest } from "../../api/types";

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  isInitialized: boolean; // To track if we've checked auth status on app load
  error: string | null;
  showAuthModal: boolean;
  authModalMode: "login" | "signup";
}

const initialState: AuthState = {
  user: null,
  isAuthenticated: false,
  isLoading: false,
  isInitialized: false,
  error: null,
  showAuthModal: false,
  authModalMode: "login",
};

// Async thunks
export const login = createAsyncThunk(
  "auth/login",
  async (credentials: LoginRequest) => {
    const response = await authApi.login(credentials);
    return response.user;
  }
);

export const signup = createAsyncThunk(
  "auth/signup",
  async (userData: SignupRequest) => {
    const response = await authApi.signup(userData);
    return response.user;
  }
);

export const logout = createAsyncThunk("auth/logout", async () => {
  await authApi.logout();
});

export const checkAuth = createAsyncThunk("auth/checkAuth", async () => {
  const response = await authApi.checkAuth();
  return response.user;
});

const authSlice = createSlice({
  name: "auth",
  initialState,
  reducers: {
    setError: (state, action: PayloadAction<string | null>) => {
      state.error = action.payload;
    },
    clearError: (state) => {
      state.error = null;
    },
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
  },
  extraReducers: (builder) => {
    // Check auth status
    builder
      .addCase(checkAuth.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(checkAuth.fulfilled, (state, action) => {
        state.isLoading = false;
        state.isInitialized = true;
        state.user = action.payload;
        state.isAuthenticated = true;
        state.error = null;
      })
      .addCase(checkAuth.rejected, (state) => {
        state.isLoading = false;
        state.isInitialized = true;
        state.user = null;
        state.isAuthenticated = false;
        state.error = null; // Don't show error for auth check failures
      })

      // Login
      .addCase(login.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(login.fulfilled, (state, action) => {
        state.isLoading = false;
        state.user = action.payload;
        state.isAuthenticated = true;
        state.showAuthModal = false;
        state.error = null;
      })
      .addCase(login.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.error.message || "Login failed";
      })

      // Signup
      .addCase(signup.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(signup.fulfilled, (state, action) => {
        state.isLoading = false;
        state.user = action.payload;
        state.isAuthenticated = true;
        state.showAuthModal = false;
        state.error = null;
      })
      .addCase(signup.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.error.message || "Signup failed";
      })

      // Logout
      .addCase(logout.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(logout.fulfilled, (state) => {
        state.isLoading = false;
        state.user = null;
        state.isAuthenticated = false;
        state.error = null;
      })
      .addCase(logout.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.error.message || "Logout failed";
      });
  },
});

export const {
  setError,
  clearError,
  showAuthModal,
  hideAuthModal,
  switchAuthMode,
} = authSlice.actions;

export default authSlice.reducer;
