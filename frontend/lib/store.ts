import { configureStore } from "@reduxjs/toolkit";
import { persistStore, persistReducer, createTransform } from "redux-persist";
import storage from "redux-persist/lib/storage";
import authReducer from "./features/auth/authSlice";
import chatReducer from "./features/chat/chatSlice";
import sourcesReducer from "./features/sources/sourcesSlice";
import { resetStore } from "./types";
import logger from "./middleware/logger";

// Transform for redux-persist (all slices now use ISO strings, so no date conversion needed)
const dateTransform = createTransform(
  // transform state on its way to being serialized and persisted
  (inboundState: any) => {
    return inboundState; // All data is already serializable
  },
  // transform state being rehydrated
  (outboundState: any) => {
    return outboundState; // All data uses ISO strings, no conversion needed
  }
);

// Persist config
const persistConfig = {
  key: "chattube-root",
  storage,
  // Only persist essential data, exclude loading states and errors
  whitelist: ["auth", "chat", "sources"],
  transforms: [dateTransform],
};

// Auth slice persist config - exclude loading states and modal state
const authPersistConfig = {
  key: "auth",
  storage,
  blacklist: ["isLoading", "error", "showAuthModal"],
  transforms: [dateTransform],
};

// Chat slice persist config - exclude loading states
const chatPersistConfig = {
  key: "chat",
  storage,
  blacklist: ["isLoading", "error"],
  transforms: [dateTransform],
};

// Sources slice persist config - exclude loading states
const sourcesPersistConfig = {
  key: "sources",
  storage,
  blacklist: [
    "isLoading",
    "error",
    "isAdding",
    "addError",
    "isRemoving",
    "removeError",
    "isSearching",
    "searchError",
    "statusLoading",
    "statusErrors",
  ],
  transforms: [dateTransform],
};

// Create persisted reducers
const persistedAuthReducer = persistReducer(authPersistConfig, authReducer);
const persistedChatReducer = persistReducer(chatPersistConfig, chatReducer);
const persistedSourcesReducer = persistReducer(
  sourcesPersistConfig,
  sourcesReducer
);

export const store = configureStore({
  reducer: {
    auth: persistedAuthReducer,
    chat: persistedChatReducer,
    sources: persistedSourcesReducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: {
        ignoredActions: [
          "persist/PERSIST",
          "persist/REHYDRATE",
          "chat/addMessage",
          "sources/addSource",
          "global/resetStore",
        ],
        // All date fields now use ISO strings, so no ignored paths needed
        ignoredPaths: [],
      },
    }),
  // .concat(logger),
});

export const persistor = persistStore(store);

// Function to completely reset the store and clear persisted data
export const clearStoreAndPersist = async () => {
  // Dispatch the global reset action
  store.dispatch(resetStore());

  // Clear all persisted data
  await persistor.purge();

  // Clear localStorage manually as well for any remaining data
  try {
    await storage.removeItem("persist:chattube-root");
    await storage.removeItem("persist:auth");
    await storage.removeItem("persist:chat");
  } catch (error) {
    console.warn("Error clearing storage:", error);
  }
};

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
