import { createAction } from "@reduxjs/toolkit";

// Global reset action - extracted to break circular import
export const resetStore = createAction("global/resetStore");
