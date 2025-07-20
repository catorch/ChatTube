const logger = (store: any) => (next: any) => (action: any) => {
  // If action is a function (i.e., a thunk), just pass it along
  if (typeof action === "function") {
    return next(action);
  }

  // Only log in development mode
  if (process.env.NODE_ENV === "development") {
    // Log regular actions
    console.group(action.type);
    console.log("The action: ", action);
    const result = next(action);
    console.log("The new state: ", store.getState());
    console.groupEnd();
    return result;
  }

  // In production, just pass the action through
  return next(action);
};

export default logger;
