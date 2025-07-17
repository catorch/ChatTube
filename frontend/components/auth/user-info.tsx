"use client";

import { useAppDispatch, useAppSelector } from "@/lib/hooks";
import { logout } from "@/lib/features/auth/authSlice";
import { Button } from "@/components/ui/button";

export function UserInfo() {
  const dispatch = useAppDispatch();
  const { user, isAuthenticated, isLoading } = useAppSelector(
    (state) => state.auth
  );

  if (!isAuthenticated || !user) {
    return null;
  }

  const handleLogout = () => {
    dispatch(logout());
  };

  return (
    <div className="flex items-center gap-4 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
      <div className="flex-1">
        <p className="text-sm font-medium text-gray-900 dark:text-white">
          Welcome, {user.firstName || user.email}!
        </p>
        <p className="text-xs text-gray-500 dark:text-gray-400">{user.email}</p>
      </div>
      <div className="flex gap-2">
        <Button
          onClick={handleLogout}
          disabled={isLoading}
          variant="outline"
          size="sm"
        >
          {isLoading ? "Logging out..." : "Logout"}
        </Button>
      </div>
    </div>
  );
}
