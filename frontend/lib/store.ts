import { configureStore } from "@reduxjs/toolkit";
import { persistStore, persistReducer, createTransform } from "redux-persist";
import storage from "redux-persist/lib/storage";
import authReducer from "./features/auth/authSlice";
import sourcesReducer from "./features/sources/sourcesSlice";
import chatReducer from "./features/chat/chatSlice";

// Transform to handle Date objects
const dateTransform = createTransform(
  // transform state on its way to being serialized and persisted
  (inboundState: any) => {
    return inboundState; // JSON.stringify handles Dates automatically
  },
  // transform state being rehydrated
  (outboundState: any) => {
    // Convert ISO date strings back to Date objects
    const convertDates = (obj: any): any => {
      if (obj === null || obj === undefined) return obj;

      if (
        typeof obj === "string" &&
        /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}.\d{3}Z$/.test(obj)
      ) {
        return new Date(obj);
      }

      if (Array.isArray(obj)) {
        return obj.map(convertDates);
      }

      if (typeof obj === "object") {
        const converted: any = {};
        for (const [key, value] of Object.entries(obj)) {
          converted[key] = convertDates(value);
        }
        return converted;
      }

      return obj;
    };

    return convertDates(outboundState);
  }
);

// Persist config
const persistConfig = {
  key: "chattube-root",
  storage,
  // Only persist essential data, exclude loading states and errors
  whitelist: ["auth", "sources", "chat"],
  transforms: [dateTransform],
};

// Auth slice persist config - exclude loading states and modal state
const authPersistConfig = {
  key: "auth",
  storage,
  blacklist: ["isLoading", "error", "showAuthModal"],
  transforms: [dateTransform],
};

// Sources slice persist config - exclude loading states
const sourcesPersistConfig = {
  key: "sources",
  storage,
  blacklist: ["isLoading", "error"],
  transforms: [dateTransform],
};

// Chat slice persist config - exclude loading states
const chatPersistConfig = {
  key: "chat",
  storage,
  blacklist: ["isLoading", "error"],
  transforms: [dateTransform],
};

// Create persisted reducers
const persistedAuthReducer = persistReducer(authPersistConfig, authReducer);
const persistedSourcesReducer = persistReducer(
  sourcesPersistConfig,
  sourcesReducer
);
const persistedChatReducer = persistReducer(chatPersistConfig, chatReducer);

export const store = configureStore({
  reducer: {
    auth: persistedAuthReducer,
    sources: persistedSourcesReducer,
    chat: persistedChatReducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: {
        ignoredActions: [
          "persist/PERSIST",
          "persist/REHYDRATE",
          "sources/fetchSources/fulfilled",
          "sources/addSourceFromUrl/fulfilled",
          "chat/addMessage",
        ],
        // Ignore Date objects in state - these are handled by redux-persist transforms
        ignoredPaths: [
          "sources.sources", // Array of sources with lastUpdated dates
          "chat.messages", // Array of messages with timestamp dates
          "auth.user.createdAt", // User creation date
          "auth.user.updatedAt", // User update date
        ],
      },
    }),
});

export const persistor = persistStore(store);

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
