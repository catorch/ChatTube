"use client";

import { useState } from "react";
import { useAppDispatch, useAppSelector } from "@/lib/hooks";
import {
  login,
  signup,
  hideAuthModal,
  switchAuthMode,
} from "@/lib/features/auth/authSlice";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function AuthModal() {
  const dispatch = useAppDispatch();
  const { showAuthModal, authModalMode, isLoading, error } = useAppSelector(
    (state) => state.auth
  );

  const [formData, setFormData] = useState({
    email: "",
    password: "",
    firstName: "",
    lastName: "",
  });

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData((prev) => ({
      ...prev,
      [e.target.name]: e.target.value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (authModalMode === "login") {
      dispatch(
        login({
          email: formData.email,
          password: formData.password,
        })
      );
    } else {
      dispatch(
        signup({
          email: formData.email,
          password: formData.password,
          firstName: formData.firstName || undefined,
          lastName: formData.lastName || undefined,
        })
      );
    }
  };

  const handleSwitchMode = () => {
    dispatch(switchAuthMode(authModalMode === "login" ? "signup" : "login"));
    setFormData({ email: "", password: "", firstName: "", lastName: "" });
  };

  const handleClose = () => {
    dispatch(hideAuthModal());
    setFormData({ email: "", password: "", firstName: "", lastName: "" });
  };

  if (!showAuthModal) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white dark:bg-gray-900 rounded-lg shadow-xl w-full max-w-md mx-4 p-6">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
            {authModalMode === "login" ? "Sign In" : "Create Account"}
          </h2>
          <button
            onClick={handleClose}
            className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
          >
            <svg
              className="w-6 h-6"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {authModalMode === "signup" && (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="firstName">First Name</Label>
                <Input
                  id="firstName"
                  name="firstName"
                  type="text"
                  value={formData.firstName}
                  onChange={handleInputChange}
                  className="mt-1"
                  placeholder="John"
                />
              </div>
              <div>
                <Label htmlFor="lastName">Last Name</Label>
                <Input
                  id="lastName"
                  name="lastName"
                  type="text"
                  value={formData.lastName}
                  onChange={handleInputChange}
                  className="mt-1"
                  placeholder="Doe"
                />
              </div>
            </div>
          )}

          <div>
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              name="email"
              type="email"
              required
              value={formData.email}
              onChange={handleInputChange}
              className="mt-1"
              placeholder="john@example.com"
            />
          </div>

          <div>
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              name="password"
              type="password"
              required
              value={formData.password}
              onChange={handleInputChange}
              className="mt-1"
              placeholder="••••••••"
              minLength={8}
            />
            {authModalMode === "signup" && (
              <p className="text-sm text-gray-500 mt-1">
                Password must be at least 8 characters long
              </p>
            )}
          </div>

          {error && (
            <div className="bg-red-50 dark:bg-red-900/50 border border-red-200 dark:border-red-800 rounded-md p-3">
              <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
            </div>
          )}

          <Button type="submit" disabled={isLoading} className="w-full">
            {isLoading
              ? "Loading..."
              : authModalMode === "login"
              ? "Sign In"
              : "Create Account"}
          </Button>
        </form>

        <div className="mt-6 text-center">
          <p className="text-sm text-gray-600 dark:text-gray-400">
            {authModalMode === "login"
              ? "Don't have an account? "
              : "Already have an account? "}
            <button
              onClick={handleSwitchMode}
              className="text-blue-600 hover:text-blue-500 dark:text-blue-400 dark:hover:text-blue-300 font-medium"
              disabled={isLoading}
            >
              {authModalMode === "login" ? "Sign up" : "Sign in"}
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}
