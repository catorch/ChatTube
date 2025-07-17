import { store } from "../store";
import { showAuthModal } from "../features/auth/authSlice";

let isShowingAuthModal = false;

export function handleAuthError(status: number) {
  if (status === 401 && !isShowingAuthModal) {
    isShowingAuthModal = true;
    store.dispatch(showAuthModal("login"));

    // Reset flag after a delay to allow subsequent 401s to trigger modal
    setTimeout(() => {
      isShowingAuthModal = false;
    }, 1000);
  }
}
