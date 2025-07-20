"use client";

import { useAppDispatch, useAppSelector } from "@/lib/hooks";
import { hideAuthModal } from "@/lib/features/auth/authSlice";
import { Auth } from "@/components/ui/auth-form";

export function AuthModal() {
  const dispatch = useAppDispatch();
  const { showAuthModal } = useAppSelector((state) => state.auth);

  const handleClose = () => {
    dispatch(hideAuthModal());
  };

  if (!showAuthModal) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 dark:bg-black/70">
      <Auth onClose={handleClose} />
    </div>
  );
}
